import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Hermano del motor de `lib/ejercicios/`, no miembro. Ese motor tiene cuatro
// tipos y los cuatro se corrigen solos; `corregir()` es un switch exhaustivo
// escrito para que un quinto caso sin implementar no compile en silencio.
// Una tarea de expresión no se corrige sola, así que vive aquí al lado y la
// página del paso pregunta a los dos.

export const criterioSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1, { message: "Cada criterio necesita un nombre." }),
  maximo: z
    .number()
    .int({ message: "El máximo de un criterio tiene que ser un número entero." })
    .min(1, { message: "Un criterio tiene que valer al menos un punto." }),
});

export type Criterio = z.infer<typeof criterioSchema>;

export const expresionSchema = z
  .object({
    ejercicio: z.literal("expresion"),
    modalidad: z.enum(["escrita", "oral"]),
    consigna: z.string().min(1, { message: "Escribe la consigna: es lo que el alumno tiene que hacer." }),
    /** Lo que el alumno tiene delante. Los tres opcionales. */
    estimulo: z
      .object({
        texto: z.string().optional(),
        imagen: z.string().optional(),
        audio: z.string().optional(),
      })
      .default({}),
    /** Solo en las escritas. */
    palabras: z
      .object({
        minimo: z
          .number()
          .int({ message: "El mínimo de palabras tiene que ser un número entero." })
          .min(1, { message: "El mínimo de palabras tiene que ser al menos uno." }),
        maximo: z
          .number()
          .int({ message: "El máximo de palabras tiene que ser un número entero." })
          .min(1, { message: "El máximo de palabras tiene que ser al menos uno." }),
      })
      .optional(),
    /** Solo en las orales. */
    minutos: z
      .number()
      .int({ message: "Los minutos tienen que ser un número entero." })
      .min(1, { message: "Una tarea oral dura al menos un minuto." })
      .optional(),
    /**
     * Solo en las orales: si el alumno la graba y la manda en vez de hacerla
     * en clase. Con valor por defecto para que las orales ya guardadas sigan
     * siendo lo que eran cuando se crearon: de clase.
     */
    grabada: z.boolean().default(false),
    criterios: z.array(criterioSchema).min(1, { message: "La tarea necesita al menos un criterio." }),
    /** Se le enseña al alumno solo después de corregir. */
    modelo: z.string().optional(),
  })
  .refine((d) => d.modalidad !== "escrita" || d.palabras !== undefined, {
    message: "Una tarea escrita necesita decir cuántas palabras se piden.",
  })
  .refine((d) => d.modalidad !== "oral" || d.minutos !== undefined, {
    message: "Una tarea oral necesita decir cuántos minutos dura.",
  })
  .refine((d) => d.modalidad !== "escrita" || d.minutos === undefined, {
    message: "Una tarea escrita no lleva minutos: eso es de las orales.",
  })
  .refine((d) => d.modalidad !== "oral" || d.palabras === undefined, {
    message: "Una tarea oral no lleva número de palabras: eso es de las escritas.",
  })
  .refine((d) => !d.palabras || d.palabras.minimo <= d.palabras.maximo, {
    message: "El mínimo de palabras no puede ser mayor que el máximo.",
  })
  .refine((d) => new Set(d.criterios.map((c) => c.id)).size === d.criterios.length, {
    message: "Dos criterios no pueden compartir el mismo id: sus notas se pisarían.",
  })
  .refine((d) => d.modalidad === "oral" || !d.grabada, {
    message: "Solo una tarea oral se puede grabar: en una escrita eso no significa nada.",
  });

export type Expresion = z.infer<typeof expresionSchema>;

export function analizarExpresion(datos: unknown): Expresion | null {
  if (typeof datos !== "object" || datos === null) return null;
  if ((datos as { ejercicio?: unknown }).ejercicio !== "expresion") return null;
  const r = expresionSchema.safeParse(datos);
  return r.success ? r.data : null;
}

export type ExpresionPublica = Omit<Expresion, "modelo"> & { modelo?: string };

/**
 * Lo que puede ver el alumno.
 *
 * El modelo solo viaja cuando la tarea ya está corregida. No basta con
 * esconderlo en pantalla: si sale del servidor, se lee en el código de la
 * página y el alumno copia. Es la misma regla que protege las soluciones de
 * los ejercicios autocorregibles.
 *
 * Los criterios sí viajan siempre: el alumno tiene derecho a saber con qué
 * se le va a puntuar antes de escribir.
 */
