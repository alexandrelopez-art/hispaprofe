"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { exigirProfesor } from "@/lib/profesor";
import { listarEstudiantes } from "@/lib/google";
import { desmarcarSiNoRevisado } from "@/lib/progreso";
import { estudianteAsignable } from "@/lib/estudiantes";
import { corregir, analizar } from "@/lib/ejercicios/registro";
import type { Respuestas } from "@/lib/ejercicios/tipos";
import { Prisma } from "@/lib/generated/prisma/client";
import type {
  Destreza,
  Nivel,
  TipoBloque,
  TipoPaso,
  TipoRecorrido,
} from "@/lib/generated/prisma/enums";

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

  // Una `Asignacion` es de las dos tablas que borra `suprimir`: recrearla le
  // devolvería a la lápida el progreso que su supresión se llevó. El botón de
  // atrás justo después de suprimir basta para llegar aquí con su id.
  if (!(await estudianteAsignable(estudianteId))) return;

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

  // Se quita a la lápida y se asigna a los demás, en vez de tirar la tanda
  // entera: una ficha suprimida colada en la lista viene de una pestaña vieja,
  // y los otros estudiantes no tienen la culpa.
  const asignables: string[] = [];
  for (const estudianteId of estudianteIds) {
    if (await estudianteAsignable(estudianteId)) asignables.push(estudianteId);
  }
  if (asignables.length === 0) return;

  await asignarA(asignables, recorridoId, profesor.id, nota);

  revalidatePath(`/recorridos/${recorridoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
  for (const estudianteId of asignables) {
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

// ─── Google Classroom ────────────────────────────────────────────────────

/** Ata un grupo a un curso de Classroom y trae su lista por primera vez. */
export async function vincularGrupoConCurso(formData: FormData) {
  const profesor = await exigirProfesor();
  const grupoId = String(formData.get("grupoId") ?? "");
  const cursoId = String(formData.get("cursoId") ?? "");
  const cursoNombre = String(formData.get("cursoNombre") ?? "").trim();
  if (!grupoId || !cursoId) return;

  await prisma.grupo.update({
    where: { id: grupoId },
    data: { classroomCursoId: cursoId, classroomNombre: cursoNombre || null },
  });

  await traerListaDeClassroom(grupoId, cursoId, profesor.id);

  revalidatePath(`/profe/grupos/${grupoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
}

/** Suelta el vinculo. Los estudiantes ya traidos se quedan en el grupo. */
export async function desvincularGrupo(formData: FormData) {
  await exigirProfesor();
  const grupoId = String(formData.get("grupoId") ?? "");
  if (!grupoId) return;

  await prisma.grupo.update({
    where: { id: grupoId },
    data: {
      classroomCursoId: null,
      classroomNombre: null,
      sincronizadoEl: null,
    },
  });

  revalidatePath(`/profe/grupos/${grupoId}`);
}

export async function sincronizarGrupo(formData: FormData) {
  const profesor = await exigirProfesor();
  const grupoId = String(formData.get("grupoId") ?? "");
  if (!grupoId) return;

  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    select: { classroomCursoId: true },
  });
  if (!grupo?.classroomCursoId) return;

  await traerListaDeClassroom(grupoId, grupo.classroomCursoId, profesor.id);

  revalidatePath(`/profe/grupos/${grupoId}`);
  revalidatePath("/profe/alumnos");
  revalidatePath("/dashboard");
}

/**
 * Trae la lista del curso y la vuelca en el grupo. Crea la ficha del que
 * no exista, emparejando por correo, igual que el pegado manual.
 * A quien esté en el grupo pero ya no en Classroom no se le toca: puede
 * tener progreso y puntos, y borrarlo en silencio seria peor.
 */
async function traerListaDeClassroom(
  grupoId: string,
  cursoId: string,
  profesorId: string,
) {
  const alumnos = await listarEstudiantes(profesorId, cursoId);

  for (const alumno of alumnos) {
    const estudiante = await prisma.user.upsert({
      where: { email: alumno.email },
      update: {},
      create: {
        email: alumno.email,
        firstName: alumno.nombre,
        lastName: alumno.apellido,
        role: "STUDENT",
      },
    });

    // Se rellena el nombre solo si estaba vacio: lo que haya escrito el
    // profesor a mano manda sobre lo que diga Classroom.
    if (!estudiante.firstName && alumno.nombre) {
      await prisma.user.update({
        where: { id: estudiante.id },
        data: { firstName: alumno.nombre, lastName: alumno.apellido },
      });
    }

    await prisma.miembroGrupo.upsert({
      where: {
        grupoId_estudianteId: { grupoId, estudianteId: estudiante.id },
      },
      update: {},
      create: { grupoId, estudianteId: estudiante.id },
    });
  }

  await prisma.grupo.update({
    where: { id: grupoId },
    data: { sincronizadoEl: new Date() },
  });
}

