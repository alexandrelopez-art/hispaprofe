import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Carga las variables de .env (DATABASE_URL) — nativo en Node 20.12+
process.loadEnvFile();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Limpia SOLO el contenido para poder re-ejecutar el seed sin duplicar.
  // Nunca toca la tabla User. Paso primero por su relación con Recorrido.
  await prisma.paso.deleteMany();
  await prisma.recorrido.deleteMany();

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: "Medio ambiente: consumo y sostenibilidad",
      descripcion:
        "Recorrido B2 sobre hábitos de consumo, huella ecológica y energías renovables.",
      nivel: "B2",
      orden: 1,
      publicado: true,
      pasos: {
        create: [
          // ---------- Ciclo 1 ----------
          { orden: 1, ciclo: 1, tipo: "ACTIVACION",  destreza: "EO",  titulo: "Lluvia de ideas: nuestros hábitos de consumo" },
          { orden: 2, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Podcast sobre consumo responsable" },
          { orden: 3, ciclo: 1, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Léxico del medio ambiente y conectores de causa-consecuencia" },
          { orden: 4, ciclo: 1, tipo: "ACTIVIDAD",   destreza: "CE",  titulo: "Artículo: la huella ecológica" },
          { orden: 5, ciclo: 1, tipo: "MICRO_TAREA", destreza: "EE",  titulo: "Comentario en un foro (80-100 palabras)" },
          // ---------- Ciclo 2 ----------
          { orden: 6, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "CO",  titulo: "Debate radiofónico sobre energías renovables" },
          { orden: 7, ciclo: 2, tipo: "ANDAMIAJE",   destreza: null,  titulo: "Opinión y desacuerdo; subjuntivo en oraciones concesivas" },
          { orden: 8, ciclo: 2, tipo: "ACTIVIDAD",   destreza: "EOI", titulo: "Simular un debate en parejas" },
          { orden: 9, ciclo: 2, tipo: "MACRO_TAREA", destreza: "EE",  titulo: "Artículo de opinión para una revista (200-250 palabras)" },
        ],
      },
    },
    include: { pasos: true },
  });

  console.log(`✅ Recorrido creado: "${recorrido.titulo}" (nivel ${recorrido.nivel})`);
  console.log(`   ${recorrido.pasos.length} pasos insertados (Ciclo 1 + Ciclo 2).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Error en el seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
