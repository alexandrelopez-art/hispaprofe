import { Prisma } from "@/lib/generated/prisma/client";
import type { TipoEjercicio } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { analizar } from "@/lib/ejercicios/registro";
import { opcionSchema } from "@/lib/ejercicios/opcion";
import { huecosSchema } from "@/lib/ejercicios/huecos";
import { relacionarSchema } from "@/lib/ejercicios/relacionar";
import { ordenarSchema } from "@/lib/ejercicios/ordenar";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import { analizarExpresion, expresionSchema } from "@/lib/expresion";

// Solo de servidor: `analizar` arrastra `lib/ejercicios/registro.ts`, que
// importa `node:crypto`. Ningún componente de cliente puede importar esto.

/**
 * `Ejercicio.tipo` (el enum de la base) y `datos.ejercicio` (lo que lee el
 * motor) son dos datos distintos que tienen que decir lo mismo. Esta tabla
 * vivía a mano dentro de `scripts/sembrar-ejercicios-demo.ts`, con un
 * comentario avisando de que nada la vigilaba. Vive aquí para que solo haya
 * un sitio donde puedan discrepar, y para que el script la ejercite.
 *
 * `WIDGET` no está: no tiene ningún `datos.ejercicio` que le corresponda.
 */
export const TIPO_DE_EJERCICIO: Record<MarcaEjercicio, TipoEjercicio> = {
  opcion: "OPCION_MULTIPLE",
  huecos: "HUECOS",
  relacionar: "RELACIONAR",
  ordenar: "ORDENAR",
};

/**
 * El `TipoEjercicio` que le toca a un `datos`, o null si no es válido.
 *
 * Pregunta a los dos: primero al motor —sus cuatro tipos— y luego a la
 * expresión, que es hermana y no miembro. Sigue habiendo un solo sitio donde
 * la columna y el discriminante pueden discrepar.
 */
export function tipoDeEjercicio(datos: unknown): TipoEjercicio | null {
  const analizado = analizar(datos);
  if (analizado) return TIPO_DE_EJERCICIO[analizado.tipo];
  return analizarExpresion(datos) ? "EXPRESION" : null;
}

/**
 * Los esquemas por su discriminante, para poder volver a parsear y contar el
 * porqué. `expresion` está aquí aunque no sea del motor: este es el único
 * sitio donde los errores se traducen a castellano, y sin ella una expresión
 * mal rellenada solo sabía decir «al ejercicio le falta el tipo».
 */
const ESQUEMAS = {
  opcion: opcionSchema,
  huecos: huecosSchema,
  relacionar: relacionarSchema,
  ordenar: ordenarSchema,
  expresion: expresionSchema,
} as const;

/**
 * El motivo que da el esquema, tal cual lo escribió.
 *
 * `analizar` y `analizarExpresion` devuelven `null` a secas —les basta con
 * saber que no vale—, así que para enseñar el porqué hay que volver a
 * parsear con el esquema que toque. Merece la pena: esos mensajes ya están
 * redactados en castellano y explican la razón («Las marcas {{...}} del
 * texto no coinciden con los ids de `huecos`»), que es justo lo que un
 * editor necesita decir.
 */
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

/** Lo que sale del portero: el tipo que le toca, o el porqué del no. */
export type Revision = { tipo: TipoEjercicio } | { error: string };

/**
 * El portero de la columna `datos`: lo que preguntan las dos acciones de
 * Recursos que la escriben —guardar y publicar— antes de tocar la base.
 *
 * Vive aquí y no dentro de las acciones por lo de siempre en este proyecto:
 * `lib/acciones-recursos.ts` es `"use server"`, así que todo lo que exporta
 * es un endpoint público y un script no puede ejercitarlo sin sesión.
 */
export function revisarDatos(datos: unknown): Revision {
  const tipo = tipoDeEjercicio(datos);
  return tipo ? { tipo } : { error: motivoDeZod(datos) };
}

