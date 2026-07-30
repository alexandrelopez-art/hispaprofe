# Panel de administrador — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un administrador pueda nombrar profesores desde la aplicación, sin volver a tocar nunca la base de datos.

**Architecture:** Un área `/admin` con su propio candado (`exigirAdmin`), separada de `/profe` porque hoy "administrador" y "profesor" son sinónimos en quince condiciones y esa confusión debe quedarse fuera. El primer administrador nace de una variable de entorno leída en cada entrada, así que no hay arranque manual en ningún entorno.

**Tech Stack:** Next.js 16 (App Router, React Server Components), React 19, Prisma 7 con adaptador `@prisma/adapter-pg`, Clerk para sesión, Tailwind CSS 4, `tsx` para scripts.

**Diseño de referencia:** `docs/superpowers/specs/2026-07-29-panel-de-administrador-design.md`

## Global Constraints

- **Lee la documentación de Next antes de escribir código.** `AGENTS.md` del repo: esta versión de Next tiene cambios de API respecto a lo que puedas recordar. Los guides están en `node_modules/next/dist/docs/`.
- Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos generados vienen de `@/lib/generated/prisma/client`.
- **Cero cambios en `prisma/schema.prisma`.** El rol `ADMIN` ya existe en el enum `Role`. Ninguna migración en todo el plan.
- Interfaz **en español con tildes**. Comentarios en español, cortos, explicando el porqué y no el qué.
- Tokens de Tailwind del proyecto: `hp-50…hp-700`, `sol-100…sol-400`, `bloque1-3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`. Nada de colores crudos.
- **Un administrador puede todo lo que puede un profesor, y además lo suyo.** Las quince condiciones `PROFESOR || ADMIN` que ya existen son correctas y **no se tocan**.
- **`ADMIN_EMAILS` solo sube, nunca baja.** Quitar el rol desde el panel no sirve si el correo sigue en la variable. Es deliberado: es la red que impide quedarse fuera de la propia aplicación.
- **Esconder un botón no es seguridad.** Toda acción y toda página del área comprueban el rol en el servidor.
- No hay framework de pruebas. La verificación es `npx tsc --noEmit`, `npm run lint` y scripts `tsx` al estilo de `scripts/verificar-cifrado.ts`.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/roles.ts` | **Crear.** Funciones puras, sin dependencias: `correosDeAdmin()`, `esCorreoDeAdmin()`, `esAdmin()`. | 1 |
| `lib/admin.ts` | **Crear.** `exigirAdmin()` y `puedeQuitarseElRol()`, que sí tocan sesión y base. | 1, 2 |
| `lib/usuario.ts` | **Modificar.** El ascenso por variable dentro de `getUsuarioActual`. | 1 |
| `scripts/verificar-admin.ts` | **Crear.** Verifica el ascenso y las salvaguardas. | 1, 2 |
| `lib/acciones.ts` | **Modificar.** `hacerProfesor`, `quitarProfesor`, `invitarProfesor`. | 2 |
| `app/(app)/admin/layout.tsx` | **Crear.** El candado del área y su barra de pestañas. | 3 |
| `app/(app)/admin/page.tsx` | **Crear.** El resumen y la salud. | 3 |
| `app/(app)/admin/personas/page.tsx` | **Crear.** Las cuentas y sus roles. | 4 |
| `app/(app)/admin/biblioteca/page.tsx` | **Crear.** Todas las secuencias. | 5 |
| `app/(app)/layout.tsx` | **Modificar.** El enlace «Administración». | 3 |
| `README.md` | **Modificar.** Documentar `ADMIN_EMAILS`. | 1 |

---

### Task 1: El candado y el ascenso por variable de entorno

Es la base: sin esto no hay ningún administrador y el resto del plan no se puede probar.

**Files:**
- Create: `lib/roles.ts`
- Create: `lib/admin.ts`
- Modify: `lib/usuario.ts` (dentro de `getUsuarioActual`)
- Create: `scripts/verificar-admin.ts`
- Modify: `README.md` (sección «Configuración inicial»)

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`; `getUsuarioActual` de `@/lib/usuario`.
- Produces, desde `@/lib/roles` (módulo **sin ninguna importación**):
  - `function correosDeAdmin(): string[]` — los correos de `ADMIN_EMAILS`, en minúsculas y sin espacios.
  - `function esCorreoDeAdmin(email: string): boolean`
  - `function esAdmin(usuario: { role: string } | null | undefined): boolean`
