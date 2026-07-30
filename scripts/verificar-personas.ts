/**
 * Verifica el bloqueo, la supresión y el borrado de clases. Crea sus propios
 * datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-personas.ts
 */
import "dotenv/config";
import { estaBloqueado, estaSuprimido } from "@/lib/roles";
import {
  bloquear,
  desbloquear,
  puedeBloquearse,
  puedeHacerseProfesor,
  puedeSuprimirse,
  suprimir,
} from "@/lib/admin";
import { borrarClase, sePuedeBorrar } from "@/lib/clases";
import {
  estudianteAsignable,
  listarEstudiantesElegibles,
} from "@/lib/estudiantes";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-personas-${process.pid}`;

/**
 * Los ids de todo lo que se crea, para poder limpiarlo al final.
 *
 * No basta con borrar por el correo: suprimir a alguien le cambia el correo
 * a `suprimido-<id>@hispaprofe.invalid`, que ya no lleva la marca. Sin esta
 * lista, la fila suprimida se quedaría en la base para siempre.
 */
const creados: string[] = [];

async function nuevaPersona(
  sufijo: string,
  datos: { role?: "STUDENT" | "PROFESOR" | "ADMIN" } = {},
) {
  const fila = await prisma.user.create({
    data: { email: `${sufijo}-${marca}@ejemplo.test`, role: datos.role ?? "STUDENT" },
  });
  creados.push(fila.id);
  return fila;
}

async function main() {
  // 1. Las dos funciones puras.
  afirmar(estaBloqueado({ bloqueadoEl: new Date() }), "con fecha, está bloqueado");
  afirmar(!estaBloqueado({ bloqueadoEl: null }), "sin fecha, no está bloqueado");
  afirmar(!estaBloqueado(null), "sin persona, no está bloqueado");
  afirmar(estaSuprimido({ suprimidoEl: new Date() }), "con fecha, está suprimido");
  afirmar(!estaSuprimido({ suprimidoEl: null }), "sin fecha, no está suprimido");
  afirmar(!estaSuprimido(undefined), "sin persona, no está suprimido");

  // 2. Bloquear: la fecha, las clases futuras y las dos negativas.
  const profe = await nuevaPersona("profe", { role: "PROFESOR" });
  const ana = await nuevaPersona("ana");
  const otroAdmin = await nuevaPersona("admin1", { role: "ADMIN" });

  const ayer = new Date(Date.now() - 86_400_000);
  const manana = new Date(Date.now() + 86_400_000);

  const futura = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: manana,
      minutos: 60,
    },
  });
  const pasada = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: ayer,
      minutos: 60,
      estado: "DADA",
      importeCentimos: 2000,
    },
  });

  afirmar(
    (await puedeBloquearse(ana.id, otroAdmin.id)) === null,
    "a un estudiante cualquiera se le puede bloquear",
  );
  afirmar(
    (await puedeBloquearse(otroAdmin.id, otroAdmin.id)) !== null,
    "nadie se bloquea a sí mismo",
  );

  await bloquear(ana.id);
  const anaBloqueada = await prisma.user.findUniqueOrThrow({ where: { id: ana.id } });
  afirmar(anaBloqueada.bloqueadoEl !== null, "bloquear pone la fecha");
  afirmar(
    (await prisma.clase.findUniqueOrThrow({ where: { id: futura.id } })).estado ===
      "ANULADA",
    "bloquear anula su clase futura",
  );
  afirmar(
    (await prisma.clase.findUniqueOrThrow({ where: { id: pasada.id } })).estado ===
      "DADA",
    "bloquear no toca la clase que ya se dio",
  );
  afirmar(
    (await prisma.clase.findUniqueOrThrow({ where: { id: pasada.id } }))
      .importeCentimos === 2000,
    "ni su importe",
  );

  // Una clase de un grupo donde solo es miembro no es suya: no se anula.
  const grupo = await prisma.grupo.create({
    data: {
      nombre: `Grupo ${marca}`,
      profesorId: profe.id,
      miembros: { create: [{ estudianteId: ana.id }] },
    },
  });
  const deGrupo = await prisma.clase.create({
    data: { profesorId: profe.id, grupoId: grupo.id, empiezaEl: manana, minutos: 60 },
  });
  const primerBloqueo = anaBloqueada.bloqueadoEl;
  await bloquear(ana.id);
  afirmar(
    (await prisma.clase.findUniqueOrThrow({ where: { id: deGrupo.id } })).estado ===
      "AGENDADA",
    "bloquear no toca la clase de un grupo donde solo es miembro",
  );
  // El «desde cuándo» es toda la razón de que sea una fecha y no un booleano:
  // bloquear otra vez no puede reescribirlo.
  afirmar(
    (
      await prisma.user.findUniqueOrThrow({ where: { id: ana.id } })
    ).bloqueadoEl?.getTime() === primerBloqueo?.getTime(),
    "bloquear a quien ya estaba bloqueado no cambia la fecha original",
  );

  // Bloquear a un profesor sí anula las clases que él daba.
  const suya = await prisma.clase.create({
    data: { profesorId: profe.id, estudianteId: ana.id, empiezaEl: manana, minutos: 60 },
  });
  await bloquear(profe.id);
  afirmar(
    (await prisma.clase.findUniqueOrThrow({ where: { id: suya.id } })).estado ===
      "ANULADA",
    "bloquear a un profesor anula las clases que iba a dar",
  );

  // Desbloquear quita la fecha y no resucita nada.
  afirmar(await desbloquear(ana.id), "desbloquear a un bloqueado devuelve true");
  afirmar(
    (await prisma.user.findUniqueOrThrow({ where: { id: ana.id } })).bloqueadoEl ===
      null,
    "desbloquear quita la fecha",
  );
  afirmar(
    (await prisma.clase.findUniqueOrThrow({ where: { id: futura.id } })).estado ===
      "ANULADA",
    "desbloquear no resucita las clases anuladas",
  );

  // El último administrador que puede entrar no se bloquea.
  const soloUno =
    (await prisma.user.count({ where: { role: "ADMIN", bloqueadoEl: null } })) === 1;
  if (soloUno) {
    afirmar(
      (await puedeBloquearse(otroAdmin.id, ana.id)) !== null,
      "al último administrador no se le puede bloquear",
    );
  } else {
    const otro = await nuevaPersona("admin2", { role: "ADMIN" });
    // La guarda vive en puedeBloquearse, no en bloquear: hay que ejercitarla
    // a ella, y no solo comprobar que bloquear() puso la fecha.
    afirmar(
      (await puedeBloquearse(otro.id, ana.id)) === null,
      "con más de un administrador, a uno sí se le puede bloquear",
    );
    await bloquear(otro.id);
    afirmar(
      (await prisma.user.findUniqueOrThrow({ where: { id: otro.id } }))
        .bloqueadoEl !== null,
      "y bloquear lo bloquea de verdad",
    );
  }

  // 3. Suprimir: exige bloqueo, vacía la ficha y deja las clases en pie.
  const bea = await nuevaPersona("bea");
  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Secuencia ${marca}`, nivel: "A1", orden: 999, autorId: bea.id },
  });
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: bea.id, profesorId: profe.id, recorridoId: recorrido.id },
  });
  const suClase = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: bea.id,
      empiezaEl: ayer,
      minutos: 90,
      estado: "DADA",
      importeCentimos: 3000,
      deberes: "Algo que hacer.",
    },
  });
  await prisma.deber.create({ data: { claseId: suClase.id, estudianteId: bea.id } });
  await prisma.miembroGrupo.create({
    data: { grupoId: grupo.id, estudianteId: bea.id },
  });

  afirmar(
    (await puedeSuprimirse(bea.id, otroAdmin.id)) !== null,
    "a quien no está bloqueado no se le puede suprimir",
  );

  await bloquear(bea.id);
  afirmar(
    (await puedeSuprimirse(bea.id, otroAdmin.id)) === null,
    "una vez bloqueado, sí",
  );
  afirmar(
    (await puedeSuprimirse(otroAdmin.id, otroAdmin.id)) !== null,
    "nadie se suprime a sí mismo",
  );

  await suprimir(bea.id);
  const lapida = await prisma.user.findUniqueOrThrow({ where: { id: bea.id } });

  afirmar(lapida.suprimidoEl !== null, "suprimir pone la fecha");
  afirmar(lapida.firstName === null && lapida.lastName === null, "se va el nombre");
  afirmar(lapida.clerkId === null, "se va la cuenta de acceso");
  afirmar(lapida.role === "STUDENT", "la lápida se queda sin poderes");
  afirmar(
    lapida.email === `suprimido-${bea.id}@hispaprofe.invalid`,
    "el correo se sustituye por uno que no es de nadie",
  );
  afirmar(
    (await prisma.asignacion.count({ where: { id: asignacion.id } })) === 0,
    "se van sus asignaciones y con ellas su progreso",
  );
  afirmar(
    (await prisma.deber.count({ where: { estudianteId: bea.id } })) === 0,
    "se van sus deberes",
  );
  afirmar(
    (await prisma.miembroGrupo.count({ where: { estudianteId: bea.id } })) === 0,
    "se va de los grupos",
  );

  const claseViva = await prisma.clase.findUniqueOrThrow({ where: { id: suClase.id } });
  afirmar(claseViva.estado === "DADA", "su clase sigue en pie");
  afirmar(claseViva.importeCentimos === 3000, "con su importe intacto");
  afirmar(claseViva.estudianteId === bea.id, "y sigue apuntando a la lápida");

  afirmar(
    (await prisma.recorrido.findUniqueOrThrow({ where: { id: recorrido.id } }))
      .autorId === null,
    "lo que escribió se queda sin autor, no se borra",
  );
  afirmar(
    (await puedeSuprimirse(bea.id, otroAdmin.id)) !== null,
    "a una ficha ya suprimida no se le puede volver a suprimir",
  );

  // Un bloqueado que no está suprimido: hace falta para las dos mitades del
  // filtro, la que echa fuera y la que no.
  const dani = await nuevaPersona("dani");
  await bloquear(dani.id);

  // A una lápida no se le puede volver a hacer nada: si sale en una lista de
  // estudiantes, un clic normal le crea asignaciones y progreso nuevos, que
  // es justo lo que la supresión borró.
  const elegibles = await listarEstudiantesElegibles({ select: { id: true } });
  afirmar(
    !elegibles.some((e) => e.id === bea.id),
    "una ficha suprimida no sale entre los estudiantes elegibles",
  );
  afirmar(
    elegibles.some((e) => e.id === ana.id),
    "y un estudiante normal sí sale",
  );
  // La otra mitad, la que el diseño prohíbe estrechar: bloquear cierra la
  // puerta, no borra de las listas. Sin esta aserción, añadir un
  // `bloqueadoEl: null` al filtro pasaría sin que nada se quejase.
  afirmar(
    elegibles.some((e) => e.id === dani.id),
    "un estudiante bloqueado sigue saliendo entre los elegibles",
  );

  // Quitarla de los desplegables y de las listas es solo interfaz: una
  // pestaña vieja o una petición fabricada siguen mandando su id, y la
  // comprobación tiene que estar donde se escribe —la clase, la asignación o
  // los puntos importados—, que son justo las tablas que la supresión borró.
  afirmar(
    (await estudianteAsignable(bea.id)) === false,
    "no se le agenda una clase ni se le asigna nada a una ficha suprimida",
  );
  afirmar(await estudianteAsignable(ana.id), "a un estudiante normal sí");
  afirmar(
    await estudianteAsignable(dani.id),
    "y a un bloqueado también: su ficha sigue siendo de alguien",
  );
  afirmar(
    await estudianteAsignable(null),
    "y una clase de grupo no lleva estudiante que comprobar",
  );

  // Toda lápida se queda como STUDENT a propósito, así que el panel le pinta
  // encima el botón «Hacer profesor»: sin esta guarda, un clic corriente le
  // devuelve los poderes que la supresión le quitó.
  afirmar(
    (await puedeHacerseProfesor(bea.id)) === false,
    "a una ficha suprimida no se le puede hacer profesor",
  );
  afirmar(
    await puedeHacerseProfesor(ana.id),
    "a un estudiante de verdad sí se le puede",
  );
  afirmar(
    (await puedeHacerseProfesor(otroAdmin.id)) === false,
    "y a un administrador no se le baja de rango por este camino",
  );

  // Quien está suprimido está bloqueado por definición: desbloquear una
  // lápida dejaría el estado que el diseño declara imposible.
  afirmar(
    (await desbloquear(bea.id)) === false,
    "desbloquear se niega sobre una ficha suprimida y devuelve false",
  );
  afirmar(
    (await prisma.user.findUniqueOrThrow({ where: { id: bea.id } }))
      .bloqueadoEl !== null,
    "y la lápida se queda con su fecha de bloqueo",
  );

  // Dos supresiones seguidas no chocan por el correo.
  const carla = await nuevaPersona("carla");
  await bloquear(carla.id);
  await suprimir(carla.id);
  afirmar(
    (await prisma.user.findUniqueOrThrow({ where: { id: carla.id } })).email !==
      lapida.email,
    "dos fichas suprimidas no chocan por el correo",
  );

  // El freno del último administrador ya lo puso el bloqueo: a quien llega
  // aquí bloqueado se le puede suprimir si queda otro administrador activo.
  const adminActivo = await nuevaPersona("adminActivo", { role: "ADMIN" });
  const adminSaliente = await nuevaPersona("adminSaliente", { role: "ADMIN" });
  await bloquear(adminSaliente.id);
  afirmar(
    (await puedeSuprimirse(adminSaliente.id, adminActivo.id)) === null,
    "a un administrador bloqueado se le puede suprimir si queda otro activo",
  );
  await suprimir(adminSaliente.id);
  afirmar(
    (await prisma.user.findUniqueOrThrow({ where: { id: adminSaliente.id } }))
      .role === "STUDENT",
    "y al suprimirlo su rol baja a STUDENT",
  );

  // 4. Borrar una clase: nunca una que ya se dio.
  afirmar(sePuedeBorrar("AGENDADA"), "una agendada se puede borrar");
  afirmar(sePuedeBorrar("ANULADA"), "una anulada también");
  afirmar(!sePuedeBorrar("DADA"), "una dada no");

  const borrable = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: manana,
      minutos: 45,
      deberes: "Deberes que deben irse con ella.",
    },
  });
  await prisma.deber.create({ data: { claseId: borrable.id, estudianteId: ana.id } });

  afirmar(await borrarClase(borrable.id), "borrar una agendada devuelve true");
  afirmar(
    (await prisma.clase.count({ where: { id: borrable.id } })) === 0,
    "y la clase ya no está",
  );
  afirmar(
    (await prisma.deber.count({ where: { claseId: borrable.id } })) === 0,
    "sus deberes se van con ella",
  );

  afirmar(
    (await borrarClase(suClase.id)) === false,
    "borrar una clase dada no hace nada y devuelve false",
  );
  afirmar(
    (await prisma.clase.count({ where: { id: suClase.id } })) === 1,
    "la clase dada sigue ahí",
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
    // Por id y no por correo: ver el comentario de `creados`. El orden
    // importa porque Clase.profesorId es RESTRICT.
    await prisma.deber.deleteMany({ where: { estudianteId: { in: creados } } });
    await prisma.clase.deleteMany({
      where: {
        OR: [
          { profesorId: { in: creados } },
          { estudianteId: { in: creados } },
        ],
      },
    });
    await prisma.miembroGrupo.deleteMany({ where: { estudianteId: { in: creados } } });
    await prisma.grupo.deleteMany({ where: { profesorId: { in: creados } } });
    await prisma.asignacion.deleteMany({
      where: {
        OR: [
          { estudianteId: { in: creados } },
          { profesorId: { in: creados } },
        ],
      },
    });
    // Después de las asignaciones: Asignacion.recorridoId es RESTRICT. Y por
    // el título y no por el autor, porque suprimir deja el autor en null.
    await prisma.recorrido.deleteMany({ where: { titulo: { contains: marca } } });
    await prisma.user.deleteMany({ where: { id: { in: creados } } });
    await prisma.$disconnect();
  });
