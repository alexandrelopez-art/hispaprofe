import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Carga las variables de .env (DATABASE_URL) — nativo en Node 20.12+
process.loadEnvFile();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Cada recorrido con sus pasos. La estructura de 9 pasos / 2 ciclos es una
// PLANTILLA, no una regla: el 5º recorrido lo demuestra (7 pasos, dos
// andamiajes seguidos y sin micro tarea). Para añadir más, suma objetos aquí.
const recorridosData = [
  {
    titulo: "Tiempo libre: aficiones y planes",
    descripcion: "Hablar de aficiones, proponer planes y quedar con amigos.",
    nivel: "A2_B1_ESCOLAR",
    orden: 1,
    publicado: true,
    pasos: [
      { orden: 1, ciclo: 1, tipo: "ACTIVACION",  destreza: "EO",  titulo: "¿Qué haces en tu tiempo libre?" },
      { orden: 2, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Vídeo: jóvenes hablan de sus aficiones" },
      { orden: 3, ciclo: 1, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Verbos de afición (gustar, encantar) y frecuencia" },
      { orden: 4, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CE",  titulo: "Leer un chat sobre planes de fin de semana" },
      { orden: 5, ciclo: 1, tipo: "MICRO_TAREA", destreza: "EE",  titulo: "Mensaje proponiendo un plan (40-50 palabras)" },
      { orden: 6, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Dos amigos organizan una salida" },
      { orden: 7, ciclo: 2, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Expresar planes: ir a + infinitivo; quedar con" },
      { orden: 8, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "EOI", titulo: "Poneos de acuerdo para un plan juntos" },
      { orden: 9, ciclo: 2, tipo: "MACRO_TAREA", destreza: "EE",  titulo: "Entrada de blog sobre tu afición favorita (100-120 palabras)" },
    ],
  },
  {
    titulo: "Vida sana: alimentación y ejercicio",
    descripcion: "Hábitos saludables, consejos y menús equilibrados.",
    nivel: "A2_B1_ESCOLAR",
    orden: 2,
    publicado: true,
    pasos: [
      { orden: 1, ciclo: 1, tipo: "ACTIVACION",  destreza: "EO",  titulo: "¿Llevas una vida sana? Tus hábitos" },
      { orden: 2, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CE",  titulo: "Leer la pirámide de la alimentación" },
      { orden: 3, ciclo: 1, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Cuantificadores y frecuencia (siempre, a veces, nunca)" },
      { orden: 4, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Consejos de un médico escolar" },
      { orden: 5, ciclo: 1, tipo: "MICRO_TAREA", destreza: "EE",  titulo: "Tres consejos para un compañero (40-50 palabras)" },
      { orden: 6, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Pódcast sobre el desayuno ideal" },
      { orden: 7, ciclo: 2, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Dar consejos: deber + infinitivo; tener que" },
      { orden: 8, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "EOI", titulo: "Entrevista a un compañero sobre su dieta" },
      { orden: 9, ciclo: 2, tipo: "MACRO_TAREA", destreza: "EE",  titulo: "Diseñar un menú semanal saludable (100-120 palabras)" },
    ],
  },
  {
    titulo: "Medio ambiente: consumo y sostenibilidad",
    descripcion: "Recorrido B2 sobre hábitos de consumo, huella ecológica y energías renovables.",
    nivel: "B2",
    orden: 3,
    publicado: true,
    pasos: [
      { orden: 1, ciclo: 1, tipo: "ACTIVACION",  destreza: "EO",  titulo: "Lluvia de ideas: nuestros hábitos de consumo" },
      { orden: 2, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Podcast sobre consumo responsable" },
      { orden: 3, ciclo: 1, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Léxico del medio ambiente y conectores de causa-consecuencia" },
      { orden: 4, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CE",  titulo: "Artículo: la huella ecológica" },
      { orden: 5, ciclo: 1, tipo: "MICRO_TAREA", destreza: "EE",  titulo: "Comentario en un foro (80-100 palabras)" },
      { orden: 6, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Debate radiofónico sobre energías renovables" },
      { orden: 7, ciclo: 2, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Opinión y desacuerdo; subjuntivo en oraciones concesivas" },
      { orden: 8, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "EOI", titulo: "Simular un debate en parejas" },
      { orden: 9, ciclo: 2, tipo: "MACRO_TAREA", destreza: "EE",  titulo: "Artículo de opinión para una revista (200-250 palabras)" },
    ],
  },
  {
    titulo: "El mundo laboral: en busca de empleo",
    descripcion: "Recorrido B2 sobre ofertas de empleo, entrevistas y cartas de presentación.",
    nivel: "B2",
    orden: 4,
    publicado: true,
    pasos: [
      { orden: 1, ciclo: 1, tipo: "ACTIVACION",  destreza: "EO",  titulo: "Tu experiencia y expectativas laborales" },
      { orden: 2, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CE",  titulo: "Analizar ofertas de empleo reales" },
      { orden: 3, ciclo: 1, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Léxico del trabajo y perífrasis de obligación" },
      { orden: 4, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Escuchar una entrevista de trabajo" },
      { orden: 5, ciclo: 1, tipo: "MICRO_TAREA", destreza: "EE",  titulo: "Redactar un perfil profesional (80-100 palabras)" },
      { orden: 6, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Pódcast: errores en las entrevistas" },
      { orden: 7, ciclo: 2, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Condicional para hipótesis; registro formal" },
      { orden: 8, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "EOI", titulo: "Simular una entrevista de trabajo en parejas" },
      { orden: 9, ciclo: 2, tipo: "MACRO_TAREA", destreza: "EE",  titulo: "Escribir una carta de presentación (200-250 palabras)" },
    ],
  },
  {
    // ── Recorrido IRREGULAR (demostración de flexibilidad) ──
    // 7 pasos · dos andamiajes seguidos (3 y 4) · sin micro tarea.
    titulo: "El cine español: analizar una película",
    descripcion: "Estructura libre: doble andamiaje para la parte difícil y sin micro tarea.",
    nivel: "B2",
    orden: 5,
    publicado: true,
    pasos: [
      { orden: 1, ciclo: 1, tipo: "ACTIVACION",  destreza: "EO",  titulo: "¿Qué película te ha marcado y por qué?" },
      { orden: 2, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Ver el tráiler y una crítica en vídeo" },
      { orden: 3, ciclo: 1, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Léxico del cine: géneros, personajes, trama" },
      { orden: 4, ciclo: 1, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Tiempos del pasado para narrar (indefinido / imperfecto)" },
      { orden: 5, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CE",  titulo: "Leer una reseña cinematográfica" },
      { orden: 6, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "EOI", titulo: "Recomendar una película a un compañero" },
      { orden: 7, ciclo: 2, tipo: "MACRO_TAREA", destreza: "EE",  titulo: "Escribir una reseña de tu película favorita (200-250 palabras)" },
    ],
  },
];

async function main() {
  // Limpia SOLO el contenido para poder re-ejecutar el seed sin duplicar.
  // Nunca toca la tabla User. Paso primero por su relación con Recorrido.
  await prisma.paso.deleteMany();
  await prisma.recorrido.deleteMany();

  for (const data of recorridosData) {
    const { pasos, ...recorrido } = data;
    const creado = await prisma.recorrido.create({
      data: { ...recorrido, pasos: { create: pasos } },
      include: { pasos: true },
    });
    console.log(
      `✅ ${creado.titulo} (${creado.nivel}) — ${creado.pasos.length} pasos`
    );
  }

  console.log(`\n🎉 ${recorridosData.length} recorridos insertados.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Error en el seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
