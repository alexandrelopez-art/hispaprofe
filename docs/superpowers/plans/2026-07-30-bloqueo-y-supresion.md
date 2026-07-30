# Bloquear, suprimir y borrar una clase — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un administrador pueda cerrarle el acceso a alguien, vaciar su ficha sin perder las horas trabajadas, y que un profesor pueda borrar una clase que no llegó a darse.

**Architecture:** Dos fechas en `User` —`bloqueadoEl` y `suprimidoEl`— y una regla que se hace cumplir en un único sitio: `getUsuarioActual` devuelve `null` para quien esté bloqueado, así que todas las comprobaciones que ya existen fallan cerradas solas. Suprimir no borra la fila: la vacía y la deja como lápida a la que siguen apuntando sus clases, lo que evita para siempre el caso de la clase huérfana.

**Tech Stack:** Next.js 16 (App Router, React Server Components), React 19, Prisma 7 con adaptador `@prisma/adapter-pg`, Clerk para sesión, Tailwind CSS 4, `tsx` para scripts.

**Diseño de referencia:** `docs/superpowers/specs/2026-07-30-bloqueo-y-supresion-design.md`

## Global Constraints

- **Lee la documentación de Next antes de escribir código.** `AGENTS.md` del repo: esta versión de Next tiene cambios de API respecto a lo que puedas recordar. Los guides están en `node_modules/next/dist/docs/`.
- Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos vienen de `@/lib/generated/prisma/client` y los enums de `@/lib/generated/prisma/enums`.
- Interfaz **en español con tildes**. Comentarios en español, cortos, explicando el porqué y no el qué.
- Tokens de Tailwind del proyecto: `hp-50…hp-700`, `sol-100…sol-400`, `bloque1-3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`. `bg-white` y `text-white` son convención establecida. Nada de otros colores crudos.
- **La fila de `User` no se borra nunca.** Suprimir la vacía. De ahí depende que no haya clases huérfanas.
- **El candado vive en `getUsuarioActual`, no en cada acción.** Un `exigirActivo()` repartido por cada acción es justo lo que se olvida.
- **Las horas trabajadas no se pierden nunca.** Ni al bloquear, ni al suprimir, ni al borrar una clase.
- **Las salvaguardas van en `lib/admin.ts` y `lib/clases.ts`, no dentro de las acciones.** Una acción de servidor no se puede llamar desde un script: necesita sesión de Clerk y contexto de petición. Lo que está fuera es lo único verificable. Es la decisión que ya se tomó con `puedeQuitarseElRol` y `congelarImporte`.
- **Las horas se leen con `deInput` y se escriben con `paraInput`, las dos de `lib/fechas.ts`.** Nada más construye un `Date` a partir de una cadena de formulario.
- No hay framework de pruebas. La verificación es `npx tsc --noEmit`, `npm run lint` y scripts `tsx`.
- **Ojo con el `next dev` que esté corriendo:** tras la migración de la Tarea 1 hay que reiniciarlo (`npm run fresh`), porque `lib/prisma.ts` fija el cliente en `globalThis` y el proceso viejo se queda con el modelo antiguo.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `prisma/schema.prisma` | **Modificar.** `bloqueadoEl` y `suprimidoEl` en `User`, y su migración. | 1 |
| `lib/roles.ts` | **Modificar.** `estaBloqueado` y `estaSuprimido`, funciones puras. | 2 |
| `lib/usuario.ts` | **Modificar.** El candado en `getUsuarioActual` y `bloqueoDelActual`. | 2 |
| `scripts/verificar-personas.ts` | **Crear.** Las verificaciones. | 2, 3, 4, 5 |
| `lib/admin.ts` | **Modificar.** `puedeBloquearse`, `bloquear`, `desbloquear`, `puedeSuprimirse`, `suprimir`. | 3, 4 |
| `lib/clases.ts` | **Modificar.** `sePuedeBorrar` y `borrarClase`. | 5 |
| `lib/acciones-admin.ts` | **Crear.** Las acciones de administración: las tres que se mudan y las tres nuevas. | 6 |
| `lib/acciones.ts` | **Modificar.** Se le quitan las tres acciones de administración. | 6 |
| `app/(app)/admin/personas/page.tsx` | **Modificar.** Filas apagadas, etiquetas y los formularios. | 7 |
| `app/(app)/layout.tsx` | **Modificar.** El cartel de cuenta bloqueada. | 8 |
| `app/(app)/profe/clases/page.tsx` | **Modificar.** La etiqueta «suprimido». | 8 |
| `app/(app)/profe/clases/[id]/page.tsx` | **Modificar.** La etiqueta «suprimido» y el desplegable de borrar. | 8, 9 |
| `app/(app)/profe/alumnos/[id]/page.tsx` | **Modificar.** La etiqueta «suprimido». | 8 |
| `lib/acciones-clases.ts` | **Modificar.** La acción de borrar la clase. | 9 |

---

### Task 1: Los dos campos

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `User.bloqueadoEl` y `User.suprimidoEl`, dos `DateTime?`, disponibles en el cliente generado.

- [ ] **Step 1: Añadir los campos**

En `prisma/schema.prisma`, dentro de `model User`, justo después de `tarifaCentimos Int?`:

```prisma
  /// Cuándo se le cerró el acceso. Null = entra con normalidad.
  /// Fecha y no booleano: además de saber que está bloqueado, interesa
  /// saber desde cuándo, y una fecha lo dice sin costar nada.
  bloqueadoEl DateTime?

  /// Cuándo se le vació la ficha. Null = la ficha es de una persona real.
  /// Va aparte de bloqueadoEl y no en un estado único porque no son
  /// excluyentes: quien está suprimido está bloqueado por definición.
  suprimidoEl DateTime?
```

