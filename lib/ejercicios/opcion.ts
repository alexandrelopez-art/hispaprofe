import { z } from "zod";
import {
  comoLista,
  marcasCuadran,
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
  opciones: z.array(z.string()).min(2, { message: "Necesita al menos dos opciones." }).optional(),
  /** Indices de las opciones buenas. Una sola cuando `multiple` es false. */
  correctas: z
    .array(z.number().int().min(0, { message: "El índice de una opción no puede ser negativo." }))
    .min(1, { message: "Marca al menos una respuesta correcta." }),
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
    opcionesComunes: z
      .array(z.string())
      .min(2, { message: "La lista común necesita al menos dos opciones." })
      .optional(),
    /**
     * Cómo se pintan las opciones. Con muchas preguntas, una fila de botones
     * por cada una es un muro: catorce huecos de tres opciones son catorce
     * filas. No depende de que haya lista común — `CLOZE` no la usa y es el
     * formato que más lo necesita.
     */
    presentacion: z.enum(["botones", "desplegable"]).default("botones"),
    /**
     * Pasaje con marcas {{id}} donde va cada hueco. Con él, el desplegable se
     * pinta dentro del texto y no en una lista debajo.
     *
     * Es lo que distingue un cloze de una batería de preguntas: en el cloze
     * la pregunta *es* el hueco, y sacarla del texto la deja sin contexto.
     *
     * Con `texto`, el control es siempre el desplegable y `presentacion` no
     * se mira: una fila de botones incrustada en mitad de un párrafo no es
     * algo que nadie vaya a querer. No se rechaza la combinación, se ignora
     * — el resultado de ignorarla es justo el que se buscaba.
     */
    texto: z.string().optional(),
    /** Cuántas veces se puede oír cada audio. Dos, como en el examen. */
    escuchas: z
      .number()
      .int({ message: "El número de escuchas tiene que ser un número entero." })
      .min(1, { message: "Hay que poder oír el audio al menos una vez." })
      .default(2),
    preguntas: z
      .array(preguntaOpcionSchema)
      .min(1, { message: "El ejercicio necesita al menos una pregunta." }),
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
  )
  .refine(
    (d) => d.texto === undefined || marcasCuadran(d.texto, d.preguntas.map((p) => p.id)),
    {
      // Solo cuando hay pasaje: sin él no hay marcas que cuadrar. El porqué
      // largo está en `marcasCuadran`.
      message:
        "Las marcas {{...}} del pasaje no coinciden con los ids de las preguntas.",
    },
  )
  .refine(
    (d) => d.texto === undefined || d.preguntas.every((p) => p.audio === undefined),
    {
      // La cara del cloze pinta un desplegable, no un reproductor: con
      // pasaje, un audio ahí no se puede oír y la pregunta queda sin forma
      // de contestarse.
      message: "Con pasaje, ninguna pregunta puede llevar audio: el cloze no pinta reproductor.",
    },
  )
  .refine((d) => d.texto === undefined || !d.multiple, {
    // El desplegable del cloze solo deja elegir una opción: con `multiple`,
    // una pregunta con dos respuestas correctas no se podría acertar nunca.
    message: "Con pasaje, el ejercicio no puede ser de opción múltiple: el desplegable solo elige una.",
  });

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
  escuchas: number;
  /** El pasaje, si lo hay. Sin él la cara no puede pintar el cloze. */
  texto?: string;
  preguntas: { id: string; enunciado: string; opciones: string[]; audio?: string }[];
};

export function versionPublicaOpcion(datos: Opcion): OpcionPublica {
  return {
    consigna: datos.consigna,
    multiple: datos.multiple,
    presentacion: datos.presentacion,
    escuchas: datos.escuchas,
    texto: datos.texto,
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
 *
 * Fuera de multiple no existe el exceso (ver diseño): con boton redondo el
 * navegador nunca deja marcar mas de una opcion, pero `responderEjercicio`
 * acepta cualquier `string[]` para cualquier clave, asi que un envio
 * fabricado a mano si puede. Sin este freno, marcar todas las opciones de
 * una pregunta de opcion unica garantiza que la buena este entre las
 * marcadas y puntua el maximo sin haber acertado nada.
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
    // Fuera de multiple, marcar mas de una opcion puntua 0 en esa pregunta:
    // no hay "la correcta entre las marcadas", porque el control real es un
    // boton redondo que solo deja elegir una.
    const puntosUnica = marcadas.length > 1 ? 0 : bien;
    // Clamp en las dos ramas, no solo en multiple: una pregunta nunca vale
    // mas que su numero de respuestas correctas, sea cual sea el control.
    const puntos = Math.min(buenas.size, datos.multiple ? Math.max(0, bien - mal) : puntosUnica);

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
