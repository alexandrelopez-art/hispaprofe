"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { exigirProfesor } from "@/lib/profesor";
import {
  esDeEsteProfesor,
  expresionDelPaso,
  puedeEntregar,
  puedeValorarse,
  puntosDe,
} from "@/lib/expresion";
import { puedeCitarse } from "@/lib/citas";

export type EstadoExpresion = { error?: string; ok?: string };

/** Lo que hay que releer tras tocar una entrega o una valoración. */
function refrescar(pasoId: string, estudianteId?: string) {
  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath("/profe/entregas");
  revalidatePath("/dashboard");
  if (estudianteId) revalidatePath(`/profe/alumnos/${estudianteId}`);
}

/**
 * El alumno entrega o reescribe su texto.
 *
 * Quién puede y hasta cuándo lo decide `puedeEntregar`, que vive fuera para
 * que el script lo ejercite. Aquí solo se comprueba la sesión y se escribe.
 */
export async function entregar(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "No hay sesión." };

  const pasoId = String(formData.get("pasoId") ?? "");
  const texto = String(formData.get("texto") ?? "").trim();
  if (!pasoId) return { error: "Falta el paso." };
  if (!texto) return { error: "No has escrito nada." };

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return { error: "Ese paso no existe." };

  const asignacion = await prisma.asignacion.findUnique({
    where: {
      estudianteId_recorridoId: {
        estudianteId: usuario.id,
        recorridoId: paso.recorridoId,
      },
    },
    select: { id: true, archivada: true },
  });
  if (!asignacion || asignacion.archivada) return { error: "No tienes este recorrido asignado." };

  const motivo = await puedeEntregar(asignacion.id, pasoId);
  if (motivo) return { error: motivo };

  await prisma.pasoCompletado.upsert({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId } },
    update: { entrega: texto },
    create: { asignacionId: asignacion.id, pasoId, entrega: texto },
  });

  // Con el id del alumno: es la ficha desde la que el profesor corrige, y
  // sin refrescarla seguiría enseñando la entrega anterior.
  refrescar(pasoId, usuario.id);
  return { ok: "Entregado." };
}

/**
 * El profesor rellena la rúbrica.
 *
 * Escribe `puntos` y `verificadoEl` igual que `otorgarPuntos`, para que todo
 * lo que ya cuenta puntos —la hucha, el progreso, el panel— siga funcionando
 * sin enterarse de que existe un tipo nuevo.
 */
export async function valorar(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  const usuario = await exigirProfesor();

  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  const comentario = String(formData.get("comentario") ?? "").trim();
  if (!asignacionId || !pasoId) return { error: "Falta el alumno o el paso." };

  // Una acción de servidor es un endpoint público: la pantalla que la llama
  // ya filtra por profesor, pero eso no impide que alguien mande el
  // `asignacionId` de otro directamente. Un administrador se lo salta, igual
  // que en las páginas de `profe/`.
  if (usuario.role !== "ADMIN" && !(await esDeEsteProfesor(asignacionId, usuario.id))) {
    return { error: "Esa asignación no es tuya." };
  }

  const datos = await expresionDelPaso(pasoId);
  if (!datos) return { error: "Este paso no tiene una tarea de expresión." };

  // Las notas llegan como `nota-<criterioId>`, una por criterio.
  const notas: Record<string, number> = {};
  for (const criterio of datos.criterios) {
    const bruto = String(formData.get(`nota-${criterio.id}`) ?? "").trim();
    if (bruto !== "") notas[criterio.id] = Number(bruto);
  }

  // Hace falta la entrega ya guardada para que `puedeValorarse` pueda negar
  // una escrita sin texto: sin esto se podía corregir antes de que el
  // alumno escribiera nada.
  const previo = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { entrega: true },
  });

  const motivo = puedeValorarse(datos, notas, previo?.entrega ?? null);
  if (motivo) return { error: motivo };

  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return { error: "Esa asignación no existe." };

  await prisma.pasoCompletado.upsert({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    update: {
      valoracion: { notas, comentario } as Prisma.InputJsonValue,
      puntos: puntosDe(datos, notas),
      verificadoEl: new Date(),
    },
    create: {
      asignacionId,
      pasoId,
      valoracion: { notas, comentario } as Prisma.InputJsonValue,
      puntos: puntosDe(datos, notas),
      verificadoEl: new Date(),
    },
  });

  refrescar(pasoId, asignacion.estudianteId);
  return { ok: "Corregido." };
}

export async function citarOral(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  await exigirProfesor();

  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  const claseId = String(formData.get("claseId") ?? "");
  if (!asignacionId || !pasoId || !claseId) return { error: "Falta el alumno, el paso o la clase." };

  const motivo = await puedeCitarse(asignacionId, claseId);
  if (motivo) return { error: motivo };

  // La clase de la que se recita, si había una: al mover la cita deja de
  // llevar este oral, y sin revalidarla también se quedaría enseñando uno
  // que ya no está ahí.
  const anterior = await prisma.citaOral.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { claseId: true },
  });

  await prisma.citaOral.upsert({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    update: { claseId },
    create: { asignacionId, pasoId, claseId },
  });

  revalidatePath(`/profe/clases/${claseId}`);
  if (anterior && anterior.claseId !== claseId) {
    revalidatePath(`/profe/clases/${anterior.claseId}`);
  }
  revalidatePath("/profe/clases");
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (asignacion) revalidatePath(`/profe/alumnos/${asignacion.estudianteId}`);
  return { ok: "Citado." };
}

export async function descitarOral(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  await exigirProfesor();

  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  if (!asignacionId || !pasoId) return { error: "Falta el alumno o el paso." };

  // `deleteMany` no devuelve la fila que borra: sin leerla antes no habría
  // forma de saber qué clase dejó de llevar este oral y revalidarla.
  const cita = await prisma.citaOral.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { claseId: true },
  });

  // `deleteMany` y no `delete`: quitar una cita que otra pestaña ya quitó no
  // es un error, y `delete` reventaría con un P2025 sin capturar.
  await prisma.citaOral.deleteMany({ where: { asignacionId, pasoId } });

  if (cita) revalidatePath(`/profe/clases/${cita.claseId}`);
  revalidatePath("/profe/clases");
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (asignacion) revalidatePath(`/profe/alumnos/${asignacion.estudianteId}`);
  return { ok: "Cita quitada." };
}
