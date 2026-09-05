/**
 * Verifica el contador de escuchas y, desde la Tarea 2, el mapa del examen.
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-dele.ts
 */
import "dotenv/config";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import {
  avisoDeItems,
  numeroDeTarea,
  PRUEBAS,
  pruebaDe,
  pruebasDe,
  sobrantesDe,
  tareaDe,
} from "@/lib/dele";
import { apuntarEscucha, escuchasDe, escuchasDelPaso, esRacionado, maximoDeEscucha } from "@/lib/escuchas";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-dele-${process.pid}`;

// Los ids de todo lo que se crea, en variables de módulo para poder
// limpiarlo desde el `.finally()` aunque una afirmación reviente a mitad.
let recorridoId: string | null = null;
let pasoId: string | null = null;
let asignacionId: string | null = null;
let ejercicioId: string | null = null;
let recorridoLibreId: string | null = null;
let pasoLibreId: string | null = null;
// Tarea 5 (examen blanco encadenado): tres pasos más colgados del mismo
// `recorrido` racionado de más arriba, cada uno con su propio ejercicio.
let pasoEncadenadoId: string | null = null;
let ejercicioEncadenadoId: string | null = null;
let pasoSinAudioId: string | null = null;
let ejercicioSinAudioId: string | null = null;
let pasoRelacionarEncadenadoId: string | null = null;
let ejercicioRelacionarEncadenadoId: string | null = null;
// Fix round 1: el mismo ejercicio encadenado, colgado de un paso de un
// recorrido con orden 2 (no el bloque 3) — para probar que "encadenado"
// solo tiene tope dentro del examen blanco.
let recorridoOrden2Id: string | null = null;
let pasoOrden2Id: string | null = null;
const usuarioIds: string[] = [];

async function main() {
  // ─── El mapa consigo mismo ──────────────────────────────────────────
  const MOTORES = new Set(["opcion", "huecos", "relacionar", "ordenar"]);

  // Los formatos que por definición dejan opciones fuera: relacionar seis
  // enunciados con nueve textos, insertar seis fragmentos de ocho. Si uno de
  // estos no tuviera más opciones que ítems, no sobraría nada y el ejercicio
  // dejaría de ser el del examen.
  const CON_SOBRANTES = new Set(["MATCH_TEXT", "MATCH_TOPIC", "GAP_INSERT"]);

  for (const prueba of PRUEBAS) {
    const donde = `${prueba.nivel} · ${prueba.prueba}`;

    afirmar(prueba.tareas.length > 0, `${donde} tiene tareas`);
    afirmar(prueba.duracionMinutos > 0, `${donde} tiene duración`);

    const numeros = prueba.tareas.map((t) => t.numero);
    afirmar(
      new Set(numeros).size === numeros.length,
      `${donde} no repite ningún número de tarea`,
    );

    for (const tarea of prueba.tareas) {
      const cual = `${donde} · T${tarea.numero}`;
      afirmar(MOTORES.has(tarea.motor), `${cual} apunta a un tipo del motor que existe`);
      afirmar(tarea.items > 0, `${cual} tiene ítems`);
      afirmar(tarea.opciones > 0, `${cual} tiene opciones`);
      afirmar(tarea.pide.trim().length > 0, `${cual} dice qué se pide`);
      // `relacionar` es uno a uno: no puede tener menos opciones que ítems,
      // porque cada ítem necesita la suya y no se pueden repetir.
      if (tarea.motor === "relacionar") {
        afirmar(!tarea.listaComun, `${cual} con relacionar no usa lista común`);
        afirmar(
          tarea.opciones >= tarea.items,
          `${cual} con relacionar tiene al menos una opción por ítem`,
        );
      }
      // La afirmación con dientes sobre los sobrantes. Preguntarle a
      // `sobrantesDe` por una tarea que no es `relacionar` no comprueba
      // nada: devuelve cero sin mirar, por definición. Lo que sí puede estar
      // mal —y son 52 filas escritas a mano, que ya han tenido erratas— es
      // que un formato de los que dejan opciones fuera se quede sin ellas
      // porque alguien corrigió `items` y no `opciones`.
      if (CON_SOBRANTES.has(tarea.formato)) {
        afirmar(
          tarea.opciones > tarea.items,
          `${cual} · ${tarea.formato} tiene más opciones que ítems (${tarea.opciones} para ${tarea.items})`,
        );
        afirmar(sobrantesDe(tarea) > 0, `${cual} · ${tarea.formato} deja sobrantes de verdad`);
      }
    }
  }

  // Las pruebas verificadas tienen el número de tareas que dice el examen.
  // El total de ítems se afirma aparte porque es el único número de aquí que
  // no hay que interpretar: los enunciados oficiales lo dicen a la cara
  // —«Debes responder a 25 preguntas»—, así que se copia y ya está.
  //
  // Lo que caza y lo que no, dicho claro para que nadie se confíe:
  //
  // NO caza que los ítems estén mal repartidos entre tareas. Este mapa llegó
  // a decir que la Tarea 1 de la auditiva del escolar tenía seis ítems y la
  // Tarea 4 siete, cuando son siete y seis, y sumaba 25 igualmente. Eso solo
  // lo caza leer el examen; por eso el mapa dice contra qué se contrastó.
  //
  // SÍ caza el error de después: corregir una tarea y olvidar la otra, que es
  // lo que ronda cada vez que alguien toca un `items`.
  //
  // Los dos totales del escolar están leídos de los exámenes oficiales. Los
  // de B1 y B2 salen del encargo del profesor: si alguno falla, el que hay
  // que mirar es el total, no las tareas.
  const ESPERADAS: [Nivel, Destreza, number, number][] = [
    ["B1", "CE", 5, 30], ["B1", "CO", 5, 30],
    ["B2", "CE", 4, 36], ["B2", "CO", 5, 30],
    ["A2_B1_ESCOLAR", "CE", 4, 25], ["A2_B1_ESCOLAR", "CO", 4, 25],
  ];
  for (const [nivel, destreza, cuantas, items] of ESPERADAS) {
    const p = pruebaDe(nivel, destreza);
    afirmar(p !== null, `${nivel} · ${destreza} está en el mapa`);
    afirmar(p!.tareas.length === cuantas, `${nivel} · ${destreza} tiene ${cuantas} tareas`);
    afirmar(p!.tareas.every((t) => t.verificado), `${nivel} · ${destreza} está toda verificada`);
    const suma = p!.tareas.reduce((t, tarea) => t + tarea.items, 0);
    afirmar(suma === items, `${nivel} · ${destreza} suma ${items} ítems (son ${suma})`);
  }

  // Las cuatro preguntas al mapa.
  afirmar(pruebasDe("B1").length === 2, "B1 tiene las dos pruebas de comprensión");
  afirmar(pruebaDe("B1", "EE") === null, "las de expresión no están en el mapa");
  afirmar(tareaDe("B1", "CE", 1)?.formato === "MATCH_TEXT", "B1 · CE · T1 es MATCH_TEXT");
  afirmar(tareaDe("B1", "CE", 99) === null, "una tarea que no existe devuelve null");
  afirmar(sobrantesDe(tareaDe("B1", "CE", 1)!) === 3, "B1 · CE · T1 tiene tres sobrantes");
  afirmar(sobrantesDe(tareaDe("B1", "CE", 2)!) === 0, "B1 · CE · T2 no tiene sobrantes");

  // Sesión C, Task 3 (fix round 1): los trozos de la auditiva escolar los
  // dicta el mapa (`TareaDele.trozos`), no una heurística sobre `pide`.
  const TROZOS_CO_ESCOLAR: [number, number | null][] = [[1, 7], [2, 6], [3, null], [4, 3]];
  for (const [numero, trozos] of TROZOS_CO_ESCOLAR) {
    afirmar(
      tareaDe("A2_B1_ESCOLAR", "CO", numero)?.trozos === trozos,
      `A2_B1_ESCOLAR · CO · T${numero} tiene trozos: ${trozos}`,
    );
  }

  // ─── La regla que comparten dos pantallas ───────────────────────────
  // `numeroDeTarea` la usan la ficha del paso (qué tarea enseñar) y el panel
  // de tareas sugeridas (qué tareas están puestas). Cuando eran dos copias,
  // una iba por el título y la otra por el `orden`, y se contradecían.
  afirmar(numeroDeTarea({ titulo: "Tarea 3", orden: 1 }) === 3, "el título manda sobre el orden");
  afirmar(numeroDeTarea({ titulo: "Tarea 10", orden: 1 }) === 10, "un número de dos cifras también cuenta");
  afirmar(numeroDeTarea({ titulo: "Calentamiento", orden: 2 }) === 2, "sin número en el título, manda el orden");
  afirmar(
    numeroDeTarea({ titulo: "Tarea 2: los conectores", orden: 4 }) === 4,
    "un título que empieza por «Tarea 2» pero sigue no reclama la tarea 2",
  );
  afirmar(
    numeroDeTarea({ titulo: "Actividad 1", orden: 2 }) === 2,
    "un paso de la plantilla de nueve va por su orden y no por su número",
  );

  // ─── El aviso del número de ítems ───────────────────────────────────
  // Avisa y no rechaza: aquí solo se comprueba que cuenta lo que toca en
  // cada motor y que calla cuando el número es el del examen.
  const lista = (n: number) => Array.from({ length: n }, () => ({}));
  const t1 = tareaDe("B1", "CE", 1)!; // relacionar, seis ítems
  const t2 = tareaDe("B1", "CE", 2)!; // opcion, seis ítems
  afirmar(avisoDeItems(t1, { parejas: lista(6) }) === null, "seis parejas en una tarea de seis no avisan");
  afirmar(avisoDeItems(t1, { parejas: lista(4) }) !== null, "cuatro parejas en una tarea de seis avisan");
  afirmar(
    avisoDeItems(t1, { parejas: lista(6), sobrantes: ["a", "b", "c"] }) === null,
    "los sobrantes no son ítems: no cuentan para el aviso",
  );
  afirmar(avisoDeItems(t2, { preguntas: lista(6) }) === null, "seis preguntas en una tarea de seis no avisan");
  afirmar(avisoDeItems(t2, { preguntas: lista(7) }) !== null, "siete preguntas en una tarea de seis avisan");
  afirmar(
    avisoDeItems(t1, { preguntas: lista(4) }) === null,
    "unos datos que no encajan con el motor de la tarea no avisan de nada",
  );
  afirmar(avisoDeItems(t2, {}) === null, "sin nada que contar no se avisa");

  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(estudiante.id);
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  usuarioIds.push(profesor.id);

  // Racionado a propósito: PREPARACION_DELE con destreza puesta, para poder
  // probar también el tope del bloque AUDIO (siempre 1) en el mismo paso
  // que ya usan las afirmaciones de `apuntarEscucha` de más abajo — la
  // clave del bloque y las claves "a"/"b"/"c" no chocan. `orden: 3` (el
  // bloque «Examen blanco» de `lib/preparacion.ts`) y no un valor
  // cualquiera: hace falta desde el fix round 1, porque la clave
  // "encadenado" solo tiene tope dentro de ese bloque.
  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Recorrido ${marca}`, nivel: "B1", orden: 3, tipo: "PREPARACION_DELE", destreza: "CO" },
  });
  recorridoId = recorrido.id;

  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Paso", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  pasoId = paso.id;

  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;

  // 1. Sin haber oído nada, cero.
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 0, "sin oír nada, cero escuchas");

  // 2. Las dos escuchas del examen.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === 1, "la primera deja una");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === 0, "la segunda deja cero");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === null, "la tercera se niega");

  // 3. La que de verdad importa: preguntar otra vez después de agotarlas
  //    sigue diciendo que no. Si esto falla, recargar la página devuelve las
  //    escuchas y el contador no sirve para nada.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === null, "sigue negándose al insistir");
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 2, "el contador se quedó en dos");

  // 4. Cada audio cuenta por su cuenta: la tarea 1 de auditiva son seis.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "b", 2)) === 1, "otro audio empieza de cero");
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 2, "y no toca el contador del primero");

  // 5. El máximo es del ejercicio, no una constante: con cuatro, la tercera
  //    sí suena.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 3, "con máximo cuatro, la primera deja tres");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 2, "la segunda deja dos");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 1, "la tercera deja una");

  // 6. `escuchasDelPaso`: lo que el reproductor lee al montar, para no
  //    mentir tras recargar la página (ver comentario E del informe).
  const mapa = await escuchasDelPaso(asignacion.id, paso.id);
  afirmar(
    mapa["a"] === 2 && mapa["b"] === 1 && mapa["c"] === 3,
    "escuchasDelPaso trae las veces exactas de cada clave ya tocada",
  );
  afirmar(
    !("nunca-tocada" in mapa),
    "una clave nunca escuchada no aparece en el mapa — quien lee hace `?? 0`",
  );

  // 7. `esRacionado`: la misma regla que usa la página del paso para elegir
  //    entre el `Reproductor` y un `<audio>` normal.
  afirmar(esRacionado({ tipo: "PREPARACION_DELE", destreza: "CO" }), "preparación DELE con destreza está racionada");
  afirmar(!esRacionado({ tipo: "PREPARACION_DELE", destreza: null }), "preparación DELE sin destreza no está racionada");
  afirmar(!esRacionado({ tipo: "CLASES_PARTICULARES", destreza: "CO" }), "clases particulares no se racionan aunque tengan destreza");

  // 8. `maximoDeEscucha`: el tope se resuelve en el servidor mirando a qué
  //    corresponde `clave` — no hay ningún parámetro `maximo` que aceptar
  //    de quien llama, así que no hay nada que "mandar desde fuera" para
  //    conseguir escuchas ilimitadas: `pedirEscucha` no expone ese hueco.
  const bloqueAudio = await prisma.bloque.create({
    data: { pasoId: paso.id, orden: 1, tipo: "AUDIO", url: "https://ejemplo.test/audio.mp3" },
  });

  const ejercicio = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Ejercicio ${marca}`,
      nivel: "B1",
      datos: {
        ejercicio: "opcion",
        consigna: "Escucha y responde.",
        multiple: false,
        escuchas: 4,
        preguntas: [
          {
            id: "p1",
            enunciado: "¿Qué oyes?",
            opciones: ["Uno", "Dos"],
            correctas: [0],
            audio: "https://ejemplo.test/p1.mp3",
          },
        ],
      },
    },
  });
  ejercicioId = ejercicio.id;
  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
  });

  afirmar(
    (await maximoDeEscucha(paso.id, bloqueAudio.id)) === 1,
    "el bloque AUDIO de una prueba racionada tiene tope 1, literal",
  );
  afirmar(
    (await maximoDeEscucha(paso.id, "p1")) === 4,
    "la pregunta con audio del ejercicio tiene el tope que declara su JSON (4, no un valor inventado)",
  );
  afirmar(
    (await maximoDeEscucha(paso.id, "clave-inventada")) === null,
    "una clave que no corresponde a nada de este paso no tiene tope",
  );

  // ─── Tarea 5: el examen blanco encadena los trozos, la clave "encadenado" ──
  // "encadenado" no es el id de ninguna pregunta ni pareja — es la clave fija
  // con la que `ReproductorEncadenado` cuenta la tarea entera como una sola
  // escucha. Cada caso vive en su propio paso, colgado del mismo `recorrido`
  // racionado de más arriba, para no interferir con las claves "p1" ya
  // probadas.
  const pasoEncadenado = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Paso encadenado", tipo: "ACTIVIDAD", ciclo: 1, orden: 2 },
  });
  pasoEncadenadoId = pasoEncadenado.id;
  const ejercicioEncadenado = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Ejercicio encadenado ${marca}`,
      nivel: "B1",
      datos: {
        ejercicio: "opcion",
        consigna: "Escucha la tarea entera y responde.",
        multiple: false,
        escuchas: 2,
        preguntas: [
          {
            id: "e1",
            enunciado: "¿Qué oyes primero?",
            opciones: ["Uno", "Dos"],
            correctas: [0],
            audio: "https://ejemplo.test/e1.mp3",
          },
          {
            // Sin audio propio: comparte el trozo de "e1" (como las dos
            // preguntas de la tarea 4 que comparten noticia), y de todas
            // formas basta con que UNA pregunta lleve audio para que
            // "encadenado" tenga tope.
            id: "e2",
            enunciado: "¿Y después?",
            opciones: ["Uno", "Dos"],
            correctas: [1],
          },
        ],
      },
    },
  });
  ejercicioEncadenadoId = ejercicioEncadenado.id;
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoEncadenado.id, ejercicioId: ejercicioEncadenado.id, orden: 1 },
  });

  afirmar(
    (await maximoDeEscucha(pasoEncadenado.id, "encadenado")) === 1,
    "con una pregunta de opcion con audio, la clave encadenado da UNA tanda (I-1: la tanda ya encadena las dos audiciones)",
  );
  afirmar(
    (await maximoDeEscucha(pasoEncadenado.id, "e1")) === 2,
    "la propia pregunta se sigue pudiendo pedir por su id: encadenado no la tapa",
  );

  const pasoSinAudio = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Paso sin audio", tipo: "ACTIVIDAD", ciclo: 1, orden: 3 },
  });
  pasoSinAudioId = pasoSinAudio.id;
  const ejercicioSinAudio = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Ejercicio sin audio ${marca}`,
      nivel: "B1",
      datos: {
        ejercicio: "opcion",
        consigna: "Responde sin ningún audio.",
        multiple: false,
        preguntas: [{ id: "s1", enunciado: "¿Cuánto es 2+2?", opciones: ["3", "4"], correctas: [1] }],
      },
    },
  });
  ejercicioSinAudioId = ejercicioSinAudio.id;
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoSinAudio.id, ejercicioId: ejercicioSinAudio.id, orden: 1 },
  });

  afirmar(
    (await maximoDeEscucha(pasoSinAudio.id, "encadenado")) === null,
    "sin ningún audio en el ejercicio, la clave encadenado no tiene tope",
  );

  const pasoRelacionarEncadenado = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Paso relacionar encadenado", tipo: "ACTIVIDAD", ciclo: 1, orden: 4 },
  });
  pasoRelacionarEncadenadoId = pasoRelacionarEncadenado.id;
  const ejercicioRelacionarEncadenado = await prisma.ejercicio.create({
    data: {
      tipo: "RELACIONAR",
      titulo: `Ejercicio relacionar encadenado ${marca}`,
      nivel: "B1",
      datos: {
        ejercicio: "relacionar",
        consigna: "Escucha y relaciona cada hablante con su tema.",
        escuchas: 3,
        parejas: [
          { id: "r1", izquierda: "Hablante 1", derecha: "Tema A", audio: "https://ejemplo.test/r1.mp3" },
          { id: "r2", izquierda: "Hablante 2", derecha: "Tema B" },
        ],
      },
    },
  });
  ejercicioRelacionarEncadenadoId = ejercicioRelacionarEncadenado.id;
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoRelacionarEncadenado.id, ejercicioId: ejercicioRelacionarEncadenado.id, orden: 1 },
  });

  afirmar(
    (await maximoDeEscucha(pasoRelacionarEncadenado.id, "encadenado")) === 1,
    "con una pareja de relacionar con audio, la clave encadenado también da UNA tanda (I-1)",
  );

  // Fix round 1 (finding #1 de la revisión): "encadenado" solo tiene tope
  // dentro del examen blanco (bloque 3). El mismo ejercicio encadenado
  // (con audio) enganchado a un paso de un recorrido con orden 2 no debe
  // dar ningún tope por esa clave, aunque el ejercicio sea idéntico — y su
  // propia pregunta ("e1") sigue teniendo el tope de siempre, sin que la
  // acotación por bloque le afecte.
  const recorridoOrden2 = await prisma.recorrido.create({
    data: { titulo: `Recorrido orden 2 ${marca}`, nivel: "B1", orden: 2, tipo: "PREPARACION_DELE", destreza: "CO" },
  });
  recorridoOrden2Id = recorridoOrden2.id;
  const pasoOrden2 = await prisma.paso.create({
    data: { recorridoId: recorridoOrden2.id, titulo: "Paso orden 2", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  pasoOrden2Id = pasoOrden2.id;
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoOrden2.id, ejercicioId: ejercicioEncadenado.id, orden: 1 },
  });

  afirmar(
    (await maximoDeEscucha(pasoOrden2.id, "encadenado")) === null,
    "fuera del bloque 3 (orden 2), la clave encadenado no tiene tope aunque el ejercicio tenga audio",
  );
  afirmar(
    (await maximoDeEscucha(pasoOrden2.id, "e1")) === 2,
    "la pregunta sigue teniendo su propio tope por id fuera del bloque 3: solo se acota \"encadenado\"",
  );

  // Defensa en profundidad: un audio de una clase particular (no racionada)
  // no tiene tope contable aunque alguien intente pedirlo con el id de un
  // bloque real — la página nunca llega a montar el `Reproductor` ahí, pero
  // `maximoDeEscucha` tampoco lo autoriza si se le preguntara igualmente.
  const recorridoLibre = await prisma.recorrido.create({
    data: { titulo: `Recorrido libre ${marca}`, nivel: "B1", orden: 1 },
  });
  recorridoLibreId = recorridoLibre.id;
  const pasoLibre = await prisma.paso.create({
    data: { recorridoId: recorridoLibre.id, titulo: "Paso libre", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  pasoLibreId = pasoLibre.id;
  const bloqueLibre = await prisma.bloque.create({
    data: { pasoId: pasoLibre.id, orden: 1, tipo: "AUDIO", url: "https://ejemplo.test/libre.mp3" },
  });
  afirmar(
    (await maximoDeEscucha(pasoLibre.id, bloqueLibre.id)) === null,
    "un audio de una clase particular no se raciona, ni aunque se pregunte por su bloque",
  );

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` aquí mataría el proceso antes del `finally`, y la
    // limpieza no correría. En TDD el paso que falla lo hace a propósito,
    // así que eso dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    // Cada borrado se intenta aunque el anterior reviente: si uno falla por
    // un blip transitorio, los demás no se quedan sin ni siquiera
    // intentarse, y la basura que sí se puede quitar se quita.
    async function intentar(que: string, fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (e) {
        fallos++;
        console.error(`FALLO AL LIMPIAR (${que}):`, e instanceof Error ? e.message : e);
      }
    }

    // El orden importa: los vínculos antes que sus extremos, porque las
    // claves foráneas son RESTRICT. Capturado en `const` dentro de cada
    // bloque para que TypeScript lo vea no-nulo dentro del cierre.
    if (asignacionId) {
      const id = asignacionId;
      await intentar("escuchas", () => prisma.escucha.deleteMany({ where: { asignacionId: id } }));
      await intentar("pasos completados", () => prisma.pasoCompletado.deleteMany({ where: { asignacionId: id } }));
      await intentar("asignación", () => prisma.asignacion.delete({ where: { id } }));
    }
    if (pasoId) {
      const id = pasoId;
      // Bloque no tiene onDelete: Cascade hacia Paso (a diferencia de
      // PasoEjercicio, que sí lo tiene): sin borrarlo antes, el bloque AUDIO
      // de la afirmación 8 deja el paso sin poder borrarse.
      await intentar("bloques", () => prisma.bloque.deleteMany({ where: { pasoId: id } }));
      await intentar("paso", () => prisma.paso.delete({ where: { id } }));
    }
    // Los tres pasos de la Tarea 5 (examen blanco encadenado) cuelgan del
    // mismo `recorrido` que el paso principal: tienen que irse antes que él,
    // igual que ese paso — la relación Paso→Recorrido no tiene cascada.
    if (pasoEncadenadoId) {
      const id = pasoEncadenadoId;
      await intentar("paso encadenado", () => prisma.paso.delete({ where: { id } }));
    }
    if (pasoSinAudioId) {
      const id = pasoSinAudioId;
      await intentar("paso sin audio", () => prisma.paso.delete({ where: { id } }));
    }
    if (pasoRelacionarEncadenadoId) {
      const id = pasoRelacionarEncadenadoId;
      await intentar("paso relacionar encadenado", () => prisma.paso.delete({ where: { id } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    // El paso y el recorrido de orden 2 (fix round 1): el paso primero,
    // mismo motivo que arriba; el ejercicio que enganchan es el mismo
    // `ejercicioEncadenadoId`, borrado más abajo una sola vez.
    if (pasoOrden2Id) {
      const id = pasoOrden2Id;
      await intentar("paso orden 2", () => prisma.paso.delete({ where: { id } }));
    }
    if (recorridoOrden2Id) {
      const id = recorridoOrden2Id;
      await intentar("recorrido orden 2", () => prisma.recorrido.delete({ where: { id } }));
    }
    if (ejercicioId) {
      // Después del paso: PasoEjercicio cae en cascada al borrar el paso,
      // y solo entonces el ejercicio se queda sin nada que lo enganche.
      const id = ejercicioId;
      await intentar("ejercicio", () => prisma.ejercicio.delete({ where: { id } }));
    }
    if (ejercicioEncadenadoId) {
      const id = ejercicioEncadenadoId;
      await intentar("ejercicio encadenado", () => prisma.ejercicio.delete({ where: { id } }));
    }
    if (ejercicioSinAudioId) {
      const id = ejercicioSinAudioId;
      await intentar("ejercicio sin audio", () => prisma.ejercicio.delete({ where: { id } }));
    }
    if (ejercicioRelacionarEncadenadoId) {
      const id = ejercicioRelacionarEncadenadoId;
      await intentar("ejercicio relacionar encadenado", () => prisma.ejercicio.delete({ where: { id } }));
    }
    if (pasoLibreId) {
      const id = pasoLibreId;
      await intentar("bloques (recorrido libre)", () => prisma.bloque.deleteMany({ where: { pasoId: id } }));
      await intentar("paso (recorrido libre)", () => prisma.paso.delete({ where: { id } }));
    }
    if (recorridoLibreId) {
      const id = recorridoLibreId;
      await intentar("recorrido libre", () => prisma.recorrido.delete({ where: { id } }));
    }
    if (usuarioIds.length) {
      await intentar("usuarios", () => prisma.user.deleteMany({ where: { id: { in: usuarioIds } } }));
    }

    // Cerrar la conexión también va por `intentar`: suelto era el único
    // `await` del `finally` sin capturar, y un fallo suyo salía como un
    // rechazo no capturado —ruido sin explicación— en vez de como una línea
    // que dice qué pasó.
    await intentar("desconectar", () => prisma.$disconnect());

    // Un rechazo sin capturar aquí sería silencioso: nadie lo ve y la
    // basura se descubre a mano, como pasó la vez que faltaba esto.
    if (fallos > 0) {
      console.error(`\nLa limpieza falló en ${fallos} paso(s): puede haber quedado basura de prueba en la base.`);
      process.exitCode = 1;
    }
  });
