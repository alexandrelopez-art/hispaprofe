import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const LONGITUD_IV = 12;
const LONGITUD_CLAVE = 32;

function clave(): Buffer {
  const bruta = process.env.ENCRYPTION_KEY;
  if (!bruta) {
    throw new Error(
      "ENCRYPTION_KEY no está definida. Genera una con: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  const buffer = Buffer.from(bruta, "base64");
  if (buffer.length !== LONGITUD_CLAVE) {
    throw new Error(
      `ENCRYPTION_KEY debe decodificar a ${LONGITUD_CLAVE} bytes, tiene ${buffer.length}.`,
    );
  }
  return buffer;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(LONGITUD_IV);
  const cifrador = createCipheriv(ALGORITMO, clave(), iv);
  const cifrado = Buffer.concat([
    cifrador.update(texto, "utf8"),
    cifrador.final(),
  ]);
  const tag = cifrador.getAuthTag();
  return `${iv.toString("base64")}:${cifrado.toString("base64")}:${tag.toString("base64")}`;
}

export function descifrar(texto: string): string {
  const partes = texto.split(":");
  if (partes.length !== 3) throw new Error("CIFRADO_INVALIDO");
  const [ivB64, ctB64, tagB64] = partes;
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== LONGITUD_IV || tag.length !== 16) {
    throw new Error("CIFRADO_INVALIDO");
  }
  try {
    const descifrador = createDecipheriv(ALGORITMO, clave(), iv);
    descifrador.setAuthTag(tag);
    const claro = Buffer.concat([descifrador.update(ct), descifrador.final()]);
    return claro.toString("utf8");
  } catch {
    throw new Error("CIFRADO_INVALIDO");
  }
}
