# Diario de clases — Tanda 1: el diario

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor registre sus clases —con deberes y horas— y que el estudiante vea en su tablero su próxima clase con el enlace y los deberes que le han puesto.

**Architecture:** Dos modelos nuevos, `Clase` y `Deber`. La clase es la ficha; `Deber` es una fila por estudiante que solo dice a quién y si está cerrado, con el texto viviendo en la clase. Los cálculos van en `lib/clases.ts` sin sesión, porque una acción de servidor no se puede llamar desde un script y solo lo que está fuera es verificable de verdad; las acciones, en `lib/acciones-clases.ts`, aparte porque `lib/acciones.ts` ya tiene 1.119 líneas.

**Tech Stack:** Next.js 16 (App Router, React Server Components), React 19, Prisma 7 con adaptador `@prisma/adapter-pg`, Clerk para sesión, Tailwind CSS 4, `tsx` para scripts.

**Diseño de referencia:** `docs/superpowers/specs/2026-07-29-diario-de-clases-design.md`

## Global Constraints

- **Lee la documentación de Next antes de escribir código.** `AGENTS.md` del repo: esta versión de Next tiene cambios de API respecto a lo que puedas recordar. Los guides están en `node_modules/next/dist/docs/`.
- Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos generados vienen de `@/lib/generated/prisma/client` y los enums de `@/lib/generated/prisma/enums`.
- Interfaz **en español con tildes**. Comentarios en español, cortos, explicando el porqué y no el qué.
- Tokens de Tailwind del proyecto: `hp-50…hp-700`, `sol-100…sol-400`, `bloque1-3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`. Nada de colores crudos.
- **El dinero se guarda en céntimos enteros.** Nunca euros con decimales.
- **Solo las clases `DADA` suman horas e importe.** `AGENDADA` y `ANULADA` no.
- **Una clase tiene estudiante o grupo, nunca los dos ni ninguno.** Prisma no lo sabe expresar; lo hace cumplir `validarClase`.
- **El importe se congela** al marcar la clase como dada. Cambiar la tarifa después no toca las clases ya dadas.
- Google Calendar (tanda 2) y la casilla de cobrada con sus tarifas (tanda 3) **quedan fuera de este plan**. Los campos existen en el esquema desde la Tarea 1, pero ninguna pantalla los usa todavía.
- No hay framework de pruebas. La verificación es `npx tsc --noEmit`, `npm run lint` y `scripts/verificar-clases.ts` al estilo de `scripts/verificar-admin.ts`.
- Las páginas de servidor llevan `export const dynamic = "force-dynamic"`, como todas las de `app/(app)/`.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `prisma/schema.prisma` | **Modificar.** `EstadoClase`, `Clase`, `Deber`, `tarifaCentimos` en `User` y `Grupo`. | 1 |
| `lib/fechas.ts` | **Crear.** Formatear fechas en español con zona fija. | 2 |
| `lib/clases.ts` | **Crear.** Los cálculos y las consultas, sin sesión. | 2, 3, 4, 5 |
| `lib/profesor.ts` | **Crear.** `exigirProfesor()`, que hoy es privada de `lib/acciones.ts`. | 6 |
| `lib/acciones.ts` | **Modificar.** Importar `exigirProfesor` en vez de definirla. | 6 |
| `lib/acciones-clases.ts` | **Crear.** Las acciones de servidor del diario. | 6 |
| `app/(app)/profe/clases/page.tsx` | **Crear.** Lista, filtros, totales y el formulario de nueva clase. | 7 |
| `app/(app)/profe/clases/[id]/page.tsx` | **Crear.** La ficha. | 8 |
| `app/(app)/dashboard/panel-estudiante.tsx` | **Modificar.** Próxima clase y deberes. | 9 |
| `app/(app)/layout.tsx` | **Modificar.** El enlace «Clases». | 9 |
| `app/(app)/profe/alumnos/[id]/page.tsx` | **Modificar.** Horas y enlace a sus clases. | 9 |
| `scripts/verificar-clases.ts` | **Crear.** Las verificaciones. | 2, 3, 4, 5 |

---

### Task 1: El esquema

Todo el esquema de las tres tandas en **una sola migración**. Las tandas 2 y 3 no necesitarán tocar la base: es más barato añadir tres columnas que nadie usa todavía que arrastrar dos migraciones más.

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: los modelos `Clase` y `Deber`, el enum `EstadoClase` y el campo `tarifaCentimos` en `User` y `Grupo`, todo importable desde `@/lib/generated/prisma/client` y `@/lib/generated/prisma/enums`.

- [ ] **Step 1: Añadir el enum y los dos modelos**

Al final de `prisma/schema.prisma`, después de `model CuentaGoogle`:

```prisma
// AGENDADA = todavía no ocurrió. DADA = ocurrió y cuenta.
// ANULADA  = se cayó: conserva notas y deberes, pero no cuenta.
enum EstadoClase {
  AGENDADA
  DADA
  ANULADA
}

// La clase en sí. Puede crearse antes de darla (agenda) o después
// (bitácora); la diferencia la marca `estado`, no la forma de nacer.
model Clase {
  id         String @id @default(cuid())
  profesor   User   @relation("ProfesorClase", fields: [profesorId], references: [id])
  profesorId String

  // Destinatario: uno de los dos, nunca los dos ni ninguno. Prisma no sabe
  // expresar esa exclusión, así que la hace cumplir `validarClase`.
  estudiante   User?   @relation("EstudianteClase", fields: [estudianteId], references: [id])
  estudianteId String?
  grupo        Grupo?  @relation(fields: [grupoId], references: [id])
  grupoId      String?

  empiezaEl DateTime
  // Duración y no hora de fin: es lo que hace falta para sumar horas, y
  // evita el caso de la clase que cruza la medianoche.
  minutos   Int
  estado    EstadoClase @default(AGENDADA)

  donde  String? // "en su casa", "aula 2"
  enlace String? // URL de conexión: Meet automático o pegado a mano
  notas  String? // registro académico. Privado del profesor.
  deberes String? // el texto, uno para toda la clase

  // Foto del precio al marcarla dada, no espejo de la tarifa actual.
  importeCentimos Int?
  cobradaEl       DateTime?

  googleEventoId String? // id del evento espejo en Google Calendar (tanda 2)

  asignados Deber[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([profesorId, empiezaEl])
  @@index([estudianteId, empiezaEl])
  @@index([grupoId, empiezaEl])
}

// Los deberes de una clase, uno por estudiante. No guarda el texto: vive en
// `Clase.deberes`. Así corregir una falta no obliga a reescribir seis filas,
// y aun así se puede cerrar el de Ana sin tocar el de Luis.
model Deber {
  id           String    @id @default(cuid())
  clase        Clase     @relation(fields: [claseId], references: [id], onDelete: Cascade)
  claseId      String
  estudiante   User      @relation("EstudianteDeber", fields: [estudianteId], references: [id], onDelete: Cascade)
  estudianteId String
  cerradoEl    DateTime?
  createdAt    DateTime  @default(now())

  @@unique([claseId, estudianteId])
  @@index([estudianteId, cerradoEl])
}
```

- [ ] **Step 2: Añadir los campos y las relaciones inversas**

En `model User`, después de `nivel Nivel?`:

```prisma
  // Tarifa por hora de este estudiante, en céntimos enteros. Los decimales
  // en coma flotante arrastran errores que al sumar un año se notan.
  tarifaCentimos Int?
```

Y en su bloque de relaciones, después de `cuentaGoogle CuentaGoogle?`:

```prisma
  clasesImpartidas Clase[] @relation("ProfesorClase")
  clasesRecibidas  Clase[] @relation("EstudianteClase")
  deberes          Deber[] @relation("EstudianteDeber")
```

En `model Grupo`, después de `nivel Nivel?`:

```prisma
  tarifaCentimos Int?
```

Y después de `miembros MiembroGrupo[]`:

```prisma
  clases Clase[]
```

- [ ] **Step 3: Crear la migración**

Run: `npx prisma migrate dev --name diario_de_clases`
Expected: crea la carpeta en `prisma/migrations/`, la aplica y regenera el cliente sin errores.

- [ ] **Step 4: Comprobar que el cliente tiene los tipos nuevos**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Esquema del diario de clases: Clase, Deber y las tarifas"
```

---

### Task 2: Los cálculos y la validación

**Files:**
- Create: `lib/fechas.ts`
- Create: `lib/clases.ts`
- Create: `scripts/verificar-clases.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`; el tipo `EstadoClase` de `@/lib/generated/prisma/enums`.
- Produces, desde `@/lib/clases`:
  - `function importeDeClase(tarifaCentimos: number | null, minutos: number): number | null`
  - `function validarClase(datos: { estudianteId?: string | null; grupoId?: string | null; minutos: number }): string | null` — devuelve el motivo del rechazo, o `null` si vale.
  - `function euros(centimos: number | null): string`
  - `function horas(minutos: number): string`
- Produces, desde `@/lib/fechas`:
  - `function fechaHora(d: Date): string` — «martes 4 de agosto, 18:00»
  - `function fechaCorta(d: Date): string` — «4/8/2026»
  - `function paraInput(d: Date): string` — «2026-08-04T18:00», el formato de `datetime-local`

- [ ] **Step 1: Escribir el script de verificación (falla, no existe el módulo)**

Crear `scripts/verificar-clases.ts`:

```ts
/**
 * Verifica los cálculos y las consultas del diario de clases. Crea sus
 * propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-clases.ts
 */
