import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { avisoDeItems, sobrantesDe, tareaDe as tareaDelMapa } from "@/lib/dele";
import { revisarDatos } from "@/lib/recursos";
import type { RespuestaIA } from "@/lib/taller/encargo-ia";
import { tareaDe } from "@/lib/taller/consultas";

export type ResultadoRelleno = { ok: true; avisos: string[] } | { ok: false; error: string };

const LETRAS = "ABCDEFGHIJKLMNOP";

/** Lo que no cuadra con el mapa: ítems, opciones por ítem, sobrantes. */
export function avisosDelMapa(tarea: Parameters<typeof avisoDeItems>[0], datos: unknown): string[] {
  const avisos: string[] = [];
  const deItems = avisoDeItems(tarea, datos);
  if (deItems) avisos.push(deItems);
  const d = datos as { preguntas?: { opciones?: string[] }[]; opcionesComunes?: string[]; sobrantes?: string[] };
  if (tarea.motor === "opcion") {
    const mal = (d.preguntas ?? []).filter((p) => (p.opciones ?? d.opcionesComunes ?? []).length !== tarea.opciones);
    if (mal.length) avisos.push(`${mal.length} pregunta(s) no tienen ${tarea.opciones} opciones.`);
  } else {
    const esperados = sobrantesDe(tarea);
    if ((d.sobrantes ?? []).length !== esperados) avisos.push(`El examen deja ${esperados} sobrantes; hay ${(d.sobrantes ?? []).length}.`);
  }
  return avisos;
}

/** El aviso de que la clave oficial no se pudo leer contra nada del ejercicio. */
const CLAVE_NO_CONTRASTADA = "La clave oficial no se pudo contrastar con lo leído.";

/**
 * La clave oficial contra lo marcado: por letra en opción, por título en
 * relacionar.
 *
 * Antes de comparar item a item, comprueba que hay **con qué** comparar: si
 * ninguna clave de `claveOficial` coincide con un id del ejercicio —lo
 * natural si la IA copió la numeración del cuadernillo (1-25) en vez de los
 * ids del motor (p1-p7)— o, en `relacionar`, si `textosConLetra` viene
 * vacío (sin él no hay con qué traducir una letra a un título), antes esto
 * devolvía `[]` en silencio: la clave oficial podía contradecir todas y
 * cada una de las respuestas marcadas y el profesor recibía «Rellenada.»
 * sin un solo aviso, la red de seguridad más importante del módulo caída
 * sin decirlo.
 */
export function contrastarClave(respuesta: RespuestaIA, motor: "opcion" | "relacionar"): string[] {
  if (!respuesta.claveOficial) return [];
  const idsDeClave = Object.keys(respuesta.claveOficial);
  if (idsDeClave.length === 0) return [];
  const d = respuesta.ejercicio as { preguntas?: { id: string; correctas: number[] }[]; parejas?: { id: string; derecha: string }[] };

  if (motor === "opcion") {
    const preguntas = d.preguntas ?? [];
    const idsDelEjercicio = new Set(preguntas.map((p) => p.id));
    if (!idsDeClave.some((id) => idsDelEjercicio.has(id))) return [CLAVE_NO_CONTRASTADA];
    const fallan: string[] = [];
    for (const p of preguntas) {
      const letra = respuesta.claveOficial[p.id];
      if (letra && LETRAS.indexOf(letra.toUpperCase()) !== p.correctas[0]) fallan.push(p.id);
    }
    return fallan.length ? [`La clave oficial no cuadra con lo leído en: ${fallan.join(", ")}.`] : [];
  }

  if (respuesta.textosConLetra.length === 0) return [CLAVE_NO_CONTRASTADA];
  const parejas = d.parejas ?? [];
  const idsDelEjercicio = new Set(parejas.map((r) => r.id));
  if (!idsDeClave.some((id) => idsDelEjercicio.has(id))) return [CLAVE_NO_CONTRASTADA];
  const porLetra = new Map(respuesta.textosConLetra.map((t) => [t.letra.toUpperCase(), t.texto]));
  const fallan: string[] = [];
  for (const r of parejas) {
    const letra = respuesta.claveOficial[r.id];
    if (letra && porLetra.get(letra.toUpperCase()) !== r.derecha) fallan.push(r.id);
  }
  return fallan.length ? [`La clave oficial no cuadra con lo leído en: ${fallan.join(", ")}.`] : [];
}

export async function guardarRelleno(tareaId: string, respuesta: RespuestaIA): Promise<ResultadoRelleno> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { ok: false, error: "El mapa no describe esta tarea." };

  const revision = revisarDatos(respuesta.ejercicio);
  if ("error" in revision) return { ok: false, error: `La IA devolvió un ejercicio que no vale: ${revision.error}` };
  if (revision.tipo !== tarea.ejercicio.tipo) return { ok: false, error: "La IA devolvió un ejercicio de otro tipo." };

  const avisos = [...avisosDelMapa(delMapa, respuesta.ejercicio), ...contrastarClave(respuesta, delMapa.motor as "opcion" | "relacionar")];

  await prisma.$transaction(async (tx) => {
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: respuesta.ejercicio as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "TEXTO" } });
    if (respuesta.bloque) {
      await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "TEXTO", texto: respuesta.bloque, orden: 1 } });
    }
    await tx.tareaDeExamen.update({
      where: { id: tareaId },
      data: {
        estado: "RELLENADA",
        rellenadaEl: new Date(),
        revisadaEl: null,
        avisos,
        dudas: respuesta.dudas,
        imagenesPedidas: respuesta.imagenesPedidas.map((i) => ({ ...i, archivoId: null })),
        claveOficial: respuesta.claveOficial ?? Prisma.DbNull,
      },
    });
  });
  return { ok: true, avisos };
}
