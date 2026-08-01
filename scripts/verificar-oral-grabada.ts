/**
 * Verifica el campo `grabada` de una tarea de expresión y las reglas que
 * cambia: el esquema, `esGrabada`, `puedeValorarse`, `puedeEntregar`,
 * `puedeEntregarAudio` y `puedeCitarse`. Crea sus propios datos y los borra
 * al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-oral-grabada.ts
 */
import "dotenv/config";
import { puedeCitarse } from "@/lib/citas";
import {
  analizarExpresion,
  esGrabada,
  expresionSchema,
  puedeEntregar,
  puedeEntregarAudio,
  puedeValorarse,
} from "@/lib/expresion";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-oral-grabada-${process.pid}`;

let recorridoId: string | null = null;
let asignacionId: string | null = null;
const usuarioIds: string[] = [];
const claseIds: string[] = [];
const pasoIds: string[] = [];
const ejercicioIds: string[] = [];

const ESCRITA = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "Escribe un correo a un amigo contándole tus vacaciones.",
  palabras: { minimo: 100, maximo: 120 },
  criterios: [{ id: "c1", nombre: "Coherencia", maximo: 3 }],
};

const ORAL_CLASE = {
  ejercicio: "expresion",
  modalidad: "oral",
  consigna: "Describe la foto y contesta a las preguntas.",
  minutos: 3,
  criterios: [{ id: "c1", nombre: "Fluidez", maximo: 3 }],
};

const ORAL_GRABADA = { ...ORAL_CLASE, grabada: true };

async function main() {
  // ─── El esquema ─────────────────────────────────────────────────────
  afirmar(expresionSchema.safeParse(ORAL_GRABADA).success, "una oral con `grabada: true` es válida");

  const sinGrabada = expresionSchema.safeParse(ORAL_CLASE);
  afirmar(
    sinGrabada.success && sinGrabada.data.grabada === false,
    "una oral sin `grabada` es válida y sale `false`: el valor por defecto",
  );

  const escritaGrabada = expresionSchema.safeParse({ ...ESCRITA, grabada: true });
  afirmar(!escritaGrabada.success, "una escrita con `grabada: true` se rechaza");
  afirmar(
    !escritaGrabada.success &&
      escritaGrabada.error.issues.some((i) => i.message.includes("Solo una tarea oral se puede grabar")),
    "y el mensaje lo dice",
  );

  // ─── esGrabada ──────────────────────────────────────────────────────
  const datosGrabada = analizarExpresion(ORAL_GRABADA)!;
  const datosClase = analizarExpresion(ORAL_CLASE)!;
  afirmar(esGrabada(datosGrabada) === true, "esGrabada es cierto en una oral grabada");
  afirmar(esGrabada(datosClase) === false, "y falso en una oral de clase");

  // ─── puedeValorarse ─────────────────────────────────────────────────
  afirmar(
    puedeValorarse(datosGrabada, { c1: 3 }, null) !== null,
    "puedeValorarse rechaza una grabada sin entrega",
  );
  afirmar(
    puedeValorarse(datosClase, { c1: 3 }, null) === null,
    "puedeValorarse acepta una oral de clase sin entrega",
  );

  // ─── Contra filas reales ────────────────────────────────────────────
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(estudiante.id);
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  usuarioIds.push(profesor.id);

  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Recorrido ${marca}`, nivel: "B1", orden: 1 },
  });
  recorridoId = recorrido.id;
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;

  async function pasoConEjercicio(titulo: string, orden: number, datos: Prisma.InputJsonValue) {
    const ejercicio = await prisma.ejercicio.create({
      data: { tipo: "EXPRESION", titulo: `${titulo} ${marca}`, nivel: "B1", datos },
    });
    ejercicioIds.push(ejercicio.id);
    const paso = await prisma.paso.create({
      data: { recorridoId: recorrido.id, titulo, tipo: "MACRO_TAREA", ciclo: 1, orden },
    });
    pasoIds.push(paso.id);
    await prisma.pasoEjercicio.create({ data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 } });
    return paso;
  }

  const pasoGrabada = await pasoConEjercicio("Oral grabada", 1, ORAL_GRABADA);
  const pasoClase = await pasoConEjercicio("Oral de clase", 2, ORAL_CLASE);
  const pasoEscrita = await pasoConEjercicio("Escrita", 3, ESCRITA);
  const pasoSinEjercicio = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Sin ejercicio", tipo: "MACRO_TAREA", ciclo: 1, orden: 4 },
  });
  pasoIds.push(pasoSinEjercicio.id);

  // ─── puedeEntregar (texto) ──────────────────────────────────────────
  const motivoTexto = await puedeEntregar(asignacion.id, pasoGrabada.id, "Un texto normal.");
  afirmar(motivoTexto !== null, "puedeEntregar (texto) rechaza el paso de una grabada");
  afirmar(
    motivoTexto === "Esta tarea se entrega grabada, no escrita.",
    "y lo hace con el motivo propio, no el genérico de «no pide ninguna redacción»",
  );

  // ─── puedeEntregarAudio ─────────────────────────────────────────────
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoGrabada.id)) === null,
    "puedeEntregarAudio acepta el paso de una grabada",
  );
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoClase.id)) !== null,
    "puedeEntregarAudio rechaza el paso de una oral de clase",
  );
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoEscrita.id)) !== null,
    "puedeEntregarAudio rechaza el paso de una escrita",
  );
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoSinEjercicio.id)) !== null,
    "puedeEntregarAudio rechaza un paso sin ejercicio",
  );

  await prisma.pasoCompletado.create({
    data: {
      asignacionId: asignacion.id,
      pasoId: pasoGrabada.id,
      valoracion: { notas: { c1: 3 }, comentario: "Bien." },
      puntos: 3,
      verificadoEl: new Date(),
    },
  });
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoGrabada.id)) !== null,
    "puedeEntregarAudio rechaza después de corregir",
  );

  // ─── puedeCitarse ───────────────────────────────────────────────────
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const suya = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: estudiante.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(suya.id);

  const motivoCita = await puedeCitarse(asignacion.id, pasoGrabada.id, "noexiste", profesor.id);
  afirmar(motivoCita !== null, "puedeCitarse rechaza una grabada");
  afirmar(
    motivoCita === "Esa tarea se entrega grabada: no hay nada que citar.",
    "con el motivo propio, antes de mirar siquiera si la clase existe",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, pasoClase.id, suya.id, profesor.id)) === null,
    "puedeCitarse acepta una oral de clase en una clase suya",
  );

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` mataría el proceso antes del `finally` y la limpieza no
    // correría: en TDD el paso que falla lo hace a propósito, así que eso
    // dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    async function intentar(que: string, fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (e) {
        fallos++;
        console.error(`FALLO AL LIMPIAR (${que}): ${e instanceof Error ? e.message : e}`);
      }
    }
    // El orden importa: los vínculos antes que sus extremos.
    if (asignacionId) {
      const id = asignacionId;
      await intentar("citas", () => prisma.citaOral.deleteMany({ where: { asignacionId: id } }));
      await intentar("pasos completados", () => prisma.pasoCompletado.deleteMany({ where: { asignacionId: id } }));
      await intentar("asignación", () => prisma.asignacion.delete({ where: { id } }));
    }
    if (pasoIds.length) {
      // Antes que sus ejercicios: borrar el paso arrastra en cascada su
      // `PasoEjercicio`, así que el ejercicio queda libre justo después.
      await intentar("pasos", () => prisma.paso.deleteMany({ where: { id: { in: pasoIds } } }));
    }
    if (ejercicioIds.length) {
      await intentar("ejercicios", () => prisma.ejercicio.deleteMany({ where: { id: { in: ejercicioIds } } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    if (claseIds.length) {
      // Antes que los usuarios: Clase.profesorId es RESTRICT.
      await intentar("clases", () => prisma.clase.deleteMany({ where: { id: { in: claseIds } } }));
    }
    if (usuarioIds.length) {
      await intentar("usuarios", () => prisma.user.deleteMany({ where: { id: { in: usuarioIds } } }));
    }
    await intentar("desconectar", () => prisma.$disconnect());
    if (fallos > 0) {
      console.error(`\n${fallos} paso(s) de limpieza fallaron: puede quedar basura en la base.`);
      process.exitCode = 1;
    }
  });