- Produces, desde `@/lib/admin`:
  - `async function exigirAdmin()` — lanza si quien pide no es `ADMIN`.

**Por qué dos archivos y no uno.** `lib/usuario.ts` necesita saber si un correo asciende, y `exigirAdmin` necesita saber quién ha entrado, que es justo lo que da `lib/usuario.ts`. En un solo archivo eso sería una dependencia circular: `admin → usuario → admin`. Partiéndolo, `lib/roles.ts` no importa nada y todos pueden depender de él sin ciclo.

- [ ] **Step 1: Escribir el script de verificación (falla, no existe el módulo)**

Crear `scripts/verificar-admin.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutarlo y comprobar que falla**

Run: `npx tsx scripts/verificar-admin.ts`
Expected: FAIL — `Cannot find module '@/lib/roles'`.

- [ ] **Step 3: Crear el módulo puro de roles**

Crear `lib/roles.ts`. **No importa nada, a propósito**: `lib/usuario.ts` va a depender de él, y si este archivo importara a aquel se cerraría un ciclo.

```ts
/**
 * Los correos que ascienden a administrador, desde ADMIN_EMAILS.
 *
 * Se lee en cada llamada y no se guarda en una constante de módulo: en
 * desarrollo la variable puede cambiar sin reiniciar, y el script de
 * verificación la modifica entre comprobaciones.
 */
