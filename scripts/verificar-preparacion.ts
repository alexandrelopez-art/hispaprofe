/**
 * Verifica la portada de preparación: la tabla de bloques, el catálogo y la
 * puerta por la que un alumno se abre una práctica.
 *
 * Las partes puras no tocan la base. Las que sí, crean sus propios datos y los
 * borran en el `.finally()`, aunque una afirmación reviente a mitad.
 *
 * Ejecutar con:  npx tsx scripts/verificar-preparacion.ts
 */
import "dotenv/config";
import {
  BLOQUES,
  bloquePedido,
  bloquePorNombre,
  bloquePorOrden,
  examenPedido,
} from "@/lib/preparacion";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

// Una marca por proceso para reconocer lo que crea esta pasada y poder
// limpiarlo desde el `.finally()` aunque una afirmación reviente a mitad.
const marca = `verificar-preparacion-${process.pid}`;
const creados = { recorridos: [] as string[], usuarios: [] as string[], grupos: [] as string[] };

async function main() {
  // ─── La tabla de bloques ───────────────────────────────────────────────
  afirmar(BLOQUES.length === 4, "hay cuatro bloques");
  afirmar(
    BLOQUES.map((b) => b.orden).join(",") === "1,2,3,4",
    "los bloques van del 1 al 4, en orden",
  );
  afirmar(
    new Set(BLOQUES.map((b) => b.nombre)).size === 4,
    "los cuatro nombres de URL son distintos",
  );
  afirmar(
    bloquePorNombre("practica")?.orden === 2,
    "«practica» es el bloque 2",
  );
  afirmar(
    bloquePorOrden(3)?.nombre === "examen-blanco",
    "el bloque 3 se llama «examen-blanco» en la URL",
  );
  afirmar(bloquePorNombre("no-existe") === null, "un nombre inventado no da bloque");
  afirmar(bloquePorOrden(99) === null, "un orden inventado no da bloque");

  // El bloque 3 es el único que el alumno no se abre solo. Es la regla que
  // sostiene toda la puerta: si alguien la cambia aquí, el examen blanco se
  // vuelve autoservicio sin que nadie lo note.
  afirmar(
    BLOQUES.filter((b) => !b.autoservicio).map((b) => b.orden).join(",") === "3",
    "el examen blanco es el único bloque que no es autoservicio",
  );

  // ─── El bloque se elige, no se autoincrementa ──────────────────────────
  afirmar(bloquePedido("2") === 2, "el bloque pedido se respeta");
  afirmar(bloquePedido("3") === 3, "también el examen blanco, que lo crea el profe");
  afirmar(bloquePedido("9") === 2, "un bloque que no existe cae en la práctica (2)");
  afirmar(bloquePedido(null) === 2, "sin bloque, la práctica (2)");
  afirmar(bloquePedido("dos") === 2, "un bloque que no es un número, la práctica (2)");

  afirmar(examenPedido("3") === 3, "el número de examen se guarda");
  afirmar(examenPedido("") === null, "sin número de examen, nulo");
  afirmar(examenPedido(null) === null, "sin campo, nulo");
  afirmar(examenPedido("0") === null, "el examen cero no existe: nulo");
  afirmar(examenPedido("-2") === null, "un examen negativo: nulo");
  afirmar(examenPedido("dos") === null, "un examen que no es un número: nulo");
  afirmar(examenPedido("2.5") === null, "un examen con decimales: nulo");

  // Y que la columna existe de verdad, que es lo que la migración añade.
  const conExamen = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · con examen`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      destreza: "CE",
      orden: 2,
      examen: 3,
    },
    select: { id: true, orden: true, examen: true },
  });
  creados.recorridos.push(conExamen.id);
  afirmar(conExamen.examen === 3, `la columna examen guarda el 3 (es ${conExamen.examen})`);

  console.log("\nTodo en orden.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    async function intentar(que: string, tarea: () => Promise<unknown>) {
      try {
        await tarea();
      } catch (e) {
        fallos++;
        console.error(`limpieza · ${que}: ${e instanceof Error ? e.message : e}`);
      }
    }

    // El orden importa: primero lo que apunta al recorrido, luego el recorrido.
    for (const id of creados.recorridos) {
      await intentar("asignaciones", () => prisma.asignacion.deleteMany({ where: { recorridoId: id } }));
      await intentar("pasos", () => prisma.paso.deleteMany({ where: { recorridoId: id } }));
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    for (const id of creados.grupos) {
      await intentar("miembros", () => prisma.miembroGrupo.deleteMany({ where: { grupoId: id } }));
      await intentar("grupo", () => prisma.grupo.delete({ where: { id } }));
    }
    for (const id of creados.usuarios) {
      await intentar("usuario", () => prisma.user.delete({ where: { id } }));
    }

    await intentar("desconectar", () => prisma.$disconnect());

    if (fallos > 0) {
      console.error(`\nLa limpieza falló en ${fallos} paso(s): puede haber quedado basura en la base.`);
      process.exitCode = 1;
    }
  });