import "dotenv/config";
import { importeDeClase, validarClase, euros, horas } from "@/lib/clases";
import { fechaHora, paraInput } from "@/lib/fechas";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

// Marca única para no chocar con datos reales ni con otra ejecución.
const marca = `verificar-clases-${process.pid}`;

async function main() {
  // 1. El importe: la tarifa por los minutos, redondeado al céntimo.
  afirmar(importeDeClase(2000, 60) === 2000, "una hora a 20 € son 20 €");
  afirmar(importeDeClase(2000, 90) === 3000, "hora y media a 20 € son 30 €");
  afirmar(importeDeClase(2000, 45) === 1500, "tres cuartos a 20 € son 15 €");
  afirmar(importeDeClase(1750, 50) === 1458, "redondea al céntimo más cercano");
  afirmar(importeDeClase(null, 60) === null, "sin tarifa no hay importe");
  afirmar(importeDeClase(0, 60) === 0, "una tarifa de cero es cero, no es ausencia");

  // 2. La validación: destinatario exclusivo y duración positiva.
  afirmar(
    validarClase({ estudianteId: "a", minutos: 60 }) === null,
    "una clase con estudiante y duración vale",
  );
  afirmar(
    validarClase({ grupoId: "g", minutos: 60 }) === null,
    "una clase con grupo y duración vale",
  );
  afirmar(
    validarClase({ estudianteId: "a", grupoId: "g", minutos: 60 }) !== null,
    "con estudiante Y grupo se rechaza",
  );
  afirmar(
    validarClase({ minutos: 60 }) !== null,
    "sin destinatario se rechaza",
  );
  afirmar(
    validarClase({ estudianteId: "a", minutos: 0 }) !== null,
    "una clase de cero minutos se rechaza",
  );
  afirmar(
    validarClase({ estudianteId: "a", minutos: -30 }) !== null,
    "una duración negativa se rechaza",
  );

  // 3. Los formatos que ve la gente.
  afirmar(euros(2000) === "20,00 €", "veinte euros se escriben con coma");
  afirmar(euros(1458) === "14,58 €", "los céntimos no se pierden");
  afirmar(euros(null) === "—", "sin importe se enseña una raya, no un cero");
  afirmar(horas(90) === "1 h 30 min", "hora y media");
  afirmar(horas(60) === "1 h", "una hora justa no lleva minutos");
  afirmar(horas(45) === "45 min", "menos de una hora son solo minutos");
  afirmar(horas(0) === "0 min", "cero minutos no revienta");

  const cuando = new Date("2026-08-04T18:00:00+02:00");
  afirmar(
    fechaHora(cuando).includes("18:00"),
    "la hora se escribe en la zona de Madrid, no en UTC",
  );
  afirmar(paraInput(cuando) === "2026-08-04T18:00", "el formato del input cuadra");

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    // Red por si una verificación futura deja datos a medias.
    await prisma.deber.deleteMany({ where: { clase: { notas: marca } } });
    await prisma.clase.deleteMany({ where: { notas: marca } });
    await prisma.miembroGrupo.deleteMany({
      where: { grupo: { nombre: { contains: marca } } },
    });
    await prisma.grupo.deleteMany({ where: { nombre: { contains: marca } } });
    await prisma.user.deleteMany({ where: { email: { contains: marca } } });
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Ejecutarlo y comprobar que falla**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: FAIL — `Cannot find module '@/lib/clases'`.

- [ ] **Step 3: Crear el módulo de fechas**

Crear `lib/fechas.ts`:

```ts
/**
 * Fechas en español y con zona horaria fija.
 *
 * La zona se escribe a mano en vez de dejar la del servidor: en producción
 * el servidor va en UTC y una clase de las 18:00 se enseñaría a las 16:00.
 */
const ZONA = "Europe/Madrid";

const largo = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const corto = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

/** «martes, 4 de agosto, 18:00» */
export function fechaHora(d: Date): string {
  return largo.format(d);
}

/** «4/8/2026» */
export function fechaCorta(d: Date): string {
  return corto.format(d);
}

/**
 * El formato que quiere un <input type="datetime-local">: 2026-08-04T18:00.
 * Se compone a partir de las piezas ya traducidas a la zona, porque
 * `toISOString()` daría UTC y adelantaría o atrasaría la hora.
 */
export function paraInput(d: Date): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  // sv-SE da «2026-08-04 18:00»; el input quiere una T en medio.
  return partes.replace(" ", "T");
}
```

- [ ] **Step 4: Crear el módulo de clases con los cálculos**

Crear `lib/clases.ts`. **Sin ningún import todavía**: estos cuatro cálculos no
tocan la base, y un `import` sin usar hace fallar el lint. Los imports de Prisma
entran en la Tarea 3, con la primera función que los necesita.

```ts
/**
 * Lo que cuesta una clase: la tarifa por hora repartida entre los minutos
 * que duró, redondeada al céntimo.
 *
 * Sin tarifa devuelve null y no cero: son cosas distintas. Cero es una
 * clase gratis a propósito; null es un olvido que hay que enseñar.
 */
export function importeDeClase(
  tarifaCentimos: number | null,
  minutos: number,
): number | null {
  if (tarifaCentimos === null || tarifaCentimos === undefined) return null;
  return Math.round((tarifaCentimos * minutos) / 60);
}

/**
 * Las dos reglas que la base no sabe imponer. Devuelve el motivo del
 * rechazo para poder enseñárselo al profesor, o null si la clase vale.
 */
export function validarClase(datos: {
  estudianteId?: string | null;
  grupoId?: string | null;
  minutos: number;
}): string | null {
  const tieneEstudiante = Boolean(datos.estudianteId);
  const tieneGrupo = Boolean(datos.grupoId);

  if (tieneEstudiante && tieneGrupo) {
    return "Una clase es de un estudiante o de un grupo, no de los dos.";
  }
  if (!tieneEstudiante && !tieneGrupo) {
    return "Elige un estudiante o un grupo.";
  }
  if (!Number.isFinite(datos.minutos) || datos.minutos <= 0) {
    return "La duración tiene que ser mayor que cero.";
  }
  return null;
}

/** Céntimos en algo que se pueda leer. Una raya cuando no hay importe. */
export function euros(centimos: number | null): string {
  if (centimos === null || centimos === undefined) return "—";
  return `${(centimos / 100).toFixed(2).replace(".", ",")} €`;
}

/** Minutos en «1 h 30 min». */
export function horas(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
```

- [ ] **Step 5: Ejecutar el script y comprobar que pasa**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: veintiuna líneas `OK:` y `Todas las verificaciones pasan.`

- [ ] **Step 6: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/fechas.ts lib/clases.ts scripts/verificar-clases.ts
git commit -m "Cálculos del diario: importe, validación y formatos"
```

---

### Task 3: Los deberes — sincronizar y cerrar

**Files:**
- Modify: `lib/clases.ts` (añadir al final)
- Modify: `scripts/verificar-clases.ts` (añadir el bloque 4)

**Interfaces:**
- Consumes: `prisma`.
- Produces, desde `@/lib/clases`:
  - `async function destinatariosDe(claseId: string): Promise<string[]>` — los ids de los estudiantes de una clase: el suyo, o los del grupo.
  - `async function sincronizarDeberes(claseId: string): Promise<void>`
  - `async function cerrarDeber(deberId: string): Promise<void>`
  - `async function abrirDeber(deberId: string): Promise<void>`
  - `async function cerrarDeberesDeClase(claseId: string): Promise<number>` — devuelve cuántos cerró.

- [ ] **Step 1: Escribir las verificaciones (fallan)**

En `scripts/verificar-clases.ts`, ampliar el import de `@/lib/clases`:

```ts
import {
  importeDeClase,
  validarClase,
  euros,
  horas,
  destinatariosDe,
  sincronizarDeberes,
  cerrarDeber,
  abrirDeber,
  cerrarDeberesDeClase,
} from "@/lib/clases";
```

Y añadir en `main()`, antes del `console.log` final:

```ts
  // 4. Los deberes: una fila por estudiante, y se cierran de una en una.
  const profe = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  const ana = await prisma.user.create({
    data: { email: `ana-${marca}@ejemplo.test`, firstName: "Ana" },
  });
  const luis = await prisma.user.create({
    data: { email: `luis-${marca}@ejemplo.test`, firstName: "Luis" },
  });
  const grupo = await prisma.grupo.create({
    data: {
      nombre: `Grupo ${marca}`,
      profesorId: profe.id,
      miembros: {
        create: [{ estudianteId: ana.id }, { estudianteId: luis.id }],
      },
    },
  });

  // Clase particular con Ana: un solo deber.
  const particular = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: new Date("2026-08-04T18:00:00+02:00"),
      minutos: 60,
      notas: marca,
      deberes: "Ejercicios 3 y 4.",
    },
  });
  afirmar(
    (await destinatariosDe(particular.id)).length === 1,
    "una clase particular tiene un destinatario",
  );
  await sincronizarDeberes(particular.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: particular.id } })) === 1,
    "una clase particular genera un deber",
  );

  // Sincronizar dos veces no duplica.
  await sincronizarDeberes(particular.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: particular.id } })) === 1,
    "sincronizar dos veces no duplica el deber",
  );

  // Clase de grupo: un deber por miembro.
  const deGrupo = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      grupoId: grupo.id,
      empiezaEl: new Date("2026-08-05T18:00:00+02:00"),
      minutos: 90,
      notas: marca,
      deberes: "Leer el texto de la página 12.",
    },
  });
  afirmar(
    (await destinatariosDe(deGrupo.id)).length === 2,
    "una clase de grupo tiene tantos destinatarios como miembros",
  );
  await sincronizarDeberes(deGrupo.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: deGrupo.id } })) === 2,
    "un grupo de dos genera dos deberes",
  );

  // Cerrar el de Ana no cierra el de Luis.
  const deAna = await prisma.deber.findFirstOrThrow({
    where: { claseId: deGrupo.id, estudianteId: ana.id },
  });
  await cerrarDeber(deAna.id);
  afirmar(
    (await prisma.deber.count({
      where: { claseId: deGrupo.id, cerradoEl: { not: null } },
    })) === 1,
    "cerrar el deber de uno no cierra el de los demás",
  );

  // Y se puede volver a abrir, porque el profesor se equivoca.
  await abrirDeber(deAna.id);
  afirmar(
    (await prisma.deber.count({
      where: { claseId: deGrupo.id, cerradoEl: { not: null } },
    })) === 0,
    "un deber cerrado se puede volver a abrir",
  );

  // Cerrar todos de golpe.
  afirmar(
    (await cerrarDeberesDeClase(deGrupo.id)) === 2,
    "cerrar todos cierra los dos que quedaban",
  );
  afirmar(
    (await cerrarDeberesDeClase(deGrupo.id)) === 0,
    "volver a cerrar todos no toca nada ni revienta",
  );

  // El caso feo: cambiar el destinatario conserva lo ya cerrado de quien sigue.
  await prisma.miembroGrupo.deleteMany({
    where: { grupoId: grupo.id, estudianteId: luis.id },
  });
  await sincronizarDeberes(deGrupo.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: deGrupo.id } })) === 1,
    "quien sale del grupo pierde su deber",
  );
  const supervivienteAna = await prisma.deber.findFirstOrThrow({
    where: { claseId: deGrupo.id },
  });
  afirmar(
    supervivienteAna.estudianteId === ana.id &&
      supervivienteAna.cerradoEl !== null,
    "el deber ya cerrado de quien sigue se conserva cerrado",
  );

  // Vaciar el texto borra las filas: no hay deberes que enseñar.
  await prisma.clase.update({
    where: { id: deGrupo.id },
    data: { deberes: "" },
  });
  await sincronizarDeberes(deGrupo.id);
  afirmar(
    (await prisma.deber.count({ where: { claseId: deGrupo.id } })) === 0,
    "vaciar el texto de los deberes borra sus filas",
  );
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: FAIL — `destinatariosDe` no existe en `@/lib/clases`.

