import { getUsuarioActual } from "@/lib/usuario";
import { esAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/** Gemelo de `exigirProfesor`, un escalon por encima. */
export async function exigirAdmin() {
  const usuario = await getUsuarioActual();
  if (!esAdmin(usuario)) {
    throw new Error("Solo un administrador puede hacer esto.");
  }
  return usuario!;
}

/**
 * Si quitarle el rol a este administrador dejaria la plataforma sin
 * ninguno, la respuesta es no. Vive aqui y no dentro de la accion porque
 * una accion de servidor no se puede llamar desde un script de verificacion.
 */
export async function puedeQuitarseElRol(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true },
  });
  if (!usuario) return false;
  if (usuario.role !== "ADMIN") return true;

  const cuantos = await prisma.user.count({ where: { role: "ADMIN" } });
  return cuantos > 1;
}

/**
 * Si a esta persona se le puede subir el rol a profesor.
 *
 * La negativa que importa es la ficha suprimida: `suprimir` la deja como
 * STUDENT a propósito —«la lápida se queda sin poderes»—, que es justo el rol
 * al que el panel le pinta encima el botón «Hacer profesor». Sin esta guarda,
 * un clic corriente le devuelve los poderes que la supresión le quitó.
 *
 * A un administrador tampoco: subirlo a profesor sería bajarlo de rango.
 */
export async function puedeHacerseProfesor(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true, suprimidoEl: true },
  });
  if (!usuario) return false;
  if (usuario.suprimidoEl) return false;
  return usuario.role !== "ADMIN";
}

/**
 * Si bloquear a esta persona es mala idea, el motivo; si no, null.
 *
 * Las dos negativas son las mismas que protegen a `quitarProfesor`, y por el
 * mismo motivo: sin ellas un clic te deja fuera de tu propia aplicación y
 * solo se arregla entrando a la base a mano. ADMIN_EMAILS no es red aquí,
 * porque esa variable sube el rol pero no abre la puerta.
 */
export async function puedeBloquearse(
  usuarioId: string,
  yoId: string,
): Promise<string | null> {
  if (usuarioId === yoId) return "No puedes bloquearte a ti mismo.";

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true, bloqueadoEl: true },
  });
  if (!usuario) return "Esa persona no existe.";
  if (usuario.role !== "ADMIN") return null;

  // Solo cuentan los administradores que pueden entrar de verdad.
  const cuantos = await prisma.user.count({
    where: { role: "ADMIN", bloqueadoEl: null },
  });
  if (cuantos <= 1 && !usuario.bloqueadoEl) {
    return "No puedes bloquear al último administrador.";
  }
  return null;
}

/**
 * Cierra el acceso y anula lo que esa persona ya no va a poder hacer.
 *
 * Se anulan las clases futuras donde es el estudiante o el profesor, porque
 * ninguna de las dos se va a dar. No se tocan las de un grupo donde solo es
 * un miembro más: esa clase sigue siendo de los demás.
 *
 * La fecha solo se escribe si no había: reescribirla perdería el «desde
 * cuándo», que es toda la razón de que esto sea una fecha y no un booleano.
 */
export async function bloquear(usuarioId: string): Promise<void> {
  const ahora = new Date();

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: usuarioId, bloqueadoEl: null },
      data: { bloqueadoEl: ahora },
    }),
    prisma.clase.updateMany({
      where: {
        estado: "AGENDADA",
        empiezaEl: { gte: ahora },
        OR: [{ estudianteId: usuarioId }, { profesorId: usuarioId }],
      },
      data: { estado: "ANULADA" },
    }),
  ]);
}

/**
 * Devuelve el acceso. No resucita las clases anuladas: anularlas fue una
 * decisión, y deshacerla a espaldas del profesor sería peor que dejársela.
 *
 * A una ficha suprimida se le niega: quien está suprimido está bloqueado por
 * definición, y abrirle la puerta dejaría el estado que el diseño declara
 * imposible. El filtro va dentro de la escritura, como en `borrarClase`, para
 * que no haya carrera entre comprobar y escribir —el administrador puede
 * tener la misma lista abierta en dos pestañas—. Devuelve si hizo algo.
 */
export async function desbloquear(usuarioId: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { id: usuarioId, suprimidoEl: null },
    data: { bloqueadoEl: null },
  });
  return count > 0;
}

