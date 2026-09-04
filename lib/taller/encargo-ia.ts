import { z } from "zod";
import type { TareaDele } from "@/lib/dele/mapa";
import { sobrantesDe } from "@/lib/dele";
import { opcionSchema } from "@/lib/ejercicios/opcion";
import { relacionarSchema } from "@/lib/ejercicios/relacionar";
import { REGLAS, REGLAS_CLOZE } from "@/lib/pegado/encargo";

export const respuestaIASchema = z.object({
  bloque: z.string().nullable(),
  ejercicio: z.unknown(),
  textosConLetra: z.array(z.object({ letra: z.string(), texto: z.string() })).default([]),
  imagenesPedidas: z.array(z.object({ pregunta: z.string(), opcion: z.number().int().nullable(), para: z.string() })).default([]),
  dudas: z.array(z.object({ campo: z.string(), texto: z.string() })).default([]),
  claveOficial: z.record(z.string(), z.string()).nullable(),
});
export type RespuestaIA = z.infer<typeof respuestaIASchema>;

export const NOMBRE_HERRAMIENTA = "entregar_tarea";

/** El esquema JSON que Anthropic exige a la respuesta: el del motor, dentro del sobre. */
export function esquemaDeHerramienta(tarea: TareaDele): Record<string, unknown> {
  const motor = tarea.motor === "relacionar" ? relacionarSchema : opcionSchema;
  const ejercicio = z.toJSONSchema(motor, { unrepresentable: "any" });
  const sobre = z.toJSONSchema(respuestaIASchema.omit({ ejercicio: true }), { unrepresentable: "any" }) as { properties: Record<string, unknown>; required?: string[] };
  return {
    type: "object",
    properties: { ...sobre.properties, ejercicio },
    required: ["bloque", "ejercicio", "imagenesPedidas", "dudas", "claveOficial"],
  };
}

export function textoDelEncargo(tarea: TareaDele, prueba: "CE" | "CO", numeroExamen: number, claves: { texto: string; recortado: boolean } | null): string {
  const cloze = tarea.formato === "CLOZE";
  const reglas = tarea.motor === "opcion" ? (cloze ? [...REGLAS.opcion, ...REGLAS_CLOZE] : REGLAS.opcion) : REGLAS.relacionar;
  const sobrantes = sobrantesDe(tarea);
  const nombrePrueba = prueba === "CE" ? "comprensión de lectura" : "comprensión auditiva";
  return [
    `Estás transcribiendo la tarea ${tarea.numero} de la prueba de ${nombrePrueba} del examen ${numeroExamen} del DELE A2/B1 para escolares, a partir de las imágenes de sus páginas. Lo que devuelvas lo verá un estudiante tal cual, así que copia los textos exactos, con sus tildes y su puntuación.`,
    `Qué pide la tarea: ${tarea.pide}`,
    `Números que tiene que cumplir: ${tarea.items} ítems; ${tarea.opciones} opciones por ítem${tarea.listaComun ? " en una lista común a todos" : ""}${sobrantes ? `; ${sobrantes} sobrantes` : ""}.`,
    tarea.motor === "opcion"
      ? `El ejercicio es de tipo "opcion". ${tarea.listaComun ? "Las opciones van en `opcionesComunes` (por ejemplo los nombres de las tres personas o «A», «B», «C»)." : "Cada pregunta lleva sus tres `opciones` con el texto de cada una, sin la letra delante."} Los ids de las preguntas son p1…p${tarea.items}. ${cloze ? "El pasaje va en `texto` con una marca {{p1}}…{{p7}} en cada hueco." : ""}`
      : `El ejercicio es de tipo "relacionar". Cada pareja tiene en \`izquierda\` el enunciado o la persona (con su texto de presentación completo) y en \`derecha\` el TÍTULO del texto que le corresponde; los títulos de los ${sobrantes} textos que no casan van en \`sobrantes\`. Los ids son r1…r${tarea.items}. Devuelve además en \`textosConLetra\` los ${tarea.opciones} textos con su letra (A…) y su título.`,
    `El estímulo (el texto o los textos que se leen antes de contestar, con su título y su autor si los hay) va en \`bloque\` en markdown${cloze ? ", salvo el pasaje del cloze, que va en `texto`" : ""}. En la auditiva no hay estímulo escrito: \`bloque\` va a null y las preguntas llevan solo su enunciado y opciones.`,
    `Reglas que no se pueden romper:\n${reglas.map((r) => `- ${r}`).join("\n")}`,
    `Imágenes: si una opción o un ítem es un dibujo o una foto y no un texto, NO lo describas como opción; pon en la opción el texto «(imagen)» y añade una entrada en \`imagenesPedidas\` con el id de la pregunta, el índice de la opción (desde cero) o null si es el ítem entero, y en \`para\` una descripción corta de lo que se ve, para que el profesor la busque.`,
    `Dudas: cada texto que no hayas podido leer con seguridad va en \`dudas\` con el campo (por ejemplo «p3.opciones[1]») y lo que crees que pone.`,
    claves
      ? `Cuadernillo de claves${claves.recortado ? " (entero, no se pudo recortar: busca tú el examen y la tarea)" : ""}. Toma de ahí las respuestas correctas: marca \`correctas\` (o la pareja buena) según la clave, y devuelve en \`claveOficial\` la letra de cada ítem tal como aparece en el cuadernillo, con el id del ítem como clave. Si la clave de esta tarea no está, \`claveOficial\` va a null y marcas lo que leas del examen.\n\n${claves.texto}`
      : "No hay cuadernillo de claves: \`claveOficial\` va a null. Marca como correcta lo que deduzcas del ejemplo resuelto si lo hay; si no, deja \`correctas\` vacío y anótalo en \`dudas\`.",
    `Responde solo llamando a la herramienta ${NOMBRE_HERRAMIENTA}.`,
  ].join("\n\n");
}
