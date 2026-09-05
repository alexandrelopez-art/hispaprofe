"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirProfesor } from "@/lib/profesor";
import { prisma } from "@/lib/prisma";
import { crearExamen } from "@/lib/taller/esqueleto";
import { asignarPaginas, borrarPagina, registrarPagina, reordenarPaginas, repartirEnOrden, TIPOS_DE_IMAGEN_ACEPTADOS } from "@/lib/taller/paginas";
import { guardarCuadernillo } from "@/lib/taller/cuadernillo";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { tareaDe } from "@/lib/taller/consultas";
import { trozoDeClaves } from "@/lib/taller/cuadernillo";
import { hayClaveDeIA, pedirTarea, SinClaveError } from "@/lib/taller/rellenar";
import { guardarRelleno } from "@/lib/taller/guardar-relleno";
import { descartarClaveOficial, guardarTarea, marcarRevisada, quitarImagenPedida } from "@/lib/taller/revision";
import { asignarImagenPedida } from "@/lib/taller/imagenes";
import { cortarGrabacion, guardarGrabacion } from "@/lib/taller/audio";
import { archivarExamen, asignarExamen, partirDestino, publicarExamen, retirarExamen } from "@/lib/taller/publicar";

export type EstadoTaller = { error?: string; ok?: string };
export type EstadoGuardado = { error?: string; ok?: string; avisos?: string[] };

async function examenDelProfesor(examenId: string) {
  await exigirProfesor();
  const examen = await prisma.examen.findUnique({ where: { id: examenId }, select: { id: true, numero: true } });
  if (!examen) throw new Error("Ese examen ya no existe.");
  return examen;
}

export async function crearExamenAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const usuario = await exigirProfesor();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const fuente = String(formData.get("fuente") ?? "").trim();
  const numero = Number(formData.get("numero"));
  const bloque = Number(formData.get("bloque")) === 3 ? 3 : 2;
  if (!titulo) return { error: "Ponle un título al examen." };
  if (!Number.isInteger(numero) || numero < 1) return { error: "El número del examen tiene que ser 1 o más." };
  const id = await crearExamen({ titulo, fuente, numero, bloque, nivel: "A2_B1_ESCOLAR", autorId: usuario.id });
  redirect(`/dele/taller/${id}`);
}

