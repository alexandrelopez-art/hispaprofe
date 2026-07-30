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
  totalesDeClases,
  listarClases,
  proximaClase,
  deberesPendientes,
  congelarImporte,
} from "@/lib/clases";
import { deInput, fechaHora, paraInput } from "@/lib/fechas";
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

  // Lo que escribe el profesor en un <input type="datetime-local"> son horas
  // de Madrid. Estas tres pasan igual en un portátil de Madrid que en un
  // servidor en UTC, que es justo lo que hay que asegurar.
  afirmar(
    deInput("2026-08-04T18:00")?.toISOString() === "2026-08-04T16:00:00.000Z",
    "las 18:00 de agosto son las 16:00Z (horario de verano)",
  );
  afirmar(
    deInput("2026-01-04T18:00")?.toISOString() === "2026-01-04T17:00:00.000Z",
    "las 18:00 de enero son las 17:00Z (horario de invierno)",
  );
  afirmar(
    deInput("cuando sea") === null,
    "una fecha ilegible no se inventa: devuelve null",
  );

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

  // 5. El cuadro: solo cuentan las dadas, y los filtros mandan.
  await prisma.clase.update({
    where: { id: particular.id },
    data: { estado: "DADA", importeCentimos: 2000 },
  });
  await prisma.clase.update({
    where: { id: deGrupo.id },
    data: { estado: "DADA", importeCentimos: 3000, cobradaEl: new Date() },
  });
  // Sin `const`: estas dos no vuelven a nombrarse, y una variable sin usar
  // es un aviso del lint.
  await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: new Date("2026-08-06T18:00:00+02:00"),
      minutos: 120,
      estado: "ANULADA",
      importeCentimos: 4000,
      notas: marca,
    },
  });
  await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: luis.id,
      empiezaEl: new Date("2026-08-07T18:00:00+02:00"),
      minutos: 30,
      estado: "DADA",
      notas: marca,
    },
  });
  // Esta sí: la Tarea 5 la usa para comprobar la próxima clase.
  const agendada = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: new Date("2099-01-01T18:00:00+01:00"),
      minutos: 60,
      notas: marca,
    },
  });

  const todo = await totalesDeClases({ profesorId: profe.id });
  afirmar(todo.cuantas === 3, "cuenta las tres dadas y ninguna más");
  afirmar(
    todo.minutos === 60 + 90 + 30,
    "la anulada y la agendada no suman minutos",
  );
  afirmar(todo.totalCentimos === 5000, "suma solo el importe de las dadas");
  afirmar(todo.cobradoCentimos === 3000, "el cobrado sale de las que tienen fecha");
  afirmar(todo.pendienteCentimos === 2000, "lo pendiente es el total menos lo cobrado");
  afirmar(todo.sinTarifa === 1, "avisa de la clase dada sin importe");

  const soloAna = await totalesDeClases({
    profesorId: profe.id,
    estudianteId: ana.id,
  });
  afirmar(soloAna.cuantas === 1, "filtrar por estudiante deja solo lo suyo");
  afirmar(soloAna.minutos === 60, "y sus minutos");

  const enAgosto = await totalesDeClases({
    profesorId: profe.id,
    desde: new Date("2026-08-05T00:00:00+02:00"),
    hasta: new Date("2026-08-06T00:00:00+02:00"),
  });
  afirmar(enAgosto.cuantas === 1, "el rango de fechas recorta por los dos lados");

  const pendientes = await totalesDeClases({
    profesorId: profe.id,
    cobrada: false,
  });
  afirmar(pendientes.cuantas === 2, "filtrar por sin cobrar deja las dos que faltan");

  const agendadas = await totalesDeClases({
    profesorId: profe.id,
    estado: "AGENDADA",
  });
  afirmar(
    agendadas.cuantas === 0 && agendadas.minutos === 0,
    "pedir los totales de las agendadas da cero: solo las dadas cuentan",
  );

  const lista = await listarClases({ profesorId: profe.id });
  afirmar(lista.length === 5, "la lista sí enseña las cinco, no solo las dadas");
  afirmar(
    lista[0].id === agendada.id,
    "la lista va de la más futura a la más antigua",
  );
  afirmar(
    lista.some((c) => c.grupo?.nombre.includes(marca)),
    "la lista trae el nombre del grupo",
  );
  afirmar(
    lista.some((c) => c.estudiante?.firstName === "Ana"),
    "y el nombre del estudiante",
  );

  // 6. El tablero del estudiante: su próxima clase y sus deberes.
  const referencia = new Date("2026-08-01T00:00:00+02:00");

  const proximaDeAna = await proximaClase(ana.id, referencia);
  afirmar(proximaDeAna !== null, "Ana tiene una próxima clase");
  afirmar(
    proximaDeAna!.id === agendada.id,
    "la próxima es la agendada, no la dada ni la anulada",
  );

  // Una clase de grupo agendada también es la próxima de sus miembros.
  const grupalFutura = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      grupoId: grupo.id,
      empiezaEl: new Date("2026-08-02T18:00:00+02:00"),
      minutos: 60,
      notas: marca,
      enlace: "https://meet.example/abc",
    },
  });
  const otraVez = await proximaClase(ana.id, referencia);
  afirmar(otraVez !== null, "sigue habiendo una próxima clase para Ana");
  afirmar(
    otraVez!.id === grupalFutura.id,
    "una clase de su grupo cuenta como suya, y la más cercana gana",
  );
  afirmar(
    otraVez!.enlace === "https://meet.example/abc",
    "la próxima clase trae su enlace",
  );

  // Luis ya no está en el grupo: esa clase no es suya.
  const deLuis = await proximaClase(luis.id, referencia);
  afirmar(
    deLuis === null,
    "quien no está en el grupo no ve esa clase como suya",
  );

  // Después de la última clase agendada no hay próxima.
  afirmar(
    (await proximaClase(ana.id, new Date("2100-01-01T00:00:00Z"))) === null,
    "sin clases futuras no hay próxima clase",
  );

  // Los deberes pendientes: los de la clase particular, que siguen abiertos.
  const pendientesDeAna = await deberesPendientes(ana.id);
  afirmar(
    pendientesDeAna.length === 1,
    "Ana tiene un deber pendiente, el de la clase particular",
  );
  afirmar(
    pendientesDeAna[0].texto === "Ejercicios 3 y 4.",
    "el deber trae el texto de su clase",
  );

  // Una clase anulada esconde sus deberes del tablero.
  await prisma.clase.update({
    where: { id: particular.id },
    data: { estado: "ANULADA" },
  });
  afirmar(
    (await deberesPendientes(ana.id)).length === 0,
    "los deberes de una clase anulada desaparecen del tablero",
  );
  afirmar(
    (await prisma.deber.count({ where: { claseId: particular.id } })) === 1,
    "pero la fila sigue ahí para el historial del profesor",
  );

  // 7. El importe se congela: se escribe una vez y no se reescribe nunca.
  const marta = await prisma.user.create({
    data: {
      email: `marta-${marca}@ejemplo.test`,
      firstName: "Marta",
      tarifaCentimos: 2000,
    },
  });
  const paraCongelar = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: marta.id,
      empiezaEl: new Date("2026-08-08T18:00:00+02:00"),
      minutos: 60,
      estado: "DADA",
      notas: marca,
    },
  });
  afirmar(
    (await congelarImporte(paraCongelar.id)) === 2000,
    "una hora dada a 20 € la hora congela 20 €",
  );

  // La tarifa sube en marzo; las clases de enero no se enteran.
  await prisma.user.update({
    where: { id: marta.id },
    data: { tarifaCentimos: 3000 },
  });
  afirmar(
    (await congelarImporte(paraCongelar.id)) === 2000,
    "volver a marcarla dada con la tarifa subida sigue dando 20 €",
  );
  const relectura = await prisma.clase.findUnique({
    where: { id: paraCongelar.id },
    select: { importeCentimos: true },
  });
  afirmar(
    relectura?.importeCentimos === 2000,
    "y en la base sigue habiendo 20 €, no 30",
  );

  // Sin tarifa no hay importe: por eso la ficha enseña el aviso ámbar.
  const sinTarifaAun = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: new Date("2026-08-09T18:00:00+02:00"),
      minutos: 90,
      estado: "DADA",
      notas: marca,
    },
  });
  afirmar(
    (await congelarImporte(sinTarifaAun.id)) === null,
    "una clase dada a quien no tiene tarifa se queda sin importe",
  );

  // Una clase que todavía no ha ocurrido no tiene precio que congelar.
  const todaviaNo = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: marta.id,
      empiezaEl: new Date("2026-08-10T18:00:00+02:00"),
      minutos: 60,
      notas: marca,
    },
  });
  afirmar(
    (await congelarImporte(todaviaNo.id)) === null,
    "una clase agendada no congela nada, aunque haya tarifa",
  );

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` aquí mataría el proceso antes del `finally`, y la
    // limpieza no correría. En TDD el paso RED falla a propósito, así que
    // eso deja basura en la base cada vez.
    process.exitCode = 1;
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
