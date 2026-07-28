/**
 * Verifica el ejercicio de opción múltiple: que la solución no viaje al
 * navegador y que la corrección cuente bien. Ejecutar con:
 *   npx tsx scripts/verificar-ejercicios.ts
 */
import "dotenv/config";
import {
  corregir,
  opcionMultipleSchema,
  versionPublica,
  type OpcionMultiple,
} from "@/lib/ejercicios/opcion-multiple";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const EJEMPLO: OpcionMultiple = {
  ejercicio: "opcion_multiple",
  consigna: "Prueba",
  preguntas: [
    { id: "a", enunciado: "1", opciones: ["si", "no"], correcta: 0 },
    { id: "b", enunciado: "2", opciones: ["si", "no"], correcta: 1 },
    { id: "c", enunciado: "3", opciones: ["si", "no"], correcta: 0 },
  ],
};

async function main() {
  // 1. La versión que va al navegador no lleva la solución.
  const publica = versionPublica(EJEMPLO);
  const serializada = JSON.stringify(publica);
  afirmar(
    !serializada.includes("correcta"),
    "la versión pública no contiene el campo correcta",
  );
  afirmar(
    publica.preguntas.length === EJEMPLO.preguntas.length,
    "la versión pública conserva todas las preguntas",
  );

  // 2. La corrección cuenta un punto por acierto.
  afirmar(
    corregir(EJEMPLO, new Map([["a", 0], ["b", 1], ["c", 0]])).aciertos === 3,
    "todo acertado da 3 puntos",
  );
  afirmar(
    corregir(EJEMPLO, new Map([["a", 0], ["b", 0], ["c", 1]])).aciertos === 1,
    "un acierto da 1 punto",
  );
  afirmar(corregir(EJEMPLO, new Map()).aciertos === 0, "sin responder, 0 puntos");
  afirmar(
    corregir(EJEMPLO, new Map([["a", 1], ["b", 0], ["c", 1]])).aciertos === 0,
    "todo fallado da 0 puntos, no negativo",
  );

  // 3. Los ejercicios sembrados de verdad tienen forma válida.
  const enBase = await prisma.ejercicio.findMany({
    where: { tipo: "OPCION_MULTIPLE" },
    select: { titulo: true, datos: true },
  });
  afirmar(enBase.length > 0, `hay ${enBase.length} ejercicios de opción múltiple en la base`);
  for (const e of enBase) {
    const parseado = opcionMultipleSchema.safeParse(e.datos);
    afirmar(parseado.success, `"${e.titulo}" tiene forma válida`);
    if (parseado.success) {
      const fuera = parseado.data.preguntas.filter(
        (p) => p.correcta < 0 || p.correcta >= p.opciones.length,
      );
      afirmar(
        fuera.length === 0,
        `"${e.titulo}": toda respuesta correcta apunta a una opción que existe`,
      );
    }
  }

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
