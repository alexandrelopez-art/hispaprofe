/**
 * Verifica la puerta: contraseñas, intentos, sesiones y contraseña nueva.
 * Crea sus propios datos con marca única y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-entrada.ts
 */
import "dotenv/config";
import {
  ALFABETO_LEGIBLE,
  cifrarContrasena,
  comprobarContrasena,
  generarContrasena,
  validarContrasena,
} from "@/lib/contrasena";
import { prisma } from "@/lib/prisma";
import {
  MAX_INTENTOS,
  MINUTOS_DE_CASTIGO,
  destinoSeguro,
  guardarContrasena,
  intentarEntrar,
  motivoParaNoPonerContrasena,
  ponerContrasenaNueva,
} from "@/lib/entrada";
import {
  DIAS_DE_SESION,
  borrarSesionPorToken,
  cerrarSesionesDe,
  crearSesion,
  hashDeToken,
  usuarioPorToken,
} from "@/lib/sesion";

// Marca única para no chocar con datos reales ni con otra ejecución.
const marca = `verificar-entrada-${process.pid}`;

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

// Reglas puras: nada toca la base, así que van antes y sin await.
function reglasPuras() {
  console.log("\n— Reglas puras —");

  afirmar(destinoSeguro(null) === "/dashboard", "sin volver → /dashboard");
  afirmar(destinoSeguro("") === "/dashboard", "volver vacío → /dashboard");
  afirmar(
    destinoSeguro("/recorridos?x=1") === "/recorridos?x=1",
    "una ruta propia con query se conserva tal cual",
  );
  afirmar(destinoSeguro("//evil.com") === "/dashboard", "// es un cambio de dominio, no una ruta");
  afirmar(
    destinoSeguro("/\\evil.com") === "/dashboard",
    "el navegador lee \\ como //, así que es igual de peligroso",
  );
  afirmar(
    destinoSeguro("https://evil.com/a") === "/dashboard",
    "un esquema completo tampoco es de esta casa",
  );
  afirmar(destinoSeguro("recorridos") === "/dashboard", "sin barra inicial no es una ruta");
  afirmar(destinoSeguro("/entrar") === "/entrar", "una ruta propia normal se conserva");

  const profesor = { id: "profe-1", role: "PROFESOR" };
  const admin = { id: "admin-1", role: "ADMIN" };
  const estudiante = { id: "est-1", role: "STUDENT", suprimidoEl: null };
  const otroProfesor = { id: "profe-2", role: "PROFESOR", suprimidoEl: null };
  const suprimidoObjetivo = { id: "sup-1", role: "STUDENT", suprimidoEl: new Date() };

  afirmar(
    motivoParaNoPonerContrasena(profesor, estudiante) === null,
    "un profesor sí puede a un estudiante",
  );
  afirmar(
    motivoParaNoPonerContrasena(profesor, otroProfesor) === "solo-admin",
    "un profesor no puede a otro profesor",
  );
  afirmar(
    motivoParaNoPonerContrasena(admin, otroProfesor) === null,
    "un administrador sí puede a un profesor",
  );
  afirmar(
    motivoParaNoPonerContrasena(profesor, { id: profesor.id, role: "PROFESOR", suprimidoEl: null }) ===
      "uno-mismo",
    "a uno mismo, nadie",
  );
  afirmar(
    motivoParaNoPonerContrasena(profesor, null) === "no-existe",
    "sin ficha, no existe",
  );
  afirmar(
    motivoParaNoPonerContrasena(profesor, suprimidoObjetivo) === "suprimido",
    "una ficha suprimida no admite contraseña nueva",
  );
  afirmar(
    motivoParaNoPonerContrasena(admin, { id: admin.id, role: "ADMIN", suprimidoEl: null }) ===
      "uno-mismo",
    "uno-mismo gana a solo-admin cuando un administrador se apunta a sí mismo",
  );
}

