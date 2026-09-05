import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { revisarDatos } from "@/lib/recursos";
import { tareaDe } from "@/lib/taller/consultas";

type Pedida = { pregunta: string; opcion: number | null; para: string; archivoId: string | null };
const LETRAS = "ABCDEFGHIJ";

/**
 * Coloca una imagen subida en el sitio que la IA dejó marcado: en la opción
 * (`imagenes[opcion]`, y el texto de la opción pasa a ser su letra) o, si la
 * petición era del ítem entero, como bloque IMAGEN del paso con su etiqueta.
 */
export async function asignarImagenPedida(tareaId: string, indice: number, archivoUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const archivoId = archivoUrl.replace(/^\/api\/archivos\//, "");
  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId }, select: { id: true, tipo: true, privado: true } });
  if (!archivo || archivo.privado || !archivo.tipo.startsWith("image/")) return { ok: false, error: "Ese archivo no es una imagen del sitio." };
  const lista = ((tarea.imagenesPedidas as Pedida[] | null) ?? []);
  const pedida = lista[indice];
  if (!pedida) return { ok: false, error: "Esa petición ya no está en la lista." };

  const datos = structuredClone(tarea.ejercicio.datos) as { preguntas?: { id: string; opciones?: string[]; imagenes?: (string | null)[] }[]; opcionesComunes?: string[] };
  if (pedida.opcion !== null) {
    const pregunta = datos.preguntas?.find((p) => p.id === pedida.pregunta);
    if (!pregunta) return { ok: false, error: "La pregunta de esa imagen ya no existe." };
    const opciones = pregunta.opciones ?? datos.opcionesComunes ?? [];
    if (pedida.opcion < 0 || pedida.opcion >= opciones.length) return { ok: false, error: "Esa opción ya no existe." };
    pregunta.imagenes = pregunta.imagenes ?? opciones.map(() => null);
    pregunta.imagenes[pedida.opcion] = archivoUrl;
    if (pregunta.opciones && /^\(imagen\)$/i.test(pregunta.opciones[pedida.opcion].trim())) {
      pregunta.opciones[pedida.opcion] = LETRAS[pedida.opcion] ?? String(pedida.opcion + 1);
    }
    const revision = revisarDatos(datos);
    if ("error" in revision) return { ok: false, error: revision.error };
  }

  await prisma.$transaction(async (tx) => {
    if (pedida.opcion !== null) {
      await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    } else {
      const ultimo = await tx.bloque.aggregate({ where: { pasoId: tarea.pasoId }, _max: { orden: true } });
      await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "IMAGEN", url: archivoUrl, etiqueta: pedida.para, orden: (ultimo._max.orden ?? 0) + 1 } });
    }
    const nueva = lista.map((p, i) => (i === indice ? { ...p, archivoId: archivo.id } : p));
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { imagenesPedidas: nueva } });
  });
  return { ok: true };
}
