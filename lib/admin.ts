import { getUsuarioActual } from "@/lib/usuario";
import { esAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/** Gemelo de `exigirProfesor`, un escalon por encima. */
export async function exigirAdmin() {
  const usuario = await getUsuarioActual();
  if (!esAdmin(usuario)) {
    throw new Error("Solo un administrador puede hacer esto.");
  }
  return usuario!;
}

/**
 * Si quitarle el rol a este administrador dejaria la plataforma sin
 * ninguno, la respuesta es no. Vive aqui y no dentro de la accion porque
 * una accion de servidor no se puede llamar desde un script de verificacion.
 */
export async function puedeQuitarseElRol(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true },
  });
  if (!usuario) return false;
  if (usuario.role !== "ADMIN") return true;

  const cuantos = await prisma.user.count({ where: { role: "ADMIN" } });
  return cuantos > 1;
}

/**
 * Si bloquear a esta persona es mala idea, el motivo; si no, null.
 *
 * Las dos negativas son las mismas que protegen a `quitarProfesor`, y por el
 * mismo motivo: sin ellas un clic te deja fuera de tu propia aplicación y
 * solo se arregla entrando a la base a mano. ADMIN_EMAILS no es red aquí,
 * porque esa variable sube el rol pero no abre la puerta.
 */
export async function puedeBloquearse(
  usuarioId: string,
  yoId: string,
): Promise<string | null> {
  if (usuarioId === yoId) return "No puedes bloquearte a ti mismo.";

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true, bloqueadoEl: true },
  });
  if (!usuario) return "Esa persona no existe.";
  if (usuario.role !== "ADMIN") return null;

  // Solo cuentan los administradores que pueden entrar de verdad.
  const cuantos = await prisma.user.count({
    where: { role: "ADMIN", bloqueadoEl: null },
  });
  if (cuantos <= 1 && !usuario.bloqueadoEl) {
    return "No puedes bloquear al último administrador.";
  }
  return null;
}

/**
 * Cierra el acceso y anula lo que esa persona ya no va a poder hacer.
 *
 * Se anulan las clases futuras donde es el estudiante o el profesor, porque
 * ninguna de las dos se va a dar. No se tocan las de un grupo donde solo es
 * un miembro más: esa clase sigue siendo de los demás.
 */
export async function bloquear(usuarioId: string): Promise<void> {
  const ahora = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuarioId },
      data: { bloqueadoEl: ahora },
    }),
    prisma.clase.updateMany({
      where: {
        estado: "AGENDADA",
        empiezaEl: { gte: ahora },
        OR: [{ estudianteId: usuarioId }, { profesorId: usuarioId }],
      },
      data: { estado: "ANULADA" },
    }),
  ]);
}

/**
 * Devuelve el acceso. No resucita las clases anuladas: anularlas fue una
 * decisión, y deshacerla a espaldas del profesor sería peor que dejársela.
 */
export async function desbloquear(usuarioId: string): Promise<void> {
  await prisma.user.update({
    where: { id: usuarioId },
    data: { bloqueadoEl: null },
  });
}