/** Corta la conexión con Google. Los grupos vinculados dejan de sincronizar. */
export async function desconectarGoogle() {
  const profesor = await exigirProfesor();

  await prisma.cuentaGoogle.deleteMany({ where: { usuarioId: profesor.id } });

  revalidatePath("/profe/grupos");
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
  const tipo = String(
    formData.get("tipo") ?? "CLASES_PARTICULARES",
  ) as TipoRecorrido;
  if (!titulo || !nivel) return;

  // La prueba del DELE, si la secuencia es de preparación. Se guarda en el
  // recorrido y no solo en sus pasos porque una prueba recién creada aún no
  // tiene ninguno, y al volver a abrirla hay que saber de cuál es.
  const destrezaBruta = String(formData.get("destreza") ?? "");
  const destreza =
    tipo === "PREPARACION_DELE" && destrezaBruta
      ? (destrezaBruta as Destreza)
      : null;

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
      destreza,
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
 *
 * Vaciar el campo de puntos es distinto: el formulario del profesor
 * renderiza ese input para todos los pasos, así que guardarlo en blanco
 * en un paso que el estudiante nunca tocó no debe inventarle una entrega.
 * Por eso el camino `puntos === null` solo actualiza una fila que ya
 * existe; nunca crea una.
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

  if (puntos === null) {
    await prisma.pasoCompletado.updateMany({
      where: { asignacionId, pasoId },
      data: { puntos: null, verificadoEl: null },
    });
  } else {
    await prisma.pasoCompletado.upsert({
      where: { asignacionId_pasoId: { asignacionId, pasoId } },
      update: { puntos, verificadoEl: new Date() },
      create: { asignacionId, pasoId, puntos, verificadoEl: new Date() },
    });
  }

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
    // `CitaOral.pasoId` no tiene relación —está razonado en el esquema—, así
    // que nada la borra en cascada: sin esto, la clase seguía pintando una
    // línea con el nombre del alumno y sin título para siempre, y
    // `descitarOral` necesita el paso desde la ficha, que ya no lo pinta.
    prisma.citaOral.deleteMany({ where: { pasoId } }),
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
  const imagen = String(formData.get("imagen") ?? "").trim() || null;
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
      imagen,
      orden: (ultimo._max.orden ?? 0) + 1,
    },
  });

  revalidatePath(`/pasos/${pasoId}`);
}

/**
 * Lee las etiquetas Open Graph de una pagina para montar la tarjeta de
 * enlace con titulo, descripcion y miniatura. Va en el servidor porque el
 * navegador no puede pedir paginas de otros dominios.
 */
export async function obtenerMetadatos(url: string): Promise<{
  titulo: string;
  descripcion: string;
  imagen: string;
  error?: string;
}> {
  await exigirProfesor();
  const vacio = { titulo: "", descripcion: "", imagen: "" };

  let objetivo: URL;
  try {
    objetivo = new URL(url);
  } catch {
    return { ...vacio, error: "Eso no parece una dirección web." };
  }

  // Solo web publica: nada de esquemas raros ni direcciones internas.
  if (!["http:", "https:"].includes(objetivo.protocol)) {
    return { ...vacio, error: "Solo se admiten enlaces http o https." };
  }
  const host = objetivo.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    return { ...vacio, error: "Esa dirección no es pública." };
  }

  try {
    const respuesta = await fetch(objetivo.toString(), {
      headers: { "User-Agent": "HispaProfe/1.0 (+lector de enlaces)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) {
      return { ...vacio, error: `La página respondió ${respuesta.status}.` };
    }

    const tipoContenido = respuesta.headers.get("content-type") ?? "";
    if (tipoContenido.startsWith("image/")) {
      return { titulo: "", descripcion: "", imagen: objetivo.toString() };
    }
    // Solo se descarta lo que seguro no es texto. Hay sitios que declaran
    // mal el tipo de contenido y aun asi devuelven HTML perfectamente legible.
    if (/^(audio|video|application\/(pdf|zip|octet))/.test(tipoContenido)) {
      return { ...vacio, error: "Ese enlace es un archivo, no una página." };
    }

    // Muchos medios en espanol siguen sirviendo ISO-8859-1. Leer los bytes
    // y decidir la codificacion evita que las tildes salgan como rombos.
    const bytes = await respuesta.arrayBuffer();

    let codificacion =
      tipoContenido.match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? "";

    if (!codificacion) {
      const cabeza = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
      codificacion =
        cabeza
          .match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
          ?.toLowerCase() ?? "utf-8";
    }

    let html: string;
    try {
      html = new TextDecoder(codificacion).decode(bytes);
    } catch {
      html = new TextDecoder("utf-8").decode(bytes);
    }
    html = html.slice(0, 200_000);

    const meta = (propiedad: string) => {
      const patron = new RegExp(
        `<meta[^>]+(?:property|name)=["']${propiedad}["'][^>]*content=["']([^"']*)["']`,
        "i",
      );
      const alterno = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${propiedad}["']`,
        "i",
      );
      return (html.match(patron) ?? html.match(alterno))?.[1] ?? "";
    };

    const titulo =
      meta("og:title") ||
      meta("twitter:title") ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
      "";
    const descripcion =
      meta("og:description") || meta("description") || meta("twitter:description");
    let imagen = meta("og:image") || meta("twitter:image");

    // Rutas relativas: completarlas con el dominio.
    if (imagen && !imagen.startsWith("http")) {
      try {
        imagen = new URL(imagen, objetivo).toString();
      } catch {
        imagen = "";
      }
    }

    const ENTIDADES: Record<string, string> = {
      amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
      aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
      Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
      ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
      iexcl: "¡", iquest: "¿", laquo: "«", raquo: "»",
      mdash: "—", ndash: "–", hellip: "…",
      lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
      agrave: "à", egrave: "è", ccedil: "ç", euro: "€", deg: "°",
    };

    const limpiar = (s: string) =>
      s
        .replace(/&#x([\da-f]+);/gi, (_, h) =>
          String.fromCodePoint(parseInt(h, 16)),
        )
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&(\w+);/g, (entera, nombre) => ENTIDADES[nombre] ?? entera)
        .replace(/\s+/g, " ")
        .trim();

    return {
      titulo: limpiar(titulo).slice(0, 200),
      descripcion: limpiar(descripcion).slice(0, 300),
      imagen,
    };
  } catch {
    return {
      ...vacio,
      error: "No pude leer esa página. Puede tardar demasiado o bloquear lectores.",
    };
  }
}