- [ ] **Step 2: Crear la migración**

Run: `npx prisma migrate dev --name bloqueo_y_supresion`
Expected: crea la carpeta en `prisma/migrations/`, la aplica y regenera el cliente. Las dos columnas son anulables, así que es segura sobre filas existentes.

- [ ] **Step 3: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Bloqueado y suprimido: dos fechas en la ficha de la persona"
```

---

### Task 2: El candado

Sin esto no hay bloqueo que valga: es la única línea que impide entrar.

**Files:**
- Modify: `lib/roles.ts`
- Modify: `lib/usuario.ts`
- Create: `scripts/verificar-personas.ts`

**Interfaces:**
- Consumes: `ascenderSiEsAdmin` y `getUsuarioActual` de `@/lib/usuario`.
- Produces, desde `@/lib/roles`:
  - `function estaBloqueado(usuario: { bloqueadoEl: Date | null } | null | undefined): boolean`
  - `function estaSuprimido(usuario: { suprimidoEl: Date | null } | null | undefined): boolean`
- Produces, desde `@/lib/usuario`:
  - `async function bloqueoDelActual(): Promise<Date | null>` — la fecha de bloqueo de la sesión de Clerk actual, o `null`.

- [ ] **Step 1: Escribir el script de verificación (falla, no existen las funciones)**

Crear `scripts/verificar-personas.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutarlo y comprobar que falla**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: FAIL — `estaBloqueado` no existe en `@/lib/roles`.

- [ ] **Step 3: Añadir las dos funciones puras**

Al final de `lib/roles.ts`:

```ts
/**
 * Bloqueado es quien tiene fecha de bloqueo. Se comprueba en
 * `getUsuarioActual`, que es por donde pasa todo, y no en cada acción: una
 * comprobación repartida por veinte sitios es una comprobación que alguien
 * acabará olvidando.
 */
export function estaBloqueado(
  usuario: { bloqueadoEl: Date | null } | null | undefined,
): boolean {
  return Boolean(usuario?.bloqueadoEl);
}

/** Suprimido es quien tiene la ficha vacía. Su fila sigue ahí a propósito. */
export function estaSuprimido(
  usuario: { suprimidoEl: Date | null } | null | undefined,
): boolean {
  return Boolean(usuario?.suprimidoEl);
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: seis líneas `OK:` y `Todas las verificaciones pasan.`

- [ ] **Step 5: Poner el candado en `getUsuarioActual`**

En `lib/usuario.ts`, añadir a la cabecera:

```ts
import { esCorreoDeAdmin, estaBloqueado } from "@/lib/roles";
```

Añadir esta función justo después de `ascenderSiEsAdmin`:

```ts
/**
 * El candado. A quien está bloqueado se le trata como si no hubiera sesión,
 * así que todos los `if (!usuario)` que ya existen —en cada página, en
 * `exigirProfesor`, en `exigirAdmin`— fallan cerrados sin una línea nueva.
 *
 * Va antes del ascenso por ADMIN_EMAILS a propósito: a un bloqueado no se le
 * sube el rol al entrar aunque su correo siga en la variable.
 */
async function dejarEntrar<
  T extends { id: string; email: string; role: string; bloqueadoEl: Date | null },
>(usuario: T): Promise<T | null> {
  if (estaBloqueado(usuario)) return null;
  return ascenderSiEsAdmin(usuario);
}
```

Y sustituir las **tres** salidas con usuario de `getUsuarioActual` para que pasen por él:

```ts
  if (porClerk) return dejarEntrar(porClerk);
```

```ts
  if (porCorreo) {
    return dejarEntrar(
      await prisma.user.update({
        where: { id: porCorreo.id },
        data: {
          clerkId: userId,
          firstName: porCorreo.firstName ?? clerkUser.firstName,
          lastName: porCorreo.lastName ?? clerkUser.lastName,
        },
      }),
    );
  }
```

```ts
  return dejarEntrar(
    await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      },
    }),
  );
```

Los `return null` no se tocan.

- [ ] **Step 6: Añadir `bloqueoDelActual`**

Al final de `lib/usuario.ts`, **antes** de la línea del alias `syncUser`:

```ts
/**
 * La fecha de bloqueo de quien tiene la sesión abierta, o null.
 *
 * Existe solo para el cartel: como `getUsuarioActual` ya devolvió null, el
 * layout no puede distinguir «bloqueado» de «sin sesión». Se llama únicamente
 * cuando el usuario ha salido nulo, así que es una consulta de más solo en el
 * caso raro.
 */
