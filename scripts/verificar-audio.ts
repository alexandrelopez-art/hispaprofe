/**
 * Verifica el compresor de audio contra archivos de verdad.
 *
 * No trae ningún audio al repositorio: se fabrica uno.
 * Ejecutar con:  npx tsx scripts/verificar-audio.ts
 */
import { compresoresInstalados, comprimirAudio, generarWav, hayCompresor } from "@/lib/audio";
import ffmpegEmpaquetado from "ffmpeg-static";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function main() {
  // Sin compresor no se puede verificar nada, y decirlo claro evita
  // interpretar el fallo como un error del código.
  if (!(await hayCompresor())) {
    // No es `afirmar(...)`: una afirmación que solo puede ser verdad no
    // comprueba nada, y esto no es un fallo del código sino de la máquina.
    // Merece un mensaje que diga qué hacer, no un "FALLO:".
    throw new Error(
      "No hay compresor de audio en esta máquina (ni afconvert ni ffmpeg), " +
        "así que no se puede verificar nada. En macOS afconvert viene puesto.",
    );
  }

  // El empaquetado tiene que estar siempre, y eso es lo que distingue «hay
  // ffmpeg en esta máquina por casualidad» de «lo llevamos puesto». Es la
  // única afirmación que se puede hacer aquí sobre lo que habrá en Vercel.
  const instalados = await compresoresInstalados();
  afirmar(
    instalados.includes("ffmpeg empaquetado"),
    `el compresor empaquetado está disponible (hay: ${instalados.join(", ")})`,
  );

  // 1. Comprimir reduce. Veinte segundos de WAV son 1,7 MB; comprimidos no
  //    llegan a 200 KB.
  const wav = generarWav(20);
  afirmar(wav.length > 1_000_000, `el WAV de prueba es grande (${wav.length} bytes)`);

  const comprimido = await comprimirAudio(wav, "tono.wav", "audio/wav");
  afirmar(
    comprimido.datos.length < wav.length / 5,
    `comprimir reduce a menos de una quinta parte (${wav.length} → ${comprimido.datos.length})`,
  );
  afirmar(comprimido.tipo === "audio/mp4", "el resultado se declara audio/mp4");
  afirmar(comprimido.nombre === "tono.m4a", "la extensión del nombre acompaña al formato");

  // 2. Lo devuelto es audio de verdad, no bytes cualesquiera. Que la llamada
  //    no lance ya lo garantiza el paso anterior sin ejercitar nada nuevo:
  //    lo que de verdad prueba que es audio válido es que el compresor lo
  //    vuelve a leer, lo vuelve a *comprimir* (medido en esta máquina:
  //    113.562 → 108.305 bytes) y el tipo de salida sigue siendo audio/mp4.
  //    Basura binaria con ese tamaño no encogería ni se declararía así.
  const otraVez = await comprimirAudio(comprimido.datos, "tono.m4a", "audio/mp4");
  afirmar(
    otraVez.datos.length < comprimido.datos.length,
    `recomprimir el m4a vuelve a encoger (${comprimido.datos.length} → ${otraVez.datos.length})`,
  );
  afirmar(otraVez.tipo === "audio/mp4", "y el tipo de salida sigue siendo audio/mp4");

  // 3. Cuando comprimir engordaría, se conserva la entrada tal cual.
  //
  //    El caso hay que buscarlo a propósito: recomprimir el m4a de arriba
  //    NO sirve, porque sale un poco más pequeño (113.562 → 108.305 medido
  //    en esta máquina) y la afirmación pasaría sin ejercitar nada. Veinte
  //    milisegundos sí: son 1.808 bytes de WAV y el m4a mínimo ronda los
  //    4.393, porque el contenedor pesa más que el sonido.
  //
  //    Se compara byte a byte y no por tamaño: lo que se promete es que
  //    devuelve *la entrada*, no algo que casualmente mide lo mismo.
  const brevisimo = generarWav(0.02);
  const sinTocar = await comprimirAudio(brevisimo, "brevisimo.wav", "audio/wav");
  afirmar(
    sinTocar.datos.equals(brevisimo),
    `un audio que engordaría al comprimirse se devuelve idéntico (${brevisimo.length} bytes)`,
  );
  afirmar(sinTocar.tipo === "audio/wav", "y conserva el tipo que traía");
  afirmar(sinTocar.nombre === "brevisimo.wav", "y conserva su nombre original");

  // 4. Lo que no es audio se rechaza. Si esto no lanzara, la ruta guardaría
  //    en la base cualquier cosa que le manden con un tipo de audio.
  //
  //    No basta con que lance: si mañana un bug hace que `comprimirAudio`
  //    reviente siempre (un `mkdtemp` roto, un ENOENT mal propagado...), esta
  //    afirmación seguiría en verde sin haber probado nunca el rechazo de
  //    "no es audio". Por eso se guarda el error y se comprueba su mensaje.
  let error: Error | undefined;
  try {
    await comprimirAudio(Buffer.from("esto no es audio, es texto plano"), "falso.mp3", "audio/mpeg");
  } catch (e) {
    error = e instanceof Error ? e : undefined;
  }
  afirmar(
    error?.message.includes("No se pudo comprimir el audio") ?? false,
    `un archivo que no es audio se rechaza con el error correcto (mensaje: ${error?.message})`,
  );

  // 5. El paso de un compresor al siguiente. `comprimirAudio` los recorre
  //    porque que uno exista no significa que sepa abrir el formato que llega:
  //    `afconvert` no abre el WebM que graba Chrome. Con un solo compresor
  //    instalado eso no se puede ejercitar aquí, y se dice en vez de fingir
  //    una afirmación que pasaría igual con el arreglo y sin él.
  //    (Ya se calculó arriba, para la afirmación del empaquetado: los
  //    compresores están memorizados, así que repetir la llamada no repetiría
  //    la búsqueda.)
  console.log(`\nCompresores instalados: ${instalados.join(", ")}`);
  if (instalados.length < 2) {
    console.log(
      "AVISO: con uno solo, el paso al siguiente compresor NO queda probado. " +
        "Hace falta una máquina con `afconvert` y `ffmpeg`, o la prueba a mano " +
        "en el navegador (grabar en Chrome y entregar).",
    );
  } else {
    // Con los dos: se fabrica un WebM con `ffmpeg` —el único que sabe
    // hacerlo— y se comprime. `afconvert` va primero y no puede abrirlo, así
    // que esto solo pasa si de verdad se prueba el siguiente.
    const { spawn } = await import("node:child_process");
    const { mkdtemp, readFile, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const carpeta = await mkdtemp(join(tmpdir(), "verificar-audio-"));
    try {
      const origen = join(carpeta, "tono.wav");
      const webm = join(carpeta, "tono.webm");
      await writeFile(origen, generarWav(2));
      // El empaquetado si no hay uno suelto en el PATH: con `afconvert` +
      // empaquetado (el caso normal de un Mac sin ffmpeg instalado aparte)
      // `instalados.length` ya es 2 y se entra aquí, así que no se puede dar
      // por hecho que existe un `ffmpeg` a secas.
      const ffmpegParaFabricar = ffmpegEmpaquetado ?? "ffmpeg";
      await new Promise<void>((ok, mal) => {
        const p = spawn(ffmpegParaFabricar, ["-y", "-nostdin", "-i", origen, "-c:a", "libopus", webm]);
        p.on("error", mal);
        p.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`))));
      });
      const bytes = (await readFile(webm)) as Buffer<ArrayBuffer>;
      const salida = await comprimirAudio(bytes, "grabacion.webm", "audio/webm");
      afirmar(
        salida.tipo === "audio/mp4",
        "un WebM de Chrome se comprime: el primer compresor no puede abrirlo y se prueba el siguiente",
      );
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
