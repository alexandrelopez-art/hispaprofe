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
  paginas: { bytes: Uint8Array; tipo: "image/jpeg" | "image/png" | "image/webp" }[];
  claves: { texto: string; recortado: boolean } | null;
};

/**
 * Una tarea, una llamada. Salida forzada por herramienta y sin pensamiento
 * extendido: la API no admite forzar la herramienta con el pensamiento
 * encendido, y lo que queremos aquí es una transcripción fiel con el JSON
 * bien formado, no un razonamiento largo. El cuadernillo va marcado para la
 * caché de prompts: se repite en las ocho llamadas del examen.
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
    messages: [{
      role: "user",
      content: [
        ...entrada.paginas.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.tipo, data: Buffer.from(p.bytes).toString("base64") } })),
        { type: "text" as const, text: texto, cache_control: { type: "ephemeral" as const } },
      ],
    }],
  });
  const uso = respuesta.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") throw new Error("La IA no devolvió la tarea.");
  const abierto = respuestaIASchema.safeParse(uso.input);
  if (!abierto.success) throw new Error(`La IA devolvió algo que no es una tarea: ${abierto.error.issues[0]?.message ?? "formato desconocido"}.`);
  return abierto.data;
}
