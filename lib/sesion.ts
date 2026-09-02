import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";

// El mismo literal "hp_sesion" está repetido en proxy.ts a propósito: el
// proxy no puede importar Prisma, así que no puede importar este archivo.
// Los dos deben moverse juntos si el nombre cambia.
export const NOMBRE_COOKIE = "hp_sesion";
export const DIAS_DE_SESION = 30;

/**
 * La cookie lleva el token en claro; la base guarda su hash. Quien copie la
 * base no puede fabricar una cookie, y quien tenga la cookie no necesita
 * nada más: es lo mismo que una contraseña de un solo navegador.
 */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Solo base: lo que el script de verificación ejercita ────────────────

export async function crearSesion(
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<{ token: string; caducaEl: Date }> {
  const token = randomBytes(32).toString("hex");
  const caducaEl = new Date(ahora.getTime() + DIAS_DE_SESION * 86_400_000);
  await prisma.sesion.create({
    data: { tokenHash: hashDeToken(token), usuarioId, caducaEl },
  });
  return { token, caducaEl };
}

/** Null si no existe o ha caducado. La caducada se borra al encontrarla. */
export async function usuarioPorToken(
  token: string,
  ahora: Date = new Date(),
): Promise<User | null> {
  if (!token) return null;
  const sesion = await prisma.sesion.findUnique({
    where: { tokenHash: hashDeToken(token) },
    include: { usuario: true },
  });
  if (!sesion) return null;
  if (sesion.caducaEl <= ahora) {
    await prisma.sesion.delete({ where: { id: sesion.id } }).catch(() => {});
    return null;
  }
  return sesion.usuario;
}

export async function borrarSesionPorToken(token: string): Promise<void> {
  await prisma.sesion.deleteMany({ where: { tokenHash: hashDeToken(token) } });
}

/** Cierra todas las sesiones de un usuario, salvo la del token dado si se pasa. */
export async function cerrarSesionesDe(
  usuarioId: string,
  salvoToken?: string,
): Promise<number> {
  const { count } = await prisma.sesion.deleteMany({
    where: {
      usuarioId,
      ...(salvoToken ? { tokenHash: { not: hashDeToken(salvoToken) } } : {}),
    },
  });
  return count;
}

// ─── Con cookie: solo desde acciones de servidor, páginas y layouts ───────

export async function tokenDeLaCookie(): Promise<string | null> {
  const tarro = await cookies();
  return tarro.get(NOMBRE_COOKIE)?.value ?? null;
}

/** Solo desde una acción de servidor: Next no deja poner cookies al renderizar. */
export async function abrirSesion(usuarioId: string): Promise<void> {
  const { token, caducaEl } = await crearSesion(usuarioId);
  const tarro = await cookies();
  tarro.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Segura en todo lo que no sea desarrollo: la spec lo dice así, y es la
    // condición más estrecha.
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    expires: caducaEl,
  });
}

export async function usuarioDeLaSesion(): Promise<User | null> {
  const token = await tokenDeLaCookie();
  if (!token) return null;
  return usuarioPorToken(token);
}

/** Solo desde una acción de servidor. */
export async function cerrarSesion(): Promise<void> {
  const token = await tokenDeLaCookie();
  if (token) await borrarSesionPorToken(token);
  const tarro = await cookies();
  tarro.delete(NOMBRE_COOKIE);
}
