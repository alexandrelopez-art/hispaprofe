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
 */
export async function listarEstudiantesElegibles<
  T extends Pick<Prisma.UserFindManyArgs, "select" | "include">,
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
