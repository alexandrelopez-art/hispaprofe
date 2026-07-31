import { Prisma } from "@/lib/generated/prisma/client";
import type { TipoEjercicio } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { analizar } from "@/lib/ejercicios/registro";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";

// Solo de servidor: `analizar` arrastra `lib/ejercicios/registro.ts`, que
// importa `node:crypto`. Ningún componente de cliente puede importar esto.

/**
 * `Ejercicio.tipo` (el enum de la base) y `datos.ejercicio` (lo que lee el
 * motor) son dos datos distintos que tienen que decir lo mismo. Esta tabla
 * vivía a mano dentro de `scripts/sembrar-ejercicios-demo.ts`, con un
 * comentario avisando de que nada la vigilaba. Vive aquí para que solo haya
 * un sitio donde puedan discrepar, y para que el script la ejercite.
 *
 * `WIDGET` no está: no tiene ningún `datos.ejercicio` que le corresponda.
 */
export const TIPO_DE_EJERCICIO: Record<MarcaEjercicio, TipoEjercicio> = {
  opcion: "OPCION_MULTIPLE",
  huecos: "HUECOS",
  relacionar: "RELACIONAR",
  ordenar: "ORDENAR",
};

/** El `TipoEjercicio` que le toca a un `datos`, o null si no es válido. */
export function tipoDeEjercicio(datos: unknown): TipoEjercicio | null {
  const analizado = analizar(datos);
  return analizado ? TIPO_DE_EJERCICIO[analizado.tipo] : null;
}

/**
 * Si la fila sigue estando.
 *
 * Las reglas que terminan en un `update` o un `delete` la consultan antes:
 * sin esto, actuar sobre un ejercicio que otra pestaña acaba de borrar
 * llegaba a Prisma y reventaba con un P2025 sin capturar. Un motivo escrito
 * en castellano es lo que el editor sabe enseñar; una excepción, no.
 */
async function existe(ejercicioId: string): Promise<boolean> {
  const fila = await prisma.ejercicio.findUnique({
    where: { id: ejercicioId },
    select: { id: true },
  });
  return fila !== null;
}

/**
 * Si alguien ya respondió el ejercicio de este paso.
 *
 * `respuestas` es `Json?`, y en Prisma eso tiene dos nulos distintos:
 * `Prisma.DbNull` es la columna vacía y `Prisma.JsonNull` es el valor JSON
 * `null` guardado dentro. Aquí interesa el primero: un `PasoCompletado`
 * existe en cuanto el estudiante marca el paso, tenga o no ejercicio, así
 * que contar filas a secas daría falsos positivos en todos los pasos de solo
 * lectura.
 */
export async function tieneRespuestas(pasoId: string): Promise<boolean> {
  const cuantos = await prisma.pasoCompletado.count({
    where: { pasoId, NOT: { respuestas: { equals: Prisma.DbNull } } },
  });
  return cuantos > 0;
}

/**
 * Si a este paso se le puede colgar este ejercicio, o el motivo del no.
 *
 * Tres negativas y las tres tienen la misma raíz: que el estudiante acabe
 * viendo algo distinto de lo que el profesor cree que puso.
 */
export async function puedeEngancharse(
  ejercicioId: string,
  pasoId: string,
): Promise<string | null> {
  const ejercicio = await prisma.ejercicio.findUnique({
    where: { id: ejercicioId },
    select: { publicado: true },
  });
  if (!ejercicio) return "Ese ejercicio no existe.";
  if (!ejercicio.publicado) {
    return "Es un borrador. Publícalo antes de colgarlo de un paso.";
  }

  // La página del paso hace `findFirst` ordenado y descarta el resto, porque
  // la corrección escribe los puntos del paso entero y dos ejercicios se
  // pisarían. Sin esta negativa, el segundo se guardaría y no lo vería nadie.
  const yaHay = await prisma.pasoEjercicio.count({ where: { pasoId } });
  if (yaHay > 0) {
    return "Ese paso ya tiene un ejercicio. Quita el que hay antes de poner otro.";
  }

  if (await tieneRespuestas(pasoId)) {
    return "Alguien ya respondió en ese paso. Cambiarle el ejercicio dejaría sus respuestas sin sentido.";
  }
  return null;
}

