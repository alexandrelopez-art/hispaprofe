import { prisma } from "@/lib/prisma";

/** Lo que `Base64ImageSource` del SDK de Anthropic admite como `media_type`. */
export const TIPOS_DE_IMAGEN_ACEPTADOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Registra una página nueva, o rehúsa sin crear nada.
 *
 * Antes aceptaba cualquier `archivoId` que llegara de la acción, sin mirar
 * si el `Archivo` existía, si era `privado` o de qué tipo era: dos clics
 * (registrar una página con el id de un archivo ajeno, luego quitarla)
 * bastaban para que cualquier `PROFESOR`/`ADMIN` borrara un `Archivo`
 * cualquiera de la base, incluida la grabación privada de un alumno —
 * `borrarPagina`, más abajo, borraba el archivo apuntado sin estrechar el
 * filtro. Aquí se cierra la entrada: solo una imagen propia (no privada, de
 * un tipo que la IA sepa leer) llega a ser página de un examen.
 */
export async function registrarPagina(examenId: string, archivoId: string): Promise<boolean> {
  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId } });
  if (!archivo || archivo.privado || !TIPOS_DE_IMAGEN_ACEPTADOS.has(archivo.tipo)) return false;
  const ultimo = await prisma.paginaDeExamen.aggregate({ where: { examenId }, _max: { orden: true } });
  await prisma.paginaDeExamen.create({ data: { examenId, archivoId, orden: (ultimo._max.orden ?? 0) + 1 } });
  return true;
}

export async function reordenarPaginas(examenId: string, ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, i) => prisma.paginaDeExamen.update({ where: { id, examenId }, data: { orden: i + 1 } })),
  );
}

/**
 * Borra la página y la quita de las tareas que la tuvieran asignada.
 *
 * El `Archivo` apuntado se borra con él solo si nada más lo reclama: ni
 * está `privado` (con `registrarPagina` cerrada de entrada no debería
 * llegar ninguno, pero borrar por lo que diga la fila sin comprobarlo de
 * nuevo aquí sería confiar en que la única puerta de entrada nunca falla),
 * ni lo referencia ninguna otra `PaginaDeExamen` (el conteo se hace después
 * de borrar esta fila, dentro de la misma transacción, así que ya no se
 * cuenta a sí misma).
 */
export async function borrarPagina(paginaId: string): Promise<void> {
  const pagina = await prisma.paginaDeExamen.findUnique({ where: { id: paginaId } });
  if (!pagina) return;
  await prisma.$transaction(async (tx) => {
    const tareas = await tx.tareaDeExamen.findMany({ where: { examenId: pagina.examenId, paginaIds: { has: paginaId } } });
    for (const t of tareas) {
      await tx.tareaDeExamen.update({ where: { id: t.id }, data: { paginaIds: t.paginaIds.filter((p) => p !== paginaId) } });
    }
    await tx.paginaDeExamen.delete({ where: { id: paginaId } });
    const otrasReferencias = await tx.paginaDeExamen.count({ where: { archivoId: pagina.archivoId } });
    if (otrasReferencias === 0) {
      await tx.archivo.deleteMany({ where: { id: pagina.archivoId, privado: false } });
    }
  });
}

export async function asignarPaginas(tareaId: string, paginaIds: string[]): Promise<void> {
  const tarea = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaId } });
  const validas = await prisma.paginaDeExamen.findMany({ where: { examenId: tarea.examenId, id: { in: paginaIds } }, orderBy: { orden: "asc" } });
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { paginaIds: validas.map((p) => p.id) } });
}

/**
 * Reparte las páginas de cada prueba en proporción a sus cuatro tareas: con
 * `k` páginas, la tarea `i` (0-indexada) se lleva las páginas con índice en
 * `[⌊i·k/4⌋, ⌈(i+1)·k/4⌉)`.
 *
 * Cuando `k` no es múltiplo de 4, dos tareas vecinas pueden compartir una
 * página (con 7 páginas, la tarea 2 recibe la 2-3-4 y la tarea 3 recibe la
 * 4-5-6: la página 4 cae en las dos). No es un descuido: el libro captura
 * cada tarea en pliegos a doble página, así que una tarea real casi siempre
 * comparte página con la siguiente, y repartir con ese solape es más fiel
 * al cuadernillo que cortar en seco y dejarle todo el sobrante a la última
 * tarea. El profesor corrige después lo que no cuadre.
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
    const k = mias.length;
    tareas.forEach((t, i) => {
      const inicio = Math.floor((i * k) / tareas.length);
      const fin = Math.ceil(((i + 1) * k) / tareas.length);
      reparto.set(t.id, mias.slice(inicio, fin));
    });
  }
  await prisma.$transaction(
    [...reparto].map(([id, paginaIds]) => prisma.tareaDeExamen.update({ where: { id }, data: { paginaIds } })),
  );
}
