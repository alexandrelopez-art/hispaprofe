import { prisma } from "@/lib/prisma";
import { asignarA } from "@/lib/acciones";
import { examenDe, type ExamenCompleto } from "@/lib/taller/consultas";

type ImagenPedida = { archivoId: string | null };

/** Por qué no se puede publicar todavía. Vacío = se puede. */
export function motivosParaNoPublicar(examen: ExamenCompleto): string[] {
  const motivos: string[] = [];
  const sinRevisar = examen.tareas.filter((t) => t.estado !== "REVISADA").length;
  if (sinRevisar) motivos.push(`${sinRevisar} tarea(s) sin revisar.`);
  const pendientes = examen.tareas.reduce(
    (n, t) => n + (((t.imagenesPedidas as ImagenPedida[] | null) ?? []).filter((i) => !i.archivoId).length), 0);
  if (pendientes) motivos.push(`${pendientes} imagen(es) por subir.`);
  const sinGrabacion = examen.tareas.filter((t) => t.prueba === "CO" && !t.grabacionArchivoId).length;
  if (sinGrabacion) motivos.push(`${sinGrabacion} tarea(s) auditiva(s) sin grabación.`);
  return motivos;
}

export async function publicarExamen(id: string): Promise<{ ok: true } | { ok: false; motivos: string[] }> {
  const examen = await examenDe(id);
  if (!examen) return { ok: false, motivos: ["Ese examen ya no existe."] };
  const motivos = motivosParaNoPublicar(examen);
  if (motivos.length) return { ok: false, motivos };
  const pasoIds = examen.tareas.map((t) => t.pasoId);
  await prisma.$transaction(async (tx) => {
    await tx.recorrido.updateMany({ where: { id: { in: [examen.lecturaId, examen.auditivaId] } }, data: { publicado: true, orden: examen.bloque } });
    const enganches = await tx.pasoEjercicio.findMany({ where: { pasoId: { in: pasoIds } }, select: { ejercicioId: true } });
    await tx.ejercicio.updateMany({ where: { id: { in: enganches.map((e) => e.ejercicioId) } }, data: { publicado: true } });
    await tx.examen.update({ where: { id }, data: { estado: "PUBLICADO" } });
  });
  return { ok: true };
}

/** Despublica sin borrar nada: las asignaciones vivas se conservan. */
export async function retirarExamen(id: string): Promise<void> {
  const examen = await prisma.examen.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    prisma.recorrido.updateMany({ where: { id: { in: [examen.lecturaId, examen.auditivaId] } }, data: { publicado: false } }),
    prisma.examen.update({ where: { id }, data: { estado: "EN_CONSTRUCCION" } }),
  ]);
}

export async function archivarExamen(id: string): Promise<void> {
  const examen = await prisma.examen.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    prisma.recorrido.updateMany({ where: { id: { in: [examen.lecturaId, examen.auditivaId] } }, data: { publicado: false } }),
    prisma.examen.update({ where: { id }, data: { estado: "ARCHIVADO" } }),
  ]);
}

export type Destino = { tipo: "grupo"; id: string } | { tipo: "alumno"; id: string };

export function partirDestino(bruto: string): Destino | null {
  const [tipo, id] = bruto.split(":");
  if ((tipo === "grupo" || tipo === "alumno") && id) return { tipo, id };
  return null;
}

/** Asigna las dos secuencias del examen a un grupo o a un particular, con fecha. */
export async function asignarExamen(id: string, destino: Destino, profesorId: string, venceEl: Date | null): Promise<{ ok: true; cuantos: number } | { ok: false; error: string }> {
  const examen = await prisma.examen.findUnique({ where: { id } });
  if (!examen) return { ok: false, error: "Ese examen ya no existe." };
  const estudianteIds =
    destino.tipo === "grupo"
      ? (await prisma.miembroGrupo.findMany({ where: { grupoId: destino.id }, select: { estudianteId: true } })).map((m) => m.estudianteId)
      : [destino.id];
  if (estudianteIds.length === 0) return { ok: false, error: "Ese grupo no tiene estudiantes." };
  for (const recorridoId of [examen.lecturaId, examen.auditivaId]) {
    await asignarA(estudianteIds, recorridoId, profesorId, "", venceEl);
  }
  return { ok: true, cuantos: estudianteIds.length };
}
