import { prisma } from "@/lib/prisma";
import { analizar } from "@/lib/ejercicios/registro";
import type { Destreza, TipoRecorrido } from "@/lib/generated/prisma/enums";

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

/**
 * Todo lo que un estudiante ya ha escuchado en un paso, por clave.
 *
 * Existe para que la página pueda pintar el estado real al cargar, sin
 * esperar a un primer clic: sin esto, recargar la página después de agotar
 * las dos escuchas volvía a decir "Puedes oírlo 2 veces" hasta que el
 * estudiante volvía a tocar el botón. Una clave nunca escuchada no aparece
 * en el objeto devuelto — quien lo lee hace `mapa[clave] ?? 0`.
 */
export async function escuchasDelPaso(
  asignacionId: string,
  pasoId: string,
): Promise<Record<string, number>> {
  const filas = await prisma.escucha.findMany({
    where: { asignacionId, pasoId },
    select: { clave: true, veces: true },
  });
  return Object.fromEntries(filas.map((f) => [f.clave, f.veces]));
}

/**
 * El paso pertenece a una tarea de examen de verdad: recorrido de
 * preparación y con prueba elegida. Solo entonces se raciona el audio.
 *
 * Compartida entre `maximoDeEscucha` (aquí abajo) y la página del paso, que
 * la usa para decidir si pinta el `Reproductor` o un `<audio>` normal en un
 * bloque `AUDIO`: con la regla en dos sitios, uno se podía quedar desajustado
 * del otro y el bloque se raciona en la página pero no en el tope, o al
 * revés.
 */
export function esRacionado(recorrido: { tipo: TipoRecorrido; destreza: Destreza | null }): boolean {
  return recorrido.tipo === "PREPARACION_DELE" && recorrido.destreza !== null;
}

/**
 * Cuántas veces se puede oír un audio concreto de un paso, resuelto aquí y
 * no aceptado de quien llama.
 *
 * Un `"use server"` exportado es un endpoint público: si `pedirEscucha`
 * aceptara `maximo` como parámetro, cualquiera podría reenviar la petición
 * con `maximo: 99` y conseguir escuchas ilimitadas. En vez de eso, se mira a
 * qué corresponde `clave` dentro de este paso y se calcula el tope real:
 *
 *  - El bloque `AUDIO` de una prueba racionada: siempre 1, porque el
 *    archivo oficial ya trae la repetición dentro (no hay nada que leer,
 *    es un literal).
 *  - Una pregunta o pareja con audio del ejercicio enganchado a este paso:
 *    lo que declare `escuchas` en los datos de ese ejercicio.
 *
 * `null` si `clave` no corresponde a ningún audio contable de este paso —
 * ni acierta el tope, ni permite un `apuntarEscucha` sin sentido.
 */
export async function maximoDeEscucha(pasoId: string, clave: string): Promise<number | null> {
  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorrido: { select: { tipo: true, destreza: true } } },
  });
  if (!paso) return null;

  if (esRacionado(paso.recorrido)) {
    const bloque = await prisma.bloque.findFirst({
      where: { id: clave, pasoId, tipo: "AUDIO" },
      select: { id: true },
    });
    if (bloque) return 1;
  }

  // El ejercicio autocorregible enganchado a este paso, si lo hay: mismo
  // criterio de "el primero" que usa la página para decidir cuál mostrar.
  const vinculo = await prisma.pasoEjercicio.findFirst({
    where: { pasoId },
    orderBy: { orden: "asc" },
    select: { ejercicio: { select: { datos: true } } },
  });
  if (!vinculo) return null;

  const analizado = analizar(vinculo.ejercicio.datos);
  if (!analizado) return null;

  if (analizado.tipo === "opcion") {
    const pregunta = analizado.datos.preguntas.find((p) => p.id === clave);
    return pregunta?.audio ? analizado.datos.escuchas : null;
  }
  if (analizado.tipo === "relacionar") {
    const pareja = analizado.datos.parejas.find((p) => p.id === clave);
    return pareja?.audio ? analizado.datos.escuchas : null;
  }

  return null;
}
