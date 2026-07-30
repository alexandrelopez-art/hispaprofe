# Cifrado de tokens de Google en reposo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cifrar `CuentaGoogle.accessToken` y `CuentaGoogle.refreshToken` en reposo con AES-256-GCM y una clave leída de `ENCRYPTION_KEY`, para que un vertido de la base de datos no exponga credenciales OAuth de Google Classroom.

**Architecture:** Módulo `lib/crypto.ts` con dos funciones puras (`cifrar`, `descifrar`) que envuelven `node:crypto`. `lib/google.ts` cifra antes de escribir y descifra al leer. La clave se guarda en `.env` (nunca en la base de datos). Un script `tsx` migra las filas existentes en un solo paso, detectando el formato para ser idempotente. Sin framework de tests: se añade `scripts/verificar-cifrado.ts` como smoke test del módulo (round-trip, manipulación, clave ausente).

**Tech Stack:** Node.js `crypto` (built-in, sin dependencias nuevas), Prisma 7 (ya presente), `tsx` (ya presente, usado por `prisma/seed.ts`).

## Global Constraints

- Runtime: Node.js (Server Actions y Route Handlers, no Edge). El módulo `node:crypto` no está disponible en Edge Runtime, así que cualquier fichero que lo importe debe permanecer en Node.
- Naming de dominio en español (`cifrar`, `descifrar`, `CuentaGoogle`) siguiendo la convención del proyecto (`guardarTokens`, `tokenValido`, `listarCursos`).
- Algoritmo fijo: `aes-256-gcm`. IV de 12 bytes aleatorio por operación. Tag de autenticación de 16 bytes.
- Formato del texto cifrado en base de datos: `<iv-base64>:<ciphertext-base64>:<authTag-base64>` — string único, tres partes separadas por dos puntos, todo base64 estándar.
- Clave en variable de entorno `ENCRYPTION_KEY`, 32 bytes codificados en base64. Ausencia de la variable → error explícito al primer uso, no fallback silencioso.
- Sin dependencias npm nuevas.
- No modificar las páginas `app/(app)/profe/grupos/page.tsx` ni `app/(app)/profe/grupos/[id]/page.tsx` (solo leen `email`/`id`, no tokens).

---

## Ficheros afectados

- Crear: `lib/crypto.ts` — cifrado/descifrado AES-256-GCM.
- Crear: `scripts/verificar-cifrado.ts` — smoke test manual (round-trip, tampering, clave ausente).
- Crear: `scripts/migrar-cifrado-tokens.ts` — backfill único de filas existentes.
- Modificar: `lib/google.ts` — cifrar en `guardarTokens` (líneas 90-107) y en el update de `tokenValido` (líneas 144-150); descifrar en `tokenValido` (líneas 117 y 126).
- Modificar: `prisma/schema.prisma` — actualizar comentario de `CuentaGoogle` (líneas 266-268).
- Modificar: `.env` (local, no versionado) — añadir `ENCRYPTION_KEY`.
- Modificar: `README.md` — sección corta de configuración inicial (generar la clave).

Los tres cambios en `google.ts` son un solo commit; los scripts son cada uno un commit propio.

---

### Task 1: Módulo de cifrado + verificación

**Files:**
- Create: `lib/crypto.ts`
- Create: `scripts/verificar-cifrado.ts`

**Interfaces:**
- Consumes: `process.env.ENCRYPTION_KEY` (string base64, 32 bytes decodificados).
- Produces:
  - `cifrar(texto: string): string` — devuelve `"<iv-b64>:<ct-b64>:<tag-b64>"`.
  - `descifrar(texto: string): string` — devuelve el texto original; lanza `Error("CIFRADO_INVALIDO")` si el formato es incorrecto o la autenticación falla.

- [ ] **Step 1: Crear `lib/crypto.ts`**