export async function bloqueoDelActual(): Promise<Date | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const fila = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { bloqueadoEl: true },
  });
  return fila?.bloqueadoEl ?? null;
}
```

- [ ] **Step 7: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 8: Comprobar que no se ha roto lo anterior**

Run: `npx tsx scripts/verificar-admin.ts`
Expected: **puede fallar en «al último administrador no se le puede quitar el rol»**, y si falla solo en esa línea es un fallo conocido y ajeno a esta tarea (está apuntado en la deuda del plan del diario: la cuenta real es `ADMIN` y ese script se creía el único). Cualquier **otro** fallo sí es tuyo — sobre todo en las líneas de `ascenderSiEsAdmin`, que es lo que acabas de envolver.

- [ ] **Step 9: Commit**

```bash
git add lib/roles.ts lib/usuario.ts scripts/verificar-personas.ts
git commit -m "Candado del bloqueo: a un bloqueado se le trata como si no hubiera sesión"
```

---

### Task 3: Bloquear y desbloquear

**Files:**
- Modify: `lib/admin.ts`
- Modify: `scripts/verificar-personas.ts` (bloque 2)

**Interfaces:**
- Consumes: `prisma`.
- Produces, desde `@/lib/admin`:
  - `async function puedeBloquearse(usuarioId: string, yoId: string): Promise<string | null>` — el motivo del rechazo, o `null` si se puede.
  - `async function bloquear(usuarioId: string): Promise<void>`
  - `async function desbloquear(usuarioId: string): Promise<void>`

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Ampliar el import del script:

```ts
import { bloquear, desbloquear, puedeBloquearse } from "@/lib/admin";
```

Y añadir en `main()`, antes del `console.log` final:

```ts
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
    // La aserción va sobre `puedeBloquearse` y no sobre el efecto de
    // `bloquear`: la guarda vive entera en la primera, así que comprobar
    // solo que la fecha se puso pasaría igual con una guarda rota.
    afirmar(
      (await puedeBloquearse(otro.id, ana.id)) === null,
      "con más de un administrador, a uno sí se le puede bloquear",
    );
    await bloquear(otro.id);
    afirmar(
      (await prisma.user.findUniqueOrThrow({ where: { id: otro.id } }))
        .bloqueadoEl !== null,
      "y bloquearlo le pone la fecha",
    );
  }
```

**Nota sobre la última comprobación.** La base de desarrollo puede tener ya un administrador real, así que «el último» no siempre es el que crea el script. La rama del `if` cubre los dos casos sin depender del estado de la base — el mismo problema que hoy hace fallar a `scripts/verificar-admin.ts`, evitado aquí desde el principio.

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: FAIL — `puedeBloquearse` no existe en `@/lib/admin`.

- [ ] **Step 3: Implementar las tres funciones**

Añadir al final de `lib/admin.ts`:

```ts
/**
 * Si bloquear a esta persona es mala idea, el motivo; si no, null.
 *
 * Las dos negativas son las mismas que protegen a `quitarProfesor`, y por el
 * mismo motivo: sin ellas un clic te deja fuera de tu propia aplicación y
 * solo se arregla entrando a la base a mano. ADMIN_EMAILS no es red aquí,
 * porque esa variable sube el rol pero no abre la puerta.
 */
export async function puedeBloquearse(
  usuarioId: string,
  yoId: string,
): Promise<string | null> {
  if (usuarioId === yoId) return "No puedes bloquearte a ti mismo.";

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true, bloqueadoEl: true },
  });
  if (!usuario) return "Esa persona no existe.";
  if (usuario.role !== "ADMIN") return null;

  // Solo cuentan los administradores que pueden entrar de verdad.
  const cuantos = await prisma.user.count({
    where: { role: "ADMIN", bloqueadoEl: null },
  });
  if (cuantos <= 1 && !usuario.bloqueadoEl) {
    return "No puedes bloquear al último administrador.";
  }
  return null;
}

/**
 * Cierra el acceso y anula lo que esa persona ya no va a poder hacer.
 *
 * Se anulan las clases futuras donde es el estudiante o el profesor, porque
 * ninguna de las dos se va a dar. No se tocan las de un grupo donde solo es
 * un miembro más: esa clase sigue siendo de los demás.
 */
export async function bloquear(usuarioId: string): Promise<void> {
  const ahora = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: usuarioId },
      data: { bloqueadoEl: ahora },
    }),
    prisma.clase.updateMany({
      where: {
        estado: "AGENDADA",
        empiezaEl: { gte: ahora },
        OR: [{ estudianteId: usuarioId }, { profesorId: usuarioId }],
      },
      data: { estado: "ANULADA" },
    }),
  ]);
}

/**
 * Devuelve el acceso. No resucita las clases anuladas: anularlas fue una
 * decisión, y deshacerla a espaldas del profesor sería peor que dejársela.
 */
