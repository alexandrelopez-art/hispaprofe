/**
 * Verifica que un cuerpo por trozos entrega exactamente los bytes que le dan,
 * y que los entrega en varios trozos y no en uno solo.
 *
 * Ejecutar con:  npx tsx scripts/verificar-flujo.ts
 */
import { flujoDeBytes } from "@/lib/flujo";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/** Vacía un flujo y devuelve lo que salió, trozo a trozo. */
async function vaciar(flujo: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const trozos: Uint8Array[] = [];
  const lector = flujo.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
  }
  return trozos;
}

async function main() {
  // 1. Lo que sale es byte a byte lo que entró.
  const datos = Buffer.alloc(1000);
  for (let i = 0; i < datos.length; i++) datos[i] = i % 256;

  const trozos = await vaciar(flujoDeBytes(datos));
  const salida = Buffer.concat(trozos);
  afirmar(salida.length === datos.length, `salen los mismos bytes que entraron (${salida.length})`);
  afirmar(salida.equals(datos), "y en el mismo orden, sin perder ni repetir ninguno");

  // 2. Sale por trozos de verdad. Es la razón de existir del módulo: encolar
  //    el archivo entero de una vez sería un cuerpo formado con
  //    `ReadableStream` de disfraz, y entonces el tope de 4,5 MB de la
  //    plataforma seguiría aplicándose.
  const enTres = await vaciar(flujoDeBytes(datos, 400));
  afirmar(enTres.length === 3, `mil bytes en trozos de cuatrocientos salen en tres (${enTres.length})`);
  afirmar(enTres[2].length === 200, `y el último trae solo lo que queda (${enTres[2].length})`);

  // 3. El caso del borde: un archivo más pequeño que el trozo sale en uno solo,
  //    y uno vacío no cuelga esperando un trozo que no llega.
  const uno = await vaciar(flujoDeBytes(Buffer.alloc(10), 400));
  afirmar(uno.length === 1, "un archivo más pequeño que el trozo sale en un solo trozo");

  const vacio = await vaciar(flujoDeBytes(Buffer.alloc(0)));
  afirmar(vacio.length === 0, "y uno vacío cierra sin entregar nada, en vez de colgarse");

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
