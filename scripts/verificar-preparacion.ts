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
  abrirPractica,
  catalogoDeBloque,
  cuantosPorBloque,
  distintivos,
  estadoDeAsignacion,
  type Tarjeta,
  profesorDelEstudiante,
} from "@/lib/catalogo-preparacion";
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
const creados = {
  recorridos: [] as string[],
  usuarios: [] as string[],
  grupos: [] as string[],
  pasosCompletados: [] as string[],
};

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

  // ─── El resumen de estado, sin tocar la base ───────────────────────────
  const viva = (completados: { verificadoEl: Date | null; puntos: number | null }[]) => ({
    archivada: false,
    completados,
  });

  // Los dos vacíos que antes eran el mismo: sin asignación no hay nada que
  // seguir, con asignación y sin pasos hechos sí. De esa distinción depende
  // que un examen blanco recién abierto tenga enlace.
  afirmar(
    estadoDeAsignacion(4, null).clase === "SIN_ASIGNAR",
    "sin asignación, la tarjeta está sin asignar",
  );
  afirmar(
    estadoDeAsignacion(4, viva([])).clase === "SIN_EMPEZAR",
    "con asignación y sin pasos hechos, sin empezar (que no es lo mismo)",
  );
  afirmar(
    estadoDeAsignacion(4, { archivada: true, completados: [] }).clase === "ARCHIVADA",
    "una asignación archivada se dice archivada, no «sin empezar»",
  );
  afirmar(
    estadoDeAsignacion(4, {
      archivada: true,
      completados: [{ verificadoEl: null, puntos: null }],
    }).clase === "ARCHIVADA",
    "y archivada gana también con pasos hechos: el trabajo está retirado",
  );

  const aMedias = estadoDeAsignacion(
    4,
    viva([
      { verificadoEl: null, puntos: null },
      { verificadoEl: null, puntos: null },
    ]),
  );
  afirmar(
    aMedias.clase === "A_MEDIAS" && aMedias.hechos === 2 && aMedias.total === 4,
    "dos pasos de cuatro son «a medias, 2 de 4»",
  );
  afirmar(
    estadoDeAsignacion(
      2,
      viva([
        { verificadoEl: null, puntos: null },
        { verificadoEl: null, puntos: null },
      ]),
    ).clase === "ENTREGADO",
    "todos los pasos entregados y ninguno revisado es «entregado»",
  );
  const revisado = estadoDeAsignacion(
    2,
    viva([
      { verificadoEl: new Date(), puntos: 12 },
      { verificadoEl: new Date(), puntos: 9 },
    ]),
  );
  afirmar(
    revisado.clase === "REVISADO" && revisado.puntos === 21,
    "con todo revisado se suman los puntos (son 21)",
  );
  // Un paso revisado y otro sin entregar sigue siendo «a medias»: enseñar
  // «revisado» ahí le diría al alumno que ha terminado cuando no lo ha hecho.
  afirmar(
    estadoDeAsignacion(3, viva([{ verificadoEl: new Date(), puntos: 8 }])).clase === "A_MEDIAS",
    "un paso revisado de tres sigue siendo «a medias»",
  );

  // ─── El catálogo ───────────────────────────────────────────────────────
  const borrador = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · borrador`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      destreza: "CO",
      orden: 2,
      examen: 1,
      publicado: false,
    },
    select: { id: true },
  });
  creados.recorridos.push(borrador.id);

  const publicado = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · publicado`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      destreza: "CE",
      orden: 2,
      examen: 1,
      publicado: true,
      pasos: {
        create: [
          { orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Tarea 1" },
          { orden: 2, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Tarea 2" },
        ],
      },
    },
    select: { id: true },
  });
  creados.recorridos.push(publicado.id);

  const catalogo = await catalogoDeBloque(2, null);
  const mios = catalogo.filter((t) => t.titulo.startsWith(marca));
  afirmar(mios.length === 1, `el catálogo trae solo lo publicado (trae ${mios.length})`);
  afirmar(mios[0].recorridoId === publicado.id, "y es el publicado, no el borrador");
  afirmar(mios[0].pasos === 2, "la tarjeta sabe cuántos pasos tiene");
  afirmar(mios[0].estado.clase === "SIN_ASIGNAR", "sin alumno, la tarjeta está sin asignar");

  const vacio = await catalogoDeBloque(3, null);
  afirmar(
    !vacio.some((t) => t.titulo.startsWith(marca)),
    "lo del bloque 2 no sale en el bloque 3",
  );

  // ─── La puerta ─────────────────────────────────────────────────────────
  const profe = await prisma.user.create({
    data: { email: `${marca}-profe@ejemplo.test`, role: "PROFESOR" },
    select: { id: true },
  });
  creados.usuarios.push(profe.id);

  const alumno = await prisma.user.create({
    data: { email: `${marca}-alumno@ejemplo.test`, role: "STUDENT" },
    select: { id: true },
  });
  creados.usuarios.push(alumno.id);

  const huerfano = await prisma.user.create({
    data: { email: `${marca}-huerfano@ejemplo.test`, role: "STUDENT" },
    select: { id: true },
  });
  creados.usuarios.push(huerfano.id);

  // Aparte de `alumno`: la carrera se prueba con una pareja estudiante/
  // recorrido sin asignación previa, para que las dos llamadas concurrentes
  // lleguen de verdad al `create` y no se resuelvan antes en el `findUnique`
  // de guardia.
  const concurrente = await prisma.user.create({
    data: { email: `${marca}-concurrente@ejemplo.test`, role: "STUDENT" },
    select: { id: true },
  });
  creados.usuarios.push(concurrente.id);

  // Para la provocación determinista del P2002, más abajo: también necesita
  // llegar al `create` sin asignación previa, y por eso no comparte alumno con
  // la carrera de verdad.
  const colado = await prisma.user.create({
    data: { email: `${marca}-colado@ejemplo.test`, role: "STUDENT" },
    select: { id: true },
  });
  creados.usuarios.push(colado.id);

  const grupo = await prisma.grupo.create({
    data: {
      nombre: `${marca} · grupo`,
      profesorId: profe.id,
      miembros: {
        create: [
          { estudianteId: alumno.id },
          { estudianteId: concurrente.id },
          { estudianteId: colado.id },
        ],
      },
    },
    select: { id: true },
  });
  creados.grupos.push(grupo.id);

  afirmar(
    (await profesorDelEstudiante(alumno.id)) === profe.id,
    "el profesor de un alumno sale de su grupo",
  );
  afirmar(
    (await profesorDelEstudiante(huerfano.id)) === null,
    "un alumno sin grupo no tiene profesor",
  );

  const blanco = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · examen blanco`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      orden: 3,
      publicado: true,
    },
    select: { id: true },
  });
  creados.recorridos.push(blanco.id);

  const rechazoBorrador = await abrirPractica(alumno.id, borrador.id);
  afirmar(
    "error" in rechazoBorrador,
    `un borrador no se puede empezar (dijo: ${JSON.stringify(rechazoBorrador)})`,
  );

  const rechazoBlanco = await abrirPractica(alumno.id, blanco.id);
  afirmar(
    "error" in rechazoBlanco,
    "un examen blanco no se puede empezar aunque se escriba su id a mano",
  );

  // La otra mitad de la guarda del recorrido, la que nunca se había afirmado:
  // es la que impide que un alumno se autoasigne una clase particular —o
  // cualquier otra cosa— escribiendo un id a mano en el formulario.
  const rechazoFantasma = await abrirPractica(alumno.id, "recorrido-que-no-existe");
  afirmar(
    "error" in rechazoFantasma,
    "un recorrido inexistente no se puede empezar",
  );

  const particular = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · clase particular`,
      nivel: "B1",
      tipo: "CLASES_PARTICULARES",
      orden: 1,
      publicado: true,
    },
    select: { id: true },
  });
  creados.recorridos.push(particular.id);

  const rechazoParticular = await abrirPractica(alumno.id, particular.id);
  afirmar(
    "error" in rechazoParticular,
    "una clase particular no se puede autoasignar escribiendo su id a mano",
  );
  afirmar(
    (await prisma.asignacion.count({ where: { recorridoId: particular.id } })) === 0,
    "y no se crea ninguna asignación de la clase particular",
  );

  const rechazoSinGrupo = await abrirPractica(huerfano.id, publicado.id);
  afirmar("error" in rechazoSinGrupo, "un alumno sin grupo recibe el motivo");
  afirmar(
    (await prisma.asignacion.count({ where: { estudianteId: huerfano.id } })) === 0,
    "y no se le crea ninguna asignación",
  );

  const abierta = await abrirPractica(alumno.id, publicado.id);
  afirmar("asignacionId" in abierta, "un alumno con grupo sí puede empezar");
  const asignacion = await prisma.asignacion.findFirstOrThrow({
    where: { estudianteId: alumno.id, recorridoId: publicado.id },
    select: { id: true, profesorId: true, archivada: true },
  });
  afirmar(
    asignacion.profesorId === profe.id,
    "la asignación nace con el profesor de su grupo",
  );

  // La carrera perdida: el caso realista es un doble clic, no dos pestañas
  // pensadas a propósito, así que se provoca con dos llamadas concurrentes de
  // verdad. Las dos pasan por el `findUnique` de guardia sin encontrar nada
  // -`concurrente` no tiene asignación previa de `publicado`- y las dos llegan
  // al `create`; una gana, la otra choca contra la unicidad. Sin el catch de
  // P2002 en `abrirPractica`, el `Promise.all` revienta con el error crudo de
  // Prisma y esta afirmación ni se alcanza.
  const [primero, segundo] = await Promise.all([
    abrirPractica(concurrente.id, publicado.id),
    abrirPractica(concurrente.id, publicado.id),
  ]);
  afirmar(
    "asignacionId" in primero && "asignacionId" in segundo,
    `un doble clic no revienta: las dos llamadas concurrentes vuelven con éxito (dijeron: ${JSON.stringify(primero)}, ${JSON.stringify(segundo)})`,
  );
  if ("asignacionId" in primero && "asignacionId" in segundo) {
    afirmar(
      primero.asignacionId === segundo.asignacionId,
      "y las dos apuntan a la misma asignación: la que ganó la carrera",
    );
  }
  afirmar(
    (await prisma.asignacion.count({ where: { estudianteId: concurrente.id, recorridoId: publicado.id } })) === 1,
    "la carrera perdida no deja una segunda asignación",
  );

  // La carrera de arriba prueba que un doble clic no revienta, pero no
  // garantiza tocar el `catch` de P2002: si las dos llamadas se serializan, la
  // segunda sale por el `findUnique` de guardia y la afirmación pasa igual con
  // el `catch` borrado. Así que se provoca el choque a mano, en la única
  // ventana donde puede ocurrir: se sustituye la guardia por una que, después
  // de mirar y no encontrar nada, mete la fila. El `create` de `abrirPractica`
  // choca entonces siempre, y esta afirmación falla si alguien quita el
  // `catch`.
  const delegado = prisma.asignacion as unknown as Record<string, unknown>;
  const guardiaOriginal = delegado.findUnique as (...args: unknown[]) => Promise<unknown>;
  let filaColada: string | null = null;
  let resultadoColado: Awaited<ReturnType<typeof abrirPractica>>;
  try {
    delegado.findUnique = async (...args: unknown[]) => {
      const vista = await guardiaOriginal.apply(prisma.asignacion, args);
      // Solo la primera vez: `abrirPractica` mira una sola vez, pero si un día
      // mirara dos, la segunda no debe volver a intentar crear.
      if (vista === null && filaColada === null) {
        const fila = await prisma.asignacion.create({
          data: { estudianteId: colado.id, recorridoId: publicado.id, profesorId: profe.id },
          select: { id: true },
        });
        filaColada = fila.id;
      }
      return vista;
    };
    resultadoColado = await abrirPractica(colado.id, publicado.id);
  } finally {
    delegado.findUnique = guardiaOriginal;
  }
  afirmar(filaColada !== null, "la fila se coló entre la guardia y el create");
  afirmar(
    "asignacionId" in resultadoColado && resultadoColado.asignacionId === filaColada,
    `el P2002 se recoge y devuelve la asignación que ya estaba (dijo: ${JSON.stringify(resultadoColado)})`,
  );
  afirmar(
    (await prisma.asignacion.count({ where: { estudianteId: colado.id, recorridoId: publicado.id } })) === 1,
    "y sigue habiendo una sola asignación",
  );

  // La otra mitad de `catalogoDeBloque`, la que cruza recorridos con
  // asignaciones, no tenía prueba con un estudianteId real: hasta aquí solo
  // se había ejercitado con `null`. Se comprueba aquí, con la asignación recién
  // abierta y todavía sin tocar, antes de que el resto de la puerta la archive
  // o le cambie el dueño.
  const catalogoDelAlumno = await catalogoDeBloque(2, alumno.id);
  const tarjetaAlumno = catalogoDelAlumno.find((t) => t.recorridoId === publicado.id);
  afirmar(
    tarjetaAlumno?.estado.clase === "SIN_EMPEZAR",
    "con asignación pero sin pasos hechos, la tarjeta del alumno está sin empezar",
  );

  const pasoDePublicado = await prisma.paso.findFirstOrThrow({
    where: { recorridoId: publicado.id },
    select: { id: true },
  });
  const pasoCompletado = await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: pasoDePublicado.id },
    select: { id: true },
  });
  creados.pasosCompletados.push(pasoCompletado.id);

  const catalogoTrasUnPaso = await catalogoDeBloque(2, alumno.id);
  const tarjetaTrasUnPaso = catalogoTrasUnPaso.find((t) => t.recorridoId === publicado.id);
  afirmar(
    tarjetaTrasUnPaso?.estado.clase === "A_MEDIAS" &&
      tarjetaTrasUnPaso.estado.hechos === 1 &&
      tarjetaTrasUnPaso.estado.total === 2,
    "con un paso de dos hecho, la tarjeta del alumno está a medias (1 de 2)",
  );

  // ─── El bloque 3: solo lo que su profe le abrió ────────────────────────
  // `blanco` está publicado, así que antes salía en el catálogo de cualquiera.
  const blancoSinAsignar = await catalogoDeBloque(3, huerfano.id);
  afirmar(
    !blancoSinAsignar.some((t) => t.recorridoId === blanco.id),
    "un examen blanco publicado no sale a quien no se lo asignaron",
  );
  afirmar(
    (await catalogoDeBloque(3, null)).length === 0,
    "y sin sesión, el bloque 3 no enseña nada",
  );

  const asignacionBlanca = await prisma.asignacion.create({
    data: { estudianteId: alumno.id, recorridoId: blanco.id, profesorId: profe.id },
    select: { id: true },
  });

  const blancoDelAlumno = await catalogoDeBloque(3, alumno.id);
  const tarjetaBlanca = blancoDelAlumno.find((t) => t.recorridoId === blanco.id);
  afirmar(
    tarjetaBlanca !== undefined,
    "a quien sí se lo asignaron, el examen blanco le sale",
  );
  // El agujero que dejaba al alumno sin puerta: asignado y sin tocar nada.
  afirmar(
    tarjetaBlanca?.estado.clase === "SIN_EMPEZAR",
    "y asignado sin pasos hechos es «sin empezar», no «sin asignar»",
  );

  // Y el contador de la portada cuenta lo mismo que se lista.
  const cuentaAlumno = await cuantosPorBloque(BLOQUES, alumno.id);
  const cuentaHuerfano = await cuantosPorBloque(BLOQUES, huerfano.id);
  afirmar(
    (cuentaAlumno.get(3) ?? 0) === 1,
    `el alumno con un examen blanco abierto cuenta 1 (contó ${cuentaAlumno.get(3)})`,
  );
  afirmar(
    (cuentaHuerfano.get(3) ?? 0) === 0,
    `quien no tiene ninguno cuenta 0 (contó ${cuentaHuerfano.get(3)})`,
  );
  afirmar(
    (cuentaHuerfano.get(2) ?? 0) >= 1,
    "y en un bloque autoservicio se sigue contando lo publicado",
  );

  // Archivar el examen blanco lo retira del catálogo: devolvérselo sería
  // desarchivarlo de mentira.
  await prisma.asignacion.update({
    where: { id: asignacionBlanca.id },
    data: { archivada: true },
  });
  afirmar(
    !(await catalogoDeBloque(3, alumno.id)).some((t) => t.recorridoId === blanco.id),
    "un examen blanco archivado deja de salir en el bloque 3",
  );
  afirmar(
    ((await cuantosPorBloque(BLOQUES, alumno.id)).get(3) ?? 0) === 0,
    "y el contador de la portada tampoco lo cuenta",
  );

  // Si ya la tenía, empezar otra vez no toca nada. Es lo que separa esta
  // puerta de `asignarA`, cuyo upsert desarchivaría y reescribiría el dueño.
  await prisma.asignacion.update({
    where: { id: asignacion.id },
    data: { archivada: true, profesorId: huerfano.id },
  });
  const segunda = await abrirPractica(alumno.id, publicado.id);
  afirmar("asignacionId" in segunda, "empezar dos veces no da error, lleva a la suya");
  const despues = await prisma.asignacion.findUniqueOrThrow({
    where: { id: asignacion.id },
    select: { archivada: true, profesorId: true },
  });
  afirmar(despues.archivada === true, "no desarchiva la que su profe archivó");
  afirmar(despues.profesorId === huerfano.id, "ni le cambia el dueño a la entrega");
  afirmar(
    (await prisma.asignacion.count({ where: { estudianteId: alumno.id, recorridoId: publicado.id } })) === 1,
    "y no crea una segunda",
  );

  // Y en el catálogo esa asignación archivada ya no se disfraza de «empezar»:
  // el botón no habría creado nada y el enlace llevaba a trabajo retirado.
  const catalogoArchivado = await catalogoDeBloque(2, alumno.id);
  afirmar(
    catalogoArchivado.find((t) => t.recorridoId === publicado.id)?.estado.clase === "ARCHIVADA",
    "una asignación archivada se pinta archivada, no «sin empezar»",
  );

  // Un grupo archivado cuenta como no tener grupo: su profesor ya no responde
  // por ese alumno.
  await prisma.grupo.update({ where: { id: grupo.id }, data: { archivado: true } });
  afirmar(
    (await profesorDelEstudiante(alumno.id)) === null,
    "con el grupo archivado, el alumno se queda sin profesor",
  );

  // ─── El desempate de dos tarjetas que se leerían igual ─────────────────
  // El caso real: la lectura de mayo 2015 y la del modelo 0 comparten nivel y
  // prueba, así que sin esto salen dos tarjetas idénticas.
  const comoTarjeta = (id: string, titulo: string, destreza: "CE" | "CO"): Tarjeta => ({
    recorridoId: id,
    titulo,
    nivel: "A2_B1_ESCOLAR",
    destreza,
    examen: null,
    pasos: 4,
    estado: { clase: "SIN_ASIGNAR" },
  });

  const gemelas = distintivos([
    comoTarjeta("a", "A2/B1 escolar \u00b7 Comprensi\u00f3n de lectura (mayo 2015)", "CE"),
    comoTarjeta("b", "A2/B1 escolar \u00b7 Comprensi\u00f3n de lectura (modelo 0)", "CE"),
    comoTarjeta("c", "A2/B1 escolar \u00b7 Comprensi\u00f3n auditiva (mayo 2015)", "CO"),
  ]);
  afirmar(gemelas.get("a") === "mayo 2015", `la que choca lleva su par\u00e9ntesis (dice ${gemelas.get("a")})`);
  afirmar(gemelas.get("b") === "modelo 0", `y la otra el suyo (dice ${gemelas.get("b")})`);
  afirmar(!gemelas.has("c"), "la que no choca con nadie no gana distintivo");

  const sinParentesis = distintivos([
    comoTarjeta("d", "Lectura suelta", "CE"),
    comoTarjeta("e", "Otra lectura", "CE"),
  ]);
  afirmar(sinParentesis.get("d") === "Lectura suelta", "sin par\u00e9ntesis se cae al t\u00edtulo entero");

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

    // No lo exige la clave foránea: `PasoCompletado` cuelga de `Asignacion`
    // con `onDelete: Cascade` y se iría solo. Se borra a mano y primero para
    // que la limpieza avise si un día ese cascade desaparece, en vez de dejar
    // filas sueltas en silencio.
    for (const id of creados.pasosCompletados) {
      await intentar("paso completado", () => prisma.pasoCompletado.delete({ where: { id } }));
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