async function contrasenas() {
  console.log("\n— Contraseñas —");
  const hash = await cifrarContrasena("mi contraseña 1");
  afirmar(hash.startsWith("scrypt$"), "el hash lleva el prefijo del algoritmo");
  afirmar(hash.split("$").length === 3, "el hash tiene sal y resultado");
  afirmar(await comprobarContrasena("mi contraseña 1", hash), "la misma contraseña pasa");
  afirmar(!(await comprobarContrasena("mi contraseña 2", hash)), "otra contraseña no pasa");
  afirmar(!(await comprobarContrasena("", hash)), "la vacía no pasa");
  afirmar(!(await comprobarContrasena("mi contraseña 1", "basura")), "un hash roto no pasa ni revienta");
  const otroHash = await cifrarContrasena("mi contraseña 1");
  afirmar(otroHash !== hash, "dos cifrados de la misma contraseña difieren (sal)");

  const generadas = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const c = generarContrasena();
    afirmar(c.length === 10, `la generada mide 10 (${c})`);
    afirmar([...c].every((l) => ALFABETO_LEGIBLE.includes(l)), "solo usa el alfabeto legible");
    generadas.add(c);
  }
  afirmar(generadas.size === 20, "veinte generadas, veinte distintas");

  afirmar(validarContrasena("1234567") !== null, "siete caracteres se rechazan");
  afirmar(validarContrasena("12345678") === null, "ocho caracteres valen");
  afirmar(validarContrasena("   ") !== null, "espacios solos se rechazan");
}

async function entrada() {
  console.log("\n— Entrada —");
  const correo = `alumna-${marca}@ejemplo.test`;
  const alumna = await prisma.user.create({ data: { email: correo, role: "STUDENT" } });
  const ahora = new Date("2026-09-02T10:00:00Z");

  try {
    const sinFila = await intentarEntrar(`nadie-${marca}@ejemplo.test`, "loquesea", ahora);
    afirmar(!sinFila.ok && sinFila.motivo === "credenciales", "correo inexistente → credenciales");

    const sinHash = await intentarEntrar(correo, "loquesea", ahora);
    afirmar(!sinHash.ok && sinHash.motivo === "credenciales", "sin contraseña puesta → credenciales, el mismo motivo");

    const clara = await ponerContrasenaNueva(alumna.id);
    const trasPoner = await prisma.user.findUniqueOrThrow({ where: { id: alumna.id } });
    afirmar(clara.length === 10, "ponerContrasenaNueva devuelve la contraseña en claro");
    afirmar(trasPoner.contrasenaHash !== null && !trasPoner.contrasenaHash.includes(clara), "guarda un hash, no la contraseña");
    afirmar(trasPoner.debeCambiarContrasena, "marca que debe cambiarla al entrar");

    afirmar((await intentarEntrar(correo.toUpperCase(), clara, ahora)).ok, "entra con la contraseña dada, con el correo en mayúsculas");

    for (let i = 1; i < MAX_INTENTOS; i++) {
      const r = await intentarEntrar(correo, "mal", ahora);
      afirmar(!r.ok && r.motivo === "credenciales", `fallo ${i}: credenciales`);
    }
    const quinto = await intentarEntrar(correo, "mal", ahora);
    afirmar(!quinto.ok && quinto.motivo === "demasiados-intentos", `fallo ${MAX_INTENTOS}: demasiados intentos`);
    const castigada = await prisma.user.findUniqueOrThrow({ where: { id: alumna.id } });
    afirmar(
      castigada.intentosBloqueadosHasta?.getTime() === ahora.getTime() + MINUTOS_DE_CASTIGO * 60_000,
      "la fecha de castigo es ahora + 15 minutos",
    );
    afirmar(castigada.intentosFallidos === 0, "el contador vuelve a cero al castigar");

    const conLaBuena = await intentarEntrar(correo, clara, ahora);
    afirmar(!conLaBuena.ok && conLaBuena.motivo === "demasiados-intentos", "castigada, ni la buena entra");

    const despues = new Date(ahora.getTime() + (MINUTOS_DE_CASTIGO + 1) * 60_000);
    afirmar(!(await intentarEntrar(correo, "mal", despues)).ok, "pasado el castigo, un fallo cuenta otra vez");
    const bien = await intentarEntrar(correo, clara, despues);
    afirmar(bien.ok, "pasado el castigo, la buena entra");
    const limpia = await prisma.user.findUniqueOrThrow({ where: { id: alumna.id } });
    afirmar(limpia.intentosFallidos === 0 && limpia.intentosBloqueadosHasta === null, "entrar bien limpia contador y castigo");

    await guardarContrasena(alumna.id, "la que elijo yo");
    const propia = await prisma.user.findUniqueOrThrow({ where: { id: alumna.id } });
    afirmar(!propia.debeCambiarContrasena, "guardar la propia quita la obligación de cambiarla");
    afirmar((await intentarEntrar(correo, "la que elijo yo", despues)).ok, "entra con la propia");
    afirmar(!(await intentarEntrar(correo, clara, despues)).ok, "la vieja ya no vale");

    await prisma.user.update({ where: { id: alumna.id }, data: { bloqueadoEl: despues } });
    const bloqueada = await intentarEntrar(correo, "la que elijo yo", despues);
    afirmar(!bloqueada.ok && bloqueada.motivo === "sin-acceso", "bloqueada con la buena → sin acceso");
    const bloqueadaMal = await intentarEntrar(correo, "mal", despues);
    afirmar(!bloqueadaMal.ok && bloqueadaMal.motivo === "credenciales", "bloqueada con la mala → credenciales (no se revela el bloqueo)");

    await prisma.user.update({ where: { id: alumna.id }, data: { bloqueadoEl: null, suprimidoEl: despues } });
    const suprimida = await intentarEntrar(correo, "la que elijo yo", despues);
    afirmar(!suprimida.ok && suprimida.motivo === "sin-acceso", "suprimida → sin acceso");
  } finally {
    await prisma.user.delete({ where: { id: alumna.id } });
  }
}

