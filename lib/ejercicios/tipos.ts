/**
 * El contrato que comparten los cinco tipos de ejercicio.
 *
 * Cada tipo aporta tres piezas: su forma (esquema zod), su version publica
 * (lo mismo sin las soluciones) y su cuenta (respuestas -> aciertos). Este
 * archivo define el lenguaje en el que esas piezas se hablan.
 */

/**
 * Lo que envia el estudiante, indexado por el identificador del elemento.
 * Cadena cuando la respuesta es una (una opcion, un hueco, una pareja) y
 * lista cuando son varias (opcion multiple, o el orden completo).
 */
export type Respuestas = Record<string, string | string[]>;

export type ItemCorregido = {
  /** Identificador del elemento: pregunta, hueco, pareja o pieza. */
  id: string;
  acertado: boolean;
  /** La respuesta buena, en texto, para poder ensenarsela al fallar. */
  correcta: string;
};

export type Correccion = {
  aciertos: number;
  total: number;
  items: ItemCorregido[];
};

/**
 * Para comparar lo que escribe el estudiante en un hueco: se perdona la
 * mayuscula y los espacios de sobra, pero no la tilde. Escribir "balcon"
 * por "balcon" con tilde es un fallo: esto es una clase de lengua.
 */
export function normalizar(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Baraja siempre igual para la misma semilla. Hace falta porque relacionar
 * y ordenar tienen que ensenar las piezas desordenadas, y un barajado al
 * azar daria un orden distinto en el servidor y en el navegador, que es
 * justo lo que React no perdona.
 */
export function barajarEstable<T>(items: T[], semilla: string): T[] {
  let estado = 0;
  for (let i = 0; i < semilla.length; i++) {
    estado = (estado * 31 + semilla.charCodeAt(i)) >>> 0;
  }
  const siguiente = () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(siguiente() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Una respuesta puede llegar suelta o en lista; aqui se normaliza a lista. */
export function comoLista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return [];
  return Array.isArray(valor) ? valor : [valor];
}
