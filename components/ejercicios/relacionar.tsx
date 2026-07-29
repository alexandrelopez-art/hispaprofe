"use client";

import type { RelacionarPublica } from "@/lib/ejercicios/relacionar";
import { comoLista, type Respuestas } from "@/lib/ejercicios/tipos";
import type { Progreso, PropsCara } from "./ejercicio";

// El dibujo se rellena en la Tarea 7.
export default function CaraRelacionar({}: PropsCara) {
  return null;
}

/** Contestada = la izquierda tiene una derecha asignada. */
export function progresoRelacionar(publica: unknown, valor: Respuestas): Progreso {
  const datos = publica as RelacionarPublica;
  const total = datos.izquierdas.length;
  const contestadas = datos.izquierdas.filter(
    (i) => comoLista(valor[i.id]).length > 0,
  ).length;
  return { total, contestadas };
}
