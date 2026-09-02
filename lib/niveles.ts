/** Los seis niveles y cómo se escriben en pantalla. Sustituye a las copias
 *  de `nivelLabel` repartidas por las páginas (la sesión B las quita). */
export const NIVELES = [
  { valor: "A1", nombre: "A1" },
  { valor: "A2", nombre: "A2" },
  { valor: "B1", nombre: "B1" },
  { valor: "B2", nombre: "B2" },
  { valor: "C1", nombre: "C1" },
  { valor: "A2_B1_ESCOLAR", nombre: "A2/B1 escolar" },
] as const;

export function nombreNivel(valor: string | null | undefined): string {
  if (!valor) return "";
  return NIVELES.find((n) => n.valor === valor)?.nombre ?? valor;
}
