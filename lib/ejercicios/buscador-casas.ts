import { z } from "zod";

// Contrato de datos del ejercicio WIDGET "buscador_casas".
// Fija la forma de las viviendas para que el reproductor sepa dibujarlas
// y para que ningun ejercicio de este tipo entre con estructura distinta.

export const viviendaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  zona: z.string(),
  precio: z.string(),
  ilustracion: z.enum(["piso", "casa", "atico"]),
  hay: z.array(z.string()).min(1),
  noHay: z.array(z.string()).min(1),
});

export const buscadorCasasSchema = z.object({
  widget: z.literal("buscador_casas"),
  marca: z.string(),
  consigna: z.string(),
  viviendas: z.array(viviendaSchema).min(1),
});

export type BuscadorCasas = z.infer<typeof buscadorCasasSchema>;

export type Vivienda = z.infer<typeof viviendaSchema>;
