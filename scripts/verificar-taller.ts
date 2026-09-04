/**
 * Verifica el esqueleto del taller: `crearExamen` monta dos secuencias sin
 * publicar, un paso "Tarea N" por tarea del mapa, un ejercicio vacío del
 * tipo y tamaño que el mapa dicta, y la fila de tarea del taller en `VACIA`.
 * Verifica también las páginas (registrar, reordenar, repartir, borrar,
 * asignar), el cuadernillo de claves (extraer texto de un PDF, recortar el
 * trozo que le toca a cada tarea), «Rellenar con IA» (el esquema de la
 * herramienta, el encargo, y guardar la respuesta validada contra el mapa y
 * la clave oficial, con dos fixtures fijos — sin llamar a la API real) y la
 * revisión (`tareaPorNumero`, guardar con re-validación y la clave contra lo
 * editado, y marcar revisada con sus guardas: vacía, avisos, ítems sin
 * respuesta, imágenes por subir, auditiva sin grabación), `descartarClaveOficial`
 * («la clave del cuadernillo está mal» quita el contraste y su aviso), que
 * `guardarTarea` sobre una tarea VACIA con datos válidos la deja RELLENADA
 * (rellenar a mano, sin pasar por la IA) y que se niega a reescribir un
 * ejercicio con trabajo real de un estudiante ya guardado (C-1 de la
 * revisión final, con una Asignacion y un PasoCompletado de prueba).
 * También verifica, sin tocar la base, `quitarPregunta`/`siguienteId`/
 * `quitarOpcion` del editor de opción (la seguridad del cloze frente a
 * "Quitar" + "Añadir pregunta", y que quitar una opción desplaza o vacía
 * `correctas` sin dejar menos de dos).
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-taller.ts
 */
import "dotenv/config";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@/lib/prisma";
import { crearExamen } from "@/lib/taller/esqueleto";
import { examenDe, recorridoDeUnExamen, tareaDe } from "@/lib/taller/consultas";
import { cuantosItems } from "@/lib/ejercicios/registro";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { asignarPaginas, borrarPagina, registrarPagina, reordenarPaginas, repartirEnOrden } from "@/lib/taller/paginas";
import { textoDePdf, trozoDeClaves } from "@/lib/taller/cuadernillo";
import { esquemaDeHerramienta, textoDelEncargo, type RespuestaIA } from "@/lib/taller/encargo-ia";
import { pedirTarea, SinClaveError } from "@/lib/taller/rellenar";
import { contrastarClave, guardarRelleno } from "@/lib/taller/guardar-relleno";
import { quitarOpcion, quitarPregunta, siguienteId, type DatosOpcion } from "@/components/taller/editor-tarea-opcion";
import fixtureBueno from "./fixtures/taller-respuesta-ia.json";
import fixtureMalo from "./fixtures/taller-respuesta-ia-mal.json";

// Sin clave de la API en todo el script: aquí se prueba `pedirTarea` (que
// tiene que rechazar sin llamar a nada) y `guardarRelleno` con fixtures
// fijos, nunca la API real.
delete process.env.ANTHROPIC_API_KEY;

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function contar() {
  // T1 de la revisión final: la afirmación de más abajo decía «la base
  // queda exactamente como se encontró» sin mirar `paso`, `bloque`,
  // `pasoEjercicio`, `paginaDeExamen` ni `tareaDeExamen`, que este script
  // también escribe. La limpieza ya los dejaba en su sitio (comprobado a
  // mano antes de este arreglo), pero la promesa del mensaje no tenía red.
  const [examen, recorrido, ejercicio, user, archivo, paso, bloque, pasoEjercicio, paginaDeExamen, tareaDeExamen, asignacion, pasoCompletado] = await Promise.all([
    prisma.examen.count(),
    prisma.recorrido.count(),
    prisma.ejercicio.count(),
    prisma.user.count(),
    prisma.archivo.count(),
    prisma.paso.count(),
    prisma.bloque.count(),
    prisma.pasoEjercicio.count(),
    prisma.paginaDeExamen.count(),
    prisma.tareaDeExamen.count(),
    // C-1 de la revisión final: el script monta una Asignacion y un
    // PasoCompletado para probar que guardarTarea se niega con trabajo ya
    // guardado — la disciplina de «la base vuelve a como estaba» tiene
    // que vigilar también estas dos tablas.
    prisma.asignacion.count(),
    prisma.pasoCompletado.count(),
  ]);
  return { examen, recorrido, ejercicio, user, archivo, paso, bloque, pasoEjercicio, paginaDeExamen, tareaDeExamen, asignacion, pasoCompletado };
}

/**
 * Un PDF mínimo con capa de texto, construido a mano: un objeto de página
 * con un solo `Tj`. Los desplazamientos del xref se calculan sobre la
 * marcha (no están escritos a fuego) para que la tabla sea correcta pase lo
 * que pase con el contenido — todo el texto es ASCII, así que la longitud
 * en caracteres coincide con la longitud en bytes.
 */
function pdfMinimo(texto: string): Uint8Array {
  const contenido = `BT /F1 12 Tf 72 720 Td (${texto}) Tj ET`;
  const objetos = [
    "",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0, 0, 0, 0, 0, 0];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = pdf.length;
    pdf += objetos[i];
  }
  const xrefOffset = pdf.length;
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

const marca = `verificar-taller-${process.pid}`;
let profeId: string | null = null;
let examenId: string | null = null;
let recorridoSueltoId: string | null = null;
const archivoIds: string[] = [];
// C-1 de la revisión final.
let estudianteId: string | null = null;
let asignacionId: string | null = null;
let pasoCompletadoId: string | null = null;

