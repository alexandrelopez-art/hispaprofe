import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { PRUEBAS, type PruebaDele, type TareaDele } from "@/lib/dele/mapa";

export * from "@/lib/dele/mapa";

/** Las pruebas que este nivel tiene en el mapa. Vacío si no hay ninguna. */
export function pruebasDe(nivel: Nivel): PruebaDele[] {
  return PRUEBAS.filter((p) => p.nivel === nivel);
}

export function pruebaDe(nivel: Nivel, destreza: Destreza): PruebaDele | null {
  return PRUEBAS.find((p) => p.nivel === nivel && p.prueba === destreza) ?? null;
}

/**
 * La tarea número N de una prueba, o null.
 *
 * El número de tarea es el orden del paso dentro de la secuencia, así que
 * un paso más allá de la última tarea oficial devuelve null y la pantalla
 * se comporta como si no hubiera mapa. Es a propósito: el mapa aconseja y
 * no manda, y añadir un sexto paso a una prueba de cinco está permitido.
 */
export function tareaDe(
  nivel: Nivel,
  destreza: Destreza,
  numero: number,
): TareaDele | null {
  return pruebaDe(nivel, destreza)?.tareas.find((t) => t.numero === numero) ?? null;
}

/**
 * Cuántas opciones sobran en esta tarea. Cero si no sobra ninguna.
 *
 * Solo `relacionar` puede tener sobrantes: es el único que reparte de una
 * lista única y uno a uno. En `opcion`, `opciones` son las de cada ítem
 * —tres por pregunta, no tres en total—, así que restarle los ítems no
 * significa nada y hay que devolver cero sin mirar.
 */
export function sobrantesDe(tarea: TareaDele): number {
  if (tarea.motor !== "relacionar") return 0;
  return Math.max(0, tarea.opciones - tarea.items);
}
