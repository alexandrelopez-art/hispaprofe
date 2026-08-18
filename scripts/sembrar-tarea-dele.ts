/**
 * Siembra una tarea del DELE —su secuencia, su paso, sus audios y su
 * ejercicio— en la base a la que apunte `DATABASE_URL`.
 *
 * Existe porque una tarea de comprensión auditiva no se puede montar por la
 * interfaz sin pelearse con el tope de 4 MB de Vercel: son ocho audios por
 * tarea, y el camino corto es sembrarlos en local —donde no hay tope— y
 * llevarlos luego con `copiar-a-produccion.ts`, que conserva los ids para que
 * las direcciones `/api/archivos/<id>` de dentro del ejercicio sigan valiendo.
 *
 * **Los audios se cortan aparte.** De la pista oficial de esa tarea, por los
 * silencios largos que separan las conversaciones:
 *
 *   ffmpeg -ss <inicio> -to <fin> -i "Pista 05.mp3" -vn -ac 1 -c:a aac -b:a 48k <salida>.m4a
 *
 * Son los mismos parámetros con los que comprime el servidor (`ARGS_FFMPEG`
 * en `lib/audio.ts`), así que lo sembrado es idéntico a lo que habría salido
 * subiéndolo por la aplicación. Los cortes se llaman
 * `00-instrucciones-y-ejemplo.m4a` y `01-pregunta-1.m4a` … `07-pregunta-7.m4a`.
 *
 * **Cada corte lleva dentro las dos audiciones** que el examen da, así que el
 * ejercicio declara `escuchas: 1`. Con el valor por omisión (2) el alumno
 * oiría cada conversación cuatro veces.
 *
 * Ejecutar con:
 *
 *   npx tsx scripts/sembrar-tarea-dele.ts --audios=/ruta/a/los/cortes
 *
 * Para sembrar otra tarea: se copia `TAREA` y se cambian sus preguntas. Las
 * respuestas correctas salen de la clave oficial del cuadernillo, no de lo que
 * conteste una IA; comprobarlas es parte del trabajo, no un extra.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { revisarDatos } from "@/lib/recursos";

type Pregunta = {
  enunciado: string;
  opciones: string[];
  /** Índice de la buena, según la clave oficial. */
  correcta: number;
};

type Tarea = {
  /** El título de la secuencia. También identifica lo ya sembrado. */
  recorrido: string;
  descripcion: string;
  nivel: Nivel;
  destreza: Destreza;
  /** El bloque de `/preparacion` al que pertenece: 2 = práctica por tarea. */
  bloque: number;
  etiquetas: string[];
  /** El título del paso: «Tarea 1». */
  paso: string;
  consigna: string;
  preguntas: Pregunta[];
};

const TAREA: Tarea = {
  recorrido: "A2/B1 escolar · Comprensión auditiva (examen 1)",
  descripcion:
    "Prueba de comprensión auditiva del examen 1 de Claves DELE escolar.",
  nivel: "A2_B1_ESCOLAR",
  destreza: "CO",
  bloque: 2,
  etiquetas: ["DELE", "A2/B1 escolar", "examen 1"],
  paso: "Tarea 1",
  consigna:
    "Vas a escuchar siete conversaciones. Escucharás cada conversación dos " +
    "veces. Después debes contestar a las preguntas (1-7). Selecciona la " +
    "opción correcta (A, B o C).",
  // Clave oficial de esta tarea: 1-A, 2-C, 3-C, 4-B, 5-A, 6-B, 7-A.
  preguntas: [
    {
      enunciado: "¿Qué han decidido regalarle?",
      opciones: ["Una sesión de masaje y spa", "Unas pesas", "Un libro"],
      correcta: 0,
    },
    {
      enunciado: "¿Cómo van a volver a casa las dos amigas?",
      opciones: ["En autobús", "En coche", "En taxi"],
      correcta: 2,
    },
    {
      enunciado: "¿Quién es el profe de Matemáticas?",
      opciones: [
        "Un profesor calvo",
        "Un profesor moreno",
        "Un profesor rubio y con coleta",
      ],
      correcta: 2,
    },
    {
      enunciado: "¿Qué taller elige para sus hijos?",
      opciones: ["El taller de pintura", "El taller de música", "Ningún taller"],
      correcta: 1,
    },
    {
      enunciado: "¿Qué asignatura optativa van a tener en común?",
      opciones: ["Francés", "Ninguna", "Educación plástica y visual"],
      correcta: 0,
    },
    {
      enunciado: "¿Qué va a hacer el chico?",
      opciones: [
        "Ir a la enfermería",
        "Irse a casa a descansar",
        "Pedir permiso a la tutora",
      ],
      correcta: 1,
    },
    {
      enunciado: "¿A qué lugar van a entrar?",
      opciones: [
        "A una tienda de alimentación ecológica",
        "A un cine antiguo",
        "A una academia",
      ],
      correcta: 0,
    },
  ],
};

function carpetaDeAudios(): string {
  const bandera = process.argv.find((a) => a.startsWith("--audios="));
  if (!bandera) {
    throw new Error(
      "Falta --audios=<carpeta> con los cortes de la pista (ver la cabecera).",
    );
  }
  return bandera.slice("--audios=".length);
}

