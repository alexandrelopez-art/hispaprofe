/**
 * Verifica el esquema de la expresión, la versión pública y las reglas de la
 * entrega. Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-expresion.ts
 */
import "dotenv/config";
import { clasesParaCitar, puedeCitarse } from "@/lib/citas";
import {
  analizarExpresion,
  expresionDelPaso,
  expresionSchema,
  puedeEntregar,
  puedeValorarse,
  puntosDe,
  versionPublicaExpresion,
} from "@/lib/expresion";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-expresion-${process.pid}`;

let recorridoId: string | null = null;
let pasoId: string | null = null;
let asignacionId: string | null = null;
const usuarioIds: string[] = [];
const claseIds: string[] = [];
const grupoIds: string[] = [];
const pasoExtraIds: string[] = [];
const ejercicioIds: string[] = [];

const ESCRITA = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "Escribe un correo a un amigo contándole tus vacaciones.",
  estimulo: { texto: "Has vuelto de un viaje." },
  palabras: { minimo: 100, maximo: 120 },
  criterios: [
    { id: "c1", nombre: "Adecuación y cumplimiento", maximo: 3 },
    { id: "c2", nombre: "Coherencia", maximo: 3 },
  ],
  modelo: "Querida Ana:\nAcabo de volver…",
};

const ORAL = {
  ejercicio: "expresion",
  modalidad: "oral",
  consigna: "Describe la foto y contesta a las preguntas.",
  estimulo: { imagen: "/api/archivos/loquesea" },
  minutos: 3,
  criterios: [{ id: "c1", nombre: "Fluidez", maximo: 3 }],
};

async function main() {
  // ─── El esquema ─────────────────────────────────────────────────────
  afirmar(expresionSchema.safeParse(ESCRITA).success, "una escrita completa es válida");
  afirmar(expresionSchema.safeParse(ORAL).success, "una oral completa es válida");

  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, palabras: undefined }).success,
    "una escrita sin número de palabras se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ORAL, minutos: undefined }).success,
    "una oral sin minutos se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, minutos: 3 }).success,
    "una escrita con minutos se rechaza: eso es de las orales",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ORAL, palabras: { minimo: 1, maximo: 2 } }).success,
    "una oral con número de palabras se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, palabras: { minimo: 200, maximo: 100 } }).success,
    "un mínimo de palabras mayor que el máximo se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, criterios: [] }).success,
    "una tarea sin criterios se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({
      ...ESCRITA,
      criterios: [
        { id: "c1", nombre: "", maximo: 3 },
        { id: "c2", nombre: "Coherencia", maximo: 3 },
      ],
    }).success,
    "un criterio sin nombre se rechaza: la lista no basta con tener dos elementos",
  );
  afirmar(
    !expresionSchema.safeParse({
      ...ESCRITA,
      criterios: [
        { id: "c1", nombre: "Uno", maximo: 3 },
        { id: "c1", nombre: "Dos", maximo: 3 },
      ],
    }).success,
    "dos criterios con el mismo id se rechazan: sus notas se pisarían",
  );

  afirmar(analizarExpresion(ESCRITA) !== null, "analizarExpresion reconoce una escrita");
  afirmar(analizarExpresion({ ejercicio: "opcion" }) === null, "no reconoce un ejercicio del motor");
  afirmar(analizarExpresion(null) === null, "no reconoce null");

  const { tipoDeEjercicio } = await import("@/lib/recursos");
  afirmar(tipoDeEjercicio(ESCRITA) === "EXPRESION", "una escrita se guarda como EXPRESION");
  afirmar(tipoDeEjercicio(ORAL) === "EXPRESION", "una oral también");

  // ─── La versión pública: el modelo no viaja antes de tiempo ─────────
  const datos = analizarExpresion(ESCRITA)!;
  const sinCorregir = versionPublicaExpresion(datos, false);
  const corregida = versionPublicaExpresion(datos, true);

  afirmar(
    !("modelo" in sinCorregir) || sinCorregir.modelo === undefined,
    "sin corregir, el modelo NO viaja: si viajara, se lee en el código de la página",
  );
  afirmar(corregida.modelo === ESCRITA.modelo, "corregida, el modelo sí viaja");
  afirmar(sinCorregir.consigna === ESCRITA.consigna, "la consigna viaja siempre");
  afirmar(sinCorregir.criterios.length === 2, "los criterios viajan siempre: el alumno ve con qué se le puntúa");

  // ─── La rúbrica ─────────────────────────────────────────────────────
  // El tercer argumento es la entrega ya guardada: fuera de las pruebas de
  // esa regla concreta, se manda un texto cualquiera para que no interfiera.
  afirmar(puedeValorarse(datos, { c1: 3, c2: 2 }, "Algo entregado.") === null, "una rúbrica completa se puede guardar");
  afirmar(puedeValorarse(datos, { c1: 3 }, "Algo entregado.") !== null, "falta un criterio: no se guarda");
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 9 }, "Algo entregado.") !== null,
    "una nota por encima del máximo se rechaza",
  );
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: -1 }, "Algo entregado.") !== null,
    "una nota negativa se rechaza",
  );
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 2, c9: 1 }, "Algo entregado.") !== null,
    "una nota de un criterio que no existe se rechaza",
  );
  afirmar(puntosDe(datos, { c1: 3, c2: 2 }) === 5, "los puntos son la suma de las notas");

  // Una escrita sin entrega no se puede corregir: si no, el profesor podía
  // valorar antes de que el alumno escribiera nada, y `puedeEntregar` le
  // cerraría la puerta para siempre con «ya está corregida».
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 2 }, null) !== null,
    "una escrita sin entrega no se puede corregir",
  );
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 2 }, "") !== null,
    "una escrita con entrega vacía tampoco se puede corregir",
  );

  // En una oral, en cambio, no hay entrega que guardar: valorar sin ella es
  // lo normal, no una excepción.
  const datosOral = analizarExpresion(ORAL)!;
  afirmar(
    puedeValorarse(datosOral, { c1: 3 }, null) === null,
    "una oral sin entrega sí se puede corregir",
  );

  // ─── La entrega, contra filas reales ────────────────────────────────
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
  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Tarea 1", tipo: "MACRO_TAREA", ciclo: 1, orden: 1 },
  });
  pasoId = paso.id;
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;

  afirmar(
    (await puedeEntregar(asignacion.id, paso.id)) === null,
    "sin nada entregado todavía, se puede entregar",
  );

  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, entrega: "Un primer intento." },
  });
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id)) === null,
    "entregado pero sin corregir, todavía se puede reescribir",
  );

  await prisma.pasoCompletado.updateMany({
    where: { asignacionId: asignacion.id, pasoId: paso.id },
    data: { puntos: 5, verificadoEl: new Date() },
  });
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id)) !== null,
    "una vez corregida, ya no se puede reescribir",
  );

  // ─── La cita del oral ───────────────────────────────────────────────
  const otro = await prisma.user.create({
    data: { email: `otro-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(otro.id);

  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const suya = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: estudiante.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(suya.id);
  const ajena = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: otro.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(ajena.id);
  const anulada = await prisma.clase.create({
    data: {
      profesorId: profesor.id,
      estudianteId: estudiante.id,
      empiezaEl: manana,
      minutos: 60,
      estado: "ANULADA",
    },
  });
  claseIds.push(anulada.id);

  // Grupo del que el alumno es miembro: la clase se cita a través de él,
  // no de un `estudianteId` directo.
  const grupo = await prisma.grupo.create({
    data: { nombre: `Grupo ${marca}`, profesorId: profesor.id },
  });
  grupoIds.push(grupo.id);
  await prisma.miembroGrupo.create({
    data: { grupoId: grupo.id, estudianteId: estudiante.id },
  });
  const deGrupo = await prisma.clase.create({
    data: { profesorId: profesor.id, grupoId: grupo.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(deGrupo.id);

  // Suya, no anulada, pero ya pasada: ni se cita ni se ofrece.
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pasada = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: estudiante.id, empiezaEl: ayer, minutos: 60 },
  });
  claseIds.push(pasada.id);

  afirmar((await puedeCitarse(asignacion.id, suya.id)) === null, "se puede citar en una clase suya");
  afirmar(
    (await puedeCitarse(asignacion.id, ajena.id)) !== null,
    "no se puede citar en la clase de otro alumno",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, anulada.id)) !== null,
    "no se puede citar en una clase anulada",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, "noexiste")) !== null,
    "no se puede citar en una clase que no existe",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, deGrupo.id)) === null,
    "se puede citar en la clase de un grupo del alumno",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, pasada.id)) !== null,
    "no se puede citar en una clase que ya pasó",
  );

  const ofrecidas = await clasesParaCitar(asignacion.id);
  afirmar(
    ofrecidas.some((c) => c.id === suya.id),
    "la clase suya sale entre las que se ofrecen",
  );
  afirmar(
    ofrecidas.some((c) => c.id === deGrupo.id),
    "la clase del grupo sale entre las que se ofrecen",
  );
  afirmar(
    !ofrecidas.some(
      (c) => c.id === ajena.id || c.id === anulada.id || c.id === pasada.id,
    ),
    "la ajena, la anulada y la pasada no salen entre las que se ofrecen",
  );

  // ─── expresionDelPaso: la rúbrica se resuelve en lib/, no en la acción ──
  const pasoSinEjercicio = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Sin ejercicio", tipo: "MACRO_TAREA", ciclo: 1, orden: 2 },
  });
  pasoExtraIds.push(pasoSinEjercicio.id);
  afirmar(
    (await expresionDelPaso(pasoSinEjercicio.id)) === null,
    "un paso sin ningún ejercicio no tiene tarea de expresión",
  );

  const ejercicioMotor = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Del motor ${marca}`,
      nivel: "B1",
      datos: { ejercicio: "opcion", consigna: "x", multiple: false, preguntas: [] },
    },
  });
  ejercicioIds.push(ejercicioMotor.id);
  const pasoDelMotor = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Del motor", tipo: "MACRO_TAREA", ciclo: 1, orden: 3 },
  });
  pasoExtraIds.push(pasoDelMotor.id);
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoDelMotor.id, ejercicioId: ejercicioMotor.id, orden: 1 },
  });
  afirmar(
    (await expresionDelPaso(pasoDelMotor.id)) === null,
    "un paso con un ejercicio del motor tampoco tiene tarea de expresión",
  );

  const ejercicioExpresion = await prisma.ejercicio.create({
    data: { tipo: "EXPRESION", titulo: `Escrita ${marca}`, nivel: "B1", datos: ESCRITA },
  });
  ejercicioIds.push(ejercicioExpresion.id);
  const pasoConExpresion = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Con expresión", tipo: "MACRO_TAREA", ciclo: 1, orden: 4 },
  });
  pasoExtraIds.push(pasoConExpresion.id);
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoConExpresion.id, ejercicioId: ejercicioExpresion.id, orden: 1 },
  });
  const resuelta = await expresionDelPaso(pasoConExpresion.id);
  afirmar(
    resuelta !== null && resuelta.consigna === ESCRITA.consigna,
    "un paso con una tarea de expresión la devuelve",
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
    if (pasoId) {
      const id = pasoId;
      await intentar("paso", () => prisma.paso.delete({ where: { id } }));
    }
    if (pasoExtraIds.length) {
      // Antes que sus ejercicios y que el recorrido: borrar el paso
      // arrastra en cascada su `PasoEjercicio`, así que el ejercicio queda
      // libre para borrarse justo después.
      await intentar("pasos extra", () => prisma.paso.deleteMany({ where: { id: { in: pasoExtraIds } } }));
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
    if (grupoIds.length) {
      // Después de las clases: Clase.grupoId apunta al grupo. Y los
      // miembros antes que el grupo, aunque el borrado en cascada ya lo
      // haría: mejor no depender de eso.
      await intentar("miembros de grupo", () =>
        prisma.miembroGrupo.deleteMany({ where: { grupoId: { in: grupoIds } } }),
      );
      await intentar("grupos", () => prisma.grupo.deleteMany({ where: { id: { in: grupoIds } } }));
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
