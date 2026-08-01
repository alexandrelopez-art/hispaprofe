import type { TipoEjercicio } from "@/lib/generated/prisma/enums";
import { analizar } from "@/lib/ejercicios/registro";
import { revisarDatos } from "@/lib/recursos";

// Solo de servidor: `revisarDatos` arrastra `lib/ejercicios/registro.ts`, que
// importa `node:crypto`. Ningún componente de cliente puede importar esto.

/**
 * Quita la valla ```json que las IA ponen alrededor del código, y lo que
 * escriban antes o después.
 *
 * No es una comodidad: casi todas contestan con el JSON dentro de una valla,
 * y muchas con un «Aquí tienes:» delante. Sin esto, el primer intento de
 * todo el mundo falla con «eso no es JSON» y el mensaje no dice qué hacer.
 */
export function sinValla(pegado: string): string {
  const t = pegado.trim();
  const valla = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  if (valla) return valla[1].trim();
  // Sin valla: desde la primera llave hasta la última. Si no hay ninguna,
  // se devuelve tal cual para que sea `JSON.parse` quien dé el motivo.
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  return i >= 0 && j > i ? t.slice(i, j + 1) : t;
}

/** El sobre ya abierto y con su contenido validado por el motor. */
export type SobreAbierto = {
  /** El texto que se lee antes del ejercicio, o null si no traía. */
  bloque: string | null;
  /** Los datos del ejercicio, tal cual entraron. */
  ejercicio: unknown;
  /** La columna `Ejercicio.tipo` que le toca. */
  tipo: TipoEjercicio;
};

export type Apertura = SobreAbierto | { error: string };

/**
 * Abre lo que se ha pegado, o dice por qué no se puede.
 *
 * Lo de dentro no lo valida este módulo: se lo pregunta a `revisarDatos`,
 * que es el mismo portero por el que pasa el editor de Recursos. Así, un
 * ejercicio pegado y otro escrito a mano se rechazan por lo mismo y con las
 * mismas palabras.
 */
export function abrirSobre(pegado: string): Apertura {
  const texto = sinValla(pegado);
  if (!texto) return { error: "No has pegado nada." };

  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch (e) {
    const porque = e instanceof Error ? e.message : "no se pudo leer";
    return { error: `Eso no es JSON: ${porque}` };
  }

  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
    return { error: "El sobre tiene que ser un objeto con `ejercicio` dentro." };
  }

  const dentro = (crudo as Record<string, unknown>).ejercicio;

  /*
   * El ejercicio pegado a pelo, sin sobre. Se reconoce porque `ejercicio` es
   * entonces la marca del motor —una cadena, «relacionar»— en vez del objeto.
   *
   * Es el error más probable de una IA y el único que se acepta en vez de
   * rechazarse: la intención no tiene otra lectura posible, y devolver un «te
   * falta el sobre» sobre un ejercicio perfectamente escrito es pedantería.
   * Se queda sin bloque, que es lo único que se pierde.
   */
  if (typeof dentro === "string") {
    const revision = revisarDatos(crudo);
    if ("error" in revision) return { error: revision.error };
    return { bloque: null, ejercicio: crudo, tipo: revision.tipo };
  }

  if (dentro === undefined) {
    return { error: "Al sobre le falta la casilla `ejercicio`." };
  }

  const bloqueBruto = (crudo as Record<string, unknown>).bloque;
  if (bloqueBruto !== undefined && typeof bloqueBruto !== "string") {
    return { error: "`bloque` tiene que ser el texto que se lee, entre comillas." };
  }
  const bloque = typeof bloqueBruto === "string" ? bloqueBruto.trim() : "";

  const revision = revisarDatos(dentro);
  if ("error" in revision) return { error: revision.error };

  return { bloque: bloque || null, ejercicio: dentro, tipo: revision.tipo };
}

/**
 * Una línea que dice qué se ha entendido: «relacionar · 6 parejas · 3
 * sobrantes».
 *
 * Se enseña antes de guardar y es la que caza el malentendido caro: un
 * ejercicio que dice tres parejas cuando la tarea lleva seis se ve aquí, no
 * cuando el alumno lo abre.
 */
export function resumir(datos: unknown): string {
  const a = analizar(datos);
  // `revisarDatos` acepta además las tareas de expresión, que `analizar` no
  // conoce: no hay nada que contarles.
  if (!a) return "tarea de expresión";

  if (a.tipo === "relacionar") {
    const sobran = a.datos.sobrantes.length;
    const cola = sobran > 0 ? ` · ${sobran} sobrantes` : "";
    return `relacionar · ${a.datos.parejas.length} parejas${cola}`;
  }
  if (a.tipo === "opcion") {
    const cola = a.datos.opcionesComunes ? " · lista común" : "";
    return `opción · ${a.datos.preguntas.length} preguntas${cola}`;
  }
  if (a.tipo === "huecos") {
    return `huecos · ${a.datos.huecos.length} huecos`;
  }
  return `ordenar · ${a.datos.piezas.length} piezas`;
}
