import type { TipoRecorrido } from "@/lib/generated/prisma/enums";

/**
 * Cómo se llama cada servicio en la interfaz.
 *
 * Vivía copiada a mano en siete pantallas, todas con el mismo nombre y el
 * mismo contenido. Con siete copias, el día que cambie una etiqueta va a
 * faltar en alguna: es la misma lección que dejó escrita la deuda del plan
 * del bloqueo sobre enumerar pantallas de memoria.
 */
export const servicioLabel: Record<TipoRecorrido, string> = {
  CLASES_PARTICULARES: "Clases particulares",
  PREPARACION_DELE: "Preparación DELE",
};
