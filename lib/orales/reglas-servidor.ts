import { prisma } from "@/lib/prisma";
import { estudianteAsignable } from "@/lib/estudiantes";

/**
 * Las reglas de la evaluación oral que sí tocan la base. Viven separadas de
 * `lib/orales/reglas.ts` —que tiene las puras— para que un componente de
 * cliente pueda importar `ajustarNota` sin arrastrar Prisma (y con él `pg` y
 * el módulo `dns` de Node) al navegador.
 *
 * No lleva el marcador `import "server-only"`, aunque sería lo idiomático
 * en Next: ese paquete resuelve a un módulo que lanza sin condiciones fuera
 * del bundler de Next (solo se vuelve inocuo bajo la condición de export
 * `react-server`), y `scripts/verificar-orales.ts` importa estas mismas
 * funciones para poder probarlas con `npx tsx`, sin pasar por ese bundler.
 * Ponerlo aquí rompería ese script. La disciplina de no importar esto desde
 * un componente de cliente queda en manos de quien edite el árbol de
 * `components/`, no del compilador.
 *
 * También son las únicas verificables desde un script: una acción de
 * servidor necesita sesión y contexto de petición, así que no se
 * puede llamar desde `scripts/verificar-orales.ts`. Lo que está aquí sí.
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
