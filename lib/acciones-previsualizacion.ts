"use server";

import { exigirProfesor } from "@/lib/profesor";
import { analizar, corregir, versionPublica } from "@/lib/ejercicios/registro";
import type { Correccion, MarcaEjercicio, Respuestas } from "@/lib/ejercicios/tipos";

/**
 * La semilla del barajado de `relacionar` y `ordenar`.
 *
 * `semillaDe` mezcla el id del ejercicio con ENCRYPTION_KEY para que un
 * estudiante no pueda rehacer el reparto desde el payload que recibe. Un
 * borrador todavía no tiene id, así que aquí va una constante: no se pierde
 * nada, porque quien mira es quien acaba de escribir las soluciones.
 */
const SEMILLA = "previsualizacion";

export type ResultadoPrevisualizacion =
  | { publica: unknown; tipo: MarcaEjercicio; correccion: Correccion }
  | { error: string };

/**
 * Corrige un ejercicio sin guardarlo. Las tres funciones que usa son puras
 * y no tocan la base: no hace falta Asignacion, ni PasoCompletado, ni que el
 * ejercicio exista todavía.
 */
export async function previsualizar(
  datosJson: string,
  respuestas: Respuestas,
): Promise<ResultadoPrevisualizacion> {
  await exigirProfesor();

  let datos: unknown;
  try {
    datos = JSON.parse(datosJson);
  } catch {
    return { error: "El contenido del ejercicio no se pudo leer." };
  }

  const analizado = analizar(datos);
  if (!analizado) {
    return { error: "El ejercicio todavía no está completo." };
  }

  return {
    publica: versionPublica(analizado, SEMILLA),
    tipo: analizado.tipo,
    correccion: corregir(analizado, respuestas, SEMILLA),
  };
}

/** Igual, pero solo la versión pública: para pintar antes de responder. */
export async function versionParaPrevisualizar(
  datosJson: string,
): Promise<{ publica: unknown; tipo: MarcaEjercicio } | { error: string }> {
  await exigirProfesor();

  let datos: unknown;
  try {
    datos = JSON.parse(datosJson);
  } catch {
    return { error: "El contenido del ejercicio no se pudo leer." };
  }

  const analizado = analizar(datos);
  if (!analizado) return { error: "El ejercicio todavía no está completo." };

  return { publica: versionPublica(analizado, SEMILLA), tipo: analizado.tipo };
}