/**
 * Suprimir es irreversible, así que exige haber pasado antes por un gesto
 * que sí se puede deshacer: solo se suprime a quien ya está bloqueado.
 *
 * El recuento de administradores activos sigue estando, pero como red de
 * último recurso: al último administrador activo nunca se le pudo bloquear,
 * así que quien llega hasta aquí bloqueado es uno que sobraba, y el recuento
 * solo salta si alguien ha tocado la base a mano.
 */
export async function puedeSuprimirse(
  usuarioId: string,
  yoId: string,
): Promise<string | null> {
  if (usuarioId === yoId) return "No puedes suprimirte a ti mismo.";

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true, bloqueadoEl: true, suprimidoEl: true },
  });
  if (!usuario) return "Esa persona no existe.";
  if (usuario.suprimidoEl) return "Esa ficha ya está suprimida.";
  if (!usuario.bloqueadoEl) return "Primero hay que bloquearla.";

  if (usuario.role === "ADMIN") {
    // El bloqueo ya protegió al último administrador activo: quien llega
    // hasta aquí está bloqueado y por tanto no contaba como activo. Esta
    // red solo salta si alguien ha tocado la base a mano.
    const activos = await prisma.user.count({
      where: { role: "ADMIN", bloqueadoEl: null },
    });
    if (activos === 0) return "No queda ningún administrador activo.";
  }
  return null;
}

/**
 * Vacía la ficha sin borrar la fila.
 *
 * La fila se queda como lápida porque sus clases apuntan a ella: borrarla
 * las dejaría sin estudiante y sin grupo, que es el estado que `validarClase`
 * prohíbe. Las horas trabajadas son del profesor, no de quien se va.
 *
 * Todo en una transacción: una supresión a medias dejaría a alguien con la
 * ficha vaciada pero el progreso intacto, que es lo peor de los dos mundos.
 *
 * Y se lleva sus grabaciones: los archivos privados son la voz de esa persona
 * y desaparecen con ella. Ver el porqué junto al `deleteMany`.
 */
export async function suprimir(usuarioId: string): Promise<void> {
  const ahora = new Date();

  await prisma.$transaction([
    prisma.cuentaGoogle.deleteMany({ where: { usuarioId } }),
    prisma.miembroGrupo.deleteMany({ where: { estudianteId: usuarioId } }),
    prisma.deber.deleteMany({ where: { estudianteId: usuarioId } }),
    // Borrar la asignación se lleva en cascada sus PasoCompletado: los pasos
    // que marcó, lo que respondió en cada ejercicio y los puntos que le dieron.
    prisma.asignacion.deleteMany({ where: { estudianteId: usuarioId } }),

    // Lo que escribió sobrevive; la firma no.
    prisma.recorrido.updateMany({
      where: { autorId: usuarioId },
      data: { autorId: null },
    }),
    prisma.ejercicio.updateMany({
      where: { autorId: usuarioId },
      data: { autorId: null },
    }),
    // Un archivo privado es la voz de un alumno, no material del profesor:
    // se borra, no se desfirma. Desfirmarlo dejaba los bytes en la base para
    // siempre —y en cada copia de seguridad— sin que ninguna pantalla los
    // enseñara y sin nadie a quien devolvérselos, que es justo lo contrario
    // de lo que pide quien manda borrar los datos de su hija. Va antes que el
    // desfirmado, y los dos filtran por `privado`, para que el orden no
    // decida nada.
    prisma.archivo.deleteMany({
      where: { subidoPorId: usuarioId, privado: true },
    }),
    // Lo que subió el profesor sobrevive; la firma no.
    prisma.archivo.updateMany({
      where: { subidoPorId: usuarioId, privado: false },
      data: { subidoPorId: null },
    }),

    prisma.user.update({
      where: { id: usuarioId },
      data: {
        // El correo se sustituye y no se vacía porque la columna es única y
        // no acepta nulos. El id es un cuid, así que el nuevo es único por
        // construcción, y `.invalid` está reservado para que no sea de nadie.
        email: `suprimido-${usuarioId}@hispaprofe.invalid`,
        // Sin clerkId, si esa persona vuelve a registrarse empieza de cero
        // en vez de reengancharse a esta ficha.
        clerkId: null,
        firstName: null,
        lastName: null,
        nivel: null,
        tarifaCentimos: null,
        role: "STUDENT",
        suprimidoEl: ahora,
      },
    }),
  ]);
}
