import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { bloquePorOrden } from "@/lib/preparacion";
import { prisma } from "@/lib/prisma";

/**
 * Las tarjetas de un bloque de `/preparacion` y en qué punto está el alumno.
 *
 * Solo de servidor: importa `prisma`. La tabla de bloques vive aparte, en
 * `lib/preparacion.ts`, que es pura y la puede mirar también el cliente.
 */

export type EstadoTarjeta =
  | { clase: "SIN_EMPEZAR" }
  | { clase: "A_MEDIAS"; hechos: number; total: number }
  | { clase: "ENTREGADO"; total: number }
  | { clase: "REVISADO"; puntos: number };

export type Tarjeta = {
  recorridoId: string;
  titulo: string;
  nivel: Nivel;
  destreza: Destreza | null;
  examen: number | null;
  pasos: number;
  estado: EstadoTarjeta;
};

/**
 * En qué punto está una asignación, a partir de sus pasos completados.
 *
 * «Revisado» pide que estén **todos** revisados. Con uno revisado y otro sin
 * entregar sigue siendo «a medias»: decirle «revisado» al alumno cuando le
 * queda media prueba es decirle que ha terminado.
 */
export function estadoDeAsignacion(
  pasos: number,
  completados: { verificadoEl: Date | null; puntos: number | null }[],
): EstadoTarjeta {
  if (completados.length === 0) return { clase: "SIN_EMPEZAR" };
  if (completados.length < pasos) {
    return { clase: "A_MEDIAS", hechos: completados.length, total: pasos };
  }
  if (completados.every((c) => c.verificadoEl !== null)) {
    return {
      clase: "REVISADO",
      puntos: completados.reduce((suma, c) => suma + (c.puntos ?? 0), 0),
    };
  }
  return { clase: "ENTREGADO", total: pasos };
}

/**
 * Las tarjetas de un bloque.
 *
 * Dos consultas y no una por tarjeta: con siete exámenes de cuatro pruebas, el
 * bloque 2 tiene veintiocho secuencias, y una consulta de estado por tarjeta
 * son veintiocho viajes a la base para pintar una lista.
 */
export async function catalogoDeBloque(
  orden: number,
  estudianteId: string | null,
): Promise<Tarjeta[]> {
  const recorridos = await prisma.recorrido.findMany({
    where: { tipo: "PREPARACION_DELE", orden, publicado: true },
    select: {
      id: true,
      titulo: true,
      nivel: true,
      destreza: true,
      examen: true,
      _count: { select: { pasos: true } },
    },
    // Por examen y prueba, no por título: con diez exámenes, el título pone el
    // 10 antes que el 2. Las que no son de un examen concreto van al final.
    orderBy: [{ examen: "asc" }, { destreza: "asc" }, { titulo: "asc" }],
  });

  const porRecorrido = new Map<string, { verificadoEl: Date | null; puntos: number | null }[]>();
  if (estudianteId && recorridos.length > 0) {
    const asignaciones = await prisma.asignacion.findMany({
      where: {
        estudianteId,
        archivada: false,
        recorridoId: { in: recorridos.map((r) => r.id) },
      },
      select: {
        recorridoId: true,
        completados: { select: { verificadoEl: true, puntos: true } },
      },
    });
    for (const a of asignaciones) porRecorrido.set(a.recorridoId, a.completados);
  }

  return recorridos.map((r) => ({
    recorridoId: r.id,
    titulo: r.titulo,
    nivel: r.nivel,
    destreza: r.destreza,
    examen: r.examen,
    pasos: r._count.pasos,
    estado: estadoDeAsignacion(r._count.pasos, porRecorrido.get(r.id) ?? []),
  }));
}

/**
 * El profesor que responde por este alumno: el de su grupo.
 *
 * Un alumno no tiene «su profesor» guardado en ninguna parte; se deduce del
 * grupo, que es el único vínculo real que existe hoy. Con varios grupos
 * activos se toma aquel en el que entró más tarde: es un desempate arbitrario
 * y por eso se escribe aquí, en vez de dejarlo al orden que devuelva la base.
 *
 * Un grupo archivado no cuenta: su profesor ya no responde por ese alumno.
 */
export async function profesorDelEstudiante(estudianteId: string): Promise<string | null> {
  const membresia = await prisma.miembroGrupo.findFirst({
    where: { estudianteId, grupo: { archivado: false } },
    orderBy: { createdAt: "desc" },
    select: { grupo: { select: { profesorId: true } } },
  });
  return membresia?.grupo.profesorId ?? null;
}

/**
 * Abre una práctica a un alumno: comprueba y crea la asignación, o dice por
 * qué no.
 *
 * Si ya tenía asignación de ese recorrido **no se toca nada** y se devuelve la
 * suya. No se reutiliza `asignarA` (`lib/acciones.ts`), cuyo `upsert` pone
 * `archivada: false` y reescribe el `profesorId`: por esa vía un alumno
 * resucitaría una asignación que su profe archivó, o le cambiaría el dueño a su
 * propia entrega. Esta puerta crea, o no hace nada.
 */
export async function abrirPractica(
  estudianteId: string,
  recorridoId: string,
): Promise<{ error: string } | { asignacionId: string }> {
  const recorrido = await prisma.recorrido.findUnique({
    where: { id: recorridoId },
    select: { tipo: true, orden: true, publicado: true },
  });
  if (!recorrido || recorrido.tipo !== "PREPARACION_DELE") {
    return { error: "Esa secuencia no es de preparación al DELE." };
  }
  if (!recorrido.publicado) {
    return { error: "Esta secuencia todavía es un borrador." };
  }

  const bloque = bloquePorOrden(recorrido.orden);
  if (!bloque || !bloque.autoservicio) {
    return { error: "Este examen lo abre tu profesor." };
  }

  const yaLaTiene = await prisma.asignacion.findUnique({
    where: { estudianteId_recorridoId: { estudianteId, recorridoId } },
    select: { id: true },
  });
  if (yaLaTiene) return { asignacionId: yaLaTiene.id };

  const profesorId = await profesorDelEstudiante(estudianteId);
  if (!profesorId) {
    return { error: "Habla con tu profe para que te dé un grupo." };
  }

  const nueva = await prisma.asignacion.create({
    data: { estudianteId, recorridoId, profesorId },
    select: { id: true },
  });
  return { asignacionId: nueva.id };
}