async function main() {
  // ─── Cloze: quitarPregunta y siguienteId (puras, sin base de datos) ────
  {
    const clozeDatos: DatosOpcion = {
      ejercicio: "opcion",
      consigna: "Rellena los huecos.",
      multiple: false,
      presentacion: "desplegable",
      texto: "A {{p1}} B {{p2}} C {{p3}}",
      preguntas: [
        { id: "p1", enunciado: "uno", opciones: ["a", "b"], correctas: [0] },
        { id: "p2", enunciado: "dos", opciones: ["a", "b"], correctas: [0] },
        { id: "p3", enunciado: "tres", opciones: ["a", "b"], correctas: [0] },
      ],
    };
    const trasQuitar = quitarPregunta(clozeDatos, 2);
    afirmar(trasQuitar.texto === "A {{p1}} B {{p2}} C ____", "quitarPregunta en cloze deja la marca de la pregunta borrada como ____");
    afirmar(trasQuitar.preguntas.length === 2, "quitarPregunta en cloze deja dos preguntas");
    afirmar(trasQuitar.preguntas.map((p) => p.id).join(",") === "p1,p2", "quitarPregunta en cloze quita justo la p3, no otra");

    // Una marca {{p3}} huérfana en el pasaje (a mano, sin pasar por
    // quitarPregunta) tiene que seguir bloqueando el id p3 aunque ninguna
    // pregunta lo use ya: si no, «Añadir pregunta» le daría a la pregunta
    // nueva el mismo hueco que tenía la que se acaba de borrar.
    const preguntasSinP3 = [
      { id: "p1", enunciado: "", correctas: [] as number[] },
      { id: "p2", enunciado: "", correctas: [] as number[] },
    ];
    afirmar(siguienteId(preguntasSinP3, "A {{p1}} B {{p2}} C {{p3}}") === "p4", "siguienteId salta la marca huérfana {{p3}} y devuelve p4, no p3");

    // I-3 de la revisión final: quitarOpcion desplaza (o vacía) `correctas`
    // cuando se quita una opción de una pregunta con opciones propias.
    const conTresOpciones: DatosOpcion = {
      ejercicio: "opcion", consigna: "c", multiple: false, presentacion: "botones",
      preguntas: [{ id: "p1", enunciado: "e", opciones: ["a", "b", "c"], correctas: [2] }],
    };
    const trasQuitarOpcionAnterior = quitarOpcion(conTresOpciones, 0, 0);
    afirmar(
      JSON.stringify(trasQuitarOpcionAnterior.preguntas[0].correctas) === JSON.stringify([1]),
      "quitarOpcion desplaza correctas cuando se quita una opción anterior a la correcta ([2] con la opción 0 fuera → [1])",
    );
    const trasQuitarLaCorrecta = quitarOpcion(conTresOpciones, 0, 2);
    afirmar(
      trasQuitarLaCorrecta.preguntas[0].correctas.length === 0,
      "quitarOpcion vacía correctas cuando se quita justo la opción marcada",
    );
    const conDosOpciones: DatosOpcion = {
      ejercicio: "opcion", consigna: "c", multiple: false, presentacion: "botones",
      preguntas: [{ id: "p1", enunciado: "e", opciones: ["a", "b"], correctas: [0] }],
    };
    afirmar(
      quitarOpcion(conDosOpciones, 0, 0).preguntas[0].opciones?.length === 2,
      "quitarOpcion no hace nada si eso dejaría menos de dos opciones",
    );
  }

  const profe = await prisma.user.create({
    data: { email: `${marca}@prueba.local`, firstName: "Profe", lastName: "de prueba", role: "PROFESOR" },
    select: { id: true },
  });
  profeId = profe.id;

  // ─── El esqueleto ───────────────────────────────────────────────────
  examenId = await crearExamen({
    titulo: `Examen ${marca}`, fuente: "prueba", numero: 99, bloque: 2, nivel: "A2_B1_ESCOLAR", autorId: profe.id,
  });
  const examen = await examenDe(examenId);
  afirmar(examen !== null, "el examen existe");
  afirmar(examen!.tareas.length === 8, "tiene ocho tareas");
  afirmar(examen!.tareas.every((t) => t.estado === "VACIA"), "las ocho nacen vacías");
  const recorridos = await prisma.recorrido.findMany({ where: { id: { in: [examen!.lecturaId, examen!.auditivaId] } }, include: { pasos: true } });
  afirmar(recorridos.length === 2 && recorridos.every((r) => !r.publicado && r.tipo === "PREPARACION_DELE" && r.examen === 99), "dos secuencias sin publicar, del examen 99");
  afirmar(recorridos.every((r) => r.pasos.length === 4), "cuatro pasos por secuencia");
  // Ligaduras que el esqueleto promete y que un futuro cambio podría romper
  // sin que nada más lo note: el bloque pedido es el `orden` de la
  // secuencia (no un `1` fijo), y cada secuencia lleva la destreza que le
  // toca, no la contraria.
  afirmar(recorridos.every((r) => r.orden === 2), "las dos secuencias llevan el bloque pedido (2) como orden");
  afirmar(recorridos.every((r) => r.nivel === "A2_B1_ESCOLAR"), "las dos secuencias son del nivel A2_B1_ESCOLAR");
  const lectura = recorridos.find((r) => r.id === examen!.lecturaId)!;
  const auditiva = recorridos.find((r) => r.id === examen!.auditivaId)!;
  afirmar(lectura.destreza === "CE", "la secuencia de lectura es CE");
  afirmar(auditiva.destreza === "CO", "la secuencia auditiva es CO");
  for (const t of examen!.tareas) {
    const completa = await tareaDe(t.id);
    const delMapa = tareaDelMapa("A2_B1_ESCOLAR", t.prueba, t.numero)!;
    afirmar(completa !== null && completa.paso.titulo === `Tarea ${t.numero}`, `${t.prueba} ${t.numero}: el paso se llama Tarea ${t.numero}`);
    // El esqueleto no pasa el esquema (campos en blanco), así que se cuenta a mano.
    const d = completa!.ejercicio.datos as { preguntas?: unknown[]; parejas?: unknown[] };
    const lista = delMapa.motor === "relacionar" ? d.parejas : d.preguntas;
    afirmar(Array.isArray(lista) && lista.length === delMapa.items, `${t.prueba} ${t.numero}: ${delMapa.items} ítems del mapa`);
    afirmar(cuantosItems(completa!.ejercicio.datos) === null, `${t.prueba} ${t.numero}: el esqueleto todavía no valida (está en blanco)`);
    // Un ejercicio del esqueleto nace sin publicar: es un andamio para
    // rellenar, no algo listo para que el estudiante lo vea.
    afirmar(completa!.ejercicio.publicado === false, `${t.prueba} ${t.numero}: el ejercicio nace sin publicar`);
  }

  // ─── C-2 de la revisión final: recorridoDeUnExamen ─────────────────────
  // `Examen.lecturaId`/`auditivaId` no son claves ajenas, así que
  // `borrarRecorrido` y la ficha de la secuencia necesitan esta consulta
  // para saber si un `Recorrido` es, de hecho, el de un examen del taller.
  afirmar((await recorridoDeUnExamen(lectura.id)) === examenId, "recorridoDeUnExamen devuelve el examen para la lectura del esqueleto");
  afirmar((await recorridoDeUnExamen(auditiva.id)) === examenId, "recorridoDeUnExamen devuelve el examen para la auditiva del esqueleto");
  const recorridoSuelto = await prisma.recorrido.create({
    data: { titulo: `Recorrido suelto ${marca}`, nivel: "A2_B1_ESCOLAR", orden: 1 },
    select: { id: true },
  });
  recorridoSueltoId = recorridoSuelto.id;
  afirmar((await recorridoDeUnExamen(recorridoSuelto.id)) === null, "recorridoDeUnExamen devuelve null para un recorrido que no es de ningún examen");

  // ─── Páginas ────────────────────────────────────────────────────────
  // Sin páginas todavía (k=0 en cada prueba): repartirEnOrden no debe
  // reventar con un array vacío, y las ocho tareas se quedan sin páginas.
  await repartirEnOrden(examenId);
  const tareasSinPaginas = await prisma.tareaDeExamen.findMany({ where: { examenId }, select: { paginaIds: true } });
  afirmar(tareasSinPaginas.every((t) => t.paginaIds.length === 0), "sin páginas (k=0), el reparto deja las ocho tareas vacías");

  async function crearArchivoDePagina(): Promise<string> {
    const archivo = await prisma.archivo.create({
      data: { nombre: "pagina.jpg", tipo: "image/jpeg", tamano: 4, datos: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), subidoPorId: profe.id },
      select: { id: true },
    });
    archivoIds.push(archivo.id);
    return archivo.id;
  }

  async function paginasEnOrden() {
    return prisma.paginaDeExamen.findMany({ where: { examenId: examenId! }, orderBy: { orden: "asc" }, select: { id: true, archivoId: true } });
  }

  const [a1, a2, a3] = [await crearArchivoDePagina(), await crearArchivoDePagina(), await crearArchivoDePagina()];
  await registrarPagina(examenId, a1);
  await registrarPagina(examenId, a2);
  await registrarPagina(examenId, a3);

  let paginas = await paginasEnOrden();
  afirmar(paginas.length === 3, "las tres páginas quedaron registradas");
  afirmar(paginas.map((p) => p.archivoId).join(",") === [a1, a2, a3].join(","), "el orden inicial es 1-2-3");

  const [p1, p2, p3] = paginas.map((p) => p.id);
  await reordenarPaginas(examenId, [p3, p1, p2]);
  paginas = await paginasEnOrden();
  afirmar(paginas.map((p) => p.id).join(",") === [p3, p1, p2].join(","), "reordenar deja las páginas en 3-1-2");

  for (let i = 0; i < 5; i++) await registrarPagina(examenId, await crearArchivoDePagina());
  paginas = await paginasEnOrden();
  afirmar(paginas.length === 8, "las ocho páginas están registradas");
  const idsEnOrden = paginas.map((p) => p.id);

  await repartirEnOrden(examenId);
  const tareasTrasReparto = await prisma.tareaDeExamen.findMany({ where: { examenId }, orderBy: [{ prueba: "asc" }, { numero: "asc" }] });
  const porClave = new Map(tareasTrasReparto.map((t) => [`${t.prueba}${t.numero}`, t.paginaIds]));
  const comoLista = (v: string[] | undefined) => JSON.stringify(v ?? []);
  // 8 páginas en total → 4 por prueba (k=4): con 4 páginas para 4 tareas, a
  // cada una le toca exactamente una, sin solape (4 es múltiplo de 4).
  afirmar(comoLista(porClave.get("CE1")) === comoLista(idsEnOrden.slice(0, 1)), "8 páginas (k=4), CE1: página 1");
  afirmar(comoLista(porClave.get("CE2")) === comoLista(idsEnOrden.slice(1, 2)), "8 páginas (k=4), CE2: página 2");
  afirmar(comoLista(porClave.get("CE3")) === comoLista(idsEnOrden.slice(2, 3)), "8 páginas (k=4), CE3: página 3");
  afirmar(comoLista(porClave.get("CE4")) === comoLista(idsEnOrden.slice(3, 4)), "8 páginas (k=4), CE4: página 4");
  afirmar(comoLista(porClave.get("CO1")) === comoLista(idsEnOrden.slice(4, 5)), "8 páginas (k=4), CO1: página 5");
  afirmar(comoLista(porClave.get("CO2")) === comoLista(idsEnOrden.slice(5, 6)), "8 páginas (k=4), CO2: página 6");
  afirmar(comoLista(porClave.get("CO3")) === comoLista(idsEnOrden.slice(6, 7)), "8 páginas (k=4), CO3: página 7");
  afirmar(comoLista(porClave.get("CO4")) === comoLista(idsEnOrden.slice(7, 8)), "8 páginas (k=4), CO4: página 8");

  // `asignarPaginas` no la ejercita `repartirEnOrden` (esa escribe con
  // Prisma directamente): se prueba aparte, con una lista desordenada que
  // además trae un id que no existe.
  const tareaCE2 = tareasTrasReparto.find((t) => t.prueba === "CE" && t.numero === 2)!;
  await asignarPaginas(tareaCE2.id, [idsEnOrden[3], "id-que-no-existe", idsEnOrden[2]]);
  const tareaCE2Tras = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaCE2.id } });
  afirmar(
    comoLista(tareaCE2Tras.paginaIds) === comoLista([idsEnOrden[2], idsEnOrden[3]]),
    "asignarPaginas ordena por página y descarta los ids que no existen",
  );

  const tareaCE1 = tareasTrasReparto.find((t) => t.prueba === "CE" && t.numero === 1)!;
  await borrarPagina(idsEnOrden[0]);
  const tareaCE1Tras = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaCE1.id } });
  afirmar(!tareaCE1Tras.paginaIds.includes(idsEnOrden[0]), "borrar una página asignada la quita de paginaIds");
  const paginaBorrada = await prisma.paginaDeExamen.findUnique({ where: { id: idsEnOrden[0] } });
  afirmar(paginaBorrada === null, "borrarPagina también borra la fila de la página");

  // ─── C-1 de la revisión final: registrarPagina y borrarPagina protegen el Archivo ──
  // Un archivo privado (la grabación de un alumno) no puede convertirse en
  // página de examen.
  const archivoPrivado = await prisma.archivo.create({
    data: { nombre: "grabacion.webm", tipo: "audio/webm", tamano: 4, datos: Buffer.from([0, 1, 2, 3]), privado: true, subidoPorId: profe.id },
    select: { id: true },
  });
  archivoIds.push(archivoPrivado.id);
  const paginasAntesDePrivado = (await paginasEnOrden()).length;
  const registradaPrivado = await registrarPagina(examenId, archivoPrivado.id);
  afirmar(registradaPrivado === false, "registrarPagina rechaza un archivo privado");
  afirmar((await paginasEnOrden()).length === paginasAntesDePrivado, "registrarPagina con un archivo privado no crea página");

  // Un archivo que no es una imagen que la IA sepa leer (audio, aquí) tampoco vale.
  const archivoAudio = await prisma.archivo.create({
    data: { nombre: "audio.mp4", tipo: "audio/mp4", tamano: 4, datos: Buffer.from([0, 1, 2, 3]), subidoPorId: profe.id },
    select: { id: true },
  });
  archivoIds.push(archivoAudio.id);
  const paginasAntesDeAudio = (await paginasEnOrden()).length;
  const registradaAudio = await registrarPagina(examenId, archivoAudio.id);
  afirmar(registradaAudio === false, "registrarPagina rechaza un archivo que no es una imagen (audio/mp4)");
  afirmar((await paginasEnOrden()).length === paginasAntesDeAudio, "registrarPagina con audio/mp4 no crea página");

  // `borrarPagina` no se lleva el Archivo si es privado, aunque nada más lo
  // referencie: se simula la página a mano con Prisma directamente, porque
  // `registrarPagina` ya no dejaría llegar hasta aquí un archivo privado.
  const archivoPrivado2 = await prisma.archivo.create({
    data: { nombre: "otra-grabacion.webm", tipo: "audio/webm", tamano: 4, datos: Buffer.from([4, 5, 6, 7]), privado: true, subidoPorId: profe.id },
    select: { id: true },
  });
  archivoIds.push(archivoPrivado2.id);
  const paginaConArchivoPrivado = await prisma.paginaDeExamen.create({
    data: { examenId, archivoId: archivoPrivado2.id, orden: 999 },
    select: { id: true },
  });
  await borrarPagina(paginaConArchivoPrivado.id);
  const archivoPrivado2TrasBorrar = await prisma.archivo.findUnique({ where: { id: archivoPrivado2.id } });
  afirmar(archivoPrivado2TrasBorrar !== null, "borrarPagina no borra el Archivo si es privado");
  const paginaPrivadaTrasBorrar = await prisma.paginaDeExamen.findUnique({ where: { id: paginaConArchivoPrivado.id } });
  afirmar(paginaPrivadaTrasBorrar === null, "borrarPagina sí borra la fila de PaginaDeExamen aunque el Archivo sea privado");

  // Vacía las páginas actuales del examen (con `borrarPagina`, para que la
  // limpieza de tarea y de archivo quede hecha) y las sustituye por `n`
  // páginas nuevas, en orden. Sirve para probar `repartirEnOrden` con
  // varios tamaños de prueba sin arrastrar el estado de la prueba anterior.
  async function reiniciarPaginas(n: number): Promise<string[]> {
    const actuales = await paginasEnOrden();
    for (const p of actuales) await borrarPagina(p.id);
    for (let i = 0; i < n; i++) await registrarPagina(examenId!, await crearArchivoDePagina());
    return (await paginasEnOrden()).map((p) => p.id);
  }

  async function paginaIdsPorTarea(): Promise<Map<string, string[]>> {
    const tareas = await prisma.tareaDeExamen.findMany({ where: { examenId: examenId! }, orderBy: [{ prueba: "asc" }, { numero: "asc" }] });
    return new Map(tareas.map((t) => [`${t.prueba}${t.numero}`, t.paginaIds]));
  }

  // 16 páginas en total → 8 por prueba (k=8): múltiplo de 4, así que de
  // nuevo sin solape, dos páginas limpias por tarea. Es el caso «de manual»
  // de la proporción: [1,2],[3,4],[5,6],[7,8].
  const ids16 = await reiniciarPaginas(16);
  await repartirEnOrden(examenId);
  const porTarea16 = await paginaIdsPorTarea();
  for (const [prueba, desde] of [["CE", 0], ["CO", 8]] as const) {
    const propias = ids16.slice(desde, desde + 8);
    afirmar(comoLista(porTarea16.get(`${prueba}1`)) === comoLista(propias.slice(0, 2)), `16 páginas (k=8), ${prueba}1: páginas 1-2`);
    afirmar(comoLista(porTarea16.get(`${prueba}2`)) === comoLista(propias.slice(2, 4)), `16 páginas (k=8), ${prueba}2: páginas 3-4`);
    afirmar(comoLista(porTarea16.get(`${prueba}3`)) === comoLista(propias.slice(4, 6)), `16 páginas (k=8), ${prueba}3: páginas 5-6`);
    afirmar(comoLista(porTarea16.get(`${prueba}4`)) === comoLista(propias.slice(6, 8)), `16 páginas (k=8), ${prueba}4: páginas 7-8`);
  }

  // 14 páginas en total → 7 por prueba. Con `k` no múltiplo de 4, el
  // reparto proporcional solapa una página entre tareas vecinas (ver el
  // comentario de `repartirEnOrden`): la tarea 2 se lleva la 2ª-3ª-4ª
  // página y la tarea 3 se lleva la 4ª-5ª-6ª, compartiendo la 4ª.
  const ids14 = await reiniciarPaginas(14);
  await repartirEnOrden(examenId);
  const porTarea14 = await paginaIdsPorTarea();
  for (const [prueba, desde] of [["CE", 0], ["CO", 7]] as const) {
    const propias = ids14.slice(desde, desde + 7);
    afirmar(comoLista(porTarea14.get(`${prueba}1`)) === comoLista(propias.slice(0, 2)), `14 páginas (k=7), ${prueba}1: páginas 1-2`);
    afirmar(comoLista(porTarea14.get(`${prueba}2`)) === comoLista(propias.slice(1, 4)), `14 páginas (k=7), ${prueba}2: páginas 2-3-4 (solapa la 2 con ${prueba}1)`);
    afirmar(comoLista(porTarea14.get(`${prueba}3`)) === comoLista(propias.slice(3, 6)), `14 páginas (k=7), ${prueba}3: páginas 4-5-6 (solapa la 4 con ${prueba}2)`);
    afirmar(comoLista(porTarea14.get(`${prueba}4`)) === comoLista(propias.slice(5, 7)), `14 páginas (k=7), ${prueba}4: páginas 6-7 (solapa la 6 con ${prueba}3)`);
  }

  // 6 páginas en total → 3 por prueba.
  const ids6 = await reiniciarPaginas(6);
  await repartirEnOrden(examenId);
  const porTarea6 = await paginaIdsPorTarea();
  for (const [prueba, desde] of [["CE", 0], ["CO", 3]] as const) {
    const propias = ids6.slice(desde, desde + 3);
    afirmar(comoLista(porTarea6.get(`${prueba}1`)) === comoLista(propias.slice(0, 1)), `6 páginas (k=3), ${prueba}1: página 1`);
    afirmar(comoLista(porTarea6.get(`${prueba}2`)) === comoLista(propias.slice(0, 2)), `6 páginas (k=3), ${prueba}2: páginas 1-2`);
    afirmar(comoLista(porTarea6.get(`${prueba}3`)) === comoLista(propias.slice(1, 3)), `6 páginas (k=3), ${prueba}3: páginas 2-3`);
    afirmar(comoLista(porTarea6.get(`${prueba}4`)) === comoLista(propias.slice(2, 3)), `6 páginas (k=3), ${prueba}4: página 3`);
  }

  // ─── Cuadernillo ────────────────────────────────────────────────────
  const textoSintetico = "EXAMEN 1 – … EXAMEN 2 – PRUEBA … SOLUCIONES A B C … EXAMEN 3 –";
  const trozo2 = trozoDeClaves(textoSintetico, 2, "CE", 1);
  afirmar(trozo2.texto.includes("EXAMEN 2"), "el trozo del examen 2 incluye su rótulo");
  afirmar(trozo2.texto.includes("SOLUCIONES"), "el trozo del examen 2 incluye las soluciones");
  afirmar(!trozo2.texto.includes("EXAMEN 3 –"), "el trozo del examen 2 no se cuela en el examen 3");
  afirmar(trozo2.recortado === false, "el trozo del examen 2 no viene marcado como recortado");

  const trozo7 = trozoDeClaves(textoSintetico, 7, "CE", 1);
  afirmar(trozo7.recortado === true, "un examen que no aparece en el texto sale recortado");

  const textoDelPdf = await textoDePdf(pdfMinimo("Hola taller"));
  afirmar(textoDelPdf.includes("Hola taller"), "textoDePdf lee el texto de un PDF mínimo escrito a mano");

  // ─── Rellenar con IA ────────────────────────────────────────────────
  // CE tarea 3 del examen ya creado: `opcion`, 6 ítems, 3 opciones cada
  // uno — la misma forma que los dos fixtures.
  const tareaCE3 = examen!.tareas.find((t) => t.prueba === "CE" && t.numero === 3)!;
  const bueno = fixtureBueno as unknown as RespuestaIA;
  const malo = fixtureMalo as unknown as RespuestaIA;

  // B-6 de la revisión: `guardarRelleno` borra solo `tipo: "TEXTO"`, pero
  // nada probaba que un `Bloque AUDIO` ya colgado del mismo paso —lo que va
  // a colgar la sesión C— sobreviviera. Se crea a mano antes del fixture
  // bueno y se comprueba que sigue ahí después.
  const audioAntes = await prisma.bloque.create({
    data: { pasoId: tareaCE3.pasoId, tipo: "AUDIO", url: "https://ejemplo.invalido/audio.mp3", orden: 2 },
  });

  const resultadoBueno = await guardarRelleno(tareaCE3.id, bueno);
  afirmar(resultadoBueno.ok === true, "guardarRelleno con el fixture bueno: ok");
  afirmar(resultadoBueno.ok === true && resultadoBueno.avisos.length === 0, "el fixture bueno no deja avisos");
  const trasBueno = await tareaDe(tareaCE3.id);
  afirmar(trasBueno!.estado === "RELLENADA", "tras el fixture bueno, la tarea queda RELLENADA");
  afirmar(trasBueno!.rellenadaEl !== null, "tras el fixture bueno, rellenadaEl queda escrito");
  afirmar(isDeepStrictEqual(trasBueno!.ejercicio.datos, bueno.ejercicio), "Ejercicio.datos queda igual al fixture bueno");
  const bloquesTrasBueno = await prisma.bloque.findMany({ where: { pasoId: trasBueno!.pasoId } });
  afirmar(bloquesTrasBueno.filter((b) => b.tipo === "TEXTO").length === 1, "el fixture bueno deja un Bloque TEXTO en el paso");
  afirmar(bloquesTrasBueno.some((b) => b.id === audioAntes.id), "el fixture bueno no borra el Bloque AUDIO que ya estaba en el paso");
  afirmar(cuantosItems(trasBueno!.ejercicio.datos) === 6, "cuantosItems da 6 con el fixture bueno");

  const resultadoMalo = await guardarRelleno(tareaCE3.id, malo);
  afirmar(resultadoMalo.ok === true, "guardarRelleno con el fixture malo también guarda (solo avisa)");
  afirmar(resultadoMalo.ok === true && resultadoMalo.avisos.length === 2, "el fixture malo deja dos avisos: ítems y clave oficial");
  const trasMalo = await tareaDe(tareaCE3.id);
  afirmar(((trasMalo!.dudas as unknown[] | null) ?? []).length === 1, "la duda del fixture malo queda guardada");

  const resultadoRoto = await guardarRelleno(tareaCE3.id, { ...bueno, ejercicio: { ejercicio: "opcion" } });
  afirmar(resultadoRoto.ok === false, "un `ejercicio` que no cumple el esquema no se guarda");
  const trasRoto = await tareaDe(tareaCE3.id);
  afirmar(trasRoto!.estado === "RELLENADA", "tras el intento roto, la tarea sigue RELLENADA (del fixture malo)");
  afirmar(isDeepStrictEqual(trasRoto!.ejercicio.datos, malo.ejercicio), "Ejercicio.datos no cambia con un `ejercicio` que no vale");

  // B-3 de la revisión: `contrastarClave` no avisaba cuando la clave
  // oficial no tenía con qué contrastar (ids que no casan, o `relacionar`
  // sin `textosConLetra`) — devolvía `[]` en silencio.
  const claveConIdsQueNoCasan: RespuestaIA = {
    ...bueno,
    claveOficial: Object.fromEntries(Object.entries(bueno.claveOficial!).map(([id, letra]) => [id.replace("p", ""), letra])),
  };
  afirmar(
    contrastarClave(claveConIdsQueNoCasan, "opcion").some((a) => a.includes("no se pudo contrastar")),
    "contrastarClave avisa cuando ningún id de la clave oficial casa con una pregunta",
  );

  const relacionarSinTextosConLetra: RespuestaIA = {
    bloque: null,
    ejercicio: {
      ejercicio: "relacionar",
      consigna: "Relaciona.",
      parejas: [{ id: "r1", izquierda: "Le gusta el fútbol.", derecha: "El deporte en el colegio" }],
      sobrantes: [],
      escuchas: 2,
    },
    textosConLetra: [],
    imagenesPedidas: [],
    dudas: [],
    claveOficial: { r1: "A" },
  };
  afirmar(
    contrastarClave(relacionarSinTextosConLetra, "relacionar").some((a) => a.includes("no se pudo contrastar")),
    "contrastarClave avisa en relacionar sin textosConLetra, aunque el id sí case",
  );

  // ─── La revisión ────────────────────────────────────────────────────
  const { descartarClaveOficial, guardarTarea, marcarRevisada, motivosParaNoRevisar, quitarImagenPedida } = await import("@/lib/taller/revision");
  const { tareaPorNumero } = await import("@/lib/taller/consultas");

  const porNumero = await tareaPorNumero(examenId!, "CE", 3);
  afirmar(porNumero !== null && porNumero.id === tareaCE3.id, "tareaPorNumero encuentra CE 3");
  afirmar((await tareaPorNumero(examenId!, "CE", 9)) === null, "tareaPorNumero da null para una tarea que no existe");

  // El fixture malo dejó su propia `claveOficial` colgada de la tarea (con
  // `p1` distinta de la del fixture bueno: así es como `guardarRelleno` deja
  // dos avisos con el fixture malo). `guardarTarea` no toca `claveOficial`
  // —no es su trabajo, la clave la trae la IA o el cuadernillo—, así que sin
  // este remozamiento el aviso de esa clave ajena perseguiría a todas las
  // pruebas de esta sección aunque no sea lo que están probando. Se
  // refresca con `guardarRelleno` (no con un `update` a mano) porque es el
  // mismo camino que usaría un profesor que vuelve a rellenar con IA.
  await guardarRelleno(tareaCE3.id, bueno);

  // Guardar el fixture bueno a mano: los avisos del malo desaparecen.
  const guardado = await guardarTarea(tareaCE3.id, bueno.ejercicio, "Un texto corregido por el profesor.");
  afirmar(guardado.ok === true && guardado.avisos.length === 0, "guardarTarea con datos buenos deja cero avisos");
  const trasGuardar = await tareaDe(tareaCE3.id);
  afirmar((trasGuardar!.avisos as string[]).length === 0, "los avisos guardados se recalculan al guardar");
  afirmar(trasGuardar!.paso.bloques.filter((b) => b.tipo === "TEXTO").length === 1 && trasGuardar!.paso.bloques.some((b) => b.texto === "Un texto corregido por el profesor."), "guardarTarea sustituye el bloque TEXTO");
  afirmar(trasGuardar!.paso.bloques.some((b) => b.tipo === "AUDIO"), "guardarTarea no toca el bloque AUDIO");

  const roto = await guardarTarea(tareaCE3.id, { ejercicio: "opcion" }, null);
  afirmar(roto.ok === false, "guardarTarea rechaza datos que no validan");
  afirmar(isDeepStrictEqual((await tareaDe(tareaCE3.id))!.ejercicio.datos, bueno.ejercicio), "y no cambia nada al rechazar");

  // La clave oficial se sigue contrastando en opción tras editar.
  const ejercicioBueno = bueno.ejercicio as { preguntas: { correctas: number[] }[] };
  const conCorrectaCambiada = { ...ejercicioBueno, preguntas: ejercicioBueno.preguntas.map((p, i) => (i === 0 ? { ...p, correctas: [(p.correctas[0] + 1) % 3] } : p)) };
  const contrastado = await guardarTarea(tareaCE3.id, conCorrectaCambiada, null);
  afirmar(contrastado.ok === true && contrastado.avisos.some((a) => a.includes("clave oficial")), "cambiar una correcta contra la clave oficial deja aviso");

  // Encargo tras la revisión de la Task 1: «la clave del cuadernillo está
  // mal» — el profesor la descarta y el aviso de contraste desaparece.
  const descartada = await descartarClaveOficial(tareaCE3.id);
  afirmar(descartada.ok === true, "descartarClaveOficial: ok");
  const trasDescartar = await tareaDe(tareaCE3.id);
  afirmar(trasDescartar!.claveOficial === null, "descartarClaveOficial deja claveOficial en null");
  afirmar(!(trasDescartar!.avisos as string[]).some((a) => a.includes("clave oficial")), "descartarClaveOficial quita el aviso de la clave oficial");

  await guardarTarea(tareaCE3.id, bueno.ejercicio, "Texto.");

  // Marcar revisada: las guardas.
  let motivos = motivosParaNoRevisar((await tareaDe(tareaCE3.id))!);
  afirmar(motivos.length === 0, "CE 3 con datos buenos, sin avisos y con bloque se puede revisar");
  const tareaCE3Completa = (await tareaDe(tareaCE3.id))!;
  afirmar(motivosParaNoRevisar({ ...tareaCE3Completa, avisos: ["x"] }).some((m) => m.includes("aviso")), "un aviso impide revisar");
  const tareaCO1 = examen!.tareas.find((t) => t.prueba === "CO" && t.numero === 1)!;
  motivos = motivosParaNoRevisar((await tareaDe(tareaCO1.id))!);
  afirmar(motivos.some((m) => m.includes("vacía")), "una tarea vacía no se puede revisar");
  afirmar(motivos.some((m) => m.includes("grabación")), "una auditiva sin AUDIO no se puede revisar");

  await prisma.tareaDeExamen.update({ where: { id: tareaCE3.id }, data: { imagenesPedidas: [{ pregunta: "p1", opcion: 0, para: "una foto", archivoId: null }] } });
  motivos = motivosParaNoRevisar((await tareaDe(tareaCE3.id))!);
  afirmar(motivos.some((m) => m.includes("imagen")), "una imagen pedida sin subir impide revisar");
  await quitarImagenPedida(tareaCE3.id, 0);
  afirmar(motivosParaNoRevisar((await tareaDe(tareaCE3.id))!).length === 0, "quitar la imagen pedida desbloquea la revisión");

  const revisada = await marcarRevisada(tareaCE3.id);
  afirmar(revisada.ok === true && (await tareaDe(tareaCE3.id))!.estado === "REVISADA", "marcarRevisada deja la tarea REVISADA");
  const negada = await marcarRevisada(tareaCO1.id);
  afirmar(negada.ok === false && negada.motivos.length >= 2, "marcarRevisada se niega con motivos");

  const reeditada = await guardarTarea(tareaCE3.id, bueno.ejercicio, "Otro texto.");
  afirmar(reeditada.ok === true && reeditada.volvioARellenada && (await tareaDe(tareaCE3.id))!.estado === "RELLENADA", "editar una revisada la devuelve a RELLENADA");

  // C-1 de la revisión final: guardarTarea no debe reescribir un ejercicio
  // que un estudiante ya respondió — la respuesta guardada apunta a los
  // ids de las preguntas actuales, y cambiarlos por dentro la dejaría
  // apuntando a ids que ya no significan lo mismo. Se monta el mínimo que
  // hace falta para que `tieneTrabajo` (lib/recursos.ts, vía
  // `puedeEditarse`) vea trabajo real: un estudiante, una Asignacion sobre
  // la lectura del examen (el recorrido de CE) y un PasoCompletado con
  // `respuestas` sobre el paso de CE 3.
  const estudiante = await prisma.user.create({
    data: { email: `${marca}-estudiante@prueba.local`, firstName: "Est", lastName: "de prueba", role: "STUDENT" },
    select: { id: true },
  });
  estudianteId = estudiante.id;
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profe.id, recorridoId: examen!.lecturaId },
  });
  asignacionId = asignacion.id;
  const completado = await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: tareaCE3.pasoId, respuestas: { p1: "0" } },
  });
  pasoCompletadoId = completado.id;

  const bloqueadaPorTrabajo = await guardarTarea(tareaCE3.id, bueno.ejercicio, "Con trabajo del estudiante ya guardado.");
  afirmar(bloqueadaPorTrabajo.ok === false, "guardarTarea se niega si ya hay trabajo del estudiante guardado");
  afirmar(
    bloqueadaPorTrabajo.ok === false && bloqueadaPorTrabajo.error.includes("Alguien ya lo respondió"),
    "y da el motivo de puedeEditarse, no uno genérico",
  );
  afirmar(isDeepStrictEqual((await tareaDe(tareaCE3.id))!.ejercicio.datos, bueno.ejercicio), "y no cambia nada al negarse");

  await prisma.pasoCompletado.delete({ where: { id: completado.id } });
  pasoCompletadoId = null;
  const trasBorrarCompletado = await guardarTarea(tareaCE3.id, bueno.ejercicio, "Sin trabajo del estudiante ya.");
  afirmar(trasBorrarCompletado.ok === true, "y vuelve a guardar en cuanto se borra ese PasoCompletado");

  await prisma.asignacion.delete({ where: { id: asignacion.id } });
  asignacionId = null;
  await prisma.user.delete({ where: { id: estudiante.id } });
  estudianteId = null;

  // Encargo tras la revisión de la Task 1: rellenar a mano una tarea VACIA
  // (sin pasar por «Rellenar con IA») también la deja lista para revisar.
  // CO 1 del mapa: `opcion`, listaComun false, 7 ítems de 3 opciones.
  const datosCO1Validos: DatosOpcion = {
    ejercicio: "opcion",
    consigna: "Escucha y responde.",
    multiple: false,
    presentacion: "botones",
    escuchas: 2,
    preguntas: Array.from({ length: 7 }, (_, i) => ({
      id: `p${i + 1}`,
      enunciado: `Pregunta ${i + 1}`,
      opciones: ["A", "B", "C"],
      correctas: [0],
    })),
  };
  const tareaCO1AntesDeRellenar = await tareaDe(tareaCO1.id);
  afirmar(tareaCO1AntesDeRellenar!.estado === "VACIA", "CO 1 sigue VACIA antes de rellenarla a mano");
  const rellenadaAMano = await guardarTarea(tareaCO1.id, datosCO1Validos, null);
  afirmar(rellenadaAMano.ok === true, "guardarTarea sobre CO 1 (VACIA) con datos válidos: ok");
  const tareaCO1TrasRellenar = await tareaDe(tareaCO1.id);
  afirmar(tareaCO1TrasRellenar!.estado === "RELLENADA", "guardarTarea sobre una tarea VACIA con datos válidos la deja RELLENADA");
  afirmar(tareaCO1TrasRellenar!.rellenadaEl !== null, "y le pone rellenadaEl");

  let sinClave: unknown = null;
  try {
    await pedirTarea({
      tarea: tareaDelMapa("A2_B1_ESCOLAR", "CE", 3)!,
      prueba: "CE",
      numeroExamen: examen!.numero,
      paginas: [],
      claves: null,
    });
  } catch (e) {
    sinClave = e;
  }
  afirmar(sinClave instanceof SinClaveError, "pedirTarea sin ANTHROPIC_API_KEY rechaza con SinClaveError, sin llamar a la API");

  const esquemaCE1 = esquemaDeHerramienta(tareaDelMapa("A2_B1_ESCOLAR", "CE", 1)!) as { properties: { ejercicio?: { type?: string; properties?: Record<string, unknown> } }; required?: string[] };
  afirmar(esquemaCE1.properties.ejercicio?.type === "object", "esquemaDeHerramienta de CE1: `properties.ejercicio` es `type: object`");
  afirmar(!!esquemaCE1.required?.includes("ejercicio"), "esquemaDeHerramienta de CE1: `required` incluye `ejercicio`");
  // B-1 de la revisión: `z.toJSONSchema` mete "$schema" en la raíz de lo
  // que genera, y ese objeto se empotraba tal cual como subesquema de
  // `ejercicio` — JSON Schema 2020-12 solo admite "$schema" en la raíz de
  // un recurso, y el SDK no lo detecta.
  afirmar(!JSON.stringify(esquemaCE1).includes('"$schema"'), "esquemaDeHerramienta de CE1: sin \"$schema\" anidado");
  afirmar(Object.keys(esquemaCE1.properties.ejercicio?.properties ?? {}).length > 0, "esquemaDeHerramienta de CE1: `properties.ejercicio.properties` no está vacío");

  const esquemaCE4 = esquemaDeHerramienta(tareaDelMapa("A2_B1_ESCOLAR", "CE", 4)!) as { properties: { ejercicio?: { type?: string; properties?: Record<string, unknown> } }; required?: string[] };
  afirmar(esquemaCE4.properties.ejercicio?.type === "object", "esquemaDeHerramienta de CE4: `properties.ejercicio` es `type: object`");
  afirmar(!!esquemaCE4.required?.includes("ejercicio"), "esquemaDeHerramienta de CE4: `required` incluye `ejercicio`");
  afirmar(!JSON.stringify(esquemaCE4).includes('"$schema"'), "esquemaDeHerramienta de CE4: sin \"$schema\" anidado");
  afirmar(Object.keys(esquemaCE4.properties.ejercicio?.properties ?? {}).length > 0, "esquemaDeHerramienta de CE4: `properties.ejercicio.properties` no está vacío");

  const textoCE4 = textoDelEncargo(tareaDelMapa("A2_B1_ESCOLAR", "CE", 4)!, "CE", examen!.numero, null);
  afirmar(textoCE4.includes("{{p1}}"), "textoDelEncargo de CE4 (cloze) menciona la marca {{p1}}");

  // C-3 de la revisión final: las dos afirmaciones que había aquí antes
  // («menciona imagenesPedidas» y «menciona null») comprobaban frases
  // incondicionales del encargo — salían igual en las ocho tareas, CE
  // incluidas — así que no podían ponerse en rojo con ningún cambio real
  // del comportamiento que decían vigilar. Estas sí dependen de `prueba`:
  // el párrafo del estímulo es distinto en CE y en CO.
  const textoCE3 = textoDelEncargo(tareaDelMapa("A2_B1_ESCOLAR", "CE", 3)!, "CE", examen!.numero, null);
  const textoCO1 = textoDelEncargo(tareaDelMapa("A2_B1_ESCOLAR", "CO", 1)!, "CO", examen!.numero, null);
  afirmar(textoCO1.includes("no hay estímulo escrito"), "textoDelEncargo de CO1 dice que no hay estímulo escrito");
  afirmar(!textoCE3.includes("no hay estímulo escrito"), "textoDelEncargo de CE3 no dice que no hay estímulo escrito");
  afirmar(textoCE3.includes("va en `bloque`"), "textoDelEncargo de CE3 dice que el estímulo va en `bloque`");
  afirmar(!textoCO1.includes("va en `bloque`"), "textoDelEncargo de CO1 no dice que el estímulo va en `bloque`");

  // B-2 de la revisión: el texto crudo del cuadernillo (sin la cabecera por
  // tarea) tiene que salir letra a letra igual sea cual sea la tarea o la
  // prueba, para poder ir marcado como el bloque cacheado de `system`.
  const textoSinteticoParaClaves = "EXAMEN 5 – … contenido del examen … SOLUCIONES A B C … EXAMEN 6 –";
  const clavesCE1 = trozoDeClaves(textoSinteticoParaClaves, 5, "CE", 1);
  const clavesCO4 = trozoDeClaves(textoSinteticoParaClaves, 5, "CO", 4);
  afirmar(clavesCE1.texto === clavesCO4.texto, "trozoDeClaves: el texto crudo es idéntico entre tareas del mismo examen");
  afirmar(clavesCE1.cabecera !== clavesCO4.cabecera, "trozoDeClaves: la cabecera sí cambia por prueba y tarea");
  afirmar(!clavesCE1.texto.includes("tarea 1"), "trozoDeClaves: el texto crudo no lleva la cabecera de la tarea");

  console.log("\nTodo en orden.");
}

