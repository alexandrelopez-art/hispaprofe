/**
 * Verifica el bloqueo, la supresión y el borrado de clases. Crea sus propios
 * datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-personas.ts
 */
import "dotenv/config";
import { estaBloqueado, estaSuprimido } from "@/lib/roles";
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
