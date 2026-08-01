/**
 * Verifica las seis reglas de Recursos. Crea sus propios datos y los borra
 * al terminar, incluso si una afirmación revienta a mitad de camino.
 * Ejecutar con:  npx tsx scripts/verificar-recursos.ts
 */
import "dotenv/config";
import {
  duplicar,
  puedeBorrarse,
  puedeDesengancharse,
  puedeDespublicarse,
  puedeEditarse,
  puedeEngancharse,
  tipoDeEjercicio,
  tieneTrabajo,
} from "@/lib/recursos";
import { prisma } from "@/lib/prisma";
import { corregirRelacionar, relacionarSchema, versionPublicaRelacionar } from "@/lib/ejercicios/relacionar";
import { opcionSchema, versionPublicaOpcion } from "@/lib/ejercicios/opcion";
import { trozos } from "@/lib/ejercicios/tipos";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-recursos-${process.pid}`;

const DATOS_OPCION = {
  ejercicio: "opcion",
  consigna: "Elige la respuesta correcta.",
  multiple: false,
  preguntas: [
    { id: "a", enunciado: "En mi piso ___ tres habitaciones.", opciones: ["hay", "son"], correctas: [0] },
  ],
};

async function nuevoEjercicio(publicado: boolean) {
  return prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Ejercicio ${marca}`,
      nivel: "B1",
      datos: DATOS_OPCION,
      publicado,
    },
  });
}

/**
 * Los ids de todo lo que se va creando, para poder limpiarlo desde el
 * `.finally()` aunque una afirmación reviente a mitad de camino. Se rellenan
 * en cuanto cada `create` responde, no al final de `main`: así, si el fallo
 * ocurre después de crear solo la mitad de las filas, el `finally` sabe
 * cuáles borrar y cuáles no.
 */
let recorridoId: string | undefined;
let pasoId: string | undefined;
let borradorId: string | undefined;
let publicadoId: string | undefined;
let otroId: string | undefined;
let copiaId: string | undefined;
let estudianteId: string | undefined;
let profesorId: string | undefined;
let asignacionId: string | undefined;

