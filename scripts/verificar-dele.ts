/**
 * Verifica el contador de escuchas y, desde la Tarea 2, el mapa del examen.
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-dele.ts
 */
import "dotenv/config";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { PRUEBAS, pruebaDe, pruebasDe, sobrantesDe, tareaDe } from "@/lib/dele";
import { apuntarEscucha, escuchasDe } from "@/lib/escuchas";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-dele-${process.pid}`;

// Los ids de todo lo que se crea, en variables de módulo para poder
// limpiarlo desde el `.finally()` aunque una afirmación reviente a mitad.
let recorridoId: string | null = null;
let pasoId: string | null = null;
let asignacionId: string | null = null;
const usuarioIds: string[] = [];

async function main() {
  // ─── El mapa consigo mismo ──────────────────────────────────────────
  const MOTORES = new Set(["opcion", "huecos", "relacionar", "ordenar"]);

  for (const prueba of PRUEBAS) {
    const donde = `${prueba.nivel} · ${prueba.prueba}`;

    afirmar(prueba.tareas.length > 0, `${donde} tiene tareas`);
    afirmar(prueba.duracionMinutos > 0, `${donde} tiene duración`);

    const numeros = prueba.tareas.map((t) => t.numero);
    afirmar(
      new Set(numeros).size === numeros.length,
      `${donde} no repite ningún número de tarea`,
    );

    for (const tarea of prueba.tareas) {
      const cual = `${donde} · T${tarea.numero}`;
      afirmar(MOTORES.has(tarea.motor), `${cual} apunta a un tipo del motor que existe`);
      afirmar(tarea.items > 0, `${cual} tiene ítems`);
      afirmar(tarea.opciones > 0, `${cual} tiene opciones`);
      afirmar(tarea.pide.trim().length > 0, `${cual} dice qué se pide`);
      // `relacionar` es uno a uno: no puede tener menos opciones que ítems,
      // porque cada ítem necesita la suya y no se pueden repetir.
      if (tarea.motor === "relacionar") {
        afirmar(!tarea.listaComun, `${cual} con relacionar no usa lista común`);
        afirmar(
          tarea.opciones >= tarea.items,
          `${cual} con relacionar tiene al menos una opción por ítem`,
        );
      }
      // Solo `relacionar` reparte de una lista única y por tanto puede tener
      // sobrantes. En `opcion`, `opciones` son las de cada ítem, así que la
      // resta no significa nada y `sobrantesDe` tiene que dar cero.
      if (tarea.motor !== "relacionar") {
        afirmar(sobrantesDe(tarea) === 0, `${cual} no es de sobrantes`);
      }
    }
  }

  // Las pruebas verificadas tienen el número de tareas que dice el examen.
  const ESPERADAS: [Nivel, Destreza, number][] = [
    ["B1", "CE", 5], ["B1", "CO", 5],
    ["B2", "CE", 4], ["B2", "CO", 5],
    ["A2_B1_ESCOLAR", "CE", 4], ["A2_B1_ESCOLAR", "CO", 4],
  ];
  for (const [nivel, destreza, cuantas] of ESPERADAS) {
    const p = pruebaDe(nivel, destreza);
    afirmar(p !== null, `${nivel} · ${destreza} está en el mapa`);
    afirmar(p!.tareas.length === cuantas, `${nivel} · ${destreza} tiene ${cuantas} tareas`);
    afirmar(p!.tareas.every((t) => t.verificado), `${nivel} · ${destreza} está toda verificada`);
  }

  // Las cuatro preguntas al mapa.
  afirmar(pruebasDe("B1").length === 2, "B1 tiene las dos pruebas de comprensión");
  afirmar(pruebaDe("B1", "EE") === null, "las de expresión no están en el mapa");
  afirmar(tareaDe("B1", "CE", 1)?.formato === "MATCH_TEXT", "B1 · CE · T1 es MATCH_TEXT");
  afirmar(tareaDe("B1", "CE", 99) === null, "una tarea que no existe devuelve null");
  afirmar(sobrantesDe(tareaDe("B1", "CE", 1)!) === 3, "B1 · CE · T1 tiene tres sobrantes");
  afirmar(sobrantesDe(tareaDe("B1", "CE", 2)!) === 0, "B1 · CE · T2 no tiene sobrantes");

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
    data: { recorridoId: recorrido.id, titulo: "Paso", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  pasoId = paso.id;

  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;

  // 1. Sin haber oído nada, cero.
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 0, "sin oír nada, cero escuchas");

  // 2. Las dos escuchas del examen.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === 1, "la primera deja una");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === 0, "la segunda deja cero");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === null, "la tercera se niega");

  // 3. La que de verdad importa: preguntar otra vez después de agotarlas
  //    sigue diciendo que no. Si esto falla, recargar la página devuelve las
  //    escuchas y el contador no sirve para nada.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === null, "sigue negándose al insistir");
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 2, "el contador se quedó en dos");

  // 4. Cada audio cuenta por su cuenta: la tarea 1 de auditiva son seis.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "b", 2)) === 1, "otro audio empieza de cero");
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 2, "y no toca el contador del primero");

  // 5. El máximo es del ejercicio, no una constante: con cuatro, la tercera
  //    sí suena.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 3, "con máximo cuatro, la primera deja tres");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 2, "la segunda deja dos");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 1, "la tercera deja una");

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` aquí mataría el proceso antes del `finally`, y la
    // limpieza no correría. En TDD el paso que falla lo hace a propósito,
    // así que eso dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    // Cada borrado se intenta aunque el anterior reviente: si uno falla por
    // un blip transitorio, los demás no se quedan sin ni siquiera
    // intentarse, y la basura que sí se puede quitar se quita.
    async function intentar(que: string, fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (e) {
        fallos++;
        console.error(`FALLO AL LIMPIAR (${que}):`, e instanceof Error ? e.message : e);
      }
    }

    // El orden importa: los vínculos antes que sus extremos, porque las
    // claves foráneas son RESTRICT. Capturado en `const` dentro de cada
    // bloque para que TypeScript lo vea no-nulo dentro del cierre.
    if (asignacionId) {
      const id = asignacionId;
      await intentar("escuchas", () => prisma.escucha.deleteMany({ where: { asignacionId: id } }));
      await intentar("pasos completados", () => prisma.pasoCompletado.deleteMany({ where: { asignacionId: id } }));
      await intentar("asignación", () => prisma.asignacion.delete({ where: { id } }));
    }
    if (pasoId) {
      const id = pasoId;
      await intentar("paso", () => prisma.paso.delete({ where: { id } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    if (usuarioIds.length) {
      await intentar("usuarios", () => prisma.user.deleteMany({ where: { id: { in: usuarioIds } } }));
    }

    // Un rechazo sin capturar aquí sería silencioso: nadie lo ve y la
    // basura se descubre a mano, como pasó la vez que faltaba esto.
    if (fallos > 0) {
      console.error(`\nLa limpieza falló en ${fallos} paso(s): puede haber quedado basura de prueba en la base.`);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
