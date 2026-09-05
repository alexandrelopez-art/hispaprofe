import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegEmpaquetado from "ffmpeg-static";

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

/**
 * Los tipos que aceptamos como audio. Vive aquí, con el resto del audio, y no
 * dentro de una ruta: dos listas se separan en cuanto alguien añade un formato
 * a una sola, y entonces el mismo archivo entra por una puerta y rebota en la
 * otra.
 *
 * Un mismo formato llega con nombres distintos según el navegador, y la lista
 * tiene que aceptarlos todos o el profesor se choca con «Solo se admiten
 * imágenes y audios» subiendo un archivo perfectamente válido:
 *
 * - `audio/x-m4a` es lo que dice Safari de un `.m4a` — justo el formato que
 *   este archivo le recomienda generar con `afconvert`, y él trabaja en macOS.
 * - `audio/wave` y `audio/x-wav` son los nombres viejos del WAV, todavía en
 *   uso; `audio/mp3` lo dicen algunos navegadores en vez de `audio/mpeg`.
 *
 * Grabar dentro de la aplicación produce `audio/webm` en Chrome y Firefox y
 * `audio/mp4` en Safari: los dos ya estaban.
 */
export const TIPOS_AUDIO = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
];

/**
 * El tipo sin sus parámetros: `audio/webm;codecs=opus` → `audio/webm`.
 *
 * No es cosmético. `MediaRecorder` nunca entrega un tipo pelado —Chrome dice
 * `audio/webm;codecs=opus` y Firefox `audio/ogg; codecs=opus`, con espacio—,
 * así que comparar contra `TIPOS_AUDIO` sin quitar los parámetros rechazaba
 * con «eso no es un audio» todas las grabaciones del navegador.
 *
 * Lo que sale de aquí es también lo que se guarda en `Archivo.tipo`, y por
 * tanto el `Content-Type` con el que se sirve luego. Se guarda normalizado a
 * propósito: el códec lo averigua el navegador del contenedor mismo —lo hace
 * igual aunque se lo digan—, y dejar entrar un valor con parámetros del
 * cliente en una cabecera de respuesta es abrirle la mano a lo que ponga ahí.
 */
export function tipoBase(tipo: string): string {
  return tipo.split(";")[0].trim().toLowerCase();
}

const EXTENSIONES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
};

/**
 * Un nombre legible para lo que graba el navegador, que llega sin ninguno.
 * Acaba en la columna `Archivo.nombre`, que es lo que ve el profesor —pero no
 * lo usa `comprimirAudio` para nombrar nada en disco: sus archivos
 * temporales se llaman siempre `entrada` y `salida-N.m4a`, fijos a
 * propósito, para que un `Content-Disposition` hostil de la vía por
 * dirección no pueda escribir donde quiera en el sistema de archivos con lo
 * que ponga aquí.
 */
export function nombreDeGrabacion(tipo: string): string {
  return `grabacion.${EXTENSIONES[tipo] ?? "audio"}`;
}

type Compresor = {
  /** Cómo se llama para contarlo, que ya no es lo mismo que cómo se ejecuta. */
  nombre: string;
  orden: string;
  /** Los argumentos, dados el archivo de entrada y el de salida. */
  args: (entrada: string, salida: string) => string[];
};

/**
 * Los argumentos de ffmpeg, que ahora los usan dos entradas de la lista: el
 * `ffmpeg` que pueda haber en el `PATH` y el que llevamos empaquetado. Es el
 * mismo programa, así que se le habla igual; escribirlo dos veces sería dejar
 * puesta la trampa de que un día alguien arregle una copia y no la otra.
 *
 * `-vn` descarta cualquier flujo de vídeo: muchos MP3 llevan una carátula
 * incrustada, que ffmpeg trata como vídeo (mjpeg) y selecciona por defecto, y
 * el muxer de `.m4a` no admite mjpeg y aborta con un MP3 perfectamente sano.
 * `-nostdin` evita que, lanzado sin terminal, se quede esperando entrada por
 * teclado en vez de fallar o terminar.
 */
const ARGS_FFMPEG = (e: string, s: string) => [
  "-y", "-nostdin", "-i", e, "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "48k", s,
];

