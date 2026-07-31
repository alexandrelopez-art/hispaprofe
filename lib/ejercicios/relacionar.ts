import { z } from "zod";
import {
  barajarEstable,
  comoLista,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

export const parejaSchema = z.object({
  id: z.string(),
  izquierda: z.string(),
  derecha: z.string(),
  /**
   * Lo que hay que escuchar para emparejar esta fila. Opcional.
   *
   * Hace falta porque dos tareas auditivas del DELE no son preguntas sino
   * emparejamientos —relacionar seis hablantes con temas, o seis audios con
   * enunciados—, y en las dos lo que suena está a la izquierda.
   */
  audio: z.string().optional(),
});

export const relacionarSchema = z
  .object({
    ejercicio: z.literal("relacionar"),
    consigna: z.string(),
    /** Pasaje que se pinta encima de las columnas. Para insertar fragmentos. */
    texto: z.string().optional(),
    parejas: z.array(parejaSchema).min(2, { message: "El ejercicio necesita al menos dos parejas." }),
    /**
     * Textos que se mezclan con los de la derecha y no emparejan con nada.
     * Nueve textos para seis enunciados son seis parejas y tres sobrantes.
     */
    sobrantes: z.array(z.string()).default([]),
    /** Cuántas veces se puede oír cada audio. Dos, como en el examen. */
    escuchas: z.number().int().min(1, { message: "Hay que poder oír el audio al menos una vez." }).default(2),
  })
  .refine(
    (d) => new Set(d.parejas.map((p) => p.derecha)).size === d.parejas.length,
    {
      message:
        "Dos parejas no pueden compartir el mismo texto en `derecha`: el estudiante vería dos celdas idénticas y una de las dos filas quedaría mal contada pase lo que pase. Repetir `izquierda` sí está permitido.",
    },
  )
  .refine(
    (d) => {
      const buenas = new Set(d.parejas.map((p) => p.derecha));
      return d.sobrantes.every((s) => !buenas.has(s));
    },
    {
      message:
        "Un sobrante no puede repetir el texto de una respuesta correcta: serían dos celdas idénticas y una de las dos filas quedaría mal contada pase lo que pase.",
    },
  )
  .refine(
    (d) => new Set(d.sobrantes).size === d.sobrantes.length,
    { message: "Dos sobrantes no pueden ser iguales, por el mismo motivo." },
  );

export type Relacionar = z.infer<typeof relacionarSchema>;

export type RelacionarPublica = {
  consigna: string;
  /** Pasaje de arriba, si lo hay. */
  texto?: string;
  izquierdas: { id: string; texto: string; audio?: string }[];
  /** `clave` es opaca a proposito: no dice a que pareja pertenece. */
  derechas: { clave: string; texto: string }[];
  /** Cuántas veces se puede oír cada audio. */
  escuchas: number;
};

/**
 * Reparte una clave opaca a cada elemento de la derecha segun su posicion
 * en la lista barajada. Es una pieza de la seguridad de este tipo, no toda:
 * si la derecha viajara con el id de su pareja, bastaria con mirar el
 * codigo de la pagina para resolver el ejercicio entero. La otra pieza es
 * la propia `semilla`: quien la llama (`lib/ejercicios/registro.ts`) la
 * deriva del id del ejercicio mezclado con `ENCRYPTION_KEY`, un secreto que
 * el navegador nunca recibe.
 *
 * Los sobrantes entran en el mismo barajado y reciben claves de la misma
 * forma: uno que se distinguiera por su clave resolvería el ejercicio a
 * quien mirase el código. Su `parejaId` es null, y por eso `corregir` no
 * necesita saber nada de ellos: nunca coincide con el id de una pareja.
 *
 * El barajado es estable —misma semilla, mismo orden— por dos razones: el
 * servidor tiene que poder rehacerlo para corregir, y un orden distinto en
 * servidor y navegador rompe la hidratacion de React.
 */
function repartirClaves(datos: Relacionar, semilla: string) {
  const todas = [
    ...datos.parejas.map((p) => ({ parejaId: p.id as string | null, texto: p.derecha })),
    ...datos.sobrantes.map((s) => ({ parejaId: null, texto: s })),
  ];
  return barajarEstable(todas, semilla).map((x, i) => ({
    clave: `d${i}`,
    parejaId: x.parejaId,
    texto: x.texto,
  }));
}

export function versionPublicaRelacionar(
  datos: Relacionar,
  semilla: string,
): RelacionarPublica {
  return {
    consigna: datos.consigna,
    texto: datos.texto,
    izquierdas: datos.parejas.map((p) => ({
      id: p.id,
      texto: p.izquierda,
      audio: p.audio,
    })),
    derechas: repartirClaves(datos, semilla).map(({ clave, texto }) => ({
      clave,
      texto,
    })),
    escuchas: datos.escuchas,
  };
}

/**
 * Un punto por pareja. No hay nada que marcar de mas, asi que no resta.
 *
 * Necesita la semilla para rehacer el reparto de claves y saber que pareja
 * hay detras de la clave que eligio el estudiante.
 */
export function corregirRelacionar(
  datos: Relacionar,
  respuestas: Respuestas,
  semilla: string,
): Correccion {
  const porClave = new Map(
    repartirClaves(datos, semilla).map((d) => [d.clave, d.parejaId]),
  );

  const items: ItemCorregido[] = [];
  let aciertos = 0;

  for (const pareja of datos.parejas) {
    const clave = comoLista(respuestas[pareja.id])[0];
    const acertado = clave !== undefined && porClave.get(clave) === pareja.id;
    if (acertado) aciertos++;
    items.push({ id: pareja.id, acertado, correcta: pareja.derecha });
  }

  return { aciertos, total: datos.parejas.length, items };
}