export async function desbloquear(usuarioId: string): Promise<void> {
  await prisma.user.update({
    where: { id: usuarioId },
    data: { bloqueadoEl: null },
  });
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: todas las `OK:`, incluidas las once nuevas.

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/admin.ts scripts/verificar-personas.ts
git commit -m "Bloquear y desbloquear, con sus dos negativas"
```

---

### Task 4: Suprimir

**Files:**
- Modify: `lib/admin.ts`
- Modify: `scripts/verificar-personas.ts` (bloque 3)

**Interfaces:**
- Consumes: `prisma`.
- Produces, desde `@/lib/admin`:
  - `async function puedeSuprimirse(usuarioId: string, yoId: string): Promise<string | null>`
  - `async function suprimir(usuarioId: string): Promise<void>`

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Ampliar el import del script con `puedeSuprimirse` y `suprimir`, y añadir en `main()`:

```ts
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

  // Dos supresiones seguidas no chocan por el correo.
  const carla = await nuevaPersona("carla");
  await bloquear(carla.id);
  await suprimir(carla.id);
  afirmar(
    (await prisma.user.findUniqueOrThrow({ where: { id: carla.id } })).email !==
      lapida.email,
    "dos fichas suprimidas no chocan por el correo",
  );
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: FAIL — `puedeSuprimirse` no existe en `@/lib/admin`.

- [ ] **Step 3: Implementar las dos funciones**

Añadir al final de `lib/admin.ts`:

```ts
/**
 * Suprimir es irreversible, así que exige haber pasado antes por un gesto
 * que sí se puede deshacer: solo se suprime a quien ya está bloqueado.
 */
export async function puedeSuprimirse(
  usuarioId: string,
  yoId: string,
): Promise<string | null> {
  if (usuarioId === yoId) return "No puedes suprimirte a ti mismo.";

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { role: true, bloqueadoEl: true, suprimidoEl: true },
  });
  if (!usuario) return "Esa persona no existe.";
  if (usuario.suprimidoEl) return "Esa ficha ya está suprimida.";
  if (!usuario.bloqueadoEl) return "Primero hay que bloquearla.";

  if (usuario.role === "ADMIN") {
    // El bloqueo ya protegió al último administrador activo: quien llega
    // hasta aquí está bloqueado y por tanto no contaba como activo, así que
    // suprimirlo no deja a nadie fuera. Esta red solo salta si alguien ha
    // tocado la base a mano.
    const activos = await prisma.user.count({
      where: { role: "ADMIN", bloqueadoEl: null },
    });
    if (activos === 0) return "No queda ningún administrador activo.";
  }
  return null;
}

/**
 * Vacía la ficha sin borrar la fila.
 *
 * La fila se queda como lápida porque sus clases apuntan a ella: borrarla
 * las dejaría sin estudiante y sin grupo, que es el estado que `validarClase`
 * prohíbe. Las horas trabajadas son del profesor, no de quien se va.
 *
 * Todo en una transacción: una supresión a medias dejaría a alguien con la
 * ficha vaciada pero el progreso intacto, que es lo peor de los dos mundos.
 */
export async function suprimir(usuarioId: string): Promise<void> {
  const ahora = new Date();

  await prisma.$transaction([
    prisma.cuentaGoogle.deleteMany({ where: { usuarioId } }),
    prisma.miembroGrupo.deleteMany({ where: { estudianteId: usuarioId } }),
    prisma.deber.deleteMany({ where: { estudianteId: usuarioId } }),
    // Borrar la asignación se lleva en cascada sus PasoCompletado: los pasos
    // que marcó, lo que respondió en cada ejercicio y los puntos que le dieron.
    prisma.asignacion.deleteMany({ where: { estudianteId: usuarioId } }),

    // Lo que escribió sobrevive; la firma no.
    prisma.recorrido.updateMany({
      where: { autorId: usuarioId },
      data: { autorId: null },
    }),
    prisma.ejercicio.updateMany({
      where: { autorId: usuarioId },
      data: { autorId: null },
    }),
    prisma.archivo.updateMany({
      where: { subidoPorId: usuarioId },
      data: { subidoPorId: null },
    }),

    prisma.user.update({
      where: { id: usuarioId },
      data: {
        // El correo se sustituye y no se vacía porque la columna es única y
        // no acepta nulos. El id es un cuid, así que el nuevo es único por
        // construcción, y `.invalid` está reservado para que no sea de nadie.
        email: `suprimido-${usuarioId}@hispaprofe.invalid`,
        // Sin clerkId, si esa persona vuelve a registrarse empieza de cero
        // en vez de reengancharse a esta ficha.
        clerkId: null,
        firstName: null,
        lastName: null,
        nivel: null,
        tarifaCentimos: null,
        role: "STUDENT",
        suprimidoEl: ahora,
      },
    }),
  ]);
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: todas las `OK:`, incluidas las quince nuevas.

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/admin.ts scripts/verificar-personas.ts
git commit -m "Suprimir: vaciar la ficha sin perder las horas trabajadas"
```

---

### Task 5: Borrar una clase

**Files:**
- Modify: `lib/clases.ts`
- Modify: `scripts/verificar-personas.ts` (bloque 4)

**Interfaces:**
- Consumes: `prisma`; el tipo `EstadoClase` de `@/lib/generated/prisma/enums`, ya importado en ese archivo.
- Produces, desde `@/lib/clases`:
  - `function sePuedeBorrar(estado: EstadoClase): boolean`
  - `async function borrarClase(claseId: string): Promise<boolean>` — devuelve `true` si borró algo.

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Añadir al script un import de `@/lib/clases`:

```ts
import { borrarClase, sePuedeBorrar } from "@/lib/clases";
```

Y en `main()`:

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: FAIL — `sePuedeBorrar` no existe en `@/lib/clases`.

- [ ] **Step 3: Implementar las dos funciones**

Añadir al final de `lib/clases.ts`:

```ts
/**
 * Una clase dada no se borra: son horas trabajadas y puede que facturadas.
 * Para borrarla hay que volver a agendarla primero, que es un gesto
 * consciente y reversible.
 */
export function sePuedeBorrar(estado: EstadoClase): boolean {
  return estado !== "DADA";
}

/**
 * Borra la clase salvo que esté dada, y se lleva sus deberes por la cascada
 * del esquema. El filtro va dentro del propio delete para que no haya carrera
 * entre comprobar y borrar, igual que en `desmarcarSiNoRevisado`.
 *
 * Devuelve true si borró algo.
 */
export async function borrarClase(claseId: string): Promise<boolean> {
  const { count } = await prisma.clase.deleteMany({
    where: { id: claseId, estado: { not: "DADA" } },
  });
  return count > 0;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-personas.ts`
Expected: todas las `OK:`, incluidas las ocho nuevas, y `Todas las verificaciones pasan.`

- [ ] **Step 5: Comprobar que el diario sigue entero**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: pasa. Has añadido a `lib/clases.ts`, no cambiado nada.

- [ ] **Step 6: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/clases.ts scripts/verificar-personas.ts
git commit -m "Borrar una clase que no llegó a darse"
```

---

### Task 6: Las acciones de administración

**Files:**
- Create: `lib/acciones-admin.ts`
- Modify: `lib/acciones.ts` (quitar las tres acciones de administración, líneas 1049 en adelante)

**Interfaces:**
- Consumes: `exigirAdmin`, `puedeQuitarseElRol`, `puedeBloquearse`, `bloquear`, `desbloquear`, `puedeSuprimirse`, `suprimir` de `@/lib/admin`.
- Produces, exportadas desde `lib/acciones-admin.ts`, todas `(formData: FormData) => Promise<void>`:
  - `hacerProfesor` — campo `usuarioId`
  - `quitarProfesor` — campo `usuarioId`
  - `invitarProfesor` — campo `email`
  - `bloquearPersona` — campo `usuarioId`
  - `desbloquearPersona` — campo `usuarioId`
  - `suprimirPersona` — campos `usuarioId` y `confirmacion`

**Por qué se mudan las tres que ya hay.** `lib/acciones.ts` tiene 1.112 líneas y las nuevas son tres más. Dejar unas de administración en un archivo y otras en otro sería peor que cualquiera de las dos opciones puras. **Es una mudanza literal: el cuerpo de las tres no se toca.**

- [ ] **Step 1: Crear el archivo con las seis acciones**

Crear `lib/acciones-admin.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  bloquear,
  desbloquear,
  exigirAdmin,
  puedeBloquearse,
  puedeQuitarseElRol,
  puedeSuprimirse,
  suprimir,
} from "@/lib/admin";

