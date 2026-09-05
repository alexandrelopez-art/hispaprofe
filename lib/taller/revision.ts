import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { puedeEditarse, revisarDatos } from "@/lib/recursos";
import { avisosDelMapa, contrastarClave } from "@/lib/taller/guardar-relleno";
import { trozosQueEspera } from "@/lib/taller/audio";
import { tareaDe, type TareaCompleta } from "@/lib/taller/consultas";

export type ResultadoGuardado =
  | { ok: true; avisos: string[]; volvioARellenada: boolean }
  | { ok: false; error: string };

type ImagenPedida = { pregunta: string; opcion: number | null; para: string; archivoId: string | null };

/**
 * La clave oficial contra lo que hay guardado. Solo en `opcion`: la IA
 * devolvió las letras por pregunta, y esas se pueden comparar con
 * `correctas`. En `relacionar` hacía falta `textosConLetra`, que no se
 * guarda, así que el aviso de la clave desaparece en el primer guardado:
 * el profesor acaba de mirar las parejas con la página delante.
 */
export function contrastarClaveGuardada(datos: unknown, claveOficial: unknown, motor: "opcion" | "relacionar"): string[] {
  if (motor !== "opcion" || !claveOficial || typeof claveOficial !== "object") return [];
  return contrastarClave(
    { bloque: null, ejercicio: datos, textosConLetra: [], imagenesPedidas: [], dudas: [], claveOficial: claveOficial as Record<string, string> },
    "opcion",
  );
}

/**
 * Guarda lo que el profesor corrigió: `datos` del ejercicio y el estímulo
 * (`bloque`, markdown o null). Vuelve a validar y a calcular los avisos,
 * y si la tarea estaba revisada la devuelve a rellenada, porque lo revisado
 * ya no es lo que hay.
 */
export async function guardarTarea(tareaId: string, datos: unknown, bloque: string | null): Promise<ResultadoGuardado> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { ok: false, error: "El mapa no describe esta tarea." };

  const revision = revisarDatos(datos);
  if ("error" in revision) return { ok: false, error: revision.error };
  if (revision.tipo !== tarea.ejercicio.tipo) return { ok: false, error: "El ejercicio es de otro tipo del que espera la tarea." };

  // C-1 de la revisión final: la misma guarda que ya usan las dos acciones
  // de Recursos que escriben `Ejercicio.datos` — si un estudiante ya
  // respondió, entregó o le corrigieron este ejercicio, reescribirlo por
  // dentro (sobre todo quitar o reordenar preguntas) deja las respuestas
  // guardadas apuntando a ids que ya no significan lo mismo.
  const motivo = await puedeEditarse(tarea.ejercicio.id);
  if (motivo) return { ok: false, error: motivo };

  const avisos = [
    ...avisosDelMapa(delMapa, datos),
    ...contrastarClaveGuardada(datos, tarea.claveOficial, delMapa.motor as "opcion" | "relacionar"),
  ];
  const volvioARellenada = tarea.estado === "REVISADA";
  // Una tarea VACIA cuyos datos ya validan (revisarDatos + el tipo, arriba)
  // es una tarea que el profesor acaba de rellenar a mano, sin pasar por
  // «Rellenar con IA»: sin este ascenso se quedaba en VACIA para siempre
  // —nada más la mueve— y motivosParaNoRevisar la seguía rechazando con
  // «La tarea está vacía», aunque ya tuviera sus preguntas y respuestas.
  const rellenadaAMano = tarea.estado === "VACIA";
  const texto = bloque?.trim() ? bloque.trim() : null;

  await prisma.$transaction(async (tx) => {
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "TEXTO" } });
    // M-2 de la revisión final: orden 0, no 1 — nunca choca con el AUDIO
    // que sube la ficha del paso (crearBloque le da `max + 1`, y en un
    // paso vacío eso es 1).
    if (texto) await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "TEXTO", texto, orden: 0 } });
    await tx.tareaDeExamen.update({
      where: { id: tareaId },
      data: {
        avisos,
        ...(volvioARellenada ? { estado: "RELLENADA", revisadaEl: null } : {}),
        ...(rellenadaAMano ? { estado: "RELLENADA", rellenadaEl: new Date() } : {}),
      },
    });
  });
  return { ok: true, avisos, volvioARellenada };
}

