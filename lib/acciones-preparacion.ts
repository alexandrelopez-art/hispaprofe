"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { abrirPractica } from "@/lib/catalogo-preparacion";
import { getUsuarioActual } from "@/lib/usuario";

/**
 * Gemelo de `exigirProfesor` un escalón por debajo, para el otro lado de la
 * casa. Del bloqueo no se ocupa: `getUsuarioActual` ya devuelve `null` para un
 * usuario bloqueado, así que un bloqueado cae por el mismo sitio que uno sin
 * sesión.
 */
async function exigirEstudiante() {
  const usuario = await getUsuarioActual();
  if (!usuario) throw new Error("Hay que entrar para empezar una práctica.");
  return usuario;
}

/**
 * El alumno se abre una práctica. Toda la decisión vive en `abrirPractica`,
 * que se puede verificar sin sesión; esto es la cáscara que la llama.
 */
export async function empezarPractica(formData: FormData) {
  const usuario = await exigirEstudiante();
  const recorridoId = String(formData.get("recorridoId") ?? "");
  if (!recorridoId) return;

  const resultado = await abrirPractica(usuario.id, recorridoId);

  // El motivo no se enseña desde aquí: la tarjeta ya lo sabe antes de pintar el
  // botón. Si se llega hasta aquí con un motivo, es que alguien ha mandado el
  // formulario a mano, y entonces lo que toca es parar.
  if ("error" in resultado) throw new Error(resultado.error);

  revalidatePath("/preparacion");
  revalidatePath("/dashboard");
  redirect(`/recorridos/${recorridoId}`);
}