async function limpiar() {
  // C-1 de la revisión final: PasoCompletado y Asignacion tienen que
  // borrarse antes que el examen — PasoCompletado.pasoId y
  // Asignacion.recorridoId son claves ajenas hacia filas que el bloque de
  // abajo borra (el Paso de la tarea y el Recorrido de lectura), y Prisma
  // no deja borrar lo que todavía se referencia. En el camino feliz ya
  // están a null (se borraron a mano en `main`); esto es la red para
  // cuando una afirmación revienta a mitad del bloque de C-1.
  if (pasoCompletadoId) await prisma.pasoCompletado.deleteMany({ where: { id: pasoCompletadoId } });
  if (asignacionId) await prisma.asignacion.deleteMany({ where: { id: asignacionId } });
  if (estudianteId) await prisma.user.deleteMany({ where: { id: estudianteId } });

  if (examenId) {
    const ex = await prisma.examen.findUnique({ where: { id: examenId }, include: { tareas: true } });
    if (ex) {
      const pasoIds = ex.tareas.map((t) => t.pasoId);
      const enganches = await prisma.pasoEjercicio.findMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.examen.delete({ where: { id: examenId } });
      await prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.ejercicio.deleteMany({ where: { id: { in: enganches.map((e) => e.ejercicioId) } } });
      await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.paso.deleteMany({ where: { id: { in: pasoIds } } });
      await prisma.recorrido.deleteMany({ where: { id: { in: [ex.lecturaId, ex.auditivaId] } } });
    }
  }
  // `PaginaDeExamen.archivoId` no es una relación de Prisma (es un id
  // suelto), así que borrar el examen no se lleva por delante los
  // `Archivo` que creó este script. `borrarPagina` ya quitó uno de en
  // medio; `deleteMany` no protesta por los que ya no están.
  if (archivoIds.length) await prisma.archivo.deleteMany({ where: { id: { in: archivoIds } } });
  if (recorridoSueltoId) await prisma.recorrido.deleteMany({ where: { id: recorridoSueltoId } });
  if (profeId) await prisma.user.delete({ where: { id: profeId } });
}