/** Guarda un corte y devuelve la dirección con la que se referencia. */
async function guardarAudio(
  carpeta: string,
  archivo: string,
  nombre: string,
  autorId: string,
): Promise<string> {
  const datos = await readFile(join(carpeta, archivo));
  const fila = await prisma.archivo.create({
    data: {
      nombre,
      tipo: "audio/mp4",
      tamano: datos.byteLength,
      datos,
      subidoPorId: autorId,
    },
    select: { id: true },
  });
  return `/api/archivos/${fila.id}`;
}

async function main() {
  const carpeta = carpetaDeAudios();

  const autor = await prisma.user.findFirst({
    where: { role: { in: ["PROFESOR", "ADMIN"] } },
    select: { id: true, email: true, role: true },
  });
  if (!autor) throw new Error("No hay ningún profesor ni administrador.");

  // No se siembra dos veces: el script no sabe fusionar, y una segunda pasada
  // dejaría dos secuencias iguales con audios duplicados dentro de la base.
  const repetido = await prisma.recorrido.findFirst({
    where: { titulo: TAREA.recorrido },
    select: { id: true },
  });
  if (repetido) {
    throw new Error(`Ya existe «${TAREA.recorrido}» (${repetido.id}).`);
  }

  console.log(`Autor: ${autor.email} (${autor.role})`);

  // Los audios primero: sus direcciones van dentro del ejercicio.
  const instrucciones = await guardarAudio(
    carpeta,
    "00-instrucciones-y-ejemplo.m4a",
    `${TAREA.recorrido} · ${TAREA.paso} · instrucciones y ejemplo`,
    autor.id,
  );
  const audios: string[] = [];
  for (let i = 1; i <= TAREA.preguntas.length; i++) {
    audios.push(
      await guardarAudio(
        carpeta,
        `0${i}-pregunta-${i}.m4a`,
        `${TAREA.recorrido} · ${TAREA.paso} · conversación ${i}`,
        autor.id,
      ),
    );
  }
  console.log(`${audios.length + 1} audios guardados.`);

  const datos = {
    ejercicio: "opcion",
    consigna: TAREA.consigna,
    multiple: false,
    presentacion: "botones",
    escuchas: 1,
    preguntas: TAREA.preguntas.map((p, i) => ({
      id: `p${i + 1}`,
      enunciado: `${i + 1}. ${p.enunciado}`,
      opciones: p.opciones,
      correctas: [p.correcta],
      audio: audios[i],
    })),
  };

  // El mismo portero por el que pasan el editor de Recursos y el pegado: lo
  // sembrado se rechaza por lo mismo y con las mismas palabras que lo escrito
  // a mano.
  const revision = revisarDatos(datos);
  if ("error" in revision) {
    throw new Error(`El ejercicio no pasa: ${revision.error}`);
  }

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: TAREA.recorrido,
      descripcion: TAREA.descripcion,
      nivel: TAREA.nivel,
      destreza: TAREA.destreza,
      tipo: "PREPARACION_DELE",
      orden: TAREA.bloque,
      publicado: false,
      autorId: autor.id,
    },
    select: { id: true },
  });

  const paso = await prisma.paso.create({
    data: {
      recorridoId: recorrido.id,
      orden: 1,
      ciclo: 1,
      tipo: "ACTIVIDAD",
      destreza: TAREA.destreza,
      titulo: TAREA.paso,
    },
    select: { id: true },
  });

  await prisma.bloque.create({
    data: {
      pasoId: paso.id,
      orden: 1,
      tipo: "TEXTO",
      texto: `**${TAREA.paso}.** ${TAREA.consigna}`,
    },
  });
  // Bloque `AUDIO` y no `EMBED`: es lo que `maximoDeEscucha` sabe racionar,
  // y las instrucciones se oyen una vez, como en el examen.
  await prisma.bloque.create({
    data: {
      pasoId: paso.id,
      orden: 2,
      tipo: "AUDIO",
      url: instrucciones,
      etiqueta: "Instrucciones y ejemplo",
    },
  });

  // Publicado desde el principio: `puedeEngancharse` prohíbe colgar un
  // borrador de un paso, y sembrar por debajo no es excusa para dejar la base
  // en un estado que la aplicación rechazaría.
  const ejercicio = await prisma.ejercicio.create({
    data: {
      tipo: revision.tipo,
      titulo: `${TAREA.recorrido} · ${TAREA.paso}`,
      nivel: TAREA.nivel,
      destreza: TAREA.destreza,
      etiquetas: TAREA.etiquetas,
      datos,
      publicado: true,
      autorId: autor.id,
    },
    select: { id: true },
  });

  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
  });

  console.log(`\nRecorrido:  ${recorrido.id}`);
  console.log(`Paso:       ${paso.id}   →  /pasos/${paso.id}`);
  console.log(`Ejercicio:  ${ejercicio.id}`);
  console.log(
    `\nLa secuencia queda sin publicar: revísala y publícala cuando la des por buena.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
