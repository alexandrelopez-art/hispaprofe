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

export const relacionarSchema = z.object({
  ejercicio: z.literal("relacionar"),
  consigna: z.string(),
  parejas: z.array(parejaSchema).min(2),
});

export type Relacionar = z.infer<typeof relacionarSchema>;

export type RelacionarPublica = {
  consigna: string;
  izquierdas: { id: string; texto: string }[];
  /** `clave` es opaca a proposito: no dice a que pareja pertenece. */
  derechas: { clave: string; texto: string }[];
};

/**
 * Reparte una clave opaca a cada elemento de la derecha segun su posicion
 * en la lista barajada. Es el nucleo de la seguridad de este tipo: si la
 * derecha viajara con el id de su pareja, bastaria con mirar el codigo de
 * la pagina para resolver el ejercicio entero.
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
