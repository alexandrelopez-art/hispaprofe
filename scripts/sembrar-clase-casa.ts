/**
 * Siembra la clase A1 · Lección 2 — "La casa" a partir del Genially A1S3L2.
 *
 * Las imágenes y el audio se guardan dentro de HispaProfe (tabla Archivo),
 * no enlazados a Genially: así la clase sobrevive aunque el Genially cambie.
 *
 * Es idempotente: borra la versión anterior de esta misma clase y la rehace.
 * Ejecutar con:  npx tsx scripts/sembrar-clase-casa.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const MEDIA =
  process.env.MEDIA_GENIALLY ??
  "/private/tmp/claude-504/-Users-FLE-Projects-hispaprofe/863c6b1b-a326-45f8-97ef-749921f73747/scratchpad/gen2";

const TITULO = "La casa: pisos, partes y hay / no hay";
const CORREO_PROFE = "a.lopez.ele@hotmail.com";
const CORREO_ALUMNO = "gaspard@hotmail.com";

const GENIALLY =
  "https://view.genially.com/6a5eb438220aa2be579ff374/interactive-content-a1s3l2";
const CUADERNO =
  "https://docs.google.com/document/d/1z4WhZ7cjjtoWPzM4SiYn3o_Cbw4Uv8LDLypWSyiZUB4/edit?usp=sharing";
const WORDWALL =
  "https://wordwall.net/es/embed/65fb176c078a44e8ab6464ce79b904cf?themeId=1&templateId=22&fontStackId=0";
const BLOOKET = "https://play.blooket.com/play?hwId=6a60e1a41fc1be0deec3901c";

/** Ficheros del Genially exportado que entran en la clase. */
const MEDIOS = {
  plano: ["d1e0fe12-1d8b-4841-ae68-f897fa55515c.png", "image/png"],
  bano: ["1a870a76-84f2-445a-aa88-1d6889a92c89.png", "image/png"],
  comedor: ["0b828eec-8bbc-4097-8467-7a86284558af.png", "image/png"],
  balcon: ["4d95e916-dd88-4f65-88ad-f19a8979f6cb.png", "image/png"],
  habitacion: ["84ac8509-dbf2-4cfa-86fd-4b935ba9853b.png", "image/png"],
  cocina: ["b64a3a59-b368-4eca-a2ac-8d64a4b08e7a.png", "image/png"],
  salon: ["826cfcb9-470c-4da0-882b-55a1ee223fcd.png", "image/png"],
  gramatica: ["1784594892371-Capture_d_e_cran_2026-07-20_a__19.48.09.png", "image/png"],
  palabras: ["1784594789628-Capture_d_e_cran_2026-07-20_a__19.46.27.png", "image/png"],
  audio: ["9c83dc5f-f6eb-4363-a3cf-1d59c26d10fe.mpga", "audio/mpeg"],
} as const;

type ClaveMedio = keyof typeof MEDIOS;

async function subir(clave: ClaveMedio, profesorId: string): Promise<string> {
  const [nombre, tipo] = MEDIOS[clave];
  const datos = readFileSync(`${MEDIA}/${nombre}`);
  const archivo = await prisma.archivo.create({
    data: {
      nombre: `${clave} — ${TITULO}`,
      tipo,
      tamano: datos.byteLength,
      datos,
      subidoPorId: profesorId,
    },
    select: { id: true },
  });
  return `/api/archivos/${archivo.id}`;
}

/** Un bloque sin repetir el pasoId ni el orden en cada llamada. */
type Bloque = {
  tipo: "TEXTO" | "IMAGEN" | "AUDIO" | "EMBED" | "ENLACE";
  texto?: string;
  url?: string;
  etiqueta?: string;
};

async function crearPaso(
  recorridoId: string,
  orden: number,
  ciclo: number,
  tipo: "ACTIVACION" | "ACTIVIDAD" | "ANDAMIAJE" | "MICRO_TAREA" | "MACRO_TAREA",
  destreza: "CO" | "CE" | "EO" | "EE" | "EOI" | "EEI" | null,
  titulo: string,
  bloques: Bloque[],
) {
  const paso = await prisma.paso.create({
    data: { recorridoId, orden, ciclo, tipo, destreza, titulo },
    select: { id: true },
  });
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    await prisma.bloque.create({
      data: {
        pasoId: paso.id,
        orden: i + 1,
        tipo: b.tipo,
        texto: b.texto ?? null,
        url: b.url ?? null,
        etiqueta: b.etiqueta ?? null,
      },
    });
  }
  console.log(`  paso ${orden} (${tipo}) — ${titulo}  [${bloques.length} bloques]`);
}

