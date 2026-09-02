import { prisma } from "@/lib/prisma";
import { esCorreoDeAdmin, estaBloqueado } from "@/lib/roles";
import { usuarioDeLaSesion } from "@/lib/sesion";

/**
 * Sube a ADMIN a quien esté en ADMIN_EMAILS. Se comprueba en cada entrada,
 * así que da igual el orden: registrarse antes y añadir la variable después
 * funciona igual de bien.
 *
 * Solo sube, nunca baja: quitar el rol desde el panel no sirve de nada si el
 * correo sigue en la variable. Es la red que impide quedarse fuera de la
 * propia aplicación.
 *
 * Exportada solo para que scripts/verificar-admin.ts pueda probarla contra
 * filas reales.
 */
export async function ascenderSiEsAdmin<
  T extends { id: string; email: string; role: string },
>(usuario: T): Promise<T> {
  if (usuario.role === "ADMIN" || !esCorreoDeAdmin(usuario.email)) return usuario;
  return (await prisma.user.update({
    where: { id: usuario.id },
    data: { role: "ADMIN" },
  })) as unknown as T;
}

/**
 * El candado. A quien está bloqueado se le trata como si no hubiera sesión,
 * así que todos los `if (!usuario)` que ya existen fallan cerrados.
 * Va antes del ascenso por ADMIN_EMAILS a propósito.
 */
async function dejarEntrar<
  T extends { id: string; email: string; role: string; bloqueadoEl: Date | null },
>(usuario: T): Promise<T | null> {
  if (estaBloqueado(usuario)) return null;
  return ascenderSiEsAdmin(usuario);
}

/**
 * La fila de User de la sesión actual, o null si no hay sesión, ha caducado,
 * o la persona está bloqueada. Ya no hay que emparejar por correo: la ficha
 * existe antes que la contraseña, porque la crea el profesor.
 */
export async function getUsuarioActual() {
  const usuario = await usuarioDeLaSesion();
  if (!usuario) return null;
  return dejarEntrar(usuario);
}

/**
 * La fecha de bloqueo de quien tiene la sesión abierta, o null. Existe solo
 * para el cartel: `getUsuarioActual` devolvió null y el layout no puede
 * distinguir «bloqueado» de «sin sesión».
 */
export async function bloqueoDelActual(): Promise<Date | null> {
  const usuario = await usuarioDeLaSesion();
  return usuario?.bloqueadoEl ?? null;
}
