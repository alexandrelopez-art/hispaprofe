import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Los estudiantes a los que se les puede hacer algo: asignarles una
 * secuencia, importarles puntos, agendarles una clase o contarlos.
 *
 * Fuera queda la lápida de quien se suprimió. No es cosmética: si sale en una
 * lista, un clic normal le crea una `Asignacion` o un `PasoCompletado` —las
 * dos tablas que la supresión borra—, y quien ejerció su derecho al olvido
 * empieza a acumular progreso nuevo.
 *
 * Dentro se quedan los bloqueados a propósito: cerrarles la puerta no los
 * borra de las listas y conservan su correo real.
 *
 * Vive aquí y no repetido en cada página porque repetirlo es olvidarlo: así
 * fue como tres consultas se quedaron sin el filtro.
 */
const estudiantesElegibles = {
  role: "STUDENT",
  suprimidoEl: null,
} satisfies Prisma.UserWhereInput;

/** El mismo orden en todas las listas: por nombre, y por correo quien no lo tenga. */
const ordenDeLista: Prisma.UserOrderByWithRelationInput[] = [
  { firstName: "asc" },
  { email: "asc" },
];

/**
 * La lista de estudiantes elegibles con los campos que pida quien llama.
 *
 * El `where` y el orden los pone la función; el `select` o el `include` los
 * pone cada pantalla, que es lo único que cambia de una a otra.
 *
 * `where` y `orderBy` son `never` porque aquí se sobrescriben: sin eso, quien
 * pasara los suyos los vería desaparecer sin aviso y compilando en verde, que
 * es la única forma que quedaba de perder el filtro que este ayudante existe
 * para que no se pueda olvidar.
 */
export async function listarEstudiantesElegibles<
  T extends Pick<Prisma.UserFindManyArgs, "select" | "include"> & {
    where?: never;
    orderBy?: never;
  },
>(args: T): Promise<Prisma.UserGetPayload<T>[]> {
  return prisma.user.findMany({
    ...args,
    where: estudiantesElegibles,
    orderBy: ordenDeLista,
  }) as Promise<Prisma.UserGetPayload<T>[]>;
}

/** Cuántos son. Una lápida no cuenta como estudiante. */
export async function contarEstudiantesElegibles(): Promise<number> {
  return prisma.user.count({ where: estudiantesElegibles });
}

/**
 * A una ficha suprimida no se le escribe nada nuevo: ni una clase, ni una
 * asignación, ni un paso completado con sus puntos.
 *
 * Sacarla de las listas es solo interfaz: una pestaña abierta desde antes, un
 * marcador guardado o una petición fabricada siguen mandando su id, y
 * cualquiera de esas escrituras le devuelve una vida que la supresión le
 * quitó. Vive aquí, junto al filtro de las listas, porque es la misma regla
 * vista desde el otro lado, y fuera de las acciones porque una acción de
 * servidor no se puede llamar desde un script.
 *
 * Sin estudiante devuelve true: la clase es de un grupo y no hay a quién
 * comprobar. Del rol no se comprueba nada, porque a quien ascendió a profesor
 * después de recibir clases se le siguen pudiendo agendar. Del bloqueo
 * tampoco: bloquear es reversible y su ficha sigue siendo de alguien.
 */
export async function estudianteAsignable(
  estudianteId: string | null,
): Promise<boolean> {
  if (!estudianteId) return true;
  const estudiante = await prisma.user.findUnique({
    where: { id: estudianteId },
    select: { suprimidoEl: true },
  });
  return estudiante !== null && estudiante.suprimidoEl === null;
}
