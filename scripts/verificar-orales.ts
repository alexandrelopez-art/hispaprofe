/**
 * Verifica el formato y las reglas de la evaluación oral. Crea sus propios
 * datos y los borra al terminar, incluso si una afirmación revienta a mitad
 * de camino.
 * Ejecutar con:  npx tsx scripts/verificar-orales.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { CRITERIOS } from "@/lib/orales/criterios";
import { celda, construirCsv } from "@/lib/orales/csv";
import {
  calcularTotal,
  esPausa,
  estadoDe,
  fmtNota,
  fmtTiempo,
  fmtTotal,
  hayNotaPuesta,
  HORA_PAUSA,
  notaDe,
  pasoDe,
} from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";
import { parsearHorario } from "@/lib/orales/horario";
import {
  ajustarNota,
  alternarFrase,
  caparTiempo,
  notaDentroDelCriterio,
  origenDeSujetValido,
  preguntadasAlElegir,
} from "@/lib/orales/reglas";
import {
  grupoDeProfesor,
  puedeExaminarse,
  sujetoDeConvocatoria,
} from "@/lib/orales/reglas-servidor";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-orales-${process.pid}`;

// Los ids de todo lo creado, para poder limpiarlo desde el `.finally()`
// aunque una afirmación reviente a mitad. Se rellenan en cuanto cada
// `create` responde, no al final de `main`.
let profesorId: string | undefined;
let profesorAjenoId: string | undefined;
let estudianteId: string | undefined;
let grupoId: string | undefined;
let grupoAjenoId: string | undefined;
let convocatoriaId: string | undefined;
let convocatoriaAjenaId: string | undefined;

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
    // No es una comprobación de coma flotante: 0,25 y 0,5 son potencias de
    // dos y su suma ya sale exacta. Lo que valida es que el redondeo de
    // `calcularTotal` no estropea un total que ya venía bien.
    "sumar cuartos da un total exacto, y el redondeo no lo estropea",
  );

  // Sin ninguna nota puesta no hay total que enseñar: ni en el CSV ni en
  // la ficha impresa un «0,0 / 20» es la nota de nadie.
  afirmar(hayNotaPuesta({}) === false, "sin ninguna nota puesta, hayNotaPuesta es false");
  afirmar(
    hayNotaPuesta({ lengua: 0 }) === true,
    "un cero puesto a mano sí cuenta como nota puesta",
  );

  // `notaDe`: la única forma de preguntar «¿hay nota aquí?» que usan
  // `estadoDe`, la ficha y el CSV.
  afirmar(notaDe({}, "lengua") === null, "sin nota puesta, notaDe da null");
  afirmar(notaDe({ lengua: 0 }, "lengua") === 0, "un cero puesto a mano no es null");
  afirmar(notaDe({ lengua: 3 }, "lengua") === 3, "una nota puesta se devuelve tal cual");

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

function comprobarCsv() {
  afirmar(celda("hola") === "hola", "un texto normal va sin comillas");
  afirmar(celda('dijo "sí"') === '"dijo ""sí"""', "las comillas se duplican y la celda se entrecomilla");
  afirmar(celda("uno, dos") === '"uno, dos"', "una coma obliga a entrecomillar");
  afirmar(celda("uno\ndos") === '"uno\ndos"', "un salto de línea obliga a entrecomillar");
  afirmar(celda(null) === "", "un vacío es una celda vacía, no «null»");

  const csv = construirCsv([
    {
      dia: "Mercredi 20/05", hora: "08h15", apellido: "HERMITE", nombre: "Rose",
      sala: "CDI", sujetNumero: 7, sujetTitulo: "Mafalda", eje: "Arte y poder",
      segundosEoc: 287, segundosEoi: 300,
      notas: { lengua: 3, fluidez: 1.5, contenido: 4, organizacion: 3.5, oratoria: 3 },
      comentarios: { general: "Bien, con un «pero»" },
    },
  ]);

  afirmar(csv.startsWith("﻿"), "el CSV empieza por el BOM, o Excel se come las tildes");
  const lineas = csv.split("\r\n");
  afirmar(lineas[0].split(",").length === 22, "la cabecera tiene veintidós columnas");
  afirmar(lineas.length === 2, "una fila de datos por estudiante");
  afirmar(lineas[1].includes("15,0") === false, "el total del CSV va con punto decimal, no con coma");
  afirmar(lineas[1].includes('"Bien, con un «pero»"'), "el comentario con coma sale entrecomillado");

  // Un turno sin evaluación: día, hora, apellido, nombre y sala se ven —es
  // justo lo que el profesor necesita para saber que le falta—, pero todo
  // lo que saldría de una evaluación (tiempos, notas, comentarios, total)
  // va vacío. Ninguno de estos valores lleva coma ni comillas, así que
  // partir por "," basta para mirar columna a columna.
  const csvSinEvaluar = construirCsv([
    {
      dia: "Mercredi 20/05", hora: "09h00", apellido: "", nombre: "", sala: "CDI",
      sujetNumero: null, sujetTitulo: "", eje: "",
      segundosEoc: null, segundosEoi: null,
      notas: {}, comentarios: {},
    },
  ]);
  const colsSinEvaluar = csvSinEvaluar.split("\r\n")[1].split(",");
  afirmar(
    colsSinEvaluar[0] === "Mercredi 20/05" && colsSinEvaluar[4] === "CDI",
    "un turno sin evaluación conserva día, hora, apellido, nombre y sala",
  );
  afirmar(
    colsSinEvaluar[8] === "" && colsSinEvaluar[9] === "",
    "sin evaluación, los tiempos de EOC y EOI van vacíos, no en cero",
  );
  afirmar(
    [10, 12, 14, 16, 18].every((i) => colsSinEvaluar[i] === ""),
    "sin evaluación, las cinco notas van vacías",
  );
  afirmar(colsSinEvaluar[20] === "", "sin evaluación, el total va vacío, no 0.0");

  // Hay evaluación (con sus tiempos cronometrados) pero el profesor todavía
  // no ha puesto ninguna nota: el total no puede salir en 0,0 porque eso se
  // leería como una nota real.
  const csvSinNotas = construirCsv([
    {
      dia: "Mercredi 20/05", hora: "09h15", apellido: "DUPONT", nombre: "Léa", sala: "CDI",
      sujetNumero: 3, sujetTitulo: "Un sujet", eje: "Un eje",
      segundosEoc: 120, segundosEoi: 90,
      notas: {}, comentarios: {},
    },
  ]);
  const colsSinNotas = csvSinNotas.split("\r\n")[1].split(",");
  afirmar(
    colsSinNotas[8] === "120" && colsSinNotas[9] === "90",
    "con evaluación, los tiempos sí salen aunque falten las notas",
  );
  afirmar(colsSinNotas[20] === "", "con evaluación pero sin ninguna nota puesta, el total también va vacío");

  // Un cero puesto a mano es una nota de verdad, no una nota que falta: la
  // misma distinción que ya hace `estadoDe`.
  const csvConCero = construirCsv([
    {
      dia: "Mercredi 20/05", hora: "09h30", apellido: "MARTIN", nombre: "Léo", sala: "CDI",
      sujetNumero: 1, sujetTitulo: "Otro sujet", eje: "Otro eje",
      segundosEoc: 200, segundosEoi: 150,
      notas: { lengua: 0 }, comentarios: {},
    },
  ]);
  const colsConCero = csvConCero.split("\r\n")[1].split(",");
  afirmar(colsConCero[10] === "0", "un cero puesto a mano en un criterio se escribe 0, no vacío");
  afirmar(colsConCero[20] === "0.0", "con al menos una nota puesta, aunque sea un cero, el total sí se calcula");
}

/**
 * `parsearHorario` (lib/orales/horario.ts): siete campos, dos separadores,
 * dos formatos de pausa, emparejamiento por correo o por nombre —eso lo
 * decide la acción— y la herencia del día, que es donde vivió durante diez
 * revisiones el defecto de la 1: una pausa en formato de columnas (`; ; ;
 * --- ; ;`) llegaba con `campos[0] === ""`, no `"---"`, así que la rama que
 * comprobaba la pausa pelada no la heredaba y el turno se guardaba con
 * `dia: ""`.
 */
