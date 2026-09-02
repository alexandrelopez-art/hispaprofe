import { Prisma } from "@/lib/generated/prisma/client";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { bloquePorOrden } from "@/lib/preparacion";
import { prisma } from "@/lib/prisma";

/**
 * El catálogo de un bloque de `/dele` —qué exámenes ve el alumno y en
 * qué punto está de cada uno— y `abrirPractica`, la única escritura de todo
 * esto: la puerta por la que el alumno se abre una práctica.
 *
 * Van juntos a propósito: quién puede empezar qué es la misma regla que decide
 * qué se pinta con botón, y separarlas es garantizar que un día digan cosas
 * distintas.
 *
 * Solo de servidor: importa `prisma`. La tabla de bloques vive aparte, en
 * `lib/preparacion.ts`, que es pura y la puede mirar también el cliente.
 */

export type EstadoTarjeta =
  | { clase: "SIN_ASIGNAR" }
  | { clase: "ARCHIVADA" }
  | { clase: "SIN_EMPEZAR" }
  | { clase: "A_MEDIAS"; hechos: number; total: number }
  | { clase: "ENTREGADO"; total: number }
  | { clase: "REVISADO"; puntos: number };

export type Tarjeta = {
  recorridoId: string;
  titulo: string;
  nivel: Nivel;
  destreza: Destreza | null;
  examen: number | null;
  pasos: number;
  estado: EstadoTarjeta;
};

/** Lo que se sabe de la asignación de un alumno a un recorrido, o nada. */
export type AsignacionDeTarjeta = {
  archivada: boolean;
  completados: { verificadoEl: Date | null; puntos: number | null }[];
};

/**
 * En qué punto está una asignación, a partir de sus pasos completados.
 *
 * «No hay asignación» y «hay asignación sin pasos hechos» son dos cosas
 * distintas y hasta aquí caían en la misma: al alumno al que su profe le abrió
 * el examen blanco y todavía no ha tocado nada, la tarjeta le pintaba «sin
 * empezar» y ningún enlace, y solo llegaba a su práctica por el panel. Por eso
 * `SIN_ASIGNAR` va aparte: es el único estado en el que tiene sentido un botón
 * que crea.
 *
 * «Revisado» pide que estén **todos** revisados. Con uno revisado y otro sin
 * entregar sigue siendo «a medias»: decirle «revisado» al alumno cuando le
 * queda media prueba es decirle que ha terminado.
 */
export function estadoDeAsignacion(
  pasos: number,
  asignacion: AsignacionDeTarjeta | null,
): EstadoTarjeta {
  if (!asignacion) return { clase: "SIN_ASIGNAR" };
  // Archivada es su propio estado y no «sin empezar»: el botón «Empezar» sobre
  // una archivada no crea nada —`abrirPractica` devuelve la que ya hay— y el
  // alumno acababa en un trabajo que su profe retiró, sin que nadie se lo
  // dijera. La tarjeta lo dice y no ofrece puerta: desarchivar es del profe.
  if (asignacion.archivada) return { clase: "ARCHIVADA" };

  const completados = asignacion.completados;
  if (completados.length === 0) return { clase: "SIN_EMPEZAR" };
  if (completados.length < pasos) {
    return { clase: "A_MEDIAS", hechos: completados.length, total: pasos };
  }
  if (completados.every((c) => c.verificadoEl !== null)) {
    return {
      clase: "REVISADO",
      puntos: completados.reduce((suma, c) => suma + (c.puntos ?? 0), 0),
    };
  }
  return { clase: "ENTREGADO", total: pasos };
}

/**
 * Las asignaciones de un alumno en un bloque, con sus pasos hechos.
 *
 * Una consulta y no una por tarjeta: con siete exámenes de cuatro pruebas, el
 * bloque 2 tiene veintiocho secuencias, y una consulta de estado por tarjeta
 * son veintiocho viajes a la base para pintar una lista.
 *
 * Trae también las archivadas: son las que hay que distinguir de «no tiene
 * ninguna», y filtrarlas aquí las convertiría en lo segundo.
 */
async function asignacionesDelBloque(
  estudianteId: string,
  orden: number,
): Promise<Map<string, AsignacionDeTarjeta>> {
  const suyas = await prisma.asignacion.findMany({
    where: {
      estudianteId,
      recorrido: { tipo: "PREPARACION_DELE", orden },
    },
    select: {
      recorridoId: true,
      archivada: true,
      completados: { select: { verificadoEl: true, puntos: true } },
    },
  });
  return new Map(
    suyas.map((a) => [a.recorridoId, { archivada: a.archivada, completados: a.completados }]),
  );
}

