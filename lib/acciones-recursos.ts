"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { analizar } from "@/lib/ejercicios/registro";
import { opcionSchema } from "@/lib/ejercicios/opcion";
import { huecosSchema } from "@/lib/ejercicios/huecos";
import { relacionarSchema } from "@/lib/ejercicios/relacionar";
import { ordenarSchema } from "@/lib/ejercicios/ordenar";
import {
  duplicar,
  puedeBorrarse,
  puedeDesengancharse,
  puedeEditarse,
  puedeEngancharse,
  tipoDeEjercicio,
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
 * `analizar`, que es el mismo portero que valida lo que siembra un script y
 * lo que responde un estudiante.
 */
export async function guardarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  const usuario = await exigirProfesor();

  const id = String(formData.get("id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const nivel = String(formData.get("nivel") ?? "") as Nivel;
  const destrezaBruta = String(formData.get("destreza") ?? "");
  const destreza = destrezaBruta ? (destrezaBruta as Destreza) : null;
  const etiquetas = String(formData.get("etiquetas") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!titulo) return { error: "Ponle un título." };
  if (!nivel) return { error: "Elige un nivel." };

  let datos: unknown;
  try {
    datos = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return { error: "El contenido del ejercicio no se pudo leer." };
  }

  // El mensaje del rechazo lo escribe el esquema del motor, en castellano y
  // explicando el porqué. No se redacta otro aquí.
  const analizado = analizar(datos);
  if (!analizado) {
    return { error: motivoDeZod(datos) };
  }

  const tipo = tipoDeEjercicio(datos)!;

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

/**
 * El motivo que da el esquema, tal cual lo escribió.
 *
 * `analizar` devuelve `null` a secas —le basta con saber que no vale—, así
 * que para enseñar el porqué hay que volver a parsear con el esquema que
 * toque. Merece la pena: esos mensajes ya están redactados en castellano y
 * explican la razón («Las marcas {{...}} del texto no coinciden con los ids
 * de `huecos`»), que es justo lo que un editor necesita decir.
 */
const ESQUEMAS = {
  opcion: opcionSchema,
  huecos: huecosSchema,
  relacionar: relacionarSchema,
  ordenar: ordenarSchema,
} as const;

function motivoDeZod(datos: unknown): string {
  const marca = (datos as { ejercicio?: unknown } | null)?.ejercicio;
  if (typeof marca !== "string" || !(marca in ESQUEMAS)) {
    return "Al ejercicio le falta el tipo. Vuelve a elegirlo.";
  }

  const r = ESQUEMAS[marca as keyof typeof ESQUEMAS].safeParse(datos);
  if (r.success) return "El ejercicio no se pudo guardar.";

  // El primero basta: arreglado ese, al volver a guardar sale el siguiente.
  const primero = r.error.issues[0];
  const donde = primero.path.length > 0 ? ` (${primero.path.join(" → ")})` : "";
  return `${primero.message}${donde}`;
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
  if (!analizar(fila.datos)) {
    return { error: "Está incompleto. Termínalo antes de publicarlo." };
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

  const cuantos = await prisma.pasoEjercicio.count({ where: { ejercicioId: id } });
  if (cuantos > 0) {
    return { error: "Cuelga de un paso. Quítalo de ahí antes de volverlo a borrador." };
  }

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
