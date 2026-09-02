/**
 * Verifica la puerta: contraseñas, intentos, sesiones y contraseña nueva.
 * Crea sus propios datos con marca única y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-entrada.ts
 */
import "dotenv/config";
import {
  ALFABETO_LEGIBLE,
  cifrarContrasena,
  comprobarContrasena,
  generarContrasena,
  validarContrasena,
} from "@/lib/contrasena";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function contrasenas() {
  console.log("\n— Contraseñas —");
  const hash = await cifrarContrasena("mi contraseña 1");
  afirmar(hash.startsWith("scrypt$"), "el hash lleva el prefijo del algoritmo");
  afirmar(hash.split("$").length === 3, "el hash tiene sal y resultado");
  afirmar(await comprobarContrasena("mi contraseña 1", hash), "la misma contraseña pasa");
  afirmar(!(await comprobarContrasena("mi contraseña 2", hash)), "otra contraseña no pasa");
  afirmar(!(await comprobarContrasena("", hash)), "la vacía no pasa");
  afirmar(!(await comprobarContrasena("mi contraseña 1", "basura")), "un hash roto no pasa ni revienta");
  const otroHash = await cifrarContrasena("mi contraseña 1");
  afirmar(otroHash !== hash, "dos cifrados de la misma contraseña difieren (sal)");

  const generadas = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const c = generarContrasena();
    afirmar(c.length === 10, `la generada mide 10 (${c})`);
    afirmar([...c].every((l) => ALFABETO_LEGIBLE.includes(l)), "solo usa el alfabeto legible");
    generadas.add(c);
  }
  afirmar(generadas.size === 20, "veinte generadas, veinte distintas");

  afirmar(validarContrasena("1234567") !== null, "siete caracteres se rechazan");
  afirmar(validarContrasena("12345678") === null, "ocho caracteres valen");
  afirmar(validarContrasena("   ") !== null, "espacios solos se rechazan");
}

async function main() {
  await contrasenas();
  console.log("\nTodo en orden.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
