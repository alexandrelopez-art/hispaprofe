/**
 * Verifica el sobre que se pega en un paso y el encargo que se le entrega a
 * la IA. Las dos primeras partes no tocan la base; la tercera crea sus
 * propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-pegado.ts
 */
import "dotenv/config";
import { abrirSobre, resumir, sinValla } from "@/lib/pegado/sobre";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/** Un sobre válido de relacionar, corto pero completo. */
const SOBRE_BUENO = {
  bloque: "## Tablón de anuncios\n\n**A.** Grupo de música busca sala.",
  ejercicio: {
    ejercicio: "relacionar",
    consigna: "Relaciona a cada joven con su anuncio.",
    parejas: [
      { id: "1", izquierda: "MARCOS: toco la guitarra.", derecha: "A. MUSICALDÍA" },
      { id: "2", izquierda: "LUCÍA: quiero una bici.", derecha: "F. AYUNTAMIENTO" },
    ],
    sobrantes: ["C. CREA TU BLOG"],
  },
};

async function main() {
  // ─── La valla de la IA ───────────────────────────────────────────────
  afirmar(
    sinValla('```json\n{"a":1}\n```') === '{"a":1}',
    "sinValla quita la valla ```json que ponen las IA",
  );
  afirmar(
    sinValla('Aquí tienes:\n```\n{"a":1}\n```\n¡Espero que sirva!') === '{"a":1}',
    "sinValla tira lo que la IA escribe antes y después de la valla",
  );
  afirmar(
    sinValla('Aquí tienes: {"a":1} ¡Espero que sirva!') === '{"a":1}',
    "sinValla recorta desde la primera llave hasta la última cuando no hay valla",
  );

  // ─── El sobre bueno ──────────────────────────────────────────────────
  const bueno = abrirSobre(JSON.stringify(SOBRE_BUENO));
  afirmar(!("error" in bueno), "un sobre válido se abre");
  if ("error" in bueno) throw new Error(bueno.error);
  afirmar(bueno.tipo === "RELACIONAR", "el sobre dice el TipoEjercicio de la base");
  afirmar(
    bueno.bloque === SOBRE_BUENO.bloque,
    "el bloque sale tal cual, con su markdown",
  );

  // ─── El ejercicio a pelo, sin sobre ──────────────────────────────────
  // Es el error más probable de una IA, y el único que se acepta en vez de
  // rechazarse: la intención no tiene otra lectura posible.
  const aPelo = abrirSobre(JSON.stringify(SOBRE_BUENO.ejercicio));
  afirmar(!("error" in aPelo), "un ejercicio pegado sin sobre se envuelve solo");
  if ("error" in aPelo) throw new Error(aPelo.error);
  afirmar(aPelo.bloque === null, "un ejercicio sin sobre se queda sin bloque");

  // ─── Las negativas ───────────────────────────────────────────────────
  const vacio = abrirSobre("   ");
  afirmar("error" in vacio, "un cuadro vacío se rechaza");

  const noJson = abrirSobre("esto no es JSON, es una frase");
  afirmar("error" in noJson, "un texto que no es JSON se rechaza");
  afirmar(
    "error" in noJson && !noJson.error.includes("undefined"),
    "el rechazo de lo que no es JSON dice algo legible, no «undefined»",
  );

  const sinCasilla = abrirSobre('{"bloque":"solo el texto"}');
  afirmar(
    "error" in sinCasilla && sinCasilla.error.includes("ejercicio"),
    "un sobre sin la casilla `ejercicio` dice que le falta",
  );

  const bloqueRaro = abrirSobre('{"bloque":42,"ejercicio":{"ejercicio":"ordenar"}}');
  afirmar("error" in bloqueRaro, "un `bloque` que no es texto se rechaza");

  const tipoRaro = abrirSobre('{"ejercicio":{"ejercicio":"inventado"}}');
  afirmar(
    "error" in tipoRaro && tipoRaro.error.includes("tipo"),
    "un ejercicio de tipo desconocido da el motivo de zod",
  );

  // El motivo lo escribe el esquema, no este módulo: se comprueba pidiendo
  // un sobrante que repita una respuesta buena, cuyo mensaje ya está escrito.
  const sobranteRepetido = abrirSobre(
    JSON.stringify({
      ejercicio: {
        ...SOBRE_BUENO.ejercicio,
        sobrantes: ["A. MUSICALDÍA"],
      },
    }),
  );
  afirmar(
    "error" in sobranteRepetido && sobranteRepetido.error.includes("sobrante"),
    "el motivo del rechazo lo escribe el esquema, en castellano",
  );

  // ─── La ida y la vuelta ──────────────────────────────────────────────
  const vuelta = abrirSobre(JSON.stringify(SOBRE_BUENO));
  if ("error" in vuelta) throw new Error(vuelta.error);
  afirmar(
    JSON.stringify(vuelta.ejercicio) === JSON.stringify(SOBRE_BUENO.ejercicio),
    "el ejercicio sale del sobre idéntico a como entró",
  );

  // ─── El resumen ──────────────────────────────────────────────────────
  const dice = resumir(SOBRE_BUENO.ejercicio);
  afirmar(dice.includes("2"), "el resumen cuenta las parejas");
  afirmar(dice.includes("1"), "el resumen cuenta los sobrantes");

  console.log("\nTodo en orden.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
