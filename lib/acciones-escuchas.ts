"use server";

import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { apuntarEscucha, maximoDeEscucha } from "@/lib/escuchas";

/**
 * Apunta una escucha y dice cuántas quedan.
 *
 * La decisión —si queda alguna— vive en `lib/escuchas.ts` y no aquí, para
 * que el script de verificación pueda ejercitarla. Esto solo comprueba la
 * sesión, encuentra la asignación y llama.
 *
 * No recibe `maximo` como parámetro: un `"use server"` exportado es un
 * endpoint público, y si el tope viajara desde quien llama, reenviar la
 * petición con `maximo: 99` conseguiría escuchas ilimitadas. El tope se
 * resuelve aquí dentro, en el servidor, mirando a qué corresponde `clave`
 * (`maximoDeEscucha`, en `lib/escuchas.ts`).
 *
 * `agotado: true` solo viaja cuando de verdad no quedaba ninguna escucha:
 * es lo que distingue, en el reproductor, "se acabaron tus escuchas"
 * (irreversible) de "algo ha ido mal" (sesión caída, paso inexistente...),
 * que sí se puede reintentar.
 */
export async function pedirEscucha(
  pasoId: string,
  clave: string,
): Promise<{ quedan: number } | { error: string; agotado?: boolean }> {
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

  const maximo = await maximoDeEscucha(pasoId, clave);
  if (maximo === null) return { error: "Ese audio no existe en este paso." };

  const quedan = await apuntarEscucha(asignacion.id, pasoId, clave, maximo);
  if (quedan === null) return { error: "Ya has oído este audio todas las veces.", agotado: true };

  return { quedan };
}