- [ ] **Step 3: Implementar las cinco funciones**

Añadir el primer import a la cabecera de `lib/clases.ts`, que hasta ahora no
tenía ninguno:

```ts
import { prisma } from "@/lib/prisma";
```

Y al final del archivo:

```ts
/**
 * Los estudiantes de una clase: el suyo si es particular, los del grupo si
 * es de grupo. Devuelve ids, que es lo único que necesitan los deberes.
 */
export async function destinatariosDe(claseId: string): Promise<string[]> {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      estudianteId: true,
      grupo: { select: { miembros: { select: { estudianteId: true } } } },
    },
  });
  if (!clase) return [];
  if (clase.estudianteId) return [clase.estudianteId];
  return clase.grupo?.miembros.map((m) => m.estudianteId) ?? [];
}

/**
 * Pone las filas de `Deber` de acuerdo con el texto y el destinatario de la
 * clase: crea las que faltan, borra las de quien ya no viene.
 *
 * Lo que NO hace es reabrir lo cerrado. Cerrar un deber es un hecho
 * ocurrido y no se deshace por editar la ficha, así que a quien sigue en la
 * clase no se le toca su fila.
 */
export async function sincronizarDeberes(claseId: string): Promise<void> {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: { deberes: true },
  });
  if (!clase) return;

  // Sin texto no hay deberes que enseñar a nadie.
  if (!clase.deberes?.trim()) {
    await prisma.deber.deleteMany({ where: { claseId } });
    return;
  }

  const destinatarios = await destinatariosDe(claseId);

  await prisma.deber.createMany({
    data: destinatarios.map((estudianteId) => ({ claseId, estudianteId })),
    skipDuplicates: true,
  });

  await prisma.deber.deleteMany({
    where: { claseId, estudianteId: { notIn: destinatarios } },
  });
}

export async function cerrarDeber(deberId: string): Promise<void> {
  await prisma.deber.update({
    where: { id: deberId },
    data: { cerradoEl: new Date() },
  });
}

/** Para cuando el profesor se equivoca al cerrar. */
export async function abrirDeber(deberId: string): Promise<void> {
  await prisma.deber.update({
    where: { id: deberId },
    data: { cerradoEl: null },
  });
}

/** Cierra los que quedaran abiertos. Devuelve cuántos eran. */
export async function cerrarDeberesDeClase(claseId: string): Promise<number> {
  const { count } = await prisma.deber.updateMany({
    where: { claseId, cerradoEl: null },
    data: { cerradoEl: new Date() },
  });
  return count;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: todas las `OK:`, incluidas las doce nuevas.

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/clases.ts scripts/verificar-clases.ts
git commit -m "Deberes del diario: una fila por estudiante, cierre individual"
```

---

### Task 4: El cuadro — consultas y totales

**Files:**
- Modify: `lib/clases.ts` (añadir al final)
- Modify: `scripts/verificar-clases.ts` (añadir el bloque 5)

**Interfaces:**
- Consumes: `prisma`; el tipo `EstadoClase` de `@/lib/generated/prisma/enums`.
- Produces, desde `@/lib/clases`:
  - `type FiltroClases = { profesorId?: string; estudianteId?: string; grupoId?: string; desde?: Date; hasta?: Date; estado?: EstadoClase; cobrada?: boolean }`
  - `type TotalesClases = { cuantas: number; minutos: number; totalCentimos: number; cobradoCentimos: number; pendienteCentimos: number; sinTarifa: number }`
  - `async function totalesDeClases(filtro: FiltroClases): Promise<TotalesClases>`
  - `async function listarClases(filtro: FiltroClases): Promise<ClaseDeLista[]>` — con el tipo `ClaseDeLista` exportado.

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Ampliar el import de `@/lib/clases` en el script con `totalesDeClases` y `listarClases`, y añadir en `main()` antes del `console.log` final:

