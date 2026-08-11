"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import {
  duplicar,
  motivoSiChoquePorPaso,
  pasoLibre,
  puedeBorrarse,
  puedeDesengancharse,
  puedeDespublicarse,
  puedeEditarse,
  puedeEngancharse,
  revisarDatos,
} from "@/lib/recursos";
import { avisoDeItems, numeroDeTarea, tareaDe } from "@/lib/dele";
import { abrirSobre, resumir } from "@/lib/pegado/sobre";

/**
 * Lo que devuelven todas las acciones de Recursos.
 *
 * Devuelven motivo y no `void` a propósito, y solo aquí: un editor que se
 * traga un error sin decir nada es inusable, porque te quedas mirando la
 * pantalla sin saber si guardó. El resto de la aplicación sigue como está;
 * esta decisión no se extiende sola.
 */
export type EstadoRecurso = {
  /** El motivo del rechazo, para enseñarlo tal cual. */
  error?: string;
  /** Confirmación corta para enseñar. Nunca un identificador. */
  ok?: string;
  /**
   * La fila a la que hay que ir después: la recién creada al guardar, o la
   * copia al duplicar. Va en su propio campo y no dentro de `ok` porque son
   * dos cosas distintas —una se enseña, la otra se navega— y meterlas en la
   * misma clave acaba con un cuid pintado en pantalla el día que alguien
   * renderice la confirmación.
   */
  id?: string;
};

function refrescar(ejercicioId?: string) {
  revalidatePath("/profe/recursos");
  if (ejercicioId) revalidatePath(`/profe/recursos/${ejercicioId}`);
}

/**
 * Crea o actualiza un ejercicio. El `datos` no se guarda sin pasar por
 * `revisarDatos`, que pregunta a los dos porteros: `analizar`, el mismo que
 * valida lo que siembra un script y lo que responde un estudiante, y
 * `analizarExpresion`, que es hermano suyo y no miembro.
 */
export async function guardarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  const usuario = await exigirProfesor();

  const id = String(formData.get("id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const nivelBruto = String(formData.get("nivel") ?? "");
  const destrezaBruta = String(formData.get("destreza") ?? "");
  const etiquetas = String(formData.get("etiquetas") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!titulo) return { error: "Ponle un título." };
  if (!nivelBruto) return { error: "Elige un nivel." };
  // Contra las claves del enum generado, no una lista escrita a mano: así no
  // hay dos sitios que se puedan quedar desfasados si el enum cambia.
  if (!Object.hasOwn(Nivel, nivelBruto)) return { error: "Ese nivel no existe." };
  // `destreza` vacía significa «ninguna» y es válida; solo se rechaza una
  // cadena no vacía que no sea uno de los valores del enum.
  if (destrezaBruta && !Object.hasOwn(Destreza, destrezaBruta)) {
    return { error: "Esa destreza no existe." };
  }
  const nivel = nivelBruto as Nivel;
  const destreza = destrezaBruta ? (destrezaBruta as Destreza) : null;

  let datos: unknown;
  try {
    datos = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return { error: "El contenido del ejercicio no se pudo leer." };
  }

  // El mensaje del rechazo lo escribe el esquema, en castellano y explicando
  // el porqué. No se redacta otro aquí. `revisarDatos` pregunta a los dos
  // porteros —el motor y la expresión—, que es lo que hacía falta para que
  // una tarea de expresión se pudiera guardar.
  const revision = revisarDatos(datos);
  if ("error" in revision) return { error: revision.error };
  const tipo = revision.tipo;

  if (id) {
    const motivo = await puedeEditarse(id);
    if (motivo) return { error: motivo };

    await prisma.ejercicio.update({
      where: { id },
      data: {
        tipo,
        titulo,
        nivel,
        destreza,
        etiquetas,
        datos: datos as Prisma.InputJsonValue,
      },
    });
    refrescar(id);
    return { ok: "Guardado." };
  }

  const creado = await prisma.ejercicio.create({
    data: {
      tipo,
      titulo,
      nivel,
      destreza,
      etiquetas,
      datos: datos as Prisma.InputJsonValue,
      publicado: false,
      autorId: usuario.id,
    },
  });
  refrescar(creado.id);
  return { ok: "Creado.", id: creado.id };
}

export async function publicarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const fila = await prisma.ejercicio.findUnique({
    where: { id },
    select: { datos: true },
  });
  if (!fila) return { error: "Ese ejercicio no existe." };
  // El mismo portero que al guardar: si aquí solo preguntara al motor, una
  // expresión terminada nunca llegaría a `publicado: true` y el selector del
  // paso, que filtra por esa columna, no la ofrecería jamás.
  const revision = revisarDatos(fila.datos);
  if ("error" in revision) {
    return { error: `Está incompleto. ${revision.error}` };
  }

  await prisma.ejercicio.update({ where: { id }, data: { publicado: true } });
  refrescar(id);
  return { ok: "Publicado." };
}

