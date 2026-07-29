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
  /** Todas las formas que se dan por buenas en este hueco. */
  acepta: z.array(z.string()).min(1),
});

export const huecosSchema = z.object({
  ejercicio: z.literal("huecos"),
  consigna: z.string(),
  texto: z.string(),
  huecos: z.array(huecoSchema).min(1),
});

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
