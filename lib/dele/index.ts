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

/** Un paso visto por el mapa: lo justo para saber qué tarea reclama. */
export type PasoSituable = { titulo: string; orden: number };

/**
 * Qué tarea del examen es un paso: la que dice su título —«Tarea 3»—, y si
 * el título no lo dice, su posición en la secuencia.
 *
 * **Una sola regla para dos pantallas.** La ficha del paso la usa para saber
 * qué tarea enseñar; el panel de tareas sugeridas, para saber cuáles ya
 * están puestas. Cuando eran dos copias —una por el título, otra por el
 * `orden`— se desincronizaban: añadir primero la Tarea 3 la dejaba con
 * `orden` 1, así que la ficha acertaba y la lista daba por puesta la Tarea 1,
 * escondía la que faltaba y seguía ofreciendo la que ya estaba.
 *
 * El título manda porque es lo que el profesor ve y lo que `crearPaso` deja
 * escrito; el `orden` es la reserva, para que un paso de título libre
 * —«Calentamiento»— se siga situando como siempre se ha situado.
 */
export function numeroDeTarea(paso: PasoSituable): number {
  const enElTitulo = /^Tarea (\d+)$/.exec(paso.titulo.trim());
  return enElTitulo ? Number(enElTitulo[1]) : paso.orden;
}

/** Cómo se llama lo que se cuenta en cada motor: singular y plural. */
const CUENTA: Record<string, [string, string]> = {
  opcion: ["pregunta", "preguntas"],
  relacionar: ["pareja", "parejas"],
};

/**
 * Cuántos ítems lleva escritos un ejercicio, o null si no hay nada que
 * contar.
 *
 * No es lo mismo en cada motor: en `relacionar` los ítems son las parejas
 * —los sobrantes no cuentan, que no son ítems de nadie— y en `opcion` son
 * las preguntas. Se mira la lista que le toca al motor de la tarea, así que
 * unos datos que no encajen con ella devuelven null y no se avisa de nada.
 */
export function itemsEscritos(tarea: TareaDele, datos: unknown): number | null {
  const d = datos as { preguntas?: unknown; parejas?: unknown } | null;
  const lista = tarea.motor === "relacionar" ? d?.parejas : d?.preguntas;
  return Array.isArray(lista) ? lista.length : null;
}

/**
 * El aviso de que este ejercicio no lleva los ítems que lleva la tarea en el
 * examen, o null si los lleva.
 *
 * **Avisa y no rechaza**, que es como funciona todo el mapa: un ejercicio de
 * práctica más corto que la tarea oficial es una decisión pedagógica, no un
 * error. Nada de aquí apaga el «Guardar».
 */
export function avisoDeItems(tarea: TareaDele, datos: unknown): string | null {
  const llevas = itemsEscritos(tarea, datos);
  if (llevas === null || llevas === tarea.items) return null;
  const [uno, varios] = CUENTA[tarea.motor] ?? ["ítem", "ítems"];
  const nombre = tarea.items === 1 ? uno : varios;
  return `En el examen esta tarea lleva ${tarea.items} ${nombre}; llevas ${llevas}. Puedes guardarlo así.`;
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