/**
 * Vuelve a borrador. Solo si no cuelga de ningún paso: si colgara, el
 * estudiante que lo tiene delante se quedaría con un ejercicio que la
 * aplicación considera a medio escribir.
 */
export async function despublicarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const motivo = await puedeDespublicarse(id);
  if (motivo) return { error: motivo };

  await prisma.ejercicio.update({ where: { id }, data: { publicado: false } });
  refrescar(id);
  return { ok: "Vuelto a borrador." };
}

export async function duplicarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const copiaId = await duplicar(id);
  if (!copiaId) return { error: "Ese ejercicio no existe." };

  refrescar(copiaId);
  return { ok: "Duplicado.", id: copiaId };
}

export async function borrarEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el ejercicio." };

  const motivo = await puedeBorrarse(id);
  if (motivo) return { error: motivo };

  await prisma.ejercicio.delete({ where: { id } });
  refrescar();
  return { ok: "Borrado." };
}

export async function engancharEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const ejercicioId = String(formData.get("ejercicioId") ?? "");
  if (!pasoId || !ejercicioId) return { error: "Falta el paso o el ejercicio." };

  const motivo = await puedeEngancharse(ejercicioId, pasoId);
  if (motivo) return { error: motivo };

  try {
    await prisma.pasoEjercicio.create({ data: { pasoId, ejercicioId, orden: 1 } });
  } catch (error) {
    // `puedeEngancharse` ya preguntó, pero dos pestañas pueden preguntar a la
    // vez y ver las dos un paso libre: la que llega segunda a la base choca
    // aquí contra la unicidad de `pasoId`, y se traduce al mismo motivo en
    // vez de dejarla reventar con un P2002 sin capturar.
    const motivoDelChoque = motivoSiChoquePorPaso(error);
    if (motivoDelChoque) return { error: motivoDelChoque };
    throw error;
  }

  revalidatePath(`/pasos/${pasoId}`);
  refrescar(ejercicioId);
  return { ok: "Enganchado." };
}

export async function desengancharEjercicio(
  _prev: EstadoRecurso,
  formData: FormData,
): Promise<EstadoRecurso> {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  if (!pasoId) return { error: "Falta el paso." };

  const motivo = await puedeDesengancharse(pasoId);
  if (motivo) return { error: motivo };

  await prisma.pasoEjercicio.deleteMany({ where: { pasoId } });

  revalidatePath(`/pasos/${pasoId}`);
  refrescar();
  return { ok: "Quitado." };
}

/**
 * Lo que devuelve la puerta de pegar por código.
 *
 * No reutiliza `EstadoRecurso` porque tiene algo más que decir: qué ha
 * entendido del texto pegado, para poder enseñarlo y previsualizarlo antes de
 * escribir nada. Ver ese ejercicio antes de guardarlo es la mitad del valor de
 * esta pantalla.
 */
export type EstadoPegado = {
  error?: string;
  ok?: string;
  entendido?: {
    /** «relacionar · 6 parejas · 3 sobrantes». */
    resumen: string;
    /** «En el examen esta tarea lleva 6…». Avisa, no rechaza. */
    aviso: string | null;
    /** El texto que se convertirá en bloque, para enseñarlo. */
    bloque: string | null;
    /** Los datos del ejercicio, para dárselos a `Previsualizacion`. */
    datos: unknown;
  };
};

/**
 * El paso con lo que hace falta para nombrar y situar su ejercicio.
 *
 * Lo comparten las dos acciones: la que comprueba y la que guarda. Se lee dos
 * veces a propósito —una por acción— porque entre pulsar «Comprobar» y pulsar
 * «Guardar» pueden pasar diez minutos, y en ese rato otro puede haber
 * enganchado un ejercicio a ese mismo paso.
 */
async function pasoParaPegar(pasoId: string) {
  return prisma.paso.findUnique({
    where: { id: pasoId },
    select: {
      id: true,
      titulo: true,
      orden: true,
      destreza: true,
      recorrido: { select: { titulo: true, nivel: true, destreza: true, tipo: true } },
    },
  });
}

type PasoParaPegar = NonNullable<Awaited<ReturnType<typeof pasoParaPegar>>>;

/**
 * Qué tarea del examen es este paso, o null.
 *
 * La misma regla que usa la ficha del paso, llamada y no copiada: el título
 * manda —«Tarea 3»— y el `orden` es la reserva.
 */
function tareaDelPaso(paso: PasoParaPegar) {
  if (paso.recorrido.tipo !== "PREPARACION_DELE" || !paso.recorrido.destreza) return null;
  return tareaDe(paso.recorrido.nivel, paso.recorrido.destreza, numeroDeTarea(paso));
}

/**
 * Lee lo pegado y dice qué ha entendido, **sin tocar la base**.
 *
 * Las negativas del paso se comprueban aquí y no solo al guardar: dejar pegar
 * y validar un examen entero para decir al final que el paso estaba ocupado es
 * hacer trabajar para nada.
 */
