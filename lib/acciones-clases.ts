"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import {
  abrirDeber,
  borrarClase,
  cambioDePrecio,
  cerrarDeber,
  cerrarDeberesDeClase,
  congelarImporte,
  importeCaduca,
  sincronizarDeberes,
  validarClase,
} from "@/lib/clases";
import { estudianteAsignable } from "@/lib/estudiantes";
import { deInput } from "@/lib/fechas";
import type { EstadoClase } from "@/lib/generated/prisma/enums";

/** Parte «alumno:abc» o «grupo:xyz» en lo que entiende la base. */
function partirDestinatario(bruto: string): {
  estudianteId: string | null;
  grupoId: string | null;
} {
  const [clase, id] = bruto.split(":");
  if (clase === "alumno" && id) return { estudianteId: id, grupoId: null };
  if (clase === "grupo" && id) return { estudianteId: null, grupoId: id };
  return { estudianteId: null, grupoId: null };
}

/**
 * La clase existe y es de quien pide, o es un administrador. Devuelve la
 * clase y a quien pide para no volver a leer ninguna de las dos.
 */
async function exigirClaseSuya(claseId: string) {
  const usuario = await exigirProfesor();
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      id: true,
      profesorId: true,
      minutos: true,
      estado: true,
      estudianteId: true,
      grupoId: true,
      deberes: true,
      importeCentimos: true,
      importeAMano: true,
    },
  });
  if (!clase) throw new Error("Esa clase no existe.");
  if (clase.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    throw new Error("Esa clase no es tuya.");
  }
  return { clase, usuario };
}

/**
 * El deber es de esta clase. Sin esto, acertar un `claseId` propio bastaría
 * para cerrar o abrir el deber de la clase de otro profesor: el permiso
 * estaría comprobado, pero sobre el recurso equivocado.
 */
async function esDeberDeLaClase(
  claseId: string,
  deberId: string,
): Promise<boolean> {
  const deber = await prisma.deber.findUnique({
    where: { id: deberId },
    select: { claseId: true },
  });
  return deber?.claseId === claseId;
}

/**
 * El grupo del que se cuelga la clase es de quien pide (o pide un admin).
 *
 * `partirDestinatario` se cree cualquier id que venga en el cuerpo del POST,
 * así que sin esto una petición fabricada colgaría una clase del grupo de
 * otro profesor y la ficha enseñaría los nombres y correos de sus miembros.
 *
 * Del `estudianteId` no se comprueba aquí la propiedad: no existe en el
 * modelo una pertenencia «este estudiante es de este profesor» que poder
 * exigir, y filtrar por `role: STUDENT` echaría fuera a quien haya sido
 * ascendido a profesor después de recibir clases. Lo que sí se comprueba, en
 * `estudianteAsignable`, es que no sea una ficha suprimida.
 */
async function grupoAsignable(
  usuario: { id: string; role: string },
  grupoId: string | null,
): Promise<boolean> {
  if (!grupoId || usuario.role === "ADMIN") return true;
  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    select: { profesorId: true },
  });
  return grupo?.profesorId === usuario.id;
}

function refrescar(claseId?: string) {
  revalidatePath("/profe/clases");
  if (claseId) revalidatePath(`/profe/clases/${claseId}`);
  revalidatePath("/dashboard");
}

/**
 * Parte y valida los campos que crear y editar comparten. Null si algo no
 * vale, para que quien llama vuelva sin escribir sin repetir la comprobación.
 */
function datosDeClase(formData: FormData): {
  empiezaEl: Date;
  minutos: number;
  estudianteId: string | null;
  grupoId: string | null;
  donde: string | null;
  enlace: string | null;
} | null {
  // `deInput` y no `new Date`: la cadena del navegador no lleva offset y hay
  // que leerla como hora de Madrid, no como hora del servidor.
  const empiezaEl = deInput(String(formData.get("empiezaEl") ?? ""));
  const minutos = Number(String(formData.get("minutos") ?? "0"));
  const { estudianteId, grupoId } = partirDestinatario(
    String(formData.get("destinatario") ?? ""),
  );

  if (!empiezaEl) return null;
  if (validarClase({ estudianteId, grupoId, minutos })) return null;

  return {
    empiezaEl,
    minutos,
    estudianteId,
    grupoId,
    donde: String(formData.get("donde") ?? "").trim() || null,
    enlace: String(formData.get("enlace") ?? "").trim() || null,
  };
}

/**
 * Lo que hay que escribir en las columnas del precio, o el motivo del rechazo.
 *
 * Aparte de `datosDeClase` porque no es un campo más: decide dos columnas a la
 * vez, puede no tocar ninguna, y puede negarse. Meter eso en el objeto que se
 * escribe tal cual en la base habría obligado a que `datosDeClase` supiera de
 * rechazos.
 *
 * Devuelve un objeto vacío cuando no hay nada que cambiar, para poder
 * esparcirlo en el `data` sin condicionales por el medio.
 */