```ts
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const LONGITUD_IV = 12;
const LONGITUD_CLAVE = 32;

function clave(): Buffer {
  const bruta = process.env.ENCRYPTION_KEY;
  if (!bruta) {
    throw new Error(
      "ENCRYPTION_KEY no está definida. Genera una con: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  const buffer = Buffer.from(bruta, "base64");
  if (buffer.length !== LONGITUD_CLAVE) {
    throw new Error(
      `ENCRYPTION_KEY debe decodificar a ${LONGITUD_CLAVE} bytes, tiene ${buffer.length}.`,
    );
  }
  return buffer;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(LONGITUD_IV);
  const cifrador = createCipheriv(ALGORITMO, clave(), iv);
  const cifrado = Buffer.concat([
    cifrador.update(texto, "utf8"),
    cifrador.final(),
  ]);
  const tag = cifrador.getAuthTag();
  return `${iv.toString("base64")}:${cifrado.toString("base64")}:${tag.toString("base64")}`;
}

export function descifrar(texto: string): string {
  const partes = texto.split(":");
  if (partes.length !== 3) throw new Error("CIFRADO_INVALIDO");
  const [ivB64, ctB64, tagB64] = partes;
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== LONGITUD_IV || tag.length !== 16) {
    throw new Error("CIFRADO_INVALIDO");
  }
  try {
    const descifrador = createDecipheriv(ALGORITMO, clave(), iv);
    descifrador.setAuthTag(tag);
    const claro = Buffer.concat([descifrador.update(ct), descifrador.final()]);
    return claro.toString("utf8");
  } catch {
    throw new Error("CIFRADO_INVALIDO");
  }
}
```

- [ ] **Step 2: Crear `scripts/verificar-cifrado.ts`**

```ts
/**
 * Smoke test del módulo lib/crypto. Ejecutar con:
 *   ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
 *     npx tsx scripts/verificar-cifrado.ts
 */
import { cifrar, descifrar } from "@/lib/crypto";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) {
    console.error(`FALLO: ${mensaje}`);
    process.exit(1);
  }
  console.log(`OK: ${mensaje}`);
}

// 1. Round-trip básico
const original = "ya29.a0AfH6SMB_ejemplo_de_token_de_google_abcdef";
const cifrado = cifrar(original);
afirmar(cifrado !== original, "el resultado no es el texto original");
afirmar(cifrado.split(":").length === 3, "formato con tres partes");
afirmar(descifrar(cifrado) === original, "round-trip preserva el texto");

// 2. Dos cifrados del mismo texto producen resultados distintos (IV aleatorio)
const a = cifrar(original);
const b = cifrar(original);
afirmar(a !== b, "IV aleatorio hace que cada cifrado sea distinto");

// 3. Manipulación del ciphertext falla la autenticación
const partes = cifrado.split(":");
const ctManipulado = Buffer.from(partes[1], "base64");
ctManipulado[0] ^= 0x01;
partes[1] = ctManipulado.toString("base64");
const manipulado = partes.join(":");
try {
  descifrar(manipulado);
  afirmar(false, "descifrar debe rechazar texto manipulado");
} catch (e) {
  afirmar(
    (e as Error).message === "CIFRADO_INVALIDO",
    "texto manipulado lanza CIFRADO_INVALIDO",
  );
}

// 4. Formato inválido
try {
  descifrar("no-es-un-cifrado");
  afirmar(false, "formato inválido debe lanzar");
} catch (e) {
  afirmar(
    (e as Error).message === "CIFRADO_INVALIDO",
    "formato inválido lanza CIFRADO_INVALIDO",
  );
}

console.log("\nTodas las verificaciones pasan.");
```

- [ ] **Step 3: Verificar que el smoke test pasa**

Run:
```bash
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
  npx tsx scripts/verificar-cifrado.ts
```

Expected output (todas las líneas prefijadas con `OK:`, sin ningún `FALLO`):
```
OK: el resultado no es el texto original
OK: formato con tres partes
OK: round-trip preserva el texto
OK: IV aleatorio hace que cada cifrado sea distinto
OK: texto manipulado lanza CIFRADO_INVALIDO
OK: formato inválido lanza CIFRADO_INVALIDO

Todas las verificaciones pasan.
```

- [ ] **Step 4: Verificar que la clave ausente falla claro**

Run:
```bash
unset ENCRYPTION_KEY; npx tsx scripts/verificar-cifrado.ts
```

Expected: proceso sale con código ≠ 0 y el mensaje contiene `ENCRYPTION_KEY no está definida`.

- [ ] **Step 5: Commit**

```bash
git add lib/crypto.ts scripts/verificar-cifrado.ts
git commit -m "Añadir módulo de cifrado AES-256-GCM para secretos en reposo"
```

---

### Task 2: Script de migración para filas existentes

**Files:**
- Create: `scripts/migrar-cifrado-tokens.ts`

**Interfaces:**
- Consumes: `cifrar` y `descifrar` de `lib/crypto` (Task 1); `prisma.cuentaGoogle` (schema existente).
- Produces: proceso idempotente que deja todas las filas de `CuentaGoogle` con `accessToken` y `refreshToken` en formato cifrado.

Este script se ejecuta **una única vez** contra la base de datos con datos en claro, antes de desplegar la Task 3. Después queda como salvaguarda: al ser idempotente, ejecutarlo de nuevo no daña nada.

