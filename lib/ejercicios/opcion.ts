import { z } from "zod";
import {
  comoLista,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

// Opcion unica y opcion multiple son el mismo ejercicio con distinto
// control: boton redondo o casilla. Lo decide `multiple`.

export const preguntaOpcionSchema = z.object({
  id: z.string(),
  enunciado: z.string(),
  /** Sus propias opciones. Se omite cuando el ejercicio usa lista comun. */
  opciones: z.array(z.string()).min(2).optional(),
  /** Indices de las opciones buenas. Una sola cuando `multiple` es false. */
  correctas: z.array(z.number().int().min(0)).min(1),
  /** Audio que hay que escuchar para responder. Opcional. */
  audio: z.string().optional(),
});

export const opcionSchema = z
  .object({
    ejercicio: z.literal("opcion"),
    consigna: z.string(),
    multiple: z.boolean(),
    /**
     * Opciones iguales para todas las preguntas: una lista de nombres, por
     * ejemplo. La misma opcion puede valer en varias preguntas, que es lo
     * que distingue este formato de `relacionar`.
     */
    opcionesComunes: z.array(z.string()).min(2).optional(),
    /** Con muchas preguntas y lista comun, once filas de botones son un muro. */
    presentacion: z.enum(["botones", "desplegable"]).default("botones"),
    preguntas: z.array(preguntaOpcionSchema).min(1),
  })
  .refine(
    (d) => d.opcionesComunes !== undefined || d.preguntas.every((p) => p.opciones),
    { message: "Cada pregunta necesita opciones propias, o el ejercicio una lista común." },
  )
  .refine(
    (d) =>
      d.preguntas.every((p) =>
        p.correctas.every((i) => i < (p.opciones ?? d.opcionesComunes ?? []).length),
      ),
    { message: "Alguna respuesta correcta apunta a una opción que no existe." },
  );

export type PreguntaOpcion = z.infer<typeof preguntaOpcionSchema>;
export type Opcion = z.infer<typeof opcionSchema>;

/** Las opciones que le tocan a una pregunta: las suyas, o las comunes. */
export function opcionesDe(datos: Opcion, pregunta: PreguntaOpcion): string[] {
  return pregunta.opciones ?? datos.opcionesComunes ?? [];
}

export type OpcionPublica = {
  consigna: string;
  multiple: boolean;
  presentacion: "botones" | "desplegable";
  preguntas: { id: string; enunciado: string; opciones: string[]; audio?: string }[];
};

export function versionPublicaOpcion(datos: Opcion): OpcionPublica {
  return {
    consigna: datos.consigna,
    multiple: datos.multiple,
    presentacion: datos.presentacion,
    // Cada pregunta sale con su lista ya resuelta: al navegador le da igual
    // si venia de la pregunta o de la lista comun.
    preguntas: datos.preguntas.map((p) => ({
      id: p.id,
      enunciado: p.enunciado,
      opciones: opcionesDe(datos, p),
      audio: p.audio,
    })),
  };
}

/**
 * Un punto por opcion buena marcada. En multiple, cada mala marcada resta
 * uno, sin bajar de cero en esa pregunta: si no, marcarlo todo daria el
 * maximo sin saber nada.
 */
export function corregirOpcion(datos: Opcion, respuestas: Respuestas): Correccion {
  const items: ItemCorregido[] = [];
  let aciertos = 0;
  let total = 0;

  for (const pregunta of datos.preguntas) {
    const opciones = opcionesDe(datos, pregunta);
    const buenas = new Set(pregunta.correctas);
    // Sin deduplicar, marcar la misma opcion varias veces sumaria de mas:
    // "0, 0" no vale el doble que "0" ni tapa que "1" se quedo sin marcar.
    const marcadas = [
      ...new Set(
        comoLista(respuestas[pregunta.id])
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n)),
      ),
    ];

    const bien = marcadas.filter((i) => buenas.has(i)).length;
    const mal = marcadas.filter((i) => !buenas.has(i)).length;
    // Clamp en las dos ramas, no solo en multiple: una pregunta nunca vale
    // mas que su numero de respuestas correctas, sea cual sea el control.
    const puntos = Math.min(buenas.size, datos.multiple ? Math.max(0, bien - mal) : bien);

    aciertos += puntos;
    total += buenas.size;

    items.push({
      id: pregunta.id,
      acertado: puntos === buenas.size && mal === 0,
      correcta: pregunta.correctas.map((i) => opciones[i]).join(", "),
    });
  }

  return { aciertos, total, items };
}
