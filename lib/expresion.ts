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
        minimo: z.number().int().min(1, { message: "El mínimo de palabras tiene que ser al menos uno." }),
        maximo: z.number().int().min(1, { message: "El máximo de palabras tiene que ser al menos uno." }),
      })
      .optional(),
    /** Solo en las orales. */
    minutos: z
      .number()
      .int({ message: "Los minutos tienen que ser un número entero." })
      .min(1, { message: "Una tarea oral dura al menos un minuto." })
      .optional(),
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

/**
 * Si esta rúbrica se puede guardar, o el motivo del no.
 *
 * Exige que **todos** los criterios tengan nota: media rúbrica guardada
 * sería una tarea que parece corregida y no lo está, y el alumno vería una
 * nota que no es la suya.
 */
export function puedeValorarse(
  datos: Expresion,
  notas: Record<string, number>,
): string | null {
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
 * Si el alumno todavía puede entregar o reescribir, o el motivo del no.
 *
 * Puede reescribir hasta que el profesor corrige, y no después: es el
 * equilibrio entre dejarle mejorar y que la corrección no quede colgando de
 * un texto que ya no existe.
 */
export async function puedeEntregar(
  asignacionId: string,
  pasoId: string,
): Promise<string | null> {
  const registro = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { verificadoEl: true },
  });
  if (registro?.verificadoEl) {
    return "Esta tarea ya está corregida: no se puede cambiar lo entregado.";
  }
  return null;
}