export async function registrarPaginaAccion(examenId: string, archivoUrl: string): Promise<EstadoTaller> {
  await examenDelProfesor(examenId);
  const id = archivoUrl.replace(/^\/api\/archivos\//, "");
  if (!id || id === archivoUrl) return { error: "Esa dirección no es de un archivo del sitio." };
  const registrada = await registrarPagina(examenId, id);
  if (!registrada) return { error: "Ese archivo no es una imagen del examen." };
  revalidatePath(`/dele/taller/${examenId}`);
  return { ok: "Página guardada." };
}

export async function reordenarPaginasAccion(examenId: string, ids: string[]): Promise<void> {
  await examenDelProfesor(examenId);
  await reordenarPaginas(examenId, ids);
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function borrarPaginaAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await borrarPagina(String(formData.get("paginaId") ?? ""));
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function asignarPaginasAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const tareaId = String(formData.get("tareaId") ?? "");
  await asignarPaginas(tareaId, formData.getAll("paginaId").map(String));
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function repartirEnOrdenAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await repartirEnOrden(examenId);
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function subirCuadernilloAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const fichero = formData.get("cuadernillo");
  if (!(fichero instanceof File) || fichero.size === 0) return { error: "Elige el PDF del cuadernillo." };
  if (fichero.type !== "application/pdf" && !fichero.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Solo se admite un PDF." };
  }
  if (fichero.size > 4 * 1024 * 1024) return { error: "El cuadernillo pasa de 4 MB. Comprímelo o sube solo las páginas de este examen." };
  let caracteres: number;
  try {
    ({ caracteres } = await guardarCuadernillo(examenId, new Uint8Array(await fichero.arrayBuffer())));
  } catch (e) {
    console.error("No se pudo leer el cuadernillo:", e);
    return { error: "No se pudo leer ese PDF." };
  }
  revalidatePath(`/dele/taller/${examenId}`);
  if (caracteres === 0) return { error: "Ese PDF no tiene texto (es un escaneo). El examen sigue sin claves." };
  return { ok: `Cuadernillo guardado (${caracteres.toLocaleString("es")} caracteres).` };
}

export async function rellenarConIAAccion(tareaId: string): Promise<EstadoTaller> {
  await exigirProfesor();
  // Todo lo de aquí abajo va dentro del `try`, no solo la llamada a la IA:
  // un tropiezo de Prisma en `tareaDe` o en `archivo.findMany` salía antes
  // como un rechazo sin capturar, y en «Rellenar las ocho»
  // (`components/taller/rellenar-todas.tsx`) eso cortaba el bucle entero en
  // vez de anotar el error de esa tarea y seguir con la siguiente.
  try {
    const tarea = await tareaDe(tareaId);
    if (!tarea) return { error: "Esa tarea ya no existe." };
    const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
    if (!delMapa) return { error: "El mapa no describe esta tarea." };
    if (tarea.paginaIds.length === 0) return { error: "Marca antes en qué páginas está esta tarea." };
    const paginas = tarea.examen.paginas.filter((p) => tarea.paginaIds.includes(p.id));
    const archivos = await prisma.archivo.findMany({ where: { id: { in: paginas.map((p) => p.archivoId) } } });
    const porId = new Map(archivos.map((a) => [a.id, a]));
    // `app/api/archivos/route.ts` acepta más tipos de imagen (y el SVG) de
    // los que la API de Anthropic admite como `media_type`: mejor decirlo
    // aquí, en español, que dejar que la API lo rechace con un 400 en
    // inglés dentro del aviso rojo del profesor.
    for (let i = 0; i < paginas.length; i++) {
      const archivo = porId.get(paginas[i].archivoId);
      if (archivo && !TIPOS_DE_IMAGEN_ACEPTADOS.has(archivo.tipo)) {
        return { error: `La página ${i + 1} no es una imagen que la IA pueda leer (JPEG, PNG, WebP o GIF).` };
      }
    }
    const imagenes = paginas.map((p) => porId.get(p.archivoId)).filter((a) => a !== undefined)
      .map((a) => ({ bytes: new Uint8Array(a.datos), tipo: a.tipo as "image/jpeg" | "image/png" | "image/webp" | "image/gif" }));
    const claves = tarea.examen.clavesTexto ? trozoDeClaves(tarea.examen.clavesTexto, tarea.examen.numero, tarea.prueba, tarea.numero) : null;
    const respuesta = await pedirTarea({ tarea: delMapa, prueba: tarea.prueba, numeroExamen: tarea.examen.numero, paginas: imagenes, claves });
    const resultado = await guardarRelleno(tareaId, respuesta);
    revalidatePath(`/dele/taller/${tarea.examenId}`);
    if (!resultado.ok) return { error: resultado.error };
    return { ok: resultado.avisos.length ? `Rellenada, con ${resultado.avisos.length} aviso(s) que revisar.` : "Rellenada." };
  } catch (e) {
    if (e instanceof SinClaveError) return { error: e.message };
    console.error("Rellenar con IA:", e);
    return { error: e instanceof Error ? e.message : "La IA no respondió." };
  }
}

export async function hayClaveDeIAAccion(): Promise<boolean> {
  await exigirProfesor();
  return hayClaveDeIA();
}

export async function guardarTareaAccion(tareaId: string, datosJson: string, bloque: string | null): Promise<EstadoGuardado> {
  await exigirProfesor();
  let datos: unknown;
  try { datos = JSON.parse(datosJson); } catch { return { error: "El contenido de la tarea no se pudo leer." }; }
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await guardarTarea(tareaId, datos, bloque);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.error };
  return { ok: r.volvioARellenada ? "Guardado. La tarea vuelve a «rellenada»: revísala otra vez." : "Guardado.", avisos: r.avisos };
}