/**
 * Las tarjetas de un bloque.
 *
 * En un bloque **autoservicio** el catálogo es «lo publicado»: el alumno se lo
 * abre él. En uno que no lo es —el examen blanco— el catálogo es «lo que le
 * abrieron»: enseñar todos los exámenes blancos publicados es enseñarle el
 * trabajo de otros alumnos, y encima con un vacío que le echaría la culpa a su
 * profe cuando lo que pasa es que no hay ninguno cargado. Se acota a los
 * recorridos con asignación viva suya.
 *
 * Archivada no cuenta como viva en el bloque 3: una asignación que el profe
 * retiró es material que le quitó, y devolverlo al catálogo sería
 * desarchivarlo de mentira.
 */
export async function catalogoDeBloque(
  orden: number,
  estudianteId: string | null,
): Promise<Tarjeta[]> {
  const autoservicio = bloquePorOrden(orden)?.autoservicio ?? true;

  const suyas = estudianteId
    ? await asignacionesDelBloque(estudianteId, orden)
    : new Map<string, AsignacionDeTarjeta>();

  let soloEstos: string[] | null = null;
  if (!autoservicio) {
    soloEstos = [...suyas.entries()].filter(([, a]) => !a.archivada).map(([id]) => id);
    if (soloEstos.length === 0) return [];
  }

  const recorridos = await prisma.recorrido.findMany({
    where: {
      tipo: "PREPARACION_DELE",
      orden,
      publicado: true,
      ...(soloEstos ? { id: { in: soloEstos } } : {}),
    },
    select: {
      id: true,
      titulo: true,
      nivel: true,
      destreza: true,
      examen: true,
      _count: { select: { pasos: true } },
    },
    // Por examen y prueba, no por título: con diez exámenes, el título pone el
    // 10 antes que el 2. Las que no son de un examen concreto van al final.
    orderBy: [{ examen: "asc" }, { destreza: "asc" }, { titulo: "asc" }],
  });

  return recorridos.map((r) => ({
    recorridoId: r.id,
    titulo: r.titulo,
    nivel: r.nivel,
    destreza: r.destreza,
    examen: r.examen,
    pasos: r._count.pasos,
    estado: estadoDeAsignacion(r._count.pasos, suyas.get(r.id) ?? null),
  }));
}

/**
 * Cuántos exámenes tiene delante este alumno en cada bloque, para la portada.
 *
 * El mismo criterio que `catalogoDeBloque`, y por eso vive al lado: un
 * contador que no cuente lo que luego se lista es un número que miente. En el
 * bloque 3 contar los publicados era contarle exámenes de otros alumnos —«Ver
 * los 7» y dentro, nada—, así que ahí se cuentan sus asignaciones vivas.
 *
 * Se contó, en vez de enseñar «Ver» sin número en ese bloque: quitar el número
 * calla el dato pero deja encendido el enlace, y un alumno sin examen blanco
 * abierto seguiría entrando a una página vacía. El número exacto dice las dos
 * cosas a la vez.
 *
 * Dos consultas para los cuatro bloques: el recuento de lo publicado agrupado,
 * y las asignaciones del alumno en los bloques que no son autoservicio, que
 * son pocas y se cuentan aquí porque `groupBy` no sabe agrupar por una columna
 * de la tabla de al lado.
 */
export async function cuantosPorBloque(
  bloques: { orden: number; autoservicio: boolean }[],
  estudianteId: string | null,
): Promise<Map<number, number>> {
  const publicados = await prisma.recorrido.groupBy({
    by: ["orden"],
    where: { tipo: "PREPARACION_DELE", publicado: true },
    _count: { _all: true },
  });

  const cuantos = new Map<number, number>();
  for (const b of bloques) {
    cuantos.set(
      b.orden,
      b.autoservicio ? (publicados.find((p) => p.orden === b.orden)?._count._all ?? 0) : 0,
    );
  }

  const ajenos = bloques.filter((b) => !b.autoservicio).map((b) => b.orden);
  if (estudianteId && ajenos.length > 0) {
    const suyas = await prisma.asignacion.findMany({
      where: {
        estudianteId,
        archivada: false,
        recorrido: { tipo: "PREPARACION_DELE", publicado: true, orden: { in: ajenos } },
      },
      select: { recorrido: { select: { orden: true } } },
    });
    for (const a of suyas) {
      cuantos.set(a.recorrido.orden, (cuantos.get(a.recorrido.orden) ?? 0) + 1);
    }
  }

  return cuantos;
}

/**
 * El profesor que responde por este alumno: el de su grupo.
 *
 * Un alumno no tiene «su profesor» guardado en ninguna parte; se deduce del
 * grupo, que es el único vínculo real que existe hoy. Con varios grupos
 * activos se toma aquel en el que entró más tarde: es un desempate arbitrario
 * y por eso se escribe aquí, en vez de dejarlo al orden que devuelva la base.
 *
 * Un grupo archivado no cuenta: su profesor ya no responde por ese alumno.
 */
