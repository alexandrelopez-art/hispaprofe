import type { TonoEtiqueta } from "@/components/ui/etiqueta";

/**
 * El rótulo y el tono de cada tipo de paso. Estaba triplicado en
 * `/pasos/[pasoId]`, `/recorridos/[id]` y `/recorridos`: los tres pintan la
 * misma `Etiqueta` sobre el mismo campo.
 */
export const tipoLabel: Record<string, string> = {
  ACTIVACION: "Activación",
  ACTIVIDAD: "Actividad",
  ANDAMIAJE: "Andamiaje",
  MICRO_TAREA: "Micro tarea",
  MACRO_TAREA: "Macro tarea",
};

// El color más cercano de la identidad para cada tipo de paso.
export const tipoTono: Record<string, TonoEtiqueta> = {
  ACTIVACION: "bloque2",
  ACTIVIDAD: "hp",
  ANDAMIAJE: "bloque1",
  MICRO_TAREA: "sol",
  MACRO_TAREA: "bloque3",
};
