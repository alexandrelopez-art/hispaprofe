import { prisma } from "@/lib/prisma";

/**
 * Lo que cuesta una clase: la tarifa por hora repartida entre los minutos
 * que duró, redondeada al céntimo.
 *
 * Sin tarifa devuelve null y no cero: son cosas distintas. Cero es una
 * clase gratis a propósito; null es un olvido que hay que enseñar.
 */
export function importeDeClase(
  tarifaCentimos: number | null,
  minutos: number,
): number | null {
  if (tarifaCentimos === null || tarifaCentimos === undefined) return null;
  return Math.round((tarifaCentimos * minutos) / 60);
}

/**
 * Las dos reglas que la base no sabe imponer. Devuelve el motivo del
 * rechazo para poder enseñárselo al profesor, o null si la clase vale.
 */
export function validarClase(datos: {
  estudianteId?: string | null;
  grupoId?: string | null;
  minutos: number;
}): string | null {
  const tieneEstudiante = Boolean(datos.estudianteId);
  const tieneGrupo = Boolean(datos.grupoId);

  if (tieneEstudiante && tieneGrupo) {
    return "Una clase es de un estudiante o de un grupo, no de los dos.";
  }
  if (!tieneEstudiante && !tieneGrupo) {
    return "Elige un estudiante o un grupo.";
  }
  if (!Number.isFinite(datos.minutos) || datos.minutos <= 0) {
    return "La duración tiene que ser mayor que cero.";
  }
  return null;
}

/** Céntimos en algo que se pueda leer. Una raya cuando no hay importe. */
export function euros(centimos: number | null): string {
  if (centimos === null || centimos === undefined) return "—";
  return `${(centimos / 100).toFixed(2).replace(".", ",")} €`;
}

/** Minutos en «1 h 30 min». */
export function horas(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Los estudiantes de una clase: el suyo si es particular, los del grupo si
 * es de grupo. Devuelve ids, que es lo único que necesitan los deberes.
 */
export async function destinatariosDe(claseId: string): Promise<string[]> {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      estudianteId: true,
      grupo: { select: { miembros: { select: { estudianteId: true } } } },
    },
  });
  if (!clase) return [];
  if (clase.estudianteId) return [clase.estudianteId];
  return clase.grupo?.miembros.map((m) => m.estudianteId) ?? [];
}

/**
 * Pone las filas de `Deber` de acuerdo con el texto y el destinatario de la
 * clase: crea las que faltan, borra las de quien ya no viene.
 *
 * Lo que NO hace es reabrir lo cerrado. Cerrar un deber es un hecho
 * ocurrido y no se deshace por editar la ficha, así que a quien sigue en la
 * clase no se le toca su fila.
 */
export async function sincronizarDeberes(claseId: string): Promise<void> {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: { deberes: true },
  });
  if (!clase) return;

  // Sin texto no hay deberes que enseñar a nadie.
  if (!clase.deberes?.trim()) {
    await prisma.deber.deleteMany({ where: { claseId } });
    return;
  }

  const destinatarios = await destinatariosDe(claseId);

  await prisma.deber.createMany({
    data: destinatarios.map((estudianteId) => ({ claseId, estudianteId })),
    skipDuplicates: true,
  });

  await prisma.deber.deleteMany({
    where: { claseId, estudianteId: { notIn: destinatarios } },
  });
}

export async function cerrarDeber(deberId: string): Promise<void> {
  await prisma.deber.update({
    where: { id: deberId },
    data: { cerradoEl: new Date() },
  });
}

/** Para cuando el profesor se equivoca al cerrar. */
export async function abrirDeber(deberId: string): Promise<void> {
  await prisma.deber.update({
    where: { id: deberId },
    data: { cerradoEl: null },
  });
}

/** Cierra los que quedaran abiertos. Devuelve cuántos eran. */
export async function cerrarDeberesDeClase(claseId: string): Promise<number> {
  const { count } = await prisma.deber.updateMany({
    where: { claseId, cerradoEl: null },
    data: { cerradoEl: new Date() },
  });
  return count;
}