async function main() {
  // 1. La tabla que deriva Ejercicio.tipo desde datos.ejercicio.
  afirmar(tipoDeEjercicio(DATOS_OPCION) === "OPCION_MULTIPLE", "opcion → OPCION_MULTIPLE");
  afirmar(
    tipoDeEjercicio({ ejercicio: "huecos", consigna: "c", texto: "un {{a}}", huecos: [{ id: "a", acepta: ["x"] }] }) === "HUECOS",
    "huecos → HUECOS",
  );
  afirmar(
    tipoDeEjercicio({ ejercicio: "relacionar", consigna: "c", parejas: [{ id: "1", izquierda: "a", derecha: "b" }, { id: "2", izquierda: "c", derecha: "d" }] }) === "RELACIONAR",
    "relacionar → RELACIONAR",
  );
  afirmar(
    tipoDeEjercicio({ ejercicio: "ordenar", consigna: "c", piezas: [{ id: "1", texto: "a" }, { id: "2", texto: "b" }] }) === "ORDENAR",
    "ordenar → ORDENAR",
  );
  afirmar(tipoDeEjercicio({ ejercicio: "opcion" }) === null, "un datos roto no tiene tipo");
  afirmar(tipoDeEjercicio(null) === null, "null no tiene tipo");

  // 1b. Un ejercicio vacío no es un ejercicio. `ordenar` nace con dos piezas
  // en blanco y `huecos` crea cada hueco con `acepta: [""]`: los dos pasaban
  // el esquema, se guardaban y se publicaban. El segundo es el peor de los
  // dos, porque parece terminado y vale cero puntos garantizados: el
  // estudiante no puede enviar un hueco en blanco.
  afirmar(
    tipoDeEjercicio({ ejercicio: "ordenar", consigna: "c", piezas: [{ id: "1", texto: "" }, { id: "2", texto: "b" }] }) === null,
    "una pieza sin texto invalida el ejercicio de ordenar",
  );
  afirmar(
    tipoDeEjercicio({ ejercicio: "ordenar", consigna: "c", piezas: [{ id: "1", texto: "   " }, { id: "2", texto: "b" }] }) === null,
    "una pieza con solo espacios tampoco cuenta como texto",
  );
  afirmar(
    tipoDeEjercicio({ ejercicio: "huecos", consigna: "c", texto: "un {{a}}", huecos: [{ id: "a", acepta: [""] }] }) === null,
    "un hueco cuya única forma aceptada está vacía invalida el ejercicio",
  );
  afirmar(
    tipoDeEjercicio({ ejercicio: "huecos", consigna: "c", texto: "un {{a}}", huecos: [{ id: "a", acepta: ["x", ""] }] }) === null,
    "una forma aceptada vacía entre otras buenas también lo invalida",
  );

  // El andamio: un recorrido con un paso, y dos ejercicios.
  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Recorrido ${marca}`, nivel: "B1", orden: 1 },
  });
  recorridoId = recorrido.id;
  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Paso", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  pasoId = paso.id;
  const borrador = await nuevoEjercicio(false);
  borradorId = borrador.id;
  const publicado = await nuevoEjercicio(true);
  publicadoId = publicado.id;
  const otro = await nuevoEjercicio(true);
  otroId = otro.id;

  // 2. Regla 1: un borrador no se engancha.
  afirmar(
    (await puedeEngancharse(borrador.id, paso.id)) !== null,
    "un borrador no se puede enganchar",
  );
  afirmar(
    (await puedeEngancharse(publicado.id, paso.id)) === null,
    "un publicado sí se puede enganchar a un paso vacío",
  );
  afirmar(
    (await puedeEngancharse("noexiste", paso.id)) !== null,
    "un ejercicio que no existe no se puede enganchar",
  );

  // 3. Regla 2: un paso, un ejercicio.
  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: publicado.id, orden: 1 },
  });
  afirmar(
    (await puedeEngancharse(otro.id, paso.id)) !== null,
    "un paso que ya tiene ejercicio no admite un segundo",
  );

  // 4. Regla 3: un ejercicio enganchado no se borra.
  afirmar((await puedeBorrarse(publicado.id)) !== null, "un enganchado no se borra");
  afirmar((await puedeBorrarse(borrador.id)) === null, "uno suelto sí se borra");

  // 4b. Regla nueva: un ejercicio enganchado no se despublica. `otro` sigue
  // suelto en este punto: su intento de engancharse en el paso 3 falló
  // porque el paso ya tenía a `publicado`.
  afirmar((await puedeDespublicarse(publicado.id)) !== null, "un enganchado no se despublica");
  afirmar((await puedeDespublicarse(otro.id)) === null, "uno suelto sí se despublica");

  // 4c. Las tres reglas que terminan en un `update` o un `delete` dicen que
  // no cuando la fila ya no está. Se alcanza con dos pestañas abiertas: se
  // borra en una y se pulsa en la otra. Sin esto, la acción pasaba la regla y
  // reventaba contra Prisma con un P2025 sin capturar.
  afirmar((await puedeBorrarse("noexiste")) !== null, "no se borra lo que no existe");
  afirmar((await puedeDespublicarse("noexiste")) !== null, "no se despublica lo que no existe");
  afirmar((await puedeEditarse("noexiste")) !== null, "no se edita lo que no existe");

  // 5. Sin respuestas, se desengancha y se edita con normalidad. Esta fila
  //    es la que discrimina: sin ella, una implementación que prohibiera por
  //    "está enganchado" en vez de por "tiene respuestas" pasaría igual todo
  //    lo demás.
  afirmar(!(await tieneTrabajo(paso.id)), "un paso recién hecho no tiene trabajo");
  afirmar((await puedeDesengancharse(paso.id)) === null, "sin trabajo sí se desengancha");
  afirmar((await puedeEditarse(publicado.id)) === null, "enganchado pero sin responder sí se edita");

  // 6. Reglas 4, 5 y 6: con respuestas guardadas, las tres puertas se cierran.
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  estudianteId = estudiante.id;
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  profesorId = profesor.id;
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;
  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, respuestas: { a: "0" } },
  });

  afirmar(await tieneTrabajo(paso.id), "con un PasoCompletado que las guarda, sí tiene trabajo");
  afirmar((await puedeDesengancharse(paso.id)) !== null, "con respuestas no se desengancha");
  afirmar((await puedeEngancharse(otro.id, paso.id)) !== null, "con respuestas no se cambia el ejercicio");
  afirmar((await puedeEditarse(publicado.id)) !== null, "un ejercicio respondido no se edita");

  // 7. Duplicar: la copia nace en borrador y con los mismos datos.
  copiaId = (await duplicar(publicado.id)) ?? undefined;
  afirmar(copiaId !== undefined, "duplicar devuelve el id de la copia");
  const copia = await prisma.ejercicio.findUniqueOrThrow({ where: { id: copiaId! } });
  afirmar(!copia.publicado, "la copia nace en borrador");
  afirmar(copia.id !== publicado.id, "la copia es otra fila");
  afirmar(
    JSON.stringify(copia.datos) === JSON.stringify(publicado.datos),
    "la copia lleva los mismos datos",
  );
  afirmar((await puedeEditarse(copia.id)) === null, "la copia sí se edita");
  afirmar((await duplicar("noexiste")) === null, "duplicar algo que no existe devuelve null");

  // ─── Sobrantes, texto y audio en relacionar ─────────────────────────
  const CON_SOBRANTES = {
    ejercicio: "relacionar",
    consigna: "Relaciona cada enunciado con su texto.",
    texto: "Un pasaje con dos huecos: {1} y {2}.",
    parejas: [
      { id: "r1", izquierda: "Hueco 1", derecha: "el primero", audio: "/api/archivos/uno" },
      { id: "r2", izquierda: "Hueco 2", derecha: "el segundo" },
    ],
    sobrantes: ["el tercero", "el cuarto"],
  };

  const parseado = relacionarSchema.safeParse(CON_SOBRANTES);
  afirmar(parseado.success, "un relacionar con sobrantes, texto y audio es válido");

  const datos = parseado.success ? parseado.data : null;
  afirmar(datos !== null, "el parseo devolvió datos");

  const publica = versionPublicaRelacionar(datos!, "semilla-de-prueba");
  afirmar(publica.derechas.length === 4, "las derechas públicas son las buenas más las sobrantes");
  afirmar(publica.texto === CON_SOBRANTES.texto, "el texto viaja a la versión pública");
  afirmar(
    publica.izquierdas[0].audio === "/api/archivos/uno",
    "el audio de la pareja viaja a su izquierda",
  );
  afirmar(publica.izquierdas[1].audio === undefined, "una pareja sin audio no lo inventa");
  // Las claves tienen que ser indistinguibles: si una sobrante llevara otra
  // forma, el ejercicio se resolvería mirando el código de la página.
  afirmar(
    publica.derechas.every((d) => /^d\d+$/.test(d.clave)),
    "las claves de sobrantes y buenas tienen la misma forma",
  );

  // Un sobrante nunca puntúa, aunque el estudiante lo empareje.
  const claveSobrante = publica.derechas.find((d) => d.texto === "el tercero")!.clave;
  const claveBuena = publica.derechas.find((d) => d.texto === "el primero")!.clave;
  const conSobrante = corregirRelacionar(
    datos!,
    { r1: claveSobrante, r2: claveBuena },
    "semilla-de-prueba",
  );
  afirmar(conSobrante.aciertos === 0, "emparejar un sobrante no da ningún punto");
  afirmar(conSobrante.total === 2, "el total sigue siendo el número de parejas, no de opciones");

  // Y lo bueno sigue puntuando igual que antes.
  const claveDos = publica.derechas.find((d) => d.texto === "el segundo")!.clave;
  const bien = corregirRelacionar(
    datos!,
    { r1: claveBuena, r2: claveDos },
    "semilla-de-prueba",
  );
  afirmar(bien.aciertos === 2, "las dos bien emparejadas dan dos puntos");

  // La regla nueva: un sobrante no puede repetir una respuesta buena.
  afirmar(
    !relacionarSchema.safeParse({
      ...CON_SOBRANTES,
      sobrantes: ["el primero"],
    }).success,
    "un sobrante que repite una respuesta buena se rechaza",
  );

  // Sin sobrantes sigue funcionando como siempre.
  afirmar(
    relacionarSchema.safeParse({
      ejercicio: "relacionar",
      consigna: "c",
      parejas: [
        { id: "r1", izquierda: "a", derecha: "b" },
        { id: "r2", izquierda: "c", derecha: "d" },
      ],
    }).success,
    "un relacionar sin sobrantes sigue siendo válido",
  );

  // ─── El pasaje con huecos de `opcion` ───────────────────────────────
  const CLOZE = {
    ejercicio: "opcion" as const,
    consigna: "Rellena los huecos.",
    multiple: false,
    presentacion: "desplegable" as const,
    texto: "Nunca {{19}} sabe dónde puede estar tu {{20}} libre.",
    preguntas: [
      { id: "19", enunciado: "19.", opciones: ["me", "se", "le"], correctas: [1] },
      { id: "20", enunciado: "20.", opciones: ["momento", "tiempo", "ocio"], correctas: [1] },
    ],
  };

  const cloze = opcionSchema.safeParse(CLOZE);
  afirmar(cloze.success, "un opcion con texto y marcas que cuadran es válido");

  // Una marca que no es de ninguna pregunta: la cara dibujaría un
  // desplegable que no cuenta para el progreso y el envío no se activaría.
  afirmar(
    !opcionSchema.safeParse({
      ...CLOZE,
      texto: "Nunca {{19}} sabe dónde puede estar tu {{21}} libre.",
    }).success,
    "una marca que no corresponde a ninguna pregunta se rechaza",
  );

  // Y al revés: una pregunta sin sitio en el texto no se puede contestar,
  // así que el contador tampoco llegaría nunca al total.
  afirmar(
    !opcionSchema.safeParse({
      ...CLOZE,
      texto: "Nunca {{19}} sabe dónde puede estar tu tiempo libre.",
    }).success,
    "una pregunta sin marca en el texto se rechaza",
  );

  // Lo de siempre sigue valiendo: casi ningún `opcion` lleva pasaje.
  afirmar(
    opcionSchema.safeParse({
      ejercicio: "opcion",
      consigna: "Elige.",
      multiple: false,
      preguntas: [{ id: "a", enunciado: "¿?", opciones: ["sí", "no"], correctas: [0] }],
    }).success,
    "un opcion sin texto sigue siendo válido",
  );

  // Sin el texto en la versión pública, la cara no puede pintar nada.
  const clozePublica = versionPublicaOpcion(cloze.data!);
  afirmar(clozePublica.texto === CLOZE.texto, "el pasaje viaja a la versión pública");
  afirmar(
    versionPublicaOpcion(
      opcionSchema.parse({
        ejercicio: "opcion",
        consigna: "Elige.",
        multiple: false,
        preguntas: [{ id: "a", enunciado: "¿?", opciones: ["sí", "no"], correctas: [0] }],
      }),
    ).texto === undefined,
    "sin pasaje, la versión pública no lo inventa",
  );

  // La versión pública nunca lleva las respuestas buenas, con pasaje o sin él.
  afirmar(
    !JSON.stringify(clozePublica).includes("correctas"),
    "la versión pública del cloze no lleva las correctas",
  );

  // Con pasaje, una pregunta con audio no se puede oír: la cara del cloze
  // pinta un desplegable, no un reproductor.
  afirmar(
    !opcionSchema.safeParse({
      ...CLOZE,
      preguntas: [{ ...CLOZE.preguntas[0], audio: "audio.mp3" }, CLOZE.preguntas[1]],
    }).success,
    "con pasaje, una pregunta con audio se rechaza",
  );

  // Con pasaje, `multiple: true` deja un ejercicio imposible de acertar: el
  // desplegable del cloze solo elige una opción.
  afirmar(
    !opcionSchema.safeParse({ ...CLOZE, multiple: true }).success,
    "con pasaje, multiple se rechaza",
  );

  // Lo de siempre sigue valiendo: sin pasaje, audio y multiple son válidos
  // —hay ejercicios así guardados, con lista y botones—.
  afirmar(
    opcionSchema.safeParse({
      ejercicio: "opcion",
      consigna: "Escucha y elige.",
      multiple: true,
      preguntas: [
        { id: "a", enunciado: "¿?", opciones: ["sí", "no"], correctas: [0, 1], audio: "audio.mp3" },
      ],
    }).success,
    "sin pasaje, audio y multiple siguen siendo válidos juntos",
  );

  // `trozos` es la misma para los dos tipos desde la Task 1.
  const partesCloze = trozos(CLOZE.texto);
  afirmar(
    partesCloze.filter((p) => p.tipo === "hueco").map((p) => p.valor).join(",") === "19,20",
    "trozos saca los dos huecos del pasaje en orden",
  );

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` aquí mataría el proceso antes del `finally`, y la
    // limpieza no correría. En TDD el paso RED falla a propósito, así que
    // eso deja basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    // El orden importa: los vínculos antes que sus extremos, porque las
    // claves foráneas son RESTRICT. Cada borrado va guardado tras un `if`
    // porque, si el fallo ocurrió a mitad de `main`, algunas de estas filas
    // nunca llegaron a crearse.
    if (asignacionId) {
      await prisma.pasoCompletado.deleteMany({ where: { asignacionId } });
      await prisma.asignacion.deleteMany({ where: { id: asignacionId } });
    }
    if (pasoId) {
      await prisma.pasoEjercicio.deleteMany({ where: { pasoId } });
      await prisma.paso.deleteMany({ where: { id: pasoId } });
    }
    if (recorridoId) {
      await prisma.recorrido.deleteMany({ where: { id: recorridoId } });
    }
    const ejercicioIds = [borradorId, publicadoId, otroId, copiaId].filter(
      (id): id is string => id !== undefined,
    );
    if (ejercicioIds.length > 0) {
      await prisma.ejercicio.deleteMany({ where: { id: { in: ejercicioIds } } });
    }
    const userIds = [estudianteId, profesorId].filter(
      (id): id is string => id !== undefined,
    );
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });
