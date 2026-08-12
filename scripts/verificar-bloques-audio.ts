/**
 * Verifica el portero del audio de un bloque y los dos detectores de Drive.
 *
 * Los detectores y el portero son puros, así que se prueban sin tocar la base.
 * La última afirmación sí escribe: comprueba que un bloque AUDIO con una
 * dirección nuestra se raciona de verdad.
 *
 * Ejecutar con:  npx tsx scripts/verificar-bloques-audio.ts
 */
import "dotenv/config";
import { esAudioDeDrive, idDrive, motivoSiAudioDeDrive } from "@/lib/bloques";
import { prisma } from "@/lib/prisma";

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
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