/**
 * Si la fila sigue estando.
 *
 * Las reglas que terminan en un `update` o un `delete` la consultan antes:
 * sin esto, actuar sobre un ejercicio que otra pestaña acaba de borrar
 * llegaba a Prisma y reventaba con un P2025 sin capturar. Un motivo escrito
 * en castellano es lo que el editor sabe enseñar; una excepción, no.
 */
async function existe(ejercicioId: string): Promise<boolean> {
  const fila = await prisma.ejercicio.findUnique({
    where: { id: ejercicioId },
    select: { id: true },
  });
  return fila !== null;
}

/**
 * Si alguien ya dejó trabajo suyo en este paso: respuestas de un ejercicio
 * del motor, la redacción de una expresión escrita, o la rúbrica que le
 * rellenó el profesor.
 *
 * Las tres columnas y no solo `respuestas`: una tarea de expresión no escribe
 * ahí nunca, así que mirando solo esa se podía quitarle el ejercicio a un paso
 * con una redacción entregada —que se quedaba en la base sin ninguna pantalla
 * que la enseñara— o cambiarle los criterios a una tarea ya corregida, y
 * entonces las notas guardadas apuntaban a criterios que ya no existían.
 *
 * `respuestas` y `valoracion` son `Json?`, y en Prisma eso tiene dos nulos
 * distintos: `Prisma.DbNull` es la columna vacía y `Prisma.JsonNull` es el
 * valor JSON `null` guardado dentro. Aquí interesa el primero: un
 * `PasoCompletado` existe en cuanto el estudiante marca el paso, tenga o no
 * ejercicio, así que contar filas a secas daría falsos positivos en todos los
 * pasos de solo lectura.
 */
export async function tieneTrabajo(pasoId: string): Promise<boolean> {
  const cuantos = await prisma.pasoCompletado.count({
    where: {
      pasoId,
      OR: [
        { NOT: { respuestas: { equals: Prisma.DbNull } } },
        { entrega: { not: null } },
        { NOT: { valoracion: { equals: Prisma.DbNull } } },
      ],
    },
  });
  return cuantos > 0;
}

/**
 * Si a este paso se le puede colgar un ejercicio cualquiera, o el motivo del
 * no. Las dos reglas que no miran a *qué* ejercicio es.
 *
 * Extraída de `puedeEngancharse` porque la puerta de pegar por código las
 * necesita antes de que el ejercicio exista: no hay `ejercicioId` que
 * pasarle. Extraída y no copiada, que es lo que evita que dentro de un mes
 * una de las dos puertas empiece a dejar pasar lo que la otra rechaza.
 */
export async function pasoLibre(pasoId: string): Promise<string | null> {
  // La página del paso hace `findFirst` ordenado y descarta el resto, porque
  // la corrección escribe los puntos del paso entero y dos ejercicios se
  // pisarían. Sin esta negativa, el segundo se guardaría y no lo vería nadie.
  const yaHay = await prisma.pasoEjercicio.count({ where: { pasoId } });
  if (yaHay > 0) {
    return "Ese paso ya tiene un ejercicio. Quita el que hay antes de poner otro.";
  }

  if (await tieneTrabajo(pasoId)) {
    return "Alguien ya trabajó en ese paso. Cambiarle el ejercicio dejaría sin sentido lo que respondió, lo que entregó o lo que ya le corregiste.";
  }
  return null;
}

/**
 * Si a este paso se le puede colgar este ejercicio, o el motivo del no.
 *
 * Tres negativas y las tres tienen la misma raíz: que el estudiante acabe
 * viendo algo distinto de lo que el profesor cree que puso. Las dos últimas
 * viven en `pasoLibre`, que es lo que comparte con la puerta de pegar.
 */
export async function puedeEngancharse(
  ejercicioId: string,
  pasoId: string,
): Promise<string | null> {
  const ejercicio = await prisma.ejercicio.findUnique({
    where: { id: ejercicioId },
    select: { publicado: true },
  });
  if (!ejercicio) return "Ese ejercicio no existe.";
  if (!ejercicio.publicado) {
    return "Es un borrador. Publícalo antes de colgarlo de un paso.";
  }

  return pasoLibre(pasoId);
}

