/**
 * Smoke test del módulo lib/crypto. Ejecutar con:
 *   ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
 *     npx tsx scripts/verificar-cifrado.ts
 */
import { cifrar, descifrar } from "@/lib/crypto";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) {
    console.error(`FALLO: ${mensaje}`);
    process.exit(1);
  }
  console.log(`OK: ${mensaje}`);
}

// 1. Round-trip básico
const original = "ya29.a0AfH6SMB_ejemplo_de_token_de_google_abcdef";
const cifrado = cifrar(original);
afirmar(cifrado !== original, "el resultado no es el texto original");
afirmar(cifrado.split(":").length === 3, "formato con tres partes");
afirmar(descifrar(cifrado) === original, "round-trip preserva el texto");

// 2. Dos cifrados del mismo texto producen resultados distintos (IV aleatorio)
const a = cifrar(original);
const b = cifrar(original);
afirmar(a !== b, "IV aleatorio hace que cada cifrado sea distinto");

// 3. Manipulación del ciphertext falla la autenticación
const partes = cifrado.split(":");
const ctManipulado = Buffer.from(partes[1], "base64");
ctManipulado[0] ^= 0x01;
partes[1] = ctManipulado.toString("base64");
const manipulado = partes.join(":");
try {
  descifrar(manipulado);
  afirmar(false, "descifrar debe rechazar texto manipulado");
} catch (e) {
  afirmar(
    (e as Error).message === "CIFRADO_INVALIDO",
    "texto manipulado lanza CIFRADO_INVALIDO",
  );
}

// 4. Formato inválido
try {
  descifrar("no-es-un-cifrado");
  afirmar(false, "formato inválido debe lanzar");
} catch (e) {
  afirmar(
    (e as Error).message === "CIFRADO_INVALIDO",
    "formato inválido lanza CIFRADO_INVALIDO",
  );
}

console.log("\nTodas las verificaciones pasan.");
