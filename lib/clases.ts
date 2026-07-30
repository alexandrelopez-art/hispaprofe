import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { EstadoClase } from "@/lib/generated/prisma/enums";

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

/**
 * Congela el precio de una clase dada: la tarifa de hoy por sus minutos,
 * escrita una sola vez. Devuelve el importe que queda en la clase.
 *
 * Las dos guardas son la regla, no un detalle de la acción: solo una clase
 * DADA tiene precio, y solo se escribe si no lo tenía. Recalcularlo
 * reescribiría el pasado — subir la tarifa en marzo no puede cambiar lo que
 * costó una clase de enero.
 *
 * Vive aquí y no en `cambiarEstadoClase` porque una acción de servidor no se
 * puede llamar desde un script, y una regla que nada puede ejercitar es una
 * regla de la que nadie puede fiarse.
 */
export async function congelarImporte(
  claseId: string,
): Promise<number | null> {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      estado: true,
      minutos: true,
      estudianteId: true,
      grupoId: true,
      importeCentimos: true,
    },
  });
  if (!clase) return null;
  if (clase.estado !== "DADA") return null;
  if (clase.importeCentimos !== null) return clase.importeCentimos;

  const importeCentimos = importeDeClase(
    await tarifaDe(clase.estudianteId, clase.grupoId),
    clase.minutos,
  );
  // Sin tarifa no hay nada que escribir: el null se queda y la ficha avisa.
  if (importeCentimos === null) return null;

  await prisma.clase.update({
    where: { id: claseId },
    data: { importeCentimos },
  });
  return importeCentimos;
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

export type FiltroClases = {
  profesorId?: string;
  estudianteId?: string;
  grupoId?: string;
  desde?: Date;
  hasta?: Date;
  estado?: EstadoClase;
  cobrada?: boolean;
};

function whereDeFiltro(filtro: FiltroClases): Prisma.ClaseWhereInput {
  const where: Prisma.ClaseWhereInput = {};

  if (filtro.profesorId) where.profesorId = filtro.profesorId;
  if (filtro.estudianteId) where.estudianteId = filtro.estudianteId;
  if (filtro.grupoId) where.grupoId = filtro.grupoId;
  if (filtro.estado) where.estado = filtro.estado;
  if (filtro.cobrada !== undefined) {
    where.cobradaEl = filtro.cobrada ? { not: null } : null;
  }
  if (filtro.desde || filtro.hasta) {
    where.empiezaEl = {
      ...(filtro.desde ? { gte: filtro.desde } : {}),
      ...(filtro.hasta ? { lte: filtro.hasta } : {}),
    };
  }

  return where;
}

export type TotalesClases = {
  cuantas: number;
  minutos: number;
  totalCentimos: number;
  cobradoCentimos: number;
  pendienteCentimos: number;
  /** Clases dadas sin importe: un olvido de tarifa, no un cero. */
  sinTarifa: number;
};

/**
 * Los cuatro números del cuadro, sobre lo que diga el filtro.
 *
 * Encima del filtro se impone `estado: DADA`: una clase agendada o anulada
 * no es trabajo hecho. Eso hace que pedir los totales filtrando por
 * AGENDADA devuelva ceros, y es lo correcto — no hay horas trabajadas en
 * una clase que todavía no ha ocurrido.
 */
export async function totalesDeClases(
  filtro: FiltroClases,
): Promise<TotalesClases> {
  // El filtro pide un estado que no es DADA: la intersección con «lo
  // trabajado» es vacía, y se responde sin ir a la base.
  if (filtro.estado && filtro.estado !== "DADA") {
    return {
      cuantas: 0,
      minutos: 0,
      totalCentimos: 0,
      cobradoCentimos: 0,
      pendienteCentimos: 0,
      sinTarifa: 0,
    };
  }

  const where: Prisma.ClaseWhereInput = {
    ...whereDeFiltro(filtro),
    estado: "DADA",
  };

  const [todas, cobradas, sinImporte] = await Promise.all([
    prisma.clase.aggregate({
      where,
      _sum: { minutos: true, importeCentimos: true },
      _count: { _all: true },
    }),
    prisma.clase.aggregate({
      where: { ...where, cobradaEl: { not: null } },
      _sum: { importeCentimos: true },
    }),
    prisma.clase.count({ where: { ...where, importeCentimos: null } }),
  ]);

  const totalCentimos = todas._sum.importeCentimos ?? 0;
  const cobradoCentimos = cobradas._sum.importeCentimos ?? 0;

  return {
    cuantas: todas._count._all,
    minutos: todas._sum.minutos ?? 0,
    totalCentimos,
    cobradoCentimos,
    pendienteCentimos: totalCentimos - cobradoCentimos,
    sinTarifa: sinImporte,
  };
}

