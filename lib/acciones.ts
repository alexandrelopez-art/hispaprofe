"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import type {
  Destreza,
  Nivel,
  TipoBloque,
  TipoPaso,
  TipoRecorrido,
} from "@/lib/generated/prisma";

async function exigirProfesor() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    throw new Error("Solo un profesor puede hacer esto.");
  }
  return usuario;
}

/** Acepta correos separados por comas, puntos y coma, espacios o saltos de línea. */
function parsearCorreos(texto: string): string[] {
  const encontrados = texto
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  return [...new Set(encontrados)];
}

function comoNivel(valor: string): Nivel | null {
  return valor ? (valor as Nivel) : null;
}

// ─── Asignaciones ────────────────────────────────────────────────────────

async function asignarA(
  estudianteIds: string[],
  recorridoId: string,
  profesorId: string,
  nota: string,
) {
  await prisma.$transaction(
    estudianteIds.map((estudianteId) =>
      prisma.asignacion.upsert({
        where: { estudianteId_recorridoId: { estudianteId, recorridoId } },
        update: { archivada: false, nota: nota || null, profesorId },
        create: {
          estudianteId,
          recorridoId,
          profesorId,
          nota: nota || null,
        },
      }),
    ),
  );
}

export async function asignarSecuencia(formData: FormData) {
  const profesor = await exigirProfesor();
  const estudianteId = String(formData.get("estudianteId") ?? "");
  const recorridoId = String(formData.get("recorridoId") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  if (!estudianteId || !recorridoId) return;

  await asignarA([estudianteId], recorridoId, profesor.id, nota);

  revalidatePath(`/profe/alumnos/${estudianteId}`);
  revalidatePath(`/recorridos/${recorridoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
}

export async function asignarSecuenciaAVarios(formData: FormData) {
  const profesor = await exigirProfesor();
  const recorridoId = String(formData.get("recorridoId") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  const estudianteIds = formData
    .getAll("estudianteIds")
    .map(String)
    .filter(Boolean);
  if (!recorridoId || estudianteIds.length === 0) return;

  await asignarA(estudianteIds, recorridoId, profesor.id, nota);

  revalidatePath(`/recorridos/${recorridoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
  for (const estudianteId of estudianteIds) {
    revalidatePath(`/profe/alumnos/${estudianteId}`);
  }
}

export async function asignarSecuenciaAGrupo(formData: FormData) {
  const profesor = await exigirProfesor();
  const grupoId = String(formData.get("grupoId") ?? "");
  const recorridoId = String(formData.get("recorridoId") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  if (!grupoId || !recorridoId) return;

  const miembros = await prisma.miembroGrupo.findMany({
    where: { grupoId },
    select: { estudianteId: true },
  });
  if (miembros.length === 0) return;

  await asignarA(
    miembros.map((m) => m.estudianteId),
    recorridoId,
    profesor.id,
    nota,
  );

  revalidatePath(`/profe/grupos/${grupoId}`);
  revalidatePath(`/recorridos/${recorridoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
}

export async function archivarAsignacion(formData: FormData) {
  await exigirProfesor();
  const id = String(formData.get("asignacionId") ?? "");
  if (!id) return;

  const asignacion = await prisma.asignacion.update({
    where: { id },
    data: { archivada: true },
  });

  revalidatePath(`/profe/alumnos/${asignacion.estudianteId}`);
  revalidatePath(`/recorridos/${asignacion.recorridoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
}

// ─── Grupos ──────────────────────────────────────────────────────────────

/**
 * Crea las fichas que falten a partir de una lista de correos y las mete
 * en el grupo. Las fichas nacen sin clerkId: la cuenta se engancha sola
 * cuando esa persona entra por primera vez.
 */
async function meterCorreosEnGrupo(
  grupoId: string,
  correos: string[],
  nivel: Nivel | null,
) {
  for (const email of correos) {
    const estudiante = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, role: "STUDENT", nivel },
    });

    await prisma.miembroGrupo.upsert({
      where: {
        grupoId_estudianteId: { grupoId, estudianteId: estudiante.id },
      },
      update: {},
      create: { grupoId, estudianteId: estudiante.id },
    });
  }
}

export async function crearGrupo(formData: FormData) {
  const profesor = await exigirProfesor();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const nivel = comoNivel(String(formData.get("nivel") ?? ""));
  const correos = parsearCorreos(String(formData.get("correos") ?? ""));
  if (!nombre) return;

  const grupo = await prisma.grupo.create({
    data: { nombre, nivel, profesorId: profesor.id },
  });

  if (correos.length > 0) {
    await meterCorreosEnGrupo(grupo.id, correos, nivel);
  }

  revalidatePath("/profe/grupos");
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
  redirect(`/profe/grupos/${grupo.id}`);
}

export async function anadirCorreosAGrupo(formData: FormData) {
  await exigirProfesor();
  const grupoId = String(formData.get("grupoId") ?? "");
  const correos = parsearCorreos(String(formData.get("correos") ?? ""));
  if (!grupoId || correos.length === 0) return;

  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    select: { nivel: true },
  });

  await meterCorreosEnGrupo(grupoId, correos, grupo?.nivel ?? null);

  revalidatePath(`/profe/grupos/${grupoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
}

/** Saca a alguien del grupo. No borra su ficha ni sus asignaciones. */
export async function quitarDeGrupo(formData: FormData) {
  await exigirProfesor();
  const id = String(formData.get("miembroId") ?? "");
  if (!id) return;

  const miembro = await prisma.miembroGrupo.delete({ where: { id } });

  revalidatePath(`/profe/grupos/${miembro.grupoId}`);
  revalidatePath("/dashboard");
}

// ─── Estudiantes ─────────────────────────────────────────────────────────

/** Crea la ficha de un estudiante suelto, sin cuenta todavía. */
export async function crearEstudiante(formData: FormData) {
  await exigirProfesor();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim() || null;
  const lastName = String(formData.get("lastName") ?? "").trim() || null;
  const nivel = comoNivel(String(formData.get("nivel") ?? ""));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

  const estudiante = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, firstName, lastName, nivel, role: "STUDENT" },
  });

  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
  redirect(`/profe/alumnos/${estudiante.id}`);
}

// ─── Editor de secuencias ────────────────────────────────────────────────

export async function crearSecuencia(formData: FormData) {
  const profesor = await exigirProfesor();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion =
    String(formData.get("descripcion") ?? "").trim() || null;
  const nivel = comoNivel(String(formData.get("nivel") ?? ""));
  const tipo = String(formData.get("tipo") ?? "RECORRIDO") as TipoRecorrido;
  if (!titulo || !nivel) return;

  const ultimo = await prisma.recorrido.aggregate({
    where: { tipo },
    _max: { orden: true },
  });

  const conPlantilla = formData.get("plantilla") === "on";

  const secuencia = await prisma.recorrido.create({
    data: {
      titulo,
      descripcion,
      nivel,
      tipo,
      orden: (ultimo._max.orden ?? 0) + 1,
      autorId: profesor.id,
    },
  });

  // Estructura recomendada: 9 pasos en 2 ciclos. El ciclo 1 abre con la
  // activacion y cierra en la micro tarea; el 2 cierra en la macro tarea.
  if (conPlantilla) {
    const plantilla: {
      titulo: string;
      tipo: TipoPaso;
      ciclo: number;
    }[] = [
      { titulo: "Activación: conecta con el tema", tipo: "ACTIVACION", ciclo: 1 },
      { titulo: "Actividad 1", tipo: "ACTIVIDAD", ciclo: 1 },
      { titulo: "Actividad 2", tipo: "ACTIVIDAD", ciclo: 1 },
      { titulo: "Andamiaje: léxico y gramática del ciclo 1", tipo: "ANDAMIAJE", ciclo: 1 },
      { titulo: "Micro tarea: producción breve", tipo: "MICRO_TAREA", ciclo: 1 },
      { titulo: "Actividad 3", tipo: "ACTIVIDAD", ciclo: 2 },
      { titulo: "Actividad 4", tipo: "ACTIVIDAD", ciclo: 2 },
      { titulo: "Andamiaje: léxico y gramática del ciclo 2", tipo: "ANDAMIAJE", ciclo: 2 },
      { titulo: "Macro tarea: producción final", tipo: "MACRO_TAREA", ciclo: 2 },
    ];

    await prisma.paso.createMany({
      data: plantilla.map((paso, i) => ({
        recorridoId: secuencia.id,
        titulo: paso.titulo,
        tipo: paso.tipo,
        ciclo: paso.ciclo,
        orden: i + 1,
      })),
    });
  }

  revalidatePath("/recorridos");
  revalidatePath("/dashboard");
  redirect(`/recorridos/${secuencia.id}`);
}

/**
 * Otorga puntos verificados sobre un paso de una asignacion. Si el
 * estudiante no habia marcado el paso, la fila se crea igualmente:
 * verificar implica que el trabajo existe.
 */
export async function otorgarPuntos(formData: FormData) {
  await exigirProfesor();
  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  const bruto = String(formData.get("puntos") ?? "").trim();
  if (!asignacionId || !pasoId) return;

  const puntos = bruto === "" ? null : Math.max(0, Number(bruto) || 0);

  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return;

  await prisma.pasoCompletado.upsert({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    update: { puntos, verificadoEl: puntos === null ? null : new Date() },
    create: {
      asignacionId,
      pasoId,
      puntos,
      verificadoEl: puntos === null ? null : new Date(),
    },
  });

  revalidatePath(`/profe/alumnos/${asignacion.estudianteId}`);
  revalidatePath("/dashboard");
}

export async function crearPaso(formData: FormData) {
  await exigirProfesor();
  const recorridoId = String(formData.get("recorridoId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as TipoPaso;
  const ciclo = Number(formData.get("ciclo") ?? 1) || 1;
  const destrezaBruta = String(formData.get("destreza") ?? "");
  const destreza = destrezaBruta ? (destrezaBruta as Destreza) : null;
  if (!recorridoId || !titulo || !tipo) return;

  const ultimo = await prisma.paso.aggregate({
    where: { recorridoId },
    _max: { orden: true },
  });

  await prisma.paso.create({
    data: {
      recorridoId,
      titulo,
      tipo,
      ciclo,
      destreza,
      orden: (ultimo._max.orden ?? 0) + 1,
    },
  });

  revalidatePath(`/recorridos/${recorridoId}`);
  revalidatePath("/recorridos");
}

/** Renombra un paso. Pensado para los títulos provisionales de la plantilla. */
export async function renombrarPaso(formData: FormData) {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!pasoId || !titulo) return;

  const paso = await prisma.paso.update({
    where: { id: pasoId },
    data: { titulo },
    select: { recorridoId: true },
  });

  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath(`/recorridos/${paso.recorridoId}`);
}

/** Borra un paso con sus bloques y su historial de completado. */
export async function borrarPaso(formData: FormData) {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  if (!pasoId) return;

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return;

  await prisma.$transaction([
    prisma.pasoCompletado.deleteMany({ where: { pasoId } }),
    prisma.bloque.deleteMany({ where: { pasoId } }),
    prisma.paso.delete({ where: { id: pasoId } }),
  ]);

  revalidatePath(`/recorridos/${paso.recorridoId}`);
  revalidatePath("/recorridos");
  redirect(`/recorridos/${paso.recorridoId}`);
}

export async function crearBloque(formData: FormData) {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoBloque;
  const texto = String(formData.get("texto") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const etiqueta = String(formData.get("etiqueta") ?? "").trim() || null;
  if (!pasoId || !tipo) return;
  if (tipo === "TEXTO" && !texto) return;
  if (tipo !== "TEXTO" && !url) return;

  const ultimo = await prisma.bloque.aggregate({
    where: { pasoId },
    _max: { orden: true },
  });

  await prisma.bloque.create({
    data: {
      pasoId,
      tipo,
      texto,
      url,
      etiqueta,
      orden: (ultimo._max.orden ?? 0) + 1,
    },
  });

  revalidatePath(`/pasos/${pasoId}`);
}

export async function borrarBloque(formData: FormData) {
  await exigirProfesor();
  const id = String(formData.get("bloqueId") ?? "");
  if (!id) return;

  const bloque = await prisma.bloque.delete({ where: { id } });
  revalidatePath(`/pasos/${bloque.pasoId}`);
}

/**
 * Importa puntos en lote desde un informe externo (Genially, etc.),
 * ya revisados y emparejados por el profesor en la interfaz.
 * Crea la asignacion si el estudiante no la tenia: recibir puntos
 * de una secuencia implica estar asignado a ella.
 */
export async function importarPuntos(formData: FormData) {
  const profesor = await exigirProfesor();
  const recorridoId = String(formData.get("recorridoId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  const estudianteIds = formData.getAll("estudianteIds").map(String);
  const puntosLista = formData.getAll("puntos").map((p) => Number(p) || 0);
  if (!recorridoId || !pasoId || estudianteIds.length === 0) return;

  for (let i = 0; i < estudianteIds.length; i++) {
    const estudianteId = estudianteIds[i];
    const puntos = Math.max(0, puntosLista[i] ?? 0);
    if (!estudianteId) continue;

    const asignacion = await prisma.asignacion.upsert({
      where: { estudianteId_recorridoId: { estudianteId, recorridoId } },
      update: { archivada: false },
      create: { estudianteId, recorridoId, profesorId: profesor.id },
    });

    await prisma.pasoCompletado.upsert({
      where: {
        asignacionId_pasoId: { asignacionId: asignacion.id, pasoId },
      },
      update: { puntos, verificadoEl: new Date() },
      create: {
        asignacionId: asignacion.id,
        pasoId,
        puntos,
        verificadoEl: new Date(),
      },
    });
  }

  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
  for (const estudianteId of estudianteIds) {
    if (estudianteId) revalidatePath(`/profe/alumnos/${estudianteId}`);
  }
}

// ─── Progreso del estudiante ─────────────────────────────────────────────

/**
 * Marca un paso como hecho dentro de la asignación del estudiante actual.
 * Solo funciona si esa persona tiene una asignación viva del recorrido
 * al que pertenece el paso; nadie puede marcar progreso ajeno.
 */
export async function marcarPasoHecho(formData: FormData) {
  const usuario = await getUsuarioActual();
  if (!usuario) return;

  const pasoId = String(formData.get("pasoId") ?? "");
  if (!pasoId) return;

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return;

  const asignacion = await prisma.asignacion.findUnique({
    where: {
      estudianteId_recorridoId: {
        estudianteId: usuario.id,
        recorridoId: paso.recorridoId,
      },
    },
    select: { id: true, archivada: true },
  });
  if (!asignacion || asignacion.archivada) return;

  await prisma.pasoCompletado.upsert({
    where: {
      asignacionId_pasoId: { asignacionId: asignacion.id, pasoId },
    },
    update: {},
    create: { asignacionId: asignacion.id, pasoId },
  });

  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath(`/recorridos/${paso.recorridoId}`);
  revalidatePath("/dashboard");
}

/** Desmarca un paso. Borra la fila; el progreso vuelve a bajar. */
export async function desmarcarPasoHecho(formData: FormData) {
  const usuario = await getUsuarioActual();
  if (!usuario) return;

  const pasoId = String(formData.get("pasoId") ?? "");
  if (!pasoId) return;

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return;

  const asignacion = await prisma.asignacion.findUnique({
    where: {
      estudianteId_recorridoId: {
        estudianteId: usuario.id,
        recorridoId: paso.recorridoId,
      },
    },
    select: { id: true },
  });
  if (!asignacion) return;

  await prisma.pasoCompletado.deleteMany({
    where: { asignacionId: asignacion.id, pasoId },
  });

  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath(`/recorridos/${paso.recorridoId}`);
  revalidatePath("/dashboard");
}
