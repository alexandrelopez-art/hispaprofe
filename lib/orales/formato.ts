import { CRITERIOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";

/** Lo que hay dentro de `EvaluacionOral.notas`. Faltar no es valer cero. */
export type Notas = Partial<Record<ClaveCriterio, number>>;

/**
 * MM:SS. Trunca hacia abajo: el cronómetro guarda decimales porque para
 * donde para, pero 04:47,9 se lee 04:47, que es lo que marcaba el reloj.
 */
export function fmtTiempo(segundos: number): string {
  const enteros = Math.max(0, Math.floor(segundos));
  const m = Math.floor(enteros / 60);
  const s = enteros % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * La nota de un criterio, sin ceros de adorno: 3 y no 3,00. Coma decimal,
 * que es lo que espera quien lee la ficha en castellano o en francés.
 */
export function fmtNota(valor: number): string {
  return String(Math.round(valor * 100) / 100).replace(".", ",");
}

/** El total siempre con un decimal: 15,0 y no 15. */
export function fmtTotal(valor: number): string {
  return valor.toFixed(1).replace(".", ",");
}

/**
 * El paso del `+`/`−`. La fluidez va sobre 2, y con medios puntos solo
 * tendría cinco valores posibles, así que se mueve de cuarto en cuarto.
 */
export function pasoDe(maximo: number): number {
  return maximo <= 2 ? 0.25 : 0.5;
}

/**
 * La suma de lo que haya. Lo que falta no resta.
 *
 * El redondeo final no es por la coma flotante: los pasos de esta parrilla
 * son 0,25 y 0,5, potencias de dos, y se suman exactos. Está para lo que
 * entra de fuera con más decimales, que si no acabaría tal cual en el CSV
 * que ve el liceo.
 */
export function calcularTotal(notas: Notas | null | undefined): number {
  if (!notas) return 0;
  const suma = CRITERIOS.reduce((t, c) => t + (Number(notas[c.key]) || 0), 0);
  return Math.round(suma * 100) / 100;
}

/**
 * La nota de un criterio si está puesta, o `null` si falta. Comparar contra
 * `undefined` y `null` y no por veracidad: `if (nota)` daría «falta» ante un
 * cero puesto de verdad.
 *
 * Antes de esto había cuatro maneras de hacer la misma pregunta —¿hay nota
 * aquí?— repartidas entre `estadoDe`, la ficha impresa y el CSV, y una
 * comparaba solo contra `undefined`. Esta es la única que hace falta:
 * `estadoDe`, `lib/orales/csv.ts` y la ficha la usan las tres.
 */
export function notaDe(notas: Notas, key: ClaveCriterio): number | null {
  const valor = notas[key];
  return valor === undefined || valor === null ? null : valor;
}

/**
 * Si hay al menos una nota puesta, aunque sea un cero. La misma distinción
 * que `notaDe`, pero para la parrilla entera.
 *
 * Vive aquí y no en `csv.ts` porque la ficha impresa necesita la misma
 * regla: sin ella, una evaluación recién creada (con el `sujetoId` ya
 * guardado por el autoguardado pero ninguna nota puesta) enseñaría un
 * «0,0 / 20» como si fuera la nota final del alumno.
 */
export function hayNotaPuesta(notas: Notas): boolean {
  return CRITERIOS.some((c) => notaDe(notas, c.key) !== null);
}

/** El semáforo del horario. */
export type EstadoTurno = "vacio" | "medias" | "hecho";

/**
 * Verde solo cuando están las cinco notas **y** el sujet elegido: una nota
 * sin saber de qué documento se examinó no es una evaluación terminada.
 *
 * Un cero cuenta como nota puesta. Por eso se compara contra null y
 * undefined y no por veracidad: `if (nota)` daría «falta» en un cero.
 */
export function estadoDe(
  evaluacion: { sujetoId: string | null; notas: Notas | null } | null,
): EstadoTurno {
  if (!evaluacion) return "vacio";
  const notas = evaluacion.notas ?? {};
  const puestas = CRITERIOS.filter((c) => notaDe(notas, c.key) !== null).length;
  if (puestas === CRITERIOS.length && evaluacion.sujetoId) return "hecho";
  if (puestas > 0 || evaluacion.sujetoId) return "medias";
  return "vacio";
}

/**
 * La hora que `pegarHorario` guarda en las pausas. No es una hora real: es
 * la marca de que el hueco no tiene a nadie citado, ni lo tendrá.
 */
export const HORA_PAUSA = "—";

/**
 * Una pausa y un turno cuyo estudiante no se emparejó llegan los dos con
 * `estudianteId: null`; solo la hora los distingue. Vive aquí, no en
 * `pegarHorario` ni en `horario.tsx`, para que los dos usen la misma regla
 * y el script de verificación pueda comprobarla contra filas reales.
 */
export function esPausa(turno: { estudianteId: string | null; hora: string }): boolean {
  return turno.estudianteId === null && turno.hora === HORA_PAUSA;
}
