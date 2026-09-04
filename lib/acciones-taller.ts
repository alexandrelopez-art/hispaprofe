"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirProfesor } from "@/lib/profesor";
import { prisma } from "@/lib/prisma";
import { crearExamen } from "@/lib/taller/esqueleto";
import { asignarPaginas, borrarPagina, registrarPagina, reordenarPaginas, repartirEnOrden } from "@/lib/taller/paginas";
import { guardarCuadernillo } from "@/lib/taller/cuadernillo";

export type EstadoTaller = { error?: string; ok?: string };

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
  await registrarPagina(examenId, id);
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
