import type { Nivel } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pruebaDe } from "@/lib/dele";
import { estructuraDe, tipoDePasoDeTarea } from "@/lib/dele/estructura";
import { TIPO_DE_EJERCICIO } from "@/lib/recursos";

export type EntradaExamen = {
  titulo: string;
  fuente: string;
  numero: number;
  bloque: 2 | 3;
  nivel: Nivel;
  autorId: string;
};

const NOMBRE_PRUEBA = { CE: "Comprensión de lectura", CO: "Comprensión auditiva" } as const;

/**
 * Monta el examen entero de golpe: dos secuencias sin publicar, un paso
 * «Tarea N» por tarea del mapa, un ejercicio vacío del tipo y tamaño que el
 * mapa dicta, y la fila de tarea del taller en `VACIA`. Todo o nada.
 */
export async function crearExamen(entrada: EntradaExamen): Promise<string> {
  const lectura = pruebaDe(entrada.nivel, "CE");
  const auditiva = pruebaDe(entrada.nivel, "CO");
  if (!lectura || !auditiva) throw new Error("El mapa no describe ese nivel.");

  return prisma.$transaction(async (tx) => {
    const ids: Record<"CE" | "CO", string> = { CE: "", CO: "" };
    const pasos: { prueba: "CE" | "CO"; numero: number; pasoId: string }[] = [];

    for (const prueba of [lectura, auditiva]) {
      const recorrido = await tx.recorrido.create({
        data: {
          titulo: `${entrada.titulo} · ${NOMBRE_PRUEBA[prueba.prueba as "CE" | "CO"]}`,
          nivel: entrada.nivel,
          destreza: prueba.prueba,
          examen: entrada.numero,
          tipo: "PREPARACION_DELE",
          orden: entrada.bloque,
          publicado: false,
          autorId: entrada.autorId,
        },
        select: { id: true },
      });
      ids[prueba.prueba as "CE" | "CO"] = recorrido.id;

      for (const tarea of prueba.tareas) {
        const paso = await tx.paso.create({
          data: {
            recorridoId: recorrido.id,
            orden: tarea.numero,
            ciclo: 1,
            tipo: tipoDePasoDeTarea(),
            destreza: prueba.prueba,
            titulo: `Tarea ${tarea.numero}`,
          },
          select: { id: true },
        });
        const ejercicio = await tx.ejercicio.create({
          data: {
            tipo: TIPO_DE_EJERCICIO[tarea.motor],
            titulo: `${entrada.titulo} · ${NOMBRE_PRUEBA[prueba.prueba as "CE" | "CO"]} · Tarea ${tarea.numero}`,
            nivel: entrada.nivel,
            destreza: prueba.prueba,
            etiquetas: [],
            datos: estructuraDe(tarea) as Prisma.InputJsonValue,
            publicado: false,
            autorId: entrada.autorId,
          },
          select: { id: true },
        });
        await tx.pasoEjercicio.create({ data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 } });
        pasos.push({ prueba: prueba.prueba as "CE" | "CO", numero: tarea.numero, pasoId: paso.id });
      }
    }

    const examen = await tx.examen.create({
      data: {
        titulo: entrada.titulo,
        nivel: entrada.nivel,
        fuente: entrada.fuente,
        numero: entrada.numero,
        bloque: entrada.bloque,
        lecturaId: ids.CE,
        auditivaId: ids.CO,
        creadoPorId: entrada.autorId,
        tareas: { create: pasos.map((p) => ({ prueba: p.prueba, numero: p.numero, pasoId: p.pasoId })) },
      },
      select: { id: true },
    });
    return examen.id;
  });
}
