"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import {
  abrirDeber,
  cerrarDeber,
  cerrarDeberesDeClase,
  importeDeClase,
  sincronizarDeberes,
  validarClase,
} from "@/lib/clases";
import type { EstadoClase } from "@/lib/generated/prisma/enums";

/** Parte «alumno:abc» o «grupo:xyz» en lo que entiende la base. */
function partirDestinatario(bruto: string): {
  estudianteId: string | null;
  grupoId: string | null;
} {
  const [clase, id] = bruto.split(":");
  if (clase === "alumno" && id) return { estudianteId: id, grupoId: null };
  if (clase === "grupo" && id) return { estudianteId: null, grupoId: id };
  return { estudianteId: null, grupoId: null };
}

/**
 * La clase existe y es de quien pide, o es un administrador. Devuelve la
 * clase para no volver a leerla.
 */
async function exigirClaseSuya(claseId: string) {
  const usuario = await exigirProfesor();
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      id: true,
      profesorId: true,
      minutos: true,
      estudianteId: true,
      grupoId: true,
      importeCentimos: true,
    },
  });
  if (!clase) throw new Error("Esa clase no existe.");
  if (clase.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    throw new Error("Esa clase no es tuya.");
  }
  return clase;
}

/**
 * La tarifa que aplica a una clase: la del estudiante, o la del grupo. Null
 * si nadie la tiene puesta, que es un olvido y no una clase gratis.
 */
async function tarifaDe(
  estudianteId: string | null,
  grupoId: string | null,
): Promise<number | null> {
  if (estudianteId) {
    const u = await prisma.user.findUnique({
      where: { id: estudianteId },
      select: { tarifaCentimos: true },
    });
    return u?.tarifaCentimos ?? null;
  }
  if (grupoId) {
    const g = await prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { tarifaCentimos: true },
    });
    return g?.tarifaCentimos ?? null;
  }
  return null;
}

function refrescar(claseId?: string) {
  revalidatePath("/profe/clases");
  if (claseId) revalidatePath(`/profe/clases/${claseId}`);
  revalidatePath("/dashboard");
}

export async function crearClase(formData: FormData) {
  const usuario = await exigirProfesor();

  const empiezaEl = new Date(String(formData.get("empiezaEl") ?? ""));
  const minutos = Number(String(formData.get("minutos") ?? "0"));
  const { estudianteId, grupoId } = partirDestinatario(
    String(formData.get("destinatario") ?? ""),
  );

  if (Number.isNaN(empiezaEl.getTime())) return;
  if (validarClase({ estudianteId, grupoId, minutos })) return;

  await prisma.clase.create({
    data: {
      profesorId: usuario.id,
      estudianteId,
      grupoId,
      empiezaEl,
      minutos,
      donde: String(formData.get("donde") ?? "").trim() || null,
      enlace: String(formData.get("enlace") ?? "").trim() || null,
    },
  });

  refrescar();
}

export async function editarClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  const empiezaEl = new Date(String(formData.get("empiezaEl") ?? ""));
  const minutos = Number(String(formData.get("minutos") ?? "0"));
  const { estudianteId, grupoId } = partirDestinatario(
    String(formData.get("destinatario") ?? ""),
  );

  if (Number.isNaN(empiezaEl.getTime())) return;
  if (validarClase({ estudianteId, grupoId, minutos })) return;

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      estudianteId,
      grupoId,
      empiezaEl,
      minutos,
      donde: String(formData.get("donde") ?? "").trim() || null,
      enlace: String(formData.get("enlace") ?? "").trim() || null,
    },
  });

  // Cambiar el destinatario cambia a quién le tocan los deberes.
  await sincronizarDeberes(claseId);

  refrescar(claseId);
}

/** Las notas privadas y el texto de los deberes. */
export async function guardarFicha(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      notas: String(formData.get("notas") ?? "").trim() || null,
      deberes: String(formData.get("deberes") ?? "").trim() || null,
    },
  });

  await sincronizarDeberes(claseId);

  refrescar(claseId);
}

/**
 * Agendada, dada o anulada. Al pasar a DADA se calcula el importe con la
 * tarifa de ahora y se queda congelado ahí; volver a marcarla dada no lo
 * recalcula, porque eso reescribiría el pasado.
 */
export async function cambiarEstadoClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoClase;
  if (!claseId) return;
  if (!["AGENDADA", "DADA", "ANULADA"].includes(estado)) return;

  const clase = await exigirClaseSuya(claseId);

  // Solo se calcula si no había importe. Recalcularlo reescribiría el pasado.
  const calcular = estado === "DADA" && clase.importeCentimos === null;
  const importeCentimos = calcular
    ? importeDeClase(
        await tarifaDe(clase.estudianteId, clase.grupoId),
        clase.minutos,
      )
    : undefined;

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      estado,
      ...(importeCentimos !== undefined ? { importeCentimos } : {}),
    },
  });

  refrescar(claseId);
}

export async function cerrarDeberDeClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const deberId = String(formData.get("deberId") ?? "");
  if (!claseId || !deberId) return;
  await exigirClaseSuya(claseId);

  await cerrarDeber(deberId);
  refrescar(claseId);
}

export async function abrirDeberDeClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const deberId = String(formData.get("deberId") ?? "");
  if (!claseId || !deberId) return;
  await exigirClaseSuya(claseId);

  await abrirDeber(deberId);
  refrescar(claseId);
}

export async function cerrarTodos(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  await cerrarDeberesDeClase(claseId);
  refrescar(claseId);
}
