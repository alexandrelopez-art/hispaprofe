import { prisma } from "@/lib/prisma";

export const INCLUIR_EXAMEN = {
  paginas: { orderBy: { orden: "asc" as const } },
  tareas: { orderBy: [{ prueba: "asc" as const }, { numero: "asc" as const }] },
};

export async function examenDe(id: string) {
  return prisma.examen.findUnique({ where: { id }, include: INCLUIR_EXAMEN });
}

export type ExamenCompleto = NonNullable<Awaited<ReturnType<typeof examenDe>>>;

export async function listarExamenes() {
  return prisma.examen.findMany({
    orderBy: [{ estado: "asc" }, { numero: "asc" }],
    include: { tareas: { select: { estado: true } } },
  });
}

/** La tarea con su examen y el ejercicio del paso (el `datos` vive ahí). */
export async function tareaDe(id: string) {
  const tarea = await prisma.tareaDeExamen.findUnique({
    where: { id },
    include: { examen: { include: INCLUIR_EXAMEN } },
  });
  if (!tarea) return null;
  const enganche = await prisma.pasoEjercicio.findUnique({
    where: { pasoId: tarea.pasoId },
    include: { ejercicio: true, paso: { include: { bloques: { orderBy: { orden: "asc" } } } } },
  });
  if (!enganche) return null;
  return { ...tarea, ejercicio: enganche.ejercicio, paso: enganche.paso };
}

export type TareaCompleta = NonNullable<Awaited<ReturnType<typeof tareaDe>>>;

/**
 * El id del `Examen` que usa este recorrido como su lectura o su auditiva,
 * o null si el recorrido no es de ningún examen del taller.
 *
 * `Examen.lecturaId`/`auditivaId` son columnas de texto con `@unique`, no
 * claves ajenas —no hay migración de relación para ellas—, así que nada en
 * el esquema impide borrar el `Recorrido` que apuntan y dejar el examen
 * huérfano. Esta consulta es la única defensa: la usan tanto
 * `borrarRecorrido` (para negarse) como la ficha de la secuencia (para
 * enseñar el aviso y esconder el botón de borrar) — una sola regla, no dos
 * copias que se puedan desincronizar.
 */
export async function recorridoDeUnExamen(recorridoId: string): Promise<string | null> {
  const examen = await prisma.examen.findFirst({
    where: { OR: [{ lecturaId: recorridoId }, { auditivaId: recorridoId }] },
    select: { id: true },
  });
  return examen?.id ?? null;
}
