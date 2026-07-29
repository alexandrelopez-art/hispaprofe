import { createHmac } from "node:crypto";
import type { Correccion, Respuestas } from "@/lib/ejercicios/tipos";
import { corregirOpcion, opcionSchema, versionPublicaOpcion, type Opcion, type OpcionPublica } from "@/lib/ejercicios/opcion";
import { corregirHuecos, huecosSchema, versionPublicaHuecos, type Huecos, type HuecosPublica } from "@/lib/ejercicios/huecos";
import { corregirRelacionar, relacionarSchema, versionPublicaRelacionar, type Relacionar, type RelacionarPublica } from "@/lib/ejercicios/relacionar";
import { corregirOrdenar, ordenarSchema, versionPublicaOrdenar, type Ordenar, type OrdenarPublica } from "@/lib/ejercicios/ordenar";

/**
 * La semilla real del barajado de relacionar y ordenar. NO es el id del
 * ejercicio a secas: ese id viaja al navegador (se manda como prop y se
 * pinta en un input oculto para poder reenviarlo al corregir), así que
 * usarlo tal cual como semilla no protege nada — cualquiera que reproduzca
 * `barajarEstable` con el id que ve en la página recupera el reparto
 * entero. Aquí se mezcla con `ENCRYPTION_KEY`, un secreto que el
 * estudiante nunca recibe, con la misma HMAC que ya usa `lib/crypto.ts`
 * para no dejar la reversión al alcance del cliente.
 *
 * Vive en este módulo y no en `tipos.ts` a propósito: las caras del
 * cliente (`components/ejercicios/*`) importan `tipos.ts` en tiempo de
 * ejecución para usar `comoLista`, así que cualquier cosa que viva ahí
 * puede acabar en el bundle del navegador. `registro.ts` solo lo importa
 * el servidor (la página y la acción), nunca una cara.
 */
function semillaDe(ejercicioId: string): string {
  const clave = process.env.ENCRYPTION_KEY;
  if (!clave) {
    throw new Error(
      "ENCRYPTION_KEY no está definida. Genera una con: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return createHmac("sha256", clave).update(ejercicioId).digest("hex");
}

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
  ejercicioId: string,
): OpcionPublica | HuecosPublica | RelacionarPublica | OrdenarPublica {
  switch (e.tipo) {
    case "opcion":
      return versionPublicaOpcion(e.datos);
    case "huecos":
      return versionPublicaHuecos(e.datos);
    case "relacionar":
      return versionPublicaRelacionar(e.datos, semillaDe(ejercicioId));
    case "ordenar":
      return versionPublicaOrdenar(e.datos, semillaDe(ejercicioId));
  }
}

/**
 * Recibe el id del ejercicio, no la semilla: `semillaDe` la deriva por
 * dentro, igual que hace `versionPublica`, para que las dos lleguen
 * siempre al mismo valor sin que quien llama tenga que acordarse de
 * mezclar el secreto. Relacionar la necesita para rehacer el reparto de
 * claves opacas; ordenar y los demas la ignoran (ordenar puntúa
 * comparando el orden recibido contra el bueno, no contra la baraja), pero
 * se pasa a todos para que la firma sea una sola.
 */
export function corregir(
  e: EjercicioAnalizado,
  respuestas: Respuestas,
  ejercicioId: string,
): Correccion {
  switch (e.tipo) {
    case "opcion":
      return corregirOpcion(e.datos, respuestas);
    case "huecos":
      return corregirHuecos(e.datos, respuestas);
    case "relacionar":
      return corregirRelacionar(e.datos, respuestas, semillaDe(ejercicioId));
    case "ordenar":
      return corregirOrdenar(e.datos, respuestas);
  }
}