function itemsSinRespuesta(datos: unknown, motor: string): number {
  const d = datos as { preguntas?: { correctas?: number[] }[]; parejas?: { derecha?: string }[] };
  if (motor === "relacionar") return (d.parejas ?? []).filter((p) => !p.derecha?.trim()).length;
  return (d.preguntas ?? []).filter((p) => !p.correctas || p.correctas.length === 0).length;
}

/** Si ningún ítem (pregunta o pareja, según el motor) lleva ya su trozo de audio. */
function ningunItemConAudio(datos: unknown, motor: string): boolean {
  const d = datos as { preguntas?: { audio?: string }[]; parejas?: { audio?: string }[] } | null;
  const lista = motor === "relacionar" ? d?.parejas : d?.preguntas;
  if (!Array.isArray(lista) || lista.length === 0) return true;
  return lista.every((item) => !item.audio);
}

/** Por qué no se puede marcar revisada todavía. Vacío = se puede. */
export function motivosParaNoRevisar(tarea: TareaCompleta): string[] {
  const motivos: string[] = [];
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (tarea.estado === "VACIA") motivos.push("La tarea está vacía: rellénala con IA o a mano.");
  const avisos = (tarea.avisos as string[] | null) ?? [];
  if (avisos.length) motivos.push(`Quedan ${avisos.length} aviso(s) en rojo.`);
  const sinRespuesta = itemsSinRespuesta(tarea.ejercicio.datos, delMapa?.motor ?? "opcion");
  if (sinRespuesta) motivos.push(`${sinRespuesta} ítem(s) sin respuesta correcta.`);
  const pendientes = ((tarea.imagenesPedidas as ImagenPedida[] | null) ?? []).filter((i) => !i.archivoId).length;
  if (pendientes) motivos.push(`${pendientes} imagen(es) por subir.`);
  if (tarea.prueba === "CO") {
    if (!tarea.grabacionArchivoId) {
      motivos.push("Falta la grabación de la tarea.");
    } else if (delMapa && trozosQueEspera(delMapa) !== null && ningunItemConAudio(tarea.ejercicio.datos, delMapa.motor)) {
      motivos.push("La grabación está sin cortar: marca los cortes y pulsa Cortar.");
    }
  }
  return motivos;
}

export async function marcarRevisada(tareaId: string): Promise<{ ok: true } | { ok: false; motivos: string[] }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, motivos: ["Esa tarea ya no existe."] };
  const motivos = motivosParaNoRevisar(tarea);
  if (motivos.length) return { ok: false, motivos };
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { estado: "REVISADA", revisadaEl: new Date() } });
  return { ok: true };
}

export type ResultadoQuitarImagen = { ok: true } | { ok: false; error: string };

/**
 * Quita una petición de imagen que el profesor decide que no hace falta.
 *
 * I-1/M-3 de la revisión final: `indice` viene del cliente (ya no de un
 * `FormData`, donde `Number(null) === 0` colaba un borrado de la primera
 * imagen sin querer), pero puede llegar desfasado si la lista cambió entre
 * medias (por ejemplo, «Volver a rellenar con IA» la sustituyó entera) —
 * así que se comprueba el rango contra la lista actual, no la que tenía el
 * cliente cuando pintó el botón.
 */
export async function quitarImagenPedida(tareaId: string, indice: number): Promise<ResultadoQuitarImagen> {
  const tarea = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaId }, select: { imagenesPedidas: true } });
  const actual = (tarea.imagenesPedidas as ImagenPedida[] | null) ?? [];
  if (!Number.isInteger(indice) || indice < 0 || indice >= actual.length) {
    return { ok: false, error: "Esa imagen ya no está en la lista." };
  }
  const lista = actual.filter((_, i) => i !== indice);
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { imagenesPedidas: lista } });
  return { ok: true };
}

export type ResultadoDescartarClave = { ok: true; avisos: string[] } | { ok: false; error: string };

/**
 * El profesor decide que la clave del cuadernillo está mal para esta tarea:
 * se deja de comprobar. Quita `claveOficial` y recalcula los avisos solo
 * con `avisosDelMapa` (ítems, opciones, sobrantes) sobre lo que hay
 * guardado ahora mismo — sin el contraste de clave, que es justo lo que se
 * está descartando.
 */
export async function descartarClaveOficial(tareaId: string): Promise<ResultadoDescartarClave> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { ok: false, error: "El mapa no describe esta tarea." };
  const avisos = avisosDelMapa(delMapa, tarea.ejercicio.datos);
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { claveOficial: Prisma.DbNull, avisos } });
  return { ok: true, avisos };
}
