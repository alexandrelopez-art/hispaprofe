/**
 * Verifica la portada de preparación: la tabla de bloques, el catálogo y la
 * puerta por la que un alumno se abre una práctica.
 *
 * Las partes puras no tocan la base. Las que sí, crean sus propios datos y los
 * borran en el `.finally()`, aunque una afirmación reviente a mitad.
 *
 * Ejecutar con:  npx tsx scripts/verificar-preparacion.ts
 */
import "dotenv/config";
import { BLOQUES, bloquePorNombre, bloquePorOrden } from "@/lib/preparacion";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function main() {
  // ─── La tabla de bloques ───────────────────────────────────────────────
  afirmar(BLOQUES.length === 4, "hay cuatro bloques");
  afirmar(
    BLOQUES.map((b) => b.orden).join(",") === "1,2,3,4",
    "los bloques van del 1 al 4, en orden",
  );
  afirmar(
    new Set(BLOQUES.map((b) => b.nombre)).size === 4,
    "los cuatro nombres de URL son distintos",
  );
  afirmar(
    bloquePorNombre("practica")?.orden === 2,
    "«practica» es el bloque 2",
  );
  afirmar(
    bloquePorOrden(3)?.nombre === "examen-blanco",
    "el bloque 3 se llama «examen-blanco» en la URL",
  );
  afirmar(bloquePorNombre("no-existe") === null, "un nombre inventado no da bloque");
  afirmar(bloquePorOrden(99) === null, "un orden inventado no da bloque");

  // El bloque 3 es el único que el alumno no se abre solo. Es la regla que
  // sostiene toda la puerta: si alguien la cambia aquí, el examen blanco se
  // vuelve autoservicio sin que nadie lo note.
  afirmar(
    BLOQUES.filter((b) => !b.autoservicio).map((b) => b.orden).join(",") === "3",
    "el examen blanco es el único bloque que no es autoservicio",
  );

  console.log("\nTodo en orden.");
}

main().then(() => process.exit(0));
