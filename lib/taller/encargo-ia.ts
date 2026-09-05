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

/**
 * El esquema JSON que Anthropic exige a la respuesta: el del motor, dentro
 * del sobre.
 *
 * `z.toJSONSchema` mete `"$schema"` en la raíz de lo que genera; JSON Schema
 * 2020-12 solo admite esa clave en la raíz de un recurso, y aquí el esquema
 * del motor se empotra como **subesquema** de `ejercicio`, no como raíz — se
 * quita. Si el motor trajera `$defs` (hoy ninguno de los dos, `opcion` ni
 * `relacionar`, los trae), también se suben al `$defs` de la raíz del
 * esquema de la herramienta, que es donde una referencia `#/$defs/…`
 * resuelve; dejarlos colgando del subesquema los habría dejado sin resolver.
 * `Tool.InputSchema` del SDK no habría avisado de ninguna de las dos cosas
 * (admite cualquier clave), así que el primer sitio donde se habría visto
 * era la primera llamada real, con un 400 delante del profesor.
 *
 * `io: "input"` (en vez del `"output"` por defecto) es lo que le corresponde
 * a un esquema que describe lo que la IA tiene que *producir*: con
 * `"output"`, los campos con `.default()` —`escuchas`, `sobrantes`,
 * `presentacion`— salen en `required` y obligan al modelo a inventarlos.
 */
export function esquemaDeHerramienta(tarea: TareaDele): Record<string, unknown> {
  const motor = tarea.motor === "relacionar" ? relacionarSchema : opcionSchema;
  const bruto = z.toJSONSchema(motor, { io: "input", unrepresentable: "any" }) as Record<string, unknown> & {
    $schema?: unknown;
    $defs?: Record<string, unknown>;
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se destructura para quitarlo del resto
  const { $schema: _schema, $defs: defsEjercicio, ...ejercicio } = bruto;
  // La IA no rellena `imagenes`: marca la opción con «(imagen)» y pide la
  // imagen en `imagenesPedidas` (ver `textoDelEncargo`) — el profesor es
  // quien la sube. Sin este borrado, el campo opcional de
  // `preguntaOpcionSchema` se colaba tal cual en el esquema de la
  // herramienta y la IA podía intentar rellenarlo con texto.
  const propiedadesDePregunta = (ejercicio as { properties?: { preguntas?: { items?: { properties?: Record<string, unknown> } } } })
    .properties?.preguntas?.items?.properties;
  if (propiedadesDePregunta) delete propiedadesDePregunta.imagenes;
  const sobre = z.toJSONSchema(respuestaIASchema.omit({ ejercicio: true }), { io: "input", unrepresentable: "any" }) as {
    properties: Record<string, unknown>;
    required?: string[];
    $defs?: Record<string, unknown>;
  };
  const { $defs: defsSobre, properties } = sobre;
  const defs = { ...(defsSobre ?? {}), ...(defsEjercicio ?? {}) };
  return {
    type: "object",
    properties: { ...properties, ejercicio },
    required: ["bloque", "ejercicio", "imagenesPedidas", "dudas", "claveOficial"],
    ...(Object.keys(defs).length > 0 ? { $defs: defs } : {}),
  };
}

export function textoDelEncargo(tarea: TareaDele, prueba: "CE" | "CO", numeroExamen: number, claves: { texto: string; cabecera: string; recortado: boolean } | null): string {
  const cloze = tarea.formato === "CLOZE";
  const reglas = tarea.motor === "opcion" ? (cloze ? [...REGLAS.opcion, ...REGLAS_CLOZE] : REGLAS.opcion) : REGLAS.relacionar;
  const sobrantes = sobrantesDe(tarea);
  const nombrePrueba = prueba === "CE" ? "comprensión de lectura" : "comprensión auditiva";
  return [
    `Estás transcribiendo la tarea ${tarea.numero} de la prueba de ${nombrePrueba} del examen ${numeroExamen} del DELE A2/B1 para escolares, a partir de las imágenes de sus páginas. Lo que devuelvas lo verá un estudiante tal cual, así que copia los textos exactos, con sus tildes y su puntuación.`,
    `Qué pide la tarea: ${tarea.pide}`,
    `Números que tiene que cumplir: ${tarea.items} ítems; ${tarea.opciones} opciones por ítem${tarea.listaComun ? " en una lista común a todos" : ""}${sobrantes ? `; ${sobrantes} sobrantes` : ""}.`,
    tarea.motor === "opcion"
      ? `El ejercicio es de tipo "opcion". ${tarea.listaComun ? "Las opciones van en `opcionesComunes` (por ejemplo los nombres de las tres personas o «A», «B», «C»)." : `Cada pregunta lleva sus ${tarea.opciones} \`opciones\` con el texto de cada una, sin la letra delante.`} Los ids de las preguntas son p1…p${tarea.items}. ${cloze ? `El pasaje va en \`texto\` con una marca {{p1}}…{{p${tarea.items}}} en cada hueco.` : ""}`
      : `El ejercicio es de tipo "relacionar". Cada pareja tiene en \`izquierda\` el enunciado o la persona (con su texto de presentación completo) y en \`derecha\` el TÍTULO del texto que le corresponde; los títulos de los ${sobrantes} textos que no casan van en \`sobrantes\`. Los ids son r1…r${tarea.items}. Devuelve además en \`textosConLetra\` los ${tarea.opciones} textos con su letra (A…) y su título.`,
    prueba === "CE"
      ? `El estímulo (el texto o los textos que se leen antes de contestar, con su título y su autor si los hay) va en \`bloque\` en markdown${cloze ? ", salvo el pasaje del cloze, que va en `texto`" : ""}.`
      : "En la auditiva no hay estímulo escrito: `bloque` va a null y las preguntas llevan solo su enunciado y opciones.",
    `Reglas que no se pueden romper:\n${reglas.map((r) => `- ${r}`).join("\n")}`,
    `Imágenes: si una opción o un ítem es un dibujo o una foto y no un texto, NO lo describas como opción; pon en la opción el texto «(imagen)» y añade una entrada en \`imagenesPedidas\` con el id de la pregunta, el índice de la opción (desde cero) o null si es el ítem entero, y en \`para\` una descripción corta de lo que se ve, para que el profesor la busque.`,
    `Dudas: cada texto que no hayas podido leer con seguridad va en \`dudas\` con el campo (por ejemplo «p3.opciones[1]») y lo que crees que pone.`,
    claves
      ? // El texto del cuadernillo va en el bloque de sistema (marcado para la
        // caché de prompts: ver `lib/taller/rellenar.ts`), no aquí — aquí solo
        // va la cabecera, que sí cambia por tarea y por eso no puede vivir en
        // el bloque cacheado.
        `El bloque de sistema trae el cuadernillo de claves${claves.recortado ? " (el cuadernillo entero: no se pudo recortar el examen, así que busca tú la sección que toca)" : ""}. ${claves.cabecera} Toma de ahí las respuestas correctas: marca \`correctas\` (o la pareja buena) según la clave, y devuelve en \`claveOficial\` la letra de cada ítem tal como aparece en el cuadernillo, con el id del ítem como clave. Si la clave de esta tarea no está, \`claveOficial\` va a null y marcas lo que leas del examen.`
      : "No hay cuadernillo de claves: \`claveOficial\` va a null. Marca como correcta lo que deduzcas del ejemplo resuelto si lo hay; si no, deja \`correctas\` vacío y anótalo en \`dudas\`.",
    `Responde solo llamando a la herramienta ${NOMBRE_HERRAMIENTA}.`,
  ].join("\n\n");
}
