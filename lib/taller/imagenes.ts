import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { puedeEditarse, revisarDatos } from "@/lib/recursos";
import { tareaDe } from "@/lib/taller/consultas";

type Pedida = { pregunta: string; opcion: number | null; para: string; archivoId: string | null };
const LETRAS = "ABCDEFGHIJ";

/**
 * Coloca una imagen subida en el sitio que la IA dejó marcado: en la opción
 * (`imagenes[opcion]`, y el texto de la opción pasa a ser su letra) o, si la
 * petición era del ítem entero, como bloque IMAGEN del paso con su etiqueta.
 *
 * Revisión, A-1: la misma guarda que `guardarTarea` y `guardarRelleno`
 * —los otros dos únicos sitios que tocan `Ejercicio.datos`— antes de
 * escribir nada. Reescribir un ejercicio que un estudiante ya respondió,
 * entregó o le corrigieron deja las respuestas guardadas apuntando a ids
 * que ya no significan lo mismo; esta función no es una excepción a esa
 * regla solo porque venga de colocar una imagen y no de editar a mano.
 *
 * Revisión, A-3: la lectura de `TareaDeExamen.imagenesPedidas` y de
 * `Ejercicio.datos` se hace **dentro** de la transacción (con `tx`, no con
 * la foto que trajo `tareaDe()` más arriba): dos llamadas casi
 * simultáneas para la misma tarea partían de la misma foto vieja, y la
 * que confirmaba segunda pisaba en silencio el cambio de la primera
 * (la imagen subía, el `Archivo` se creaba, pero su asignación
 * desaparecía del ejercicio y de la lista de pedidas sin ningún error).
 */
export async function asignarImagenPedida(tareaId: string, indice: number, archivoUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const archivoId = archivoUrl.replace(/^\/api\/archivos\//, "");
  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId }, select: { id: true, tipo: true, privado: true } });
  if (!archivo || archivo.privado || !archivo.tipo.startsWith("image/")) return { ok: false, error: "Ese archivo no es una imagen del sitio." };

  const motivo = await puedeEditarse(tarea.ejercicio.id);
  if (motivo) return { ok: false, error: motivo };

  return prisma.$transaction(async (tx) => {
    const tareaFresca = await tx.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaId }, select: { imagenesPedidas: true } });
    const lista = (tareaFresca.imagenesPedidas as Pedida[] | null) ?? [];
    const pedida = lista[indice];
    if (!pedida) return { ok: false, error: "Esa petición ya no está en la lista." };

    if (pedida.opcion !== null) {
      const ejercicioFresco = await tx.ejercicio.findUniqueOrThrow({ where: { id: tarea.ejercicio.id }, select: { datos: true } });
      const datos = structuredClone(ejercicioFresco.datos) as {
        preguntas?: { id: string; opciones?: string[]; imagenes?: (string | null)[] }[];
        opcionesComunes?: string[];
      };
      const pregunta = datos.preguntas?.find((p) => p.id === pedida.pregunta);
      if (!pregunta) return { ok: false, error: "La pregunta de esa imagen ya no existe." };
      const opciones = pregunta.opciones ?? datos.opcionesComunes ?? [];
      if (pedida.opcion < 0 || pedida.opcion >= opciones.length) return { ok: false, error: "Esa opción ya no existe." };
      pregunta.imagenes = pregunta.imagenes ?? opciones.map(() => null);
      pregunta.imagenes[pedida.opcion] = archivoUrl;
      const letra = LETRAS[pedida.opcion] ?? String(pedida.opcion + 1);
      // Revisión, A-2/B-2: con lista propia, la letra sustituye el texto de
      // esa pregunta solamente. Con lista común (`pregunta.opciones` no
      // existe), el texto es de todas las preguntas que la usan — y la
      // letra también, así que sustituirla en `opcionesComunes` no rompe
      // nada ajeno: sigue siendo la misma letra para todas.
      if (pregunta.opciones && /^\(imagen\)$/i.test(pregunta.opciones[pedida.opcion].trim())) {
        pregunta.opciones[pedida.opcion] = letra;
      } else if (!pregunta.opciones && datos.opcionesComunes && /^\(imagen\)$/i.test(datos.opcionesComunes[pedida.opcion].trim())) {
        datos.opcionesComunes[pedida.opcion] = letra;
      }
      const revision = revisarDatos(datos);
      if ("error" in revision) return { ok: false, error: revision.error };
      await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    } else {
      const ultimo = await tx.bloque.aggregate({ where: { pasoId: tarea.pasoId }, _max: { orden: true } });
      await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "IMAGEN", url: archivoUrl, etiqueta: pedida.para, orden: (ultimo._max.orden ?? 0) + 1 } });
    }
    const nueva = lista.map((p, i) => (i === indice ? { ...p, archivoId: archivo.id } : p));
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { imagenesPedidas: nueva } });
    return { ok: true };
  });
}
