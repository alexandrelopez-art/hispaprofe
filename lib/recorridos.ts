import { esGrabacionEntregada, PREFIJO_GRABACION } from "@/lib/expresion";
import { prisma } from "@/lib/prisma";

/**
 * Quién puede borrar una secuencia, qué se lleva por delante y cómo se avisa.
 *
 * Vive fuera de la acción por el criterio de siempre en este proyecto: una
 * acción de servidor necesita sesión y contexto de petición, así que ningún
 * script puede llamarla, y una regla que no se puede ejercitar es una regla de
 * la que nadie se puede fiar.
 */

/**
 * Administrador siempre; profesor solo lo suyo; una secuencia sin autor, solo
 * el administrador.
 *
 * La fila de la secuencia sin autor no es un caso rebuscado: es el caso
 * corriente. `Recorrido.autorId` admite nulo, lo que se copia de una base a
 * otra entra sin autor —los usuarios de la de origen no existen en la de
 * destino— y lo que siembran los scripts tampoco firma. Dejar eso al alcance
 * de cualquier profesor sería abrir la mano justo donde no se sabe de quién es.
 */
export function puedeBorrarRecorrido(
  usuario: { id: string; role: string } | null,
  recorrido: { autorId: string | null },
): boolean {
  if (!usuario) return false;
  if (usuario.role === "ADMIN") return true;
  if (usuario.role !== "PROFESOR") return false;
  return recorrido.autorId !== null && recorrido.autorId === usuario.id;
}

export type ResumenDeBorrado = {
  pasos: number;
  alumnos: number;
  pasosHechos: number;
  notas: number;
  grabaciones: number;
};

/**
 * Lo que hay dentro de una secuencia, para poder decirlo antes de borrarla.
 *
 * Se cuenta en el servidor al pintar la página y no en el navegador: el aviso
 * tiene que decir lo que hay, no lo que el cliente crea que hay.
 */
export async function resumenDeBorrado(recorridoId: string): Promise<ResumenDeBorrado> {
  const pasos = await prisma.paso.findMany({
    where: { recorridoId },
    select: { id: true },
  });
  const pasoIds = pasos.map((p) => p.id);

  const [alumnos, completados] = await Promise.all([
    prisma.asignacion.count({ where: { recorridoId } }),
    prisma.pasoCompletado.findMany({
      where: { pasoId: { in: pasoIds } },
      select: { puntos: true, entrega: true },
    }),
  ]);

  return {
    pasos: pasos.length,
    alumnos,
    pasosHechos: completados.length,
    notas: completados.filter((c) => c.puntos !== null).length,
    grabaciones: completados.filter((c) => esGrabacionEntregada(c.entrega)).length,
  };
}

/** «3 alumnos» o «1 alumno», que una plantilla en plural fijo canta. */
function cuenta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * El aviso de la confirmación.
 *
 * Enumera solo lo que hay. Un aviso que dice «0 alumnos, 0 notas, 0
 * grabaciones» es un aviso que se lee en diagonal, y entonces deja de avisar
 * el día que los números no son cero.
 */
export function avisoDeBorrado(titulo: string, resumen: ResumenDeBorrado): string {
  const partes: string[] = [];
  if (resumen.alumnos) partes.push(cuenta(resumen.alumnos, "alumno asignado", "alumnos asignados"));
  if (resumen.pasosHechos) partes.push(cuenta(resumen.pasosHechos, "paso hecho", "pasos hechos"));
  if (resumen.notas) partes.push(cuenta(resumen.notas, "nota puesta", "notas puestas"));
  if (resumen.grabaciones) partes.push(cuenta(resumen.grabaciones, "grabación", "grabaciones"));

  if (partes.length === 0) {
    return `¿Borrar «${titulo}»? Se borrarán la secuencia y sus ${cuenta(resumen.pasos, "paso", "pasos")}.`;
  }

  const enumerado =
    partes.length === 1
      ? partes[0]
      : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

  return (
    `¿Borrar «${titulo}»? Esta secuencia tiene ${enumerado}. ` +
    `Se borra todo, incluidas las grabaciones, y no hay vuelta atrás.`
  );
}

/**
 * Los archivos de las grabaciones que esta secuencia se puede llevar.
 *
 * Existe porque si no, esas filas se quedan en la base **sin nada que las
 * referencie**: no es que ocupen sitio, es que ya no hay forma de llegar a
 * ellas ni para suprimirlas. Son voces de alumnos, a menudo menores, y eso es
 * justo lo que el proyecto evita en `lib/admin.ts` al suprimir una persona.
 *
 * Y se queda fuera lo que alguien de fuera todavía nombre. `entrega` es texto
 * libre del alumno —lo avisa `lib/expresion.ts`—, así que en una tarea escrita
 * se puede teclear el identificador de la grabación de un compañero. Sin esta
 * comprobación, borrar esta secuencia destruiría el audio de otra.
 */
export async function grabacionesBorrables(recorridoId: string): Promise<string[]> {
  const pasos = await prisma.paso.findMany({
    where: { recorridoId },
    select: { id: true },
  });
  const pasoIds = pasos.map((p) => p.id);

  const dentro = await prisma.pasoCompletado.findMany({
    where: { pasoId: { in: pasoIds } },
    select: { entrega: true },
  });
  const candidatos = new Set(
    dentro
      .filter((c) => esGrabacionEntregada(c.entrega))
      .map((c) => c.entrega!.slice(PREFIJO_GRABACION.length)),
  );
  if (candidatos.size === 0) return [];

  // Quién más los nombra, mirando solo fuera de esta secuencia.
  const fuera = await prisma.pasoCompletado.findMany({
    where: { pasoId: { notIn: pasoIds } },
    select: { entrega: true },
  });
  for (const { entrega } of fuera) {
    if (!esGrabacionEntregada(entrega)) continue;
    candidatos.delete(entrega!.slice(PREFIJO_GRABACION.length));
  }

  return [...candidatos];
}
