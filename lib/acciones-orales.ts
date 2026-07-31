"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { exigirProfesor } from "@/lib/profesor";
import { CRITERIOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";
import { HORA_PAUSA } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";
import { parsearHorario } from "@/lib/orales/horario";
import {
  caparTiempo,
  notaDentroDelCriterio,
  origenDeSujetValido,
} from "@/lib/orales/reglas";
import {
  grupoDeProfesor,
  puedeExaminarse,
  sujetoDeConvocatoria,
} from "@/lib/orales/reglas-servidor";

/**
 * La convocatoria existe y es de quien pide, o es un administrador.
 * Gemela de `exigirClaseSuya` en lib/acciones-clases.ts.
 */
async function exigirConvocatoriaSuya(convocatoriaId: string) {
  const usuario = await exigirProfesor();
  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id: convocatoriaId },
    select: { id: true, profesorId: true },
  });
  if (!convocatoria) throw new Error("Esa convocatoria no existe.");
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    throw new Error("Esa convocatoria no es tuya.");
  }
  return { convocatoria, usuario };
}

/**
 * El turno es de una convocatoria de quien pide. Sin esto, acertar un
 * `turnoId` bastaría para escribir en el examen de otro profesor: el
 * permiso estaría comprobado, pero sobre el recurso equivocado.
 */
async function exigirTurnoSuyo(turnoId: string) {
  const usuario = await exigirProfesor();
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    select: {
      id: true,
      estudianteId: true,
      convocatoria: { select: { id: true, profesorId: true } },
    },
  });
  if (!turno) throw new Error("Ese turno no existe.");
  if (turno.convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    throw new Error("Ese turno no es tuyo.");
  }
  return turno;
}

export async function crearConvocatoria(formData: FormData) {
  const usuario = await exigirProfesor();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("La convocatoria necesita un nombre.");

  const creada = await prisma.convocatoria.create({
    data: { nombre, profesorId: usuario.id },
    select: { id: true },
  });
  revalidatePath("/profe/orales");
  redirect(`/profe/orales/${creada.id}`);
}

export async function archivarConvocatoria(formData: FormData) {
  const id = String(formData.get("convocatoriaId") ?? "");
  await exigirConvocatoriaSuya(id);
  const actual = await prisma.convocatoria.findUniqueOrThrow({
    where: { id },
    select: { archivada: true },
  });
  await prisma.convocatoria.update({
    where: { id },
    data: { archivada: !actual.archivada },
  });
  revalidatePath("/profe/orales");
}

