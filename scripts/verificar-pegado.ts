/**
 * Verifica el sobre que se pega en un paso y el encargo que se le entrega a
 * la IA. Las dos primeras partes no tocan la base; la tercera crea sus
 * propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-pegado.ts
 */
import "dotenv/config";
import { abrirSobre, resumir, sinValla } from "@/lib/pegado/sobre";
import { EJEMPLOS } from "@/lib/pegado/ejemplos";
import { TIPO_DE_EJERCICIO } from "@/lib/recursos";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pasoLibre } from "@/lib/recursos";

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

// Los ids de todo lo que se crea, en variables de módulo para poder
// limpiarlo desde el `.finally()` aunque una afirmación reviente a mitad.
const marca = `verificar-pegado-${process.pid}`;
let recorridoId: string | null = null;
let pasoId: string | null = null;
let ejercicioId: string | null = null;

/**
 * Ejercicios mínimos y válidos de los otros tres tipos del motor, más una
 * expresión: para que `resumir` se ejercite en sus cuatro ramas y en la de
 * expresión, no solo en la de relacionar.
 */
const OPCION_BUENA = {
  ejercicio: "opcion",
  consigna: "Elige la opción correcta.",
  multiple: false,
  preguntas: [
    {
      id: "1",
      enunciado: "¿Cuál es la capital de España?",
      opciones: ["Madrid", "Lisboa"],
      correctas: [0],
    },
  ],
};

/** Su `{{1}}` sirve dos veces: valida `resumir` y, en H1, que sobrevive dentro del JSON. */
const HUECOS_BUENOS = {
  ejercicio: "huecos",
  consigna: "Completa el hueco.",
  texto: "Ella {{1}} muy feliz.",
  huecos: [{ id: "1", acepta: ["está"] }],
};

const ORDENAR_BUENO = {
  ejercicio: "ordenar",
  consigna: "Ordena las piezas.",
  piezas: [
    { id: "1", texto: "Primero" },
    { id: "2", texto: "Segundo" },
  ],
};

const EXPRESION_BUENA = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "Escribe una redacción sobre tus vacaciones.",
  palabras: { minimo: 100, maximo: 150 },
  criterios: [{ id: "1", nombre: "Adecuación", maximo: 10 }],
};

