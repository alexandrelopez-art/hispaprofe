/**
 * Verifica el portero del audio de un bloque y los dos detectores de Drive.
 *
 * Los detectores y el portero son puros, así que se prueban sin tocar la base.
 * Las dos últimas afirmaciones sí escriben: comprueban que un bloque AUDIO con
 * dirección nuestra se raciona de verdad, y que un EMBED de Drive no —que es
 * justo la razón por la que hace falta la marca en la ficha del paso.
 *
 * Ejecutar con:  npx tsx scripts/verificar-bloques-audio.ts
 */
import "dotenv/config";
import { esAudioDeDrive, idDrive, motivoSiAudioDeDrive } from "@/lib/bloques";
import { maximoDeEscucha } from "@/lib/escuchas";
import { prisma } from "@/lib/prisma";

// Lo que crea la última afirmación, para que el `.finally()` pueda borrarlo
// aunque `main()` reviente antes de llegar al final.
let recorridoId: string | null = null;
let profesorId: string | null = null;

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function main() {
  // ─── Los dos detectores, que no son intercambiables ──────────────────
  const DEL_NAVEGADOR = "https://drive.google.com/file/d/1AbC_dEfGhIjKlMnOpQr/view?usp=sharing";
  const YA_CONVERTIDA = "https://drive.google.com/file/d/1AbC_dEfGhIjKlMnOpQr/preview";
  const NUESTRA = "/api/archivos/cms5dr9t9000fy59gli9s09qz";
  const DIRECTA = "https://ejemplo.test/audios/tarea1.mp3";

  afirmar(
    idDrive(DEL_NAVEGADOR) !== "",
    "idDrive caza la dirección que se copia del navegador (/file/d/…/view)",
  );
  afirmar(
    idDrive("https://drive.google.com/open?id=1AbC_dEfGhIjKlMnOpQr") !== "",
    "idDrive caza la forma open?id=",
  );
  afirmar(idDrive(NUESTRA) === "", "idDrive no confunde una dirección nuestra con Drive");
  afirmar(idDrive(DIRECTA) === "", "idDrive no confunde una dirección directa con Drive");

  afirmar(esAudioDeDrive(YA_CONVERTIDA), "esAudioDeDrive reconoce la forma ya convertida a /preview");
  afirmar(
    !esAudioDeDrive(DEL_NAVEGADOR),
    "esAudioDeDrive NO reconoce la del navegador: por eso no sirve de portero",
  );
  afirmar(!esAudioDeDrive(NUESTRA), "esAudioDeDrive es falso para una dirección nuestra");
  afirmar(!esAudioDeDrive(null), "esAudioDeDrive aguanta un null");

  // ─── El portero ──────────────────────────────────────────────────────
  afirmar(
    motivoSiAudioDeDrive("AUDIO", DEL_NAVEGADOR) !== null,
    "el portero rechaza un AUDIO con la dirección de Drive del navegador",
  );
  afirmar(
    motivoSiAudioDeDrive("AUDIO", YA_CONVERTIDA) !== null,
    "el portero rechaza un AUDIO con la dirección de Drive ya convertida",
  );
  afirmar(
    motivoSiAudioDeDrive("EMBED", DEL_NAVEGADOR) === null,
    "el portero es estrecho: un EMBED de Drive sigue entrando, que puede ser un vídeo",
  );
  afirmar(
    motivoSiAudioDeDrive("AUDIO", NUESTRA) === null,
    "el portero deja pasar un AUDIO con una dirección nuestra, que es lo que se busca",
  );
  afirmar(
    motivoSiAudioDeDrive("AUDIO", DIRECTA) === null,
    "el portero deja pasar un AUDIO con una dirección directa: esa suena y se raciona",
  );
  afirmar(
    (motivoSiAudioDeDrive("AUDIO", DEL_NAVEGADOR) ?? "").toLowerCase().includes("drive"),
    "el motivo del portero menciona Drive, que es lo que hay que arreglar",
  );

  // ─── El racionamiento, de verdad y no solo la fila ───────────────────
  const marca = `verificar-bloques-audio-${process.pid}`;
  const profe = await prisma.user.create({
    data: { email: `${marca}@ejemplo.test`, role: "PROFESOR" },
    select: { id: true },
  });
  profesorId = profe.id;

  const secuencia = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · CO`,
      nivel: "A2_B1_ESCOLAR",
      destreza: "CO",
      tipo: "PREPARACION_DELE",
      orden: 9990,
      autorId: profe.id,
    },
    select: { id: true },
  });
  recorridoId = secuencia.id;

  const paso = await prisma.paso.create({
    data: { recorridoId: secuencia.id, titulo: "Tarea 1", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
    select: { id: true },
  });

  const nuestro = await prisma.bloque.create({
    data: { pasoId: paso.id, orden: 1, tipo: "AUDIO", url: NUESTRA, etiqueta: "Audio de la tarea 1" },
    select: { id: true },
  });
  afirmar(
    (await maximoDeEscucha(paso.id, nuestro.id)) === 1,
    "un bloque AUDIO con dirección nuestra se puede oír una sola vez en una prueba",
  );

  // El mismo bloque, incrustado: `maximoDeEscucha` no lo raciona, y eso es
  // justo lo que la marca de la pantalla tiene que avisar.
  const incrustado = await prisma.bloque.create({
    data: { pasoId: paso.id, orden: 2, tipo: "EMBED", url: YA_CONVERTIDA },
    select: { id: true },
  });
  afirmar(
    (await maximoDeEscucha(paso.id, incrustado.id)) === null,
    "un EMBED de Drive NO se raciona: por eso hace falta la marca en la ficha del paso",
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (recorridoId) {
      const pasos = await prisma.paso.findMany({ where: { recorridoId }, select: { id: true } });
      const pasoIds = pasos.map((p) => p.id);
      await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.paso.deleteMany({ where: { recorridoId } });
      await prisma.recorrido.delete({ where: { id: recorridoId } });
    }
    if (profesorId) await prisma.user.delete({ where: { id: profesorId } });
    await prisma.$disconnect();
  });
