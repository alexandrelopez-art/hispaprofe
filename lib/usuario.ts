import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Devuelve la fila de User de la sesión actual.
 *
 * Tres casos, en este orden:
 *  1. Ya existe emparejada por clerkId. Se devuelve.
 *  2. Existe una fila con ese correo pero sin cuenta: la creó el profesor
 *     desde una lista. Se le engancha el clerkId y hereda sus asignaciones.
 *  3. No existe nada. Se crea.
 *
 * El paso 2 es seguro porque Clerk verifica la propiedad del correo antes
 * de emitir sesión, así que solo el dueño puede reclamar esa fila.
 */
export async function getUsuarioActual() {
  const { userId } = await auth();
  if (!userId) return null;

  const porClerk = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (porClerk) return porClerk;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const bruto =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!bruto) return null;
  const email = bruto.trim().toLowerCase();

  const porCorreo = await prisma.user.findUnique({ where: { email } });
  if (porCorreo) {
    return prisma.user.update({
      where: { id: porCorreo.id },
      data: {
        clerkId: userId,
        firstName: porCorreo.firstName ?? clerkUser.firstName,
        lastName: porCorreo.lastName ?? clerkUser.lastName,
      },
    });
  }

  return prisma.user.create({
    data: {
      clerkId: userId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
    },
  });
}

/** Alias del nombre antiguo. Quitar cuando no queden llamadas a syncUser. */
export const syncUser = getUsuarioActual;