export async function crearSujeto(formData: FormData) {
  const convocatoriaId = String(formData.get("convocatoriaId") ?? "");
  await exigirConvocatoriaSuya(convocatoriaId);

  const imagenId = String(formData.get("imagenId") ?? "") || null;
  const motivo = origenDeSujetValido({ imagenId });
  if (motivo) throw new Error(motivo);

  const numero = Number(formData.get("numero"));
  if (!Number.isInteger(numero) || numero < 1) {
    throw new Error("El número del sujet es un entero positivo.");
  }

  // Una pregunta por línea: es como se pegan desde el documento del liceo.
  const preguntas = String(formData.get("preguntas") ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  await prisma.sujeto.create({
    data: {
      convocatoriaId,
      numero,
      eje: String(formData.get("eje") ?? "").trim(),
      titulo: String(formData.get("titulo") ?? "").trim(),
      descripcion: String(formData.get("descripcion") ?? "").trim(),
      fuente: String(formData.get("fuente") ?? "").trim() || null,
      url: String(formData.get("url") ?? "").trim() || null,
      preguntas,
      imagenId,
    },
  });
  revalidatePath(`/profe/orales/${convocatoriaId}/sujets`);
  revalidatePath(`/profe/orales/${convocatoriaId}`);
}

export async function borrarSujeto(formData: FormData) {
  const id = String(formData.get("sujetoId") ?? "");
  const sujeto = await prisma.sujeto.findUnique({
    where: { id },
    select: { convocatoriaId: true, _count: { select: { evaluaciones: true } } },
  });
  if (!sujeto) throw new Error("Ese sujet no existe.");
  await exigirConvocatoriaSuya(sujeto.convocatoriaId);

  // Borrarlo dejaría exámenes sin saber de qué documento se examinaron.
  if (sujeto._count.evaluaciones > 0) {
    throw new Error("Ese sujet ya se usó en un examen. No se puede borrar.");
  }
  await prisma.sujeto.delete({ where: { id } });
  revalidatePath(`/profe/orales/${sujeto.convocatoriaId}/sujets`);
}

/**
 * Monta el horario de un grupo de una vez, pegando las filas del liceo.
 *
 * Una línea por turno, con tabuladores o punto y coma:
 *   Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI
 * Una línea con solo `---`, o una fila de columnas con `---` en el hueco de
 * la hora de paso, es una pausa. `parsearHorario` (lib/orales/horario.ts) se
 * encarga de los siete campos, los dos separadores, los dos formatos de
 * pausa y la herencia del día; aquí solo queda emparejar con estudiantes,
 * aplicar las reglas y escribir.
 *
 * Los estudiantes se emparejan por correo si la línea trae uno; si no, por
 * apellido y nombre entre los miembros del grupo. Lo que no se empareja se
 * queda sin estudiante y sale en la pantalla como pendiente, en vez de
 * fallar la importación entera por una tilde.
 *
 * Las escrituras van en un `$transaction`: sin él, un fallo a mitad de
 * camino (o el choque contra `@@unique([convocatoriaId, grupoId, orden])`
 * de un doble clic en «Montar el horario») dejaba media agenda pegada y sin
 * forma de completarla. Con la transacción, o se pega el horario entero, o
 * no se pega nada y el profesor puede volver a intentarlo: el formulario de
 * la página sigue disponible aunque ya haya turnos, precisamente para eso.
 */
export async function pegarHorario(formData: FormData) {
  const convocatoriaId = String(formData.get("convocatoriaId") ?? "");
  const { usuario } = await exigirConvocatoriaSuya(convocatoriaId);
  const grupoId = String(formData.get("grupoId") ?? "");
  if (!grupoId) throw new Error("Elige el grupo que se examina.");

  // Regla 7: la convocatoria comprobada arriba no dice nada del grupo, que
  // llega en el mismo formulario. Sin esto, un `grupoId` ajeno filtraría los
  // datos de sus miembros y les crearía turnos en esta convocatoria.
  const motivoGrupo = await grupoDeProfesor(
    grupoId,
    usuario.id,
    usuario.role === "ADMIN",
  );
  if (motivoGrupo) throw new Error(motivoGrupo);

  const miembros = await prisma.miembroGrupo.findMany({
    where: { grupoId },
    select: {
      estudiante: {
        select: { id: true, email: true, firstName: true, lastName: true, suprimidoEl: true },
      },
    },
  });

  const porNombre = new Map<string, string>();
  const porCorreo = new Map<string, string>();
  for (const { estudiante } of miembros) {
    if (estudiante.suprimidoEl) continue;
    porCorreo.set(estudiante.email.toLowerCase(), estudiante.id);
    const nombre = `${estudiante.lastName ?? ""} ${estudiante.firstName ?? ""}`
      .trim()
      .toLowerCase();
    if (nombre) porNombre.set(nombre, estudiante.id);
  }

  const lineas = parsearHorario(String(formData.get("horario") ?? ""));

  // El orden arranca donde acabó lo que ya hubiera, para poder pegar en dos
  // veces sin chocar con @@unique([convocatoriaId, grupoId, orden]).
  const ultimo = await prisma.turno.findFirst({
    where: { convocatoriaId, grupoId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  let orden = (ultimo?.orden ?? 0) + 1;

  const filas: Prisma.TurnoUncheckedCreateInput[] = [];
  for (const linea of lineas) {
    if (linea.pausa) {
      filas.push({ convocatoriaId, grupoId, dia: linea.dia, hora: HORA_PAUSA, orden });
      orden += 1;
      continue;
    }
    const clave = `${linea.apellido} ${linea.nombre}`.trim().toLowerCase();
    const estudianteId =
      (linea.correo ? porCorreo.get(linea.correo.toLowerCase()) : undefined) ??
      porNombre.get(clave) ??
      null;

    // Regla 3: aunque el emparejamiento acierte, una ficha suprimida no
    // recibe turno. Se deja el hueco sin estudiante, no se rompe el pegado.
    const motivo = await puedeExaminarse(estudianteId);
    filas.push({
      convocatoriaId,
      grupoId,
      estudianteId: motivo ? null : estudianteId,
      dia: linea.dia,
      preparacion: linea.preparacion,
      hora: linea.hora,
      sala: linea.sala,
      orden,
    });
    orden += 1;
  }

  if (filas.length > 0) {
    await prisma.$transaction(filas.map((data) => prisma.turno.create({ data })));
  }
  revalidatePath(`/profe/orales/${convocatoriaId}`);
}

export async function borrarTurno(formData: FormData) {
  const turnoId = String(formData.get("turnoId") ?? "");
  const turno = await exigirTurnoSuyo(turnoId);
  await prisma.turno.delete({ where: { id: turnoId } });
  revalidatePath(`/profe/orales/${turno.convocatoria.id}`);
}

export type DatosEvaluacion = {
  turnoId: string;
  sujetoId?: string | null;
  notas?: Notas;
  comentarios?: Record<string, string>;
  frases?: Record<string, string[]>;
  preguntadas?: number[];
  segundosEoc?: number;
  segundosEoi?: number;
};

/**
 * El autoguardado del panel. Devuelve el motivo del rechazo o `null`: un
 * editor que se traga un error es inusable, y este escribe cada medio
 * segundo mientras el profesor evalúa.
 *
 * No lleva `revalidatePath`: la llama un componente de cliente que ya tiene
 * el estado en la mano, y refrescar la ruta entera en cada tecla haría
 * parpadear el panel. El semáforo del horario se refresca al cambiar de
 * estudiante, que es cuando la pantalla se vuelve a pintar.
 */
export async function guardarEvaluacion(
  datos: DatosEvaluacion,
): Promise<{ error: string } | null> {
  const turno = await exigirTurnoSuyo(datos.turnoId);

  // Regla 8: que el turno sea tuyo no dice nada del sujet. Sin esto, un
  // `sujetoId` acertado de otra convocatoria colaría en la ficha el título,
  // la descripción y las preguntas de un examen ajeno.
  const motivoSujeto = await sujetoDeConvocatoria(
    datos.sujetoId,
    turno.convocatoria.id,
  );
  if (motivoSujeto) return { error: motivoSujeto };

  if (datos.notas) {
    for (const criterio of CRITERIOS) {
      const valor = datos.notas[criterio.key];
      if (valor === undefined || valor === null) continue;
      const motivo = notaDentroDelCriterio(criterio.key as ClaveCriterio, valor);
      if (motivo) return { error: motivo };
    }
  }

  const escribible = {
    sujetoId: datos.sujetoId,
    notas: datos.notas,
    comentarios: datos.comentarios,
    frases: datos.frases,
    preguntadas: datos.preguntadas,
    segundosEoc:
      datos.segundosEoc === undefined ? undefined : caparTiempo(datos.segundosEoc),
    segundosEoi:
      datos.segundosEoi === undefined ? undefined : caparTiempo(datos.segundosEoi),
  };

  await prisma.evaluacionOral.upsert({
    where: { turnoId: datos.turnoId },
    create: { turnoId: datos.turnoId, ...escribible },
    update: escribible,
  });
  return null;
}
