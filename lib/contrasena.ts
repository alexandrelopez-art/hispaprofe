import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Contraseñas cifradas con scrypt de node:crypto. Sin dependencias a
 * propósito: Vercel no ejecuta binarios y bcrypt nativo es justamente eso.
 * Formato guardado: `scrypt$<sal hex>$<hash hex>`.
 */

const LONGITUD_SAL = 16;
const LONGITUD_HASH = 32;
const PARAMETROS = { N: 16384, r: 8, p: 1 };

/** Sin 0/O, 1/l/I: para dictar por teléfono sin equivocarse. */
export const ALFABETO_LEGIBLE = "abcdefghjkmnpqrstuvwxyz23456789";
export const LONGITUD_GENERADA = 10;
export const LONGITUD_MINIMA = 8;

function derivar(texto: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(texto, sal, LONGITUD_HASH, PARAMETROS, (err, clave) =>
      err ? reject(err) : resolve(clave),
    );
  });
}

export async function cifrarContrasena(texto: string): Promise<string> {
  const sal = randomBytes(LONGITUD_SAL);
  const hash = await derivar(texto, sal);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

/** Nunca lanza: un hash mal formado simplemente no pasa. */
export async function comprobarContrasena(
  texto: string,
  hash: string,
): Promise<boolean> {
  const partes = hash.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const sal = Buffer.from(partes[1], "hex");
  const esperado = Buffer.from(partes[2], "hex");
  if (sal.length !== LONGITUD_SAL || esperado.length !== LONGITUD_HASH) return false;
  const obtenido = await derivar(texto, sal);
  return timingSafeEqual(obtenido, esperado);
}

export function generarContrasena(): string {
  let c = "";
  for (let i = 0; i < LONGITUD_GENERADA; i++) {
    c += ALFABETO_LEGIBLE[randomInt(ALFABETO_LEGIBLE.length)];
  }
  return c;
}

/** Devuelve el motivo en español, o null si vale. Una sola regla: longitud. */
export function validarContrasena(texto: string): string | null {
  if (texto.trim().length < LONGITUD_MINIMA) {
    return `La contraseña tiene que tener al menos ${LONGITUD_MINIMA} caracteres.`;
  }
  return null;
}
