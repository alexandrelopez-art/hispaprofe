import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TareaDele } from "@/lib/dele/mapa";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { cortarAudio } from "@/lib/audio";
import { puedeEditarse, revisarDatos } from "@/lib/recursos";
import { tareaDe } from "@/lib/taller/consultas";

/**
 * Cuántos trozos tiene la grabación de una tarea auditiva, según el examen:
 * uno por pregunta (siete diálogos), uno por pareja (seis mensajes), tres
 * noticias con dos preguntas cada una, y una sola conversación que no se
 * corta (null).
 */
export function trozosQueEspera(tarea: TareaDele): number | null {
  if (tarea.formato === "ATTRIB") return null;
  if (tarea.pide.includes("noticias")) return 3;
  return tarea.items;
}

/** La grabación completa: se guarda en la tarea y, mientras no haya trozos, como bloque AUDIO del paso. */
export async function guardarGrabacion(tareaId: string, archivoUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  if (tarea.prueba !== "CO") return { ok: false, error: "Solo las tareas auditivas llevan grabación." };
  const archivoId = archivoUrl.replace(/^\/api\/archivos\//, "");
  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId }, select: { id: true, tipo: true, privado: true } });
  if (!archivo || archivo.privado || !archivo.tipo.startsWith("audio/")) return { ok: false, error: "Ese archivo no es un audio del sitio." };
  await prisma.$transaction(async (tx) => {
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { grabacionArchivoId: archivo.id, cortes: Prisma.DbNull } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "AUDIO" } });
    await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "AUDIO", url: archivoUrl, etiqueta: "Grabación completa", orden: 1 } });
  });
  return { ok: true };
}

/**
 * Corta la grabación en los segundos dados y reparte los trozos: en `opcion`
 * uno por pregunta (o uno por cada dos, en las noticias), en `relacionar`
 * uno por pareja; cada trozo con dos escuchas. Cuando hay trozos, el bloque
 * AUDIO de la grabación completa se retira del paso (el examen blanco los
 * encadena) y se conserva en la tarea para poder volver a cortar.
 */
export async function cortarGrabacion(tareaId: string, cortes: number[]): Promise<{ ok: true; avisos: string[]; trozos: number } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  if (!tarea.grabacionArchivoId) return { ok: false, error: "Sube antes la grabación de la tarea." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { ok: false, error: "El mapa no describe esta tarea." };
  const esperados = trozosQueEspera(delMapa);
  if (esperados === null) return { ok: false, error: "Esta tarea se oye entera: no se corta." };
  const archivo = await prisma.archivo.findUnique({ where: { id: tarea.grabacionArchivoId } });
  if (!archivo) return { ok: false, error: "La grabación ya no está." };

  // Misma guarda que `guardarTarea` (C-1 de la revisión final): cortar
  // reescribe `Ejercicio.datos` (el `audio` de cada ítem, `escuchas`) y si
  // un estudiante ya respondió, entregó o le corrigieron este ejercicio, eso
  // dejaría su respuesta guardada apuntando a algo que ya no significa lo
  // mismo. Se comprueba antes de lanzar ffmpeg y no dentro de la
  // transacción: no tiene sentido cortar el audio para tirarlo después.
  const motivoBloqueo = await puedeEditarse(tarea.ejercicio.id);
  if (motivoBloqueo) return { ok: false, error: motivoBloqueo };

  const { trozos, tipo } = await cortarAudio(Buffer.from(archivo.datos), archivo.tipo, cortes);
  const datos = structuredClone(tarea.ejercicio.datos) as { escuchas?: number; preguntas?: { audio?: string }[]; parejas?: { audio?: string }[] };
  const avisos = ((tarea.avisos as string[] | null) ?? []).filter((a) => !a.startsWith("La grabación tiene"));
  if (trozos.length !== esperados) avisos.push(`La grabación tiene ${trozos.length} trozo(s) y el examen espera ${esperados}: revisa los cortes.`);

  // Los trozos de un corte anterior se borran: nadie más los referencia y, si
  // se quedaran, cada nuevo corte dejaría siete archivos huérfanos en la base.
  const listaVieja = delMapa.motor === "relacionar" ? datos.parejas ?? [] : datos.preguntas ?? [];
  const viejos = [...new Set(listaVieja.map((i) => i.audio).filter((u): u is string => Boolean(u)))]
    .map((u) => u.replace(/^\/api\/archivos\//, ""))
    .filter((id) => id !== tarea.grabacionArchivoId);

  const resultado = await prisma.$transaction(async (tx) => {
    if (viejos.length) await tx.archivo.deleteMany({ where: { id: { in: viejos }, privado: false } });
    const urls: string[] = [];
    for (let i = 0; i < trozos.length; i++) {
      const guardado = await tx.archivo.create({ data: { nombre: `${tarea.prueba}-tarea-${tarea.numero}-trozo-${i + 1}.m4a`, tipo, tamano: trozos[i].length, datos: trozos[i], subidoPorId: tarea.examen.creadoPorId }, select: { id: true } });
      urls.push(`/api/archivos/${guardado.id}`);
    }
    const porItem = delMapa.pide.includes("noticias") ? 2 : 1;
    const lista = delMapa.motor === "relacionar" ? datos.parejas ?? [] : datos.preguntas ?? [];
    lista.forEach((item, i) => { item.audio = urls[Math.floor(i / porItem)] ?? undefined; });
    datos.escuchas = 2;
    const revision = revisarDatos(datos);
    if ("error" in revision) throw new Error(revision.error);
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "AUDIO" } });
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { cortes, avisos } });
    return urls.length;
  });
  return { ok: true, avisos, trozos: resultado };
}
