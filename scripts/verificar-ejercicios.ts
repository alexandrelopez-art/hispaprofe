/**
 * Verifica los cinco tipos de ejercicio: que la solución no viaje al
 * navegador y que la cuenta de puntos sea la que dice el diseño.
 * Ejecutar con:  npx tsx scripts/verificar-ejercicios.ts
 */
import "dotenv/config";
import { corregirOpcion, opcionSchema, versionPublicaOpcion, type Opcion } from "@/lib/ejercicios/opcion";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
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

async function main() {
  // 1. La versión pública no lleva soluciones.
  const publica = JSON.stringify(versionPublicaOpcion(UNICA));
  afirmar(!publica.includes("correctas"), "opción: la versión pública no lleva las soluciones");

  // 2. La cuenta en opción única.
  afirmar(corregirOpcion(UNICA, { a: "0", b: "1" }).aciertos === 2, "opción única: todo acertado da 2");
  afirmar(corregirOpcion(UNICA, { a: "1", b: "1" }).aciertos === 1, "opción única: un acierto da 1");
  afirmar(corregirOpcion(UNICA, {}).aciertos === 0, "opción única: sin responder da 0");

  // 3. En múltiple, marcarlo todo no da el máximo.
  afirmar(corregirOpcion(MULTIPLE, { m: ["0", "1"] }).aciertos === 2, "múltiple: las dos buenas dan 2");
  afirmar(corregirOpcion(MULTIPLE, { m: ["0", "1", "2"] }).aciertos === 1, "múltiple: una mala resta un punto");
  afirmar(corregirOpcion(MULTIPLE, { m: ["2"] }).aciertos === 0, "múltiple: solo la mala da 0, no negativo");
  afirmar(corregirOpcion(MULTIPLE, { m: ["0"] }).aciertos === 1, "múltiple: media respuesta da 1");

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
