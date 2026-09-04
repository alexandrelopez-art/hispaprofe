import Anthropic from "@anthropic-ai/sdk";
import type { TareaDele } from "@/lib/dele/mapa";
import { esquemaDeHerramienta, NOMBRE_HERRAMIENTA, respuestaIASchema, textoDelEncargo, type RespuestaIA } from "@/lib/taller/encargo-ia";

export const MODELO = "claude-opus-5";

export function hayClaveDeIA(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class SinClaveError extends Error {
  constructor() { super("Falta la clave de la API. Ponla en Vercel como ANTHROPIC_API_KEY."); }
}

export type EntradaDePeticion = {
  tarea: TareaDele;
  prueba: "CE" | "CO";
  numeroExamen: number;
  paginas: { bytes: Uint8Array; tipo: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[];
  claves: { texto: string; cabecera: string; recortado: boolean } | null;
};

/**
 * Una tarea, una llamada. Salida forzada por herramienta y sin pensamiento
 * extendido: la API no admite forzar la herramienta con el pensamiento
 * encendido, y lo que queremos aquí es una transcripción fiel con el JSON
 * bien formado, no un razonamiento largo.
 *
 * El cuadernillo (si lo hay) va en `system`, no en el mensaje de usuario: es
 * el único bloque que sale letra a letra igual en las ocho llamadas del
 * mismo motor de un examen —no depende de la tarea ni de la prueba, solo
 * del número de examen (ver `lib/taller/cuadernillo.ts`)—, así que es el
 * único candidato real a acertar la caché de prompts. Puesto al final del
 * mensaje de usuario, detrás de las imágenes de cada tarea (como estaba
 * antes), el prefijo marcado cambiaba en cada llamada y no acertaba nunca:
 * `cache_control` marca el prefijo **hasta ese bloque incluido**, y ese
 * prefijo llevaba las imágenes de esa tarea y el texto del encargo, que
 * cambia siempre. El orden real del prompt —herramientas, luego sistema,
 * luego mensajes— lo fija la API a partir de estos campos con
 * independencia del orden en que se escriban aquí; lo que importa es que
 * `tools` y (si lo hay) `system` sean idénticos entre llamadas del mismo
 * motor para que el prefijo cacheado coincida.
 */
export async function pedirTarea(entrada: EntradaDePeticion): Promise<RespuestaIA> {
  if (!hayClaveDeIA()) throw new SinClaveError();
  const cliente = new Anthropic();
  const texto = textoDelEncargo(entrada.tarea, entrada.prueba, entrada.numeroExamen, entrada.claves);
  const respuesta = await cliente.messages.create({
    model: MODELO,
    max_tokens: 8000,
    tools: [{ name: NOMBRE_HERRAMIENTA, description: "Entrega la tarea transcrita en el formato del sitio.", input_schema: esquemaDeHerramienta(entrada.tarea) as Anthropic.Tool["input_schema"] }],
    tool_choice: { type: "tool", name: NOMBRE_HERRAMIENTA },
    ...(entrada.claves
      ? { system: [{ type: "text" as const, text: entrada.claves.texto, cache_control: { type: "ephemeral" as const } }] }
      : {}),
    messages: [{
      role: "user",
      content: [
        ...entrada.paginas.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.tipo, data: Buffer.from(p.bytes).toString("base64") } })),
        { type: "text" as const, text: texto },
      ],
    }],
  });
  // Si la IA se quedó sin `max_tokens` a media respuesta, el `ejercicio`
  // truncado puede seguir validando contra el esquema del motor con menos
  // preguntas de las que tiene, y se guardaría como un simple aviso de
  // ítems en vez de como el error de verdad que es.
  if (respuesta.stop_reason === "max_tokens") {
    throw new Error("La IA cortó la respuesta al llegar al máximo de tokens: puede haber quedado a medias.");
  }
  const uso = respuesta.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") throw new Error("La IA no devolvió la tarea.");
  const abierto = respuestaIASchema.safeParse(uso.input);
  if (!abierto.success) throw new Error(`La IA devolvió algo que no es una tarea: ${abierto.error.issues[0]?.message ?? "formato desconocido"}.`);
  return abierto.data;
}