/** Intercambia el orden de un bloque con su vecino. */
export async function moverBloque(formData: FormData) {
  await exigirProfesor();
  const id = String(formData.get("bloqueId") ?? "");
  const direccion = String(formData.get("direccion") ?? "");
  if (!id || (direccion !== "arriba" && direccion !== "abajo")) return;

  const bloque = await prisma.bloque.findUnique({ where: { id } });
  if (!bloque) return;

  const vecino = await prisma.bloque.findFirst({
    where: {
      pasoId: bloque.pasoId,
      orden:
        direccion === "arriba" ? { lt: bloque.orden } : { gt: bloque.orden },
    },
    orderBy: { orden: direccion === "arriba" ? "desc" : "asc" },
  });
  if (!vecino) return;

  await prisma.$transaction([
    prisma.bloque.update({
      where: { id: bloque.id },
      data: { orden: vecino.orden },
    }),
    prisma.bloque.update({
      where: { id: vecino.id },
      data: { orden: bloque.orden },
    }),
  ]);

  revalidatePath(`/pasos/${bloque.pasoId}`);
}

/** Intercambia el orden de un paso con su vecino dentro de la secuencia. */
export async function moverPaso(formData: FormData) {
  await exigirProfesor();
  const id = String(formData.get("pasoId") ?? "");
  const direccion = String(formData.get("direccion") ?? "");
  if (!id || (direccion !== "arriba" && direccion !== "abajo")) return;

  const paso = await prisma.paso.findUnique({ where: { id } });
  if (!paso) return;

  const vecino = await prisma.paso.findFirst({
    where: {
      recorridoId: paso.recorridoId,
      orden: direccion === "arriba" ? { lt: paso.orden } : { gt: paso.orden },
    },
    orderBy: { orden: direccion === "arriba" ? "desc" : "asc" },
  });
  if (!vecino) return;

  await prisma.$transaction([
    prisma.paso.update({
      where: { id: paso.id },
      data: { orden: vecino.orden },
    }),
    prisma.paso.update({
      where: { id: vecino.id },
      data: { orden: paso.orden },
    }),
  ]);

  revalidatePath(`/recorridos/${paso.recorridoId}`);
  revalidatePath(`/pasos/${paso.id}`);
}