- [ ] **Step 1: Crear `scripts/migrar-cifrado-tokens.ts`**

```ts
/**
 * Backfill único: cifra los tokens de CuentaGoogle que aún están en claro.
 * Idempotente: si un valor ya se puede descifrar, se deja tal cual.
 *
 * Ejecutar con:
 *   ENCRYPTION_KEY=... npx tsx scripts/migrar-cifrado-tokens.ts
 */
import { prisma } from "@/lib/prisma";
import { cifrar, descifrar } from "@/lib/crypto";

function yaCifrado(valor: string): boolean {
  try {
    descifrar(valor);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const filas = await prisma.cuentaGoogle.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });
  console.log(`Encontradas ${filas.length} cuentas.`);

  let migradas = 0;
  let saltadas = 0;
  for (const fila of filas) {
    const parche: { accessToken?: string; refreshToken?: string } = {};
    if (!yaCifrado(fila.accessToken)) {
      parche.accessToken = cifrar(fila.accessToken);
    }
    if (fila.refreshToken && !yaCifrado(fila.refreshToken)) {
      parche.refreshToken = cifrar(fila.refreshToken);
    }
    if (Object.keys(parche).length === 0) {
      saltadas++;
      continue;
    }
    await prisma.cuentaGoogle.update({ where: { id: fila.id }, data: parche });
    migradas++;
  }

  console.log(`Migradas: ${migradas}. Saltadas (ya cifradas): ${saltadas}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ensayo con datos actuales**

Run:
```bash
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
  npx tsx scripts/migrar-cifrado-tokens.ts
```

Expected: imprime `Encontradas N cuentas.` y `Migradas: N. Saltadas: 0.` la primera vez. **Guardar esa `ENCRYPTION_KEY`**: hay que reutilizarla en las Tasks siguientes o los tokens quedan inservibles.

- [ ] **Step 3: Verificar idempotencia**

Run (con la MISMA clave que en el paso anterior):
```bash
ENCRYPTION_KEY=<misma_clave_de_arriba> npx tsx scripts/migrar-cifrado-tokens.ts
```

Expected: `Migradas: 0. Saltadas (ya cifradas): N.`

- [ ] **Step 4: Verificar en la DB con Prisma Studio o consulta rápida**

Run:
```bash
DATABASE_URL="$DATABASE_URL" npx prisma studio
```

Expected: al abrir `CuentaGoogle`, los campos `accessToken` y `refreshToken` muestran cadenas con dos `:` y contenido base64, no cadenas que empiecen por `ya29.` o `1//`.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrar-cifrado-tokens.ts
git commit -m "Añadir backfill idempotente de tokens de Google a cifrado en reposo"
```

---

### Task 3: Cablear cifrado en lib/google.ts y cerrar el círculo

**Files:**
- Modify: `lib/google.ts` (líneas 90-107 y 111-153)
- Modify: `prisma/schema.prisma` (líneas 266-268)
- Modify: `README.md` (añadir sección de configuración inicial)

**Interfaces:**
- Consumes: `cifrar`, `descifrar` de `lib/crypto` (Task 1). La DB ya tiene los tokens existentes cifrados (Task 2).
- Produces: `guardarTokens` y `tokenValido` operan transparentemente sobre valores cifrados en reposo.

Cambios exactos en `lib/google.ts`:
- Nueva importación al principio del fichero.
- En `guardarTokens`: cifrar `datos.access_token` y `datos.refresh_token` antes del `upsert`.
- En `tokenValido`: descifrar `cuenta.accessToken` al devolverlo por caché, descifrar `cuenta.refreshToken` antes de mandarlo a Google, cifrar el nuevo `access_token` antes del `update`.

- [ ] **Step 1: Añadir importación en `lib/google.ts`**

Modificar `lib/google.ts` línea 1: reemplazar

```ts
import { prisma } from "@/lib/prisma";
```

por

```ts
import { prisma } from "@/lib/prisma";
import { cifrar, descifrar } from "@/lib/crypto";
```

- [ ] **Step 2: Cifrar en `guardarTokens`**

En `lib/google.ts`, reemplazar el bloque `await prisma.cuentaGoogle.upsert({ ... })` (líneas 90-107) por:

```ts
  const accessCifrado = cifrar(datos.access_token);
  const refreshCifrado = datos.refresh_token ? cifrar(datos.refresh_token) : null;

  await prisma.cuentaGoogle.upsert({
    where: { usuarioId },
    update: {
      accessToken: accessCifrado,
      // Google solo manda refresh_token la primera vez. Si no viene,
      // se conserva el que ya habia.
      ...(refreshCifrado ? { refreshToken: refreshCifrado } : {}),
      expiraEl,
      email,
    },
    create: {
      usuarioId,
      accessToken: accessCifrado,
      refreshToken: refreshCifrado,
      expiraEl,
      email,
    },
  });
