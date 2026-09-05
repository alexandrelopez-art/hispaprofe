import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TareaDele } from "@/lib/dele/mapa";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { cortarAudio } from "@/lib/audio";
import { puedeEditarse, revisarDatos } from "@/lib/recursos";
import { tareaDe, type TareaCompleta } from "@/lib/taller/consultas";

/**
 * Cuántos trozos tiene la grabación de una tarea auditiva, según lo que dice
 * el mapa (`TareaDele.trozos`): `null` es una sola conversación que se oye
 * entera y no se corta; si el mapa no lo dice (`undefined`), un trozo por
 * ítem (`items`) — el caso normal, uno por pregunta o por pareja.
 */
export function trozosQueEspera(tarea: TareaDele): number | null {
  return tarea.trozos === undefined ? tarea.items : tarea.trozos;
}

type DatosConAudio = { escuchas?: number; preguntas?: { audio?: string }[]; parejas?: { audio?: string }[] };

/**
 * Borra los `Archivo` de los trozos que hoy están wireados en `datos`
 * (nunca la grabación completa, y nunca un archivo privado) y les quita el
 * campo `audio` a los ítems. Sirve a los dos sitios que pueden dejar trozos
 * huérfanos: `cortarGrabacion` antes de crear los nuevos, y `guardarGrabacion`
 * cuando se resube la grabación completa —los trozos del corte anterior ya
 * no son trozos de nada, porque ya no son trozos de esta grabación—.
 */
async function quitarTrozos(tx: Prisma.TransactionClient, tarea: TareaCompleta, datos: DatosConAudio): Promise<void> {
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  const lista = (delMapa?.motor === "relacionar" ? datos.parejas : datos.preguntas) ?? datos.parejas ?? datos.preguntas ?? [];
  const viejos = [...new Set(lista.map((i) => i.audio).filter((u): u is string => Boolean(u)))]
    .map((u) => u.replace(/^\/api\/archivos\//, ""))
    .filter((id) => id !== tarea.grabacionArchivoId);
  if (viejos.length) await tx.archivo.deleteMany({ where: { id: { in: viejos }, privado: false } });
  for (const item of lista) delete item.audio;
}

/**
 * La grabación completa: se guarda en la tarea y, mientras no haya trozos,
 * como bloque AUDIO del paso.
 *
 * Si la tarea ya estaba cortada, los trozos del corte anterior son trozos de
 * la grabación vieja —resubir no los recorta de la nueva—: `quitarTrozos`
 * los borra y limpia `datos`, y `cortes` vuelve a null para que
 * `motivosParaNoRevisar` vuelva a pedir «La grabación está sin cortar».
 */
export async function guardarGrabacion(tareaId: string, archivoUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  if (tarea.prueba !== "CO") return { ok: false, error: "Solo las tareas auditivas llevan grabación." };
  const archivoId = archivoUrl.replace(/^\/api\/archivos\//, "");
  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId }, select: { id: true, tipo: true, privado: true } });
  if (!archivo || archivo.privado || !archivo.tipo.startsWith("audio/")) return { ok: false, error: "Ese archivo no es un audio del sitio." };

  // Misma guarda que `cortarGrabacion` (C-1 de la revisión final): resubir
  // reescribe `Ejercicio.datos` y borra los trozos vigentes, así que si un
  // estudiante ya respondió, entregó o le corrigieron este ejercicio, su
  // respuesta se quedaría apuntando a audio que ya no existe.
  const motivoBloqueo = await puedeEditarse(tarea.ejercicio.id);
  if (motivoBloqueo) return { ok: false, error: motivoBloqueo };

  try {
    await prisma.$transaction(async (tx) => {
      const datos = structuredClone(tarea.ejercicio.datos) as DatosConAudio;
      await quitarTrozos(tx, tarea, datos);
      const revision = revisarDatos(datos);
      if ("error" in revision) throw new Error(revision.error);
      await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
      await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { grabacionArchivoId: archivo.id, cortes: Prisma.DbNull } });
      await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "AUDIO" } });
      await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "AUDIO", url: archivoUrl, etiqueta: "Grabación completa", orden: 1 } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar la grabación." };
  }
  return { ok: true };
}

/**
 * Corta la grabación en los segundos dados y reparte los trozos: en `opcion`
 * uno por pregunta (o menos, si el mapa agrupa varias preguntas por audio —
 * las noticias), en `relacionar` uno por pareja; cada trozo con dos
 * escuchas. Cuando hay trozos, el bloque AUDIO de la grabación completa se
 * retira del paso (el examen blanco los encadena) y se conserva en la tarea
 * para poder volver a cortar.
 *
 * Si el corte produce más trozos de los que espera el mapa, solo se guardan
 * los `esperados` primeros: guardar los de más dejaría `Archivo` sin dueño
 * —ningún ítem los referencia, así que ni siquiera un corte posterior los
 * encontraría para borrarlos—. El aviso de la cuenta sigue contando los
 * trozos que de verdad salieron del corte, no los que se quedaron guardados.
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
  const datos = structuredClone(tarea.ejercicio.datos) as DatosConAudio;
  const avisos = ((tarea.avisos as string[] | null) ?? []).filter((a) => !a.startsWith("La grabación tiene"));
  if (trozos.length !== esperados) avisos.push(`La grabación tiene ${trozos.length} trozo(s) y el examen espera ${esperados}: revisa los cortes.`);
  // Nunca más de los que el mapa espera: los sobrantes no los referenciaría
  // ningún ítem y quedarían huérfanos para siempre (ver la nota de la
  // función).
  const trozosAGuardar = trozos.slice(0, esperados);

  const resultado = await prisma.$transaction(async (tx) => {
    await quitarTrozos(tx, tarea, datos);
    const urls: string[] = [];
    for (let i = 0; i < trozosAGuardar.length; i++) {
      const guardado = await tx.archivo.create({ data: { nombre: `${tarea.prueba}-tarea-${tarea.numero}-trozo-${i + 1}.m4a`, tipo, tamano: trozosAGuardar[i].length, datos: trozosAGuardar[i], subidoPorId: tarea.examen.creadoPorId }, select: { id: true } });
      urls.push(`/api/archivos/${guardado.id}`);
    }
    // Cuántos ítems comparten cada trozo: las noticias son dos preguntas
    // por audio, todo lo demás uno a uno. Sale de los números del mapa
    // (`items`/`esperados`), no de adivinar la forma de la tarea por su
    // texto de pantalla.
    const porItem = Math.ceil(delMapa.items / esperados);
    const lista = delMapa.motor === "relacionar" ? datos.parejas ?? [] : datos.preguntas ?? [];
    lista.forEach((item, i) => { item.audio = urls[Math.floor(i / porItem)] ?? undefined; });
    datos.escuchas = 2;
    const revision = revisarDatos(datos);
    if ("error" in revision) throw new Error(revision.error);
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "AUDIO" } });
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { cortes, avisos } });
    return urls.length;
  }, {
    // I-3 de la revisión final: siete `archivo.create` con un par de
    // megabytes cada uno contra un Postgres remoto no caben en el tope
    // por defecto de 5 s. 60 s dentro de la transacción y 10 s de espera
    // para conseguir una conexión del pool.
    timeout: 60_000,
    maxWait: 10_000,
  });
  return { ok: true, avisos, trozos: resultado };
}
