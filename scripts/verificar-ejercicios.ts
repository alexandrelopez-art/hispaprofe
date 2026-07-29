/**
 * Verifica los cinco tipos de ejercicio: que la solución no viaje al
 * navegador y que la cuenta de puntos sea la que dice el diseño.
 * Ejecutar con:  npx tsx scripts/verificar-ejercicios.ts
 */
import "dotenv/config";
import { corregirOpcion, opcionSchema, versionPublicaOpcion, type Opcion } from "@/lib/ejercicios/opcion";
import { corregirHuecos, huecosSchema, trozos, versionPublicaHuecos, type Huecos } from "@/lib/ejercicios/huecos";
import { corregirRelacionar, relacionarSchema, versionPublicaRelacionar, type Relacionar } from "@/lib/ejercicios/relacionar";
import { corregirOrdenar, ordenarSchema, versionPublicaOrdenar, type Ordenar } from "@/lib/ejercicios/ordenar";
import { analizar, corregir, versionPublica } from "@/lib/ejercicios/registro";
import { progresoOpcion } from "@/components/ejercicios/opcion";
import { progresoRelacionar } from "@/components/ejercicios/relacionar";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/** Mismo criterio que usa el repartidor: completo cuando no falta nada. */
function completo(p: { total: number; contestadas: number }): boolean {
  return p.contestadas >= p.total;
}

const UNICA: Opcion = {
  ejercicio: "opcion",
  consigna: "Elige",
  multiple: false,
  // `Opcion` es el tipo de salida de zod: con `.default()`, la propiedad
  // es obligatoria ahi aunque el propio parse la rellene. Como este
  // objeto no pasa por `.parse()`, hay que escribir el valor por defecto.
  presentacion: "botones",
  preguntas: [
    { id: "a", enunciado: "1", opciones: ["si", "no"], correctas: [0] },
    { id: "b", enunciado: "2", opciones: ["si", "no"], correctas: [1] },
  ],
};

const MULTIPLE: Opcion = {
  ejercicio: "opcion",
  consigna: "Marca todas",
  multiple: true,
  presentacion: "botones",
  preguntas: [
    { id: "m", enunciado: "¿Cuáles son habitaciones?", opciones: ["la cocina", "el balcón", "el perro"], correctas: [0, 1] },
  ],
};

// Lista compartida: las mismas opciones para todas las preguntas, y la
// misma opción puede valer en varias. Este es el formato de la captura del
// profesor: frases y un desplegable de nombres.
const COMPARTIDA: Opcion = opcionSchema.parse({
  ejercicio: "opcion",
  consigna: "¿De quién habla cada frase?",
  multiple: false,
  opcionesComunes: ["Fede", "Luisa", "Carmen"],
  presentacion: "desplegable",
  preguntas: [
    { id: "c1", enunciado: "Tiene el pelo rizado.", correctas: [2] },
    { id: "c2", enunciado: "Lleva gafas.", correctas: [2] },
    { id: "c3", enunciado: "Lleva barba.", correctas: [0] },
  ],
});

const HUECOS: Huecos = {
  ejercicio: "huecos",
  consigna: "Completa",
  texto: "En mi piso {{h1}} tres habitaciones y no {{h2}} {{h3}}.",
  huecos: [
    { id: "h1", acepta: ["hay"] },
    { id: "h2", acepta: ["hay"] },
    { id: "h3", acepta: ["balcón"] },
  ],
};

const RELACIONAR: Relacionar = {
  ejercicio: "relacionar",
  consigna: "Une cada habitación con lo que hay dentro",
  parejas: [
    { id: "p1", izquierda: "la cocina", derecha: "la nevera" },
    { id: "p2", izquierda: "el salón", derecha: "el sofá" },
    { id: "p3", izquierda: "la habitación", derecha: "la cama" },
  ],
};

const ORDENAR: Ordenar = {
  ejercicio: "ordenar",
  consigna: "Ordena el diálogo",
  piezas: [
    { id: "o1", texto: "Hola, buenos días." },
    { id: "o2", texto: "Busco un piso." },
    { id: "o3", texto: "¿Cuántas habitaciones?" },
    { id: "o4", texto: "Tres, por favor." },
  ],
};