export async function profesorDelEstudiante(estudianteId: string): Promise<string | null> {
  const membresia = await prisma.miembroGrupo.findFirst({
    where: { estudianteId, grupo: { archivado: false } },
    orderBy: { createdAt: "desc" },
    select: { grupo: { select: { profesorId: true } } },
  });
  return membresia?.grupo.profesorId ?? null;
}

/**
 * Abre una práctica a un alumno: comprueba y crea la asignación, o dice por
 * qué no.
 *
 * Si ya tenía asignación de ese recorrido **no se toca nada** y se devuelve la
 * suya. No se reutiliza `asignarA` (`lib/acciones.ts`), cuyo `upsert` pone
 * `archivada: false` y reescribe el `profesorId`: por esa vía un alumno
 * resucitaría una asignación que su profe archivó, o le cambiaría el dueño a su
 * propia entrega. Esta puerta crea, o no hace nada.
 */
export async function abrirPractica(
  estudianteId: string,
  recorridoId: string,
): Promise<{ error: string } | { asignacionId: string }> {
  const recorrido = await prisma.recorrido.findUnique({
    where: { id: recorridoId },
    select: { tipo: true, orden: true, publicado: true },
  });
  if (!recorrido || recorrido.tipo !== "PREPARACION_DELE") {
    return { error: "Esa secuencia no es de preparación al DELE." };
  }
  if (!recorrido.publicado) {
    return { error: "Esta secuencia todavía es un borrador." };
  }

  const bloque = bloquePorOrden(recorrido.orden);
  if (!bloque || !bloque.autoservicio) {
    return { error: "Este examen lo abre tu profesor." };
  }

  const yaLaTiene = await prisma.asignacion.findUnique({
    where: { estudianteId_recorridoId: { estudianteId, recorridoId } },
    select: { id: true },
  });
  if (yaLaTiene) return { asignacionId: yaLaTiene.id };

  const profesorId = await profesorDelEstudiante(estudianteId);
  if (!profesorId) {
    return { error: "Habla con tu profe para que te dé un grupo." };
  }

  // El findUnique de arriba y este create son dos viajes sin transacción: un
  // doble clic en el botón —el camino realista de esta puerta, no dos
  // pestañas hipotéticas— manda las dos peticiones con `yaLaTiene === null`
  // a la vez, y la segunda choca contra la unicidad (estudianteId,
  // recorridoId) con P2002. Perder esa carrera tiene que llevar al alumno a
  // su práctica, no a una pantalla de error: se relee y se devuelve la que
  // ganó.
  try {
    const nueva = await prisma.asignacion.create({
      data: { estudianteId, recorridoId, profesorId },
      select: { id: true },
    });
    return { asignacionId: nueva.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const ganadora = await prisma.asignacion.findUniqueOrThrow({
        where: { estudianteId_recorridoId: { estudianteId, recorridoId } },
        select: { id: true },
      });
      return { asignacionId: ganadora.id };
    }
    throw e;
  }
}

/**
 * Lo que distingue a dos tarjetas que se leerían igual.
 *
 * El encabezado de una tarjeta es «nivel · prueba», y eso basta casi siempre.
 * Pero dos secuencias del mismo nivel y la misma prueba —la lectura de mayo
 * 2015 y la del modelo 0, que es el caso real de hoy— salen idénticas: cuatro
 * tareas, sin empezar, y ninguna forma de saber cuál es cuál. Esta función
 * devuelve, solo para las que chocan, el trozo del título que las separa.
 *
 * Se prefiere el paréntesis final del título («mayo 2015», «modelo 0») al
 * título entero porque el título repite el nivel y la prueba que la tarjeta ya
 * enseña encima; si no hay paréntesis, se cae al título completo, que feo o no
 * dice la verdad.
 */
export function distintivos(tarjetas: Tarjeta[]): Map<string, string> {
  const cuantas = new Map<string, number>();
  const clave = (t: Tarjeta) => `${t.examen ?? ""}·${t.nivel}·${t.destreza ?? ""}`;
  for (const t of tarjetas) cuantas.set(clave(t), (cuantas.get(clave(t)) ?? 0) + 1);

  const marcas = new Map<string, string>();
  for (const t of tarjetas) {
    if ((cuantas.get(clave(t)) ?? 0) < 2) continue;
    marcas.set(t.recorridoId, /\(([^()]+)\)\s*$/.exec(t.titulo)?.[1] ?? t.titulo);
  }
  return marcas;
}
