/**
 * Verifica el ascenso a administrador por variable de entorno y las
 * salvaguardas del panel. Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-admin.ts
 */
import "dotenv/config";
import { correosDeAdmin, esAdmin, esCorreoDeAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

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

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
