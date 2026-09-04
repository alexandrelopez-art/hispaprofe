/**
 * Verifica el esqueleto del taller: `crearExamen` monta dos secuencias sin
 * publicar, un paso "Tarea N" por tarea del mapa, un ejercicio vacío del
 * tipo y tamaño que el mapa dicta, y la fila de tarea del taller en `VACIA`.
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-taller.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { crearExamen } from "@/lib/taller/esqueleto";
import { examenDe, tareaDe } from "@/lib/taller/consultas";
import { cuantosItems } from "@/lib/ejercicios/registro";
import { tareaDe as tareaDelMapa } from "@/lib/dele";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function contar() {
  const [examen, recorrido, ejercicio, user] = await Promise.all([
    prisma.examen.count(),
    prisma.recorrido.count(),
    prisma.ejercicio.count(),
    prisma.user.count(),
  ]);
  return { examen, recorrido, ejercicio, user };
}

const marca = `verificar-taller-${process.pid}`;
let profeId: string | null = null;
let examenId: string | null = null;

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
  console.log(`\nAntes:   examen=${antes.examen} recorrido=${antes.recorrido} ejercicio=${antes.ejercicio} user=${antes.user}`);
  console.log(`Después: examen=${despues.examen} recorrido=${despues.recorrido} ejercicio=${despues.ejercicio} user=${despues.user}`);

  // El fallo de una afirmación de `main` no debe quedar tapado por este
  // chequeo: se relanza primero, y solo si `main` fue bien se comprueba que
  // la limpieza dejó la base tal cual la encontró.
  if (fallo) throw fallo;

  afirmar(
    antes.examen === despues.examen &&
      antes.recorrido === despues.recorrido &&
      antes.ejercicio === despues.ejercicio &&
      antes.user === despues.user,
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
