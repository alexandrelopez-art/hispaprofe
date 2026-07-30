/**
 * Verifica el bloqueo, la supresión y el borrado de clases. Crea sus propios
 * datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-personas.ts
 */
import "dotenv/config";
import { estaBloqueado, estaSuprimido } from "@/lib/roles";
import { bloquear, desbloquear, puedeBloquearse } from "@/lib/admin";
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
  await bloquear(ana.id);
  afirmar(
    (await prisma.clase.findUniqueOrThrow({ where: { id: deGrupo.id } })).estado ===
      "AGENDADA",
    "bloquear no toca la clase de un grupo donde solo es miembro",
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
  await desbloquear(ana.id);
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

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
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
