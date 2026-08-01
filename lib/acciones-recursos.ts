"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import {
  duplicar,
  puedeBorrarse,
  puedeDesengancharse,
  puedeDespublicarse,
  puedeEditarse,
  puedeEngancharse,
  revisarDatos,
} from "@/lib/recursos";

/**
 * Lo que devuelven todas las acciones de Recursos.
 *
 * Devuelven motivo y no `void` a propósito, y solo aquí: un editor que se
 * traga un error sin decir nada es inusable, porque te quedas mirando la
 * pantalla sin saber si guardó. El resto de la aplicación sigue como está;
 * esta decisión no se extiende sola.
 */
export type EstadoRecurso = {
  /** El motivo del rechazo, para enseñarlo tal cual. */
  error?: string;
  /** Confirmación corta para enseñar. Nunca un identificador. */
  ok?: string;
  /**
   * La fila a la que hay que ir después: la recién creada al guardar, o la
   * copia al duplicar. Va en su propio campo y no dentro de `ok` porque son
   * dos cosas distintas —una se enseña, la otra se navega— y meterlas en la
   * misma clave acaba con un cuid pintado en pantalla el día que alguien
   * renderice la confirmación.
   */
  id?: string;
};

function refrescar(ejercicioId?: string) {
  revalidatePath("/profe/recursos");
  if (ejercicioId) revalidatePath(`/profe/recursos/${ejercicioId}`);
}

/**
 * Crea o actualiza un ejercicio. El `datos` no se guarda sin pasar por
 * `revisarDatos`, que pregunta a los dos porteros: `analizar`, el mismo que
 * valida lo que siembra un script y lo que responde un estudiante, y
 * `analizarExpresion`, que es hermano suyo y no miembro.
 */
export async function guardarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  const usuario = await exigirProfesor();

  const id = String(formData.get("id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const nivelBruto = String(formData.get("nivel") ?? "");
  const destrezaBruta = String(formData.get("destreza") ?? "");
  const etiquetas = String(formData.get("etiquetas") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!titulo) return { error: "Ponle un título." };
  if (!nivelBruto) return { error: "Elige un nivel." };
  // Contra las claves del enum generado, no una lista escrita a mano: así no
  // hay dos sitios que se puedan quedar desfasados si el enum cambia.
  if (!Object.hasOwn(Nivel, nivelBruto)) return { error: "Ese nivel no existe." };
  // `destreza` vacía significa «ninguna» y es válida; solo se rechaza una
  // cadena no vacía que no sea uno de los valores del enum.
  if (destrezaBruta && !Object.hasOwn(Destreza, destrezaBruta)) {
    return { error: "Esa destreza no existe." };
  }
  const nivel = nivelBruto as Nivel;
  const destreza = destrezaBruta ? (destrezaBruta as Destreza) : null;

  let datos: unknown;
  try {
    datos = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return { error: "El contenido del ejercicio no se pudo leer." };
  }

  // El mensaje del rechazo lo escribe el esquema, en castellano y explicando
  // el porqué. No se redacta otro aquí. `revisarDatos` pregunta a los dos
  // porteros —el motor y la expresión—, que es lo que hacía falta para que
  // una tarea de expresión se pudiera guardar.
  const revision = revisarDatos(datos);
  if ("error" in revision) return { error: revision.error };
  const tipo = revision.tipo;

  if (id) {
    const motivo = await puedeEditarse(id);
    if (motivo) return { error: motivo };

    await prisma.ejercicio.update({
      where: { id },
      data: {
        tipo,
        titulo,
        nivel,
        destreza,
        etiquetas,
        datos: datos as Prisma.InputJsonValue,
      },
    });
    refrescar(id);
    return { ok: "Guardado." };
  }

  const creado = await prisma.ejercicio.create({
    data: {
      tipo,
      titulo,
      nivel,
      destreza,
      etiquetas,
      datos: datos as Prisma.InputJsonValue,
      publicado: false,
      autorId: usuario.id,
    },
  });
  refrescar(creado.id);
  return { ok: "Creado.", id: creado.id };
}

export async function publicarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const fila = await prisma.ejercicio.findUnique({
    where: { id },
    select: { datos: true },
  });
  if (!fila) return { error: "Ese ejercicio no existe." };
  // El mismo portero que al guardar: si aquí solo preguntara al motor, una
  // expresión terminada nunca llegaría a `publicado: true` y el selector del
  // paso, que filtra por esa columna, no la ofrecería jamás.
  const revision = revisarDatos(fila.datos);
  if ("error" in revision) {
    return { error: `Está incompleto. ${revision.error}` };
  }

  await prisma.ejercicio.update({ where: { id }, data: { publicado: true } });
  refrescar(id);
  return { ok: "Publicado." };
}

/**
 * Vuelve a borrador. Solo si no cuelga de ningún paso: si colgara, el
 * estudiante que lo tiene delante se quedaría con un ejercicio que la
 * aplicación considera a medio escribir.
 */
export async function despublicarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const motivo = await puedeDespublicarse(id);
  if (motivo) return { error: motivo };

  await prisma.ejercicio.update({ where: { id }, data: { publicado: false } });
  refrescar(id);
  return { ok: "Vuelto a borrador." };
}

export async function duplicarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const copiaId = await duplicar(id);
  if (!copiaId) return { error: "Ese ejercicio no existe." };

  refrescar(copiaId);
  return { ok: "Duplicado.", id: copiaId };
}

export async function borrarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const motivo = await puedeBorrarse(id);
  if (motivo) return { error: motivo };

  await prisma.ejercicio.delete({ where: { id } });
  refrescar();
  return { ok: "Borrado." };
}

export async function engancharEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const ejercicioId = String(formData.get("ejercicioId") ?? "");
  if (!pasoId || !ejercicioId) return { error: "Falta el paso o el ejercicio." };

  const motivo = await puedeEngancharse(ejercicioId, pasoId);
  if (motivo) return { error: motivo };

  await prisma.pasoEjercicio.create({ data: { pasoId, ejercicioId, orden: 1 } });

  revalidatePath(`/pasos/${pasoId}`);
  refrescar(ejercicioId);
  return { ok: "Enganchado." };
}

export async function desengancharEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  if (!pasoId) return { error: "Falta el paso." };

  const motivo = await puedeDesengancharse(pasoId);
  if (motivo) return { error: motivo };

  await prisma.pasoEjercicio.deleteMany({ where: { pasoId } });

  revalidatePath(`/pasos/${pasoId}`);
  refrescar();
  return { ok: "Quitado." };
}
