import { prisma } from "@/lib/prisma";

export async function registrarPagina(examenId: string, archivoId: string): Promise<void> {
  const ultimo = await prisma.paginaDeExamen.aggregate({ where: { examenId }, _max: { orden: true } });
  await prisma.paginaDeExamen.create({ data: { examenId, archivoId, orden: (ultimo._max.orden ?? 0) + 1 } });
}

export async function reordenarPaginas(examenId: string, ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, i) => prisma.paginaDeExamen.update({ where: { id, examenId }, data: { orden: i + 1 } })),
  );
}

/** Borra la página y la quita de las tareas que la tuvieran asignada. */
export async function borrarPagina(paginaId: string): Promise<void> {
  const pagina = await prisma.paginaDeExamen.findUnique({ where: { id: paginaId } });
  if (!pagina) return;
  await prisma.$transaction(async (tx) => {
    const tareas = await tx.tareaDeExamen.findMany({ where: { examenId: pagina.examenId, paginaIds: { has: paginaId } } });
    for (const t of tareas) {
      await tx.tareaDeExamen.update({ where: { id: t.id }, data: { paginaIds: t.paginaIds.filter((p) => p !== paginaId) } });
    }
    await tx.paginaDeExamen.delete({ where: { id: paginaId } });
    await tx.archivo.deleteMany({ where: { id: pagina.archivoId } });
  });
}

export async function asignarPaginas(tareaId: string, paginaIds: string[]): Promise<void> {
  const tarea = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaId } });
  const validas = await prisma.paginaDeExamen.findMany({ where: { examenId: tarea.examenId, id: { in: paginaIds } }, orderBy: { orden: "asc" } });
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { paginaIds: validas.map((p) => p.id) } });
}

/**
 * Reparte las páginas en el orden del libro: lectura 1-4 y auditiva 1-4, dos
 * páginas por tarea salvo la última de cada prueba, que se queda con lo que
 * sobre. El profesor corrige después lo que no cuadre.
 */
export async function repartirEnOrden(examenId: string): Promise<void> {
  const examen = await prisma.examen.findUniqueOrThrow({
    where: { id: examenId },
    include: { paginas: { orderBy: { orden: "asc" } }, tareas: { orderBy: [{ prueba: "asc" }, { numero: "asc" }] } },
  });
  const paginas = examen.paginas.map((p) => p.id);
  const porPrueba = Math.ceil(paginas.length / 2);
  const reparto = new Map<string, string[]>();
  for (const prueba of ["CE", "CO"] as const) {
    const tareas = examen.tareas.filter((t) => t.prueba === prueba);
    const desde = prueba === "CE" ? 0 : porPrueba;
    const mias = paginas.slice(desde, prueba === "CE" ? porPrueba : paginas.length);
    tareas.forEach((t, i) => {
      const esUltima = i === tareas.length - 1;
      reparto.set(t.id, esUltima ? mias.slice(i * 2) : mias.slice(i * 2, i * 2 + 2));
    });
  }
  await prisma.$transaction(
    [...reparto].map(([id, paginaIds]) => prisma.tareaDeExamen.update({ where: { id }, data: { paginaIds } })),
  );
}
