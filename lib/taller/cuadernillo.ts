import { prisma } from "@/lib/prisma";

/** Texto de un PDF con capa de texto, página a página. Vacío si es un escaneo. */
export async function textoDePdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    let linea = "";
    let ultimoY: number | null = null;
    const lineas: string[] = [];
    for (const item of contenido.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (ultimoY !== null && Math.abs(y - ultimoY) > 2) { lineas.push(linea.trim()); linea = ""; }
      linea += (linea && !linea.endsWith(" ") ? " " : "") + item.str;
      ultimoY = y;
    }
    if (linea.trim()) lineas.push(linea.trim());
    paginas.push(lineas.join("\n"));
  }
  return paginas.join("\n\n").trim();
}

const LIMITE = 40_000;

/**
 * El trozo del cuadernillo que le toca a una tarea. Busca el rótulo del
 * examen («EXAMEN 2») y se queda desde ahí hasta el siguiente examen, y añade
 * los bloques «SOLUCIONES». Si no encuentra el rótulo, manda el cuadernillo
 * entero (recortado a 40.000 caracteres) y lo dice.
 *
 * Cada bloque «SOLUCIONES» se busca en el texto **entero**, no solo dentro
 * de `delExamen` — en un cuadernillo real las páginas de soluciones de
 * varios exámenes suelen ir juntas al final, separadas de sus propias
 * preguntas. Para no tragarse de paso las soluciones (o el rótulo) del
 * examen siguiente, cada bloque se corta en el primer «EXAMEN N» que
 * encuentre después, o a los 3.000 caracteres si no hay ninguno antes.
 */
export function trozoDeClaves(
  texto: string,
  numero: number,
  prueba: "CE" | "CO",
  tarea: number,
): { texto: string; recortado: boolean } {
  const inicio = texto.search(new RegExp(`EXAMEN\\s+${numero}\\b`, "i"));
  if (inicio < 0) return { texto: texto.slice(0, LIMITE), recortado: true };
  const resto = texto.slice(inicio);
  const fin = resto.slice(10).search(new RegExp(`EXAMEN\\s+${numero + 1}\\b`, "i"));
  const delExamen = fin < 0 ? resto : resto.slice(0, fin + 10);
  const soluciones = [...texto.matchAll(/SOLUCIONES[\s\S]*?(?=EXAMEN\s+\d+\b|$)/g)]
    .map((m) => m[0].slice(0, 3000))
    .join("\n\n");
  const nombre = prueba === "CE" ? "LECTURA" : "AUDITIVA";
  const cabecera = `Examen ${numero}, prueba de comprensión ${nombre.toLowerCase()}, tarea ${tarea}.\n\n`;
  return { texto: (cabecera + delExamen + "\n\n" + soluciones).slice(0, LIMITE), recortado: false };
}

export async function guardarCuadernillo(examenId: string, bytes: Uint8Array): Promise<{ caracteres: number }> {
  const texto = await textoDePdf(bytes);
  await prisma.examen.update({ where: { id: examenId }, data: { clavesTexto: texto || null } });
  return { caracteres: texto.length };
}