function comprobarHorario() {
  // Los dos separadores del liceo, en la misma tanda de líneas.
  const dosSeparadores = parsearHorario(
    "Mercredi 20/05\t08h00\t08h15\tHERMITE\tRose\tCDI\n" +
      "Mercredi 20/05 ; 08h30 ; 08h45 ; DUPONT ; Léa ; CDI",
  );
  afirmar(dosSeparadores.length === 2, "una línea por turno, sin importar el separador");
  afirmar(
    !dosSeparadores[0].pausa && dosSeparadores[0].apellido === "HERMITE",
    "el tabulador separa los siete campos",
  );
  afirmar(
    !dosSeparadores[1].pausa && dosSeparadores[1].apellido === "DUPONT",
    "el punto y coma separa los siete campos",
  );

  // El séptimo campo, el correo, solo si la línea lo trae.
  const conCorreo = parsearHorario(
    "Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI ; rose@ejemplo.test",
  );
  afirmar(
    !conCorreo[0].pausa && conCorreo[0].correo === "rose@ejemplo.test",
    "el séptimo campo, si viene, es el correo para emparejar",
  );
  const sinCorreo = parsearHorario("Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI");
  afirmar(
    !sinCorreo[0].pausa && sinCorreo[0].correo === null,
    "sin séptimo campo, el correo es null y no una cadena vacía",
  );

  // Una línea con menos de los siete campos no revienta el pegado entero.
  const conMenosCampos = parsearHorario("Mercredi 20/05 ; 08h15 ; HERMITE ; Rose");
  afirmar(conMenosCampos.length === 1, "una línea con campos de menos sigue dando una línea");
  afirmar(
    !conMenosCampos[0].pausa &&
      conMenosCampos[0].sala === null &&
      conMenosCampos[0].correo === null,
    "los campos que faltan al final del todo quedan en null, no revientan el parseo",
  );

  // La pausa pelada hereda el día de la fila anterior.
  const conPausaPelada = parsearHorario(
    "Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI\n" +
      "---\n" +
      "Mercredi 20/05 ; 09h00 ; 09h15 ; DUPONT ; Léa ; CDI",
  );
  afirmar(
    conPausaPelada[1].pausa && conPausaPelada[1].dia === "Mercredi 20/05",
    "la pausa pelada («---») hereda el día de la fila anterior",
  );
  afirmar(
    !conPausaPelada[2].pausa && conPausaPelada[2].dia === "Mercredi 20/05",
    "tras una pausa pelada, la fila siguiente conserva el día",
  );

  // La pausa en formato de columnas: el defecto de la revisión final. Sin
  // el arreglo, esto habría dado `dia: ""` y no `"Mercredi 20/05"`.
  const conPausaDeColumnas = parsearHorario(
    "Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI\n" +
      " ; ; ; --- ; ; \n" +
      "Mercredi 20/05 ; 09h00 ; 09h15 ; DUPONT ; Léa ; CDI",
  );
  afirmar(
    conPausaDeColumnas[1].pausa && conPausaDeColumnas[1].dia === "Mercredi 20/05",
    "la pausa en formato de columnas también hereda el día, no se queda en blanco",
  );
  afirmar(
    !conPausaDeColumnas[2].pausa && conPausaDeColumnas[2].dia === "Mercredi 20/05",
    "tras una pausa de columnas, la fila siguiente conserva el día",
  );

  // Herencia del día en filas normales: el liceo lo pega una sola vez por
  // jornada y lo deja en blanco en las siguientes.
  const conDiaUnaVez = parsearHorario(
    "Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI\n" +
      " ; 08h30 ; 08h45 ; DUPONT ; Léa ; CDI",
  );
  afirmar(
    !conDiaUnaVez[1].pausa && conDiaUnaVez[1].dia === "Mercredi 20/05",
    "una fila normal sin día propio hereda el de la fila anterior",
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

  // La rejilla del paso: `ajustarNota` (los botones) nunca se sale de ella,
  // pero `guardarEvaluacion` recibe notas de una acción, no de un botón, y
  // sin esto aceptaría un 3,3 sobre un criterio que se mueve de 0,5 en 0,5.
  afirmar(notaDentroDelCriterio("lengua", 3.5) === null, "sobre 4, un medio punto cae en la rejilla");
  afirmar(
    notaDentroDelCriterio("lengua", 3.3) !== null,
    "sobre 4, una nota que no es medio punto se rechaza aunque esté bajo el máximo",
  );
  afirmar(notaDentroDelCriterio("fluidez", 1.25) === null, "sobre 2, un cuarto de punto cae en la rejilla");
  afirmar(
    notaDentroDelCriterio("fluidez", 1.1) !== null,
    "sobre 2, una nota que no es cuarto de punto se rechaza",
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

  // B-5 de la revisión de la tarea 8: encender/apagar una frase sugerida.
  const encendida = alternarFrase([], "", "Buena entonación");
  afirmar(
    encendida.activas.includes("Buena entonación") && encendida.texto === "Buena entonación",
    "encender una frase la escribe en el comentario",
  );
  const apagada = alternarFrase(encendida.activas, encendida.texto, "Buena entonación");
  afirmar(
    !apagada.activas.includes("Buena entonación") && apagada.texto === encendida.texto,
    "apagar una frase no borra el texto que escribió",
  );
  const conTextoAMano = alternarFrase(
    [],
    "Nota escrita a mano por el profesor",
    "Buena entonación",
  );
  afirmar(
    conTextoAMano.texto === "Nota escrita a mano por el profesor · Buena entonación",
    "encender una frase se añade al final del texto ya escrito a mano",
  );
  const yaEscritaAMano = alternarFrase(
    [],
    "Ya venía con Buena entonación de antes",
    "Buena entonación",
  );
  afirmar(
    yaEscritaAMano.texto === "Ya venía con Buena entonación de antes",
    "encender una frase que ya aparece escrita a mano no la duplica",
  );
  const alternarLaEncendida = alternarFrase(
    ["Buena entonación"],
    "Buena entonación",
    "Buena entonación",
  );
  afirmar(
    alternarLaEncendida.activas.length === 0,
    "alternar una frase ya encendida la apaga en vez de duplicarla en la lista",
  );
  const apagadaConTextoAMano = alternarFrase(
    ["Buena entonación"],
    "Un comentario que ya decía Buena entonación a mano",
    "Buena entonación",
  );
  afirmar(
    apagadaConTextoAMano.texto === "Un comentario que ya decía Buena entonación a mano",
    "apagar una frase no borra el comentario aunque la frase también estuviera escrita a mano",
  );

  // B-5: qué pasa con las preguntas marcadas al elegir un sujet.
  afirmar(
    preguntadasAlElegir("sujeto-1", "sujeto-2", [0, 2]).length === 0,
    "cambiar de sujet de verdad vacía las preguntas marcadas",
  );
  afirmar(
    preguntadasAlElegir("sujeto-1", "sujeto-1", [0, 2]).length === 2,
    "repulsar el mismo sujet no borra las preguntas marcadas",
  );
  afirmar(
    preguntadasAlElegir(null, "sujeto-1", [0]).length === 0,
    "elegir el primer sujet también vacía las preguntas que hubiera sueltas",
  );
}

async function main() {
  comprobarFormato();
  comprobarCsv();
  comprobarHorario();
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

  // Un segundo profesor con su propio grupo, para la regla 7: el grupo que
  // se pega en el horario tiene que ser de quien pide.
  const profesorAjeno = await prisma.user.create({
    data: { email: `profe-ajeno-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  profesorAjenoId = profesorAjeno.id;
  const grupoAjeno = await prisma.grupo.create({
    data: { nombre: `Ajeno ${marca}`, profesorId: profesorAjeno.id },
  });
  grupoAjenoId = grupoAjeno.id;

  // Regla 7: el grupo tiene que ser de quien pide.
  afirmar(
    (await grupoDeProfesor(grupoAjeno.id, profesor.id, false)) !== null,
    "el grupo de otro profesor se rechaza",
  );
  afirmar(
    (await grupoDeProfesor(grupo.id, profesor.id, false)) === null,
    "el grupo propio se acepta",
  );

  // ── El ida y vuelta completo: convocatoria → sujeto → turno → evaluación.
  const convocatoria = await prisma.convocatoria.create({
    data: { nombre: `Oral ${marca}`, profesorId: profesor.id },
  });
  convocatoriaId = convocatoria.id;

  // Una segunda convocatoria con su propio sujet, para la regla 8: el sujet
  // guardado en la evaluación tiene que ser de la convocatoria del turno.
  const convocatoriaAjena = await prisma.convocatoria.create({
    data: { nombre: `Ajena ${marca}`, profesorId: profesor.id },
  });
  convocatoriaAjenaId = convocatoriaAjena.id;
  const sujetoAjeno = await prisma.sujeto.create({
    data: {
      convocatoriaId: convocatoriaAjena.id,
      numero: 1,
      eje: "Otro eje",
      titulo: "Sujet de otra convocatoria",
      descripcion: "No debería poder elegirse desde otro examen.",
      imagenId: "img-ajena",
    },
  });

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

  // Regla 8: el sujet tiene que ser de la convocatoria del turno.
  afirmar(
    (await sujetoDeConvocatoria(sujetoAjeno.id, convocatoria.id)) !== null,
    "un sujet de otra convocatoria se rechaza",
  );
  afirmar(
    (await sujetoDeConvocatoria(sujeto.id, convocatoria.id)) === null,
    "un sujet de la propia convocatoria se acepta",
  );
  afirmar(
    (await sujetoDeConvocatoria(null, convocatoria.id)) === null,
    "sin sujet elegido todavía, pasa",
  );
  afirmar(
    (await sujetoDeConvocatoria(undefined, convocatoria.id)) === null,
    "un sujet undefined también pasa",
  );

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

  // Regla 6 contra la base: un sujet que ya se usó no se borra, y el
  // @@unique impide dos sujets con el mismo número en la convocatoria.
  let repetido = false;
  try {
    await prisma.sujeto.create({
      data: {
        convocatoriaId: convocatoria.id,
        numero: 7,
        eje: "Otro",
        titulo: "Repetido",
        descripcion: "",
        preguntas: [],
        imagenId: "otra",
      },
    });
  } catch {
    repetido = true;
  }
  afirmar(repetido, "dos sujets con el mismo número en la misma convocatoria chocan");

  // El semáforo con una fila real, no con un objeto inventado.
  const conEvaluacion = await prisma.turno.findUniqueOrThrow({
    where: { id: turno.id },
    select: { evaluacion: { select: { sujetoId: true, notas: true } } },
  });
  afirmar(
    estadoDe(conEvaluacion.evaluacion as { sujetoId: string | null; notas: Notas | null }) === "hecho",
    "un turno con sujet y cinco notas sale en verde",
  );
  afirmar(
    fmtTotal(calcularTotal(conEvaluacion.evaluacion?.notas as Notas)) === "15,0",
    "y su nota se lee 15,0",
  );

  // Una pausa es un turno sin estudiante.
  const pausa = await prisma.turno.create({
    data: { convocatoriaId: convocatoria.id, grupoId: grupo.id, dia: "Mercredi 20/05", hora: HORA_PAUSA, orden: 2 },
  });
  afirmar(pausa.estudianteId === null, "una pausa es un turno sin estudiante");

  // Una pausa y un turno sin emparejar llegan los dos con estudianteId nulo:
  // solo la hora los distingue. Este turno imita lo que deja `pegarHorario`
  // cuando una línea no encuentra a nadie del grupo: se guarda con su hora
  // auténtica y sin estudiante, no como una pausa.
  const sinEmparejar = await prisma.turno.create({
    data: { convocatoriaId: convocatoria.id, grupoId: grupo.id, dia: "Mercredi 20/05", hora: "09h00", orden: 3 },
  });
  afirmar(sinEmparejar.estudianteId === null, "el turno sin emparejar también queda sin estudiante");

  // esPausa contra filas reales, no contra objetos inventados.
  afirmar(esPausa(pausa) === true, "una pausa de verdad da esPausa true");
  afirmar(
    esPausa(sinEmparejar) === false,
    "un turno sin emparejar con su hora auténtica no es una pausa",
  );
  afirmar(esPausa(turno) === false, "un turno normal, con estudiante y hora, no es una pausa");

  // El filtro que usa la ruta del CSV: fuera las pausas, dentro los turnos
  // sin emparejar. Un `NOT: { estudianteId: null }` en Prisma se comería
  // los dos a la vez porque comparten `estudianteId: null`; solo `esPausa`
  // distingue uno del otro.
  const paraElCsv = await prisma.turno.findMany({
    where: { convocatoriaId: convocatoria.id },
    orderBy: { orden: "asc" },
    select: { id: true, estudianteId: true, hora: true },
  });
  const idsEnElCsv = paraElCsv.filter((t) => !esPausa(t)).map((t) => t.id);
  afirmar(
    idsEnElCsv.includes(pausa.id) === false,
    "la pausa no aparece en las filas del CSV",
  );
  afirmar(
    idsEnElCsv.includes(sinEmparejar.id) === true,
    "el turno sin emparejar sí aparece en el CSV, con sus celdas vacías",
  );

  // No se puede llamar a `pegarHorario` desde este script: exige una sesión
  // de Clerk que aquí no existe. Estos tres turnos se construyen a mano
  // imitando lo que la acción (ya corregida) deja en la base al pegar
  // «Mercredi 20/05 · 08h15» / «---» / «Mercredi 20/05 · 09h00»: la pausa
  // hereda el día de la fila anterior en vez de quedarse en "". Lo que se
  // comprueba es que, leídos en orden, ningún turno después de la pausa
  // repite la cabecera del día —la misma regla de agrupación que usa
  // `components/orales/horario.tsx`—.
  const delDia = await prisma.turno.findMany({
    where: { convocatoriaId: convocatoria.id },
    orderBy: { orden: "asc" },
    select: { dia: true },
  });
  afirmar(
    delDia.every((t, i) => i === 0 || t.dia === delDia[i - 1].dia),
    "tras una pausa en medio, los turnos siguientes conservan el día",
  );

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
    if (convocatoriaAjenaId) {
      await prisma.convocatoria.deleteMany({ where: { id: convocatoriaAjenaId } });
    }
    if (grupoId) await prisma.grupo.deleteMany({ where: { id: grupoId } });
    if (grupoAjenoId) await prisma.grupo.deleteMany({ where: { id: grupoAjenoId } });
    const userIds = [estudianteId, profesorId, profesorAjenoId].filter(
      (id): id is string => id !== undefined,
    );
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });
