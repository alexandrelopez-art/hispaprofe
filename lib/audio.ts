import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Comprime el audio que sube el profesor, para que no tenga que hacerlo él.
 *
 * Los MP3 oficiales del Cervantes vienen en mono a 320 kbps —siete veces más
 * calidad de la que necesita una voz— y pesan hasta 35,7 MB. Como los
 * archivos se guardan dentro de la base de datos, eso son 88 MB por examen
 * de calidad tirada. A 48 kbps la tarea 1 baja a 4,8 MB sin diferencia
 * audible.
 *
 * No importa `prisma` ni nada del navegador: entran bytes y salen bytes.
 */

/** AAC de 48 kbps en mono: lo entienden todos los navegadores. */
const TIPO_SALIDA = "audio/mp4";

type Compresor = {
  orden: string;
  /** Los argumentos, dados el archivo de entrada y el de salida. */
  args: (entrada: string, salida: string) => string[];
};

// En el orden en que se prueban. `afconvert` primero porque viene con macOS
// y es la máquina donde esto corre hoy; `ffmpeg` para cualquier otra.
const COMPRESORES: Compresor[] = [
  {
    orden: "afconvert",
    args: (e, s) => ["-f", "mp4f", "-d", "aac", "-b", "48000", "-c", "1", e, s],
  },
  {
    orden: "ffmpeg",
    // `-vn` descarta cualquier flujo de vídeo: muchos MP3 llevan una carátula
    // incrustada, que ffmpeg trata como vídeo (mjpeg) y selecciona por
    // defecto, y el muxer de `.m4a` no admite mjpeg y aborta con un MP3
    // perfectamente sano. `-nostdin` evita que, lanzado sin terminal, se
    // quede esperando entrada por teclado en vez de fallar o terminar.
    args: (e, s) => ["-y", "-nostdin", "-i", e, "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "48k", s],
  },
];

/**
 * El compresor encontrado, recordado tras la primera búsqueda.
 *
 * `undefined` = todavía no se ha buscado; `null` = se buscó y no hay ninguno.
 * Sin esto, cada subida lanzaría un proceso por candidato solo para
 * averiguar algo que no cambia mientras la aplicación esté viva.
 */
let recordado: Compresor | null | undefined;

// Comprimir quince minutos de audio tarda unos 2 segundos, así que un
// compresor que sigue vivo pasado esto no está trabajando, está colgado. Sin
// este tope un hijo colgado cuelga la petición para siempre y el `finally`
// de `comprimirAudio` —el que borra la carpeta temporal— nunca llega a correr.
const TIEMPO_MAXIMO_MS = 5 * 60 * 1000;

/**
 * Lanza una orden y resuelve con su código de salida, la señal que lo mató
 * (si lo mató una señal, incluida la del propio tope de tiempo) y lo que
 * dijo por stderr.
 */
function lanzar(
  orden: string,
  args: string[],
): Promise<{ codigo: number | null; senal: NodeJS.Signals | null; error: string }> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(orden, args);
    let error = "";
    proceso.stderr.on("data", (trozo) => {
      error += String(trozo);
    });
    const limite = setTimeout(() => proceso.kill("SIGKILL"), TIEMPO_MAXIMO_MS);
    // ENOENT aquí significa "esa orden no existe en esta máquina", que es
    // justo lo que `buscarCompresor` quiere distinguir de un fallo real.
    proceso.on("error", (e) => {
      clearTimeout(limite);
      rechazar(e);
    });
    proceso.on("close", (codigo, senal) => {
      clearTimeout(limite);
      resolver({ codigo, senal, error });
    });
  });
}

async function buscarCompresor(): Promise<Compresor | null> {
  if (recordado !== undefined) return recordado;
  for (const compresor of COMPRESORES) {
    try {
      // Sin argumentos las dos órdenes salen con error y escriben su ayuda.
      // Da igual: lo único que se comprueba es que exista el ejecutable, y
      // eso lo dice que `lanzar` no reviente con ENOENT.
      await lanzar(compresor.orden, []);
      recordado = compresor;
      return recordado;
    } catch {
      // No está en esta máquina; se prueba el siguiente.
    }
  }
  recordado = null;
  return recordado;
}

export async function hayCompresor(): Promise<boolean> {
  return (await buscarCompresor()) !== null;
}

/**
 * Que no haya compresor es culpa del servidor (falta instalar algo), no del
 * profesor ni de su archivo. Una clase propia deja que la ruta distinga esto
 * de "el archivo no es audio" —culpa del cliente— sin tener que adivinarlo
 * a partir del texto del mensaje.
 */
export class CompresorAusenteError extends Error {}

// `Buffer<ArrayBuffer>`, no `Buffer` a secas: la ruta guarda esto en Prisma,
// que exige la variante estrecha (nunca respaldada por un `SharedArrayBuffer`).
// Tiparlo aquí, en el origen, deja que la ruta consuma el resultado sin
// necesitar ninguna aserción propia.
export type AudioComprimido = { datos: Buffer<ArrayBuffer>; tipo: string; nombre: string };