function refrescar() {
  revalidatePath("/admin/personas");
  revalidatePath("/profe/alumnos");
  revalidatePath("/profe/clases");
  revalidatePath("/dashboard");
}

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

  refrescar();
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

  refrescar();
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

  refrescar();
}

export async function bloquearPersona(formData: FormData) {
  const yo = await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId) return;

  if (await puedeBloquearse(usuarioId, yo.id)) return;

  await bloquear(usuarioId);
  refrescar();
}

export async function desbloquearPersona(formData: FormData) {
  await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  if (!usuarioId) return;

  await desbloquear(usuarioId);
  refrescar();
}

/**
 * Suprime una ficha. Además de las salvaguardas de `puedeSuprimirse`, exige
 * que el correo escrito a mano coincida: obliga a mirar a quién se está
 * suprimiendo antes de un gesto que no se puede deshacer.
 */
export async function suprimirPersona(formData: FormData) {
  const yo = await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "").trim().toLowerCase();
  if (!usuarioId) return;

  if (await puedeSuprimirse(usuarioId, yo.id)) return;

  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { email: true },
  });
  if (!usuario || usuario.email.toLowerCase() !== confirmacion) return;

  await suprimir(usuarioId);
  refrescar();
}
```

- [ ] **Step 2: Quitar las tres de `lib/acciones.ts`**

Borrar de `lib/acciones.ts` todo el bloque final que empieza en la línea con el comentario `// ─── Administración ───…` y termina al final del archivo: son las tres funciones `hacerProfesor`, `quitarProfesor` e `invitarProfesor` con sus comentarios.

Después, comprobar si el import de `@/lib/admin` sigue haciendo falta:

Run: `grep -n "exigirAdmin\|puedeQuitarseElRol" lib/acciones.ts`
Expected: solo la línea del import. Si es así, borrar esa línea entera:

```ts
import { exigirAdmin, puedeQuitarseElRol } from "@/lib/admin";
```

Si el grep encuentra algún uso más, **para y pregunta** en vez de borrar el import: significa que ese archivo hace con `exigirAdmin` algo que este plan no previó.

- [ ] **Step 3: Reapuntar a quien las importaba**

Run: `grep -rn "hacerProfesor\|quitarProfesor\|invitarProfesor" app/ lib/`
Expected: solo `app/(app)/admin/personas/page.tsx` y el propio `lib/acciones-admin.ts`. En la página, cambiar el import:

```tsx
import { hacerProfesor, invitarProfesor, quitarProfesor } from "@/lib/acciones-admin";
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si sale «`exigirAdmin` is declared but never read» en `lib/acciones.ts`, el import del Paso 2 no se quitó.

- [ ] **Step 5: Comprobar que no se ha roto nada**

Run: `npx tsx scripts/verificar-personas.ts && npx tsx scripts/verificar-clases.ts`
Expected: los dos pasan.

- [ ] **Step 6: Commit**

```bash
git add lib/acciones-admin.ts lib/acciones.ts "app/(app)/admin/personas/page.tsx"
git commit -m "Las acciones de administración, juntas y en su propio archivo"
```

---

### Task 7: La pantalla de personas

**Files:**
- Modify: `app/(app)/admin/personas/page.tsx`

**Interfaces:**
- Consumes: `bloquearPersona`, `desbloquearPersona`, `suprimirPersona`, `hacerProfesor`, `invitarProfesor`, `quitarProfesor` de `@/lib/acciones-admin`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Traerse los dos campos nuevos**

En el `select` de `prisma.user.findMany`, añadir junto a `clerkId: true`:

```tsx
      bloqueadoEl: true,
      suprimidoEl: true,
