import { prisma } from "@/lib/prisma";

// Solo de servidor: habla con la base. Vive fuera de las acciones para que
// el script de verificación pueda ejercitarlo.

/** Cuántas veces ha oído ya este estudiante este audio. */
export async function escuchasDe(
  asignacionId: string,
  pasoId: string,
  clave: string,
): Promise<number> {
  const fila = await prisma.escucha.findUnique({
    where: { asignacionId_pasoId_clave: { asignacionId, pasoId, clave } },
    select: { veces: true },
  });
  return fila?.veces ?? 0;
}

/**
 * Apunta una escucha y devuelve cuántas quedan, o `null` si ya no quedaba
 * ninguna. Quien llama distingue así "esta era la última" de "no suena".
 *
 * El tope va **dentro** de la escritura y no en un `if` previo, igual que
 * hace `desbloquear` en `lib/admin.ts`: entre comprobar y escribir cabe otra
 * pestaña del mismo estudiante, y dos pestañas se regalarían una escucha
 * cada una.
 */
export async function apuntarEscucha(
  asignacionId: string,
  pasoId: string,
  clave: string,
  maximo: number,
): Promise<number | null> {
  // Asegura que la fila existe sin contar nada: `update: {}` es idempotente
  // y no incrementa. Hace falta porque el paso siguiente es un `updateMany`
  // con condición, y un `updateMany` no crea filas.
  await prisma.escucha.upsert({
    where: { asignacionId_pasoId_clave: { asignacionId, pasoId, clave } },
    update: {},
    create: { asignacionId, pasoId, clave, veces: 0 },
  });

  const { count } = await prisma.escucha.updateMany({
    where: { asignacionId, pasoId, clave, veces: { lt: maximo } },
    data: { veces: { increment: 1 } },
  });
  if (count === 0) return null;

  return maximo - (await escuchasDe(asignacionId, pasoId, clave));
}
