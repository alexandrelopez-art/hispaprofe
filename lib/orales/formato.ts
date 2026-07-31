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
 * El redondeo final no es cosmético: 0,25 + 0,25 en coma flotante da
 * 0,5000000000000001, y esa cifra acabaría en el CSV que ve el liceo.
 */
export function calcularTotal(notas: Notas | null | undefined): number {
  if (!notas) return 0;
  const suma = CRITERIOS.reduce((t, c) => t + (Number(notas[c.key]) || 0), 0);
  return Math.round(suma * 100) / 100;
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
  const puestas = CRITERIOS.filter((c) => {
    const v = evaluacion.notas?.[c.key];
    return v !== undefined && v !== null;
  }).length;
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
