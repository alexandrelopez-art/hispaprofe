import { z } from "zod";

// Contrato de datos del ejercicio OPCION_MULTIPLE.
//
// La respuesta correcta vive SOLO en este esquema, que es de servidor. Al
// estudiante se le manda la version recortada (sin `correcta`): si viajara
// al navegador, bastaria con mirar el codigo de la pagina para acertar todo.

export const preguntaSchema = z.object({
  id: z.string(),
  enunciado: z.string(),
  opciones: z.array(z.string()).min(2),
  /** Indice de la opcion correcta dentro de `opciones`. */
  correcta: z.number().int().min(0),
});

export const opcionMultipleSchema = z.object({
  ejercicio: z.literal("opcion_multiple"),
  consigna: z.string(),
  preguntas: z.array(preguntaSchema).min(1),
});

export type Pregunta = z.infer<typeof preguntaSchema>;
export type OpcionMultiple = z.infer<typeof opcionMultipleSchema>;

/** Lo que ve el estudiante: la pregunta sin la solucion. */
export type PreguntaPublica = Omit<Pregunta, "correcta">;

export function versionPublica(datos: OpcionMultiple): {
  consigna: string;
  preguntas: PreguntaPublica[];
} {
  return {
    consigna: datos.consigna,
    preguntas: datos.preguntas.map(({ id, enunciado, opciones }) => ({
      id,
      enunciado,
      opciones,
    })),
  };
}

/** Un punto por acierto. El maximo de un ejercicio es su numero de preguntas. */
export function corregir(
  datos: OpcionMultiple,
  respuestas: Map<string, number>,
): { aciertos: number; total: number } {
  const aciertos = datos.preguntas.filter(
    (p) => respuestas.get(p.id) === p.correcta,
  ).length;
  return { aciertos, total: datos.preguntas.length };
}
