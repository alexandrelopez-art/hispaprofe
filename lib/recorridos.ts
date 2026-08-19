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
 * corriente. `Recorrido.autorId` admite nulo, y lo que siembran los scripts
 * no firma. Lo copiado de una base a otra entra sin autor solo si el autor no
 * existe en la base de destino: `scripts/copiar-a-produccion.ts` empareja por
 * correo y sí deja la firma cuando esa persona existe allí. Dejar el caso sin
 * firma al alcance de cualquier profesor sería abrir la mano justo donde no
 * se sabe de quién es.
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
 *
 * Cinco `count`, no un `findMany` de las filas: una entrega escrita puede
 * llegar a `MAXIMO_ENTREGA` —20.000 caracteres, `lib/expresion.ts`—, así que
 * traer `puntos` y `entrega` de cada `PasoCompletado` para sumar tres números
 * bajaba cientos de KB de redacciones enteras en cada carga de la página, solo
 * para descartarlas aquí mismo. Contar no necesita leer el contenido.
 */
export async function resumenDeBorrado(recorridoId: string): Promise<ResumenDeBorrado> {
  const [pasos, alumnos, pasosHechos, notas, grabaciones] = await Promise.all([
    prisma.paso.count({ where: { recorridoId } }),
    prisma.asignacion.count({ where: { recorridoId } }),
    prisma.pasoCompletado.count({ where: { paso: { recorridoId } } }),
    prisma.pasoCompletado.count({ where: { paso: { recorridoId }, puntos: { not: null } } }),
    prisma.pasoCompletado.count({
      where: { paso: { recorridoId }, entrega: { startsWith: PREFIJO_GRABACION } },
    }),
  ]);

  return { pasos, alumnos, pasosHechos, notas, grabaciones };
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
 *
 * Y, sobre lo que sobreviva a esas dos cribas, todavía queda una tercera: solo
 * es candidato de verdad lo que sea `privado`. `entrega` no es la única forma
 * de nombrar un `Archivo` —`Bloque.url` y el `audio` de un ejercicio de
 * `opcion` o `relacionar` son las imágenes y los audios que sube el profesor,
 * y esos no llevan `privado`—, y ninguna de esas dos tablas se mira aquí. Un
 * alumno que abre un paso con una imagen ve en el HTML su dirección literal,
 * `/api/archivos/<id>`, y nada le impide teclearla como entrega de una tarea
 * **escrita**: `puedeEntregar` (`lib/expresion.ts`) solo mira el largo, la
 * modalidad y si ya está corregida, no lo que hay dentro del texto. Eso basta
 * para que el material del profesor entre en la lista de candidatos, y sin
 * este filtro el barrido se lo llevaría por delante de todas las demás
 * secuencias y ejercicios que lo usan. Solo las grabaciones de los alumnos
 * llevan `privado: true` —lo pone `guardarGrabacion`—; el material del
 * profesor no, igual que distingue `puedeOirse` y ya filtran `lib/expresion.ts:468`
 * y `lib/admin.ts:204` al borrar la grabación anterior de un alumno y al
 * suprimir una ficha.
 *
 * `pasoIds`, opcional: si quien llama ya los tiene —como `borrarRecorrido`,
 * que los necesita para su propia transacción—, evita que esta función vuelva
 * a pedirlos.
 */
export async function grabacionesBorrables(
  recorridoId: string,
  pasoIds?: string[],
): Promise<string[]> {
  const idsDePaso =
    pasoIds ??
    (
      await prisma.paso.findMany({
        where: { recorridoId },
        select: { id: true },
      })
    ).map((p) => p.id);

  // El filtro por el prefijo lo pone la propia base de datos, aquí igual que
  // en la consulta de «fuera»: sin él, esta traería la entrega de cada
  // `PasoCompletado` de la secuencia —el texto de cada redacción incluido—
  // solo para descartarlo en memoria.
  const dentro = await prisma.pasoCompletado.findMany({
    where: { pasoId: { in: idsDePaso }, entrega: { startsWith: PREFIJO_GRABACION } },
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
    where: { pasoId: { notIn: idsDePaso }, entrega: { startsWith: PREFIJO_GRABACION } },
    select: { entrega: true },
  });
  for (const { entrega } of fuera) {
    if (!esGrabacionEntregada(entrega)) continue;
    candidatos.delete(entrega!.slice(PREFIJO_GRABACION.length));
  }
  if (candidatos.size === 0) return [];

  // La tercera criba: de lo que sobrevive, solo lo privado. Ver el porqué
  // arriba.
  const privados = await prisma.archivo.findMany({
    where: { id: { in: [...candidatos] }, privado: true },
    select: { id: true },
  });
  return privados.map((a) => a.id);
}

/**
 * Si esta secuencia se puede publicar, o el motivo del no.
 *
 * Publicar es lo que la hace aparecer en el catálogo del alumno
 * (`/preparacion`), así que la única regla es la que evita una tarjeta que no
 * lleva a ninguna parte: sin pasos, no se publica.
 *
 * Despublicar no pasa por aquí a propósito: retirar algo del escaparate
 * siempre se puede, y una regla que impidiera hacerlo dejaría material
 * publicado por error sin forma de quitarlo.
 *
 * Vive aquí y no en la acción por el criterio de este archivo: una acción de
 * servidor necesita sesión, así que ningún script podría ejercitar la regla.
 */
export async function puedePublicarse(recorridoId: string): Promise<string | null> {
  const recorrido = await prisma.recorrido.findUnique({
    where: { id: recorridoId },
    select: { _count: { select: { pasos: true } } },
  });
  if (!recorrido) return "Esa secuencia ya no existe.";
  if (recorrido._count.pasos === 0) {
    return "Todavía no tiene ningún paso: publicada sería una tarjeta que no lleva a ninguna parte.";
  }
  return null;
}
