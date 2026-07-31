"use server";

import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { apuntarEscucha } from "@/lib/escuchas";

/**
 * Apunta una escucha y dice cuántas quedan.
 *
 * La decisión —si queda alguna— vive en `lib/escuchas.ts` y no aquí, para
 * que el script de verificación pueda ejercitarla. Esto solo comprueba la
 * sesión, encuentra la asignación y llama.
 */
export async function pedirEscucha(
  pasoId: string,
  clave: string,
  maximo: number,
): Promise<{ quedan: number } | { error: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "No hay sesión." };

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return { error: "Ese paso no existe." };

  const asignacion = await prisma.asignacion.findUnique({
    where: {
      estudianteId_recorridoId: {
        estudianteId: usuario.id,
        recorridoId: paso.recorridoId,
      },
    },
    select: { id: true, archivada: true },
  });
  if (!asignacion || asignacion.archivada) return { error: "No tienes este recorrido asignado." };

  const quedan = await apuntarEscucha(asignacion.id, pasoId, clave, maximo);
  if (quedan === null) return { error: "Ya has oído este audio todas las veces." };

  return { quedan };
}
