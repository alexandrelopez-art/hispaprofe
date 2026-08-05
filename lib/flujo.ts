/**
 * Convierte unos bytes ya en memoria en un cuerpo de respuesta que sale por
 * trozos.
 *
 * Existe por un límite de la plataforma y no por elegancia: en Vercel, una
 * respuesta cuyo cuerpo se forma entero antes de mandarlo no puede pasar de
 * 4,5 MB, y las respuestas en streaming no tienen ese tope. Un m4a de 6 MB
 * —lo que pesa la Tarea 1 del Cervantes ya comprimida— no se puede servir de
 * la primera forma.
 *
 * Y va por trozos de verdad, no encolando el archivo entero de una vez: un
 * solo `enqueue` con seis megas dentro es un cuerpo formado con
 * `ReadableStream` de disfraz, y no hay por qué apostar a que la plataforma
 * lo mire con buenos ojos.
 *
 * No importa `prisma` ni nada del navegador: entran bytes y sale un flujo.
 *
 * El parámetro es `Uint8Array` y no `Buffer` porque es lo que devuelve Prisma
 * en una columna `Bytes`, y pedir un `Buffer` obligaba a copiar el archivo
 * entero solo para satisfacer al comprobador de tipos. Esta función solo usa
 * `.length` y `.subarray()`, ambos disponibles en `Uint8Array`.
 */

/**
 * 256 KB. Lo bastante grande para no trocear de más un audio de seis megas
 * (veinticuatro trozos) y lo bastante pequeño para que no se parezca a mandar
 * el archivo de una vez.
 */
const TROZO_POR_DEFECTO = 256 * 1024;

export function flujoDeBytes(datos: Uint8Array, trozo = TROZO_POR_DEFECTO): ReadableStream<Uint8Array> {
  let enviado = 0;
  return new ReadableStream({
    // `pull` y no `start`: así se copia un trozo cuando el otro lado está
    // listo para recibirlo, en vez de empujarlos todos a la cola de golpe.
    pull(control) {
      if (enviado >= datos.length) {
        control.close();
        return;
      }
      const fin = Math.min(enviado + trozo, datos.length);
      // `new Uint8Array(...)` sobre el `subarray`: `subarray` comparte memoria
      // con el Buffer de origen, y lo que se encola tiene que ser una vista
      // que nadie más vaya a tocar.
      control.enqueue(new Uint8Array(datos.subarray(enviado, fin)));
      enviado = fin;
    },
  });
}
