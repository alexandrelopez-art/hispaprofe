import type { TipoPaso } from "@/lib/generated/prisma/enums";
import type { TareaDele } from "@/lib/dele/mapa";
import { sobrantesDe } from "@/lib/dele";

/** Una tarea del examen es un paso de tipo actividad, como en los sembrados. */
export function tipoDePasoDeTarea(_tarea: TareaDele): TipoPaso {
  return "ACTIVIDAD";
}

/**
 * El punto de partida de un ejercicio para esta tarea: tantos ítems y tantas
 * opciones como dice el mapa, y los sobrantes ya separados.
 *
 * Los ids van `p1…pN` y `r1…rN` porque es lo que esperan los editores, que
 * calculan el siguiente por el máximo de los sufijos existentes.
 *
 * Sale con los campos en blanco, así que todavía no pasa el esquema: es un
 * andamio para rellenar, y los avisos del editor van diciendo qué falta.
 */
export function estructuraDe(tarea: TareaDele): unknown {
  const sobrantes = sobrantesDe(tarea);

  if (tarea.motor === "relacionar") {
    return {
      ejercicio: "relacionar",
      consigna: "",
      ...(tarea.formato === "GAP_INSERT" ? { texto: "" } : {}),
      parejas: Array.from({ length: tarea.items }, (_, i) => ({
        id: `r${i + 1}`,
        izquierda: tarea.formato === "GAP_INSERT" ? `Hueco ${i + 1}` : "",
        derecha: "",
      })),
      sobrantes: Array.from({ length: sobrantes }, () => ""),
      escuchas: 2,
    };
  }

  // `opcion`, con lista común o sin ella según lo que diga el mapa.
  return {
    ejercicio: "opcion",
    consigna: "",
    multiple: false,
    // El muro lo hace el número de preguntas, no el de opciones: catorce
    // huecos de tres opciones son catorce filas de botones. La regla de
    // antes era `listaComun && opciones > 4`, y no la cumple ninguna tarea
    // del mapa —con lista común el máximo de opciones es 4—, así que el
    // desplegable era inalcanzable justo donde hace falta: B2 · CE · T4 son
    // catorce huecos, y `CLOZE` ni siquiera usa lista común.
    //
    // Ocho es el corte: las tareas normales de seis o siete se leen mejor en
    // botones. No es una decisión cerrada: «Cómo se enseña» está en el
    // editor, fuera del bloque de lista común, y se cambia en un clic.
    presentacion: tarea.items > 8 ? "desplegable" : "botones",
    ...(tarea.listaComun
      ? { opcionesComunes: Array.from({ length: tarea.opciones }, () => "") }
      : {}),
    escuchas: 2,
    preguntas: Array.from({ length: tarea.items }, (_, i) => ({
      id: `p${i + 1}`,
      enunciado: "",
      ...(tarea.listaComun
        ? {}
        : { opciones: Array.from({ length: tarea.opciones }, () => "") }),
      correctas: [],
    })),
  };
}
