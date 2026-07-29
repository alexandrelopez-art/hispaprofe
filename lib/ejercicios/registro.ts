import type { Correccion, Respuestas } from "@/lib/ejercicios/tipos";
import { corregirOpcion, opcionSchema, versionPublicaOpcion, type Opcion, type OpcionPublica } from "@/lib/ejercicios/opcion";
import { corregirHuecos, huecosSchema, versionPublicaHuecos, type Huecos, type HuecosPublica } from "@/lib/ejercicios/huecos";
import { corregirRelacionar, relacionarSchema, versionPublicaRelacionar, type Relacionar, type RelacionarPublica } from "@/lib/ejercicios/relacionar";
import { corregirOrdenar, ordenarSchema, versionPublicaOrdenar, type Ordenar, type OrdenarPublica } from "@/lib/ejercicios/ordenar";

/**
 * El unico sitio que sabe cuantos tipos hay. Anadir un sexto es anadir un
 * caso aqui y su modulo, sin tocar la accion ni la pagina.
 */
export type EjercicioAnalizado =
  | { tipo: "opcion"; datos: Opcion }
  | { tipo: "huecos"; datos: Huecos }
  | { tipo: "relacionar"; datos: Relacionar }
  | { tipo: "ordenar"; datos: Ordenar };

export function analizar(datos: unknown): EjercicioAnalizado | null {
  if (typeof datos !== "object" || datos === null) return null;
  const marca = (datos as { ejercicio?: unknown }).ejercicio;

  if (marca === "opcion") {
    const r = opcionSchema.safeParse(datos);
    return r.success ? { tipo: "opcion", datos: r.data } : null;
  }
  if (marca === "huecos") {
    const r = huecosSchema.safeParse(datos);
    return r.success ? { tipo: "huecos", datos: r.data } : null;
  }
  if (marca === "relacionar") {
    const r = relacionarSchema.safeParse(datos);
    return r.success ? { tipo: "relacionar", datos: r.data } : null;
  }
  if (marca === "ordenar") {
    const r = ordenarSchema.safeParse(datos);
    return r.success ? { tipo: "ordenar", datos: r.data } : null;
  }
  return null;
}

/**
 * Lo que puede ver el estudiante mientras el ejercicio esta abierto.
 *
 * El tipo de retorno se escribe a mano en vez de dejarlo inferir: si se
 * infiriera, un quinto tipo sin su `case` compilaria en silencio y
 * devolveria `undefined` en tiempo de ejecucion. Escrito asi, falta un
 * `return` y `tsc` lo detecta, igual que ya hace `corregir` con `Correccion`.
 */
export function versionPublica(
  e: EjercicioAnalizado,
  semilla: string,
): OpcionPublica | HuecosPublica | RelacionarPublica | OrdenarPublica {
  switch (e.tipo) {
    case "opcion":
      return versionPublicaOpcion(e.datos);
    case "huecos":
      return versionPublicaHuecos(e.datos);
    case "relacionar":
      return versionPublicaRelacionar(e.datos, semilla);
    case "ordenar":
      return versionPublicaOrdenar(e.datos, semilla);
  }
}

/**
 * La semilla es siempre el id del ejercicio. Relacionar la necesita para
 * rehacer el reparto de claves opacas que hizo `versionPublica`; los demas
 * la ignoran, pero se pasa a todos para que la firma sea una sola.
 */
export function corregir(
  e: EjercicioAnalizado,
  respuestas: Respuestas,
  semilla: string,
): Correccion {
  switch (e.tipo) {
    case "opcion":
      return corregirOpcion(e.datos, respuestas);
    case "huecos":
      return corregirHuecos(e.datos, respuestas);
    case "relacionar":
      return corregirRelacionar(e.datos, respuestas, semilla);
    case "ordenar":
      return corregirOrdenar(e.datos, respuestas);
  }
}
