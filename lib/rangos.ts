/**
 * Servir un archivo por trozos: qué pide una cabecera `Range`.
 *
 * Existe por Safari, que es el navegador de Pablo. WebKit exige byte-range para
 * arrancar un `<audio>`: sin esto, la grabación de un alumno sencillamente no
 * suena ahí. De paso arregla lo que en Chrome y Firefox solo molesta —la barra
 * del reproductor no deja saltar hasta tener el archivo entero, y como una
 * grabación privada va con `no-store`, cada reproducción se lo vuelve a bajar
 * completo—.
 *
 * Vive aquí y no dentro de la ruta por lo mismo que `puedeOirse`: desde `lib/`
 * un script lo ejercita entero, forma por forma y límite por límite, sin
 * levantar un servidor ni hablar HTTP. No importa `prisma` ni nada del
 * navegador: entran una cabecera y un tamaño, y sale qué trozo mandar.
 */

/**
 * Qué contestar. `fin` es inclusivo, como en HTTP: `bytes=0-0` es un byte.
 *
 * - `entero`: mandar el archivo completo con un 200. También cuando no hay
 *   cabecera, claro.
 * - `trozo`: un 206 con esos bytes.
 * - `imposible`: un 416. El cliente pide algo que este archivo no tiene.
 */
export type Rango =
  | { clase: "entero" }
  | { clase: "trozo"; inicio: number; fin: number }
  | { clase: "imposible" };

const ENTERO: Rango = { clase: "entero" };
const IMPOSIBLE: Rango = { clase: "imposible" };

/** Un solo rango de bytes: `0-499`, `500-`, `-500`. Nada más cuela. */
const FORMA = /^(\d*)-(\d*)$/;

export function interpretarRango(cabecera: string | null, total: number): Rango {
  if (cabecera === null) return ENTERO;

  // Una unidad que no entendemos se ignora y se manda el archivo entero: lo
  // dice la norma y es lo prudente, porque contestar 416 a un cliente que pide
  // en una unidad rara le niega un archivo que sí podría usar completo.
  const partes = cabecera.trim().split("=");
  if (partes.length !== 2 || partes[0].trim().toLowerCase() !== "bytes") return ENTERO;

  // Varios trozos de una vez piden una respuesta `multipart/byteranges`, que no
  // sabemos escribir. Mandar el archivo entero es una contestación válida a
  // cualquier `Range`, así que ese es el rodeo: ningún navegador pide varios
  // trozos para reproducir un audio.
  const pedido = partes[1].trim();
  if (pedido.includes(",")) return ENTERO;

  const forma = FORMA.exec(pedido);
  if (!forma) return IMPOSIBLE;

  const [, desde, hasta] = forma;
  if (desde === "" && hasta === "") return IMPOSIBLE;

  // Un archivo vacío no tiene ningún trozo que dar.
  if (total <= 0) return IMPOSIBLE;

  // `bytes=-500`: los últimos 500. Pedir los últimos cero no es nada, y pedir
  // más de los que hay se sirve entero, que es lo que manda la norma.
  if (desde === "") {
    const ultimos = Number(hasta);
    if (ultimos <= 0) return IMPOSIBLE;
    return { clase: "trozo", inicio: Math.max(0, total - ultimos), fin: total - 1 };
  }

  const inicio = Number(desde);
  // Empezar en el byte que sigue al último —o más allá— no tiene arreglo: es el
  // caso de 416 de verdad, el que dispara un cliente que cree que el archivo es
  // más grande de lo que es.
  if (inicio >= total) return IMPOSIBLE;

  // `bytes=500-`: de ahí al final.
  if (hasta === "") return { clase: "trozo", inicio, fin: total - 1 };

  const fin = Number(hasta);
  if (fin < inicio) return IMPOSIBLE;
  // Un final pasado del archivo se recorta en vez de rechazarse: el cliente
  // pide de más porque todavía no sabe el tamaño, y darle lo que hay es la
  // respuesta útil.
  return { clase: "trozo", inicio, fin: Math.min(fin, total - 1) };
}
