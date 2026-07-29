/**
 * Verifica el ascenso a administrador por variable de entorno y las
 * salvaguardas del panel. Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-admin.ts
 */
import "dotenv/config";
import { correosDeAdmin, esAdmin, esCorreoDeAdmin } from "@/lib/roles";
import { ascenderSiEsAdmin } from "@/lib/usuario";
import { puedeQuitarseElRol } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

// Marca única para no chocar con datos reales ni con otra ejecución.
const marca = `verificar-admin-${process.pid}`;

async function main() {
  // 1. La lista se lee, se normaliza y tolera espacios y mayúsculas.
  process.env.ADMIN_EMAILS = " Ana@Ejemplo.com , bruno@ejemplo.com ";
  const lista = correosDeAdmin();
  afirmar(lista.length === 2, "lee los dos correos de la variable");
  afirmar(lista.includes("ana@ejemplo.com"), "pasa a minúsculas");
  afirmar(lista.includes("bruno@ejemplo.com"), "quita los espacios");
  afirmar(esCorreoDeAdmin("ANA@ejemplo.com"), "compara sin distinguir mayúsculas");
  afirmar(!esCorreoDeAdmin("carla@ejemplo.com"), "un correo ausente no es de administrador");

  // 2. Sin variable, nadie es administrador por correo.
  delete process.env.ADMIN_EMAILS;
  afirmar(correosDeAdmin().length === 0, "sin la variable, la lista está vacía");
  afirmar(!esCorreoDeAdmin("ana@ejemplo.com"), "sin la variable, ningún correo asciende");

  // 3. esAdmin distingue los tres roles.
  afirmar(esAdmin({ role: "ADMIN" }), "un ADMIN es administrador");
  afirmar(!esAdmin({ role: "PROFESOR" }), "un PROFESOR no es administrador");
  afirmar(!esAdmin({ role: "STUDENT" }), "un STUDENT no es administrador");
  afirmar(!esAdmin(null), "sin sesión, no es administrador");

  // 4. ascenderSiEsAdmin contra filas reales: la parte que de verdad toca la
  // base de datos, no solo la lógica pura de arriba.
  const correoAscendido = `admin-${marca}@ejemplo.test`;
  const correoYaAdmin = `yaadmin-${marca}@ejemplo.test`;
  const correoEstudiante = `alumno-${marca}@ejemplo.test`;
  const correoProfesor = `profe-${marca}@ejemplo.test`;
  process.env.ADMIN_EMAILS = `${correoAscendido}, ${correoYaAdmin}`;

  const estudianteAAscender = await prisma.user.create({
    data: { email: correoAscendido, role: "STUDENT" },
  });
  const yaAdmin = await prisma.user.create({
    data: { email: correoYaAdmin, role: "ADMIN" },
  });
  const estudianteFuera = await prisma.user.create({
    data: { email: correoEstudiante, role: "STUDENT" },
  });
  const profesorFuera = await prisma.user.create({
    data: { email: correoProfesor, role: "PROFESOR" },
  });

  try {
    // 4a. Un STUDENT cuyo correo está en la lista pasa a ADMIN de verdad en
    // la base de datos, no solo en el objeto devuelto.
    await ascenderSiEsAdmin(estudianteAAscender);
    const releido = await prisma.user.findUnique({
      where: { id: estudianteAAscender.id },
    });
    afirmar(releido?.role === "ADMIN", "el correo de la lista asciende a ADMIN en la base de datos");

    // 4b. Repetirlo sobre el ya ascendido no escribe una segunda vez: si
    // hubiera update(), @updatedAt lo delataría.
    const actualizadoTrasAscenso = releido!.updatedAt;
    await ascenderSiEsAdmin(releido!);
    const releidoOtraVez = await prisma.user.findUnique({
      where: { id: estudianteAAscender.id },
    });
    afirmar(
      releidoOtraVez?.updatedAt.getTime() === actualizadoTrasAscenso.getTime(),
      "repetir el ascenso sobre un ADMIN no vuelve a escribir",
    );

    // 4c. Un correo fuera de la lista no asciende, sea STUDENT o PROFESOR.
    await ascenderSiEsAdmin(estudianteFuera);
    const estudianteReleido = await prisma.user.findUnique({
      where: { id: estudianteFuera.id },
    });
    afirmar(estudianteReleido?.role === "STUDENT", "un STUDENT fuera de la lista sigue STUDENT");

    await ascenderSiEsAdmin(profesorFuera);
    const profesorReleido = await prisma.user.findUnique({
      where: { id: profesorFuera.id },
    });
    afirmar(profesorReleido?.role === "PROFESOR", "un PROFESOR fuera de la lista sigue PROFESOR, no asciende por error");

    // 4d. Un ADMIN ya existente cuyo correo también está en la lista se
    // queda igual y tampoco se escribe.
    const actualizadoYaAdmin = yaAdmin.updatedAt;
    await ascenderSiEsAdmin(yaAdmin);
    const yaAdminReleido = await prisma.user.findUnique({ where: { id: yaAdmin.id } });
    afirmar(yaAdminReleido?.role === "ADMIN", "un ADMIN de la lista sigue ADMIN");
    afirmar(
      yaAdminReleido?.updatedAt.getTime() === actualizadoYaAdmin.getTime(),
      "un ADMIN ya ascendido no genera una escritura de más",
    );
  } finally {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            estudianteAAscender.id,
            yaAdmin.id,
            estudianteFuera.id,
            profesorFuera.id,
          ],
        },
      },
    });
  }

  // 5. Salvaguarda: no se puede dejar la plataforma sin administradores.
  // Reutiliza la `marca` del módulo: declararla otra vez aquí ensombrecería
  // (TDZ) su uso más arriba en esta misma función.
  const unico = await prisma.user.create({
    data: { email: `admin1-${marca}@ejemplo.test`, role: "ADMIN" },
  });
  try {
    afirmar(
      (await puedeQuitarseElRol(unico.id)) === false,
      "al último administrador no se le puede quitar el rol",
    );

    const segundo = await prisma.user.create({
      data: { email: `admin2-${marca}@ejemplo.test`, role: "ADMIN" },
    });
    afirmar(
      (await puedeQuitarseElRol(unico.id)) === true,
      "con dos administradores, a uno sí se le puede quitar",
    );

    await prisma.user.update({ where: { id: segundo.id }, data: { role: "PROFESOR" } });
    afirmar(
      (await puedeQuitarseElRol(unico.id)) === false,
      "un profesor no cuenta como administrador de repuesto",
    );

    await prisma.user.delete({ where: { id: segundo.id } });
  } finally {
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
  }

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
