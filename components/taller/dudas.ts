export type Duda = { campo: string; texto: string };

/**
 * La duda que la IA dejó sobre un campo, si la hay. Los caminos que
 * escribe la IA son «p3.opciones[1]», «p3.enunciado», «r2.derecha»,
 * «consigna», «bloque»; se comparan tal cual, sin espacios.
 */
export function dudaDe(dudas: Duda[], campo: string): string | null {
  const limpio = campo.replace(/\s+/g, "");
  return dudas.find((d) => d.campo.replace(/\s+/g, "") === limpio)?.texto ?? null;
}
