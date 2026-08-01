"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { exigirProfesor } from "@/lib/profesor";
import {
  analizarExpresion,
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

  refrescar(pasoId);
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
  await exigirProfesor();

  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  const comentario = String(formData.get("comentario") ?? "").trim();
  if (!asignacionId || !pasoId) return { error: "Falta el alumno o el paso." };

  const vinculo = await prisma.pasoEjercicio.findFirst({
    where: { pasoId },
    orderBy: { orden: "asc" },
    select: { ejercicio: { select: { datos: true } } },
  });
  const datos = vinculo ? analizarExpresion(vinculo.ejercicio.datos) : null;
  if (!datos) return { error: "Este paso no tiene una tarea de expresión." };

  // Las notas llegan como `nota-<criterioId>`, una por criterio.
  const notas: Record<string, number> = {};
  for (const criterio of datos.criterios) {
    const bruto = String(formData.get(`nota-${criterio.id}`) ?? "").trim();
    if (bruto !== "") notas[criterio.id] = Number(bruto);
  }

  const motivo = puedeValorarse(datos, notas);
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

  await prisma.citaOral.upsert({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    update: { claseId },
    create: { asignacionId, pasoId, claseId },
  });

  revalidatePath(`/profe/clases/${claseId}`);
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

  // `deleteMany` y no `delete`: quitar una cita que otra pestaña ya quitó no
  // es un error, y `delete` reventaría con un P2025 sin capturar.
  await prisma.citaOral.deleteMany({ where: { asignacionId, pasoId } });

  revalidatePath("/profe/clases");
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (asignacion) revalidatePath(`/profe/alumnos/${asignacion.estudianteId}`);
  return { ok: "Cita quitada." };
}
