import { z } from "zod";
import {
  barajarEstable,
  comoLista,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

export const piezaSchema = z.object({
  id: z.string(),
  /**
   * Sin este mínimo, dos piezas en blanco pasaban el esquema y se guardaban
   * y publicaban tal cual: el estudiante veía dos huecos que arrastrar sin
   * nada escrito dentro. Se comprueba sobre el texto recortado, y no con
   * `.trim()`, para no cambiar de paso lo que se guarda.
   */
  texto: z
    .string()
    .refine((t) => t.trim().length > 0, {
      message: "Cada pieza necesita un texto. Escríbelo o quita la pieza.",
    }),
});

export const ordenarSchema = z.object({
  ejercicio: z.literal("ordenar"),
  consigna: z.string(),
  /** Las piezas en su orden correcto. Al estudiante le llegan barajadas. */
  piezas: z.array(piezaSchema).min(2, { message: "El ejercicio necesita al menos dos piezas." }),
});

export type Ordenar = z.infer<typeof ordenarSchema>;

export type OrdenarPublica = {
  consigna: string;
  piezas: { id: string; texto: string }[];
};

export function versionPublicaOrdenar(
  datos: Ordenar,
  semilla: string,
): OrdenarPublica {
  return {
    consigna: datos.consigna,
    piezas: barajarEstable(datos.piezas, semilla),
  };
}

/**
 * Cuenta parejas consecutivas, no posiciones. Con el orden bueno A B C D,
 * responder B C D A acierta B->C y C->D: dos de tres. Puntuar por posicion
 * habria dado cero por un desplazamiento, que castiga un descuido como si
 * fuera desconocimiento.
 *
 * Consecuencia: N piezas valen N-1 puntos.
 */
export function corregirOrdenar(datos: Ordenar, respuestas: Respuestas): Correccion {
  const bueno = datos.piezas.map((p) => p.id);
  const dado = comoLista(respuestas.orden);
  const total = bueno.length - 1;

  // Que pieza va detras de cual, en el orden correcto.
  const siguienteBueno = new Map<string, string>();
  for (let i = 0; i < bueno.length - 1; i++) {
    siguienteBueno.set(bueno[i], bueno[i + 1]);
  }

  const items: ItemCorregido[] = [];
  let aciertos = 0;
  for (let i = 0; i < bueno.length - 1; i++) {
    const id = bueno[i];
    const acertado =
      dado.indexOf(id) !== -1 && dado[dado.indexOf(id) + 1] === siguienteBueno.get(id);
    if (acertado) aciertos++;
    const textoSiguiente =
      datos.piezas.find((p) => p.id === siguienteBueno.get(id))?.texto ?? "";
    items.push({
      id,
      acertado,
      correcta: `después va: ${textoSiguiente}`,
    });
  }

  return { aciertos, total, items };
}