async function sesiones() {
  console.log("\n— Sesiones —");
  const alumno = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  const ahora = new Date("2026-09-02T10:00:00Z");
  try {
    const { token, caducaEl } = await crearSesion(alumno.id, ahora);
    afirmar(token.length === 64, "el token son 32 bytes en hex");
    afirmar(caducaEl.getTime() === ahora.getTime() + DIAS_DE_SESION * 86_400_000, "caduca a los 30 días");
    const fila = await prisma.sesion.findUnique({ where: { tokenHash: hashDeToken(token) } });
    afirmar(fila !== null, "la base guarda el hash del token");
    afirmar((await prisma.sesion.findMany({ where: { usuarioId: alumno.id } })).every((s) => s.tokenHash !== token), "la base no guarda el token en claro");

    afirmar((await usuarioPorToken(token, ahora))?.id === alumno.id, "el token encuentra al usuario");
    afirmar((await usuarioPorToken("0".repeat(64), ahora)) === null, "otro token no encuentra a nadie");
    afirmar((await usuarioPorToken("", ahora)) === null, "el token vacío no encuentra a nadie");

    const pasado = new Date(caducaEl.getTime() + 1);
    afirmar((await usuarioPorToken(token, pasado)) === null, "caducada no vale");
    afirmar((await prisma.sesion.count({ where: { usuarioId: alumno.id } })) === 0, "la caducada se borra al encontrarla");

    const a = await crearSesion(alumno.id, ahora);
    const b = await crearSesion(alumno.id, ahora);
    await borrarSesionPorToken(a.token);
    afirmar((await usuarioPorToken(a.token, ahora)) === null, "borrar por token cierra esa sesión");
    afirmar((await usuarioPorToken(b.token, ahora)) !== null, "y no la otra");

    const c = await crearSesion(alumno.id, ahora);
    const cerradas = await cerrarSesionesDe(alumno.id, c.token);
    afirmar(cerradas === 1, "cerrar las demás conserva la indicada");
    afirmar((await usuarioPorToken(c.token, ahora)) !== null, "la conservada sigue viva");
    afirmar((await cerrarSesionesDe(alumno.id)) === 1, "cerrar todas cierra la que quedaba");

    await crearSesion(alumno.id, ahora);
    await ponerContrasenaNueva(alumno.id);
    afirmar((await prisma.sesion.count({ where: { usuarioId: alumno.id } })) === 0, "una contraseña nueva desde fuera cierra las sesiones");
  } finally {
    await prisma.user.delete({ where: { id: alumno.id } });
  }
}

async function main() {
  reglasPuras();
  await contrasenas();
  await entrada();
  await sesiones();
  await prisma.$disconnect();
  console.log("\nTodo en orden.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
