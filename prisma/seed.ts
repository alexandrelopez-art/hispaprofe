import { prisma } from "../lib/prisma";
import { buscadorCasasSchema } from "../lib/ejercicios/buscador-casas";

async function main() {
  const datos = buscadorCasasSchema.parse({
    widget: "buscador_casas",
    marca: "lacasadetussueños.com",
    consigna: "¿Qué casa prefieres? Escribe tu respuesta con hay y no hay.",
    viviendas: [
      {
        id: "ruzafa",
        titulo: "Piso en Ruzafa",
        zona: "Valencia · 3.º sin ascensor",
        precio: "650 € al mes",
        ilustracion: "piso",
        hay: ["dos habitaciones", "una cocina americana", "un balcón pequeño", "un cuarto de baño"],
        noHay: ["garaje", "terraza"],
      },
      {
        id: "malvarrosa",
        titulo: "Casa en la Malvarrosa",
        zona: "Valencia · a 200 metros de la playa",
        precio: "1.100 € al mes",
        ilustracion: "casa",
        hay: ["tres habitaciones", "un jardín", "dos cuartos de baño", "una cocina grande"],
        noHay: ["piscina", "wifi"],
      },
      {
        id: "carmen",
        titulo: "Ático en el Carmen",
        zona: "Valencia · centro histórico",
        precio: "800 € al mes",
        ilustracion: "atico",
        hay: ["una habitación", "un salón grande", "una terraza con vistas"],
        noHay: ["jardín", "garaje"],
      },
    ],
  });

  const ej = await prisma.ejercicio.upsert({
    where: { id: "seed-buscador-casas" },
    update: { datos },
    create: {
      id: "seed-buscador-casas",
      tipo: "WIDGET",
      titulo: "Buscador de casas — la casa de tus sueños",
      nivel: "A1",
      destreza: "EE",
      etiquetas: ["partes de la casa", "hay / no hay", "vivienda"],
      datos,
      publicado: true,
    },
  });

  console.log("✓ Ejercicio sembrado:", ej.id, "—", ej.titulo);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