export function versionPublicaExpresion(datos: Expresion, corregida: boolean): ExpresionPublica {
  const { modelo, ...resto } = datos;
  return corregida ? { ...resto, modelo } : resto;
}

/** Si esta tarea se graba y se entrega, en vez de hacerse en clase. */
export function esGrabada(datos: Expresion): boolean {
  return datos.modalidad === "oral" && datos.grabada;
}

/**
 * Lo que aceptamos recibir de un alumno, antes de comprimir. Cincuenta megas
 * dejan pasar un archivo del móvil sin abrir la puerta a una película.
 */
export const MAXIMO_AUDIO_RECIBIDO = 50 * 1024 * 1024;

/**
 * Lo que aceptamos guardar, ya comprimido. Quince minutos rondan los 5 MB, así
 * que diez son holgados: está para que un audio que el compresor no logre
 * encoger no entre entero en la base.
 */
export const MAXIMO_AUDIO_GUARDADO = 10 * 1024 * 1024;

/**
 * El tope duro de la grabadora. Los minutos de la tarea solo avisan —pasarse
 * es un error que puntúa el profesor, y cortar a media frase es la peor forma
 * de enterarse—; esto es lo que impide una grabación de dos horas.
 */
export const MINUTOS_MAXIMOS_GRABACION = 15;

/**
 * La tarea de expresión enganchada a este paso, o `null` si el paso no tiene
 * ejercicio o el que tiene no es de expresión.
 *
 * Vive aquí, y no dentro de `valorar`, con el mismo criterio que
 * `maximoDeEscucha` en `lib/escuchas.ts`: de aquí salen los máximos de cada
 * criterio, así que es el tope real de la rúbrica. Si viviera en la acción,
 * ningún script podría comprobar que un criterio inventado no cuela.
 */
export async function expresionDelPaso(pasoId: string): Promise<Expresion | null> {
  const vinculo = await prisma.pasoEjercicio.findFirst({
    where: { pasoId },
    orderBy: { orden: "asc" },
    select: { ejercicio: { select: { datos: true } } },
  });
  if (!vinculo) return null;
  return analizarExpresion(vinculo.ejercicio.datos);
}

/**
 * Si esta rúbrica se puede guardar, o el motivo del no.
 *
 * Exige que **todos** los criterios tengan nota: media rúbrica guardada
 * sería una tarea que parece corregida y no lo está, y el alumno vería una
 * nota que no es la suya.
 *
 * En una escrita, y en una oral grabada, exige además que haya entrega: sin
 * texto o sin audio que corregir, no hay nada que valorar, y sin este freno
 * el profesor podía corregir antes de que el alumno mandara nada —`puedeEntregar`
 * o `puedeEntregarAudio` le cerrarían la puerta para siempre con «ya está
 * corregida», sin haber entregado nunca—. La excepción es la oral de clase:
 * ahí no hay entrega que guardar, y valorar sin ella es justo lo normal.
 */
export function puedeValorarse(
  datos: Expresion,
  notas: Record<string, number>,
  entrega: string | null,
): string | null {
  // Se puntúa lo que se ha leído o lo que se ha oído. Una oral de clase es la
  // excepción a propósito: ahí no hay entrega y valorar sin ella es lo normal.
  if ((datos.modalidad === "escrita" || esGrabada(datos)) && !entrega) {
    return "El alumno todavía no ha entregado nada: no se puede corregir.";
  }

  const ids = new Set(datos.criterios.map((c) => c.id));

  for (const clave of Object.keys(notas)) {
    if (!ids.has(clave)) return "Hay una nota de un criterio que esta tarea no tiene.";
  }

  for (const criterio of datos.criterios) {
    const nota = notas[criterio.id];
    if (nota === undefined) return `Falta la nota de «${criterio.nombre}».`;
    if (!Number.isInteger(nota)) return `La nota de «${criterio.nombre}» tiene que ser un número entero.`;
    if (nota < 0) return `La nota de «${criterio.nombre}» no puede ser negativa.`;
    if (nota > criterio.maximo) {
      return `«${criterio.nombre}» vale como mucho ${criterio.maximo}.`;
    }
  }
  return null;
}

