/**
 * Pone una contraseña nueva a una cuenta y la imprime UNA vez. Para el
 * profesor el día del despliegue y como salida de emergencia. Contra
 * producción: DATABASE_URL="<url pública de Neon>" npx tsx scripts/poner-contrasena.ts correo@ejemplo.com
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { normalizarCorreo, ponerContrasenaNueva } from "@/lib/entrada";

async function main() {
  const correo = process.argv[2];
  if (!correo) {
    console.error("Uso: npx tsx scripts/poner-contrasena.ts <correo>");
    process.exit(2);
  }
  const usuario = await prisma.user.findUnique({ where: { email: normalizarCorreo(correo) } });
  if (!usuario) {
    console.error(`No hay ninguna cuenta con el correo ${correo}.`);
    process.exit(1);
  }
  const clara = await ponerContrasenaNueva(usuario.id);
  console.log(`Contraseña nueva para ${usuario.email} (${usuario.role}): ${clara}`);
  console.log("Al entrar tendrá que cambiarla. Sus sesiones abiertas se han cerrado.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
