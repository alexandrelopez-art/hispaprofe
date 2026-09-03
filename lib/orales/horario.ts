/**
 * El horario que pega el liceo, ya interpretado.
 *
 * Es la lógica más frágil de la rama —siete campos, dos separadores, dos
 * formatos de pausa, herencia del día— y por eso vive aquí, pura, fuera de
 * `lib/acciones-orales.ts`: una acción de servidor exige sesión, así
 * que `scripts/verificar-orales.ts` no puede llamarla ni ejercitar esta
 * lógica a través de ella. Lo que hace la acción con esto —emparejar por
 * correo o por nombre, comprobar las reglas, escribir— sí necesita Prisma y
 * se queda allí.
 */

/**
 * Una línea ya interpretada. Una pausa solo lleva el día (ya heredado); un
 * turno lleva los siete campos que trae la fila del liceo.
 */
export type LineaHorario =
  | { pausa: true; dia: string }
  | {
      pausa: false;
      dia: string;
      preparacion: string | null;
      hora: string;
      apellido: string;
      nombre: string;
      sala: string | null;
      correo: string | null;
    };

/**
 * Trocea el texto pegado del horario del liceo en líneas ya interpretadas.
 *
 * Una línea por turno, con tabulador o punto y coma:
 *   Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI
 *
 * Una pausa se pega de dos formas, y las dos hay que reconocerlas:
 *  - Un `---` pelado, sin más campos.
 *  - Una fila de columnas con `---` en el cuarto campo (el de la hora de
 *    paso) y el resto vacío: `; ; ; --- ; ;`.
 *
 * El día no siempre viene en cada fila: el liceo suele pegarlo una sola vez
 * al principio de la jornada y dejarlo en blanco en las siguientes —pausas
 * incluidas—. Por eso cada línea hereda el último día visto (`ultimoDia`) en
 * vez de quedarse con lo que trae su propio campo. La herencia usa `||` y no
 * `??`: el campo vacío llega como cadena vacía, no como `undefined`, y solo
 * `||` la deja caer al valor anterior.
 */
export function parsearHorario(texto: string): LineaHorario[] {
  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const resultado: LineaHorario[] = [];
  let ultimoDia = "";

  for (const linea of lineas) {
    const campos = linea.split(/[\t;]/).map((c) => c.trim());
    const esPausa = campos[0] === "---" || campos[3] === "---";

    if (esPausa) {
      // El campo del día trae el `---` pelado en el primer formato, y está
      // vacío en el de columnas: en los dos casos no es un día de verdad, así
      // que los dos caen igual en `|| ultimoDia`.
      const propio = campos[0] === "---" ? "" : campos[0];
      const dia = propio || ultimoDia;
      if (dia) ultimoDia = dia;
      resultado.push({ pausa: true, dia });
      continue;
    }

    const [diaCampo, preparacion, hora, apellido, nombre, sala, correo] = campos;
    const dia = diaCampo || ultimoDia;
    if (dia) ultimoDia = dia;
    resultado.push({
      pausa: false,
      dia,
      preparacion: preparacion || null,
      hora: hora ?? "",
      apellido: apellido ?? "",
      nombre: nombre ?? "",
      sala: sala || null,
      correo: correo || null,
    });
  }

  return resultado;
}