/** Si se le puede quitar el ejercicio a este paso, o el motivo del no. */
export async function puedeDesengancharse(pasoId: string): Promise<string | null> {
  if (await tieneRespuestas(pasoId)) {
    return "Alguien ya respondió en ese paso. Quitarle el ejercicio dejaría sus respuestas sin sentido.";
  }
  return null;
}

/**
 * Si este ejercicio se puede borrar, o el motivo del no.
 *
 * No es una regla inventada: la relación de `PasoEjercicio` hacia `Ejercicio`
 * no tiene borrado en cascada, así que borrar uno enganchado revienta contra
 * una clave foránea. Mejor decirlo que dejar que explote.
 */
export async function puedeBorrarse(ejercicioId: string): Promise<string | null> {
  if (!(await existe(ejercicioId))) return "Ese ejercicio no existe.";

  const cuantos = await prisma.pasoEjercicio.count({ where: { ejercicioId } });
  if (cuantos > 0) {
    return `Cuelga de ${cuantos} paso${cuantos !== 1 ? "s" : ""}. Despublícalo en vez de borrarlo.`;
  }
  return null;
}

/**
 * Si este ejercicio se puede volver a borrador, o el motivo del no.
 *
 * Misma consulta que `puedeBorrarse`, pero para el otro sentido: si colgara
 * de un paso, el estudiante que lo tiene delante se quedaría con un
 * ejercicio que la aplicación considera a medio escribir.
 */
export async function puedeDespublicarse(ejercicioId: string): Promise<string | null> {
  if (!(await existe(ejercicioId))) return "Ese ejercicio no existe.";

  const cuantos = await prisma.pasoEjercicio.count({ where: { ejercicioId } });
  if (cuantos > 0) {
    return "Cuelga de un paso. Quítalo de ahí antes de volverlo a borrador.";
  }
  return null;
}

/**
 * Si este ejercicio se puede editar, o el motivo del no.
 *
 * Lo que prohíbe no es estar enganchado: es que alguien haya respondido. Las
 * respuestas se guardan indexadas por el id de cada pregunta, así que
 * cambiarle las preguntas por dentro las dejaría apuntando a ids que ya no
 * existen. Estar enganchado sin responder no rompe nada.
 */
export async function puedeEditarse(ejercicioId: string): Promise<string | null> {
  if (!(await existe(ejercicioId))) return "Ese ejercicio no existe.";

  const vinculos = await prisma.pasoEjercicio.findMany({
    where: { ejercicioId },
    select: { pasoId: true },
  });
  for (const v of vinculos) {
    if (await tieneRespuestas(v.pasoId)) {
      return "Alguien ya lo respondió. Duplícalo y edita la copia.";
    }
  }
  return null;
}

/**
 * Copia un ejercicio en borrador y devuelve el id de la copia, o null si el
 * original no existe.
 *
 * Es la salida de `puedeEditarse`: en vez de montar un historial de
 * versiones, el original se queda quieto para que las respuestas que apuntan
 * a él sigan significando algo.
 */
export async function duplicar(ejercicioId: string): Promise<string | null> {
  const original = await prisma.ejercicio.findUnique({ where: { id: ejercicioId } });
  if (!original) return null;

  const copia = await prisma.ejercicio.create({
    data: {
      tipo: original.tipo,
      titulo: `${original.titulo} (copia)`,
      nivel: original.nivel,
      destreza: original.destreza,
      etiquetas: original.etiquetas,
      datos: original.datos as Prisma.InputJsonValue,
      publicado: false,
      autorId: original.autorId,
    },
  });
  return copia.id;
}
