import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { revisarDatos } from "@/lib/recursos";
import { avisosDelMapa, contrastarClave } from "@/lib/taller/guardar-relleno";
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

  const avisos = [
    ...avisosDelMapa(delMapa, datos),
    ...contrastarClaveGuardada(datos, tarea.claveOficial, delMapa.motor as "opcion" | "relacionar"),
  ];
  const volvioARellenada = tarea.estado === "REVISADA";
  const texto = bloque?.trim() ? bloque.trim() : null;

  await prisma.$transaction(async (tx) => {
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "TEXTO" } });
    if (texto) await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "TEXTO", texto, orden: 1 } });
    await tx.tareaDeExamen.update({
      where: { id: tareaId },
      data: { avisos, ...(volvioARellenada ? { estado: "RELLENADA", revisadaEl: null } : {}) },
    });
  });
  return { ok: true, avisos, volvioARellenada };
}

function itemsSinRespuesta(datos: unknown, motor: string): number {
  const d = datos as { preguntas?: { correctas?: number[] }[]; parejas?: { derecha?: string }[] };
  if (motor === "relacionar") return (d.parejas ?? []).filter((p) => !p.derecha?.trim()).length;
  return (d.preguntas ?? []).filter((p) => !p.correctas || p.correctas.length === 0).length;
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
  if (tarea.prueba === "CO" && !tarea.paso.bloques.some((b) => b.tipo === "AUDIO")) {
    motivos.push("Falta la grabación de la tarea (se sube desde la ficha del paso).");
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

/** Quita una petición de imagen que el profesor decide que no hace falta. */
export async function quitarImagenPedida(tareaId: string, indice: number): Promise<void> {
  const tarea = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaId }, select: { imagenesPedidas: true } });
  const lista = ((tarea.imagenesPedidas as ImagenPedida[] | null) ?? []).filter((_, i) => i !== indice);
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { imagenesPedidas: lista } });
}