export async function marcarRevisadaAccion(tareaId: string): Promise<EstadoGuardado> {
  await exigirProfesor();
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await marcarRevisada(tareaId);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.motivos.join(" ") };
  return { ok: "Revisada." };
}

export async function descartarClaveOficialAccion(tareaId: string): Promise<EstadoGuardado> {
  await exigirProfesor();
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await descartarClaveOficial(tareaId);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.error };
  return { ok: "La clave del cuadernillo ya no se comprueba en esta tarea.", avisos: r.avisos };
}

export async function quitarImagenPedidaAccion(tareaId: string, indice: number): Promise<EstadoGuardado> {
  await exigirProfesor();
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await quitarImagenPedida(tareaId, indice);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.error };
  return { ok: "Imagen quitada de la lista." };
}

export async function asignarImagenPedidaAccion(tareaId: string, indice: number, archivoUrl: string): Promise<EstadoGuardado> {
  await exigirProfesor();
  if (!Number.isInteger(indice)) return { error: "Esa imagen ya no está en la lista." };
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await asignarImagenPedida(tareaId, indice, archivoUrl);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.error };
  return { ok: "Imagen colocada." };
}

export async function guardarGrabacionAccion(tareaId: string, archivoUrl: string): Promise<EstadoGuardado> {
  await exigirProfesor();
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await guardarGrabacion(tareaId, archivoUrl);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.error };
  return { ok: "Grabación guardada." };
}

export async function cortarGrabacionAccion(tareaId: string, cortes: number[]): Promise<EstadoGuardado> {
  await exigirProfesor();
  if (!Array.isArray(cortes) || cortes.length > 30 || !cortes.every((c) => typeof c === "number" && Number.isFinite(c) && c >= 0)) {
    return { error: "Esos cortes no valen." };
  }
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  try {
    const r = await cortarGrabacion(tareaId, cortes);
    revalidatePath(`/dele/taller/${tarea.examenId}`);
    revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
    if (!r.ok) return { error: r.error };
    return { ok: `Cortada en ${r.trozos} trozo(s).`, avisos: r.avisos };
  } catch (e) {
    console.error("Cortar grabación:", e);
    return { error: `No se pudo cortar el audio: ${e instanceof Error ? e.message : "fallo desconocido"}` };
  }
}

// ─── Publicar, retirar, archivar y asignar ─────────────────────────────

function refrescarExamen(examenId: string) {
  revalidatePath(`/dele/taller/${examenId}`);
  revalidatePath("/dele/taller");
  revalidatePath("/dele");
  revalidatePath("/recorridos");
  revalidatePath("/clases");
}

export async function publicarExamenAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const r = await publicarExamen(examenId);
  refrescarExamen(examenId);
  return r.ok ? { ok: "Publicado: ya está en el catálogo del nivel." } : { error: r.motivos.join(" ") };
}

export async function retirarExamenAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await retirarExamen(examenId);
  refrescarExamen(examenId);
}

export async function archivarExamenAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await archivarExamen(examenId);
  refrescarExamen(examenId);
  redirect("/dele/taller");
}

export async function asignarExamenAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const usuario = await exigirProfesor();
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const destino = partirDestino(String(formData.get("destino") ?? ""));
  if (!destino) return { error: "Elige un grupo o un estudiante." };
  const fecha = String(formData.get("venceEl") ?? "");
  const venceEl = fecha ? new Date(`${fecha}T23:59:59`) : null;
  if (fecha && Number.isNaN(venceEl!.getTime())) return { error: "Esa fecha no vale." };
  const r = await asignarExamen(examenId, destino, usuario.id, venceEl);
  refrescarExamen(examenId);
  revalidatePath("/profe/alumnos");
  if (!r.ok) return { error: r.error };
  return { ok: `Asignado a ${r.cuantos} estudiante(s)${venceEl ? `, para el ${fecha}` : ""}.` };
}
