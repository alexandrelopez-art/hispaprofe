"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { exigirProfesor } from "@/lib/profesor";
import { esAdmin } from "@/lib/roles";
import { comprobarContrasena, validarContrasena } from "@/lib/contrasena";
import {
  guardarContrasena,
  intentarEntrar,
  ponerContrasenaNueva,
  type MotivoRechazo,
} from "@/lib/entrada";
import {
  abrirSesion,
  cerrarSesion,
  cerrarSesionesDe,
  tokenDeLaCookie,
} from "@/lib/sesion";

const TEXTO_DEL_MOTIVO: Record<MotivoRechazo, string> = {
  credenciales: "Correo o contraseña incorrectos.",
  "demasiados-intentos": "Demasiados intentos seguidos. Espera 15 minutos y vuelve a probar.",
  "sin-acceso": "Tu acceso está cerrado. Habla con tu profe si crees que es un error.",
};

/** Solo rutas de esta casa: nada que empiece por `//` o por otro dominio. */
function destinoSeguro(volver: string | null): string {
  if (!volver || !volver.startsWith("/") || volver.startsWith("//")) return "/dashboard";
  return volver;
}

export type EstadoEntrada = { error?: string };

export async function entrar(
  _prev: EstadoEntrada,
  formData: FormData,
): Promise<EstadoEntrada> {
  const email = String(formData.get("email") ?? "");
  const contrasena = String(formData.get("contrasena") ?? "");
  const volver = formData.get("volver");

  const resultado = await intentarEntrar(email, contrasena);
  if (!resultado.ok) return { error: TEXTO_DEL_MOTIVO[resultado.motivo] };

  await abrirSesion(resultado.usuario.id);
  redirect(
    resultado.usuario.debeCambiarContrasena
      ? "/cuenta/contrasena"
      : destinoSeguro(typeof volver === "string" ? volver : null),
  );
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  redirect("/");
}

export type EstadoContrasena = { error?: string; hecho?: boolean };

/**
 * La actual se pide salvo si acaba de recibirla del profesor: ya la
 * escribió al entrar hace un momento. Al cambiarla se cierran las OTRAS
 * sesiones; esta sigue viva.
 */
export async function cambiarMiContrasena(
  _prev: EstadoContrasena,
  formData: FormData,
): Promise<EstadoContrasena> {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");

  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const repetida = String(formData.get("repetida") ?? "");

  if (!usuario.debeCambiarContrasena) {
    if (!usuario.contrasenaHash || !(await comprobarContrasena(actual, usuario.contrasenaHash))) {
      return { error: "La contraseña actual no es correcta." };
    }
  }
  const motivo = validarContrasena(nueva);
  if (motivo) return { error: motivo };
  if (nueva !== repetida) return { error: "Las dos contraseñas no coinciden." };

  await guardarContrasena(usuario.id, nueva);
  const token = await tokenDeLaCookie();
  await cerrarSesionesDe(usuario.id, token ?? undefined);
  return { hecho: true };
}

export type EstadoNuevaContrasena = { error?: string; contrasena?: string };

/**
 * Un profesor solo a estudiantes; a un profesor o administrador, solo un
 * administrador; a uno mismo, nadie (para eso está cambiarMiContrasena).
 */
export async function ponerContrasenaAEstudiante(
  _prev: EstadoNuevaContrasena,
  formData: FormData,
): Promise<EstadoNuevaContrasena> {
  const yo = await exigirProfesor();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  const objetivo = await prisma.user.findUnique({ where: { id: usuarioId } });
  if (!objetivo) return { error: "Esa ficha no existe." };
  if (objetivo.id === yo.id) return { error: "La tuya la cambias desde Mi cuenta." };
  if (objetivo.role !== "STUDENT" && !esAdmin(yo)) {
    return { error: "Solo un administrador puede poner contraseña a un profesor." };
  }
  if (objetivo.suprimidoEl) return { error: "Esta ficha está suprimida." };

  const contrasena = await ponerContrasenaNueva(objetivo.id);
  return { contrasena };
}
