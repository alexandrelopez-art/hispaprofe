"use client";

import type { OrdenarPublica } from "@/lib/ejercicios/ordenar";
import type { Progreso, PropsCara } from "./ejercicio";

// El dibujo se rellena en la Tarea 7.
export default function CaraOrdenar({}: PropsCara) {
  return null;
}

/**
 * Las piezas siempre están en algún orden — barajadas de entrada, si el
 * estudiante no toca nada — así que este tipo nunca bloquea el envío. No
 * necesita `valor` para decidirlo, a diferencia de los demás tipos.
 */
export function progresoOrdenar(publica: unknown): Progreso {
  const datos = publica as OrdenarPublica;
  return { total: datos.piezas.length, contestadas: datos.piezas.length };
}