// En el orden en que se prueban. `afconvert` primero porque viene con macOS
// y es la máquina donde esto corre hoy; `ffmpeg` para cualquier otra.
//
// No es una lista de repuestos para máquinas distintas: es una lista de
// intentos sobre el **mismo** archivo. `afconvert` es CoreAudio, y CoreAudio
// no sabe abrir WebM/Matroska —`afconvert -hf` lista Ogg, no WebM—, así que
// una grabación de Chrome (`audio/webm;codecs=opus`) le arranca un
// «Couldn't open input file ('typ?')» por muy sana que esté. Con `ffmpeg`
// instalado, ese mismo archivo pasa. Por eso `comprimirAudio` los recorre en
// vez de quedarse con el primero que exista: elegir uno solo dejaba fuera al
// navegador de la mayoría.
const COMPRESORES: Compresor[] = [
  {
    nombre: "afconvert",
    orden: "afconvert",
    args: (e, s) => ["-f", "mp4f", "-d", "aac", "-b", "48000", "-c", "1", e, s],
  },
  {
    nombre: "ffmpeg",
    orden: "ffmpeg",
    args: ARGS_FFMPEG,
  },
  // El último a propósito: es el único que existe siempre, así que ponerlo
  // antes dejaría los otros dos sin usarse nunca. Y hace falta porque en
  // Vercel no hay ninguno de los dos anteriores —`afconvert` es de macOS, y el
  // runtime no trae `ffmpeg`—: o el binario viaja dentro del despliegue o no
  // hay con qué comprimir.
  //
  // El diseño del 01/08/2026 descartó este paquete por sus 80 MB y por la
  // GPL-3.0, con la condición de que «el día que se despliegue en Linux,
  // instalar ffmpeg en ese servidor es una línea de configuración». Esa
  // condición no se cumple aquí: en Vercel no hay servidor donde instalar
  // nada. Sobre la licencia: el binario se ejecuta como proceso aparte y no se
  // distribuye —corre en nuestro servidor, a nadie le llega una copia—, y la
  // GPLv3 no tiene cláusula de uso en red.
  ...(ffmpegEmpaquetado
    ? [{ nombre: "ffmpeg empaquetado", orden: ffmpegEmpaquetado, args: ARGS_FFMPEG }]
    : []),
];

/**
 * Los compresores instalados en esta máquina, recordados tras la primera
 * búsqueda. `undefined` = todavía no se ha buscado; la lista vacía = se buscó
 * y no hay ninguno.
 *
 * Son **todos** los que existen y no el primero: `comprimirAudio` necesita
 * poder pasar al siguiente cuando el que eligió no sabe abrir un archivo
 * concreto. Sin esto, cada subida lanzaría un proceso por candidato solo para
 * averiguar algo que no cambia mientras la aplicación esté viva.
 */
let recordados: Compresor[] | undefined;

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

async function buscarCompresores(): Promise<Compresor[]> {
  if (recordados !== undefined) return recordados;
  const encontrados: Compresor[] = [];
  for (const compresor of COMPRESORES) {
    try {
      // Sin argumentos las dos órdenes salen con error y escriben su ayuda.
      // Da igual: lo único que se comprueba es que exista el ejecutable, y
      // eso lo dice que `lanzar` no reviente con ENOENT.
      await lanzar(compresor.orden, []);
      encontrados.push(compresor);
    } catch {
      // No está en esta máquina; se prueba el siguiente.
    }
  }
  recordados = encontrados;
  return recordados;
}

export async function hayCompresor(): Promise<boolean> {
  return (await buscarCompresores()).length > 0;
}

/**
 * Los nombres de los compresores instalados aquí. Solo para el script: con uno
 * solo, el paso al siguiente no se puede ejercitar, y eso hay que poder decirlo
 * en vez de fingir que se probó.
 */