export async function comprobarPegado(
  _prev: EstadoPegado,
  formData: FormData,
): Promise<EstadoPegado> {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const pegado = String(formData.get("pegado") ?? "");
  if (!pasoId) return { error: "Falta el paso." };

  const paso = await pasoParaPegar(pasoId);
  if (!paso) return { error: "Ese paso ya no existe." };

  const motivo = await pasoLibre(pasoId);
  if (motivo) return { error: motivo };

  const abierto = abrirSobre(pegado);
  if ("error" in abierto) return { error: abierto.error };

  // El aviso de ítems avisa y no rechaza, que es como funciona todo el mapa:
  // un ejercicio de práctica más corto que la tarea oficial es una decisión
  // pedagógica, no un error.
  const tarea = tareaDelPaso(paso);
  const aviso = tarea ? avisoDeItems(tarea, abierto.ejercicio) : null;

  return {
    entendido: {
      resumen: resumir(abierto.ejercicio),
      aviso,
      bloque: abierto.bloque,
      datos: abierto.ejercicio,
    },
  };
}

/**
 * Crea el ejercicio, lo engancha al paso y, si el sobre traía texto, le pone
 * su bloque. **Las tres cosas o ninguna**: un ejercicio creado y sin enganchar
 * sería un huérfano en la lista de Recursos que nadie sabría de dónde salió.
 *
 * **Nace publicado.** `puedeEngancharse` exige que un ejercicio no sea un
 * borrador para colgarlo de un paso, y con razón. Aquí esa regla no se salta:
 * se cumple por adelantado, porque quien pulsa este botón acaba de ver la
 * previsualización, que es exactamente lo que significa publicar. De propina,
 * el ejercicio queda en Recursos y otro paso lo puede reutilizar.
 */
export async function pegarEjercicio(
  _prev: EstadoPegado,
  formData: FormData,
): Promise<EstadoPegado> {
  const usuario = await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const pegado = String(formData.get("pegado") ?? "");
  if (!pasoId) return { error: "Falta el paso." };

  const paso = await pasoParaPegar(pasoId);
  if (!paso) return { error: "Ese paso ya no existe." };

  // Se vuelve a preguntar aunque «Comprobar» ya lo hiciera: entre las dos
  // pulsaciones pueden pasar diez minutos y otra pestaña puede haber
  // enganchado un ejercicio a este mismo paso.
  const motivo = await pasoLibre(pasoId);
  if (motivo) return { error: motivo };

  const abierto = abrirSobre(pegado);
  if ("error" in abierto) return { error: abierto.error };

  let creadoId: string;
  try {
    creadoId = await prisma.$transaction(async (tx) => {
      const ejercicio = await tx.ejercicio.create({
        data: {
          tipo: abierto.tipo,
          // El título lo pone la aplicación y no el sobre: ya sabe de qué
          // secuencia y de qué paso se trata, así que pedírselo a quien
          // escriba el sobre es pedirle que acierte algo que está en la
          // pantalla.
          titulo: `${paso.recorrido.titulo} · ${paso.titulo}`,
          nivel: paso.recorrido.nivel,
          // La del paso manda sobre la del recorrido: un paso puede llevar la
          // suya propia, y si no la lleva hereda la de la prueba.
          destreza: paso.destreza ?? paso.recorrido.destreza,
          etiquetas: [],
          datos: abierto.ejercicio as Prisma.InputJsonValue,
          publicado: true,
          autorId: usuario.id,
        },
        select: { id: true },
      });

      await tx.pasoEjercicio.create({
        data: { pasoId, ejercicioId: ejercicio.id, orden: 1 },
      });

      if (abierto.bloque) {
        // Al final de los que ya haya, igual que `crearBloque`: un paso puede
        // llevar ya una consigna escrita a mano y el texto de la lectura va
        // después, no encima.
        const ultimo = await tx.bloque.aggregate({
          where: { pasoId },
          _max: { orden: true },
        });
        await tx.bloque.create({
          data: {
            pasoId,
            tipo: "TEXTO",
            texto: abierto.bloque,
            orden: (ultimo._max.orden ?? 0) + 1,
          },
        });
      }

      return ejercicio.id;
    });
  } catch (error) {
    // `pasoLibre` ya preguntó, pero entre esa pregunta y este `create` otra
    // pestaña puede haber ganado la carrera: la unicidad de `pasoId` cierra
    // lo que el `count` de arriba no podía cerrar, y aquí se traduce al
    // mismo motivo en vez de dejarla reventar con un P2002 sin capturar.
    const motivoDelChoque = motivoSiChoquePorPaso(error);
    if (motivoDelChoque) return { error: motivoDelChoque };
    throw error;
  }

  revalidatePath(`/pasos/${pasoId}`);
  refrescar(creadoId);
  return { ok: "Pegado y enganchado." };
}