```

- [ ] **Step 3: Descifrar y recifrar en `tokenValido`**

En `lib/google.ts`, reemplazar el cuerpo entero de `tokenValido` (líneas 111-153) por:

```ts
async function tokenValido(usuarioId: string): Promise<string> {
  const cuenta = await prisma.cuentaGoogle.findUnique({ where: { usuarioId } });
  if (!cuenta) throw new Error("SIN_CUENTA");

  // Margen de un minuto para no usar un token que caduca a mitad de llamada.
  if (cuenta.expiraEl.getTime() - Date.now() > 60_000) {
    return descifrar(cuenta.accessToken);
  }

  if (!cuenta.refreshToken) throw new Error("SIN_REFRESCO");

  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: descifrar(cuenta.refreshToken),
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });

  if (!respuesta.ok) {
    // Pasa cuando se revoca el permiso o caduca el refresco en modo pruebas.
    await prisma.cuentaGoogle.delete({ where: { usuarioId } });
    throw new Error("SIN_CUENTA");
  }

  const datos = (await respuesta.json()) as {
    access_token: string;
    expires_in: number;
  };

  await prisma.cuentaGoogle.update({
    where: { usuarioId },
    data: {
      accessToken: cifrar(datos.access_token),
      expiraEl: new Date(Date.now() + datos.expires_in * 1000),
    },
  });

  return datos.access_token;
}
```

- [ ] **Step 4: Actualizar comentario en `prisma/schema.prisma`**

Reemplazar líneas 266-268:

```prisma
// Credenciales OAuth del profesor para leer sus cursos de Classroom.
// Se guardan en claro: para el piloto es aceptable, pero antes de abrirlo
// a mas profesores conviene cifrar el refreshToken en reposo.
```

por:

```prisma
// Credenciales OAuth del profesor para leer sus cursos de Classroom.
// accessToken y refreshToken se guardan cifrados con AES-256-GCM
// (ver lib/crypto.ts). La clave vive en la variable de entorno
// ENCRYPTION_KEY, nunca en la base de datos.
```

No hace falta migración de Prisma: el tipo `String` no cambia.

- [ ] **Step 5: Documentar la variable en el README**

En `README.md`, añadir al final el siguiente contenido tal cual (los bloques `bash` y ` ` se muestran con 3 backticks porque van a formar parte del README, no de este plan):

````markdown
## Configuración inicial

Además de las variables de Clerk y Postgres, la aplicación necesita una clave de cifrado
para los tokens de Google Classroom en reposo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia el resultado en tu `.env` como:

```
ENCRYPTION_KEY=<valor_generado>
```

Si vas a migrar una instalación existente con tokens en claro, ejecuta una única vez:

```bash
npx tsx scripts/migrar-cifrado-tokens.ts
```
````

- [ ] **Step 6: Verificación funcional end-to-end**

Con `ENCRYPTION_KEY` en `.env` (la misma que se usó en la Task 2):

```bash
npm run dev
```

Abre el navegador en `/profe/grupos`, entra en un grupo vinculado a Classroom.

Expected: la página carga los cursos de Classroom sin errores. En la consola del servidor no aparecen mensajes con `CIFRADO_INVALIDO`, `SIN_CUENTA` inesperado, ni trazas de `crypto`.

Si acabas de conectar una cuenta Google nueva desde la app, comprobar en la DB (`npx prisma studio`) que la fila recién creada de `CuentaGoogle` tiene los tokens en formato `<b64>:<b64>:<b64>`, no en claro.

- [ ] **Step 7: Commit**

```bash
git add lib/google.ts prisma/schema.prisma README.md
git commit -m "Cifrar tokens de Google Classroom en reposo con AES-256-GCM"
```

---

## Notas operativas (fuera del código)

- **Rotación de clave**: no incluida en este plan. Si en el futuro cambia `ENCRYPTION_KEY`, todos los tokens dejarán de descifrarse y los profesores tendrán que reconectar sus cuentas de Google (flujo ya existente). Aceptable para piloto.
- **Backups**: cualquier backup de DB anterior a la Task 2 sigue conteniendo tokens en claro. Rotar/purgar backups viejos como parte del despliegue.
- **Deploy**: `ENCRYPTION_KEY` debe estar en el gestor de secretos del entorno de producción **antes** de correr el backfill y **antes** de desplegar la Task 3.
