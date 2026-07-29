"use client";

import type { RelacionarPublica } from "@/lib/ejercicios/relacionar";
import { comoLista, type Respuestas } from "@/lib/ejercicios/tipos";
import type { Progreso, PropsCara } from "./ejercicio";

// El dibujo se rellena en la Tarea 7.
export default function CaraRelacionar({}: PropsCara) {
  return null;
}

/**
 * Contestada = la izquierda tiene una derecha asignada.
 *
 * Filtra cadenas vacías, no solo cuenta longitud: si la Tarea 7 dibuja esto
 * con un `<select>` con placeholder "?" (como ya hace la cara de opción),
 * volver a "" al reconsiderar deja un valor presente pero en blanco, y
 * `comoLista` lo envuelve igual que cualquier otro string.
 */
export function progresoRelacionar(publica: unknown, valor: Respuestas): Progreso {
  const datos = publica as RelacionarPublica;
  const total = datos.izquierdas.length;
  const contestadas = datos.izquierdas.filter((i) =>
    comoLista(valor[i.id]).some((v) => v !== ""),
  ).length;
  return { total, contestadas };
}