/** JSON.parse sin reventar, para comprobar que un texto recuperado sí lo era. */
function intentaParsear(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

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

  // ─── Las llaves sueltas de la prosa ───────────────────────────────────
  // El dominio está lleno de ellas: los huecos usan `{{id}}`, y una IA que
  // explica el formato antes o después del JSON las menciona. El recorte
  // ingenuo —primera `{` a última `}`— cortaba por donde no era.
  const conLlaveAntes =
    "Aquí tienes el ejercicio de huecos, que usa el formato {{1}} para marcarlos:\n" +
    JSON.stringify(HUECOS_BUENOS) +
    "\n¡Suerte!";
  afirmar(
    JSON.stringify(intentaParsear(sinValla(conLlaveAntes))) === JSON.stringify(HUECOS_BUENOS),
    "sinValla no confunde el {{1}} de la prosa de antes con el principio del JSON",
  );

  const conLlaveDespues =
    JSON.stringify(HUECOS_BUENOS) +
    "\nRecuerda usar siempre llaves { } para las variables.";
  afirmar(
    JSON.stringify(intentaParsear(sinValla(conLlaveDespues))) === JSON.stringify(HUECOS_BUENOS),
    "sinValla no confunde la llave suelta de la prosa de después con el final del JSON",
  );
  // Las dos comprobaciones anteriores recuperan un JSON cuyo propio `texto`
  // lleva un `{{1}}` dentro: si el equilibrado no respetara las cadenas,
  // ese hueco interno también lo habría roto.

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
  // Se compara contra la frase entera, no contra dígitos sueltos: con 2
  // parejas y 1 sobrante, un error que intercambiara los dos conteos
  // seguiría teniendo ambos dígitos en algún sitio de la cadena.
  afirmar(
    resumir(SOBRE_BUENO.ejercicio) === "relacionar · 2 parejas · 1 sobrantes",
    "el resumen de relacionar cuenta las parejas y los sobrantes por separado",
  );
  afirmar(
    resumir(OPCION_BUENA) === "opción · 1 preguntas",
    "el resumen de opción cuenta las preguntas",
  );
  afirmar(
    resumir(HUECOS_BUENOS) === "huecos · 1 huecos",
    "el resumen de huecos cuenta los huecos",
  );
  afirmar(
    resumir(ORDENAR_BUENO) === "ordenar · 2 piezas",
    "el resumen de ordenar cuenta las piezas",
  );
  afirmar(
    resumir(EXPRESION_BUENA) === "tarea de expresión",
    "el resumen de una expresión no cuenta nada: analizar no la conoce",
  );

  // ─── Los ejemplos resueltos ──────────────────────────────────────────
  //
  // Esta es la comprobación que sujeta el diseño entero. Un ejemplo roto
  // dentro del encargo no falla en ninguna pantalla: falla en silencio
  // enseñándole a la IA a devolver basura, y el fallo aparece tres semanas
  // después con un examen mal montado y sin saber de dónde viene.
  const MOTORES: MarcaEjercicio[] = ["opcion", "relacionar", "huecos", "ordenar"];
  for (const motor of MOTORES) {
    const abierto = abrirSobre(JSON.stringify(EJEMPLOS[motor]));
    afirmar(!("error" in abierto), `el ejemplo de ${motor} es un sobre que se abre`);
    if ("error" in abierto) throw new Error(abierto.error);
    afirmar(
      abierto.tipo === TIPO_DE_EJERCICIO[motor],
      `el ejemplo de ${motor} es del motor que dice ser`,
    );
    afirmar(
      abierto.bloque !== null || motor === "huecos" || motor === "ordenar",
      `el ejemplo de ${motor} enseña también cómo se manda el bloque`,
    );
  }

  // ─── Las negativas del paso ──────────────────────────────────────────
  const recorrido = await prisma.recorrido.create({
    data: { titulo: marca, nivel: "B1", tipo: "PREPARACION_DELE", destreza: "CE", orden: 1 },
    select: { id: true },
  });
  recorridoId = recorrido.id;

  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Tarea 1" },
    select: { id: true },
  });
  pasoId = paso.id;

  afirmar((await pasoLibre(paso.id)) === null, "un paso recién creado está libre");

  const ejercicio = await prisma.ejercicio.create({
    data: {
      tipo: "RELACIONAR",
      titulo: marca,
      nivel: "B1",
      // El cast es el mismo que usa `guardarEjercicio`: `datos` es `Json` y
      // Prisma no acepta un objeto literal sin él.
      datos: SOBRE_BUENO.ejercicio as Prisma.InputJsonValue,
      publicado: true,
    },
    select: { id: true },
  });
  ejercicioId = ejercicio.id;
  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
  });

  const ocupado = await pasoLibre(paso.id);
  afirmar(
    ocupado !== null && ocupado.includes("ya tiene un ejercicio"),
    "un paso que ya tiene ejercicio deja de estar libre",
  );

  console.log("\nTodo en orden.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    const intentar = async (que: string, hacer: () => Promise<unknown>) => {
      try {
        await hacer();
      } catch (e) {
        fallos++;
        console.error(`  no se pudo limpiar ${que}: ${e instanceof Error ? e.message : e}`);
      }
    };

    // El orden importa: primero lo que apunta al paso, luego el paso.
    if (pasoId) {
      const id = pasoId;
      await intentar("vínculos", () => prisma.pasoEjercicio.deleteMany({ where: { pasoId: id } }));
      await intentar("bloques", () => prisma.bloque.deleteMany({ where: { pasoId: id } }));
      await intentar("paso", () => prisma.paso.delete({ where: { id } }));
    }
    if (ejercicioId) {
      const id = ejercicioId;
      await intentar("ejercicio", () => prisma.ejercicio.delete({ where: { id } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }

    await intentar("desconectar", () => prisma.$disconnect());

    // Un rechazo sin capturar aquí sería silencioso: nadie lo ve y la basura
    // se descubre a mano.
    if (fallos > 0) {
      console.error(`\nLa limpieza falló en ${fallos} paso(s): puede haber quedado basura en la base.`);
      process.exitCode = 1;
    }
  });