/**
 * Comprime, o devuelve la entrada intacta si comprimir no la hace más
 * pequeña —lo que pasa con un audio ya comprimido y corto—.
 *
 * Escribe archivos temporales porque `afconvert` no acepta tuberías: pasarle
 * `-` como entrada o salida responde «Unknown option: -». Se borran siempre,
 * también cuando algo falla.
 */
export async function comprimirAudio(
  datos: Buffer<ArrayBuffer>,
  nombre: string,
  tipo: string,
): Promise<AudioComprimido> {
  const compresor = await buscarCompresor();
  if (!compresor) {
    throw new CompresorAusenteError(
      "No hay ningún compresor de audio en esta máquina. En macOS viene " +
        "`afconvert`; en otros sistemas hace falta instalar `ffmpeg`.",
    );
  }

  const carpeta = await mkdtemp(join(tmpdir(), "hispaprofe-audio-"));
  try {
    const entrada = join(carpeta, "entrada");
    const salida = join(carpeta, "salida.m4a");
    await writeFile(entrada, datos);

    const { codigo, senal, error } = await lanzar(compresor.orden, compresor.args(entrada, salida));
    if (codigo !== 0) {
      if (senal) {
        // Una muerte por señal —normalmente la del propio tope de tiempo de
        // `lanzar`, un proceso colgado al que se mata— no es lo mismo que un
        // archivo dañado: no hay que culpar al MP3 de que el proceso se
        // quedara colgado.
        throw new Error(
          `El compresor de audio se interrumpió (señal ${senal}); puede que se ` +
            `quedara colgado. Vuelve a intentarlo.`,
        );
      }
      // Pasa con un archivo que no es audio, y con uno corrupto. Los dos
      // tienen que rebotar aquí y no acabar guardados en la base.
      throw new Error(
        `No se pudo comprimir el audio: puede que el archivo esté dañado o no sea audio.` +
          (error.trim() ? ` (${error.trim().split("\n")[0]})` : ""),
      );
    }

    // `readFile` devuelve `Buffer<ArrayBufferLike>`: aquí, y solo aquí, hace
    // falta afirmar que no es un `SharedArrayBuffer` —nunca lo es, porque
    // sale de leer un archivo propio— para que encaje con `AudioComprimido`.
    const comprimido = (await readFile(salida)) as Buffer<ArrayBuffer>;
    // Un audio ya comprimido y corto puede salir más grande: recomprimir solo
    // lo empeoraría, así que en ese caso se guarda lo que llegó.
    if (comprimido.length >= datos.length) {
      return { datos, tipo, nombre };
    }
    return { datos: comprimido, tipo: TIPO_SALIDA, nombre: conExtensionM4a(nombre) };
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/** «T1.mp3» pasa a «T1.m4a»: el nombre guardado no debe mentir del formato. */
function conExtensionM4a(nombre: string): string {
  return nombre.replace(/\.[^./\\]*$/, "") + ".m4a";
}

/**
 * Un WAV de prueba: PCM de 16 bits, mono, 44,1 kHz, con una onda sencilla.
 *
 * Vive aquí y no en el script porque el script no puede fabricarlo con el
 * compresor: `afconvert` solo convierte, no sintetiza, y en la máquina del
 * profesor no hay `ffmpeg`. Escribir el WAV a mano funciona con los dos, y
 * además es el formato más grande posible, que es lo que conviene para
 * comprobar que comprimir reduce.
 */
export function generarWav(segundos: number): Buffer<ArrayBuffer> {
  const hz = 44100;
  // Redondeado porque se le pasan fracciones: el caso que prueba la rama de
  // "conservar el original" son veinte milisegundos.
  const muestras = Math.round(hz * segundos);
  const cuerpo = Buffer.alloc(muestras * 2);
  for (let i = 0; i < muestras; i++) {
    cuerpo.writeInt16LE(Math.round(12000 * Math.sin((2 * Math.PI * 440 * i) / hz)), i * 2);
  }

  const cabecera = Buffer.alloc(44);
  cabecera.write("RIFF", 0);
  cabecera.writeUInt32LE(36 + cuerpo.length, 4);
  cabecera.write("WAVE", 8);
  cabecera.write("fmt ", 12);
  cabecera.writeUInt32LE(16, 16); // tamaño del bloque "fmt "
  cabecera.writeUInt16LE(1, 20); // 1 = PCM sin comprimir
  cabecera.writeUInt16LE(1, 22); // un canal
  cabecera.writeUInt32LE(hz, 24);
  cabecera.writeUInt32LE(hz * 2, 28); // bytes por segundo
  cabecera.writeUInt16LE(2, 32); // bytes por muestra
  cabecera.writeUInt16LE(16, 34); // bits por muestra
  cabecera.write("data", 36);
  cabecera.writeUInt32LE(cuerpo.length, 40);

  return Buffer.concat([cabecera, cuerpo]);
}
