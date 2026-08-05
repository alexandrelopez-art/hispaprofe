/**
 * Verifica quién puede borrar una secuencia y qué dice el aviso.
 *
 * Ejecutar con:  npx tsx scripts/verificar-borrado-recorrido.ts
 */
import "dotenv/config";
import { avisoDeBorrado, grabacionesBorrables, puedeBorrarRecorrido, resumenDeBorrado } from "@/lib/recorridos";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const ADMIN = { id: "u-admin", role: "ADMIN" };
const PROFE = { id: "u-profe", role: "PROFESOR" };
const OTRO_PROFE = { id: "u-otro", role: "PROFESOR" };
const ALUMNO = { id: "u-alumno", role: "STUDENT" };

async function main() {
  // ─── Quién puede ────────────────────────────────────────────────────
  const propia = { autorId: PROFE.id };
  const ajena = { autorId: OTRO_PROFE.id };
  const huerfana = { autorId: null };

  afirmar(puedeBorrarRecorrido(ADMIN, ajena), "el administrador borra la de otro");
  afirmar(puedeBorrarRecorrido(ADMIN, huerfana), "y también una sin autor");
  afirmar(puedeBorrarRecorrido(PROFE, propia), "el profesor borra la suya");
  afirmar(!puedeBorrarRecorrido(PROFE, ajena), "pero no la de otro profesor");
  afirmar(
    !puedeBorrarRecorrido(PROFE, huerfana),
    "ni una sin autor: ahí solo entra el administrador",
  );
  afirmar(!puedeBorrarRecorrido(ALUMNO, propia), "un alumno no borra nada");
  afirmar(!puedeBorrarRecorrido(null, huerfana), "y sin sesión, tampoco");

  // ─── El aviso ───────────────────────────────────────────────────────
  const vacia = { pasos: 4, alumnos: 0, pasosHechos: 0, notas: 0, grabaciones: 0 };
  const corto = avisoDeBorrado("<sdfsdfsd", vacia);
  afirmar(corto.includes("<sdfsdfsd"), "el aviso nombra la secuencia");
  afirmar(corto.includes("4 pasos"), "y dice cuántos pasos se lleva");
  afirmar(
    !corto.includes("alumno") && !corto.includes("nota") && !corto.includes("grabaci"),
    "y no menciona lo que no hay: un aviso que enumera ceros no se lee",
  );

  const conTrabajo = { pasos: 6, alumnos: 3, pasosHechos: 12, notas: 2, grabaciones: 1 };
  const largo = avisoDeBorrado("Piso o Casa", conTrabajo);
  afirmar(largo.includes("3 alumnos"), "con trabajo dentro, el aviso cuenta los alumnos");
  afirmar(largo.includes("12 pasos hechos"), "los pasos hechos");
  afirmar(largo.includes("2 notas"), "las notas puestas");
  afirmar(largo.includes("1 grabación"), "y las grabaciones");
  afirmar(
    largo.includes("no hay vuelta atrás"),
    "y dice que no hay vuelta atrás, que es lo único que de verdad frena a nadie",
  );

  // El singular, que es donde se nota una plantilla mal escrita.
  const uno = avisoDeBorrado("Prueba", {
    pasos: 1,
    alumnos: 1,
    pasosHechos: 1,
    notas: 1,
    grabaciones: 1,
  });
  afirmar(uno.includes("1 alumno ") || uno.includes("1 alumno,"), "un alumno, en singular");
  afirmar(!uno.includes("1 alumnos"), "y no «1 alumnos»");
  afirmar(!uno.includes("1 grabaciones"), "ni «1 grabaciones»");

  // Con una sola categoría con contenido, `partes.length === 1` y el aviso no
  // pasa por el `join` de en medio. Sin este caso, esa rama no la ejercita
  // nadie: los dos avisos de arriba tienen cero categorías o las cuatro.
  const unaSola = avisoDeBorrado("Solo audio", {
    pasos: 3,
    alumnos: 0,
    pasosHechos: 0,
    notas: 0,
    grabaciones: 2,
  });
  const enumerado = unaSola.match(/tiene (.*)\. Se borra/)?.[1];
  afirmar(enumerado === "2 grabaciones", "una sola categoría se enumera sola, sin acompañarse de nada");
  afirmar(!(enumerado ?? "").includes(","), "sin coma colgando cuando no hay nada que enumerar detrás");
  afirmar(!(enumerado ?? "").includes(" y "), "ni un «y» suelto uniendo esa categoría con la siguiente");

  // ─── Contra filas reales ────────────────────────────────────────────
  const marca = `verificar-borrado-${process.pid}`;

  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  const alumno = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });

  // El ejercicio es de la biblioteca: tiene que sobrevivir al borrado.
  const ejercicio = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Ejercicio ${marca}`,
      nivel: "A2",
      datos: { ejercicio: "opcion", items: [] },
      autorId: profesor.id,
    },
  });

  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Secuencia ${marca}`, nivel: "A2", orden: 999, autorId: profesor.id },
  });
  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Paso" },
  });
  const bloque = await prisma.bloque.create({
    data: { pasoId: paso.id, orden: 1, tipo: "TEXTO", texto: "Hola" },
  });
  const enganche = await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
  });
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: alumno.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });

  // La grabación de este alumno, y otra que además nombra alguien de fuera.
  const suya = await prisma.archivo.create({
    data: { nombre: "suya.m4a", tipo: "audio/mp4", tamano: 3, datos: Buffer.from("abc"), privado: true },
  });
  const deOtra = await prisma.archivo.create({
    data: { nombre: "de-otra.m4a", tipo: "audio/mp4", tamano: 3, datos: Buffer.from("abc"), privado: true },
  });

  const completado = await prisma.pasoCompletado.create({
    data: {
      asignacionId: asignacion.id,
      pasoId: paso.id,
      puntos: 5,
      entrega: `/api/archivos/${suya.id}`,
    },
  });

  // El caso que de verdad hay que montar bien: `deOtra` tiene que ser
  // **candidato** —o sea, estar nombrado por una entrega de ESTA secuencia— y
  // además estar nombrado desde fuera. Si solo lo nombrara la otra secuencia,
  // no sería candidato y la afirmación de abajo no podría fallar nunca, que es
  // no comprobar nada.
  //
  // Así que aquí va el alumno que teclea en su redacción el identificador de
  // la grabación de un compañero, que es exactamente lo que avisa
  // `lib/expresion.ts`: `entrega` es texto libre.
  const segundoPaso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, orden: 2, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Paso 2" },
  });
  const listillo = await prisma.user.create({
    data: { email: `listillo-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  const suAsignacion = await prisma.asignacion.create({
    data: { estudianteId: listillo.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  await prisma.pasoCompletado.create({
    data: {
      asignacionId: suAsignacion.id,
      pasoId: segundoPaso.id,
      entrega: `/api/archivos/${deOtra.id}`,
    },
  });

  // Y la secuencia de fuera que lo nombra de verdad: es lo que salva el
  // archivo de que este borrado se lo lleve.
  const otraSecuencia = await prisma.recorrido.create({
    data: { titulo: `Otra ${marca}`, nivel: "A2", orden: 998 },
  });
  const otroPaso = await prisma.paso.create({
    data: { recorridoId: otraSecuencia.id, orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Otro" },
  });
  const otraAsignacion = await prisma.asignacion.create({
    data: { estudianteId: alumno.id, profesorId: profesor.id, recorridoId: otraSecuencia.id },
  });
  await prisma.pasoCompletado.create({
    data: {
      asignacionId: otraAsignacion.id,
      pasoId: otroPaso.id,
      entrega: `/api/archivos/${deOtra.id}`,
    },
  });

  const clase = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: alumno.id, empiezaEl: new Date(), minutos: 60 },
  });
  const cita = await prisma.citaOral.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, claseId: clase.id },
  });
  const escucha = await prisma.escucha.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, clave: "audio-1", veces: 2 },
  });

  const resumen = await resumenDeBorrado(recorrido.id);
  afirmar(resumen.pasos === 2, `el resumen cuenta los dos pasos (${resumen.pasos})`);
  afirmar(resumen.alumnos === 2, `los dos alumnos asignados (${resumen.alumnos})`);
  afirmar(resumen.pasosHechos === 2, `los dos pasos hechos (${resumen.pasosHechos})`);
  afirmar(resumen.notas === 1, `una sola nota puesta (${resumen.notas})`);
  // Dos: la entrega del listillo también empieza por el prefijo, y el resumen
  // cuenta lo que hay escrito, no lo que resulte borrable. Distinguirlas es
  // trabajo de `grabacionesBorrables`, dos afirmaciones más abajo.
  afirmar(resumen.grabaciones === 2, `dos entregas con pinta de grabación (${resumen.grabaciones})`);

  const borrables = await grabacionesBorrables(recorrido.id);
  afirmar(borrables.includes(suya.id), "la grabación de esta secuencia es borrable");
  afirmar(
    !borrables.includes(deOtra.id),
    "y la que nombra una entrega de otra secuencia, no: no se destruye de más",
  );

  // El barrido. La acción no se puede llamar desde aquí —necesita sesión—, así
  // que se ejecuta la misma transacción que ella, que es lo que se comprueba.
  const pasoIds = [paso.id, segundoPaso.id];
  await prisma.$transaction([
    prisma.citaOral.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.escucha.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.archivo.deleteMany({ where: { id: { in: borrables } } }),
    prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.asignacion.deleteMany({ where: { recorridoId: recorrido.id } }),
    prisma.paso.deleteMany({ where: { recorridoId: recorrido.id } }),
    prisma.recorrido.delete({ where: { id: recorrido.id } }),
  ]);

  const nada = async (que: string, buscar: () => Promise<unknown | null>) =>
    afirmar((await buscar()) === null, `tras borrar no queda ${que}`);

  await nada("la secuencia", () => prisma.recorrido.findUnique({ where: { id: recorrido.id } }));
  await nada("el paso", () => prisma.paso.findUnique({ where: { id: paso.id } }));
  await nada("el bloque", () => prisma.bloque.findUnique({ where: { id: bloque.id } }));
  await nada("el enganche", () => prisma.pasoEjercicio.findUnique({ where: { id: enganche.id } }));
  await nada("la asignación", () => prisma.asignacion.findUnique({ where: { id: asignacion.id } }));
  await nada("el paso completado", () => prisma.pasoCompletado.findUnique({ where: { id: completado.id } }));
  await nada("la cita del oral", () => prisma.citaOral.findUnique({ where: { id: cita.id } }));
  await nada("la escucha", () => prisma.escucha.findUnique({ where: { id: escucha.id } }));
  await nada("la grabación", () => prisma.archivo.findUnique({ where: { id: suya.id } }));

  afirmar(
    (await prisma.ejercicio.findUnique({ where: { id: ejercicio.id } })) !== null,
    "y el ejercicio sigue vivo: vive en la biblioteca, no en la secuencia",
  );
  afirmar(
    (await prisma.archivo.findUnique({ where: { id: deOtra.id } })) !== null,
    "y la grabación que nombraba otra secuencia, también",
  );

  // Limpieza de lo que queda en pie. El orden lo mandan las claves ajenas:
  // los pasos completados antes que su asignación, la clase antes que su
  // profesor, y los usuarios al final.
  await prisma.pasoCompletado.deleteMany({ where: { pasoId: otroPaso.id } });
  await prisma.citaOral.deleteMany({ where: { claseId: clase.id } });
  await prisma.clase.delete({ where: { id: clase.id } });
  await prisma.asignacion.deleteMany({ where: { id: otraAsignacion.id } });
  await prisma.paso.deleteMany({ where: { recorridoId: otraSecuencia.id } });
  await prisma.recorrido.delete({ where: { id: otraSecuencia.id } });
  await prisma.ejercicio.delete({ where: { id: ejercicio.id } });
  await prisma.archivo.delete({ where: { id: deOtra.id } });
  await prisma.user.deleteMany({
    where: { id: { in: [profesor.id, alumno.id, listillo.id] } },
  });
  await prisma.$disconnect();

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
