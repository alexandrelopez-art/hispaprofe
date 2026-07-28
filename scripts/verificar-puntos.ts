/**
 * Verifica las reglas de puntos del estudiante contra la base de desarrollo.
 * Crea sus propios datos y los borra al terminar. Ejecutar con:
 *   npx tsx scripts/verificar-puntos.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { desmarcarSiNoRevisado, resumenEstudiante } from "@/lib/progreso";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) {
    // Lanza en vez de process.exit(): así el `finally` de main() limpia los
    // datos de prueba antes de que el .catch() de más abajo fije el código
    // de salida. process.exit() aquí cortaría el stack antes de la limpieza.
    throw new Error(`FALLO: ${mensaje}`);
  }
  console.log(`OK: ${mensaje}`);
}

// Marca única para no chocar con datos reales ni con otra ejecución.
const marca = `verificar-puntos-${process.pid}`;

async function main() {
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: `Secuencia de prueba ${marca}`,
      nivel: "B2",
      orden: 999,
      autorId: profesor.id,
      pasos: {
        create: [
          { orden: 1, ciclo: 1, tipo: "ACTIVACION", titulo: "Paso revisado" },
          { orden: 2, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Paso solo entregado" },
        ],
      },
    },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });
  const [pasoRevisado, pasoEntregado] = recorrido.pasos;

  const asignacion = await prisma.asignacion.create({
    data: {
      estudianteId: estudiante.id,
      profesorId: profesor.id,
      recorridoId: recorrido.id,
    },
  });

  await prisma.pasoCompletado.create({
    data: {
      asignacionId: asignacion.id,
      pasoId: pasoRevisado.id,
      puntos: 40,
      verificadoEl: new Date(),
    },
  });
  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: pasoEntregado.id },
  });

  try {
    // 1. Un paso revisado sobrevive al desmarcado.
    const borroRevisado = await desmarcarSiNoRevisado(
      asignacion.id,
      pasoRevisado.id,
    );
    afirmar(borroRevisado === false, "desmarcar un paso revisado no borra nada");

    const sigue = await prisma.pasoCompletado.findUnique({
      where: {
        asignacionId_pasoId: {
          asignacionId: asignacion.id,
          pasoId: pasoRevisado.id,
        },
      },
      select: { puntos: true },
    });
    afirmar(sigue?.puntos === 40, "los puntos del paso revisado siguen ahí");

    // 2. La hucha suma lo mismo que las filas verificadas.
    const resumen = await resumenEstudiante(estudiante.id);
    afirmar(resumen.puntosTotales === 40, "la hucha suma 40 puntos");
    afirmar(resumen.pasosRevisados === 1, "cuenta un paso revisado");
    afirmar(
      resumen.esperandoRevision.length === 1,
      "una entrega esperando revisión",
    );
    afirmar(
      resumen.revisadosRecientes.length === 1,
      "un paso en la bandeja de revisados",
    );
    afirmar(
      resumen.revisadosRecientes[0].recorridoTitulo === recorrido.titulo,
      "la bandeja trae el título de la secuencia",
    );

    // 3. Un paso solo entregado sí se desmarca.
    const borroEntregado = await desmarcarSiNoRevisado(
      asignacion.id,
      pasoEntregado.id,
    );
    afirmar(borroEntregado === true, "desmarcar un paso solo entregado sí borra");

    const resumenFinal = await resumenEstudiante(estudiante.id);
    afirmar(
      resumenFinal.esperandoRevision.length === 0,
      "la bandeja de espera queda vacía",
    );
    afirmar(
      resumenFinal.puntosTotales === 40,
      "la hucha no cambia al desmarcar una entrega",
    );
  } finally {
    // Limpieza en orden inverso a las dependencias.
    await prisma.pasoCompletado.deleteMany({
      where: { asignacionId: asignacion.id },
    });
    await prisma.asignacion.deleteMany({ where: { recorridoId: recorrido.id } });
    await prisma.paso.deleteMany({ where: { recorridoId: recorrido.id } });
    await prisma.recorrido.delete({ where: { id: recorrido.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [profesor.id, estudiante.id] } },
    });
  }

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