```

- [ ] **Step 2: Ampliar el import de acciones**

```tsx
import {
  bloquearPersona,
  desbloquearPersona,
  hacerProfesor,
  invitarProfesor,
  quitarProfesor,
  suprimirPersona,
} from "@/lib/acciones-admin";
```

- [ ] **Step 3: Apagar la fila y añadir los botones**

Dentro del `.map((p) => {`, junto a las constantes que ya se calculan (`soyYo`, `puedeBajar`), añadir:

```tsx
          const bloqueado = p.bloqueadoEl !== null;
          const suprimido = p.suprimidoEl !== null;
```

En el `<li>`, añadir la clase de apagado a las que ya tiene:

```tsx
              className={`flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave ${
                bloqueado ? "opacity-60" : ""
              }`}
```

En el nombre, sustituir `{nombreDe(p)}` por:

```tsx
                  {suprimido ? "Ficha suprimida" : nombreDe(p)}
```

Y en la línea de debajo, sustituir `{p.email}` por:

```tsx
                  {suprimido ? "sin datos" : p.email}
```

Justo antes de la etiqueta del rol, añadir la de estado:

```tsx
              {bloqueado && (
                <span className="shrink-0 rounded-md bg-fondo px-2 py-0.5 text-xs font-semibold text-tinta-suave ring-1 ring-inset ring-hp-100">
                  {suprimido ? "Suprimido" : "Bloqueado"}
                </span>
              )}
```

Y dentro del `<div className="flex shrink-0 gap-2">`, después de los botones que ya hay:

```tsx
                {!soyYo && !suprimido && !bloqueado && (
                  <form action={bloquearPersona}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                    >
                      Bloquear
                    </button>
                  </form>
                )}
                {bloqueado && !suprimido && (
                  <form action={desbloquearPersona}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
                    >
                      Desbloquear
                    </button>
                  </form>
                )}
```

- [ ] **Step 4: Añadir el desplegable de suprimir**

Después del `</div>` de los botones y **dentro** del `<li>`, añadir:

```tsx
              {bloqueado && !suprimido && (
                <details className="w-full">
                  <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
                    Suprimir esta ficha
                  </summary>
                  <p className="mt-2 text-xs text-tinta-suave">
                    Se van su nombre, su correo, su cuenta, sus grupos, sus
                    deberes y todo su progreso. Sus clases se quedan, con sus
                    horas y su importe, como «Estudiante suprimido».{" "}
                    <strong className="text-tinta">Esto no se puede deshacer.</strong>
                  </p>
                  <form action={suprimirPersona} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <input
                      type="text"
                      name="confirmacion"
                      required
                      placeholder={`Escribe ${p.email} para confirmar`}
                      className="h-9 min-w-72 flex-1 rounded-full border border-hp-200 bg-fondo px-4 text-xs text-tinta outline-none focus:border-hp-400"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded-full bg-bloque3 px-4 text-xs font-bold text-tinta transition-opacity hover:opacity-80"
                    >
                      Suprimir
                    </button>
                  </form>
                </details>
              )}
```

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Comprobar que la ruta responde**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/personas`
Expected: 404 sin sesión (el candado del layout de `/admin`), y ningún error de compilación en `.next/dev/logs/next-development.log`.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/admin/personas/page.tsx"
git commit -m "Pantalla de personas: bloquear, desbloquear y suprimir"
```

---

### Task 8: El cartel y las etiquetas de suprimido

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `lib/clases.ts` (añadir `suprimidoEl` al `select` de `seleccionLista`)
- Modify: `app/(app)/profe/clases/page.tsx`
- Modify: `app/(app)/profe/clases/[id]/page.tsx`
- Modify: `app/(app)/profe/alumnos/[id]/page.tsx`

**Interfaces:**
- Consumes: `bloqueoDelActual` de `@/lib/usuario`; `estaSuprimido` de `@/lib/roles`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: El cartel de cuenta bloqueada**

En `app/(app)/layout.tsx`, ampliar el import:

```tsx
import { bloqueoDelActual, getUsuarioActual } from "@/lib/usuario";
```

Y justo después de la línea `const usuario = await getUsuarioActual();`:

```tsx
  // Si no hay usuario puede ser que no haya sesión o que esté bloqueado. Solo
  // en ese caso se pregunta por el bloqueo, así que es una consulta de más
  // únicamente en el caso raro.
  if (!usuario && (await bloqueoDelActual())) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-tinta">
          Tu acceso está bloqueado
        </h1>
        <p className="mt-3 text-tinta-suave">
          Tu cuenta sigue existiendo, pero ahora mismo no puedes entrar. Habla
          con tu profesor si crees que es un error.
        </p>
      </main>
    );
  }
```

**Por qué el cartel y no un 404:** quien está bloqueado no ha hecho nada raro, y una página rota le haría pensar que la aplicación falla. Un 404 se reserva para esconder lo que no debe saber que existe, como el área de administración.

- [ ] **Step 2: La etiqueta en la lista de clases**

En `app/(app)/profe/clases/page.tsx`, ampliar el import:

```tsx
import { estaSuprimido } from "@/lib/roles";
```

En el `select` de `listarClases` no hay que tocar nada —lo trae `lib/clases.ts`—, así que en su lugar hay que añadir `suprimidoEl` al `seleccionLista` de `lib/clases.ts`, dentro de `estudiante`:

```ts
  estudiante: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      suprimidoEl: true,
    },
  },
```

Y en la página, sustituir la expresión que pinta el nombre del destinatario:

```tsx
                    {c.estudiante
                      ? estaSuprimido(c.estudiante)
                        ? "Estudiante suprimido"
                        : nombreDe(c.estudiante)
                      : `Grupo · ${c.grupo?.nombre ?? "sin grupo"}`}
