/**
 * Crea una secuencia de prueba con un paso por tipo de ejercicio, para
 * poder recorrerlos a mano con una cuenta de estudiante.
 *
 * Idempotente. Ejecutar con:  npx tsx scripts/sembrar-ejercicios-demo.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { opcionSchema } from "@/lib/ejercicios/opcion";
import { huecosSchema } from "@/lib/ejercicios/huecos";
import { relacionarSchema } from "@/lib/ejercicios/relacionar";
import { ordenarSchema } from "@/lib/ejercicios/ordenar";

const TITULO = "PRUEBA — los cuatro tipos de ejercicio";
const CORREO_PROFE = "a.lopez.ele@hotmail.com";
const CORREO_ALUMNO = "gaspard@hotmail.com";

const EJERCICIOS = [
  {
    titulo: "Prueba · opción única",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "Elige la respuesta correcta.",
      multiple: false,
      preguntas: [
        { id: "a", enunciado: "En mi piso ___ tres habitaciones.", opciones: ["hay", "son", "están"], correctas: [0] },
        { id: "b", enunciado: "En España, a un apartamento se le llama…", opciones: ["piso", "casa"], correctas: [0] },
      ],
    },
  },
  {
    titulo: "Prueba · opción múltiple",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "Marca TODAS las que son partes de la casa.",
      multiple: true,
      preguntas: [
        { id: "m", enunciado: "¿Cuáles son partes de la casa?", opciones: ["la cocina", "el balcón", "el autobús", "el salón"], correctas: [0, 1, 3] },
      ],
    },
  },
  {
    titulo: "Prueba · lista compartida con desplegable",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "¿De quién habla cada frase?",
      multiple: false,
      opcionesComunes: ["Fede", "Luisa", "Carmen", "Manolo", "Nacho", "Elena"],
      presentacion: "desplegable",
      preguntas: [
        { id: "d1", enunciado: "Tiene el pelo rizado.", correctas: [2] },
        { id: "d2", enunciado: "Lleva gafas.", correctas: [2] },
        { id: "d3", enunciado: "Lleva barba.", correctas: [0] },
        { id: "d4", enunciado: "Tiene el pelo largo.", correctas: [1] },
        { id: "d5", enunciado: "Tiene el pelo blanco.", correctas: [3] },
      ],
    },
  },
  {
    titulo: "Prueba · huecos",
    tipoPaso: "ANDAMIAJE" as const,
    esquema: huecosSchema,
    datos: {
      ejercicio: "huecos",
      consigna: "Completa con hay o no hay.",
      texto: "En mi piso {{h1}} dos habitaciones. {{h2}} balcón, pero {{h3}} una terraza.",
      huecos: [
        { id: "h1", acepta: ["hay"] },
        { id: "h2", acepta: ["No hay", "no hay"] },
        { id: "h3", acepta: ["hay"] },
      ],
    },
  },
  {
    titulo: "Prueba · relacionar",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: relacionarSchema,
    datos: {
      ejercicio: "relacionar",
      consigna: "Une cada habitación con lo que hay dentro.",
      parejas: [
        { id: "r1", izquierda: "la cocina", derecha: "la nevera" },
        { id: "r2", izquierda: "el salón", derecha: "el sofá" },
        { id: "r3", izquierda: "la habitación", derecha: "la cama" },
        { id: "r4", izquierda: "el cuarto de baño", derecha: "la ducha" },
      ],
    },
  },
  {
    titulo: "Prueba · ordenar",
    tipoPaso: "MACRO_TAREA" as const,
    esquema: ordenarSchema,
    datos: {
      ejercicio: "ordenar",
      consigna: "Ordena el correo a la inmobiliaria.",
      piezas: [
        { id: "o1", texto: "Hola, buenos días." },
        { id: "o2", texto: "Busco un piso en Valencia." },
        { id: "o3", texto: "¿Hay ascensor?" },
        { id: "o4", texto: "Gracias, un saludo." },
      ],
    },
  },
];

async function main() {
  const profe = await prisma.user.findUnique({ where: { email: CORREO_PROFE } });
  if (!profe) throw new Error(`No encuentro al profesor ${CORREO_PROFE}`);
  const alumno = await prisma.user.findUnique({ where: { email: CORREO_ALUMNO } });
  if (!alumno) throw new Error(`No encuentro al estudiante ${CORREO_ALUMNO}`);

  const previos = await prisma.recorrido.findMany({
    where: { titulo: TITULO },
    select: { id: true, pasos: { select: { id: true } } },
  });
  for (const r of previos) {
    const pasoIds = r.pasos.map((p) => p.id);
    const vinculos = await prisma.pasoEjercicio.findMany({ where: { pasoId: { in: pasoIds } }, select: { ejercicioId: true } });
    await prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.ejercicio.deleteMany({ where: { id: { in: vinculos.map((v) => v.ejercicioId) } } });
    await prisma.asignacion.deleteMany({ where: { recorridoId: r.id } });
    await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.paso.deleteMany({ where: { recorridoId: r.id } });
    await prisma.recorrido.delete({ where: { id: r.id } });
    console.log("Versión anterior borrada.");
  }

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: TITULO,
      descripcion: "Secuencia de prueba: un paso por tipo de ejercicio.",
      nivel: "A1",
      tipo: "RECORRIDO",
      orden: 99,
      publicado: false,
      autorId: profe.id,
    },
    select: { id: true },
  });

  let orden = 1;
  for (const e of EJERCICIOS) {
    e.esquema.parse(e.datos);
    const paso = await prisma.paso.create({
      data: {
        recorridoId: recorrido.id,
        orden,
        ciclo: 1,
        tipo: e.tipoPaso,
        titulo: e.titulo,
      },
      select: { id: true },
    });
    const ejercicio = await prisma.ejercicio.create({
      data: {
        tipo: "OPCION_MULTIPLE",
        titulo: e.titulo,
        nivel: "A1",
        etiquetas: ["prueba"],
        datos: e.datos,
        publicado: false,
        autorId: profe.id,
      },
      select: { id: true },
    });
    await prisma.pasoEjercicio.create({
      data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
    });
    console.log(`  paso ${orden}: ${e.titulo}`);
    orden++;
  }

  await prisma.asignacion.create({
    data: {
      estudianteId: alumno.id,
      profesorId: profe.id,
      recorridoId: recorrido.id,
      nota: "Secuencia de prueba de los cuatro tipos.",
    },
  });

  console.log(`\nAsignada a ${CORREO_ALUMNO}. Ábrela en /recorridos/${recorrido.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
