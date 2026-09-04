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

/** La clave oficial contra lo marcado: por letra en opción, por título en relacionar. */
export function contrastarClave(respuesta: RespuestaIA, motor: "opcion" | "relacionar"): string[] {
  if (!respuesta.claveOficial) return [];
  const fallan: string[] = [];
  const d = respuesta.ejercicio as { preguntas?: { id: string; correctas: number[] }[]; parejas?: { id: string; derecha: string }[] };
  if (motor === "opcion") {
    for (const p of d.preguntas ?? []) {
      const letra = respuesta.claveOficial[p.id];
      if (letra && LETRAS.indexOf(letra.toUpperCase()) !== p.correctas[0]) fallan.push(p.id);
    }
  } else {
    const porLetra = new Map(respuesta.textosConLetra.map((t) => [t.letra.toUpperCase(), t.texto]));
    for (const r of d.parejas ?? []) {
      const letra = respuesta.claveOficial[r.id];
      if (letra && porLetra.size && porLetra.get(letra.toUpperCase()) !== r.derecha) fallan.push(r.id);
    }
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
