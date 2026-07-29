import { getUsuarioActual } from "@/lib/usuario";

/**
 * Gemelo de `exigirAdmin`, un escalón por debajo. Vive aquí y no en
 * `lib/acciones.ts` porque ahora la necesitan dos archivos de acciones.
 */
export async function exigirProfesor() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    throw new Error("Solo un profesor puede hacer esto.");
  }
  return usuario;
}
