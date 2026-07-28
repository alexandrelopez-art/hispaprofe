/**
 * Ejercicios autocorregibles de la clase A1 · Lección 2 — "La casa".
 *
 * Un punto por acierto. Los puntos entran verificados en cuanto el
 * estudiante envía: una opción múltiple es objetiva y no necesita el visto
 * bueno del profesor.
 *
 * Las preguntas del audio salen de la transcripción que dictó el profesor,
 * no de una escucha automática.
 *
 * Idempotente. Ejecutar con:  npx tsx scripts/sembrar-ejercicios-casa.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  opcionMultipleSchema,
  type OpcionMultiple,
} from "@/lib/ejercicios/opcion-multiple";

const TITULO_RECORRIDO = "La casa: pisos, partes y hay / no hay";
const CORREO_PROFE = "a.lopez.ele@hotmail.com";

const PARTES: OpcionMultiple = {
  ejercicio: "opcion_multiple",
  consigna: "Mira otra vez los dibujos de arriba. ¿Qué parte de la casa es cada uno?",
  preguntas: [
    {
      id: "p1",
      enunciado: "El dibujo 1, con la bañera y la ducha, es…",
      opciones: ["el cuarto de baño", "la cocina", "el salón"],
      correcta: 0,
    },
    {
      id: "p2",
      enunciado: "El dibujo 2, con la mesa y las sillas, es…",
      opciones: ["la habitación", "el comedor", "el balcón"],
      correcta: 1,
    },
    {
      id: "p3",
      enunciado: "El dibujo 3, con la barandilla y las plantas fuera, es…",
      opciones: ["el balcón", "el comedor", "la cocina"],
      correcta: 0,
    },
    {
      id: "p4",
      enunciado: "El dibujo 4, con la cama y el armario, es…",
      opciones: ["el salón", "el cuarto de baño", "la habitación"],
      correcta: 2,
    },
    {
      id: "p5",
      enunciado: "El dibujo 5, con la nevera y los fogones, es…",
      opciones: ["la cocina", "el comedor", "la habitación"],
      correcta: 0,
    },
    {
      id: "p6",
      enunciado: "El dibujo 6, con el sofá y la estantería, es…",
      opciones: ["el balcón", "el salón", "el cuarto de baño"],
      correcta: 1,
    },
  ],
};

const AUDIO: OpcionMultiple = {
  ejercicio: "opcion_multiple",
  consigna:
    "Escucha otra vez «Vacaciones en Valencia» y responde. Tres amigos buscan casa para seis personas.",
  preguntas: [
    {
      id: "a1",
      enunciado: "¿Cuántas personas son?",
      opciones: ["dos", "cuatro", "seis"],
      correcta: 2,
    },
    {
      id: "a2",
      enunciado: "En el piso del Cabañal hay…",
      opciones: ["consola y videojuegos", "jardín y piscina", "wifi y tele"],
      correcta: 0,
    },
    {
      id: "a3",
      enunciado: "El piso del Cabañal no les vale porque…",
      opciones: [
        "solo hay dos habitaciones",
        "no hay consola",
        "no hay jardín",
      ],
      correcta: 0,
    },
    {
      id: "a4",
      enunciado: "En la casa de la Malvarrosa hay…",
      opciones: [
        "dos habitaciones y piscina",
        "cuatro habitaciones, sala de juegos y jardín",
        "tres habitaciones y wifi",
      ],
      correcta: 1,
    },
    {
      id: "a5",
      enunciado: "En la casa de la Malvarrosa NO hay…",
      opciones: ["jardín", "habitaciones", "tele ni wifi"],
      correcta: 2,
    },
    {
      id: "a6",
      enunciado: "Al final eligen…",
      opciones: [
        "el piso de Campanar",
        "la casa de la Malvarrosa",
        "el piso del Cabañal",
      ],
      correcta: 0,
    },
    {
      id: "a7",
      enunciado: "En el piso de Campanar hay…",
      opciones: [
        "tres habitaciones, wifi y piscina",
        "cuatro habitaciones y jardín",
        "consola y videojuegos",
      ],
      correcta: 0,
    },
  ],
};

const HAY: OpcionMultiple = {
  ejercicio: "opcion_multiple",
  consigna: "Elige la forma correcta con hay / no hay.",
  preguntas: [
    {
      id: "h1",
      enunciado: "En mi piso ___ tres habitaciones.",
      opciones: ["hay", "son", "están"],
      correcta: 0,
    },
    {
      id: "h2",
      enunciado: "¿Cuál es correcta?",
      opciones: ["Hay un balcón.", "Hay el balcón.", "Hay balcón uno."],
      correcta: 0,
    },
    {
      id: "h3",
      enunciado: "En la casa ___ wifi. (no tiene)",
      opciones: ["no hay", "no es", "no hay el"],
      correcta: 0,
    },
    {
      id: "h4",
      enunciado: "Con plural y sin número, ¿cómo se dice?",
      opciones: ["Hay balcones.", "Hay unos balcón.", "Hay los balcones."],
      correcta: 0,
    },
    {
      id: "h5",
      enunciado: "En España, a un apartamento se le llama…",
      opciones: ["piso", "casa", "habitación"],
      correcta: 0,
    },
  ],
};

async function sembrar(
  clave: string,
  titulo: string,
  datos: OpcionMultiple,
  ordenPaso: number,
  recorridoId: string,
  profesorId: string,
) {
  opcionMultipleSchema.parse(datos); // que no entre nada con mala forma

  const paso = await prisma.paso.findFirst({
    where: { recorridoId, orden: ordenPaso },
    select: { id: true, titulo: true },
  });
  if (!paso) throw new Error(`No encuentro el paso ${ordenPaso}`);

  // Fuera la versión anterior de este mismo ejercicio, si la hubiera.
  const previos = await prisma.ejercicio.findMany({
    where: { titulo },
    select: { id: true },
  });
  for (const p of previos) {
    await prisma.pasoEjercicio.deleteMany({ where: { ejercicioId: p.id } });
    await prisma.ejercicio.delete({ where: { id: p.id } });
  }

  const ejercicio = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo,
      nivel: "A1",
      etiquetas: ["la casa", clave],
      datos,
      publicado: true,
      autorId: profesorId,
    },
    select: { id: true },
  });

  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
  });

  console.log(
    `  paso ${ordenPaso} "${paso.titulo}" → ${datos.preguntas.length} preguntas (${datos.preguntas.length} puntos)`,
  );
}

async function main() {
  const profe = await prisma.user.findUnique({ where: { email: CORREO_PROFE } });
  if (!profe) throw new Error(`No encuentro al profesor ${CORREO_PROFE}`);

  const recorrido = await prisma.recorrido.findFirst({
    where: { titulo: TITULO_RECORRIDO },
    select: { id: true },
  });
  if (!recorrido) {
    throw new Error(
      `No encuentro "${TITULO_RECORRIDO}". Ejecuta antes scripts/sembrar-clase-casa.ts`,
    );
  }

  console.log("Colgando ejercicios autocorregibles:");
  await sembrar("partes", "Las partes de la casa — opción múltiple", PARTES, 2, recorrido.id, profe.id);
  await sembrar("audio", "Vacaciones en Valencia — comprensión oral", AUDIO, 3, recorrido.id, profe.id);
  await sembrar("hay", "hay / no hay — opción múltiple", HAY, 4, recorrido.id, profe.id);

  const total =
    PARTES.preguntas.length + AUDIO.preguntas.length + HAY.preguntas.length;
  console.log(`\nGaspard puede ganar ${total} puntos por su cuenta en esta clase.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
