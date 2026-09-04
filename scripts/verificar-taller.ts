/**
 * Verifica el esqueleto del taller: `crearExamen` monta dos secuencias sin
 * publicar, un paso "Tarea N" por tarea del mapa, un ejercicio vacío del
 * tipo y tamaño que el mapa dicta, y la fila de tarea del taller en `VACIA`.
 * Verifica también las páginas (registrar, reordenar, repartir, borrar,
 * asignar) y el cuadernillo de claves (extraer texto de un PDF, recortar el
 * trozo que le toca a cada tarea).
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-taller.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { crearExamen } from "@/lib/taller/esqueleto";
import { examenDe, tareaDe } from "@/lib/taller/consultas";
import { cuantosItems } from "@/lib/ejercicios/registro";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { asignarPaginas, borrarPagina, registrarPagina, reordenarPaginas, repartirEnOrden } from "@/lib/taller/paginas";
import { textoDePdf, trozoDeClaves } from "@/lib/taller/cuadernillo";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function contar() {
  const [examen, recorrido, ejercicio, user, archivo] = await Promise.all([
    prisma.examen.count(),
    prisma.recorrido.count(),
    prisma.ejercicio.count(),
    prisma.user.count(),
    prisma.archivo.count(),
  ]);
  return { examen, recorrido, ejercicio, user, archivo };
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
const archivoIds: string[] = [];

async function main() {
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

  // ─── Páginas ────────────────────────────────────────────────────────
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
  afirmar(comoLista(porClave.get("CE1")) === comoLista(idsEnOrden.slice(0, 2)), "CE1 recibe las páginas 1 y 2");
  afirmar(comoLista(porClave.get("CE2")) === comoLista(idsEnOrden.slice(2, 4)), "CE2 recibe las páginas 3 y 4");
  afirmar(comoLista(porClave.get("CE3")) === "[]", "CE3 se queda sin páginas");
  afirmar(comoLista(porClave.get("CE4")) === "[]", "CE4 se queda sin páginas");
  afirmar(comoLista(porClave.get("CO1")) === comoLista(idsEnOrden.slice(4, 6)), "CO1 recibe las páginas 5 y 6");
  afirmar(comoLista(porClave.get("CO2")) === comoLista(idsEnOrden.slice(6, 8)), "CO2 recibe las páginas 7 y 8");
  afirmar(comoLista(porClave.get("CO3")) === "[]", "CO3 se queda sin páginas");
  afirmar(comoLista(porClave.get("CO4")) === "[]", "CO4 se queda sin páginas");

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

  // ─── Cuadernillo ────────────────────────────────────────────────────
  // El bloque «SOLUCIONES» se busca en el texto entero (no solo en el
  // trozo del examen), así que el relleno tiene que pasar de los 3.000
  // caracteres que captura `trozoDeClaves` tras cada «SOLUCIONES»: si no,
  // el bloque de soluciones del examen 2 se comería el rótulo del examen 3
  // y la afirmación de que no se cuela dejaría de tener sentido.
  const relleno = "X".repeat(3200);
  const textoSintetico =
    `EXAMEN 1 – LECTURA DEL EXAMEN 1. EXAMEN 2 – PRUEBA DE COMPRENSIÓN LECTORA. TAREA 1. ` +
    `SOLUCIONES DEL EXAMEN 2: A B C. ${relleno} EXAMEN 3 – LECTURA DEL EXAMEN 3.`;
  const trozo2 = trozoDeClaves(textoSintetico, 2, "CE", 1);
  afirmar(trozo2.texto.includes("EXAMEN 2"), "el trozo del examen 2 incluye su rótulo");
  afirmar(trozo2.texto.includes("SOLUCIONES"), "el trozo del examen 2 incluye las soluciones");
  afirmar(!trozo2.texto.includes("EXAMEN 3 –"), "el trozo del examen 2 no se cuela en el examen 3");
  afirmar(trozo2.recortado === false, "el trozo del examen 2 no viene marcado como recortado");

  const trozo7 = trozoDeClaves(textoSintetico, 7, "CE", 1);
  afirmar(trozo7.recortado === true, "un examen que no aparece en el texto sale recortado");

  const textoDelPdf = await textoDePdf(pdfMinimo("Hola taller"));
  afirmar(textoDelPdf.includes("Hola taller"), "textoDePdf lee el texto de un PDF mínimo escrito a mano");

  console.log("\nTodo en orden.");
}

async function limpiar() {
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
  console.log(`\nAntes:   examen=${antes.examen} recorrido=${antes.recorrido} ejercicio=${antes.ejercicio} user=${antes.user} archivo=${antes.archivo}`);
  console.log(`Después: examen=${despues.examen} recorrido=${despues.recorrido} ejercicio=${despues.ejercicio} user=${despues.user} archivo=${despues.archivo}`);

  // El fallo de una afirmación de `main` no debe quedar tapado por este
  // chequeo: se relanza primero, y solo si `main` fue bien se comprueba que
  // la limpieza dejó la base tal cual la encontró.
  if (fallo) throw fallo;

  afirmar(
    antes.examen === despues.examen &&
      antes.recorrido === despues.recorrido &&
      antes.ejercicio === despues.ejercicio &&
      antes.user === despues.user &&
      antes.archivo === despues.archivo,
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
