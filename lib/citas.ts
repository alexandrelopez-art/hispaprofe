import { prisma } from "@/lib/prisma";
import { esGrabada, expresionDelPaso } from "@/lib/expresion";

// Solo de servidor. Fuera de las acciones, para que el script las ejercite.
// `lib/expresion.ts` también es de servidor, así que importarlo aquí no
// cruza ninguna frontera.

/**
 * Si el oral se puede citar en esta clase, o el motivo del no.
 *
 * Cuatro negativas: que no sea una tarea grabada —esa no se agenda—, que la
 * clase sea de ese alumno —suya directamente, o de un grupo al que
 * pertenezca—, que sea de este profesor, que no esté anulada, y que no haya
 * pasado ya. `claseId` llega tal cual del formulario, sin pasar por
 * `clasesParaCitar`, así que aquí se revalidan las mismas cosas que esa
 * función usó para decidir qué ofrecer: un tope que decide no puede confiar
 * en lo que mandó el cliente.
 *
 * `profesorId` en `null` significa «sin filtrar por profesor»: es lo que manda
 * un administrador, que ve las clases de todos igual que en las páginas de
 * `profe/`.
 */
export async function puedeCitarse(
  asignacionId: string,
  pasoId: string,
  claseId: string,
  profesorId: string | null,
): Promise<string | null> {
  // Una grabada no se agenda: se entrega cuando el alumno quiera.
  const tarea = await expresionDelPaso(pasoId);
  if (tarea && esGrabada(tarea)) {
    return "Esa tarea se entrega grabada: no hay nada que citar.";
  }

  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return "Esa asignación no existe.";

  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      estado: true,
      estudianteId: true,
      grupoId: true,
      empiezaEl: true,
      profesorId: true,
    },
  });
  if (!clase) return "Esa clase no existe.";
  // Un alumno puede dar clase con varios profesores: que la clase sea suya no
  // basta para que este profesor pueda citarle un oral dentro.
  if (profesorId !== null && clase.profesorId !== profesorId) {
    return "Esa clase no es tuya.";
  }
  if (clase.estado === "ANULADA") return "Esa clase está anulada.";
  if (clase.empiezaEl < new Date()) return "Esa clase ya pasó.";

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
 *
 * `profesorId` en `null` significa «sin filtrar por profesor», que es lo que
 * manda un administrador. Un profesor pasa el suyo: un alumno puede dar clase
 * con más de uno, y las de los demás no son suyas ni para ofrecerlas —el
 * `donde` de esas clases tampoco tendría por qué leerlo—.
 */
export async function clasesParaCitar(asignacionId: string, profesorId: string | null) {
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
      ...(profesorId !== null ? { profesorId } : {}),
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
