"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { abrirPractica } from "@/lib/catalogo-preparacion";
import { bloquePorNombre } from "@/lib/preparacion";
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

  // De dónde vino: se valida contra la tabla de bloques, así que un campo
  // manipulado solo puede apuntar a una de las cuatro páginas que existen.
  const bloque = bloquePorNombre(String(formData.get("bloque") ?? ""));
  const vuelta = bloque ? `/dele/${bloque.nombre}` : "/dele";

  const resultado = await abrirPractica(usuario.id, recorridoId);

  // Llegar aquí con un motivo no es una petición manipulada: la página se
  // pintó con el grupo activo y la secuencia publicada, y entre eso y el clic
  // el profe archivó el grupo o despublicó la secuencia. Lanzar le daba al
  // alumno la pantalla de error de Next, sin el motivo siquiera —en
  // producción Next redacta los errores de acción—, así que se le devuelve a
  // su bloque, que recalcula y pinta la razón donde estaba el botón. Si lo que
  // pasó es que se despublicó, la tarjeta ya no está: el catálogo solo lista
  // lo publicado.
  //
  // `redirect` sale lanzando una excepción de control, así que va fuera de
  // cualquier try/catch.
  if ("error" in resultado) {
    revalidatePath(vuelta);
    redirect(vuelta);
  }

  revalidatePath("/dele");
  revalidatePath("/dashboard");
  redirect(`/recorridos/${recorridoId}`);
}