async function main() {
  const profe = await prisma.user.findUnique({ where: { email: CORREO_PROFE } });
  if (!profe) throw new Error(`No encuentro al profesor ${CORREO_PROFE}`);
  const alumno = await prisma.user.findUnique({ where: { email: CORREO_ALUMNO } });
  if (!alumno) throw new Error(`No encuentro al estudiante ${CORREO_ALUMNO}`);

  // ─── Borrar la versión anterior de esta clase, si la hubiera ───────────
  const previos = await prisma.recorrido.findMany({
    where: { titulo: TITULO },
    select: { id: true, pasos: { select: { id: true } } },
  });
  for (const r of previos) {
    const pasoIds = r.pasos.map((p) => p.id);
    await prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.asignacion.deleteMany({ where: { recorridoId: r.id } });
    await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.paso.deleteMany({ where: { recorridoId: r.id } });
    await prisma.recorrido.delete({ where: { id: r.id } });
    console.log("Versión anterior borrada.");
  }

  console.log("Guardando imágenes y audio dentro de HispaProfe...");
  const src = {} as Record<ClaveMedio, string>;
  for (const clave of Object.keys(MEDIOS) as ClaveMedio[]) {
    src[clave] = await subir(clave, profe.id);
  }

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: TITULO,
      descripcion:
        "Lección 2 del nivel A1. Hablo de pisos, casas y las partes de la casa, y uso hay / no hay para describirlas.",
      nivel: "A1",
      tipo: "RECORRIDO",
      orden: 1,
      publicado: true,
      autorId: profe.id,
    },
    select: { id: true },
  });
  console.log(`\nRecorrido creado: "${TITULO}"`);

  // ─── Ciclo 1 ──────────────────────────────────────────────────────────
  await crearPaso(recorrido.id, 1, 1, "ACTIVACION", "EO", "¿Cómo es tu casa?", [
    { tipo: "IMAGEN", url: src.plano, etiqueta: "Plano de una casa con todas sus partes" },
    {
      tipo: "TEXTO",
      texto:
        "## Lección 2 — Hablo de… pisos, casas y las partes de la casa\n\n" +
        "En esta clase vas a aprender a:\n\n" +
        "- nombrar **los pisos y las casas**\n" +
        "- nombrar **las partes de la casa**\n" +
        "- usar **hay / no hay** para decir qué tiene una vivienda\n\n" +
        "**Para empezar, piensa y responde en voz alta:**\n\n" +
        "1. ¿Vives en un piso o en una casa?\n" +
        "2. ¿Cuántas habitaciones hay?\n" +
        "3. ¿Hay balcón? ¿Hay ascensor?",
    },
    {
      tipo: "ENLACE",
      url: CUADERNO,
      etiqueta: "Tu cuaderno",
      texto: "Aquí te dejo ejercicios y aquí escribes tus respuestas.",
    },
    {
      tipo: "ENLACE",
      url: GENIALLY,
      etiqueta: "La lección interactiva",
      texto: "La misma clase en Genially, por si prefieres verla ahí.",
    },
  ]);

  await crearPaso(recorrido.id, 2, 1, "ACTIVIDAD", "CE", "Las partes de la casa", [
    {
      tipo: "TEXTO",
      texto:
        "Mira cada dibujo y di **cómo se llama** esa parte de la casa.\n\n" +
        "Después comprueba con la lista de abajo.",
    },
    { tipo: "IMAGEN", url: src.bano, etiqueta: "1" },
    { tipo: "IMAGEN", url: src.comedor, etiqueta: "2" },
    { tipo: "IMAGEN", url: src.balcon, etiqueta: "3" },
    { tipo: "IMAGEN", url: src.habitacion, etiqueta: "4" },
    { tipo: "IMAGEN", url: src.cocina, etiqueta: "5" },
    { tipo: "IMAGEN", url: src.salon, etiqueta: "6" },
    {
      tipo: "TEXTO",
      texto:
        "### Las palabras\n\n" +
        "1. el **cuarto de baño**\n" +
        "2. el **comedor**\n" +
        "3. el **balcón**\n" +
        "4. la **habitación**\n" +
        "5. la **cocina**\n" +
        "6. el **salón**",
    },
  ]);

  await crearPaso(recorrido.id, 3, 1, "ACTIVIDAD", "CO", "Vacaciones en Valencia", [
    {
      tipo: "TEXTO",
      texto:
        "Escucha el audio. Es un piso de vacaciones en Valencia.\n\n" +
        "**Marca qué hay** en ese piso:\n\n" +
        "- ☐ el cuarto de baño\n" +
        "- ☐ el salón comedor\n" +
        "- ☐ la habitación\n" +
        "- ☐ la cocina\n" +
        "- ☐ el balcón\n\n" +
        "Puedes escucharlo las veces que necesites.",
    },
    { tipo: "AUDIO", url: src.audio, etiqueta: "Vacaciones en Valencia" },
  ]);

  await crearPaso(recorrido.id, 4, 1, "ANDAMIAJE", null, "hay / no hay", [
    { tipo: "IMAGEN", url: src.gramatica, etiqueta: "MI GRAMÁTICA — hay / no hay" },
    {
      tipo: "TEXTO",
      texto:
        "**hay** sirve para decir qué existe en un sitio. No cambia nunca: " +
        "vale para uno y para muchos.\n\n" +
        "- hay **un** balcón\n" +
        "- hay **tres** balcones\n" +
        "- hay balcones / hay wifi → sin artículo\n" +
        "- **no hay** balcones / no hay wifi",
    },
    { tipo: "IMAGEN", url: src.palabras, etiqueta: "MIS PALABRAS — piso y apartamento" },
    {
      tipo: "TEXTO",
      texto:
        "En España se dice **piso**. En Hispanoamérica, **apartamento**. " +
        "Las dos son correctas.",
    },
  ]);

  await crearPaso(recorrido.id, 5, 1, "MICRO_TAREA", "CE", "Juego: partes de la casa", [
    {
      tipo: "TEXTO",
      texto: "Juega para fijar el vocabulario. Puedes repetirlo tantas veces como quieras.",
    },
    { tipo: "EMBED", url: WORDWALL, etiqueta: "Las partes de la casa" },
  ]);

  // ─── Ciclo 2 ──────────────────────────────────────────────────────────
  await crearPaso(recorrido.id, 6, 2, "ACTIVIDAD", "EE", "¿Cómo es tu vivienda?", [
    {
      tipo: "TEXTO",
      texto:
        "Escribe **cinco frases** sobre tu vivienda usando **hay** y **no hay**.\n\n" +
        "Por ejemplo:\n\n" +
        "> En mi piso hay dos habitaciones. No hay balcón, pero hay una terraza pequeña.\n\n" +
        "Escríbelas en tu cuaderno.",
    },
    {
      tipo: "ENLACE",
      url: CUADERNO,
      etiqueta: "Tu cuaderno",
      texto: "Escribe aquí tus cinco frases.",
    },
  ]);

  await crearPaso(recorrido.id, 7, 2, "ACTIVIDAD", "CE", "Repaso con Blooket", [
    { tipo: "TEXTO", texto: "Otro juego de repaso, esta vez contra el reloj." },
    { tipo: "ENLACE", url: BLOOKET, etiqueta: "Jugar en Blooket" },
  ]);

  await crearPaso(recorrido.id, 8, 2, "ANDAMIAJE", null, "Preparo mi correo", [
    {
      tipo: "TEXTO",
      texto:
        "Antes de escribir, prepara tus palabras.\n\n" +
        "**Para saludar:** Hola, buenos días.\n\n" +
        "**Para preguntar:** ¿Hay…? ¿Cuántas habitaciones hay?\n\n" +
        "**Para describir:** En el piso hay… No hay…\n\n" +
        "**Para despedirte:** Gracias, un saludo.",
    },
  ]);

  await crearPaso(
    recorrido.id,
    9,
    2,
    "MACRO_TAREA",
    "EE",
    "Escribe a la inmobiliaria",
    [
      {
        tipo: "TEXTO",
        texto:
          "### Para: Lacasa@detussueños.com\n\n" +
          "Escribe un correo a la inmobiliaria **La casa de tus sueños**. " +
          "Busca piso y quieres información.\n\n" +
          "En tu correo tiene que haber:\n\n" +
          "1. un **saludo**\n" +
          "2. **qué buscas**: piso o casa, cuántas habitaciones\n" +
          "3. **dos preguntas** con *hay*: ¿Hay ascensor? ¿Hay balcón?\n" +
          "4. una **despedida**\n\n" +
          "Escríbelo en tu cuaderno. Tu profe lo lee y te da los puntos.",
      },
      {
        tipo: "ENLACE",
        url: CUADERNO,
        etiqueta: "Tu cuaderno",
        texto: "Escribe aquí tu correo.",
      },
    ],
  );

  // ─── Asignar a Gaspard ────────────────────────────────────────────────
  await prisma.asignacion.create({
    data: {
      estudianteId: alumno.id,
      profesorId: profe.id,
      recorridoId: recorrido.id,
      nota: "Tu clase de mañana. Ve paso a paso y marca cada uno cuando lo termines.",
    },
  });

  console.log(`\nAsignada a ${CORREO_ALUMNO}.`);
  console.log(`Ábrela en: /recorridos/${recorrido.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