export async function compresoresInstalados(): Promise<string[]> {
  return (await buscarCompresores()).map((c) => c.nombre);
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
 *
 * Prueba **todos** los compresores instalados, en orden, hasta que uno
 * consiga leer el archivo. No es paranoia: que un compresor exista no
 * significa que sepa abrir este formato —`afconvert` no abre WebM, que es lo
 * que graba Chrome—, y rendirse con el primero dejaba a media clase sin poder
 * entregar. `CompresorAusenteError` sale solo cuando no hay ninguno instalado,
 * que es lo único que de verdad es culpa del servidor.
 */
export async function comprimirAudio(
  datos: Buffer<ArrayBuffer>,
  nombre: string,
  tipo: string,
): Promise<AudioComprimido> {
  const compresores = await buscarCompresores();
  if (compresores.length === 0) {
    throw new CompresorAusenteError(
      "No hay ningún compresor de audio disponible. Debería venir uno " +
        "empaquetado con la aplicación: si esto sale en el servidor, el " +
        "binario de `ffmpeg-static` no ha viajado con el despliegue.",
    );
  }

  const carpeta = await mkdtemp(join(tmpdir(), "hispaprofe-audio-"));
  try {
    const entrada = join(carpeta, "entrada");
    await writeFile(entrada, datos);

    let ultimoFallo: Error | null = null;
    for (const [indice, compresor] of compresores.entries()) {
      // Una salida por candidato: si el anterior dejó un archivo a medias, un
      // nombre compartido haría que se leyera el suyo en vez del bueno.
      const salida = join(carpeta, `salida-${indice}.m4a`);
      const { codigo, senal, error } = await lanzar(compresor.orden, compresor.args(entrada, salida));

      if (codigo !== 0) {
        if (senal) {
          // Una muerte por señal —normalmente la del propio tope de tiempo de
          // `lanzar`, un proceso colgado al que se mata— no es lo mismo que un
          // archivo dañado: no hay que culpar al MP3 de que el proceso se
          // quedara colgado. Y no se reintenta con el siguiente: el que se
          // cuelga ya se llevó cinco minutos, y encadenar otro tanto es dejar
          // la petición muerta el doble de tiempo.
          throw new Error(
            `El compresor de audio se interrumpió (señal ${senal}); puede que se ` +
              `quedara colgado. Vuelve a intentarlo.`,
          );
        }
        // Pasa con un archivo que no es audio, con uno corrupto y con un
        // contenedor que **este** compresor no sabe abrir. Los tres se
        // distinguen entre sí probando el siguiente: si todos fallan, el
        // archivo es el problema y hay que rebotarlo en vez de guardarlo.
        ultimoFallo = new Error(
          `No se pudo comprimir el audio: puede que el archivo esté dañado o no sea audio.` +
            (error.trim() ? ` (${error.trim().split("\n")[0]})` : ""),
        );
        continue;
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
    }

    // Ninguno pudo con él. Se cuenta el fallo del último, que es el del
    // compresor más capaz de los instalados.
    throw ultimoFallo ?? new Error("No se pudo comprimir el audio.");
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/** «T1.mp3» pasa a «T1.m4a»: el nombre guardado no debe mentir del formato. */
function conExtensionM4a(nombre: string): string {
  return nombre.replace(/\.[^./\\]*$/, "") + ".m4a";
}

/**
 * La extensión que le corresponde a un tipo, para el archivo temporal que
 * se le pasa a ffmpeg. Reutiliza `EXTENSIONES`, la misma tabla de
 * `nombreDeGrabacion`: dos mapas del mismo mime a la misma extensión se
 * desincronizan en cuanto alguien añade un formato a uno solo.
 */
function extensionDe(tipo: string): string {
  return EXTENSIONES[tipo] ?? "bin";
}

/** Los ffmpeg disponibles, en orden: el del sistema si lo hay, si no el empaquetado. */
async function ffmpegs(): Promise<Compresor[]> {
  return (await buscarCompresores()).filter((c) => c.nombre.startsWith("ffmpeg"));
}

/** Duración en segundos, leída con ffmpeg (`-f null` y el `time=` del stderr). */
export async function duracionDe(datos: Buffer, tipo: string): Promise<number> {
  const [ff] = await ffmpegs();
  if (!ff) throw new CompresorAusenteError("No hay ffmpeg para leer el audio.");
  const carpeta = await mkdtemp(join(tmpdir(), "duracion-"));
  const entrada = join(carpeta, `in.${extensionDe(tipo)}`);
  try {
    await writeFile(entrada, datos);
    const { error } = await lanzar(ff.orden, ["-nostdin", "-i", entrada, "-f", "null", "-"]);
    const m = [...error.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
    if (!m) throw new Error("No se pudo leer la duración del audio.");
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/**
 * Corta en los segundos dados (ordenados, dentro de la duración) y devuelve
 * un trozo por tramo, en AAC mono a 48 kbps como todo el audio del sitio.
 * Se re-codifica en vez de copiar: copiar corta en el marco AAC anterior y
 * deja hasta 20 ms del diálogo siguiente al final de cada trozo.
 */
export async function cortarAudio(datos: Buffer, tipo: string, cortes: number[]): Promise<{ trozos: Buffer<ArrayBuffer>[]; tipo: "audio/mp4" }> {
  const [ff] = await ffmpegs();
  if (!ff) throw new CompresorAusenteError("No hay ffmpeg para cortar el audio.");
  const duracion = await duracionDe(datos, tipo);
  const puntos = [0, ...cortes.filter((c) => c > 0 && c < duracion).sort((a, b) => a - b), duracion];
  const carpeta = await mkdtemp(join(tmpdir(), "cortes-"));
  const entrada = join(carpeta, `in.${extensionDe(tipo)}`);
  try {
    await writeFile(entrada, datos);
    // `Buffer<ArrayBuffer>`, no `Buffer` a secas: igual que `AudioComprimido`
    // más abajo, esto acaba en `Prisma`, que exige la variante estrecha.
    const trozos: Buffer<ArrayBuffer>[] = [];
    for (let i = 0; i < puntos.length - 1; i++) {
      const salida = join(carpeta, `t${i}.m4a`);
      // `-ss` antes de `-i` para el corte rápido (busca sin decodificar
      // hasta el punto). `-t <duración>` y no `-to <fin>`: con `-ss` como
      // opción de entrada, distintas versiones de ffmpeg han tratado `-to`
      // como si fuera otra duración —no un instante final—, lo que corta
      // el trozo dos veces más corto o más largo de lo que toca. Dándole
      // directamente la duración del tramo no hay ambigüedad posible.
      const duracionTrozo = puntos[i + 1] - puntos[i];
      const r = await lanzar(ff.orden, ["-y", "-nostdin", "-ss", String(puntos[i]), "-t", String(duracionTrozo), "-i", entrada, "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "48k", salida]);
      if (r.codigo !== 0) throw new Error(`ffmpeg no pudo cortar el trozo ${i + 1}: ${r.error.slice(-300)}`);
      trozos.push((await readFile(salida)) as Buffer<ArrayBuffer>);
    }
    return { trozos, tipo: "audio/mp4" };
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
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
