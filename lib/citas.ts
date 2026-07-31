import { prisma } from "@/lib/prisma";

// Solo de servidor. Fuera de las acciones, para que el script las ejercite.

/**
 * Si el oral se puede citar en esta clase, o el motivo del no.
 *
 * Dos negativas: la clase tiene que ser de ese alumno —suya directamente, o
 * de un grupo al que pertenezca— y no puede estar anulada. Citar un oral en
 * la clase de otro, o en una que se cayó, es un error que no debe llegar a
 * la base.
 */
export async function puedeCitarse(
  asignacionId: string,
  claseId: string,
): Promise<string | null> {
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return "Esa asignación no existe.";

  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: { estado: true, estudianteId: true, grupoId: true },
  });
  if (!clase) return "Esa clase no existe.";
  if (clase.estado === "ANULADA") return "Esa clase está anulada.";

  if (clase.estudianteId === asignacion.estudianteId) return null;

  // La clase puede ser de un grupo del que el alumno es miembro.
  if (clase.grupoId) {
    const miembro = await prisma.miembroGrupo.findUnique({
      where: {
        grupoId_estudianteId: {
          grupoId: clase.grupoId,
          estudianteId: asignacion.estudianteId,
        },
      },
      select: { id: true },
    });
    if (miembro) return null;
  }

  return "Esa clase no es de este estudiante.";
}

/**
 * Las clases en las que se puede citar un oral de este alumno: las suyas y
 * las de sus grupos, sin anular y de aquí en adelante.
 *
 * De aquí en adelante porque citar un oral en una clase que ya pasó no
 * significa nada: si se dio, se evaluó o no se evaluó, pero no se agenda.
 */
export async function clasesParaCitar(asignacionId: string) {
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return [];

  const grupos = await prisma.miembroGrupo.findMany({
    where: { estudianteId: asignacion.estudianteId },
    select: { grupoId: true },
  });

  return prisma.clase.findMany({
    where: {
      estado: { not: "ANULADA" },
      empiezaEl: { gte: new Date() },
      OR: [
        { estudianteId: asignacion.estudianteId },
        ...(grupos.length ? [{ grupoId: { in: grupos.map((g) => g.grupoId) } }] : []),
      ],
    },
    orderBy: { empiezaEl: "asc" },
    select: { id: true, empiezaEl: true, minutos: true, donde: true },
  });
}