function precioDeClase(
  formData: FormData,
  teniaAMano: boolean,
): { importeCentimos?: number | null; importeAMano?: boolean; motivo?: string } {
  const cambio = cambioDePrecio(String(formData.get("precio") ?? ""), teniaAMano);
  if (cambio.clase === "invalido") return { motivo: cambio.motivo };
  if (cambio.clase === "escribir") {
    return { importeCentimos: cambio.centimos, importeAMano: true };
  }
  if (cambio.clase === "borrar") {
    // Vuelve a automático: el importe se borra para que la tarifa lo recalcule
    // al marcarla dada. Es la única forma de deshacer un precio escrito, y sin
    // ella teclear un número una vez dejaría esa clase fuera de la tarifa para
    // siempre.
    return { importeCentimos: null, importeAMano: false };
  }
  return {};
}

export async function crearClase(formData: FormData) {
  const usuario = await exigirProfesor();

  const datos = datosDeClase(formData);
  if (!datos) return;
  if (!(await grupoAsignable(usuario, datos.grupoId))) return;
  if (!(await estudianteAsignable(datos.estudianteId))) return;

  // `false` porque una clase que todavía no existe no tenía ningún precio a
  // mano, así que un campo vacío aquí solo puede significar «sin cambio», y el
  // objeto vacío que devuelve deja los valores por defecto de la columna.
  const precio = precioDeClase(formData, false);
  if (precio.motivo) return;

  await prisma.clase.create({
    data: {
      profesorId: usuario.id,
      ...datos,
      ...precio,
    },
  });

  refrescar();
}

export async function editarClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  const { clase, usuario } = await exigirClaseSuya(claseId);

  const datos = datosDeClase(formData);
  if (!datos) return;
  if (!(await grupoAsignable(usuario, datos.grupoId))) return;

  const cambioDestinatario =
    datos.estudianteId !== clase.estudianteId ||
    datos.grupoId !== clase.grupoId;

  // La lápida solo se rechaza como destinatario nuevo: una clase que ya era
  // suya se sigue pudiendo corregir —son horas trabajadas y su opción sigue
  // en el desplegable— pero no se le puede pasar otra.
  if (cambioDestinatario && !(await estudianteAsignable(datos.estudianteId))) {
    return;
  }

  const precio = precioDeClase(formData, clase.importeAMano);
  if (precio.motivo) return;

  // El importe viejo solo caduca si el profesor no ha escrito ni borrado nada:
  // si tocó el campo, lo que él dice manda y `precio` ya trae las dos columnas.
  const noTocoElPrecio = precio.importeCentimos === undefined;
  const caduca =
    noTocoElPrecio &&
    importeCaduca(clase.estado, datos.minutos, clase.minutos, clase.importeAMano);

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      ...datos,
      ...precio,
      ...(caduca ? { importeCentimos: null, importeAMano: false } : {}),
    },
  });

  // Solo si cambió el destinatario: `destinatariosDe` lee los miembros de
  // ahora, así que rehacer los deberes por cualquier otra edición borraría
  // filas cerradas de quien salió del grupo hace meses.
  if (cambioDestinatario) await sincronizarDeberes(claseId);

  refrescar(claseId);
}

/** Las notas privadas y el texto de los deberes. */
export async function guardarFicha(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  const { clase } = await exigirClaseSuya(claseId);

  const deberes = String(formData.get("deberes") ?? "").trim() || null;

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      notas: String(formData.get("notas") ?? "").trim() || null,
      deberes,
    },
  });

  // Solo si cambió el texto: guardar una nota no puede repartir los deberes
  // de marzo entre los miembros que tiene el grupo hoy.
  if (deberes !== clase.deberes) await sincronizarDeberes(claseId);

  refrescar(claseId);
}

/**
 * Agendada, dada o anulada. Del importe se encarga `congelarImporte`: aquí
 * solo viven el permiso, el estado y la revalidación.
 */
export async function cambiarEstadoClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoClase;
  if (!claseId) return;
  if (!["AGENDADA", "DADA", "ANULADA"].includes(estado)) return;

  await exigirClaseSuya(claseId);

  await prisma.clase.update({
    where: { id: claseId },
    data: { estado },
  });

  // Después de escribir el estado, porque la regla lo lee de la fila.
  if (estado === "DADA") await congelarImporte(claseId);

  refrescar(claseId);
}

export async function cerrarDeberDeClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const deberId = String(formData.get("deberId") ?? "");
  if (!claseId || !deberId) return;
  await exigirClaseSuya(claseId);
  if (!(await esDeberDeLaClase(claseId, deberId))) return;

  await cerrarDeber(deberId);
  refrescar(claseId);
}

export async function abrirDeberDeClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const deberId = String(formData.get("deberId") ?? "");
  if (!claseId || !deberId) return;
  await exigirClaseSuya(claseId);
  if (!(await esDeberDeLaClase(claseId, deberId))) return;

  await abrirDeber(deberId);
  refrescar(claseId);
}

export async function cerrarTodos(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  await cerrarDeberesDeClase(claseId);
  refrescar(claseId);
}

/**
 * Borra la clase si no está dada. Después no se puede volver a su ficha, así
 * que lleva a la lista en vez de refrescar una página que ya no existe.
 */
export async function borrarLaClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  if (!(await borrarClase(claseId))) return;

  revalidatePath("/profe/clases");
  revalidatePath("/dashboard");
  redirect("/profe/clases");
}
