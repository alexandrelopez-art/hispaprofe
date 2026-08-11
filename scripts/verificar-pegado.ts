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
import { PRUEBAS, sobrantesDe } from "@/lib/dele";
import { componerEncargo, encargosPara } from "@/lib/pegado/encargo";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/**
 * El campo que solo aparece en el encargo de ese motor: prueba de que el
 * encargo describe de verdad su forma, y no solo que `Encargo.motor` repite
 * el parámetro que se le pasó.
 */
const PALABRA_DEL_MOTOR: Record<MarcaEjercicio, string> = {
  opcion: "preguntas",
  relacionar: "parejas",
  huecos: "huecos",
  ordenar: "piezas",
};

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

  // El `ejercicio` que acompaña al `bloque` malo tiene que valer, y antes no
  // valía: `{"ejercicio":"ordenar"}` no cumple el esquema —`piezas` necesita
  // dos—, así que la afirmación seguía verde aunque se borrara la
  // comprobación del tipo de `bloque`. Pasaba por el motivo equivocado. Con un
  // ejercicio bueno, lo único que puede fallar es el `bloque`, y para que se
  // vea que es eso lo que falla se fija el motivo, como en las otras cuatro
  // negativas de este archivo.
  afirmar(
    !("error" in abrirSobre(JSON.stringify({ ejercicio: ORDENAR_BUENO }))),
    "el ejercicio que acompaña al `bloque` malo se abre por su cuenta",
  );
  const bloqueRaro = abrirSobre(JSON.stringify({ bloque: 42, ejercicio: ORDENAR_BUENO }));
  afirmar(
    "error" in bloqueRaro && bloqueRaro.error.includes("entre comillas"),
    "un `bloque` que no es texto se rechaza, y por no ser texto",
  );

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

  // La tercera regla de `relacionar`, que el encargo no contaba: el esquema la
  // hace cumplir igual, así que sin decirla la IA la rompe sin saberlo y el
  // rechazo llega después de haber transcrito la tarea entera. Se comprueban
  // las dos mitades juntas —que el esquema la exige y que el encargo la dice—
  // porque por separado ninguna de las dos sujeta nada.
  const sobrantesIguales = abrirSobre(
    JSON.stringify({
      ejercicio: {
        ...SOBRE_BUENO.ejercicio,
        sobrantes: ["C. CREA TU BLOG", "C. CREA TU BLOG"],
      },
    }),
  );
  afirmar(
    "error" in sobrantesIguales && sobrantesIguales.error.includes("Dos sobrantes"),
    "el esquema rechaza dos sobrantes iguales",
  );
  afirmar(
    componerEncargo("Prueba", "relacionar", null).texto.includes("Dos sobrantes tampoco pueden ser iguales"),
    "el encargo de relacionar avisa de que dos sobrantes no pueden ser iguales",
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
    // Una equivalencia y no un `||` de excusas: `bloque !== null || motor ===
    // "huecos" || motor === "ordenar"` era literalmente `false || false ||
    // true` en dos de las cuatro vueltas —no podía fallar— y encima decía que
    // el ejemplo de huecos enseña el bloque, que no lo lleva. Lo que hay que
    // sujetar es el reparto: `opcion` y `relacionar` traen bloque porque su
    // tarea tiene algo que leer aparte de los ítems; `huecos` y `ordenar` no
    // tienen nada que leer fuera de sus propias piezas.
    afirmar(
      (abierto.bloque !== null) === (motor === "opcion" || motor === "relacionar"),
      `el ejemplo de ${motor} trae bloque exactamente cuando su tipo tiene algo que leer aparte de los ítems`,
    );
  }

  // ─── El ejemplo de `opcion` con lista común ──────────────────────────
  //
  // No es un motor más: es la otra forma de `opcion`, la que le toca a una
  // tarea con `listaComun`. No está en `MOTORES` porque no es una marca de
  // `MarcaEjercicio`; se comprueba aparte y con más detalle, porque un fallo
  // aquí es el mismo "error caro" del proyecto enseñado de vuelta a la IA.
  const listaComunAbierta = abrirSobre(JSON.stringify(EJEMPLOS.opcionListaComun));
  afirmar(!("error" in listaComunAbierta), "el ejemplo de opción con lista común es un sobre que se abre");
  if ("error" in listaComunAbierta) throw new Error(listaComunAbierta.error);
  afirmar(
    listaComunAbierta.tipo === TIPO_DE_EJERCICIO.opcion,
    "el ejemplo de opción con lista común es del motor que dice ser",
  );
  const ejercicioListaComun = listaComunAbierta.ejercicio as {
    opcionesComunes?: unknown;
    preguntas: { opciones?: unknown }[];
  };
  afirmar(
    Array.isArray(ejercicioListaComun.opcionesComunes) && ejercicioListaComun.opcionesComunes.length >= 2,
    "el ejemplo de opción con lista común lleva `opcionesComunes`",
  );
  afirmar(
    ejercicioListaComun.preguntas.every((p) => p.opciones === undefined),
    "en el ejemplo de opción con lista común ninguna pregunta lleva sus propias `opciones`",
  );

  // ─── El encargo, tarea por tarea ─────────────────────────────────────
  let tareasVistas = 0;
  for (const prueba of PRUEBAS) {
    for (const tarea of prueba.tareas) {
      const cual = `${prueba.nivel} · ${prueba.prueba} · T${tarea.numero}`;
      const encargo = componerEncargo(`${prueba.nivel} · Tarea ${tarea.numero}`, tarea.motor, tarea);
      tareasVistas++;

      afirmar(
        encargo.texto.includes(PALABRA_DEL_MOTOR[tarea.motor]),
        `${cual}: el encargo describe de verdad el motor del mapa (habla de «${PALABRA_DEL_MOTOR[tarea.motor]}»)`,
      );
      afirmar(
        encargo.texto.includes(`"${tarea.motor}"`),
        `${cual}: el encargo nombra el motor dentro del JSON que pide`,
      );
      // La frase exacta de la cuenta, igual que en la de los sobrantes de
      // abajo: un número suelto por subcadena se encuentra en cualquier sitio
      // del documento —el `id` de un ejemplo, un número del `pide`— y daría
      // por buena una cuenta que no está. Hoy no había falso positivo, pero
      // que no lo haya depende de los datos del mapa, no de la afirmación.
      afirmar(
        encargo.texto.includes(`**${tarea.items} ítems.**`),
        `${cual}: el encargo dice cuántos ítems lleva`,
      );
      afirmar(encargo.texto.includes(tarea.pide), `${cual}: el encargo dice qué se pide`);

      // ─── El pasaje del cloze ───────────────────────────────────────────
      //
      // Es el dato que faltaba y que no se notaba: sin `texto`, la IA devolvía
      // un `opcion` válido con el pasaje en un bloque aparte, el resumen
      // decía «opción · 7 preguntas» y `avisoDeItems` callaba porque la
      // cuenta cuadra. Lo que salía no era la tarea del examen. El mapa sabe
      // cuál es cuál (`formato === "CLOZE"`), así que se afirma la
      // equivalencia en las dos direcciones: el cloze lo lleva, y ninguna
      // otra tarea lo nombra siquiera.
      const esCloze = tarea.formato === "CLOZE";
      afirmar(
        encargo.texto.includes("`texto`: el pasaje entero") === esCloze,
        `${cual}: el encargo documenta el pasaje exactamente cuando la tarea es un cloze`,
      );
      afirmar(
        encargo.texto.includes("los `id` de las preguntas tienen que ser exactamente los mismos") ===
          esCloze,
        `${cual}: el encargo da la regla de las marcas {{id}} exactamente cuando hay pasaje`,
      );
      afirmar(
        encargo.texto.includes("`bloque` **se omite**") === esCloze,
        `${cual}: solo el cloze dice que el pasaje no va en un bloque aparte`,
      );
      if (tarea.motor === "opcion" && !esCloze) {
        // Ni de pasada: nombrar `texto` donde no toca invita a usarlo, y
        // usarlo en una `MC` corriente da un error sobre unas marcas
        // `{{...}}` que el profesor no ha escrito en ninguna parte.
        afirmar(
          !encargo.texto.includes("`texto`"),
          `${cual}: una tarea de opción que no es cloze no nombra el campo \`texto\``,
        );
      }

      // Los sobrantes solo existen en `relacionar`. En `opcion`, `opciones`
      // son las de cada ítem y restarle los ítems no significa nada, así que
      // el encargo no puede contarlos.
      //
      // Se busca la frase exacta de la cuenta —«**3 sobrantes.**»— y no la
      // palabra suelta: la palabra sale también en la lista de campos y en el
      // ejemplo resuelto de `relacionar`, así que buscarla a secas daría por
      // buena una cuenta que no está.
      const sobran = sobrantesDe(tarea);
      afirmar(
        encargo.texto.includes("sobrantes.**") === sobran > 0,
        `${cual}: el encargo cuenta los sobrantes exactamente cuando los hay`,
      );
      if (sobran > 0) {
        afirmar(
          encargo.texto.includes(`**${sobran} sobrantes.**`),
          `${cual}: el encargo dice que sobran ${sobran}`,
        );
      }

      afirmar(
        !tarea.verificado || !encargo.texto.includes("sin confirmar"),
        `${cual}: una tarea verificada no lleva el aviso de dato sin confirmar`,
      );
      if (!tarea.verificado) {
        afirmar(
          encargo.texto.includes("sin confirmar"),
          `${cual}: una tarea deducida avisa de que su dato está sin confirmar`,
        );
      }

      // La afirmación que impide que vuelva la contradicción entre el
      // ejemplo y la regla: el ejemplo resuelto que se enseña —no la
      // descripción del esquema,
      // que menciona `opcionesComunes` en las dos formas— trae esa casilla
      // exactamente cuando la tarea reparte de una lista común. Se busca la
      // forma JSON `"opcionesComunes":`, con comillas y dos puntos, y no la
      // palabra a secas entre comillas invertidas: esa la usan también
      // «Los números de esta tarea» y la lista de campos, para las tareas
      // de `opcion` sin lista común.
      afirmar(
        encargo.texto.includes('"opcionesComunes":') === (tarea.motor === "opcion" && tarea.listaComun),
        `${cual}: el ejemplo resuelto trae opcionesComunes exactamente cuando la tarea usa lista común`,
      );
    }
  }
  afirmar(tareasVistas === 52, `el mapa tiene 52 tareas y se han recorrido las ${tareasVistas}`);

  // El aviso de que no hay audio es un párrafo estático, idéntico en las 52
  // tareas y en los 4 encargos genéricos: comprobarlo una vez sobre un
  // encargo cualquiera prueba lo mismo que comprobarlo 52 veces dentro del
  // bucle.
  afirmar(
    componerEncargo("Prueba", "opcion", null).texto.includes("no lleva audio"),
    "el encargo dice que el audio no va dentro del ejercicio",
  );

  // ─── El encargo de un paso libre ─────────────────────────────────────
  const libres = encargosPara("Calentamiento", null);
  afirmar(libres.length === 4, "un paso que no es tarea del examen ofrece los cuatro motores");
  // Otra vez la frase exacta y no la palabra suelta: el encargo de
  // `relacionar` nombra el campo `sobrantes` al describir su esquema aunque
  // no haya tarea del mapa —esa parte no cambia—, así que buscar la palabra
  // a secas daría por malo un encargo que no cuenta nada.
  afirmar(
    libres.every((e) => !e.texto.includes("sobrantes.**")),
    "sin mapa no se habla de cuántas sobran: ese número solo lo sabe el mapa",
  );
  // En un paso libre no hay sección de números, así que el único número de
  // ítems del documento entero es el del ejemplo resuelto. Antes ese ejemplo
  // se presentaba como «recortado a dos ítems» —dos, pegado a un «Ni uno más
  // ni uno menos» que aquí ni sale—, y se leía como la cuenta que se pide.
  afirmar(
    libres.every((e) => e.texto.includes("no sale de este ejemplo")),
    "sin mapa, el encargo avisa de que la cuenta de ítems no se copia del ejemplo",
  );
  afirmar(
    libres.every((e) => !e.texto.includes("dos ítems")),
    "el ejemplo resuelto no se presenta con un número de ítems que se pueda confundir con la cuenta",
  );

  const deTarea = encargosPara("Tarea 1", PRUEBAS[0].tareas[0]);
  afirmar(deTarea.length === 1, "una tarea del examen ofrece un solo encargo, el suyo");

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
