/**
 * Verifica el formato y las reglas de la evaluación oral. Crea sus propios
 * datos y los borra al terminar, incluso si una afirmación revienta a mitad
 * de camino.
 * Ejecutar con:  npx tsx scripts/verificar-orales.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { CRITERIOS } from "@/lib/orales/criterios";
import {
  calcularTotal,
  estadoDe,
  fmtNota,
  fmtTiempo,
  fmtTotal,
  pasoDe,
} from "@/lib/orales/formato";
import {
  ajustarNota,
  caparTiempo,
  notaDentroDelCriterio,
  origenDeSujetValido,
  puedeExaminarse,
} from "@/lib/orales/reglas";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-orales-${process.pid}`;

// Los ids de todo lo creado, para poder limpiarlo desde el `.finally()`
// aunque una afirmación reviente a mitad. Se rellenan en cuanto cada
// `create` responde, no al final de `main`.
let profesorId: string | undefined;
let estudianteId: string | undefined;
let grupoId: string | undefined;
let convocatoriaId: string | undefined;

function comprobarFormato() {
  // Los cinco criterios suman veinte y ni uno más.
  const suma = CRITERIOS.reduce((t, c) => t + c.maximo, 0);
  afirmar(suma === 20, "los cinco criterios suman 20");
  afirmar(CRITERIOS.length === 5, "hay cinco criterios");
  afirmar(
    CRITERIOS.every((c) => c.frases.length >= 8),
    "cada criterio trae al menos ocho frases sugeridas",
  );

  // El paso: 0,25 donde el máximo es pequeño, 0,5 en el resto.
  afirmar(pasoDe(2) === 0.25, "un criterio sobre 2 se mueve de 0,25 en 0,25");
  afirmar(pasoDe(4) === 0.5, "un criterio sobre 4 se mueve de 0,5 en 0,5");
  afirmar(pasoDe(5) === 0.5, "un criterio sobre 5 se mueve de 0,5 en 0,5");

  // El reloj, en los cuatro puntos que importan.
  afirmar(fmtTiempo(0) === "00:00", "el cronómetro parado dice 00:00");
  afirmar(fmtTiempo(59) === "00:59", "59 segundos son 00:59");
  afirmar(fmtTiempo(60) === "01:00", "60 segundos son 01:00");
  afirmar(fmtTiempo(300) === "05:00", "el tope son 05:00");
  afirmar(fmtTiempo(287.5) === "04:47", "los decimales se truncan hacia abajo");

  // Las notas: sin ceros de adorno en el criterio, con un decimal en el total.
  afirmar(fmtNota(3) === "3", "un entero se escribe sin decimales");
  afirmar(fmtNota(1.5) === "1,5", "el decimal va con coma, no con punto");
  afirmar(fmtNota(1.25) === "1,25", "los cuartos de punto se escriben enteros");
  afirmar(fmtTotal(15) === "15,0", "el total siempre lleva un decimal");

  // El total con la parrilla a medias: lo que falta no resta.
  afirmar(calcularTotal({}) === 0, "sin notas el total es 0");
  afirmar(calcularTotal({ lengua: 3 }) === 3, "una sola nota es el total");
  afirmar(
    calcularTotal({ lengua: 3, fluidez: 1.5, contenido: 4, organizacion: 3.5, oratoria: 3 }) === 15,
    "las cinco notas suman el total",
  );
  afirmar(
    calcularTotal({ lengua: 0.25, fluidez: 0.25 }) === 0.5,
    "sumar cuartos no arrastra error de coma flotante",
  );

  // El semáforo.
  afirmar(estadoDe(null) === "vacio", "sin evaluación, gris");
  afirmar(
    estadoDe({ sujetoId: "s1", notas: { lengua: 3 } }) === "medias",
    "con el sujet elegido y una nota, amarillo",
  );
  afirmar(
    estadoDe({ sujetoId: null, notas: { lengua: 3, fluidez: 1, contenido: 1, organizacion: 1, oratoria: 1 } }) === "medias",
    "las cinco notas sin sujet elegido siguen siendo amarillo",
  );
  afirmar(
    estadoDe({ sujetoId: "s1", notas: { lengua: 3, fluidez: 1, contenido: 1, organizacion: 1, oratoria: 1 } }) === "hecho",
    "sujet y cinco notas, verde",
  );
  afirmar(
    estadoDe({ sujetoId: "s1", notas: { lengua: 0, fluidez: 0, contenido: 0, organizacion: 0, oratoria: 0 } }) === "hecho",
    "un cero es una nota puesta, no una nota que falta",
  );
}

function comprobarReglasPuras() {
  // Regla 5: la nota no se sale del criterio.
  afirmar(ajustarNota(null, 1, 4) === 0.5, "el primer + sobre una nota vacía pone medio punto");
  afirmar(ajustarNota(null, 1, 2) === 0.25, "sobre 2, el primer + deja un cuarto de punto");
  afirmar(ajustarNota(null, -1, 4) === 0, "el primer − sobre una nota vacía la deja en cero");
  afirmar(ajustarNota(4, 1, 4) === 4, "el + no pasa del máximo del criterio");
  afirmar(ajustarNota(0, -1, 4) === 0, "el − no baja de cero");
  afirmar(ajustarNota(1.5, 1, 2) === 1.75, "sobre 2 el + sube de cuarto en cuarto");
  afirmar(ajustarNota(2, 1, 2) === 2, "sobre 2 el + tampoco pasa del máximo");
  afirmar(ajustarNota(0.25, -1, 2) === 0, "restar un cuarto desde un cuarto da cero pelado");
  afirmar(ajustarNota(1.1, 1, 4) === 1.6, "una nota que no cae en la rejilla se redondea al moverla");

  afirmar(notaDentroDelCriterio("fluidez", 2) === null, "un 2 sobre 2 es válido");
  afirmar(notaDentroDelCriterio("fluidez", 2.5) !== null, "un 2,5 sobre 2 se rechaza");
  afirmar(notaDentroDelCriterio("lengua", -1) !== null, "una nota negativa se rechaza");
  afirmar(
    (notaDentroDelCriterio("fluidez", 2.5) ?? "").includes("2"),
    "el rechazo dice cuál es el máximo, no un error genérico",
  );

  // Regla 4: el cronómetro no pasa de cinco minutos.
  afirmar(caparTiempo(287.5) === 287.5, "un tiempo normal se guarda tal cual");
  afirmar(caparTiempo(1000) === 300, "un tiempo pasado de rosca se capa en 300");
  afirmar(caparTiempo(-5) === 0, "un tiempo negativo se guarda como cero");

  // Regla 6: un sujet tiene un origen y solo uno.
  afirmar(origenDeSujetValido({ imagenId: "a1" }) === null, "un sujet con imagen vale");
  afirmar(origenDeSujetValido({ recursoId: "e1" }) === null, "un sujet con recurso vale");
  afirmar(origenDeSujetValido({}) !== null, "un sujet sin origen se rechaza");
  afirmar(
    origenDeSujetValido({ imagenId: "a1", recursoId: "e1" }) !== null,
    "un sujet con imagen y recurso a la vez se rechaza",
  );
}

async function main() {
  comprobarFormato();
  comprobarReglasPuras();
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  profesorId = profesor.id;

  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, firstName: "Rose", lastName: "HERMITE" },
  });
  estudianteId = estudiante.id;

  const grupo = await prisma.grupo.create({
    data: { nombre: `Terminale ${marca}`, profesorId: profesor.id },
  });
  grupoId = grupo.id;

  // ── El ida y vuelta completo: convocatoria → sujeto → turno → evaluación.
  const convocatoria = await prisma.convocatoria.create({
    data: { nombre: `Oral ${marca}`, profesorId: profesor.id },
  });
  convocatoriaId = convocatoria.id;

  const sujeto = await prisma.sujeto.create({
    data: {
      convocatoriaId: convocatoria.id,
      numero: 7,
      eje: "Arte y poder",
      titulo: "Mafalda: la niña que desafía a los adultos",
      descripcion: "Viñeta de Quino.",
      fuente: "BBC Mundo",
      url: "https://www.bbc.com/mundo",
      preguntas: ["¿Qué ves?", "¿Por qué incomoda?"],
    },
  });

  const turno = await prisma.turno.create({
    data: {
      convocatoriaId: convocatoria.id,
      grupoId: grupo.id,
      estudianteId: estudiante.id,
      dia: "Mercredi 20/05",
      preparacion: "08h00",
      hora: "08h15",
      sala: "CDI",
      orden: 1,
    },
  });

  // Regla 3: a una ficha suprimida no se le crea un examen.
  afirmar(
    (await puedeExaminarse(estudiante.id)) === null,
    "a un estudiante vivo se le puede dar turno",
  );
  await prisma.user.update({
    where: { id: estudiante.id },
    data: { suprimidoEl: new Date(), bloqueadoEl: new Date() },
  });
  const negativa = await puedeExaminarse(estudiante.id);
  afirmar(negativa !== null, "a una ficha suprimida se le niega el turno");
  afirmar(
    (await puedeExaminarse(null)) === null,
    "una pausa no tiene a quién comprobar, así que pasa",
  );
  await prisma.user.update({
    where: { id: estudiante.id },
    data: { suprimidoEl: null, bloqueadoEl: null },
  });

  const evaluacion = await prisma.evaluacionOral.create({
    data: {
      turnoId: turno.id,
      sujetoId: sujeto.id,
      segundosEoc: 287.5,
      notas: { lengua: 3, fluidez: 1.5, contenido: 4, organizacion: 3.5, oratoria: 3 },
      comentarios: { general: "Bien." },
      frases: { lengua: ["Léxico variado y preciso"] },
      preguntadas: [0, 3],
    },
  });

  afirmar(evaluacion.preguntadas.length === 2, "las preguntas hechas se guardan como lista de enteros");
  afirmar(evaluacion.segundosEoc === 287.5, "los segundos admiten decimales");
  afirmar(sujeto.preguntas.length === 2, "el sujet guarda sus preguntas de la EOI");
  afirmar(sujeto.recursoId === null, "un sujet con imagen no apunta a ningún recurso");

  // Una pausa es un turno sin estudiante.
  const pausa = await prisma.turno.create({
    data: { convocatoriaId: convocatoria.id, grupoId: grupo.id, dia: "Mercredi 20/05", hora: "—", orden: 2 },
  });
  afirmar(pausa.estudianteId === null, "una pausa es un turno sin estudiante");

  // Borrar la convocatoria se lleva sujets, turnos y evaluaciones por cascada.
  await prisma.convocatoria.delete({ where: { id: convocatoria.id } });
  convocatoriaId = undefined;
  const quedan = await prisma.turno.count({ where: { id: turno.id } });
  afirmar(quedan === 0, "borrar la convocatoria se lleva sus turnos por cascada");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` aquí mataría el proceso antes del `finally` y la
    // limpieza no correría. En TDD el paso RED falla a propósito, así que
    // eso dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    // El orden importa: los vínculos antes que sus extremos.
    if (convocatoriaId) {
      await prisma.convocatoria.deleteMany({ where: { id: convocatoriaId } });
    }
    if (grupoId) await prisma.grupo.deleteMany({ where: { id: grupoId } });
    const userIds = [estudianteId, profesorId].filter(
      (id): id is string => id !== undefined,
    );
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });
