import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { esCorreoDeAdmin, estaBloqueado } from "@/lib/roles";

/**
 * Sube a ADMIN a quien esté en ADMIN_EMAILS. Se comprueba en cada entrada,
 * así que da igual el orden: registrarse antes y añadir la variable después
 * funciona igual de bien.
 *
 * Solo sube, nunca baja: quitar el rol desde el panel no sirve de nada si el
 * correo sigue en la variable. Es la red que impide quedarse fuera de la
 * propia aplicación.
 *
 * Exportada solo para que scripts/verificar-admin.ts pueda probarla contra
 * filas reales: una regla que toca la base de datos y que nada puede
 * ejercitar es una regla de la que nadie puede fiarse. No se usa fuera de
 * este archivo ni de ese script.
 */
export async function ascenderSiEsAdmin<
  T extends { id: string; email: string; role: string },
>(usuario: T): Promise<T> {
  if (usuario.role === "ADMIN" || !esCorreoDeAdmin(usuario.email)) return usuario;
  return (await prisma.user.update({
    where: { id: usuario.id },
    data: { role: "ADMIN" },
  })) as unknown as T;
}

/**
 * El candado. A quien está bloqueado se le trata como si no hubiera sesión,
 * así que todos los `if (!usuario)` que ya existen —en cada página, en
 * `exigirProfesor`, en `exigirAdmin`— fallan cerrados sin una línea nueva.
 *
 * Va antes del ascenso por ADMIN_EMAILS a propósito: a un bloqueado no se le
 * sube el rol al entrar aunque su correo siga en la variable.
 */
async function dejarEntrar<
  T extends { id: string; email: string; role: string; bloqueadoEl: Date | null },
>(usuario: T): Promise<T | null> {
  if (estaBloqueado(usuario)) return null;
  return ascenderSiEsAdmin(usuario);
}

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
  if (porClerk) return dejarEntrar(porClerk);

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
    return dejarEntrar(
      await prisma.user.update({
        where: { id: porCorreo.id },
        data: {
          clerkId: userId,
          firstName: porCorreo.firstName ?? clerkUser.firstName,
          lastName: porCorreo.lastName ?? clerkUser.lastName,
        },
      }),
    );
  }

  return dejarEntrar(
    await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      },
    }),
  );
}

/**
 * La fecha de bloqueo de quien tiene la sesión abierta, o null.
 *
 * Existe solo para el cartel: como `getUsuarioActual` ya devolvió null, el
 * layout no puede distinguir «bloqueado» de «sin sesión». Se llama únicamente
 * cuando el usuario ha salido nulo, así que es una consulta de más solo en el
 * caso raro.
 */
export async function bloqueoDelActual(): Promise<Date | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const fila = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { bloqueadoEl: true },
  });
  return fila?.bloqueadoEl ?? null;
}

/** Alias del nombre antiguo. Quitar cuando no queden llamadas a syncUser. */
export const syncUser = getUsuarioActual;