```

- [ ] **Step 3: La etiqueta en la ficha de la clase**

En `app/(app)/profe/clases/[id]/page.tsx`, ampliar el import con `estaSuprimido` de `@/lib/roles`, añadir `suprimidoEl: true` al `select` de `estudiante` y al de `asignados.estudiante`, y sustituir las dos expresiones que pintan un nombre:

En el `<h1>`:

```tsx
        {clase.estudiante
          ? estaSuprimido(clase.estudiante)
            ? "Estudiante suprimido"
            : nombreDe(clase.estudiante)
          : `Grupo · ${clase.grupo?.nombre ?? "sin grupo"}`}
```

En la lista de deberes:

```tsx
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">
                  {estaSuprimido(d.estudiante)
                    ? "Estudiante suprimido"
                    : nombreDe(d.estudiante)}
                </span>
```

- [ ] **Step 4: La etiqueta en el perfil del estudiante**

En `app/(app)/profe/alumnos/[id]/page.tsx`, ampliar el import con `estaSuprimido` de `@/lib/roles` y sustituir el cálculo del nombre:

```tsx
  const nombre = estaSuprimido(estudiante)
    ? "Ficha suprimida"
    : [estudiante.firstName, estudiante.lastName].filter(Boolean).join(" ") ||
      estudiante.email;
```

Y el correo de debajo:

```tsx
      <p className="mt-1 text-tinta-suave">
        {estaSuprimido(estudiante) ? "sin datos" : estudiante.email}
      </p>
```

- [ ] **Step 4b: Sacar las fichas suprimidas de los desplegables**

Este paso faltaba en la primera versión del plan y lo encontró la revisión de la
tarea. Las dos pantallas de clases consultan los estudiantes para sus
desplegables con `where: { role: "STUDENT" }`, y **una ficha suprimida conserva
ese rol**, así que aparecía en la lista enseñando su correo lápida —que parece
de verdad— y, peor, **se podía agendar una clase nueva con ella**.

En `app/(app)/profe/clases/page.tsx` y en `app/(app)/profe/clases/[id]/page.tsx`,
añadir al `where` de la consulta de `estudiantes`:

```tsx
      suprimidoEl: null,
```

**No filtres por `bloqueadoEl`:** bloquear cierra la puerta y anula las clases
futuras, pero la persona sigue en las listas —es la decisión de diseño— y
conserva su correo real, así que por ahí no se escapa nada.

En la ficha, la opción del **destinatario actual** que se añade a mano cuando la
consulta no lo trae —justo el caso que crea este filtro— necesita `suprimidoEl`
en su `select` y pintarse como «Estudiante suprimido» en vez de pasar por
`nombreDe`:

```tsx
                {estaSuprimido(e) ? "Estudiante suprimido" : nombreDe(e)}
```

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Comprobar que los scripts siguen pasando**

Run: `npx tsx scripts/verificar-clases.ts && npx tsx scripts/verificar-personas.ts`
Expected: los dos pasan. Has ampliado un `select`, no cambiado ninguna consulta.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(app)/profe/clases/page.tsx" "app/(app)/profe/clases/[id]/page.tsx" "app/(app)/profe/alumnos/[id]/page.tsx" lib/clases.ts
git commit -m "Cartel de cuenta bloqueada y etiquetas de ficha suprimida"
```

---

### Task 9: El botón de borrar la clase

**Files:**
- Modify: `lib/acciones-clases.ts`
- Modify: `app/(app)/profe/clases/[id]/page.tsx`

**Interfaces:**
- Consumes: `borrarClase` de `@/lib/clases`; `exigirClaseSuya` y `refrescar`, que ya son privadas de `lib/acciones-clases.ts`.
- Produces: `async function borrarLaClase(formData: FormData): Promise<void>` — campo `claseId`.

**Por qué `borrarLaClase` y no `borrarClase`:** la acción y la función de datos no pueden llamarse igual en un archivo que importa la segunda.

- [ ] **Step 1: Añadir la acción**

En `lib/acciones-clases.ts`, ampliar el import de `@/lib/clases` con `borrarClase`, y añadir al final del archivo:

```ts
/**
 * Borra la clase si no está dada. Después no se puede volver a su ficha, así
 * que lleva a la lista en vez de refrescar una página que ya no existe.
 */
export async function borrarLaClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  if (!(await borrarClase(claseId))) return;

  revalidatePath("/profe/clases");
  revalidatePath("/dashboard");
  redirect("/profe/clases");
}
```

Y añadir `redirect` a la cabecera del archivo:

```ts
import { redirect } from "next/navigation";
```

- [ ] **Step 2: Añadir el desplegable en la ficha**

En `app/(app)/profe/clases/[id]/page.tsx`, ampliar el import de `@/lib/acciones-clases` con `borrarLaClase`, y el de `@/lib/clases` con `sePuedeBorrar`.

Al final del componente, después del párrafo que explica lo de rehacer los deberes, añadir:

```tsx
      {sePuedeBorrar(clase.estado) && (
        <details className="mt-10">
          <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
            Borrar esta clase
          </summary>
          <p className="mt-2 text-sm text-tinta-suave">
            Desaparece del todo, con sus deberes. Si lo que quieres es dejar
            constancia de que se cayó, anúlala en vez de borrarla.
          </p>
          <form action={borrarLaClase} className="mt-3">
            <input type="hidden" name="claseId" value={clase.id} />
            <button
              type="submit"
              className="h-9 rounded-full bg-bloque3 px-4 text-xs font-bold text-tinta transition-opacity hover:opacity-80"
            >
              Borrar la clase
            </button>
          </form>
        </details>
      )}
```

