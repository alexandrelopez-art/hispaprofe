/**
 * Verifica las seis reglas de Recursos. Crea sus propios datos y los borra
 * al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-recursos.ts
 */
import "dotenv/config";
import {
  duplicar,
  puedeBorrarse,
  puedeDesengancharse,
  puedeEditarse,
  puedeEngancharse,
  tipoDeEjercicio,
  tieneRespuestas,
} from "@/lib/recursos";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-recursos-${process.pid}`;

const DATOS_OPCION = {
  ejercicio: "opcion",
  consigna: "Elige la respuesta correcta.",
  multiple: false,
  preguntas: [
    { id: "a", enunciado: "En mi piso ___ tres habitaciones.", opciones: ["hay", "son"], correctas: [0] },
  ],
};

async function nuevoEjercicio(publicado: boolean) {
  return prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Ejercicio ${marca}`,
      nivel: "B1",
      datos: DATOS_OPCION,
      publicado,
    },
  });
}

async function main() {
  // 1. La tabla que deriva Ejercicio.tipo desde datos.ejercicio.
  afirmar(tipoDeEjercicio(DATOS_OPCION) === "OPCION_MULTIPLE", "opcion → OPCION_MULTIPLE");
  afirmar(
    tipoDeEjercicio({ ejercicio: "huecos", consigna: "c", texto: "un {{a}}", huecos: [{ id: "a", acepta: ["x"] }] }) === "HUECOS",
    "huecos → HUECOS",
  );
  afirmar(
    tipoDeEjercicio({ ejercicio: "relacionar", consigna: "c", parejas: [{ id: "1", izquierda: "a", derecha: "b" }, { id: "2", izquierda: "c", derecha: "d" }] }) === "RELACIONAR",
    "relacionar → RELACIONAR",
  );
  afirmar(
    tipoDeEjercicio({ ejercicio: "ordenar", consigna: "c", piezas: [{ id: "1", texto: "a" }, { id: "2", texto: "b" }] }) === "ORDENAR",
    "ordenar → ORDENAR",
  );
  afirmar(tipoDeEjercicio({ ejercicio: "opcion" }) === null, "un datos roto no tiene tipo");
  afirmar(tipoDeEjercicio(null) === null, "null no tiene tipo");

  // El andamio: un recorrido con un paso, y dos ejercicios.
  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Recorrido ${marca}`, nivel: "B1", orden: 1 },
  });
  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Paso", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  const borrador = await nuevoEjercicio(false);
  const publicado = await nuevoEjercicio(true);
  const otro = await nuevoEjercicio(true);

  // 2. Regla 1: un borrador no se engancha.
  afirmar(
    (await puedeEngancharse(borrador.id, paso.id)) !== null,
    "un borrador no se puede enganchar",
  );
  afirmar(
    (await puedeEngancharse(publicado.id, paso.id)) === null,
    "un publicado sí se puede enganchar a un paso vacío",
  );
  afirmar(
    (await puedeEngancharse("noexiste", paso.id)) !== null,
    "un ejercicio que no existe no se puede enganchar",
  );

  // 3. Regla 2: un paso, un ejercicio.
  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: publicado.id, orden: 1 },
  });
  afirmar(
    (await puedeEngancharse(otro.id, paso.id)) !== null,
    "un paso que ya tiene ejercicio no admite un segundo",
  );

  // 4. Regla 3: un ejercicio enganchado no se borra.
  afirmar((await puedeBorrarse(publicado.id)) !== null, "un enganchado no se borra");
  afirmar((await puedeBorrarse(borrador.id)) === null, "uno suelto sí se borra");

  // 5. Sin respuestas, se desengancha y se edita con normalidad. Esta fila
  //    es la que discrimina: sin ella, una implementación que prohibiera por
  //    "está enganchado" en vez de por "tiene respuestas" pasaría igual todo
  //    lo demás.
  afirmar(!(await tieneRespuestas(paso.id)), "un paso recién hecho no tiene respuestas");
  afirmar((await puedeDesengancharse(paso.id)) === null, "sin respuestas sí se desengancha");
  afirmar((await puedeEditarse(publicado.id)) === null, "enganchado pero sin responder sí se edita");

  // 6. Reglas 4, 5 y 6: con respuestas guardadas, las tres puertas se cierran.
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, respuestas: { a: "0" } },
  });

  afirmar(await tieneRespuestas(paso.id), "con un PasoCompletado que las guarda, sí tiene respuestas");
  afirmar((await puedeDesengancharse(paso.id)) !== null, "con respuestas no se desengancha");
  afirmar((await puedeEngancharse(otro.id, paso.id)) !== null, "con respuestas no se cambia el ejercicio");
  afirmar((await puedeEditarse(publicado.id)) !== null, "un ejercicio respondido no se edita");

  // 7. Duplicar: la copia nace en borrador y con los mismos datos.
  const copiaId = await duplicar(publicado.id);
  afirmar(copiaId !== null, "duplicar devuelve el id de la copia");
  const copia = await prisma.ejercicio.findUniqueOrThrow({ where: { id: copiaId! } });
  afirmar(!copia.publicado, "la copia nace en borrador");
  afirmar(copia.id !== publicado.id, "la copia es otra fila");
  afirmar(
    JSON.stringify(copia.datos) === JSON.stringify(publicado.datos),
    "la copia lleva los mismos datos",
  );
  afirmar((await puedeEditarse(copia.id)) === null, "la copia sí se edita");
  afirmar((await duplicar("noexiste")) === null, "duplicar algo que no existe devuelve null");

  // Limpieza. El orden importa: los vínculos antes que sus extremos.
  await prisma.pasoCompletado.deleteMany({ where: { asignacionId: asignacion.id } });
  await prisma.asignacion.delete({ where: { id: asignacion.id } });
  await prisma.pasoEjercicio.deleteMany({ where: { pasoId: paso.id } });
  await prisma.paso.delete({ where: { id: paso.id } });
  await prisma.recorrido.delete({ where: { id: recorrido.id } });
  await prisma.ejercicio.deleteMany({
    where: { id: { in: [borrador.id, publicado.id, otro.id, copia.id] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [estudiante.id, profesor.id] } } });

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
