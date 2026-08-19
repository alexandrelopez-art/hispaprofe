import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
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
