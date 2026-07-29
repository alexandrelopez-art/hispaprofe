/**
 * Verifica los cálculos y las consultas del diario de clases. Crea sus
 * propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-clases.ts
 */
import "dotenv/config";
import {
  importeDeClase,
  validarClase,
  euros,
  horas,
  destinatariosDe,
  sincronizarDeberes,
  cerrarDeber,
  abrirDeber,
  cerrarDeberesDeClase,
} from "@/lib/clases";
import { fechaHora, paraInput } from "@/lib/fechas";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

// Marca única para no chocar con datos reales ni con otra ejecución.
const marca = `verificar-clases-${process.pid}`;

async function main() {
  // 1. El importe: la tarifa por los minutos, redondeado al céntimo.
  afirmar(importeDeClase(2000, 60) === 2000, "una hora a 20 € son 20 €");
  afirmar(importeDeClase(2000, 90) === 3000, "hora y media a 20 € son 30 €");
  afirmar(importeDeClase(2000, 45) === 1500, "tres cuartos a 20 € son 15 €");
  afirmar(importeDeClase(1750, 50) === 1458, "redondea al céntimo más cercano");
  afirmar(importeDeClase(null, 60) === null, "sin tarifa no hay importe");
  afirmar(importeDeClase(0, 60) === 0, "una tarifa de cero es cero, no es ausencia");

  // 2. La validación: destinatario exclusivo y duración positiva.
  afirmar(
    validarClase({ estudianteId: "a", minutos: 60 }) === null,
    "una clase con estudiante y duración vale",
  );
  afirmar(
    validarClase({ grupoId: "g", minutos: 60 }) === null,
    "una clase con grupo y duración vale",
  );
  afirmar(
    validarClase({ estudianteId: "a", grupoId: "g", minutos: 60 }) !== null,
    "con estudiante Y grupo se rechaza",
  );
  afirmar(
    validarClase({ minutos: 60 }) !== null,
    "sin destinatario se rechaza",
  );
  afirmar(
    validarClase({ estudianteId: "a", minutos: 0 }) !== null,
    "una clase de cero minutos se rechaza",
  );
  afirmar(
    validarClase({ estudianteId: "a", minutos: -30 }) !== null,
    "una duración negativa se rechaza",
  );

  // 3. Los formatos que ve la gente.
  afirmar(euros(2000) === "20,00 €", "veinte euros se escriben con coma");
  afirmar(euros(1458) === "14,58 €", "los céntimos no se pierden");
  afirmar(euros(null) === "—", "sin importe se enseña una raya, no un cero");
  afirmar(horas(90) === "1 h 30 min", "hora y media");
  afirmar(horas(60) === "1 h", "una hora justa no lleva minutos");
  afirmar(horas(45) === "45 min", "menos de una hora son solo minutos");
  afirmar(horas(0) === "0 min", "cero minutos no revienta");

  const cuando = new Date("2026-08-04T18:00:00+02:00");
  afirmar(
    fechaHora(cuando).includes("18:00"),
    "la hora se escribe en la zona de Madrid, no en UTC",
  );
  afirmar(paraInput(cuando) === "2026-08-04T18:00", "el formato del input cuadra");

  // 4. Los deberes: una fila por estudiante, y se cierran de una en una.
  const profe = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  const ana = await prisma.user.create({
    data: { email: `ana-${marca}@ejemplo.test`, firstName: "Ana" },
  });
  const luis = await prisma.user.create({
    data: { email: `luis-${marca}@ejemplo.test`, firstName: "Luis" },
  });
  const grupo = await prisma.grupo.create({
    data: {
      nombre: `Grupo ${marca}`,
      profesorId: profe.id,
      miembros: {
        create: [{ estudianteId: ana.id }, { estudianteId: luis.id }],
      },
    },
  });

  // Clase particular con Ana: un solo deber.
  const particular = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: new Date("2026-08-04T18:00:00+02:00"),
      minutos: 60,
      notas: marca,
      deberes: "Ejercicios 3 y 4.",
    },
  });
  afirmar(
    (await destinatariosDe(particular.id)).length === 1,
    "una clase particular tiene un destinatario",
  );
  await sincronizarDeberes(particular.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: particular.id } })) === 1,
    "una clase particular genera un deber",
  );

  // Sincronizar dos veces no duplica.
  await sincronizarDeberes(particular.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: particular.id } })) === 1,
    "sincronizar dos veces no duplica el deber",
  );

  // Clase de grupo: un deber por miembro.
  const deGrupo = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      grupoId: grupo.id,
      empiezaEl: new Date("2026-08-05T18:00:00+02:00"),
      minutos: 90,
      notas: marca,
      deberes: "Leer el texto de la página 12.",
    },
  });
  afirmar(
    (await destinatariosDe(deGrupo.id)).length === 2,
    "una clase de grupo tiene tantos destinatarios como miembros",
  );
  await sincronizarDeberes(deGrupo.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: deGrupo.id } })) === 2,
    "un grupo de dos genera dos deberes",
  );

  // Cerrar el de Ana no cierra el de Luis.
  const deAna = await prisma.deber.findFirstOrThrow({
    where: { claseId: deGrupo.id, estudianteId: ana.id },
  });
  await cerrarDeber(deAna.id);
  afirmar(
    (await prisma.deber.count({
      where: { claseId: deGrupo.id, cerradoEl: { not: null } },
    })) === 1,
    "cerrar el deber de uno no cierra el de los demás",
  );

  // Y se puede volver a abrir, porque el profesor se equivoca.
  await abrirDeber(deAna.id);
  afirmar(
    (await prisma.deber.count({
      where: { claseId: deGrupo.id, cerradoEl: { not: null } },
    })) === 0,
    "un deber cerrado se puede volver a abrir",
  );

  // Cerrar todos de golpe.
  afirmar(
    (await cerrarDeberesDeClase(deGrupo.id)) === 2,
    "cerrar todos cierra los dos que quedaban",
  );
  afirmar(
    (await cerrarDeberesDeClase(deGrupo.id)) === 0,
    "volver a cerrar todos no toca nada ni revienta",
  );

  // El caso feo: cambiar el destinatario conserva lo ya cerrado de quien sigue.
  await prisma.miembroGrupo.deleteMany({
    where: { grupoId: grupo.id, estudianteId: luis.id },
  });
  await sincronizarDeberes(deGrupo.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: deGrupo.id } })) === 1,
    "quien sale del grupo pierde su deber",
  );
  const supervivienteAna = await prisma.deber.findFirstOrThrow({
    where: { claseId: deGrupo.id },
  });
  afirmar(
    supervivienteAna.estudianteId === ana.id &&
      supervivienteAna.cerradoEl !== null,
    "el deber ya cerrado de quien sigue se conserva cerrado",
  );

  // Vaciar el texto borra las filas: no hay deberes que enseñar.
  await prisma.clase.update({
    where: { id: deGrupo.id },
    data: { deberes: "" },
  });
  await sincronizarDeberes(deGrupo.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: deGrupo.id } })) === 0,
    "vaciar el texto de los deberes borra sus filas",
  );

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    // Red por si una verificación futura deja datos a medias.
    await prisma.deber.deleteMany({ where: { clase: { notas: marca } } });
    await prisma.clase.deleteMany({ where: { notas: marca } });
    await prisma.miembroGrupo.deleteMany({
      where: { grupo: { nombre: { contains: marca } } },
    });
    await prisma.grupo.deleteMany({ where: { nombre: { contains: marca } } });
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
  });