/** Si se le puede quitar el ejercicio a este paso, o el motivo del no. */
export async function puedeDesengancharse(pasoId: string): Promise<string | null> {
  if (await tieneTrabajo(pasoId)) {
    return "Alguien ya trabajó en ese paso. Quitarle el ejercicio dejaría lo que respondió, lo que entregó o su corrección sin ninguna pantalla que lo enseñe.";
  }
  return null;
}

/**
 * Si este ejercicio se puede borrar, o el motivo del no.
 *
 * No es una regla inventada: la relación de `PasoEjercicio` hacia `Ejercicio`
 * no tiene borrado en cascada, así que borrar uno enganchado revienta contra
 * una clave foránea. Mejor decirlo que dejar que explote.
 */
export async function puedeBorrarse(ejercicioId: string): Promise<string | null> {
  if (!(await existe(ejercicioId))) return "Ese ejercicio no existe.";

  const cuantos = await prisma.pasoEjercicio.count({ where: { ejercicioId } });
  if (cuantos > 0) {
    return `Cuelga de ${cuantos} paso${cuantos !== 1 ? "s" : ""}. Despublícalo en vez de borrarlo.`;
  }
  return null;
}

/**
 * Si este ejercicio se puede volver a borrador, o el motivo del no.
 *
 * Misma consulta que `puedeBorrarse`, pero para el otro sentido: si colgara
 * de un paso, el estudiante que lo tiene delante se quedaría con un
 * ejercicio que la aplicación considera a medio escribir.
 */
export async function puedeDespublicarse(ejercicioId: string): Promise<string | null> {
  if (!(await existe(ejercicioId))) return "Ese ejercicio no existe.";

  const cuantos = await prisma.pasoEjercicio.count({ where: { ejercicioId } });
  if (cuantos > 0) {
    return "Cuelga de un paso. Quítalo de ahí antes de volverlo a borrador.";
  }
  return null;
}

/**
 * Si este ejercicio se puede editar, o el motivo del no.
 *
 * Lo que prohíbe no es estar enganchado: es que alguien haya trabajado. Las
 * respuestas se guardan indexadas por el id de cada pregunta y las notas de
 * la rúbrica por el id de cada criterio, así que cambiarlos por dentro las
 * dejaría apuntando a ids que ya no existen —un criterio quitado se le sigue
 * enseñando al alumno con un «0 / 3» que nunca se le puntuó—. Estar
 * enganchado sin que nadie haya trabajado no rompe nada.
 */
export async function puedeEditarse(ejercicioId: string): Promise<string | null> {
  if (!(await existe(ejercicioId))) return "Ese ejercicio no existe.";

  const vinculos = await prisma.pasoEjercicio.findMany({
    where: { ejercicioId },
    select: { pasoId: true },
  });
  for (const v of vinculos) {
    if (await tieneTrabajo(v.pasoId)) {
      return "Alguien ya lo respondió, ya lo entregó o ya se le corrigió. Duplícalo y edita la copia.";
    }
  }
  return null;
}

/**
 * Copia un ejercicio en borrador y devuelve el id de la copia, o null si el
 * original no existe.
 *
 * Es la salida de `puedeEditarse`: en vez de montar un historial de
 * versiones, el original se queda quieto para que las respuestas que apuntan
 * a él sigan significando algo.
 */
export async function duplicar(ejercicioId: string): Promise<string | null> {
  const original = await prisma.ejercicio.findUnique({ where: { id: ejercicioId } });
  if (!original) return null;

  const copia = await prisma.ejercicio.create({
    data: {
      tipo: original.tipo,
      titulo: `${original.titulo} (copia)`,
      nivel: original.nivel,
      destreza: original.destreza,
      etiquetas: original.etiquetas,
      datos: original.datos as Prisma.InputJsonValue,
      publicado: false,
      autorId: original.autorId,
    },
  });
  return copia.id;
}