async function main() {
  // 1. La versión pública no lleva soluciones.
  const publica = JSON.stringify(versionPublicaOpcion(UNICA));
  afirmar(!publica.includes("correctas"), "opción: la versión pública no lleva las soluciones");

  // 2. La cuenta en opción única.
  afirmar(corregirOpcion(UNICA, { a: "0", b: "1" }).aciertos === 2, "opción única: todo acertado da 2");
  afirmar(corregirOpcion(UNICA, { a: "1", b: "1" }).aciertos === 1, "opción única: un acierto da 1");
  afirmar(corregirOpcion(UNICA, {}).aciertos === 0, "opción única: sin responder da 0");
  afirmar(
    corregirOpcion(UNICA, { a: ["0", "0", "0"] }).aciertos === 1,
    "opción única: repetir la misma marca tres veces no suma tres puntos",
  );

  // 3. En múltiple, marcarlo todo no da el máximo.
  afirmar(corregirOpcion(MULTIPLE, { m: ["0", "1"] }).aciertos === 2, "múltiple: las dos buenas dan 2");
  afirmar(corregirOpcion(MULTIPLE, { m: ["0", "1", "2"] }).aciertos === 1, "múltiple: una mala resta un punto");
  afirmar(corregirOpcion(MULTIPLE, { m: ["2"] }).aciertos === 0, "múltiple: solo la mala da 0, no negativo");
  afirmar(corregirOpcion(MULTIPLE, { m: ["0"] }).aciertos === 1, "múltiple: media respuesta da 1");
  {
    const dup = corregirOpcion(MULTIPLE, { m: ["0", "0"] });
    afirmar(dup.aciertos === 1, "múltiple: marcar la misma buena dos veces no tapa la que falta");
    afirmar(dup.items[0].acertado === false, "múltiple: con una respuesta duplicada no está acertada");
  }

  // 4. La corrección dice cuál era la buena.
  const c = corregirOpcion(UNICA, { a: "1", b: "1" });
  afirmar(c.items.length === 2, "la corrección devuelve un resultado por pregunta");
  afirmar(c.items[0].acertado === false, "marca la fallada como fallada");
  afirmar(c.items[0].correcta === "si", "dice cuál era la buena");

  // 5. La lista compartida.
  const pubComp = versionPublicaOpcion(COMPARTIDA);
  afirmar(pubComp.presentacion === "desplegable", "compartida: la presentación viaja al navegador");
  afirmar(
    pubComp.preguntas.every((p) => p.opciones.length === 3),
    "compartida: cada pregunta sale con la lista común ya resuelta",
  );
  afirmar(
    corregirOpcion(COMPARTIDA, { c1: "2", c2: "2", c3: "0" }).aciertos === 3,
    "compartida: la misma opción puede acertar en varias preguntas",
  );
  afirmar(
    corregirOpcion(COMPARTIDA, { c1: "2" }).items[0].correcta === "Carmen",
    "compartida: la corrección resuelve el nombre desde la lista común",
  );
  afirmar(
    opcionSchema.safeParse({
      ejercicio: "opcion", consigna: "x", multiple: false,
      preguntas: [{ id: "z", enunciado: "sin opciones", correctas: [0] }],
    }).success === false,
    "compartida: sin opciones propias ni lista común, la forma se rechaza",
  );
  afirmar(
    opcionSchema.safeParse({
      ejercicio: "opcion", consigna: "x", multiple: false,
      opcionesComunes: ["a", "b"],
      preguntas: [{ id: "z", enunciado: "fuera de rango", correctas: [7] }],
    }).success === false,
    "compartida: una respuesta correcta fuera de rango se rechaza",
  );

  // Progreso del desplegable (fix round 2/5): el placeholder "?" del
  // <select> manda "" cuando se reselecciona, un valor presente pero en
  // blanco — distinto de no responder, que es no tener la clave siquiera.
  {
    const p0 = progresoOpcion(pubComp, {});
    afirmar(p0.contestadas === 0, "desplegable: nada seleccionado da 0 contestadas");
    afirmar(!completo(p0), "desplegable: sin seleccionar nada, el ejercicio no está completo");

    const p1 = progresoOpcion(pubComp, { c1: "2" });
    afirmar(p1.contestadas === 1, "desplegable: una de tres seleccionada da 1 contestada");
    afirmar(!completo(p1), "desplegable: con una sola respuesta, el ejercicio sigue incompleto");

    const p3 = progresoOpcion(pubComp, { c1: "2", c2: "2", c3: "0" });
    afirmar(p3.contestadas === 3, "desplegable: las tres seleccionadas dan 3 contestadas");
    afirmar(completo(p3), "desplegable: con las tres respondidas, el ejercicio está completo");

    // La regresión que motivó este fix: reseleccionar el placeholder deja
    // `c1: ""` en vez de borrar la clave. Debe contar como sin responder.
    const pVacio = progresoOpcion(pubComp, { c1: "", c2: "2", c3: "0" });
    afirmar(
      pVacio.contestadas === 2,
      "desplegable: volver al placeholder \"?\" tras elegir baja la cuenta de vuelta (regresión fix round 2)",
    );
    afirmar(!completo(pVacio), "desplegable: una respuesta vaciada deja el ejercicio incompleto otra vez");
  }

  // Huecos
  afirmar(!JSON.stringify(versionPublicaHuecos(HUECOS)).includes("acepta"), "huecos: la versión pública no lleva las soluciones");
  afirmar(corregirHuecos(HUECOS, { h1: "hay", h2: "hay", h3: "balcón" }).aciertos === 3, "huecos: los tres bien dan 3");
  afirmar(corregirHuecos(HUECOS, { h1: "Hay", h2: "  hay  ", h3: "Balcón" }).aciertos === 3, "huecos: se perdonan mayúsculas y espacios");
  afirmar(corregirHuecos(HUECOS, { h1: "hay" }).aciertos === 1, "huecos: uno solo da 1");
  afirmar(corregirHuecos(HUECOS, { h1: "es", h2: "es", h3: "es" }).aciertos === 0, "huecos: mal da 0");
  afirmar(corregirHuecos(HUECOS, { h1: "hay", h2: "hay", h3: "balcón" }).aciertos === 3, "huecos: con acento se acepta");
  afirmar(corregirHuecos(HUECOS, { h1: "hay", h2: "hay", h3: "balcon" }).aciertos === 2, "huecos: sin acento es fallo, los acentos cuentan");
  const partes = trozos(HUECOS.texto);
  afirmar(partes.filter((p) => p.tipo === "hueco").length === 3, "huecos: el texto se parte en tres huecos");
  afirmar(partes[0].valor.startsWith("En mi piso"), "huecos: conserva el texto de alrededor");
  afirmar(huecosSchema.safeParse(HUECOS).success, "huecos: el ejemplo tiene forma válida");

  // Relacionar
  const SEMILLA = "semilla-fija";
  const pubRel = versionPublicaRelacionar(RELACIONAR, SEMILLA);

  // Lo más importante: los ids de pareja NO pueden llegar al navegador.
  const jsonRel = JSON.stringify(pubRel);
  for (const id of ["p1", "p2", "p3"]) {
    afirmar(!jsonRel.includes(`"${id}"` ) || !jsonRel.includes(`{"clave":"${id}"`), `relacionar: la clave opaca no delata la pareja ${id}`);
  }
  afirmar(pubRel.derechas.every((d) => /^d\d+$/.test(d.clave)), "relacionar: las derechas usan claves opacas d0, d1, d2");
  afirmar(pubRel.izquierdas.length === 3 && pubRel.derechas.length === 3, "relacionar: manda las dos columnas completas");
  afirmar(
    versionPublicaRelacionar(RELACIONAR, SEMILLA).derechas.map((d) => d.texto).join() ===
      pubRel.derechas.map((d) => d.texto).join(),
    "relacionar: la misma semilla baraja siempre igual",
  );

  // La clave que le toca a cada pareja, para poder simular respuestas.
  const claveDe = (izquierda: string) => {
    const pareja = RELACIONAR.parejas.find((p) => p.izquierda === izquierda)!;
    return pubRel.derechas.find((d) => d.texto === pareja.derecha)!.clave;
  };
  afirmar(
    corregirRelacionar(RELACIONAR, { p1: claveDe("la cocina"), p2: claveDe("el salón"), p3: claveDe("la habitación") }, SEMILLA).aciertos === 3,
    "relacionar: las tres bien dan 3",
  );
  afirmar(
    corregirRelacionar(RELACIONAR, { p1: claveDe("la cocina"), p2: claveDe("la habitación"), p3: claveDe("el salón") }, SEMILLA).aciertos === 1,
    "relacionar: una bien da 1",
  );
  afirmar(corregirRelacionar(RELACIONAR, {}, SEMILLA).aciertos === 0, "relacionar: sin unir nada da 0");
  afirmar(
    corregirRelacionar(RELACIONAR, { p1: claveDe("el salón") }, SEMILLA).items[0].correcta === "la nevera",
    "relacionar: dice cuál era la pareja buena",
  );
  afirmar(relacionarSchema.safeParse(RELACIONAR).success, "relacionar: el ejemplo tiene forma válida");

  // Progreso de relacionar (fix round 2/5): mismo blindaje que el
  // desplegable de opción, por si la Tarea 7 dibuja esto con un <select>
  // de placeholder vacío en vez de arrastrar y soltar.
  {
    const pr0 = progresoRelacionar(pubRel, {});
    afirmar(pr0.contestadas === 0, "relacionar: sin unir nada da 0 contestadas");
    const pr1 = progresoRelacionar(pubRel, { p1: claveDe("la cocina") });
    afirmar(pr1.contestadas === 1, "relacionar: una pareja unida da 1 contestada");
    const prVacio = progresoRelacionar(pubRel, { p1: "", p2: claveDe("el salón") });
    afirmar(
      prVacio.contestadas === 1,
      "relacionar: una clave vacía no cuenta como contestada, aunque la propiedad esté presente",
    );
  }

  // Ordenar
  afirmar(versionPublicaOrdenar(ORDENAR, "s").piezas.length === 4, "ordenar: manda las cuatro piezas");
  afirmar(corregirOrdenar(ORDENAR, { orden: ["o1", "o2", "o3", "o4"] }).aciertos === 3, "ordenar: el orden bueno da 3 (cuatro piezas, tres parejas)");
  afirmar(corregirOrdenar(ORDENAR, { orden: ["o1", "o2", "o3", "o4"] }).total === 3, "ordenar: el máximo es una pieza menos");
  afirmar(corregirOrdenar(ORDENAR, { orden: ["o2", "o3", "o4", "o1"] }).aciertos === 2, "ordenar: el desplazamiento cuesta un punto, no todos");
  afirmar(corregirOrdenar(ORDENAR, { orden: ["o4", "o3", "o2", "o1"] }).aciertos === 0, "ordenar: del revés da 0");
  afirmar(corregirOrdenar(ORDENAR, {}).aciertos === 0, "ordenar: sin ordenar da 0");
  afirmar(ordenarSchema.safeParse(ORDENAR).success, "ordenar: el ejemplo tiene forma válida");

  // El índice reparte bien
  for (const [nombre, datos] of [["opción", UNICA], ["huecos", HUECOS], ["relacionar", RELACIONAR], ["ordenar", ORDENAR]] as const) {
    const analizado = analizar(datos);
    afirmar(analizado !== null, `el índice reconoce ${nombre}`);
    if (analizado) {
      const publicaJson = JSON.stringify(versionPublica(analizado, "s"));
      for (const palabraProhibida of ["correctas", "acepta", "derecha\":"]) {
        afirmar(!publicaJson.includes(palabraProhibida), `${nombre}: la versión pública no filtra "${palabraProhibida}"`);
      }
      afirmar(corregir(analizado, {}, "s").aciertos === 0, `${nombre}: sin responder, el índice da 0`);
    }
  }
  afirmar(analizar({ ejercicio: "inventado" }) === null, "el índice rechaza un tipo desconocido");
  afirmar(analizar(null) === null, "el índice rechaza datos vacíos");

  // 5. Lo guardado en la base tiene forma válida.
  const enBase = await prisma.ejercicio.findMany({ select: { titulo: true, datos: true } });
  for (const e of enBase) {
    const d = e.datos as { ejercicio?: string };
    if (d?.ejercicio !== "opcion") continue;
    afirmar(opcionSchema.safeParse(e.datos).success, `"${e.titulo}" tiene forma válida`);
  }

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