export function correosDeAdmin(): string[] {
  const bruto = process.env.ADMIN_EMAILS ?? "";
  return bruto
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function esCorreoDeAdmin(email: string): boolean {
  return correosDeAdmin().includes(email.trim().toLowerCase());
}

/**
 * Administrador de verdad, no "profesor o administrador". El resto de la
 * aplicacion usa `PROFESOR || ADMIN` a proposito; esto es mas estrecho y
 * solo vale para el area de administracion.
 */
export function esAdmin(usuario: { role: string } | null | undefined): boolean {
  return usuario?.role === "ADMIN";
}
```

- [ ] **Step 3b: Crear el candado que sí necesita la sesión**

Crear `lib/admin.ts`:

```ts
import { getUsuarioActual } from "@/lib/usuario";
import { esAdmin } from "@/lib/roles";

/** Gemelo de `exigirProfesor`, un escalon por encima. */
export async function exigirAdmin() {
  const usuario = await getUsuarioActual();
  if (!esAdmin(usuario)) {
    throw new Error("Solo un administrador puede hacer esto.");
  }
  return usuario!;
}
```

- [ ] **Step 4: Enganchar el ascenso en `getUsuarioActual`**

En `lib/usuario.ts`, añadir el import en la cabecera. **De `@/lib/roles`, no de `@/lib/admin`** — importar el segundo cerraría un ciclo:

```ts
import { esCorreoDeAdmin } from "@/lib/roles";
```

Y añadir esta función auxiliar justo antes de `getUsuarioActual`:

```ts
/**
 * Sube a ADMIN a quien esté en ADMIN_EMAILS. Se comprueba en cada entrada,
 * así que da igual el orden: registrarse antes y añadir la variable después
 * funciona igual de bien.
 *
 * Solo sube, nunca baja: quitar el rol desde el panel no sirve de nada si el
 * correo sigue en la variable. Es la red que impide quedarse fuera de la
 * propia aplicación.
 */
async function ascenderSiEsAdmin<T extends { id: string; email: string; role: string }>(
  usuario: T,
): Promise<T> {
  if (usuario.role === "ADMIN" || !esCorreoDeAdmin(usuario.email)) return usuario;
  return (await prisma.user.update({
    where: { id: usuario.id },
    data: { role: "ADMIN" },
  })) as T;
}
```

Después, envolver **las cuatro salidas** de `getUsuarioActual` que devuelven un usuario. La función tiene estos `return` con usuario: el de `porClerk`, el de `porCorreo` (el `prisma.user.update`), y el `prisma.user.create` final. Cada uno pasa a devolver `ascenderSiEsAdmin(...)`. Por ejemplo, el primero:

```ts
  const porClerk = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (porClerk) return ascenderSiEsAdmin(porClerk);
```

Los `return null` no se tocan.

- [ ] **Step 5: Documentar la variable en el README**

En `README.md`, dentro de la sección «Configuración inicial», debajo de la línea de `ENCRYPTION_KEY`, añadir:

```
# Correos que entran como administradores, separados por comas.
# Se comprueba en cada inicio de sesión: no hay que tocar la base de datos.
# Ojo: solo sube. Quitar el rol desde el panel no sirve si el correo sigue aquí.
ADMIN_EMAILS=tu-correo@ejemplo.com
```

- [ ] **Step 6: Ejecutar el script y comprobar que pasa**

Run: `npx tsx scripts/verificar-admin.ts`
Expected: once líneas `OK:` y `Todas las verificaciones pasan.`

- [ ] **Step 7: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add lib/roles.ts lib/admin.ts lib/usuario.ts scripts/verificar-admin.ts README.md
git commit -m "Candado de administrador y ascenso por ADMIN_EMAILS"
```

---

### Task 2: Las acciones de nombrar y quitar profesores

**Files:**
- Modify: `lib/acciones.ts` (añadir tres acciones al final del archivo)
- Modify: `scripts/verificar-admin.ts` (añadir las verificaciones de las salvaguardas)

**Interfaces:**
- Consumes: `exigirAdmin` de `@/lib/admin`; `prisma`, `revalidatePath`.
- Produces, exportadas desde `lib/acciones.ts`:
  - `async function hacerProfesor(formData: FormData): Promise<void>` — campo `usuarioId`.
  - `async function quitarProfesor(formData: FormData): Promise<void>` — campo `usuarioId`.
  - `async function invitarProfesor(formData: FormData): Promise<void>` — campo `email`.
- Produces, exportada desde `lib/admin.ts` para poder verificarla sin sesión:
  - `async function puedeQuitarseElRol(usuarioId: string): Promise<boolean>`

**Nota de diseño:** las salvaguardas viven en `lib/admin.ts` y no dentro de las acciones, porque una acción de servidor no se puede llamar desde un script —necesita sesión de Clerk y contexto de petición—. Poniéndolas en una función de datos quedan comprobables de verdad, igual que se hizo con `desmarcarSiNoRevisado`.

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Añadir al import de `scripts/verificar-admin.ts`:

```ts
import { puedeQuitarseElRol } from "@/lib/admin";
```

Y al final de `main()`, antes del `console.log` final:

```ts
  // 4. Salvaguarda: no se puede dejar la plataforma sin administradores.
  const marca = `verificar-admin-${process.pid}`;
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-admin.ts`
Expected: FAIL — `puedeQuitarseElRol` no existe en `@/lib/admin`.

- [ ] **Step 3: Añadir la salvaguarda a `lib/admin.ts`**

Añadir al final de `lib/admin.ts`, y el import de prisma en su cabecera:

```ts
import { prisma } from "@/lib/prisma";
```

```ts
/**
 * Si quitarle el rol a este administrador dejaria la plataforma sin
 * ninguno, la respuesta es no. Vive aqui y no dentro de la accion porque
 * una accion de servidor no se puede llamar desde un script de verificacion.
 */
export async function puedeQuitarseElRol(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true },
  });
  if (!usuario) return false;
  if (usuario.role !== "ADMIN") return true;

  const cuantos = await prisma.user.count({ where: { role: "ADMIN" } });
  return cuantos > 1;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-admin.ts`
Expected: todas las líneas `OK:`, incluidas las tres nuevas.

- [ ] **Step 5: Añadir las tres acciones**

En `lib/acciones.ts`, añadir al import de la cabecera:

```ts
import { exigirAdmin, puedeQuitarseElRol } from "@/lib/admin";
```

Y al final del archivo:

```ts
// ─── Administración ──────────────────────────────────────────────────────

/** Sube a alguien a profesor. Un administrador no baja de rango por esto. */
export async function hacerProfesor(formData: FormData) {
  await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId) return;

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true },
  });
  if (!usuario || usuario.role === "ADMIN") return;

  await prisma.user.update({ where: { id: usuarioId }, data: { role: "PROFESOR" } });

  revalidatePath("/admin/personas");
  revalidatePath("/profe/alumnos");
}

/**
 * Devuelve a alguien a estudiante. Dos negativas: nadie puede quitarse el
 * rol a sí mismo, y no se puede dejar la plataforma sin administradores.
 */
export async function quitarProfesor(formData: FormData) {
  const yo = await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId || usuarioId === yo.id) return;

  if (!(await puedeQuitarseElRol(usuarioId))) return;

  await prisma.user.update({ where: { id: usuarioId }, data: { role: "STUDENT" } });

  revalidatePath("/admin/personas");
  revalidatePath("/profe/alumnos");
}

/**
 * Invita a un profesor por correo. Si ya tiene ficha se le sube el rol en
 * vez de crear una segunda con el mismo correo; si no la tiene, nace ya
 * como profesor y se la encuentra hecha al entrar por primera vez.
 */
export async function invitarProfesor(formData: FormData) {
  await exigirAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

  const existente = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  // A un administrador no se le baja a profesor por invitarlo otra vez.
  if (existente?.role === "ADMIN") return;

  await prisma.user.upsert({
    where: { email },
    update: { role: "PROFESOR" },
    create: { email, role: "PROFESOR" },
  });

  revalidatePath("/admin/personas");
  revalidatePath("/profe/alumnos");
}
```

- [ ] **Step 6: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/admin.ts lib/acciones.ts scripts/verificar-admin.ts
git commit -m "Acciones de administración: nombrar, quitar e invitar profesores"
```

**Qué queda sin cubrir por el script, y por qué.** El diseño enumeraba seis comprobaciones. Tres de ellas —que `exigirAdmin` rechace a un profesor, que invitar un correo existente suba el rol en vez de duplicar la ficha, y que un correo inválido no cree nada— viven dentro de acciones de servidor, y una acción de servidor **no se puede llamar desde un script**: necesita sesión de Clerk y contexto de petición de Next. La lógica comprobable ya está fuera (`puedeQuitarseElRol`); el resto lo cubre la pasada manual de la Tarea 5, cuyos pasos 5, 6 y 7 son exactamente esos tres casos. No hay forma de automatizarlo sin montar un arnés de pruebas que este proyecto no tiene.

---

### Task 3: El área, su candado y el resumen

**Files:**
- Create: `app/(app)/admin/layout.tsx`
- Create: `app/(app)/admin/page.tsx`
- Modify: `app/(app)/layout.tsx` (la barra de navegación)

**Interfaces:**
- Consumes: `esAdmin` de `@/lib/admin`; `getUsuarioActual` de `@/lib/usuario`; `prisma`.
- Produces: la ruta `/admin` protegida y su barra de pestañas, que las Tareas 4 y 5 rellenan.

- [ ] **Step 1: Crear el candado y las pestañas del área**

Crear `app/(app)/admin/layout.tsx`:

```tsx
import { getUsuarioActual } from "@/lib/usuario";
import { esAdmin } from "@/lib/roles";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const pestanas = [
  { href: "/admin", texto: "Resumen" },
  { href: "/admin/personas", texto: "Personas" },
  { href: "/admin/biblioteca", texto: "Biblioteca" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El candado de verdad. Esconder el enlace en la barra no basta: quien
  // escriba /admin a mano tiene que rebotar aquí.
  const usuario = await getUsuarioActual();
  if (!esAdmin(usuario)) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Administración
      </h1>

      <nav className="mt-6 flex flex-wrap gap-2">
        {pestanas.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
```

**Por qué `notFound()` y no un mensaje de error:** un profesor curioso que escriba `/admin` no debe aprender que esa dirección existe.

- [ ] **Step 2: Crear el resumen**

Crear `app/(app)/admin/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function Dato({ n, etiqueta }: { n: number | string; etiqueta: string }) {
  return (
    <div className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <p className="text-3xl font-extrabold text-tinta">{n}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-tinta-suave">
        {etiqueta}
      </p>
    </div>
  );
}

/** Bytes en algo legible. Los archivos viven en la base, así que importa. */
function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminResumenPage() {
  const [porRol, secuencias, publicadas, ejercicios, archivos] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.recorrido.count(),
    prisma.recorrido.count({ where: { publicado: true } }),
    prisma.ejercicio.count(),
    prisma.archivo.aggregate({ _sum: { tamano: true }, _count: { _all: true } }),
  ]);

  const cuantos = (rol: string) =>
    porRol.find((r) => r.role === rol)?._count._all ?? 0;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dato n={cuantos("ADMIN")} etiqueta="Administradores" />
        <Dato n={cuantos("PROFESOR")} etiqueta="Profesores" />
        <Dato n={cuantos("STUDENT")} etiqueta="Estudiantes" />
        <Dato n={`${publicadas} / ${secuencias}`} etiqueta="Secuencias publicadas" />
        <Dato n={ejercicios} etiqueta="Ejercicios" />
        <Dato
          n={tamano(archivos._sum.tamano ?? 0)}
          etiqueta={`${archivos._count._all} archivos en la base`}
        />
      </div>

      <p className="mt-6 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
        Las imágenes y los audios se guardan dentro de la base de datos, no en un
        servicio aparte. Vigila ese último número: si crece mucho, la copia de
        seguridad crece con él.
      </p>
    </>
  );
}
```

- [ ] **Step 3: Añadir el enlace en la barra de navegación**

En `app/(app)/layout.tsx`, añadir el import:

```tsx
import { esAdmin } from "@/lib/roles";
```

Calcular junto a `esProfe`:

```tsx
  const esAdministrador = esAdmin(usuario);
```

Y añadir el enlace justo después del bloque `{esProfe && (...)}` de «Estudiantes», dentro del mismo `<nav>`:

```tsx
            {esAdministrador && (
              <Link
                href="/admin"
                className="hover:text-hp-500 transition-colors"
              >
                Administración
              </Link>
            )}
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Comprobar que el candado cierra**

Run: `npm run dev`, esperar a `Ready`, y sin sesión:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin
```

Expected: no debe ser 200. Sin sesión, `getUsuarioActual` devuelve null, `esAdmin` es false y la ruta responde 404.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/admin" "app/(app)/layout.tsx"
git commit -m "Área de administración con su candado y el resumen de la plataforma"
```

---

### Task 4: La pantalla de personas

Es el corazón del panel: lo que desatasca al profesor.

**Files:**
- Create: `app/(app)/admin/personas/page.tsx`

**Interfaces:**
- Consumes: `hacerProfesor`, `quitarProfesor`, `invitarProfesor` de `@/lib/acciones`; `getUsuarioActual`; `prisma`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Crear la pantalla**

Crear `app/(app)/admin/personas/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { hacerProfesor, invitarProfesor, quitarProfesor } from "@/lib/acciones";
import type { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const rolLabel: Record<string, string> = {
  ADMIN: "Administrador",
  PROFESOR: "Profesor",
  STUDENT: "Estudiante",
};

const rolStyle: Record<string, string> = {
  ADMIN: "bg-bloque3/25 text-tinta ring-bloque3/50",
  PROFESOR: "bg-hp-100 text-hp-700 ring-hp-200",
  STUDENT: "bg-fondo text-tinta-suave ring-hp-100",
};

function nombreDe(u: { firstName: string | null; lastName: string | null; email: string }) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const yo = await getUsuarioActual();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const personas = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      nivel: true,
      clerkId: true,
    },
  });

  const administradores = personas.filter((p) => p.role === "ADMIN").length;

  return (
    <>
      <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        <h2 className="text-lg font-bold text-tinta">Invitar a un profesor</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Si ya tiene cuenta, se le sube el rol. Si no, se le crea la ficha y se
          la encontrará hecha al entrar por primera vez. No se envía ningún
          correo: avisarle sigue siendo cosa tuya.
        </p>
        <form action={invitarProfesor} className="mt-4 flex flex-wrap gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="correo@ejemplo.com"
            className="h-10 min-w-64 flex-1 rounded-full border border-hp-200 bg-fondo px-4 text-sm text-tinta outline-none focus:border-hp-400"
          />
          <button
            type="submit"
            className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
          >
            Invitar
          </button>
        </form>
      </section>

      <form className="mt-8 flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o correo"
          className="h-10 min-w-56 flex-1 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
        <button
          type="submit"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
        >
          Buscar
        </button>
      </form>

      <p className="mt-4 text-sm text-tinta-suave">
        {personas.length} cuenta{personas.length !== 1 ? "s" : ""}.
      </p>

      <ul className="mt-3 space-y-2">
        {personas.map((p) => {
          const soyYo = p.id === yo?.id;
          // No se puede dejar la plataforma sin administradores, y nadie se
          // quita el rol a sí mismo.
          const puedeBajar =
            !soyYo && p.role !== "STUDENT" && !(p.role === "ADMIN" && administradores <= 1);

          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-tinta">
                  {nombreDe(p)}
                  {soyYo && (
                    <span className="ml-2 text-xs font-bold text-tinta-suave">(tú)</span>
                  )}
                </p>
                <p className="truncate text-xs text-tinta-suave">
                  {p.email}
                  {p.nivel && ` · ${p.nivel}`}
                  {!p.clerkId && " · ficha sin reclamar"}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                  rolStyle[p.role] ?? "bg-fondo text-tinta ring-hp-100"
                }`}
              >
                {rolLabel[p.role] ?? p.role}
              </span>

              <div className="flex shrink-0 gap-2">
                {p.role === "STUDENT" && (
                  <form action={hacerProfesor}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full bg-hp-400 px-4 text-xs font-bold text-white transition-colors hover:bg-hp-500"
                    >
                      Hacer profesor
                    </button>
                  </form>
                )}
                {puedeBajar && (
                  <form action={quitarProfesor}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
                    >
                      Quitar rol
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-tinta-suave">
        Recuerda: quitar el rol no sirve de nada si ese correo sigue en la
        variable ADMIN_EMAILS. Volverá a ser administrador al entrar.
      </p>
    </>
  );
}
```

- [ ] **Step 2: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Comprobar que la ruta compila**

Run: `npm run dev`, esperar a `Ready`, y sin sesión:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/personas
```

