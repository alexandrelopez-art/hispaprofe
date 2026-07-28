import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Estado de un paso desde el punto de vista del estudiante. El check lo
 * pone él (ENTREGADO); los puntos solo el profesor (REVISADO). Un paso
 * sin fila de PasoCompletado está PENDIENTE.
 */
export type EstadoPaso = "PENDIENTE" | "ENTREGADO" | "REVISADO";

export type PasoEnBandeja = {
  pasoId: string;
  pasoTitulo: string;
  recorridoId: string;
  recorridoTitulo: string;
  /** Fecha de revisión si la hay; si no, la de entrega. */
  fecha: Date;
  puntos: number | null;
};

export type ResumenEstudiante = {
  puntosTotales: number;
  pasosRevisados: number;
  esperandoRevision: PasoEnBandeja[];
  revisadosRecientes: PasoEnBandeja[];
};

const REVISADOS_RECIENTES = 5;

// `satisfies` y no una anotación de tipo: valida la forma sin ensanchar
// los literales, que es lo que Prisma necesita para inferir el resultado.
const seleccionBandeja = {
  pasoId: true,
  completadoEl: true,
  verificadoEl: true,
  puntos: true,
  paso: {
    select: {
      titulo: true,
      recorridoId: true,
      recorrido: { select: { titulo: true } },
    },
  },
} satisfies Prisma.PasoCompletadoSelect;

type FilaBandeja = {
  pasoId: string;
  completadoEl: Date;
  verificadoEl: Date | null;
  puntos: number | null;
  paso: {
    titulo: string;
    recorridoId: string;
    recorrido: { titulo: string };
  };
};

function aBandeja(fila: FilaBandeja): PasoEnBandeja {
  return {
    pasoId: fila.pasoId,
    pasoTitulo: fila.paso.titulo,
    recorridoId: fila.paso.recorridoId,
    recorridoTitulo: fila.paso.recorrido.titulo,
    fecha: fila.verificadoEl ?? fila.completadoEl,
    puntos: fila.puntos,
  };
}

/**
 * Todo lo que el panel del estudiante necesita saber de su esfuerzo.
 *
 * La hucha cuenta también las asignaciones archivadas: es el historial de
 * la persona, y archivar una secuencia no debe vaciarle el marcador. Las
 * dos bandejas, en cambio, solo miran asignaciones vivas: son trabajo de
 * ahora, no memoria.
 */
export async function resumenEstudiante(
  usuarioId: string,
): Promise<ResumenEstudiante> {
  const [totales, esperando, revisados] = await Promise.all([
    prisma.pasoCompletado.aggregate({
      where: {
        asignacion: { estudianteId: usuarioId },
        verificadoEl: { not: null },
      },
      _sum: { puntos: true },
      _count: { _all: true },
    }),
    prisma.pasoCompletado.findMany({
      where: {
        asignacion: { estudianteId: usuarioId, archivada: false },
        verificadoEl: null,
      },
      orderBy: { completadoEl: "desc" },
      select: seleccionBandeja,
    }),
    prisma.pasoCompletado.findMany({
      where: {
        asignacion: { estudianteId: usuarioId, archivada: false },
        verificadoEl: { not: null },
      },
      orderBy: { verificadoEl: "desc" },
      take: REVISADOS_RECIENTES,
      select: seleccionBandeja,
    }),
  ]);

  return {
    puntosTotales: totales._sum.puntos ?? 0,
    pasosRevisados: totales._count._all,
    esperandoRevision: esperando.map(aBandeja),
    revisadosRecientes: revisados.map(aBandeja),
  };
}

/**
 * Estado de cada paso de una asignación, indexado por pasoId. Los pasos
 * que no aparecen en el mapa están PENDIENTE.
 */
export async function estadoDePasos(
  asignacionId: string,
): Promise<Map<string, { estado: EstadoPaso; puntos: number | null }>> {
  const filas = await prisma.pasoCompletado.findMany({
    where: { asignacionId },
    select: { pasoId: true, verificadoEl: true, puntos: true },
  });

  return new Map(
    filas.map((fila) => [
      fila.pasoId,
      {
        estado: (fila.verificadoEl ? "REVISADO" : "ENTREGADO") as EstadoPaso,
        puntos: fila.puntos,
      },
    ]),
  );
}

/**
 * Quita el check de un paso, salvo que el profesor ya lo haya revisado.
 * La fila de PasoCompletado guarda los puntos y la fecha de verificación,
 * así que borrarla tras una corrección perdería el trabajo del profesor.
 * El filtro va dentro del propio delete para que no haya carrera entre
 * comprobar y borrar.
 *
 * Devuelve true si borró algo.
 */
export async function desmarcarSiNoRevisado(
  asignacionId: string,
  pasoId: string,
): Promise<boolean> {
  const { count } = await prisma.pasoCompletado.deleteMany({
    where: { asignacionId, pasoId, verificadoEl: null },
  });
  return count > 0;
}