```ts
  // 5. El cuadro: solo cuentan las dadas, y los filtros mandan.
  await prisma.clase.update({
    where: { id: particular.id },
    data: { estado: "DADA", importeCentimos: 2000 },
  });
  await prisma.clase.update({
    where: { id: deGrupo.id },
    data: { estado: "DADA", importeCentimos: 3000, cobradaEl: new Date() },
  });
  // Sin `const`: estas dos no vuelven a nombrarse, y una variable sin usar
  // es un aviso del lint.
  await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: new Date("2026-08-06T18:00:00+02:00"),
      minutos: 120,
      estado: "ANULADA",
      importeCentimos: 4000,
      notas: marca,
    },
  });
  await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: luis.id,
      empiezaEl: new Date("2026-08-07T18:00:00+02:00"),
      minutos: 30,
      estado: "DADA",
      notas: marca,
    },
  });
  // Esta sí: la Tarea 5 la usa para comprobar la próxima clase.
  const agendada = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      estudianteId: ana.id,
      empiezaEl: new Date("2099-01-01T18:00:00+01:00"),
      minutos: 60,
      notas: marca,
    },
  });

  const todo = await totalesDeClases({ profesorId: profe.id });
  afirmar(todo.cuantas === 3, "cuenta las tres dadas y ninguna más");
  afirmar(
    todo.minutos === 60 + 90 + 30,
    "la anulada y la agendada no suman minutos",
  );
  afirmar(todo.totalCentimos === 5000, "suma solo el importe de las dadas");
  afirmar(todo.cobradoCentimos === 3000, "el cobrado sale de las que tienen fecha");
  afirmar(todo.pendienteCentimos === 2000, "lo pendiente es el total menos lo cobrado");
  afirmar(todo.sinTarifa === 1, "avisa de la clase dada sin importe");

  const soloAna = await totalesDeClases({
    profesorId: profe.id,
    estudianteId: ana.id,
  });
  afirmar(soloAna.cuantas === 1, "filtrar por estudiante deja solo lo suyo");
  afirmar(soloAna.minutos === 60, "y sus minutos");

  const enAgosto = await totalesDeClases({
    profesorId: profe.id,
    desde: new Date("2026-08-05T00:00:00+02:00"),
    hasta: new Date("2026-08-06T00:00:00+02:00"),
  });
  afirmar(enAgosto.cuantas === 1, "el rango de fechas recorta por los dos lados");

  const pendientes = await totalesDeClases({
    profesorId: profe.id,
    cobrada: false,
  });
  afirmar(pendientes.cuantas === 2, "filtrar por sin cobrar deja las dos que faltan");

  const agendadas = await totalesDeClases({
    profesorId: profe.id,
    estado: "AGENDADA",
  });
  afirmar(
    agendadas.cuantas === 0 && agendadas.minutos === 0,
    "pedir los totales de las agendadas da cero: solo las dadas cuentan",
  );

  const lista = await listarClases({ profesorId: profe.id });
  afirmar(lista.length === 5, "la lista sí enseña las cinco, no solo las dadas");
  afirmar(
    lista[0].id === agendada.id,
    "la lista va de la más futura a la más antigua",
  );
  afirmar(
    lista.some((c) => c.grupo?.nombre.includes(marca)),
    "la lista trae el nombre del grupo",
  );
  afirmar(
    lista.some((c) => c.estudiante?.firstName === "Ana"),
    "y el nombre del estudiante",
  );
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: FAIL — `totalesDeClases` no existe en `@/lib/clases`.

- [ ] **Step 3: Implementar el filtro, los totales y la lista**

Añadir al final de `lib/clases.ts`, y en la cabecera del archivo:

```ts
import type { Prisma } from "@/lib/generated/prisma/client";
import type { EstadoClase } from "@/lib/generated/prisma/enums";
```

```ts
export type FiltroClases = {
  profesorId?: string;
  estudianteId?: string;
  grupoId?: string;
  desde?: Date;
  hasta?: Date;
  estado?: EstadoClase;
  cobrada?: boolean;
};

function whereDeFiltro(filtro: FiltroClases): Prisma.ClaseWhereInput {
  const where: Prisma.ClaseWhereInput = {};

  if (filtro.profesorId) where.profesorId = filtro.profesorId;
  if (filtro.estudianteId) where.estudianteId = filtro.estudianteId;
  if (filtro.grupoId) where.grupoId = filtro.grupoId;
  if (filtro.estado) where.estado = filtro.estado;
  if (filtro.cobrada !== undefined) {
    where.cobradaEl = filtro.cobrada ? { not: null } : null;
  }
  if (filtro.desde || filtro.hasta) {
    where.empiezaEl = {
      ...(filtro.desde ? { gte: filtro.desde } : {}),
      ...(filtro.hasta ? { lte: filtro.hasta } : {}),
    };
  }

  return where;
}

export type TotalesClases = {
  cuantas: number;
  minutos: number;
  totalCentimos: number;
  cobradoCentimos: number;
  pendienteCentimos: number;
  /** Clases dadas sin importe: un olvido de tarifa, no un cero. */
  sinTarifa: number;
};

/**
 * Los cuatro números del cuadro, sobre lo que diga el filtro.
 *
 * Encima del filtro se impone `estado: DADA`: una clase agendada o anulada
 * no es trabajo hecho. Eso hace que pedir los totales filtrando por
 * AGENDADA devuelva ceros, y es lo correcto — no hay horas trabajadas en
 * una clase que todavía no ha ocurrido.
 */
export async function totalesDeClases(
  filtro: FiltroClases,
): Promise<TotalesClases> {
  // El filtro pide un estado que no es DADA: la intersección con «lo
  // trabajado» es vacía, y se responde sin ir a la base.
  if (filtro.estado && filtro.estado !== "DADA") {
    return {
      cuantas: 0,
      minutos: 0,
      totalCentimos: 0,
      cobradoCentimos: 0,
      pendienteCentimos: 0,
      sinTarifa: 0,
    };
  }

  const where: Prisma.ClaseWhereInput = {
    ...whereDeFiltro(filtro),
    estado: "DADA",
  };

  const [todas, cobradas, sinImporte] = await Promise.all([
    prisma.clase.aggregate({
      where,
      _sum: { minutos: true, importeCentimos: true },
      _count: { _all: true },
    }),
    prisma.clase.aggregate({
      where: { ...where, cobradaEl: { not: null } },
      _sum: { importeCentimos: true },
    }),
    prisma.clase.count({ where: { ...where, importeCentimos: null } }),
  ]);

  const totalCentimos = todas._sum.importeCentimos ?? 0;
  const cobradoCentimos = cobradas._sum.importeCentimos ?? 0;

  return {
    cuantas: todas._count._all,
    minutos: todas._sum.minutos ?? 0,
    totalCentimos,
    cobradoCentimos,
    pendienteCentimos: totalCentimos - cobradoCentimos,
    sinTarifa: sinImporte,
  };
}

const seleccionLista = {
  id: true,
  empiezaEl: true,
  minutos: true,
  estado: true,
  donde: true,
  enlace: true,
  deberes: true,
  importeCentimos: true,
  cobradaEl: true,
  estudiante: { select: { id: true, firstName: true, lastName: true, email: true } },
  grupo: { select: { id: true, nombre: true } },
  _count: { select: { asignados: true } },
} satisfies Prisma.ClaseSelect;

export type ClaseDeLista = Prisma.ClaseGetPayload<{
  select: typeof seleccionLista;
}>;

/**
 * Las clases del filtro, de la más reciente a la más antigua. A diferencia
 * de los totales, aquí salen todas: agendadas, dadas y anuladas. La lista
 * es para ver, no para sumar.
 */
