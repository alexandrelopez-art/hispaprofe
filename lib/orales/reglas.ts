import { prisma } from "@/lib/prisma";
import { CRITERIOS, TOPE_SEGUNDOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";
import { fmtNota, pasoDe } from "@/lib/orales/formato";
import { estudianteAsignable } from "@/lib/estudiantes";

/**
 * Las reglas de la evaluación oral. Cada una devuelve el motivo del rechazo
 * o `null`, como `puedeBloquearse` y `puedeEngancharse`.
 *
 * Viven fuera de `lib/acciones-orales.ts` porque una acción de servidor
 * necesita sesión de Clerk y contexto de petición, así que no se puede
 * llamar desde un script. Lo que está fuera es lo único verificable.
 */

/**
 * Regla 3: a una ficha suprimida no se le crea un examen.
 *
 * No es una regla nueva de aquí; `lib/estudiantes.ts` ya la tiene escrita y
 * explica que existe porque se olvidó en tres consultas. Un examen es
 * exactamente el tipo de fila que la supresión no debe volver a ver nacer.
 *
 * Sin estudiante devuelve `null`: el turno es una pausa y no hay a quién
 * comprobar.
 */
export async function puedeExaminarse(
  estudianteId: string | null,
): Promise<string | null> {
  if (await estudianteAsignable(estudianteId)) return null;
  return "Esa ficha está suprimida. No se le puede dar turno de examen.";
}

/**
 * Regla 6: un sujet tiene un origen y solo uno. O una imagen subida o una
 * tarea de Recursos, nunca las dos ni ninguna.
 */
export function origenDeSujetValido(origen: {
  imagenId?: string | null;
  recursoId?: string | null;
}): string | null {
  const conImagen = Boolean(origen.imagenId);
  const conRecurso = Boolean(origen.recursoId);
  if (conImagen && conRecurso) {
    return "Un sujet sale de una imagen o de una tarea de Recursos, no de las dos.";
  }
  if (!conImagen && !conRecurso) {
    return "Falta el documento: sube una imagen o elige una tarea de Recursos.";
  }
  return null;
}

/**
 * Regla 5: la nota no puede salirse del criterio.
 *
 * Devuelve la nota ya movida, capada arriba y abajo.
 *
 * El redondeo a dos decimales no es por la coma flotante: 0,25 y 0,5 son
 * potencias de dos y se suman exactas, así que dentro de esta rejilla nunca
 * aparece un 2,7755e-17. Está por lo que entra de fuera —una nota con más
 * decimales, del archivo de la tanda 2 o de un criterio al que algún día se
 * le cambie el paso—: sale de aquí encajada en la rejilla en vez de
 * arrastrar decimales que la ficha no sabría enseñar.
 */
export function ajustarNota(
  actual: number | null,
  direccion: 1 | -1,
  maximo: number,
): number {
  const paso = pasoDe(maximo);
  const desde = actual ?? 0;
  const bruto = desde + direccion * paso;
  const dentro = Math.min(maximo, Math.max(0, bruto));
  return Math.round(dentro * 100) / 100;
}

/**
 * La misma regla, del lado del servidor: lo que llega por una acción no
 * pasó necesariamente por los botones.
 */
export function notaDentroDelCriterio(
  key: ClaveCriterio,
  valor: number,
): string | null {
  const criterio = CRITERIOS.find((c) => c.key === key);
  if (!criterio) return `«${key}» no es un criterio de esta parrilla.`;
  if (!Number.isFinite(valor)) return "Esa nota no es un número.";
  if (valor < 0) return "Una nota no puede ser negativa.";
  if (valor > criterio.maximo) {
    return `${criterio.titulo} va sobre ${fmtNota(criterio.maximo)}; ${fmtNota(valor)} se sale.`;
  }
  return null;
}

/**
 * Regla 4: el cronómetro nunca pasa de cinco minutos. El reloj del
 * navegador ya se detiene solo, pero lo que llega a la acción puede venir
 * de una pestaña dormida que despertó con un salto de reloj.
 */
export function caparTiempo(segundos: number): number {
  if (!Number.isFinite(segundos) || segundos < 0) return 0;
  return Math.min(TOPE_SEGUNDOS, segundos);
}

/**
 * Regla 7: el grupo que se pega en el horario es de quien pide, o pide un
 * administrador.
 *
 * `pegarHorario` recibe el `convocatoriaId` y el `grupoId` en el mismo
 * `formData`. Comprobar la convocatoria no dice nada del grupo: acertando el
 * id de un grupo ajeno se leerían nombre, apellido y correo de sus miembros
 * por el emparejamiento, y se crearían turnos que enlazan a alumnos de otro
 * profesor. Gemela de `grupoAsignable` en `lib/acciones-clases.ts`, pero
 * viviendo aquí para poder verificarse desde un script, y devolviendo el
 * motivo del rechazo como el resto de estas reglas.
 */
export async function grupoDeProfesor(
  grupoId: string,
  profesorId: string,
  esAdmin: boolean,
): Promise<string | null> {
  if (esAdmin) return null;
  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    select: { profesorId: true },
  });
  if (!grupo) return "Ese grupo no existe.";
  if (grupo.profesorId !== profesorId) return "Ese grupo no es tuyo.";
  return null;
}

/**
 * Regla 8: el sujet que se guarda en la evaluación es de la misma
 * convocatoria que el turno.
 *
 * `Sujeto` guarda contenido de examen —título, descripción, preguntas,
 * url—, así que sin esto un `sujetoId` acertado de otra convocatoria
 * filtraría ese contenido entre profesores en cuanto una pantalla resolviera
 * la relación.
 *
 * Sin sujet devuelve `null`: significa que todavía no se ha elegido
 * documento, no que el elegido sea inválido.
 */
export async function sujetoDeConvocatoria(
  sujetoId: string | null | undefined,
  convocatoriaId: string,
): Promise<string | null> {
  if (!sujetoId) return null;
  const sujeto = await prisma.sujeto.findUnique({
    where: { id: sujetoId },
    select: { convocatoriaId: true },
  });
  if (!sujeto) return "Ese sujet no existe.";
  if (sujeto.convocatoriaId !== convocatoriaId) {
    return "Ese sujet es de otra convocatoria.";
  }
  return null;
}