**Por qué escondido tras un desplegable** y no suelto junto a «Guardar los cambios»: un botón que borra no debe estar a un clic de distancia de uno que guarda.

- [ ] **Step 3: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Pasar todas las verificaciones**

Run: `npx tsx scripts/verificar-personas.ts && npx tsx scripts/verificar-clases.ts && npx tsx scripts/verificar-ejercicios.ts && npx tsx scripts/verificar-puntos.ts`
Expected: los cuatro pasan.

- [ ] **Step 5: Comprobación a mano**

Run: `npm run fresh` (reinicia limpio; hace falta porque la Tarea 1 cambió el esquema)

Con la cuenta de administrador:

1. En `/admin/personas`, **Bloquear** a la cuenta de estudiante de pruebas. Su fila se apaga y sale la etiqueta «Bloqueado».
2. Si esa persona tenía una clase agendada, comprueba en `/profe/clases` que ha pasado a **Anulada**, y que las que ya diste siguen dadas y con su importe.
3. Entra con esa cuenta: debe salir el cartel **«Tu acceso está bloqueado»**, no una página rota.
4. Vuelve como administrador y **Desbloquea**. Esa persona entra otra vez, y la clase anulada **sigue anulada**.
5. Comprueba que en **tu propia fila** no aparece «Bloquear».
6. Bloquea a alguien y despliega **Suprimir esta ficha**: escribe un correo equivocado y pulsa — no debe pasar nada. Escribe el correcto: la fila pasa a «Ficha suprimida» y «sin datos».
7. En `/profe/clases`, sus clases siguen ahí, con sus horas y su importe, como **«Estudiante suprimido»**.
8. En la ficha de una clase **agendada**, despliega **Borrar esta clase** y bórrala: vuelves a la lista y ya no está.
9. En la ficha de una clase **dada**, comprueba que ese desplegable **no aparece**.

- [ ] **Step 6: Commit**

```bash
git add lib/acciones-clases.ts "app/(app)/profe/clases/[id]/page.tsx"
git commit -m "Botón de borrar una clase, escondido tras un desplegable"
```

---

## Deuda conocida al cerrar

Escrito el 2026-07-30, después de la revisión de rama y sus dos tandas de
arreglos.

**La lección: dos veces se enumeraron pantallas de memoria y dos veces faltaron.**
El diseño y el plan listaron «los sitios donde se enseña a una persona» de
recuerdo, y la revisión encontró primero dos consultas sin filtrar y luego tres
más. Ahora hay un ayudante único (`lib/estudiantes.ts`) que hace imposible
olvidarlo, y el tipo se queja si alguien intenta pasarle su propio `where`.
**Para la próxima: cuando un requisito diga «en todas partes», el plan lleva el
`grep` que produjo la lista y su salida, no una lista escrita a mano.**

Pendientes, por orden de lo que más pica:

- **Dos puertas por correo siguen sin comprobar la supresión:** `invitarProfesor`
  y `meterCorreosEnGrupo`. La segunda es la peor de las dos, porque recrear una
  membresía de grupo permite luego llegar a `asignarSecuenciaAGrupo`, que crea
  asignaciones sin pasar por `estudianteAsignable`. **Las dos exigen teclear
  entero `suprimido-<cuid>@hispaprofe.invalid`**, que ninguna pantalla enseña,
  así que no bloqueaban la integración — pero son la última esquina de la lápida
  y se cierran con un `if` en cada una.
- **`scripts/verificar-admin.ts` sigue fallando**, y no es de esta tanda: afirma
  «al último administrador no se le puede quitar el rol» dando por hecho que el
  único `ADMIN` es el que él crea. Se arregla con el mismo `if (soloUno)` que ya
  usa `scripts/verificar-personas.ts`.
- **Tres aserciones de `puedeHacerseProfesor` no discriminan:** usan una ficha
  que está suprimida *y* bloqueada, así que una implementación que guardara por
  `bloqueadoEl` en vez de por `suprimidoEl` pasaría igual. Con la fila `dani`,
  que ya está en ese script y está solo bloqueada, se arregla gratis.
- **El cartel de cuenta bloqueada no aparece en navegaciones de cliente.** Los
  layouts no se re-renderizan al navegar (lo dice el propio guide de Next 16 en
  `02-guides/authentication.md`), así que a quien bloqueen con una pestaña
  abierta le saldrá el `redirect` de la página en vez del cartel. Falla cerrado.
  Se arregla al recargar. **Añádelo a la comprobación a mano:** bloquear a
  alguien con una pestaña abierta y pulsar un enlace.
- **Los grupos de un profesor suprimido quedan sin administrar:** `Grupo.profesorId`
  apunta a la lápida y la pantalla de grupos se acota al profesor de la sesión.
  No se da hoy con un solo profesor.
- **Que las acciones vuelvan en silencio** cuando rechazan algo sigue sin
  decidirse para toda la aplicación. Es la misma pregunta aparcada en el diario.

## Fuera de alcance

- **Registro de quién bloqueó o suprimió a quién, y por qué.** Con un solo administrador no aporta nada todavía.
- **Avisar por correo a la persona bloqueada o suprimida.** La aplicación no envía correos.
- **Exportar los datos de alguien antes de suprimirlo.** Es la otra mitad del derecho al olvido y merece su propio diseño.
- **Bloquear temporalmente, con fecha de vuelta.** Se bloquea y se desbloquea a mano.
- **Que un profesor bloquee a sus estudiantes.** Hoy el único administrador es el único profesor.
- **Deshacer una supresión.** No se puede, y es a propósito.