Expected: no 200 (404 por el candado del layout), y ningún error de compilación en el log.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/admin/personas"
git commit -m "Pantalla de personas: nombrar, quitar e invitar profesores"
```

---

### Task 5: La biblioteca de todos

**Files:**
- Create: `app/(app)/admin/biblioteca/page.tsx`

**Interfaces:**
- Consumes: `prisma`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Crear la pantalla**

Crear `app/(app)/admin/biblioteca/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const servicioLabel: Record<string, string> = {
  RECORRIDO: "Clases particulares",
  PREPARACION: "Preparación DELE",
};

function nombreDe(u: { firstName: string | null; lastName: string | null; email: string }) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function AdminBibliotecaPage() {
  const secuencias = await prisma.recorrido.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      titulo: true,
      nivel: true,
      tipo: true,
      publicado: true,
      autor: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { pasos: true, asignaciones: true } },
    },
  });

  const huerfanas = secuencias.filter((s) => !s.autor).length;

  return (
    <>
      <p className="mt-8 text-sm text-tinta-suave">
        {secuencias.length} secuencia{secuencias.length !== 1 ? "s" : ""} en toda
        la plataforma.
      </p>

      {huerfanas > 0 && (
        <p className="mt-3 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          {huerfanas} sin autor. Son las sembradas antes de que existiera ese
          campo; no es un error, pero nadie figura como su dueño.
        </p>
      )}

      {secuencias.length === 0 ? (
        <p className="mt-4 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          Todavía no hay ninguna secuencia.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {secuencias.map((s) => (
            <li key={s.id}>
              <Link
                href={`/recorridos/${s.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">{s.titulo}</p>
                  <p className="truncate text-xs text-tinta-suave">
                    {servicioLabel[s.tipo] ?? s.tipo} · {s.nivel} ·{" "}
                    {s.autor ? nombreDe(s.autor) : "sin autor"}
                  </p>
                </div>

                <span className="shrink-0 text-xs font-semibold text-tinta-suave">
                  {s._count.pasos} paso{s._count.pasos !== 1 ? "s" : ""} ·{" "}
                  {s._count.asignaciones} asignada
                  {s._count.asignaciones !== 1 ? "s" : ""}
                </span>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                    s.publicado
                      ? "bg-bloque2/25 text-tinta ring-bloque2/50"
                      : "bg-fondo text-tinta-suave ring-hp-100"
                  }`}
                >
                  {s.publicado ? "Publicada" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 2: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Pasar todas las verificaciones**

Run: `npx tsx scripts/verificar-admin.ts && npx tsx scripts/verificar-ejercicios.ts && npx tsx scripts/verificar-puntos.ts`
Expected: los tres pasan.

- [ ] **Step 4: Comprobación a mano**

Run: `npm run dev`

Con `ADMIN_EMAILS` puesto a tu correo en `.env`:

1. Entra con esa cuenta. En la barra de arriba debe aparecer **Administración**.
2. Abre `/admin`: los números cuadran con lo que hay en la base.
3. En `/admin/personas`, busca una cuenta de estudiante y dale **Hacer profesor**. La etiqueta cambia.
4. Comprueba que en **tu propia fila** no aparece «Quitar rol».
5. Invita un correo que no exista. Aparece en la lista como profesor y con «ficha sin reclamar».
6. Invita un correo que ya exista como estudiante. Sube a profesor y **no** se crea una segunda fila.
7. Entra con una cuenta que no sea administrador y escribe `/admin` a mano: debe dar 404.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/admin/biblioteca"
git commit -m "Biblioteca del administrador: todas las secuencias con su autor"
```

---

## Fuera de alcance

- **Borrar cuentas.** Un profesor con secuencias y asignaciones vivas no se borra sin decidir qué pasa con todo eso. Quitarle el rol ya lo deja sin poderes.
- **Registro de quién hizo qué.** Sin traza de acciones administrativas.
- **Editar contenido ajeno desde la biblioteca.** Es una vista de consulta; el enlace lleva a la secuencia, donde mandan los permisos de siempre.
- **Enviar correos de invitación de verdad.** La invitación crea la ficha y nada más.
