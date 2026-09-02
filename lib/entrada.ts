import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";
import { estaBloqueado, estaSuprimido } from "@/lib/roles";
import {
  cifrarContrasena,
  comprobarContrasena,
  generarContrasena,
} from "@/lib/contrasena";

export const MAX_INTENTOS = 5;
export const MINUTOS_DE_CASTIGO = 15;

export type MotivoRechazo = "credenciales" | "demasiados-intentos" | "sin-acceso";

export type ResultadoEntrada =
  | { ok: true; usuario: User }
  | { ok: false; motivo: MotivoRechazo };

export function normalizarCorreo(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Un hash de mentira, calculado una sola vez por proceso. Sirve para que
 * comprobar un correo que no existe cueste el mismo tiempo (un scrypt
 * entero) que comprobar uno real con la contraseña mal escrita: sin esto,
 * la respuesta llegaría antes cuando el correo no está en la base, y ese
 * tiempo de menos ya es una forma de decir «este correo no existe».
 */
const SENUELO = cifrarContrasena(`señuelo-${randomBytes(8).toString("hex")}`);

/**
 * Solo rutas de esta casa. `new URL` resuelve `//`, `\\` y esquemas raros
 * igual que el navegador: si el origen cambia, no es nuestra.
 */
export function destinoSeguro(volver: string | null | undefined): string {
  if (!volver) return "/dashboard";
  const base = "http://hispaprofe.local";
  let u: URL;
  try {
    u = new URL(volver, base);
  } catch {
    return "/dashboard";
  }
  if (u.origin !== base || !volver.startsWith("/")) return "/dashboard";
  return u.pathname + u.search;
}

export type MotivoNoPuede = "no-existe" | "uno-mismo" | "solo-admin" | "suprimido";

/**
 * Un profesor solo a estudiantes; a un profesor o administrador, solo un
 * administrador; a uno mismo, nadie (para eso está cambiarMiContrasena).
 */
export function motivoParaNoPonerContrasena(
  yo: { id: string; role: string },
  objetivo: { id: string; role: string; suprimidoEl: Date | null } | null,
): MotivoNoPuede | null {
  if (!objetivo) return "no-existe";
  if (objetivo.id === yo.id) return "uno-mismo";
  if (objetivo.role !== "STUDENT" && yo.role !== "ADMIN") return "solo-admin";
  if (objetivo.suprimidoEl) return "suprimido";
  return null;
}

/**
 * La regla de entrada entera, en el orden que cuenta:
 *
 *  1. Sin fila → «credenciales». El mismo motivo que una contraseña mal, para
 *     no revelar qué correos existen.
 *  2. Castigada por intentos → «demasiados-intentos», sin contar el intento.
 *  3. Sin contraseña puesta → «credenciales».
 *  4. Contraseña mal → suma un fallo; al quinto, castigo de 15 minutos.
 *  5. Contraseña bien pero bloqueada o suprimida → «sin-acceso». Va DESPUÉS
 *     de la contraseña a propósito: un desconocido no puede saber si una
 *     cuenta está bloqueada probando correos.
 *  6. Bien → limpia contador y castigo.
 *
 * El castigo es por cuenta y no por IP: en Vercel la IP no es fiable, y lo
 * que hay que parar es el ataque a UNA cuenta.
 */
export async function intentarEntrar(
  email: string,
  contrasena: string,
  ahora: Date = new Date(),
): Promise<ResultadoEntrada> {
  const usuario = await prisma.user.findUnique({
    where: { email: normalizarCorreo(email) },
  });
  if (!usuario) {
    // Un correo inexistente tiene que costar lo mismo que uno real con la
    // contraseña mal: se compara igual contra el señuelo antes de contestar.
    await comprobarContrasena(contrasena, await SENUELO);
    return { ok: false, motivo: "credenciales" };
  }

  if (usuario.intentosBloqueadosHasta && usuario.intentosBloqueadosHasta > ahora) {
    return { ok: false, motivo: "demasiados-intentos" };
  }

  if (!usuario.contrasenaHash) {
    // Mismo motivo que arriba: a esta persona nunca le pusieron contraseña,
    // pero eso no se puede notar en el tiempo de respuesta.
    await comprobarContrasena(contrasena, await SENUELO);
    return { ok: false, motivo: "credenciales" };
  }

  if (!(await comprobarContrasena(contrasena, usuario.contrasenaHash))) {
    // El incremento lo hace la base, no este proceso: dos intentos a la vez
    // no pueden pisarse el contador. Si los dos llegan a MAX_INTENTOS, los
    // dos castigan; es inofensivo.
    const tras = await prisma.user.update({
      where: { id: usuario.id },
      data: { intentosFallidos: { increment: 1 } },
      select: { intentosFallidos: true },
    });
    if (tras.intentosFallidos >= MAX_INTENTOS) {
      await prisma.user.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: 0,
          intentosBloqueadosHasta: new Date(ahora.getTime() + MINUTOS_DE_CASTIGO * 60_000),
        },
      });
      return { ok: false, motivo: "demasiados-intentos" };
    }
    return { ok: false, motivo: "credenciales" };
  }

  if (estaBloqueado(usuario) || estaSuprimido(usuario)) {
    return { ok: false, motivo: "sin-acceso" };
  }

  const limpio =
    usuario.intentosFallidos === 0 && usuario.intentosBloqueadosHasta === null
      ? usuario
      : await prisma.user.update({
          where: { id: usuario.id },
          data: { intentosFallidos: 0, intentosBloqueadosHasta: null },
        });

  return { ok: true, usuario: limpio };
}

/**
 * Contraseña puesta desde fuera (profesor o script). Devuelve la contraseña
 * en claro: es la única vez que existe fuera del hash. Cierra las sesiones
 * que hubiera: quien la tenía abierta en otro sitio se queda fuera.
 */
export async function ponerContrasenaNueva(usuarioId: string): Promise<string> {
  const clara = generarContrasena();
  const contrasenaHash = await cifrarContrasena(clara);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuarioId },
      data: {
        contrasenaHash,
        debeCambiarContrasena: true,
        intentosFallidos: 0,
        intentosBloqueadosHasta: null,
      },
    }),
    prisma.sesion.deleteMany({ where: { usuarioId } }),
  ]);
  return clara;
}

/** La contraseña que elige el propio usuario. No toca las sesiones: eso lo decide la acción. */
export async function guardarContrasena(usuarioId: string, texto: string): Promise<void> {
  await prisma.user.update({
    where: { id: usuarioId },
    data: {
      contrasenaHash: await cifrarContrasena(texto),
      debeCambiarContrasena: false,
      intentosFallidos: 0,
      intentosBloqueadosHasta: null,
    },
  });
}
