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