export async function listarClases(
  filtro: FiltroClases,
): Promise<ClaseDeLista[]> {
  return prisma.clase.findMany({
    where: whereDeFiltro(filtro),
    orderBy: { empiezaEl: "desc" },
    select: seleccionLista,
  });
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: todas las `OK:`, incluidas las quince nuevas.

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/clases.ts scripts/verificar-clases.ts
git commit -m "Cuadro de horas: filtros, totales y lista de clases"
```

---

### Task 5: El lado del estudiante

**Files:**
- Modify: `lib/clases.ts` (añadir al final)
- Modify: `scripts/verificar-clases.ts` (añadir el bloque 6)

**Interfaces:**
- Consumes: `prisma`.
- Produces, desde `@/lib/clases`:
  - `async function proximaClase(estudianteId: string, ahora?: Date): Promise<ProximaClase | null>` con `type ProximaClase = { id: string; empiezaEl: Date; minutos: number; enlace: string | null; donde: string | null; profesor: string }`
  - `async function deberesPendientes(estudianteId: string): Promise<DeberPendiente[]>` con `type DeberPendiente = { id: string; texto: string; claseEl: Date }`

El parámetro `ahora` existe para poder verificar sin depender del reloj de quien ejecuta el script.

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Ampliar el import con `proximaClase` y `deberesPendientes`, y añadir en `main()`:

```ts
  // 6. El tablero del estudiante: su próxima clase y sus deberes.
  const referencia = new Date("2026-08-01T00:00:00+02:00");

  const proximaDeAna = await proximaClase(ana.id, referencia);
  afirmar(proximaDeAna !== null, "Ana tiene una próxima clase");
  afirmar(
    proximaDeAna!.id === agendada.id,
    "la próxima es la agendada, no la dada ni la anulada",
  );

  // Una clase de grupo agendada también es la próxima de sus miembros.
  const grupalFutura = await prisma.clase.create({
    data: {
      profesorId: profe.id,
      grupoId: grupo.id,
      empiezaEl: new Date("2026-08-02T18:00:00+02:00"),
      minutos: 60,
      notas: marca,
      enlace: "https://meet.example/abc",
    },
  });
  const otraVez = await proximaClase(ana.id, referencia);
  afirmar(
    otraVez!.id === grupalFutura.id,
    "una clase de su grupo cuenta como suya, y la más cercana gana",
  );
  afirmar(
    otraVez!.enlace === "https://meet.example/abc",
    "la próxima clase trae su enlace",
  );

  // Luis ya no está en el grupo: esa clase no es suya.
  const deLuis = await proximaClase(luis.id, referencia);
  afirmar(
    deLuis === null,
    "quien no está en el grupo no ve esa clase como suya",
  );

  // Después de la última clase agendada no hay próxima.
  afirmar(
    (await proximaClase(ana.id, new Date("2100-01-01T00:00:00Z"))) === null,
    "sin clases futuras no hay próxima clase",
  );

  // Los deberes pendientes: los de la clase particular, que siguen abiertos.
  const pendientesDeAna = await deberesPendientes(ana.id);
  afirmar(
    pendientesDeAna.length === 1,
    "Ana tiene un deber pendiente, el de la clase particular",
  );
  afirmar(
    pendientesDeAna[0].texto === "Ejercicios 3 y 4.",
    "el deber trae el texto de su clase",
  );

  // Una clase anulada esconde sus deberes del tablero.
  await prisma.clase.update({
    where: { id: particular.id },
    data: { estado: "ANULADA" },
  });
  afirmar(
    (await deberesPendientes(ana.id)).length === 0,
    "los deberes de una clase anulada desaparecen del tablero",
  );
  afirmar(
    (await prisma.deber.count({ where: { claseId: particular.id } })) === 1,
    "pero la fila sigue ahí para el historial del profesor",
  );
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: FAIL — `proximaClase` no existe en `@/lib/clases`.

- [ ] **Step 3: Implementar las dos consultas**

Añadir al final de `lib/clases.ts`:

```ts
export type ProximaClase = {
  id: string;
  empiezaEl: Date;
  minutos: number;
  enlace: string | null;
  donde: string | null;
  profesor: string;
};

/**
 * La siguiente clase agendada de este estudiante: la suya o la de un grupo
 * donde esté. `ahora` se puede pasar para verificarla sin depender del
 * reloj de la máquina.
 */
export async function proximaClase(
  estudianteId: string,
  ahora: Date = new Date(),
): Promise<ProximaClase | null> {
  const clase = await prisma.clase.findFirst({
    where: {
      estado: "AGENDADA",
      empiezaEl: { gte: ahora },
      OR: [
        { estudianteId },
        { grupo: { miembros: { some: { estudianteId } } } },
      ],
    },
    orderBy: { empiezaEl: "asc" },
    select: {
      id: true,
      empiezaEl: true,
      minutos: true,
      enlace: true,
      donde: true,
      profesor: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!clase) return null;

  const p = clase.profesor;
  return {
    id: clase.id,
    empiezaEl: clase.empiezaEl,
    minutos: clase.minutos,
    enlace: clase.enlace,
    donde: clase.donde,
    profesor:
      [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email,
  };
}

export type DeberPendiente = {
  id: string;
  texto: string;
  claseEl: Date;
};

/**
 * Los deberes que este estudiante tiene sin cerrar. Los de una clase
 * anulada no salen: pedirle los deberes de una clase que se canceló no
 * tiene sentido, aunque la fila se conserve para el historial del profesor.
 */
export async function deberesPendientes(
  estudianteId: string,
): Promise<DeberPendiente[]> {
  const filas = await prisma.deber.findMany({
    where: {
      estudianteId,
      cerradoEl: null,
      clase: { estado: { not: "ANULADA" } },
    },
    orderBy: { clase: { empiezaEl: "desc" } },
    select: {
      id: true,
      clase: { select: { deberes: true, empiezaEl: true } },
    },
  });

  return filas.map((f) => ({
    id: f.id,
    texto: f.clase.deberes ?? "",
    claseEl: f.clase.empiezaEl,
  }));
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: todas las `OK:`, incluidas las diez nuevas, y `Todas las verificaciones pasan.`

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/clases.ts scripts/verificar-clases.ts
git commit -m "Tablero del estudiante: su próxima clase y sus deberes pendientes"
```

---

### Task 6: Las acciones de servidor

**Files:**
- Create: `lib/profesor.ts`
- Modify: `lib/acciones.ts` (quitar la función privada, importarla)
- Create: `lib/acciones-clases.ts`

**Interfaces:**
- Consumes: `validarClase`, `importeDeClase`, `sincronizarDeberes`, `cerrarDeber`, `abrirDeber`, `cerrarDeberesDeClase` de `@/lib/clases`; `getUsuarioActual` de `@/lib/usuario`.
- Produces, desde `@/lib/profesor`:
  - `async function exigirProfesor()` — lanza si quien pide no es `PROFESOR` ni `ADMIN`.
- Produces, exportadas desde `lib/acciones-clases.ts`, todas `(formData: FormData) => Promise<void>`:
  - `crearClase` — campos `empiezaEl`, `minutos`, `destinatario`, `donde`, `enlace`
  - `editarClase` — los mismos más `claseId`
  - `guardarFicha` — `claseId`, `notas`, `deberes`
  - `cambiarEstadoClase` — `claseId`, `estado`
  - `cerrarDeberDeClase` / `abrirDeberDeClase` — `claseId`, `deberId`
  - `cerrarTodos` — `claseId`

**El campo `destinatario`** llega como `alumno:<id>` o `grupo:<id>`. Un solo desplegable en vez de dos hace imposible por construcción elegir los dos a la vez, que es justo el error que `validarClase` tiene que atrapar.

- [ ] **Step 1: Sacar `exigirProfesor` a su propio archivo**

Crear `lib/profesor.ts`:

```ts
import { getUsuarioActual } from "@/lib/usuario";

/**
 * Gemelo de `exigirAdmin`, un escalón por debajo. Vive aquí y no en
 * `lib/acciones.ts` porque ahora la necesitan dos archivos de acciones.
 */
export async function exigirProfesor() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    throw new Error("Solo un profesor puede hacer esto.");
  }
  return usuario;
}
```

En `lib/acciones.ts`, borrar la función local (líneas 21-27, la que empieza por `async function exigirProfesor()`) y añadir a la cabecera:

```ts
import { exigirProfesor } from "@/lib/profesor";
```

- [ ] **Step 2: Comprobar que no se ha roto nada**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si aparece «`exigirProfesor` is declared but never read» o similar, la función local no se borró bien.

- [ ] **Step 3: Crear las acciones del diario**

Crear `lib/acciones-clases.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import {
  abrirDeber,
  cerrarDeber,
  cerrarDeberesDeClase,
  importeDeClase,
  sincronizarDeberes,
  validarClase,
} from "@/lib/clases";
import type { EstadoClase } from "@/lib/generated/prisma/enums";

/** Parte «alumno:abc» o «grupo:xyz» en lo que entiende la base. */
function partirDestinatario(bruto: string): {
  estudianteId: string | null;
  grupoId: string | null;
} {
  const [clase, id] = bruto.split(":");
  if (clase === "alumno" && id) return { estudianteId: id, grupoId: null };
  if (clase === "grupo" && id) return { estudianteId: null, grupoId: id };
  return { estudianteId: null, grupoId: null };
}

/**
 * La clase existe y es de quien pide, o es un administrador. Devuelve la
 * clase para no volver a leerla.
 */
async function exigirClaseSuya(claseId: string) {
  const usuario = await exigirProfesor();
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      id: true,
      profesorId: true,
      minutos: true,
      estudianteId: true,
      grupoId: true,
      importeCentimos: true,
    },
  });
  if (!clase) throw new Error("Esa clase no existe.");
  if (clase.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    throw new Error("Esa clase no es tuya.");
  }
  return clase;
}

/**
 * El deber es de esta clase. Sin esto, acertar un `claseId` propio bastaría
 * para cerrar o abrir el deber de la clase de otro profesor: el permiso
 * estaría comprobado, pero sobre el recurso equivocado.
 */
async function exigirDeberDeClase(
  claseId: string,
  deberId: string,
): Promise<boolean> {
  const deber = await prisma.deber.findUnique({
    where: { id: deberId },
    select: { claseId: true },
  });
  return deber?.claseId === claseId;
}

/**
 * Parte y valida los campos que crear y editar comparten. Null si algo no
 * vale, para que quien llama vuelva sin escribir sin repetir la comprobación.
 */
function datosDeClase(formData: FormData): {
  empiezaEl: Date;
  minutos: number;
  estudianteId: string | null;
  grupoId: string | null;
  donde: string | null;
  enlace: string | null;
} | null {
  const empiezaEl = new Date(String(formData.get("empiezaEl") ?? ""));
  const minutos = Number(String(formData.get("minutos") ?? "0"));
  const { estudianteId, grupoId } = partirDestinatario(
    String(formData.get("destinatario") ?? ""),
  );

  if (Number.isNaN(empiezaEl.getTime())) return null;
  if (validarClase({ estudianteId, grupoId, minutos })) return null;

  return {
    empiezaEl,
    minutos,
    estudianteId,
    grupoId,
    donde: String(formData.get("donde") ?? "").trim() || null,
    enlace: String(formData.get("enlace") ?? "").trim() || null,
  };
}

/**
 * La tarifa que aplica a una clase: la del estudiante, o la del grupo. Null
 * si nadie la tiene puesta, que es un olvido y no una clase gratis.
 */
async function tarifaDe(
  estudianteId: string | null,
  grupoId: string | null,
): Promise<number | null> {
  if (estudianteId) {
    const u = await prisma.user.findUnique({
      where: { id: estudianteId },
      select: { tarifaCentimos: true },
    });
    return u?.tarifaCentimos ?? null;
  }
  if (grupoId) {
    const g = await prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { tarifaCentimos: true },
    });
    return g?.tarifaCentimos ?? null;
  }
  return null;
}

function refrescar(claseId?: string) {
  revalidatePath("/profe/clases");
  if (claseId) revalidatePath(`/profe/clases/${claseId}`);
  revalidatePath("/dashboard");
}

export async function crearClase(formData: FormData) {
  const usuario = await exigirProfesor();

  const datos = datosDeClase(formData);
  if (!datos) return;

  await prisma.clase.create({
    data: {
      profesorId: usuario.id,
      ...datos,
    },
  });

  refrescar();
}

export async function editarClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  const datos = datosDeClase(formData);
  if (!datos) return;

  await prisma.clase.update({
    where: { id: claseId },
    data: datos,
  });

  // Cambiar el destinatario cambia a quién le tocan los deberes.
  await sincronizarDeberes(claseId);

  refrescar(claseId);
}

/** Las notas privadas y el texto de los deberes. */
export async function guardarFicha(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      notas: String(formData.get("notas") ?? "").trim() || null,
      deberes: String(formData.get("deberes") ?? "").trim() || null,
    },
  });

  await sincronizarDeberes(claseId);

  refrescar(claseId);
}

/**
 * Agendada, dada o anulada. Al pasar a DADA se calcula el importe con la
 * tarifa de ahora y se queda congelado ahí; volver a marcarla dada no lo
 * recalcula, porque eso reescribiría el pasado.
 */
export async function cambiarEstadoClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoClase;
  if (!claseId) return;
  if (!["AGENDADA", "DADA", "ANULADA"].includes(estado)) return;

  const clase = await exigirClaseSuya(claseId);

  // Solo se calcula si no había importe. Recalcularlo reescribiría el pasado.
  const calcular = estado === "DADA" && clase.importeCentimos === null;
  const importeCentimos = calcular
    ? importeDeClase(
        await tarifaDe(clase.estudianteId, clase.grupoId),
        clase.minutos,
      )
    : undefined;

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      estado,
      ...(importeCentimos !== undefined ? { importeCentimos } : {}),
    },
  });

  refrescar(claseId);
}

export async function cerrarDeberDeClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const deberId = String(formData.get("deberId") ?? "");
  if (!claseId || !deberId) return;
  await exigirClaseSuya(claseId);
  if (!(await exigirDeberDeClase(claseId, deberId))) return;

  await cerrarDeber(deberId);
  refrescar(claseId);
}

export async function abrirDeberDeClase(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  const deberId = String(formData.get("deberId") ?? "");
  if (!claseId || !deberId) return;
  await exigirClaseSuya(claseId);
  if (!(await exigirDeberDeClase(claseId, deberId))) return;

  await abrirDeber(deberId);
  refrescar(claseId);
}

export async function cerrarTodos(formData: FormData) {
  const claseId = String(formData.get("claseId") ?? "");
  if (!claseId) return;
  await exigirClaseSuya(claseId);

  await cerrarDeberesDeClase(claseId);
  refrescar(claseId);
}
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Comprobar que el script sigue pasando**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: todas las `OK:`. Sacar `exigirProfesor` de sitio no debe haber tocado nada de esto, pero conviene mirarlo.

- [ ] **Step 6: Commit**

```bash
git add lib/profesor.ts lib/acciones.ts lib/acciones-clases.ts
git commit -m "Acciones del diario de clases"
```

---

### Task 7: La lista de clases

**Files:**
- Create: `app/(app)/profe/clases/page.tsx`

**Interfaces:**
- Consumes: `listarClases`, `totalesDeClases`, `euros`, `horas` de `@/lib/clases`; `fechaHora` de `@/lib/fechas`; `crearClase` de `@/lib/acciones-clases`; `getUsuarioActual`; `prisma`.
- Produces: la ruta `/profe/clases`.

- [ ] **Step 1: Crear la página**

Crear `app/(app)/profe/clases/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { euros, horas, listarClases, totalesDeClases } from "@/lib/clases";
import type { FiltroClases } from "@/lib/clases";
import { fechaHora } from "@/lib/fechas";
import { crearClase } from "@/lib/acciones-clases";
import type { EstadoClase } from "@/lib/generated/prisma/enums";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const estadoLabel: Record<string, string> = {
  AGENDADA: "Agendada",
  DADA: "Dada",
  ANULADA: "Anulada",
};

const estadoStyle: Record<string, string> = {
  AGENDADA: "bg-hp-100 text-hp-700 ring-hp-200",
  DADA: "bg-bloque2/25 text-tinta ring-bloque2/50",
  ANULADA: "bg-fondo text-tinta-suave ring-hp-100",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

/**
 * Una fecha del filtro. Vacía o ilegible es «sin filtro», no un error.
 *
 * `finDeDia` es imprescindible en «hasta»: un <input type="date"> da
 * «2026-08-05», y tomarlo como medianoche dejaría fuera la clase de ese
 * mismo día a las seis de la tarde. «Hasta el 5» significa el 5 incluido.
 */
function fechaDeTexto(bruto?: string, finDeDia = false): Date | undefined {
  if (!bruto) return undefined;
  const d = new Date(`${bruto}T${finDeDia ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function Total({ n, etiqueta }: { n: string; etiqueta: string }) {
  return (
    <div className="rounded-tarjeta border border-hp-100 bg-white p-4 shadow-suave">
      <p className="text-2xl font-extrabold text-tinta">{n}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-tinta-suave">
        {etiqueta}
      </p>
    </div>
  );
}

export default async function ClasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    quien?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    cobrada?: string;
  }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const q = await searchParams;

  const [tipo, id] = (q.quien ?? "").split(":");
  const filtro: FiltroClases = {
    profesorId: usuario.id,
    estudianteId: tipo === "alumno" ? id : undefined,
    grupoId: tipo === "grupo" ? id : undefined,
    desde: fechaDeTexto(q.desde),
    hasta: fechaDeTexto(q.hasta, true),
    estado: q.estado ? (q.estado as EstadoClase) : undefined,
    cobrada: q.cobrada === "si" ? true : q.cobrada === "no" ? false : undefined,
  };

  const [clases, totales, estudiantes, grupos] = await Promise.all([
    listarClases(filtro),
    totalesDeClases(filtro),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: [{ firstName: "asc" }, { email: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Clases
      </h1>

      <details className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        <summary className="cursor-pointer text-lg font-bold text-tinta">
          Registrar una clase
        </summary>

        <form action={crearClase} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-tinta">
            Día y hora
            <input
              type="datetime-local"
              name="empiezaEl"
              required
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <label className="block text-sm font-semibold text-tinta">
            Duración (minutos)
            <input
              type="number"
              name="minutos"
              min={1}
              defaultValue={60}
              required
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <label className="block text-sm font-semibold text-tinta">
            Con quién
            <select
              name="destinatario"
              required
              defaultValue=""
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            >
              <option value="" disabled>
                Elige un estudiante o un grupo
              </option>
              {estudiantes.map((e) => (
                <option key={e.id} value={`alumno:${e.id}`}>
                  {nombreDe(e)}
                </option>
              ))}
              {grupos.map((g) => (
                <option key={g.id} value={`grupo:${g.id}`}>
                  Grupo · {g.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-tinta">
            Dónde (opcional)
            <input
              type="text"
              name="donde"
              placeholder="en su casa, aula 2..."
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <label className="block text-sm font-semibold text-tinta sm:col-span-2">
            Enlace de conexión (opcional)
            <input
              type="url"
              name="enlace"
              placeholder="https://meet.google.com/..."
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <button
            type="submit"
            className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500 sm:col-span-2 sm:justify-self-start"
          >
            Registrar
          </button>
        </form>
      </details>

      <form className="mt-8 grid gap-3 sm:grid-cols-5">
        <select
          name="quien"
          defaultValue={q.quien ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        >
          <option value="">Todo el mundo</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={`alumno:${e.id}`}>
              {nombreDe(e)}
            </option>
          ))}
          {grupos.map((g) => (
            <option key={g.id} value={`grupo:${g.id}`}>
              Grupo · {g.nombre}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="desde"
          defaultValue={q.desde ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={q.hasta ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />

        <select
          name="estado"
          defaultValue={q.estado ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        >
          <option value="">Cualquier estado</option>
          <option value="AGENDADA">Agendadas</option>
          <option value="DADA">Dadas</option>
          <option value="ANULADA">Anuladas</option>
        </select>

        <button
          type="submit"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
        >
          Filtrar
        </button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Total n={horas(totales.minutos)} etiqueta="Horas dadas" />
        <Total n={String(totales.cuantas)} etiqueta="Clases dadas" />
        <Total n={euros(totales.totalCentimos)} etiqueta="Total" />
        <Total n={euros(totales.pendienteCentimos)} etiqueta="Pendiente" />
      </div>

      {totales.sinTarifa > 0 && (
        <p className="mt-4 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          {totales.sinTarifa} clase{totales.sinTarifa !== 1 ? "s" : ""} dada
          {totales.sinTarifa !== 1 ? "s" : ""} sin importe. Le falta la tarifa
          por hora a quien la recibió.
        </p>
      )}

      {clases.length === 0 ? (
        <p className="mt-6 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          No hay clases con esos filtros.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {clases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/profe/clases/${c.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">
                    {c.estudiante
                      ? nombreDe(c.estudiante)
                      : `Grupo · ${c.grupo?.nombre ?? "sin grupo"}`}
                  </p>
                  <p className="truncate text-xs text-tinta-suave">
                    {fechaHora(c.empiezaEl)} · {horas(c.minutos)}
                    {c.donde && ` · ${c.donde}`}
                  </p>
                </div>

                {c._count.asignados > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-tinta-suave">
                    {c._count.asignados} deber
                    {c._count.asignados !== 1 ? "es" : ""}
                  </span>
                )}

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                    estadoStyle[c.estado] ?? "bg-fondo text-tinta ring-hp-100"
                  }`}
                >
                  {estadoLabel[c.estado] ?? c.estado}
                </span>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${
                    c.estado === "DADA" && c.importeCentimos === null
                      ? "bg-sol-200 text-tinta"
                      : "text-tinta-suave"
                  }`}
                >
                  {euros(c.importeCentimos)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Nota sobre el filtro `cobrada`:** el tipo lo acepta y la página lo lee de la dirección, pero no hay desplegable todavía. El selector se añade en la tanda 3, cuando la casilla de cobrada exista en la ficha; hasta entonces `?cobrada=no` funciona escribiéndolo a mano.

- [ ] **Step 2: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Comprobar que la ruta responde**

Run: `npm run dev`, esperar a `Ready`, y sin sesión:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/profe/clases
```

Expected: 307 (el `redirect("/dashboard")` de la comprobación de rol), y ningún error de compilación en el log.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/profe/clases/page.tsx"
git commit -m "Lista de clases con filtros y cuadro de horas"
```

---

### Task 8: La ficha de la clase

**Files:**
- Create: `app/(app)/profe/clases/[id]/page.tsx`

**Interfaces:**
- Consumes: `guardarFicha`, `editarClase`, `cambiarEstadoClase`, `cerrarDeberDeClase`, `abrirDeberDeClase`, `cerrarTodos` de `@/lib/acciones-clases`; `euros`, `horas` de `@/lib/clases`; `fechaHora`, `paraInput` de `@/lib/fechas`.
- Produces: la ruta `/profe/clases/[id]`.

- [ ] **Step 1: Crear la página**

Crear `app/(app)/profe/clases/[id]/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { euros, horas } from "@/lib/clases";
import { fechaHora, paraInput } from "@/lib/fechas";
import {
  abrirDeberDeClase,
  cambiarEstadoClase,
  cerrarDeberDeClase,
  cerrarTodos,
  editarClase,
  guardarFicha,
} from "@/lib/acciones-clases";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const estadoLabel: Record<string, string> = {
  AGENDADA: "Agendada",
  DADA: "Dada",
  ANULADA: "Anulada",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function ClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const clase = await prisma.clase.findUnique({
    where: { id },
    select: {
      id: true,
      profesorId: true,
      empiezaEl: true,
      minutos: true,
      estado: true,
      donde: true,
      enlace: true,
      notas: true,
      deberes: true,
      importeCentimos: true,
      estudiante: { select: { id: true, firstName: true, lastName: true, email: true } },
      grupo: { select: { id: true, nombre: true } },
      asignados: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cerradoEl: true,
          estudiante: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });
  if (!clase) notFound();

  // Un profesor solo ve las suyas. Un administrador, todas.
  if (clase.profesorId !== usuario.id && usuario.role !== "ADMIN") notFound();

  const [estudiantes, grupos] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: [{ firstName: "asc" }, { email: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const destinatarioActual = clase.estudiante
    ? `alumno:${clase.estudiante.id}`
    : clase.grupo
      ? `grupo:${clase.grupo.id}`
      : "";

  const sinCerrar = clase.asignados.filter((d) => !d.cerradoEl).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profe/clases"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Clases
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        {clase.estudiante
          ? nombreDe(clase.estudiante)
          : `Grupo · ${clase.grupo?.nombre ?? "sin grupo"}`}
      </h1>
      <p className="mt-1 text-tinta-suave">
        {fechaHora(clase.empiezaEl)} · {horas(clase.minutos)} ·{" "}
        {estadoLabel[clase.estado] ?? clase.estado}
        {clase.estado === "DADA" && ` · ${euros(clase.importeCentimos)}`}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["AGENDADA", "DADA", "ANULADA"] as const)
          .filter((e) => e !== clase.estado)
          .map((estado) => (
            <form action={cambiarEstadoClase} key={estado}>
              <input type="hidden" name="claseId" value={clase.id} />
              <input type="hidden" name="estado" value={estado} />
              <button
                type="submit"
                className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
              >
                {estado === "DADA"
                  ? "Marcar como dada"
                  : estado === "ANULADA"
                    ? "Anular"
                    : "Volver a agendar"}
              </button>
            </form>
          ))}
      </div>

      {clase.estado === "DADA" && clase.importeCentimos === null && (
        <p className="mt-4 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          Esta clase no tiene importe: a quien la recibió le falta la tarifa por
          hora. Ponla en su ficha y vuelve a marcar la clase como dada.
        </p>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Registro y deberes
      </h2>

      <form
        action={guardarFicha}
        className="mt-3 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
      >
        <input type="hidden" name="claseId" value={clase.id} />

        <label className="block text-sm font-semibold text-tinta">
          Registro académico (solo lo ves tú)
          <textarea
            name="notas"
            rows={5}
            defaultValue={clase.notas ?? ""}
            placeholder="Qué se trabajó, qué le cuesta, por dónde seguir..."
            className="mt-1 w-full rounded-xl border border-hp-200 bg-fondo px-4 py-3 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-tinta">
          Deberes (los ve el estudiante en su tablero)
          <textarea
            name="deberes"
            rows={3}
            defaultValue={clase.deberes ?? ""}
            placeholder="Ejercicios 3 y 4 de la página 12."
            className="mt-1 w-full rounded-xl border border-hp-200 bg-fondo px-4 py-3 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <button
          type="submit"
          className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Guardar
        </button>
      </form>

      {clase.asignados.length > 0 && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-tinta">
              Quién los tiene pendientes
            </h2>
            {sinCerrar > 0 && (
              <form action={cerrarTodos}>
                <input type="hidden" name="claseId" value={clase.id} />
                <button
                  type="submit"
                  className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
                >
                  Cerrar los {sinCerrar} que quedan
                </button>
              </form>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {clase.asignados.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">
                  {nombreDe(d.estudiante)}
                </span>

                {d.cerradoEl ? (
                  <>
                    <span className="shrink-0 text-xs font-semibold text-tinta-suave">
                      hecho
                    </span>
                    <form action={abrirDeberDeClase}>
                      <input type="hidden" name="claseId" value={clase.id} />
                      <input type="hidden" name="deberId" value={d.id} />
                      <button
                        type="submit"
                        className="h-8 rounded-full border border-hp-200 px-3 text-[11px] font-bold text-tinta-suave transition-colors hover:border-hp-400"
                      >
                        Reabrir
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={cerrarDeberDeClase}>
                    <input type="hidden" name="claseId" value={clase.id} />
                    <input type="hidden" name="deberId" value={d.id} />
                    <button
                      type="submit"
                      className="h-8 rounded-full bg-hp-400 px-4 text-[11px] font-bold text-white transition-colors hover:bg-hp-500"
                    >
                      Dar por hecho
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Cambiar los datos</h2>

      <form
        action={editarClase}
        className="mt-3 grid gap-4 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave sm:grid-cols-2"
      >
        <input type="hidden" name="claseId" value={clase.id} />

        <label className="block text-sm font-semibold text-tinta">
          Día y hora
          <input
            type="datetime-local"
            name="empiezaEl"
            required
            defaultValue={paraInput(clase.empiezaEl)}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="block text-sm font-semibold text-tinta">
          Duración (minutos)
          <input
            type="number"
            name="minutos"
            min={1}
            required
            defaultValue={clase.minutos}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="block text-sm font-semibold text-tinta">
          Con quién
          <select
            name="destinatario"
            required
            defaultValue={destinatarioActual}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          >
            {estudiantes.map((e) => (
              <option key={e.id} value={`alumno:${e.id}`}>
                {nombreDe(e)}
              </option>
            ))}
            {grupos.map((g) => (
              <option key={g.id} value={`grupo:${g.id}`}>
                Grupo · {g.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-tinta">
          Dónde
          <input
            type="text"
            name="donde"
            defaultValue={clase.donde ?? ""}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="block text-sm font-semibold text-tinta sm:col-span-2">
          Enlace de conexión
          <input
            type="url"
            name="enlace"
            defaultValue={clase.enlace ?? ""}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <button
          type="submit"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400 sm:col-span-2 sm:justify-self-start"
        >
          Guardar los cambios
        </button>
      </form>

      <p className="mt-6 text-xs text-tinta-suave">
        Cambiar con quién es la clase rehace sus deberes: se crean los de quien
        entra y se borran los de quien sale. Los que ya diste por hechos de
        quien sigue se quedan hechos.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Comprobar que la ruta compila**

Run: `npm run dev`, esperar a `Ready`, y sin sesión:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/profe/clases/inventado
```

Expected: 307 (redirect por rol antes de mirar si la clase existe), y ningún error de compilación en el log.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/profe/clases/[id]"
git commit -m "Ficha de la clase: registro, deberes y estado"
```

---

### Task 9: El tablero del estudiante, la barra y el perfil

**Files:**
- Modify: `app/(app)/dashboard/panel-estudiante.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/profe/alumnos/[id]/page.tsx`

**Interfaces:**
- Consumes: `proximaClase`, `deberesPendientes`, `horas`, `totalesDeClases` de `@/lib/clases`; `fechaHora`, `fechaCorta` de `@/lib/fechas`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Los dos bloques nuevos en el tablero del estudiante**

En `app/(app)/dashboard/panel-estudiante.tsx`, añadir a la cabecera:

```tsx
import { deberesPendientes, proximaClase } from "@/lib/clases";
import { fechaCorta, fechaHora } from "@/lib/fechas";
```

Ampliar el `Promise.all` que ya existe (el que trae `resumen` y `asignaciones`) con dos promesas más:

```tsx
  const [resumen, asignaciones, proxima, deberes] = await Promise.all([
    resumenEstudiante(usuario.id),
    prisma.asignacion.findMany({
      where: { estudianteId: usuario.id, archivada: false },
      orderBy: { createdAt: "desc" },
      include: {
        recorrido: {
          select: {
            id: true,
            titulo: true,
            tipo: true,
            _count: { select: { pasos: true } },
          },
        },
        _count: { select: { completados: true } },
      },
    }),
    proximaClase(usuario.id),
    deberesPendientes(usuario.id),
  ]);
```

Y justo después del `<h1>` del saludo, antes del bloque `{mostrarHucha && (`:

```tsx
      {proxima && (
        <section className="mt-8 rounded-tarjeta border border-hp-200 bg-hp-50 p-6 shadow-suave">
          <h2 className="text-xs font-bold uppercase tracking-wider text-hp-700">
            Tu próxima clase
          </h2>
          <p className="mt-2 text-lg font-bold text-tinta">
            {fechaHora(proxima.empiezaEl)}, con {proxima.profesor}
          </p>
          {proxima.donde && (
            <p className="mt-1 text-sm text-tinta-suave">{proxima.donde}</p>
          )}
          {proxima.enlace && (
            <a
              href={proxima.enlace}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block h-10 rounded-full bg-hp-400 px-5 text-sm font-bold leading-10 text-white transition-colors hover:bg-hp-500"
            >
              Entrar a la clase
            </a>
          )}
        </section>
      )}

      {deberes.length > 0 && (
        <section className="mt-4 rounded-tarjeta border border-sol-300 bg-sol-100 p-5 shadow-suave">
          <h2 className="text-xs font-bold uppercase tracking-wider text-tinta">
            Deberes de tu profe
          </h2>
          <ul className="mt-3 space-y-3">
            {deberes.map((d) => (
              <li key={d.id}>
                <p className="whitespace-pre-line text-sm text-tinta">
                  {d.texto}
                </p>
                <p className="mt-1 text-xs text-tinta-suave">
                  de la clase del {fechaCorta(d.claseEl)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-tinta-suave">
            Los quita tu profe cuando los da por hechos.
          </p>
        </section>
      )}
```

**Por qué el bloque no se dibuja cuando no hay nada:** es la misma decisión que ya se tomó con `mostrarHucha`. Nadie necesita un hueco que dice «nada».

- [ ] **Step 2: El enlace en la barra de navegación**

En `app/(app)/layout.tsx`, dentro del `<nav>`, entre el bloque de «Estudiantes» y el de «Administración»:

```tsx
            {esProfe && (
              <Link
                href="/profe/clases"
                className="hover:text-hp-500 transition-colors"
              >
                Clases
              </Link>
            )}
```

- [ ] **Step 3: Las horas en el perfil del estudiante**

En `app/(app)/profe/alumnos/[id]/page.tsx`, añadir a la cabecera:

```tsx
import { horas, totalesDeClases } from "@/lib/clases";
```

Ampliar el `Promise.all` que trae `asignaciones` y `secuencias` con una tercera promesa:

```tsx
  const [asignaciones, secuencias, totalesClases] = await Promise.all([
```

añadiendo al final del array:

```tsx
    totalesDeClases({ profesorId: usuario.id, estudianteId: id }),
```

Y después del `<p className="mt-1 text-tinta-suave">{estudiante.email}</p>`:

```tsx
      {totalesClases.cuantas > 0 && (
        <p className="mt-3 text-sm text-tinta-suave">
          {horas(totalesClases.minutos)} contigo en {totalesClases.cuantas}{" "}
          clase{totalesClases.cuantas !== 1 ? "s" : ""} ·{" "}
          <Link
            href={`/profe/clases?quien=alumno:${estudiante.id}`}
            className="font-semibold text-hp-600 hover:text-hp-500"
          >
            ver sus clases
          </Link>
        </p>
      )}
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Pasar todas las verificaciones**

Run: `npx tsx scripts/verificar-clases.ts && npx tsx scripts/verificar-admin.ts && npx tsx scripts/verificar-ejercicios.ts && npx tsx scripts/verificar-puntos.ts`
Expected: los cuatro pasan.

- [ ] **Step 6: Comprobación a mano**

Run: `npm run dev`

Con la cuenta de profesor (`a.lopez.ele@hotmail.com`):

1. En la barra de arriba aparece **Clases**.
2. En `/profe/clases`, registra una clase con un estudiante para **mañana**, 60 minutos, con un enlace cualquiera. Aparece en la lista como **Agendada** y sin importe.
3. Entra en su ficha, escribe unas notas y unos deberes, guarda. Debajo aparece ese estudiante en «Quién los tiene pendientes».
4. Marca la clase como **dada**. Como el estudiante no tiene tarifa, sale el aviso amarillo. Eso es lo correcto en esta tanda.
5. En `/profe/clases`, filtra por ese estudiante: los cuatro números cuadran con esa única clase.
6. Vuelve a la ficha y **anula** la clase. Las notas y los deberes siguen ahí.
7. Entra con la cuenta de estudiante (`ndo.lopez.ele@gmail.com`), que debe tener una clase agendada suya:
   - arriba del tablero sale **Tu próxima clase** con la fecha y el botón de entrar;
   - debajo, **Deberes de tu profe** con el texto, y **sin** botón para quitarlos;
   - si el profesor anula esa clase, los deberes desaparecen de su tablero.
8. Vuelve a la ficha como profesor y pulsa **Dar por hecho**. El deber desaparece del tablero del estudiante.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/dashboard/panel-estudiante.tsx" "app/(app)/layout.tsx" "app/(app)/profe/alumnos/[id]/page.tsx"
git commit -m "Próxima clase y deberes en el tablero del estudiante"
```

---

## Lo que esta tanda deja pendiente a propósito

- **Google Calendar y el Meet automático** (tanda 2). El campo `enlace` se rellena a mano por ahora, y `googleEventoId` existe pero nadie lo escribe.
- **Las tarifas y la casilla de cobrada** (tanda 3). `tarifaCentimos`, `importeCentimos` y `cobradaEl` existen en el esquema y los cálculos ya los usan, pero no hay ninguna pantalla donde escribir una tarifa ni marcar una clase como cobrada. Hasta entonces toda clase dada sale con el aviso amarillo de «sin importe», que es honesto: no hay tarifa que aplicar.
- **Borrar una clase.** Se puede anular, que es lo que hace falta. Borrar de verdad se añade si estorba.
