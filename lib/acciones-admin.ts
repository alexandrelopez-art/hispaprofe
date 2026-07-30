"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  bloquear,
  desbloquear,
  exigirAdmin,
  puedeBloquearse,
  puedeQuitarseElRol,
  puedeSuprimirse,
  suprimir,
} from "@/lib/admin";

function refrescar() {
  revalidatePath("/admin/personas");
  revalidatePath("/profe/alumnos");
  revalidatePath("/profe/clases");
  revalidatePath("/dashboard");
}

/** Sube a alguien a profesor. Un administrador no baja de rango por esto. */
export async function hacerProfesor(formData: FormData) {
  await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId) return;

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true },
  });
  if (!usuario || usuario.role === "ADMIN") return;

  await prisma.user.update({ where: { id: usuarioId }, data: { role: "PROFESOR" } });

  refrescar();
}

/**
 * Devuelve a alguien a estudiante. Dos negativas: nadie puede quitarse el
 * rol a sí mismo, y no se puede dejar la plataforma sin administradores.
 */
export async function quitarProfesor(formData: FormData) {
  const yo = await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId || usuarioId === yo.id) return;

  if (!(await puedeQuitarseElRol(usuarioId))) return;

  await prisma.user.update({ where: { id: usuarioId }, data: { role: "STUDENT" } });

  refrescar();
}

/**
 * Invita a un profesor por correo. Si ya tiene ficha se le sube el rol en
 * vez de crear una segunda con el mismo correo; si no la tiene, nace ya
 * como profesor y se la encuentra hecha al entrar por primera vez.
 */
export async function invitarProfesor(formData: FormData) {
  await exigirAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

  const existente = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  // A un administrador no se le baja a profesor por invitarlo otra vez.
  if (existente?.role === "ADMIN") return;

  await prisma.user.upsert({
    where: { email },
    update: { role: "PROFESOR" },
    create: { email, role: "PROFESOR" },
  });

  refrescar();
}

/**
 * Cierra el acceso. La guarda es `puedeBloquearse` y no una comprobación
 * escrita aquí porque desde una acción de servidor no se puede verificar
 * nada: lo que decide vive en `lib/admin.ts`, que sí ejercita el script.
 */
export async function bloquearPersona(formData: FormData) {
  const yo = await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId) return;

  if (await puedeBloquearse(usuarioId, yo.id)) return;

  await bloquear(usuarioId);
  refrescar();
}

/**
 * Devuelve el acceso. La guarda va dentro de `desbloquear`, en la misma
 * escritura, porque el caso real es tener la lista abierta en dos pestañas y
 * pulsar aquí un botón que en la otra ya no existe. Se refresca haya escrito
 * o no: si se negó, es justo esa pestaña vieja la que hay que poner al día.
 */
export async function desbloquearPersona(formData: FormData) {
  await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId) return;

  await desbloquear(usuarioId);
  refrescar();
}

/**
 * Suprime una ficha. Además de las salvaguardas de `puedeSuprimirse`, exige
 * que el correo escrito a mano coincida: obliga a mirar a quién se está
 * suprimiendo antes de un gesto que no se puede deshacer.
 */
export async function suprimirPersona(formData: FormData) {
  const yo = await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "").trim().toLowerCase();
  if (!usuarioId) return;

  if (await puedeSuprimirse(usuarioId, yo.id)) return;

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { email: true },
  });
  if (!usuario || usuario.email.toLowerCase() !== confirmacion) return;

  await suprimir(usuarioId);
  refrescar();
}