const seleccionLista = {
  id: true,
  empiezaEl: true,
  minutos: true,
  estado: true,
  donde: true,
  enlace: true,
  deberes: true,
  importeCentimos: true,
  cobradaEl: true,
  estudiante: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      suprimidoEl: true,
    },
  },
  grupo: { select: { id: true, nombre: true } },
  _count: { select: { asignados: true } },
} satisfies Prisma.ClaseSelect;

export type ClaseDeLista = Prisma.ClaseGetPayload<{
  select: typeof seleccionLista;
}>;

/**
 * Las clases del filtro, de la más reciente a la más antigua. A diferencia
 * de los totales, aquí salen todas: agendadas, dadas y anuladas. La lista
 * es para ver, no para sumar.
 */
export async function listarClases(
  filtro: FiltroClases,
): Promise<ClaseDeLista[]> {
  return prisma.clase.findMany({
    where: whereDeFiltro(filtro),
    orderBy: { empiezaEl: "desc" },
    select: seleccionLista,
  });
}

export type ProximaClase = {
  id: string;
  empiezaEl: Date;
  minutos: number;
  enlace: string | null;
  donde: string | null;
  profesor: string;
};

/**
 * La siguiente clase agendada de este estudiante: la suya o la de un grupo
 * donde esté. `ahora` se puede pasar para verificarla sin depender del
 * reloj de la máquina.
 */
export async function proximaClase(
  estudianteId: string,
  ahora: Date = new Date(),
): Promise<ProximaClase | null> {
  const clase = await prisma.clase.findFirst({
    where: {
      estado: "AGENDADA",
      empiezaEl: { gte: ahora },
      OR: [
        { estudianteId },
        { grupo: { miembros: { some: { estudianteId } } } },
      ],
    },
    orderBy: { empiezaEl: "asc" },
    select: {
      id: true,
      empiezaEl: true,
      minutos: true,
      enlace: true,
      donde: true,
      profesor: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!clase) return null;

  const p = clase.profesor;
  return {
    id: clase.id,
    empiezaEl: clase.empiezaEl,
    minutos: clase.minutos,
    enlace: clase.enlace,
    donde: clase.donde,
    profesor:
      [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email,
  };
}

export type DeberPendiente = {
  id: string;
  texto: string;
  claseEl: Date;
};

/**
 * Los deberes que este estudiante tiene sin cerrar. Los de una clase
 * anulada no salen: pedirle los deberes de una clase que se canceló no
 * tiene sentido, aunque la fila se conserve para el historial del profesor.
 */
export async function deberesPendientes(
  estudianteId: string,
): Promise<DeberPendiente[]> {
  const filas = await prisma.deber.findMany({
    where: {
      estudianteId,
      cerradoEl: null,
      clase: { estado: { not: "ANULADA" } },
    },
    orderBy: { clase: { empiezaEl: "desc" } },
    select: {
      id: true,
      clase: { select: { deberes: true, empiezaEl: true } },
    },
  });

  return filas.map((f) => ({
    id: f.id,
    texto: f.clase.deberes ?? "",
    claseEl: f.clase.empiezaEl,
  }));
}

/**
 * Una clase dada no se borra: son horas trabajadas y puede que facturadas.
 * Para borrarla hay que volver a agendarla primero, que es un gesto
 * consciente y reversible.
 */
export function sePuedeBorrar(estado: EstadoClase): boolean {
  return estado !== "DADA";
}

/**
 * Borra la clase salvo que esté dada, y se lleva sus deberes por la cascada
 * del esquema. El filtro va dentro del propio delete para que no haya carrera
 * entre comprobar y borrar, igual que en `desmarcarSiNoRevisado`.
 *
 * Devuelve true si borró algo.
 */
export async function borrarClase(claseId: string): Promise<boolean> {
  const { count } = await prisma.clase.deleteMany({
    where: { id: claseId, estado: { not: "DADA" } },
  });
  return count > 0;
}
