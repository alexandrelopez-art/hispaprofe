import { z } from "zod";
import {
  comoLista,
  normalizar,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

// El texto lleva marcas {{id}} donde falta una palabra. Cada marca se
// corresponde con un hueco de la lista.

export const huecoSchema = z.object({
  id: z.string(),
  /**
   * Todas las formas que se dan por buenas en este hueco.
   *
   * El `min(1)` cuenta elementos, no contenido: `acepta: [""]` lo pasaba, y
   * un hueco cuya única forma buena es la cadena vacía no lo acierta nadie
   * —el estudiante no puede enviar el hueco en blanco—, así que valía cero
   * puntos garantizados sin que nada avisara. De ahí el mínimo por forma.
   */
  acepta: z
    .array(
      z.string().refine((f) => f.trim().length > 0, {
        message:
          "Una forma aceptada no puede estar vacía: nadie podría acertar ese hueco. Escríbela o quítala.",
      }),
    )
    .min(1, { message: "Cada hueco necesita al menos una respuesta aceptada." }),
});

export const huecosSchema = z
  .object({
    ejercicio: z.literal("huecos"),
    consigna: z.string(),
    texto: z.string(),
    huecos: z.array(huecoSchema).min(1, { message: "El ejercicio necesita al menos un hueco." }),
  })
  .refine(
    (d) => {
      const marcas = new Set(
        [...d.texto.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]),
      );
      const ids = new Set(d.huecos.map((h) => h.id));
      return (
        marcas.size === ids.size && [...marcas].every((m) => ids.has(m))
      );
    },
    {
      // Nada obliga a que las marcas {{id}} del texto y los ids de `huecos`
      // coincidan: se escriben a mano en dos sitios distintos del script de
      // siembra, sin editor que los enlace. Con un id que no cuadra, la cara
      // dibuja un recuadro por marca y `progresoHuecos` cuenta sobre
      // `huecos`, así que el estudiante puede rellenar todo lo que ve y el
      // contador nunca llega al total: el botón de enviar no se activa
      // nunca. Mejor rechazarlo al sembrar que descubrirlo con un estudiante
      // atascado.
      message:
        "Las marcas {{...}} del texto no coinciden con los ids de `huecos`.",
    },
  );

export type Huecos = z.infer<typeof huecosSchema>;

export type HuecosPublica = {
  consigna: string;
  texto: string;
  huecos: { id: string }[];
};

export function versionPublicaHuecos(datos: Huecos): HuecosPublica {
  return {
    consigna: datos.consigna,
    texto: datos.texto,
    huecos: datos.huecos.map(({ id }) => ({ id })),
  };
}

/** Parte el texto en trozos alternos para poder dibujar los recuadros. */
export function trozos(
  texto: string,
): { tipo: "texto" | "hueco"; valor: string }[] {
  const salida: { tipo: "texto" | "hueco"; valor: string }[] = [];
  const patron = /\{\{([^}]+)\}\}/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(texto)) !== null) {
    if (m.index > ultimo) {
      salida.push({ tipo: "texto", valor: texto.slice(ultimo, m.index) });
    }
    salida.push({ tipo: "hueco", valor: m[1] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) {
    salida.push({ tipo: "texto", valor: texto.slice(ultimo) });
  }
  return salida;
}

/** Un punto por hueco. Aqui no hay nada que marcar de mas, asi que no resta. */
export function corregirHuecos(datos: Huecos, respuestas: Respuestas): Correccion {
  const items: ItemCorregido[] = [];
  let aciertos = 0;

  for (const hueco of datos.huecos) {
    const escrito = comoLista(respuestas[hueco.id])[0] ?? "";
    const acertado = hueco.acepta.some(
      (bueno) => normalizar(bueno) === normalizar(escrito),
    );
    if (acertado) aciertos++;
    items.push({ id: hueco.id, acertado, correcta: hueco.acepta[0] });
  }

  return { aciertos, total: datos.huecos.length, items };
}
