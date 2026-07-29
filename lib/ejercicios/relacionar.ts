import { z } from "zod";
import {
  barajarEstable,
  comoLista,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

export const parejaSchema = z.object({
  id: z.string(),
  izquierda: z.string(),
  derecha: z.string(),
});

export const relacionarSchema = z
  .object({
    ejercicio: z.literal("relacionar"),
    consigna: z.string(),
    parejas: z.array(parejaSchema).min(2),
  })
  .refine(
    (d) => new Set(d.parejas.map((p) => p.derecha)).size === d.parejas.length,
    {
      message:
        "Dos parejas no pueden compartir el mismo texto en `derecha`: el estudiante vería dos celdas idénticas y una de las dos filas quedaría mal contada pase lo que pase. Repetir `izquierda` sí está permitido.",
    },
  );

export type Relacionar = z.infer<typeof relacionarSchema>;

export type RelacionarPublica = {
  consigna: string;
  izquierdas: { id: string; texto: string }[];
  /** `clave` es opaca a proposito: no dice a que pareja pertenece. */
  derechas: { clave: string; texto: string }[];
};

/**
 * Reparte una clave opaca a cada elemento de la derecha segun su posicion
 * en la lista barajada. Es una pieza de la seguridad de este tipo, no toda:
 * si la derecha viajara con el id de su pareja, bastaria con mirar el
 * codigo de la pagina para resolver el ejercicio entero. La otra pieza es
 * la propia `semilla`: quien la llama (`lib/ejercicios/registro.ts`) la
 * deriva del id del ejercicio mezclado con `ENCRYPTION_KEY`, un secreto que
 * el navegador nunca recibe. Si aqui llegara el id del ejercicio a secas
 * —como llegaba antes—, cualquiera podria rehacer este mismo barajado
 * desde el propio payload publico, porque ese id viaja a la pagina y se
 * pinta en un input oculto.
 *
 * El barajado es estable —misma semilla, mismo orden— por dos razones: el
 * servidor tiene que poder rehacerlo para corregir, y un orden distinto en
 * servidor y navegador rompe la hidratacion de React.
 */
function repartirClaves(datos: Relacionar, semilla: string) {
  return barajarEstable(datos.parejas, semilla).map((pareja, i) => ({
    clave: `d${i}`,
    parejaId: pareja.id,
    texto: pareja.derecha,
  }));
}

export function versionPublicaRelacionar(
  datos: Relacionar,
  semilla: string,
): RelacionarPublica {
  return {
    consigna: datos.consigna,
    izquierdas: datos.parejas.map((p) => ({ id: p.id, texto: p.izquierda })),
    derechas: repartirClaves(datos, semilla).map(({ clave, texto }) => ({
      clave,
      texto,
    })),
  };
}

/**
 * Un punto por pareja. No hay nada que marcar de mas, asi que no resta.
 *
 * Necesita la semilla para rehacer el reparto de claves y saber que pareja
 * hay detras de la clave que eligio el estudiante.
 */
export function corregirRelacionar(
  datos: Relacionar,
  respuestas: Respuestas,
  semilla: string,
): Correccion {
  const porClave = new Map(
    repartirClaves(datos, semilla).map((d) => [d.clave, d.parejaId]),
  );

  const items: ItemCorregido[] = [];
  let aciertos = 0;

  for (const pareja of datos.parejas) {
    const clave = comoLista(respuestas[pareja.id])[0];
    const acertado = clave !== undefined && porClave.get(clave) === pareja.id;
    if (acertado) aciertos++;
    items.push({ id: pareja.id, acertado, correcta: pareja.derecha });
  }

  return { aciertos, total: datos.parejas.length, items };
}