/** Actualiza el contenido de un bloque ya creado. */
export async function editarBloque(formData: FormData) {
  await exigirProfesor();
  const id = String(formData.get("bloqueId") ?? "");
  if (!id) return;

  const existente = await prisma.bloque.findUnique({ where: { id } });
  if (!existente) return;

  const texto = String(formData.get("texto") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const etiqueta = String(formData.get("etiqueta") ?? "").trim() || null;
  const imagen = String(formData.get("imagen") ?? "").trim() || null;

  // Un bloque vacio no se guarda: para eso está el botón de borrar.
  if (existente.tipo === "TEXTO" && !texto) return;
  if (existente.tipo !== "TEXTO" && !url) return;

  await prisma.bloque.update({
    where: { id },
    data: { texto, url, etiqueta, imagen },
  });

  revalidatePath(`/pasos/${existente.pasoId}`);
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
    // Aquí se escriben las dos tablas que borra `suprimir` —la asignación y
    // el paso con sus puntos—, así que a una lápida se la salta y se sigue
    // con los demás emparejados.
    if (!(await estudianteAsignable(estudianteId))) continue;

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

/**
 * Corrige un ejercicio y convierte los aciertos en puntos.
 *
 * La corrección vive aquí y no en el navegador: las respuestas correctas
 * nunca salen del servidor mientras el ejercicio está abierto.
 *
 * Se responde una sola vez. Si el paso ya tiene fecha de verificación —
 * porque el estudiante ya lo envió, o porque el profesor lo puntuó a mano —
 * la acción no hace nada: repetir hasta acertar vaciaría de sentido la hucha.
 */
export async function responderEjercicio(formData: FormData) {
  const usuario = await getUsuarioActual();
  if (!usuario) return;

  const pasoId = String(formData.get("pasoId") ?? "");
  const ejercicioId = String(formData.get("ejercicioId") ?? "");
  if (!pasoId || !ejercicioId) return;

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

  // El ejercicio tiene que estar colgado de este paso: si no, cualquiera
  // podría puntuarse con las preguntas de otro.
  const vinculo = await prisma.pasoEjercicio.findUnique({
    where: { pasoId_ejercicioId: { pasoId, ejercicioId } },
    select: { ejercicio: { select: { datos: true } } },
  });
  if (!vinculo) return;

  const analizado = analizar(vinculo.ejercicio.datos);
  if (!analizado) return;

  let respuestas: Respuestas;
  try {
    const bruto: unknown = JSON.parse(String(formData.get("respuestas") ?? "{}"));
    if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return;
    // Cada valor tiene que ser string o string[]: los corregidores de cada
    // tipo asumen esa forma y no la comprueban, así que un número o un
    // objeto colado aquí los haría reventar más abajo en vez de fallar aquí.
    const valores = Object.values(bruto as Record<string, unknown>);
    const formaValida = valores.every(
      (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")),
    );
    if (!formaValida) return;
    respuestas = bruto as Respuestas;
  } catch {
    return;
  }

  // Atajo barato: si ya está verificado no merece la pena ni corregir.
  // Pero no es esto lo que garantiza "se responde una sola vez" — entre
  // esta lectura y la escritura de abajo cabe otra petición idéntica, así
  // que la regla la impone la base de datos, no este `if`.
  const yaRespondido = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId } },
    select: { verificadoEl: true },
  });
  if (yaRespondido?.verificadoEl) return;

  // Se pasa el id del ejercicio, no la semilla: `corregir` la deriva por
  // dentro (mezclada con ENCRYPTION_KEY) exactamente igual que hizo
  // `versionPublica` al repartir las claves opacas de relacionar, así que
  // las dos coinciden sin que este archivo conozca el secreto.
  const { aciertos } = corregir(analizado, respuestas, ejercicioId);

  // Un ejercicio autocorregible es objetivo, así que sus puntos entran ya
  // verificados: no necesitan el visto bueno del profesor.
  //
  // Dos envíos concurrentes no pueden ganar los dos: el update solo toca
  // la fila si sigue sin verificar (nada de "leer y luego escribir": la
  // condición va en el propio UPDATE), y si no tocó nada porque la fila
  // no existía todavía, el create que sigue está protegido por la clave
  // única asignacionId+pasoId — si otra petición ya la creó entre medias,
  // el create revienta con P2002 y esa petición pierde en silencio. No lo
  // simplifiques de vuelta a un `upsert` plano: eso reintroduce la carrera.
  const actualizado = await prisma.pasoCompletado.updateMany({
    where: { asignacionId: asignacion.id, pasoId, verificadoEl: null },
    data: { puntos: aciertos, verificadoEl: new Date(), respuestas },
  });

  if (actualizado.count === 0) {
    try {
      await prisma.pasoCompletado.create({
        data: {
          asignacionId: asignacion.id,
          pasoId,
          puntos: aciertos,
          verificadoEl: new Date(),
          respuestas,
        },
      });
    } catch (error) {
      // P2002 = otra petición creó la fila primero: esta pierde la
      // carrera y no hace nada, tal como manda "se responde una sola vez".
      const esChoqueDeClaveUnica =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!esChoqueDeClaveUnica) throw error;
    }
  }

  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath(`/recorridos/${paso.recorridoId}`);
  revalidatePath("/dashboard");
}

/** Desmarca un paso, salvo que el profesor ya lo haya revisado. */
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

  await desmarcarSiNoRevisado(asignacion.id, pasoId);

  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath(`/recorridos/${paso.recorridoId}`);
  revalidatePath("/dashboard");
}