async function ejecutar() {
  const antes = await contar();
  let fallo: unknown = null;
  try {
    await main();
  } catch (e) {
    fallo = e;
  }

  await limpiar();
  const despues = await contar();
  console.log(`\nAntes:   examen=${antes.examen} recorrido=${antes.recorrido} ejercicio=${antes.ejercicio} user=${antes.user} archivo=${antes.archivo} paso=${antes.paso} bloque=${antes.bloque} pasoEjercicio=${antes.pasoEjercicio} paginaDeExamen=${antes.paginaDeExamen} tareaDeExamen=${antes.tareaDeExamen} asignacion=${antes.asignacion} pasoCompletado=${antes.pasoCompletado}`);
  console.log(`Después: examen=${despues.examen} recorrido=${despues.recorrido} ejercicio=${despues.ejercicio} user=${despues.user} archivo=${despues.archivo} paso=${despues.paso} bloque=${despues.bloque} pasoEjercicio=${despues.pasoEjercicio} paginaDeExamen=${despues.paginaDeExamen} tareaDeExamen=${despues.tareaDeExamen} asignacion=${despues.asignacion} pasoCompletado=${despues.pasoCompletado}`);

  // El fallo de una afirmación de `main` no debe quedar tapado por este
  // chequeo: se relanza primero, y solo si `main` fue bien se comprueba que
  // la limpieza dejó la base tal cual la encontró.
  if (fallo) throw fallo;

  afirmar(
    antes.examen === despues.examen &&
      antes.recorrido === despues.recorrido &&
      antes.ejercicio === despues.ejercicio &&
      antes.user === despues.user &&
      antes.archivo === despues.archivo &&
      antes.paso === despues.paso &&
      antes.bloque === despues.bloque &&
      antes.pasoEjercicio === despues.pasoEjercicio &&
      antes.paginaDeExamen === despues.paginaDeExamen &&
      antes.tareaDeExamen === despues.tareaDeExamen &&
      antes.asignacion === despues.asignacion &&
      antes.pasoCompletado === despues.pasoCompletado,
    "la base queda exactamente como se encontró",
  );
}

ejecutar()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