/** Los puntos del paso: la suma de las notas. Llamar solo tras `puedeValorarse`. */
export function puntosDe(datos: Expresion, notas: Record<string, number>): number {
  return datos.criterios.reduce((suma, c) => suma + (notas[c.id] ?? 0), 0);
}

/**
 * Si la asignación es de este profesor.
 *
 * `false` también cuando la asignación no existe: la acción que llama a esto
 * no tiene por qué distinguir «no es tuya» de «no existe», igual que las
 * páginas de detalle de `profe/` resuelven las dos con el mismo `notFound()`.
 *
 * No decide si un administrador puede saltárselo: eso es un asunto de rol,
 * no de datos, y vive en quien llama —igual que en las páginas de `profe/`,
 * que comprueban `usuario.role !== "ADMIN"` ellas mismas en vez de
 * metérselo a esta función—.
 */
export async function esDeEsteProfesor(asignacionId: string, profesorId: string): Promise<boolean> {
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { profesorId: true },
  });
  return asignacion?.profesorId === profesorId;
}

/**
 * El tope de lo que cabe en una entrega.
 *
 * Holgado a propósito: la tarea más larga del DELE pide 250 palabras, que son
 * unos 1.700 caracteres, así que aquí caben diez redacciones seguidas. No está
 * para corregirle la extensión a nadie —de eso ya avisa el contador de
 * palabras— sino para que un POST de dos megas no acabe en la columna.
 */
export const MAXIMO_ENTREGA = 20000;

/**
 * Si el alumno todavía puede entregar este texto en este paso, o el motivo
 * del no.
 *
 * Tres negativas. El tamaño, porque `entregar` es un endpoint público y nadie
 * tiene por qué mandar dos megas. Que el paso pida de verdad una redacción:
 * sin eso, un `pasoId` cualquiera se llevaba una fila de `PasoCompletado`, el
 * paso quedaba «hecho» y la bandeja del profesor listaba algo que al abrirlo
 * contestaba `notFound()`. Y que no esté corregida ya: puede reescribir hasta
 * que el profesor corrige y no después, que es el equilibrio entre dejarle
 * mejorar y que la corrección no quede colgando de un texto que ya no existe.
 */
export async function puedeEntregar(
  asignacionId: string,
  pasoId: string,
  texto: string,
): Promise<string | null> {
  if (texto.length > MAXIMO_ENTREGA) {
    return `Eso es demasiado largo: caben ${MAXIMO_ENTREGA.toLocaleString("es-ES")} caracteres.`;
  }

  // Tres negativas separadas y no encadenadas: `datos` puede ser `null` y
  // `esGrabada(null)` reventaría, y el alumno que manda un texto a una tarea
  // grabada merece que se lo digan, no un «este paso no pide ninguna
  // redacción» que no describe lo que pasa.
  const datos = await expresionDelPaso(pasoId);
  if (!datos) return "Este paso no pide ninguna redacción.";
  if (esGrabada(datos)) return "Esta tarea se entrega grabada, no escrita.";
  if (datos.modalidad !== "escrita") return "Este paso no pide ninguna redacción.";

  const registro = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { verificadoEl: true },
  });
  if (registro?.verificadoEl) {
    return "Esta tarea ya está corregida: no se puede cambiar lo entregado.";
  }
  return null;
}

/**
 * Si el alumno todavía puede mandar una grabación en este paso, o el motivo
 * del no.
 *
 * Las mismas dos negativas que la escrita, menos la del tamaño: ahí lo que
 * llega es un archivo, y su tope lo comprueba la ruta con `MAXIMO_AUDIO_RECIBIDO`
 * antes de leerlo entero en memoria.
 */
export async function puedeEntregarAudio(
  asignacionId: string,
  pasoId: string,
): Promise<string | null> {
  const datos = await expresionDelPaso(pasoId);
  if (!datos || !esGrabada(datos)) {
    return "Este paso no pide ninguna grabación.";
  }

  const registro = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { verificadoEl: true },
  });
  if (registro?.verificadoEl) {
    return "Esta tarea ya está corregida: no se puede cambiar lo entregado.";
  }
  return null;
}
