import { getUsuarioActual } from "@/lib/usuario";
import { esAdmin } from "@/lib/roles";

/** Gemelo de `exigirProfesor`, un escalon por encima. */
export async function exigirAdmin() {
  const usuario = await getUsuarioActual();
  if (!esAdmin(usuario)) {
    throw new Error("Solo un administrador puede hacer esto.");
  }
  return usuario!;
}
