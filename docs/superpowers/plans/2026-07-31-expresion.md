# La expresión — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor pueda montar las dos pruebas de expresión del DELE, que el alumno entregue lo escrito dentro de la aplicación, y que la rúbrica rellenada valga como los puntos de cualquier otro paso.

**Architecture:** Una tarea de expresión es un ejercicio más de Recursos, con su tipo nuevo en la base, pero **el motor de corrección no se toca**: la expresión tiene su propio validador al lado y la página del paso pregunta a los dos. La entrega y la valoración cuelgan de `PasoCompletado`, que ya es la fila «qué ha hecho este alumno en este paso». La cita del oral va en tabla propia, porque escribirla en `PasoCompletado` daría el paso por hecho al ponerlo en la agenda.

**Tech Stack:** Next.js 16 (App Router, React Server Components), React 19 (`useActionState`), Prisma 7 con adaptador `@prisma/adapter-pg`, zod 4, Clerk para sesión, Tailwind CSS 4, `tsx` para scripts.

**Diseño de referencia:** `docs/superpowers/specs/2026-07-31-expresion-design.md`

## Global Constraints

- **Lee la documentación de Next antes de escribir código.** `AGENTS.md` del repo: esta versión de Next tiene cambios de API respecto a lo que puedas recordar. Los guides están en `node_modules/next/dist/docs/`.
- Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos vienen de `@/lib/generated/prisma/client` y los enums de `@/lib/generated/prisma/enums`.
- Interfaz **en español con tildes**. Comentarios en español, cortos, explicando el porqué y no el qué.
- Tokens de Tailwind del proyecto: `hp-50…hp-700`, `sol-100…sol-400`, `bloque1-3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`. `bg-white` y `text-white` son convención establecida. Nada de otros colores crudos.
- **Una sola migración en todo el plan** (Tarea 1). Ninguna otra tarea toca `prisma/schema.prisma`.
- **El motor de `lib/ejercicios/` no se toca.** Sus cuatro tipos siguen siendo cuatro y `corregir()` sigue siendo exhaustivo. La expresión es hermana, no miembro.
- **Los componentes con `"use client"` no pueden importar** `lib/recursos.ts`, `lib/escuchas.ts`, `lib/expresion.ts` ni `lib/ejercicios/registro.ts`: arrastran `prisma` o `node:crypto`. Los tipos compartidos salen de módulos sin dependencias.
- **Esconder algo en pantalla no es esconderlo.** El texto modelo no puede viajar al navegador del alumno antes de que la tarea esté corregida: si viaja, se lee en el código de la página.
- **Ojo con el `next dev` que esté corriendo:** tras la migración de la Tarea 1 hay que reiniciarlo (`npm run fresh`).
- No hay framework de pruebas. La verificación es `npx tsc --noEmit`, `npm run lint` y scripts `tsx`. **`npm run lint` tiene que quedar sin ningún aviso.**

### Ocho lecciones de los dos planes anteriores

Las revisiones de Recursos y del Creador DELE encontraron 38 y 40 defectos, y **casi todos venían del plan**. Estas son las que van a volver a aparecer aquí. **Todas son vinculantes.**

1. **Un id nunca se genera contando elementos.** `c${lista.length + 1}` produce ids repetidos al quitar uno de en medio, y los ids de los criterios son la clave con la que se guardan las notas. Se usa **el máximo de los sufijos existentes más uno**, como `siguienteIdPregunta` en `components/recursos/editor-opcion.tsx`. **Nada de `Date.now()` ni `Math.random()`.**
2. **La limpieza de un script va en el `.finally()`**, con cada borrado en su propio `try/catch` para que un fallo no impida los demás, los ids en variables de módulo, y `process.exitCode = 1` en vez de `process.exit(1)`. Precedente: `scripts/verificar-dele.ts`.
3. **Ninguna consulta que decida vive dentro de una acción de servidor.** Validar la forma de lo que llega del formulario sí; consultar el estado de la base para decidir, no. Precedente: `lib/recursos.ts`, `lib/escuchas.ts`.
4. **Todo `.min()`, `.max()`, `.int()` o `.refine()` lleva su mensaje en castellano.** Se le enseñan al profesor tal cual.
5. **Los errores y las confirmaciones se pintan en un solo sitio por pantalla.** Cuatro bloques copiados son cuatro sitios donde falta uno. Y un error viejo de una acción no debe tapar la confirmación nueva de otra.
6. **`z.array(...).min(n)` no dice nada del contenido de sus elementos.** Una lista de dos cadenas vacías pasa `.min(2)`. Si el elemento tiene que decir algo, el mínimo va también dentro.
7. **No se crean filas de `PasoCompletado` para cosas que no son «hecho».** Esa fila significa que el alumno completó el paso: `hecho = Boolean(registro)`. Escribir ahí una cita, un contador o cualquier otra cosa da el paso por hecho. Ya pasó con las escuchas.
8. **Un tope que decide nunca llega del cliente.** Una acción `"use server"` exportada es un endpoint público: lo que limita se lee en el servidor.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `prisma/schema.prisma` | **Modificar.** `EXPRESION`, dos columnas en `PasoCompletado`, modelo `CitaOral`. | 1 |
| `prisma/migrations/<ts>_expresion/migration.sql` | **Crear** (lo genera Prisma). | 1 |
| `lib/expresion.ts` | **Crear.** El esquema, la versión pública y las reglas de la entrega. **Fuera de las acciones.** | 1 |
| `scripts/verificar-expresion.ts` | **Crear.** Ejercita las reglas contra filas reales. | 1 |
| `lib/citas.ts` | **Crear.** Las reglas de la cita del oral. **Fuera de las acciones.** | 2 |
| `lib/recursos.ts` | **Modificar.** `tipoDeEjercicio` reconoce la expresión. | 1 |
| `lib/acciones-expresion.ts` | **Crear.** Entregar, valorar, citar y descitar. | 3 |
| `components/recursos/editor-expresion.tsx` | **Crear.** El editor de la tarea. | 4 |
| `components/recursos/editor.tsx` | **Modificar.** Registrar el tipo nuevo. | 4 |
| `components/expresion/entrega.tsx` | **Crear.** El recuadro del alumno con su contador. | 5 |
| `components/expresion/rubrica.tsx` | **Crear.** Los criterios y el comentario. Compartida. | 6 |
| `app/(app)/pasos/[pasoId]/page.tsx` | **Modificar.** La rama de expresión. | 5 |
| `app/(app)/profe/entregas/page.tsx` | **Crear.** Lo que espera corrección. | 6 |
| `app/(app)/profe/entregas/[id]/page.tsx` | **Crear.** Leer y corregir. | 6 |
| `app/(app)/profe/alumnos/[id]/page.tsx` | **Modificar.** Citar y corregir desde la ficha. | 7 |
| `app/(app)/profe/clases/[id]/page.tsx` | **Modificar.** Qué orales hay citados en esta clase. | 7 |

---

### Task 1: La migración, el esquema y las reglas de la entrega

La base, el validador hermano del motor y las reglas que gobiernan la entrega. El script se escribe primero.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_expresion/migration.sql`
- Create: `lib/expresion.ts`
- Create: `scripts/verificar-expresion.ts`
- Modify: `lib/recursos.ts`

**Interfaces:**
- Produces, desde `@/lib/expresion`:
  - `type Criterio = { id: string; nombre: string; maximo: number }`
  - `type Expresion` (inferido de `expresionSchema`)
  - `type ExpresionPublica` — lo mismo **sin `modelo`** salvo que esté corregida
  - `const expresionSchema` (zod)
  - `function analizarExpresion(datos: unknown): Expresion | null`
  - `function versionPublicaExpresion(datos: Expresion, corregida: boolean): ExpresionPublica`
  - `function puedeValorarse(datos: Expresion, notas: Record<string, number>): string | null`
  - `function puntosDe(datos: Expresion, notas: Record<string, number>): number`
  - `async function puedeEntregar(asignacionId: string, pasoId: string): Promise<string | null>`

- [ ] **Step 1: Añadir los tres cambios al esquema**

En `prisma/schema.prisma`, añade `EXPRESION` al enum:

```prisma
enum TipoEjercicio {
  WIDGET
  OPCION_MULTIPLE
  HUECOS
  RELACIONAR
  ORDENAR
  EXPRESION
}
```

Dentro del modelo `PasoCompletado`, junto a `respuestas`:

```prisma
  /// Lo que escribió el alumno en una tarea de expresión escrita. Null en
  /// todo lo demás, y en las orales, que no tienen entrega.
  entrega    String?

  /// La rúbrica rellenada: `{ notas: { [criterioId]: number }, comentario }`.
  /// La suma de las notas es lo que acaba en `puntos`.
  valoracion Json?
```

Y un modelo nuevo, al lado de `PasoCompletado`:

```prisma
/// En qué clase se examina un oral concreto de un alumno.
///
/// Tabla propia y no una columna en PasoCompletado: esa fila significa "el
/// paso está hecho" y se crea cuando el alumno lo marca, así que citar ahí
/// daría el paso por hecho por el mero hecho de ponerlo en la agenda. Es la
/// misma trampa del contador de escuchas.
model CitaOral {
  id           String     @id @default(cuid())
  asignacion   Asignacion @relation(fields: [asignacionId], references: [id], onDelete: Cascade)
  asignacionId String
  pasoId       String
  clase        Clase      @relation(fields: [claseId], references: [id], onDelete: Cascade)
  claseId      String
  createdAt    DateTime   @default(now())

  @@unique([asignacionId, pasoId])
  @@index([claseId])
}
```

Y las dos relaciones inversas: en `Asignacion`, junto a `completados`, `citas CitaOral[]`; en `Clase`, junto a `asignados`, `citasOrales CitaOral[]`.

- [ ] **Step 2: Generar y aplicar la migración**

Run: `npx prisma migrate dev --name expresion`

Expected: crea la carpeta y la aplica. **Si propone un reset de la base, para y repórtalo**: solo se añade un valor de enum, dos columnas nullable y una tabla nueva. La base es compartida con otro worktree y un reset borraría datos reales.

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

- [ ] **Step 3: Reiniciar el `next dev`**

Run: `npm run fresh` — en segundo plano; mátalo después. `lib/prisma.ts` fija el cliente en `globalThis` y el proceso viejo se queda con el esquema antiguo.

- [ ] **Step 4: Escribir el script de verificación (falla)**

Crea `scripts/verificar-expresion.ts`:

```ts
/**
 * Verifica el esquema de la expresión, la versión pública y las reglas de la
 * entrega. Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-expresion.ts
 */
import "dotenv/config";
import {
  analizarExpresion,
  expresionSchema,
  puedeEntregar,
  puedeValorarse,
  puntosDe,
  versionPublicaExpresion,
} from "@/lib/expresion";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-expresion-${process.pid}`;

let recorridoId: string | null = null;
let pasoId: string | null = null;
let asignacionId: string | null = null;
const usuarioIds: string[] = [];

const ESCRITA = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "Escribe un correo a un amigo contándole tus vacaciones.",
  estimulo: { texto: "Has vuelto de un viaje." },
  palabras: { minimo: 100, maximo: 120 },
  criterios: [
    { id: "c1", nombre: "Adecuación y cumplimiento", maximo: 3 },
    { id: "c2", nombre: "Coherencia", maximo: 3 },
  ],
  modelo: "Querida Ana:\nAcabo de volver…",
};

const ORAL = {
  ejercicio: "expresion",
  modalidad: "oral",
  consigna: "Describe la foto y contesta a las preguntas.",
  estimulo: { imagen: "/api/archivos/loquesea" },
  minutos: 3,
  criterios: [{ id: "c1", nombre: "Fluidez", maximo: 3 }],
};

async function main() {
  // ─── El esquema ─────────────────────────────────────────────────────
  afirmar(expresionSchema.safeParse(ESCRITA).success, "una escrita completa es válida");
  afirmar(expresionSchema.safeParse(ORAL).success, "una oral completa es válida");

  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, palabras: undefined }).success,
    "una escrita sin número de palabras se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ORAL, minutos: undefined }).success,
    "una oral sin minutos se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, minutos: 3 }).success,
    "una escrita con minutos se rechaza: eso es de las orales",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ORAL, palabras: { minimo: 1, maximo: 2 } }).success,
    "una oral con número de palabras se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, palabras: { minimo: 200, maximo: 100 } }).success,
    "un mínimo de palabras mayor que el máximo se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, criterios: [] }).success,
    "una tarea sin criterios se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({
      ...ESCRITA,
      criterios: [
        { id: "c1", nombre: "", maximo: 3 },
        { id: "c2", nombre: "Coherencia", maximo: 3 },
      ],
    }).success,
    "un criterio sin nombre se rechaza: la lista no basta con tener dos elementos",
  );
  afirmar(
    !expresionSchema.safeParse({
      ...ESCRITA,
      criterios: [
        { id: "c1", nombre: "Uno", maximo: 3 },
        { id: "c1", nombre: "Dos", maximo: 3 },
      ],
    }).success,
    "dos criterios con el mismo id se rechazan: sus notas se pisarían",
  );

  afirmar(analizarExpresion(ESCRITA) !== null, "analizarExpresion reconoce una escrita");
  afirmar(analizarExpresion({ ejercicio: "opcion" }) === null, "no reconoce un ejercicio del motor");
  afirmar(analizarExpresion(null) === null, "no reconoce null");

  // ─── La versión pública: el modelo no viaja antes de tiempo ─────────
  const datos = analizarExpresion(ESCRITA)!;
  const sinCorregir = versionPublicaExpresion(datos, false);
  const corregida = versionPublicaExpresion(datos, true);

  afirmar(
    !("modelo" in sinCorregir) || sinCorregir.modelo === undefined,
    "sin corregir, el modelo NO viaja: si viajara, se lee en el código de la página",
  );
  afirmar(corregida.modelo === ESCRITA.modelo, "corregida, el modelo sí viaja");
  afirmar(sinCorregir.consigna === ESCRITA.consigna, "la consigna viaja siempre");
  afirmar(sinCorregir.criterios.length === 2, "los criterios viajan siempre: el alumno ve con qué se le puntúa");

  // ─── La rúbrica ─────────────────────────────────────────────────────
  afirmar(puedeValorarse(datos, { c1: 3, c2: 2 }) === null, "una rúbrica completa se puede guardar");
  afirmar(puedeValorarse(datos, { c1: 3 }) !== null, "falta un criterio: no se guarda");
  afirmar(puedeValorarse(datos, { c1: 3, c2: 9 }) !== null, "una nota por encima del máximo se rechaza");
  afirmar(puedeValorarse(datos, { c1: 3, c2: -1 }) !== null, "una nota negativa se rechaza");
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 2, c9: 1 }) !== null,
    "una nota de un criterio que no existe se rechaza",
  );
  afirmar(puntosDe(datos, { c1: 3, c2: 2 }) === 5, "los puntos son la suma de las notas");

  // ─── La entrega, contra filas reales ────────────────────────────────
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(estudiante.id);
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  usuarioIds.push(profesor.id);

  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Recorrido ${marca}`, nivel: "B1", orden: 1 },
  });
  recorridoId = recorrido.id;
  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Tarea 1", tipo: "MACRO_TAREA", ciclo: 1, orden: 1 },
  });
  pasoId = paso.id;
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;

  afirmar(
    (await puedeEntregar(asignacion.id, paso.id)) === null,
    "sin nada entregado todavía, se puede entregar",
  );

  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, entrega: "Un primer intento." },
  });
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id)) === null,
    "entregado pero sin corregir, todavía se puede reescribir",
  );

  await prisma.pasoCompletado.updateMany({
    where: { asignacionId: asignacion.id, pasoId: paso.id },
    data: { puntos: 5, verificadoEl: new Date() },
  });
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id)) !== null,
    "una vez corregida, ya no se puede reescribir",
  );

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` mataría el proceso antes del `finally` y la limpieza no
    // correría: en TDD el paso que falla lo hace a propósito, así que eso
    // dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    async function intentar(que: string, fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (e) {
        fallos++;
        console.error(`FALLO AL LIMPIAR (${que}): ${e instanceof Error ? e.message : e}`);
      }
    }
    // El orden importa: los vínculos antes que sus extremos.
    if (asignacionId) {
      const id = asignacionId;
      await intentar("citas", () => prisma.citaOral.deleteMany({ where: { asignacionId: id } }));
      await intentar("pasos completados", () => prisma.pasoCompletado.deleteMany({ where: { asignacionId: id } }));
      await intentar("asignación", () => prisma.asignacion.delete({ where: { id } }));
    }
    if (pasoId) {
      const id = pasoId;
      await intentar("paso", () => prisma.paso.delete({ where: { id } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    if (usuarioIds.length) {
      await intentar("usuarios", () => prisma.user.deleteMany({ where: { id: { in: usuarioIds } } }));
    }
    await intentar("desconectar", () => prisma.$disconnect());
    if (fallos > 0) {
      console.error(`\n${fallos} paso(s) de limpieza fallaron: puede quedar basura en la base.`);
      process.exitCode = 1;
    }
  });
```

- [ ] **Step 5: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-expresion.ts`
Expected: FALLA al importar, con «Cannot find module '@/lib/expresion'». Es el fallo correcto.

- [ ] **Step 6: Escribir `lib/expresion.ts`**

```ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Hermano del motor de `lib/ejercicios/`, no miembro. Ese motor tiene cuatro
// tipos y los cuatro se corrigen solos; `corregir()` es un switch exhaustivo
// escrito para que un quinto caso sin implementar no compile en silencio.
// Una tarea de expresión no se corrige sola, así que vive aquí al lado y la
// página del paso pregunta a los dos.

export const criterioSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1, { message: "Cada criterio necesita un nombre." }),
  maximo: z
    .number()
    .int({ message: "El máximo de un criterio tiene que ser un número entero." })
    .min(1, { message: "Un criterio tiene que valer al menos un punto." }),
});

export type Criterio = z.infer<typeof criterioSchema>;

export const expresionSchema = z
  .object({
    ejercicio: z.literal("expresion"),
    modalidad: z.enum(["escrita", "oral"]),
    consigna: z.string().min(1, { message: "Escribe la consigna: es lo que el alumno tiene que hacer." }),
    /** Lo que el alumno tiene delante. Los tres opcionales. */
    estimulo: z
      .object({
        texto: z.string().optional(),
        imagen: z.string().optional(),
        audio: z.string().optional(),
      })
      .default({}),
    /** Solo en las escritas. */
    palabras: z
      .object({
        minimo: z.number().int().min(1, { message: "El mínimo de palabras tiene que ser al menos uno." }),
        maximo: z.number().int().min(1, { message: "El máximo de palabras tiene que ser al menos uno." }),
      })
      .optional(),
    /** Solo en las orales. */
    minutos: z
      .number()
      .int({ message: "Los minutos tienen que ser un número entero." })
      .min(1, { message: "Una tarea oral dura al menos un minuto." })
      .optional(),
    criterios: z.array(criterioSchema).min(1, { message: "La tarea necesita al menos un criterio." }),
    /** Se le enseña al alumno solo después de corregir. */
    modelo: z.string().optional(),
  })
  .refine((d) => d.modalidad !== "escrita" || d.palabras !== undefined, {
    message: "Una tarea escrita necesita decir cuántas palabras se piden.",
  })
  .refine((d) => d.modalidad !== "oral" || d.minutos !== undefined, {
    message: "Una tarea oral necesita decir cuántos minutos dura.",
  })
  .refine((d) => d.modalidad !== "escrita" || d.minutos === undefined, {
    message: "Una tarea escrita no lleva minutos: eso es de las orales.",
  })
  .refine((d) => d.modalidad !== "oral" || d.palabras === undefined, {
    message: "Una tarea oral no lleva número de palabras: eso es de las escritas.",
  })
  .refine((d) => !d.palabras || d.palabras.minimo <= d.palabras.maximo, {
    message: "El mínimo de palabras no puede ser mayor que el máximo.",
  })
  .refine((d) => new Set(d.criterios.map((c) => c.id)).size === d.criterios.length, {
    message: "Dos criterios no pueden compartir el mismo id: sus notas se pisarían.",
  });

export type Expresion = z.infer<typeof expresionSchema>;

export function analizarExpresion(datos: unknown): Expresion | null {
  if (typeof datos !== "object" || datos === null) return null;
  if ((datos as { ejercicio?: unknown }).ejercicio !== "expresion") return null;
  const r = expresionSchema.safeParse(datos);
  return r.success ? r.data : null;
}

export type ExpresionPublica = Omit<Expresion, "modelo"> & { modelo?: string };

/**
 * Lo que puede ver el alumno.
 *
 * El modelo solo viaja cuando la tarea ya está corregida. No basta con
 * esconderlo en pantalla: si sale del servidor, se lee en el código de la
 * página y el alumno copia. Es la misma regla que protege las soluciones de
 * los ejercicios autocorregibles.
 *
 * Los criterios sí viajan siempre: el alumno tiene derecho a saber con qué
 * se le va a puntuar antes de escribir.
 */
export function versionPublicaExpresion(datos: Expresion, corregida: boolean): ExpresionPublica {
  const { modelo, ...resto } = datos;
  return corregida ? { ...resto, modelo } : resto;
}

/**
 * Si esta rúbrica se puede guardar, o el motivo del no.
 *
 * Exige que **todos** los criterios tengan nota: media rúbrica guardada
 * sería una tarea que parece corregida y no lo está, y el alumno vería una
 * nota que no es la suya.
 */
export function puedeValorarse(
  datos: Expresion,
  notas: Record<string, number>,
): string | null {
  const ids = new Set(datos.criterios.map((c) => c.id));

  for (const clave of Object.keys(notas)) {
    if (!ids.has(clave)) return "Hay una nota de un criterio que esta tarea no tiene.";
  }

  for (const criterio of datos.criterios) {
    const nota = notas[criterio.id];
    if (nota === undefined) return `Falta la nota de «${criterio.nombre}».`;
    if (!Number.isInteger(nota)) return `La nota de «${criterio.nombre}» tiene que ser un número entero.`;
    if (nota < 0) return `La nota de «${criterio.nombre}» no puede ser negativa.`;
    if (nota > criterio.maximo) {
      return `«${criterio.nombre}» vale como mucho ${criterio.maximo}.`;
    }
  }
  return null;
}

/** Los puntos del paso: la suma de las notas. Llamar solo tras `puedeValorarse`. */
export function puntosDe(datos: Expresion, notas: Record<string, number>): number {
  return datos.criterios.reduce((suma, c) => suma + (notas[c.id] ?? 0), 0);
}

/**
 * Si el alumno todavía puede entregar o reescribir, o el motivo del no.
 *
 * Puede reescribir hasta que el profesor corrige, y no después: es el
 * equilibrio entre dejarle mejorar y que la corrección no quede colgando de
 * un texto que ya no existe.
 */
export async function puedeEntregar(
  asignacionId: string,
  pasoId: string,
): Promise<string | null> {
  const registro = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { verificadoEl: true },
  });
  if (registro?.verificadoEl) {
    return "Esta tarea ya está corregida: no se puede cambiar lo entregado.";
  }
  return null;
}
```

- [ ] **Step 7: Ejecutar el script hasta que pase**

Run: `npx tsx scripts/verificar-expresion.ts`
Expected: una línea `OK:` por afirmación y `Todo bien.` al final.

- [ ] **Step 8: Que `tipoDeEjercicio` reconozca la expresión**

En `lib/recursos.ts`, sustituye la función:

```ts
import { analizarExpresion } from "@/lib/expresion";
```

```ts
/**
 * El `TipoEjercicio` que le toca a un `datos`, o null si no es válido.
 *
 * Pregunta a los dos: primero al motor —sus cuatro tipos— y luego a la
 * expresión, que es hermana y no miembro. Sigue habiendo un solo sitio donde
 * la columna y el discriminante pueden discrepar.
 */
export function tipoDeEjercicio(datos: unknown): TipoEjercicio | null {
  const analizado = analizar(datos);
  if (analizado) return TIPO_DE_EJERCICIO[analizado.tipo];
  return analizarExpresion(datos) ? "EXPRESION" : null;
}
```

Y añade su afirmación al final del bloque del esquema en `scripts/verificar-expresion.ts`:

```ts
  const { tipoDeEjercicio } = await import("@/lib/recursos");
  afirmar(tipoDeEjercicio(ESCRITA) === "EXPRESION", "una escrita se guarda como EXPRESION");
  afirmar(tipoDeEjercicio(ORAL) === "EXPRESION", "una oral también");
```

- [ ] **Step 9: Comprobar que la limpieza funciona también al fallar**

Rompe una afirmación a propósito (cambia un `=== null` por `!== null` en una sola línea) y ejecuta. Comprueba con una consulta que no quedan filas con `ejemplo.test`. Deshaz el cambio y vuelve a ejecutar.

- [ ] **Step 10: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-expresion.ts && npx tsx scripts/verificar-recursos.ts`
Expected: todo limpio y en verde.

```bash
git add prisma/schema.prisma prisma/migrations lib/expresion.ts lib/recursos.ts scripts/verificar-expresion.ts
git commit -m "El esquema de la expresión, hermano del motor y no miembro"
```

---

### Task 2: Las reglas de la cita

**Files:**
- Create: `lib/citas.ts`
- Modify: `scripts/verificar-expresion.ts`

**Interfaces:**
- Produces, desde `@/lib/citas`:
  - `async function puedeCitarse(asignacionId: string, claseId: string): Promise<string | null>`
  - `async function clasesParaCitar(asignacionId: string): Promise<{ id: string; empiezaEl: Date; minutos: number; donde: string | null }[]>`

- [ ] **Step 1: Añadir las afirmaciones (fallan)**

En `scripts/verificar-expresion.ts`, tras el bloque de la entrega, añade el import y el bloque:

```ts
import { clasesParaCitar, puedeCitarse } from "@/lib/citas";
```

```ts
  // ─── La cita del oral ───────────────────────────────────────────────
  const otro = await prisma.user.create({
    data: { email: `otro-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(otro.id);

  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const suya = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: estudiante.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(suya.id);
  const ajena = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: otro.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(ajena.id);
  const anulada = await prisma.clase.create({
    data: {
      profesorId: profesor.id,
      estudianteId: estudiante.id,
      empiezaEl: manana,
      minutos: 60,
      estado: "ANULADA",
    },
  });
  claseIds.push(anulada.id);

  afirmar((await puedeCitarse(asignacion.id, suya.id)) === null, "se puede citar en una clase suya");
  afirmar(
    (await puedeCitarse(asignacion.id, ajena.id)) !== null,
    "no se puede citar en la clase de otro alumno",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, anulada.id)) !== null,
    "no se puede citar en una clase anulada",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, "noexiste")) !== null,
    "no se puede citar en una clase que no existe",
  );

  const ofrecidas = await clasesParaCitar(asignacion.id);
  afirmar(
    ofrecidas.some((c) => c.id === suya.id),
    "la clase suya sale entre las que se ofrecen",
  );
  afirmar(
    !ofrecidas.some((c) => c.id === ajena.id || c.id === anulada.id),
    "ni la ajena ni la anulada salen entre las que se ofrecen",
  );
```

Añade `const claseIds: string[] = [];` a las variables de módulo, y a la limpieza —**antes de los usuarios**, porque `Clase.profesorId` es `RESTRICT`—:

```ts
    if (claseIds.length) {
      await intentar("clases", () => prisma.clase.deleteMany({ where: { id: { in: claseIds } } }));
    }
```

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-expresion.ts`
Expected: FALLA al importar `@/lib/citas`.

- [ ] **Step 3: Escribir `lib/citas.ts`**

```ts
import { prisma } from "@/lib/prisma";

// Solo de servidor. Fuera de las acciones, para que el script las ejercite.

/**
 * Si el oral se puede citar en esta clase, o el motivo del no.
 *
 * Dos negativas: la clase tiene que ser de ese alumno —suya directamente, o
 * de un grupo al que pertenezca— y no puede estar anulada. Citar un oral en
 * la clase de otro, o en una que se cayó, es un error que no debe llegar a
 * la base.
 */
export async function puedeCitarse(
  asignacionId: string,
  claseId: string,
): Promise<string | null> {
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return "Esa asignación no existe.";

  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: { estado: true, estudianteId: true, grupoId: true },
  });
  if (!clase) return "Esa clase no existe.";
  if (clase.estado === "ANULADA") return "Esa clase está anulada.";

  if (clase.estudianteId === asignacion.estudianteId) return null;

  // La clase puede ser de un grupo del que el alumno es miembro.
  if (clase.grupoId) {
    const miembro = await prisma.miembroGrupo.findUnique({
      where: {
        grupoId_estudianteId: {
          grupoId: clase.grupoId,
          estudianteId: asignacion.estudianteId,
        },
      },
      select: { id: true },
    });
    if (miembro) return null;
  }

  return "Esa clase no es de este estudiante.";
}

/**
 * Las clases en las que se puede citar un oral de este alumno: las suyas y
 * las de sus grupos, sin anular y de aquí en adelante.
 *
 * De aquí en adelante porque citar un oral en una clase que ya pasó no
 * significa nada: si se dio, se evaluó o no se evaluó, pero no se agenda.
 */
export async function clasesParaCitar(asignacionId: string) {
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return [];

  const grupos = await prisma.miembroGrupo.findMany({
    where: { estudianteId: asignacion.estudianteId },
    select: { grupoId: true },
  });

  return prisma.clase.findMany({
    where: {
      estado: { not: "ANULADA" },
      empiezaEl: { gte: new Date() },
      OR: [
        { estudianteId: asignacion.estudianteId },
        ...(grupos.length ? [{ grupoId: { in: grupos.map((g) => g.grupoId) } }] : []),
      ],
    },
    orderBy: { empiezaEl: "asc" },
    select: { id: true, empiezaEl: true, minutos: true, donde: true },
  });
}
```

- [ ] **Step 4: Verificar y commitear**

Run: `npx tsx scripts/verificar-expresion.ts && npx tsc --noEmit && npm run lint`
Expected: todo en verde y sin avisos.

```bash
git add lib/citas.ts scripts/verificar-expresion.ts
git commit -m "Citar un oral solo en una clase del alumno y que no se haya caído"
```

---

### Task 3: Las acciones

**Files:**
- Create: `lib/acciones-expresion.ts`

**Interfaces:**
- Produces, desde `@/lib/acciones-expresion`:
  - `type EstadoExpresion = { error?: string; ok?: string }`
  - `async function entregar(_prev: EstadoExpresion, formData: FormData): Promise<EstadoExpresion>`
  - `async function valorar(_prev: EstadoExpresion, formData: FormData): Promise<EstadoExpresion>`
  - `async function citarOral(_prev: EstadoExpresion, formData: FormData): Promise<EstadoExpresion>`
  - `async function descitarOral(_prev: EstadoExpresion, formData: FormData): Promise<EstadoExpresion>`

- [ ] **Step 1: Leer cómo se devuelve estado desde una acción**

Read: `node_modules/next/dist/docs/01-app/02-guides/forms.md`, sección «Validation errors». Con `useActionState` la firma **cambia** y recibe el estado anterior como primer argumento.

- [ ] **Step 2: Escribir las acciones**

Crea `lib/acciones-expresion.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { exigirProfesor } from "@/lib/profesor";
import {
  analizarExpresion,
  puedeEntregar,
  puedeValorarse,
  puntosDe,
} from "@/lib/expresion";
import { puedeCitarse } from "@/lib/citas";

export type EstadoExpresion = { error?: string; ok?: string };

/** Lo que hay que releer tras tocar una entrega o una valoración. */
function refrescar(pasoId: string, estudianteId?: string) {
  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath("/profe/entregas");
  revalidatePath("/dashboard");
  if (estudianteId) revalidatePath(`/profe/alumnos/${estudianteId}`);
}

/**
 * El alumno entrega o reescribe su texto.
 *
 * Quién puede y hasta cuándo lo decide `puedeEntregar`, que vive fuera para
 * que el script lo ejercite. Aquí solo se comprueba la sesión y se escribe.
 */
export async function entregar(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "No hay sesión." };

  const pasoId = String(formData.get("pasoId") ?? "");
  const texto = String(formData.get("texto") ?? "").trim();
  if (!pasoId) return { error: "Falta el paso." };
  if (!texto) return { error: "No has escrito nada." };

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return { error: "Ese paso no existe." };

  const asignacion = await prisma.asignacion.findUnique({
    where: {
      estudianteId_recorridoId: {
        estudianteId: usuario.id,
        recorridoId: paso.recorridoId,
      },
    },
    select: { id: true, archivada: true },
  });
  if (!asignacion || asignacion.archivada) return { error: "No tienes este recorrido asignado." };

  const motivo = await puedeEntregar(asignacion.id, pasoId);
  if (motivo) return { error: motivo };

  await prisma.pasoCompletado.upsert({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId } },
    update: { entrega: texto },
    create: { asignacionId: asignacion.id, pasoId, entrega: texto },
  });

  refrescar(pasoId);
  return { ok: "Entregado." };
}

/**
 * El profesor rellena la rúbrica.
 *
 * Escribe `puntos` y `verificadoEl` igual que `otorgarPuntos`, para que todo
 * lo que ya cuenta puntos —la hucha, el progreso, el panel— siga funcionando
 * sin enterarse de que existe un tipo nuevo.
 */
export async function valorar(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  await exigirProfesor();

  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  const comentario = String(formData.get("comentario") ?? "").trim();
  if (!asignacionId || !pasoId) return { error: "Falta el alumno o el paso." };

  const vinculo = await prisma.pasoEjercicio.findFirst({
    where: { pasoId },
    orderBy: { orden: "asc" },
    select: { ejercicio: { select: { datos: true } } },
  });
  const datos = vinculo ? analizarExpresion(vinculo.ejercicio.datos) : null;
  if (!datos) return { error: "Este paso no tiene una tarea de expresión." };

  // Las notas llegan como `nota-<criterioId>`, una por criterio.
  const notas: Record<string, number> = {};
  for (const criterio of datos.criterios) {
    const bruto = String(formData.get(`nota-${criterio.id}`) ?? "").trim();
    if (bruto !== "") notas[criterio.id] = Number(bruto);
  }

  const motivo = puedeValorarse(datos, notas);
  if (motivo) return { error: motivo };

  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (!asignacion) return { error: "Esa asignación no existe." };

  await prisma.pasoCompletado.upsert({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    update: {
      valoracion: { notas, comentario } as Prisma.InputJsonValue,
      puntos: puntosDe(datos, notas),
      verificadoEl: new Date(),
    },
    create: {
      asignacionId,
      pasoId,
      valoracion: { notas, comentario } as Prisma.InputJsonValue,
      puntos: puntosDe(datos, notas),
      verificadoEl: new Date(),
    },
  });

  refrescar(pasoId, asignacion.estudianteId);
  return { ok: "Corregido." };
}

export async function citarOral(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  await exigirProfesor();

  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  const claseId = String(formData.get("claseId") ?? "");
  if (!asignacionId || !pasoId || !claseId) return { error: "Falta el alumno, el paso o la clase." };

  const motivo = await puedeCitarse(asignacionId, claseId);
  if (motivo) return { error: motivo };

  await prisma.citaOral.upsert({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    update: { claseId },
    create: { asignacionId, pasoId, claseId },
  });

  revalidatePath(`/profe/clases/${claseId}`);
  revalidatePath("/profe/clases");
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (asignacion) revalidatePath(`/profe/alumnos/${asignacion.estudianteId}`);
  return { ok: "Citado." };
}

export async function descitarOral(
  _prev: EstadoExpresion,
  formData: FormData,
): Promise<EstadoExpresion> {
  await exigirProfesor();

  const asignacionId = String(formData.get("asignacionId") ?? "");
  const pasoId = String(formData.get("pasoId") ?? "");
  if (!asignacionId || !pasoId) return { error: "Falta el alumno o el paso." };

  // `deleteMany` y no `delete`: quitar una cita que otra pestaña ya quitó no
  // es un error, y `delete` reventaría con un P2025 sin capturar.
  await prisma.citaOral.deleteMany({ where: { asignacionId, pasoId } });

  revalidatePath("/profe/clases");
  const asignacion = await prisma.asignacion.findUnique({
    where: { id: asignacionId },
    select: { estudianteId: true },
  });
  if (asignacion) revalidatePath(`/profe/alumnos/${asignacion.estudianteId}`);
  return { ok: "Cita quitada." };
}
```

- [ ] **Step 3: Comprobar que corregir no borra la entrega**

Es la quinta regla del diseño, y no se puede afirmar en el script porque vive
dentro de una acción. Lo que la sostiene es que el `update` de `valorar` **solo
nombra `valoracion`, `puntos` y `verificadoEl`**: Prisma escribe los campos que
se le dan y no toca los demás, así que `entrega` sobrevive por construcción.

Léelo en tu propio código y **confírmalo por escrito en el informe**. Si algún
día alguien mete ahí un `entrega: null` «para limpiar», el texto del alumno
desaparece y nadie se entera.

- [ ] **Step 4: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

```bash
git add lib/acciones-expresion.ts
git commit -m "Acciones de la expresión: entregar, valorar y citar"
```

---

### Task 4: El editor de la tarea

**Files:**
- Create: `components/recursos/editor-expresion.tsx`
- Modify: `components/recursos/editor.tsx`
- Modify: `app/(app)/profe/recursos/nuevo/page.tsx`
- Modify: `app/(app)/profe/recursos/[id]/page.tsx`

**Interfaces:**
- Produces: `EditorExpresion` + `EXPRESION_VACIA`.
- Modifica el tipo de la prop `marca` de `Editor`, que pasa de `MarcaEjercicio` a `MarcaRecurso = MarcaEjercicio | "expresion"`.

- [ ] **Step 1: Ampliar la unión de marcas**

En `lib/ejercicios/tipos.ts` **no** se toca nada: `MarcaEjercicio` sigue siendo las cuatro del motor. La unión ampliada vive donde vive el editor, porque es suya. Al principio de `components/recursos/editor.tsx`:

```tsx
/**
 * Lo que el editor de Recursos sabe editar: los cuatro tipos del motor más
 * la expresión, que no se corrige sola. `MarcaEjercicio` se queda con los
 * cuatro a propósito: es lo que el motor entiende, y ampliarla allí obligaría
 * a `corregir()` a tener un caso que no puede implementar.
 */
export type MarcaRecurso = MarcaEjercicio | "expresion";
```

Y `VACIO`, la prop `marca` y las ramas pasan a usarla.

- [ ] **Step 2: Escribir el editor**

Crea `components/recursos/editor-expresion.tsx`:

```tsx
"use client";

import { area, botonSecundario, BotonQuitar, campo, CampoTexto } from "./campos";
import SubirAudio from "./subir-audio";

type Criterio = { id: string; nombre: string; maximo: number };

type DatosExpresion = {
  ejercicio: "expresion";
  modalidad: "escrita" | "oral";
  consigna: string;
  estimulo: { texto?: string; imagen?: string; audio?: string };
  palabras?: { minimo: number; maximo: number };
  minutos?: number;
  criterios: Criterio[];
  modelo?: string;
};

/** Los cuatro del Instituto Cervantes, para no escribirlos cada vez. */
const CRITERIOS_CERVANTES: Criterio[] = [
  { id: "c1", nombre: "Adecuación al género y cumplimiento", maximo: 3 },
  { id: "c2", nombre: "Coherencia", maximo: 3 },
  { id: "c3", nombre: "Corrección", maximo: 3 },
  { id: "c4", nombre: "Alcance", maximo: 3 },
];

export const EXPRESION_VACIA: DatosExpresion = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "",
  estimulo: {},
  palabras: { minimo: 100, maximo: 120 },
  criterios: CRITERIOS_CERVANTES,
};

/**
 * El siguiente id de criterio, único dentro de la tarea. Por el máximo de
 * los sufijos que ya existen y no por `longitud + 1`: quitar el criterio de
 * en medio y añadir otro repetiría un id, y ese id es la clave con la que se
 * guardan las notas del alumno.
 */
function siguienteIdCriterio(criterios: Criterio[]): string {
  const maximo = criterios.reduce((max, c) => {
    const m = /^c(\d+)$/.exec(c.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `c${maximo + 1}`;
}

export default function EditorExpresion({
  datos,
  alCambiar,
}: {
  datos: unknown;
  alCambiar: (nuevo: unknown) => void;
}) {
  const d = datos as DatosExpresion;
  const esEscrita = d.modalidad === "escrita";

  const cambiar = (parcial: Partial<DatosExpresion>) => alCambiar({ ...d, ...parcial });

  const cambiarCriterio = (i: number, parcial: Partial<Criterio>) =>
    cambiar({ criterios: d.criterios.map((c, j) => (j === i ? { ...c, ...parcial } : c)) });

  // El esquema rechaza una tarea con un criterio sin nombre y con dos
  // criterios del mismo id. Se avisa aquí para no descubrirlo al guardar.
  const sinNombre = d.criterios.some((c) => !c.nombre.trim());
  const nombres = d.criterios.map((c) => c.nombre.trim()).filter(Boolean);
  const repetido = !sinNombre && nombres.find((v, i) => nombres.indexOf(v) !== i);
  const palabrasAlReves =
    esEscrita && d.palabras !== undefined && d.palabras.minimo > d.palabras.maximo;

  return (
    <div className="space-y-6">
      <label className="block w-56 text-sm font-semibold text-tinta">
        Modalidad
        <select
          value={d.modalidad}
          onChange={(e) => {
            const modalidad = e.target.value as "escrita" | "oral";
            // Los campos son excluyentes: el esquema rechaza una escrita con
            // minutos y una oral con palabras, así que se cambian juntos.
            cambiar(
              modalidad === "escrita"
                ? { modalidad, palabras: { minimo: 100, maximo: 120 }, minutos: undefined }
                : { modalidad, minutos: 3, palabras: undefined },
            );
          }}
          className={campo}
        >
          <option value="escrita">Expresión escrita</option>
          <option value="oral">Expresión oral</option>
        </select>
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          {esEscrita
            ? "El alumno escribe en la aplicación y te llega para corregir."
            : "No hay entrega: la evalúas con el alumno delante, en clase."}
        </span>
      </label>

      <label className="block text-sm font-semibold text-tinta">
        Consigna
        <textarea
          rows={3}
          value={d.consigna}
          onChange={(e) => cambiar({ consigna: e.target.value })}
          placeholder="Escribe un correo a un amigo contándole tus vacaciones."
          className={area}
        />
      </label>

      <fieldset className="rounded-tarjeta border border-hp-100 p-4">
        <legend className="px-2 text-sm font-bold text-tinta">Estímulo</legend>
        <p className="text-sm text-tinta-suave">
          Lo que el alumno tiene delante: el texto al que responde, la lámina,
          el gráfico o el audio. Viaja con la tarea, así que sirve con otro
          alumno sin volver a montarlo.
        </p>

        <label className="mt-3 block text-sm font-semibold text-tinta">
          Texto
          <textarea
            rows={4}
            value={d.estimulo.texto ?? ""}
            onChange={(e) =>
              cambiar({ estimulo: { ...d.estimulo, texto: e.target.value || undefined } })
            }
            className={area}
          />
        </label>

        <div className="mt-3">
          <span className="block text-sm font-semibold text-tinta">Imagen (opcional)</span>
          <input
            type="text"
            value={d.estimulo.imagen ?? ""}
            onChange={(e) =>
              cambiar({ estimulo: { ...d.estimulo, imagen: e.target.value || undefined } })
            }
            placeholder="Dirección de la imagen"
            className={campo}
          />
        </div>

        <div className="mt-3">
          <span className="block text-sm font-semibold text-tinta">Audio (opcional)</span>
          <div className="mt-1">
            <SubirAudio
              valor={d.estimulo.audio}
              alCambiar={(url) => cambiar({ estimulo: { ...d.estimulo, audio: url } })}
            />
          </div>
        </div>
      </fieldset>

      {esEscrita ? (
        <div className="flex flex-wrap gap-4">
          <label className="block w-40 text-sm font-semibold text-tinta">
            Palabras, mínimo
            <input
              type="number"
              min={1}
              step={1}
              value={d.palabras?.minimo ?? 100}
              onChange={(e) =>
                cambiar({
                  palabras: {
                    minimo: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                    maximo: d.palabras?.maximo ?? 120,
                  },
                })
              }
              className={campo}
            />
          </label>
          <label className="block w-40 text-sm font-semibold text-tinta">
            Palabras, máximo
            <input
              type="number"
              min={1}
              step={1}
              value={d.palabras?.maximo ?? 120}
              onChange={(e) =>
                cambiar({
                  palabras: {
                    minimo: d.palabras?.minimo ?? 100,
                    maximo: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                  },
                })
              }
              className={campo}
            />
          </label>
        </div>
      ) : (
        <label className="block w-40 text-sm font-semibold text-tinta">
          Minutos
          <input
            type="number"
            min={1}
            step={1}
            value={d.minutos ?? 3}
            onChange={(e) =>
              cambiar({ minutos: Math.max(1, Math.trunc(Number(e.target.value)) || 1) })
            }
            className={campo}
          />
        </label>
      )}

      {palabrasAlReves && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          El mínimo de palabras es mayor que el máximo.
        </p>
      )}
      {sinNombre && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Hay un criterio sin nombre.
        </p>
      )}
      {repetido && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Hay dos criterios llamados «{repetido}»: al corregir no sabrás cuál es cuál.
        </p>
      )}

      <fieldset className="rounded-tarjeta border border-hp-100 p-4">
        <legend className="px-2 text-sm font-bold text-tinta">Criterios</legend>
        <p className="text-sm text-tinta-suave">
          Con lo que vas a puntuar. Vienen los cuatro del Instituto Cervantes;
          quita, añade o cambia lo que quieras. La suma de sus máximos es lo
          que puede sacar el alumno.
        </p>

        <div className="mt-3 space-y-2">
          {d.criterios.map((c, i) => (
            <div key={c.id} className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <CampoTexto
                  etiqueta={`Criterio ${i + 1}`}
                  valor={c.nombre}
                  alCambiar={(v) => cambiarCriterio(i, { nombre: v })}
                />
              </div>
              <label className="block w-28 text-sm font-semibold text-tinta">
                Máximo
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={c.maximo}
                  onChange={(e) =>
                    cambiarCriterio(i, {
                      maximo: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                    })
                  }
                  className={campo}
                />
              </label>
              {d.criterios.length > 1 && (
                <BotonQuitar
                  onClick={() => cambiar({ criterios: d.criterios.filter((_, j) => j !== i) })}
                >
                  Quitar
                </BotonQuitar>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            cambiar({
              criterios: [
                ...d.criterios,
                { id: siguienteIdCriterio(d.criterios), nombre: "", maximo: 3 },
              ],
            })
          }
          className={`${botonSecundario} mt-3`}
        >
          Añadir criterio
        </button>
      </fieldset>

      <label className="block text-sm font-semibold text-tinta">
        Texto modelo (opcional)
        <textarea
          rows={6}
          value={d.modelo ?? ""}
          onChange={(e) => cambiar({ modelo: e.target.value || undefined })}
          className={area}
        />
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Al alumno se le enseña <strong>después</strong> de que lo corrijas, nunca antes.
        </span>
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Registrarlo en el armazón**

En `components/recursos/editor.tsx`:

```tsx
import EditorExpresion, { EXPRESION_VACIA } from "./editor-expresion";
```

```tsx
export const VACIO: Partial<Record<MarcaRecurso, unknown>> = {
  opcion: OPCION_VACIA,
  huecos: HUECOS_VACIO,
  relacionar: RELACIONAR_VACIO,
  ordenar: ORDENAR_VACIO,
  expresion: EXPRESION_VACIA,
};
```

```tsx
          {marca === "expresion" && <EditorExpresion datos={datos} alCambiar={setDatos} />}
```

- [ ] **Step 4: Ofrecerlo al crear**

En `app/(app)/profe/recursos/nuevo/page.tsx`, añade la tarjeta a la lista de tipos:

```tsx
  { marca: "expresion", nombre: "Expresión", explica: "Una redacción o una tarea oral, que corriges tú con una rúbrica." },
```

Y en `app/(app)/profe/recursos/[id]/page.tsx`, la marca de un ejercicio guardado sale hoy de `analizar(fila.datos)`. Añade el segundo intento:

```tsx
  const analizado = analizar(fila.datos);
  const expresion = analizado ? null : analizarExpresion(fila.datos);
  if (!analizado && !expresion) notFound();
  const marca: MarcaRecurso = analizado ? analizado.tipo : "expresion";
```

- [ ] **Step 5: Verificar y probar a mano**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-recursos.ts`

Run: `npm run dev` (en segundo plano; mátalo después). En `/profe/recursos/nuevo?tipo=expresion`: crea una escrita con sus criterios, cambia a oral y comprueba que el número de palabras se sustituye por los minutos, guarda y publica. Si no puedes entrar por falta de credenciales, **dilo en el informe**.

- [ ] **Step 6: Commit**

```bash
git add components/recursos "app/(app)/profe/recursos"
git commit -m "Editor de la expresión, con los cuatro criterios del Cervantes puestos"
```

---

### Task 5: La cara del alumno

**Files:**
- Create: `components/expresion/entrega.tsx`
- Modify: `app/(app)/pasos/[pasoId]/page.tsx`

**Interfaces:**
- Produces: `export default function Entrega({ pasoId, publica, entrega, valoracion, cerrada })`

- [ ] **Step 1: El componente**

Crea `components/expresion/entrega.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { entregar, type EstadoExpresion } from "@/lib/acciones-expresion";
// `import type` y no un import normal: `lib/expresion.ts` importa `prisma`, y
// esto es un componente de cliente. TypeScript borra los imports de tipo al
// compilar, así que nada de eso llega al navegador — pero si alguien lo
// convierte algún día en un import de valor, se lleva media base de datos
// al bundle. Que se quede en `import type`.
import type { ExpresionPublica } from "@/lib/expresion";

/** Palabras de verdad: separadas por espacios, sin contar los de sobra. */
function contarPalabras(texto: string): number {
  const limpio = texto.trim();
  return limpio === "" ? 0 : limpio.split(/\s+/).length;
}

export default function Entrega({
  pasoId,
  publica,
  entrega,
  valoracion,
  cerrada,
}: {
  pasoId: string;
  publica: ExpresionPublica;
  /** Lo que ya escribió, si escribió. */
  entrega: string | null;
  /** La rúbrica rellenada, si ya está corregida. */
  valoracion: { notas: Record<string, number>; comentario: string } | null;
  /** Ya corregida: no se puede tocar. */
  cerrada: boolean;
}) {
  const [texto, setTexto] = useState(entrega ?? "");
  const [estado, enviar, enviando] = useActionState<EstadoExpresion, FormData>(entregar, {});

  const palabras = contarPalabras(texto);
  const limites = publica.palabras;
  const fuera = limites && (palabras < limites.minimo || palabras > limites.maximo);

  return (
    <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
      <p className="font-bold text-tinta">{publica.consigna}</p>

      {publica.estimulo.texto && (
        <p className="mt-4 whitespace-pre-wrap rounded-tarjeta bg-fondo p-4 text-sm leading-relaxed text-tinta">
          {publica.estimulo.texto}
        </p>
      )}
      {publica.estimulo.imagen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={publica.estimulo.imagen}
          alt="Material de la tarea"
          className="mt-4 max-h-96 rounded-tarjeta"
        />
      )}
      {publica.estimulo.audio && (
        <audio controls preload="none" src={publica.estimulo.audio} className="mt-4 w-full max-w-sm">
          Tu navegador no puede reproducir este audio.
        </audio>
      )}

      {publica.modalidad === "oral" ? (
        <p className="mt-6 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Esta tarea se hace en clase, con tu profesor. Aquí tienes el material
          para prepararla{publica.minutos ? `: dura unos ${publica.minutos} minutos` : ""}.
        </p>
      ) : (
        <form action={enviar} className="mt-6">
          <input type="hidden" name="pasoId" value={pasoId} />
          <input type="hidden" name="texto" value={texto} />

          <textarea
            rows={12}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={cerrada}
            className="w-full rounded-tarjeta border border-hp-200 bg-white p-4 text-sm leading-relaxed text-tinta outline-none focus:border-hp-400 disabled:bg-fondo"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!cerrada && (
              <button
                type="submit"
                disabled={enviando || palabras === 0}
                className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:opacity-40"
              >
                {enviando ? "Entregando…" : entrega ? "Volver a entregar" : "Entregar"}
              </button>
            )}
            <span className={`text-sm ${fuera ? "font-bold text-tinta" : "text-tinta-suave"}`}>
              {limites
                ? `${palabras} de ${limites.minimo}-${limites.maximo} palabras`
                : `${palabras} palabras`}
            </span>
          </div>

          {/*
            El contador avisa y deja entregar. Escribir noventa palabras
            cuando se piden cien es un error del alumno que el profesor va a
            puntuar, no algo que la aplicación deba impedirle.
          */}
          {fuera && !cerrada && (
            <p className="mt-2 text-sm text-tinta-suave">
              Estás fuera del número de palabras que pide la tarea. Puedes
              entregarlo igual, pero cuenta para la nota.
            </p>
          )}
        </form>
      )}

      {estado.error && (
        <p className="mt-3 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{estado.error}</p>
      )}
      {estado.ok && !estado.error && (
        <p className="mt-3 rounded-tarjeta bg-hp-100 px-4 py-3 text-sm text-hp-700">{estado.ok}</p>
      )}

      {valoracion && (
        <div className="mt-8 border-t border-hp-100 pt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Tu corrección</p>
          <ul className="mt-3 space-y-1">
            {publica.criterios.map((c) => (
              <li key={c.id} className="flex justify-between text-sm text-tinta">
                <span>{c.nombre}</span>
                <span className="font-bold">
                  {valoracion.notas[c.id] ?? 0} / {c.maximo}
                </span>
              </li>
            ))}
          </ul>
          {valoracion.comentario && (
            <p className="mt-4 whitespace-pre-wrap rounded-tarjeta bg-fondo p-4 text-sm text-tinta">
              {valoracion.comentario}
            </p>
          )}
        </div>
      )}

      {publica.modelo && (
        <div className="mt-8 border-t border-hp-100 pt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Texto modelo</p>
          <p className="mt-3 whitespace-pre-wrap rounded-tarjeta bg-fondo p-4 text-sm leading-relaxed text-tinta">
            {publica.modelo}
          </p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: La rama en la página del paso**

En `app/(app)/pasos/[pasoId]/page.tsx`, junto al `analizado` que ya hay:

```tsx
import { analizarExpresion, versionPublicaExpresion } from "@/lib/expresion";
import Entrega from "@/components/expresion/entrega";
```

```tsx
  // La expresión es hermana del motor: si `analizar` no lo reconoce, puede
  // ser una tarea de expresión.
  const expresion = analizado ? null : vinculo ? analizarExpresion(vinculo.ejercicio.datos) : null;
  const corregida = Boolean(registro?.verificadoEl);
```

Y en el JSX, junto a donde se pinta `<Ejercicio>`:

```tsx
      {expresion && asignacion && (
        <Entrega
          pasoId={paso.id}
          publica={versionPublicaExpresion(expresion, corregida)}
          entrega={registro?.entrega ?? null}
          valoracion={
            (registro?.valoracion as { notas: Record<string, number>; comentario: string } | null) ??
            null
          }
          cerrada={corregida}
        />
      )}
```

**`versionPublicaExpresion(expresion, corregida)` es lo que impide que el modelo viaje antes de tiempo.** No lo sustituyas por `expresion` a secas ni escondas el modelo solo en el JSX: lo que viaja se lee en el código de la página.

- [ ] **Step 3: Verificar y probar**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-expresion.ts`

Y **la comprobación que de verdad importa**: con el servidor levantado y una tarea de expresión enganchada a un paso asignado, abre la página como alumno **sin corregir** y busca el texto modelo en el código fuente de la página (`Ver código fuente` del navegador, o `curl` con la cookie de sesión). **No puede aparecer.** Si no puedes entrar con sesión, dilo en el informe.

- [ ] **Step 4: Commit**

```bash
git add components/expresion "app/(app)/pasos/[pasoId]/page.tsx"
git commit -m "El alumno escribe y entrega, y el modelo no viaja hasta que se corrige"
```

---

### Task 6: La bandeja y la corrección

**Files:**
- Create: `components/expresion/rubrica.tsx`
- Create: `app/(app)/profe/entregas/page.tsx`
- Create: `app/(app)/profe/entregas/[id]/page.tsx`

**Interfaces:**
- Produces: `export default function Rubrica({ asignacionId, pasoId, criterios, valoracion })`

- [ ] **Step 1: La rúbrica**

Crea `components/expresion/rubrica.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { valorar, type EstadoExpresion } from "@/lib/acciones-expresion";

export default function Rubrica({
  asignacionId,
  pasoId,
  criterios,
  valoracion,
}: {
  asignacionId: string;
  pasoId: string;
  criterios: { id: string; nombre: string; maximo: number }[];
  valoracion: { notas: Record<string, number>; comentario: string } | null;
}) {
  const [notas, setNotas] = useState<Record<string, number>>(valoracion?.notas ?? {});
  const [estado, guardar, guardando] = useActionState<EstadoExpresion, FormData>(valorar, {});

  const total = criterios.reduce((s, c) => s + (notas[c.id] ?? 0), 0);
  const maximo = criterios.reduce((s, c) => s + c.maximo, 0);
  const completa = criterios.every((c) => notas[c.id] !== undefined);

  return (
    <form action={guardar} className="rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
      <input type="hidden" name="asignacionId" value={asignacionId} />
      <input type="hidden" name="pasoId" value={pasoId} />
      {criterios.map((c) => (
        <input key={c.id} type="hidden" name={`nota-${c.id}`} value={notas[c.id] ?? ""} />
      ))}

      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Rúbrica</p>

      <ul className="mt-4 space-y-3">
        {criterios.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 text-sm font-semibold text-tinta">{c.nombre}</span>
            <div className="flex gap-1">
              {Array.from({ length: c.maximo + 1 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNotas({ ...notas, [c.id]: n })}
                  className={`h-9 w-9 rounded-full text-sm font-bold transition-colors ${
                    notas[c.id] === n
                      ? "bg-hp-400 text-white"
                      : "border border-hp-200 text-tinta hover:border-hp-400"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <label className="mt-6 block text-sm font-semibold text-tinta">
        Comentario para el alumno
        <textarea
          name="comentario"
          rows={4}
          defaultValue={valoracion?.comentario ?? ""}
          className="mt-1 w-full rounded-tarjeta border border-hp-200 bg-white p-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
      </label>

      {estado.error && (
        <p className="mt-4 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{estado.error}</p>
      )}
      {estado.ok && !estado.error && (
        <p className="mt-4 rounded-tarjeta bg-hp-100 px-4 py-3 text-sm text-hp-700">{estado.ok}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={guardando || !completa}
          className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {guardando ? "Guardando…" : valoracion ? "Volver a corregir" : "Corregir"}
        </button>
        <span className="text-sm text-tinta-suave">
          {completa ? `${total} de ${maximo} puntos` : "Falta puntuar algún criterio"}
        </span>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: La bandeja**

Crea `app/(app)/profe/entregas/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { analizarExpresion } from "@/lib/expresion";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

function nombreDe(u: { firstName: string | null; lastName: string | null; email: string }) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function EntregasPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  // Entregado y sin corregir. Solo las escritas producen entrega, así que
  // filtrar por `entrega` deja fuera las orales sin tener que mirar el tipo.
  const pendientes = await prisma.pasoCompletado.findMany({
    where: { entrega: { not: null }, verificadoEl: null },
    orderBy: { completadoEl: "asc" },
    select: {
      id: true,
      completadoEl: true,
      paso: { select: { id: true, titulo: true, recorrido: { select: { titulo: true } } } },
      asignacion: {
        select: {
          estudiante: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">Entregas</h1>
      <p className="mt-2 text-tinta-suave">
        Lo que está esperando corrección. Las tareas orales no salen aquí: no
        hay entrega, se corrigen desde la ficha del alumno o desde la clase.
      </p>

      {pendientes.length === 0 ? (
        <p className="mt-8 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          No hay nada esperando.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {pendientes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/profe/entregas/${p.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">
                    {nombreDe(p.asignacion.estudiante)}
                  </p>
                  <p className="truncate text-xs text-tinta-suave">
                    {p.paso.recorrido.titulo} · {p.paso.titulo}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-tinta-suave">
                  {formatoFecha.format(p.completadoEl)}
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

**Nota sobre el filtro:** `analizarExpresion` está importado para el paso siguiente, no aquí. Si al terminar esta pantalla no lo usas, **quita el import**: `npm run lint` tiene que quedar sin avisos.

- [ ] **Step 3: La pantalla de corrección**

Crea `app/(app)/profe/entregas/[id]/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { analizarExpresion } from "@/lib/expresion";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Rubrica from "@/components/expresion/rubrica";

export const dynamic = "force-dynamic";

export default async function CorregirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const registro = await prisma.pasoCompletado.findUnique({
    where: { id },
    select: {
      entrega: true,
      valoracion: true,
      asignacionId: true,
      paso: {
        select: {
          id: true,
          titulo: true,
          ejercicios: {
            orderBy: { orden: "asc" },
            take: 1,
            select: { ejercicio: { select: { datos: true } } },
          },
        },
      },
      asignacion: {
        select: { estudiante: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
  });
  if (!registro) notFound();

  const datos = registro.paso.ejercicios[0]
    ? analizarExpresion(registro.paso.ejercicios[0].ejercicio.datos)
    : null;
  if (!datos) notFound();

  const alumno = registro.asignacion.estudiante;
  const nombre =
    [alumno.firstName, alumno.lastName].filter(Boolean).join(" ") || alumno.email;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/profe/entregas" className="text-sm font-semibold text-tinta-suave hover:text-hp-500">
        ← Entregas
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">{nombre}</h1>
      <p className="mt-1 text-tinta-suave">{registro.paso.titulo}</p>

      <p className="mt-6 rounded-tarjeta bg-fondo p-4 text-sm text-tinta">{datos.consigna}</p>

      {registro.entrega && (
        <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Lo que escribió</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-tinta">
            {registro.entrega}
          </p>
        </section>
      )}

      <div className="mt-6">
        <Rubrica
          asignacionId={registro.asignacionId}
          pasoId={registro.paso.id}
          criterios={datos.criterios}
          valoracion={
            (registro.valoracion as { notas: Record<string, number>; comentario: string } | null) ??
            null
          }
        />
      </div>

      {datos.modelo && (
        <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Texto modelo</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-tinta">{datos.modelo}</p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: El enlace en la navegación**

En `app/(app)/layout.tsx` hay una tira de enlaces, cada uno **dentro de su propia condición `{esProfe && (…)}`** (líneas 61-90: Alumnos, Clases, Recursos, Orales). Añade el tuyo junto al de Recursos, con la misma forma que los que ya están:

```tsx
            {esProfe && (
              <Link
                href="/profe/entregas"
                className={/* la misma que llevan los de al lado */}
              >
                Entregas
              </Link>
            )}
```

Copia la `className` del enlace de «Recursos» que tienes justo encima: es la de todos, y escribir una a mano sería la quinta variante de lo mismo.

- [ ] **Step 5: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-expresion.ts`

```bash
git add components/expresion "app/(app)/profe/entregas" "app/(app)/layout.tsx"
git commit -m "La bandeja de entregas y la pantalla donde se corrige"
```

---

### Task 7: La cita del oral en las dos pantallas

**Files:**
- Create: `app/(app)/profe/alumnos/[id]/citar-oral.tsx`
- Modify: `app/(app)/profe/alumnos/[id]/page.tsx`
- Modify: `app/(app)/profe/clases/[id]/page.tsx`

**Interfaces:**
- Consumes: `citarOral`, `descitarOral` de `@/lib/acciones-expresion`; `clasesParaCitar` de `@/lib/citas`.

- [ ] **Step 1: El componente de citar**

Crea `app/(app)/profe/alumnos/[id]/citar-oral.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { citarOral, descitarOral, type EstadoExpresion } from "@/lib/acciones-expresion";

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export default function CitarOral({
  asignacionId,
  pasoId,
  citada,
  clases,
}: {
  asignacionId: string;
  pasoId: string;
  /** La clase en la que ya está citado, si lo está. */
  citada: { id: string; empiezaEl: Date } | null;
  /** Las clases del alumno en las que se puede citar. */
  clases: { id: string; empiezaEl: Date; donde: string | null }[];
}) {
  const [estadoCitar, citar] = useActionState<EstadoExpresion, FormData>(citarOral, {});
  const [estadoQuitar, quitar] = useActionState<EstadoExpresion, FormData>(descitarOral, {});
  const error = estadoCitar.error ?? estadoQuitar.error;

  return (
    <div className="mt-2">
      {error && (
        <p className="mb-2 rounded-tarjeta bg-sol-100 px-3 py-2 text-xs text-tinta">{error}</p>
      )}

      {citada ? (
        <form action={quitar} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="asignacionId" value={asignacionId} />
          <input type="hidden" name="pasoId" value={pasoId} />
          <span className="text-xs text-tinta-suave">
            Citado para el {formatoFecha.format(citada.empiezaEl)}
          </span>
          <button type="submit" className="text-xs font-semibold text-tinta-suave underline hover:text-hp-500">
            Quitar la cita
          </button>
        </form>
      ) : clases.length === 0 ? (
        <p className="text-xs text-tinta-suave">
          Este alumno no tiene clases agendadas.{" "}
          <Link href="/profe/clases" className="font-semibold underline hover:text-hp-500">
            Agenda una
          </Link>{" "}
          y podrás citarle el oral.
        </p>
      ) : (
        <form action={citar} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="asignacionId" value={asignacionId} />
          <input type="hidden" name="pasoId" value={pasoId} />
          <select
            name="claseId"
            required
            defaultValue=""
            className="h-8 rounded-full border border-hp-200 px-3 text-xs text-tinta outline-none focus:border-hp-400"
          >
            <option value="" disabled>
              Citar el oral en…
            </option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {formatoFecha.format(c.empiezaEl)}
                {c.donde ? ` · ${c.donde}` : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 rounded-full border border-hp-200 px-3 text-xs font-bold text-tinta hover:border-hp-400"
          >
            Citar
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Enchufarlo en la ficha del alumno**

En `app/(app)/profe/alumnos/[id]/page.tsx`.

**Primero, que la consulta traiga el ejercicio de cada paso.** El `select` de los pasos (líneas 51-54) es hoy `{ id: true, orden: true, titulo: true }`. Añádele:

```tsx
            pasos: {
              orderBy: { orden: "asc" },
              select: {
                id: true,
                orden: true,
                titulo: true,
                // Para saber si el paso es una tarea de expresión y de qué
                // modalidad. El primero por orden, igual que hace la página
                // del paso: un paso solo enseña un ejercicio.
                ejercicios: {
                  orderBy: { orden: "asc" },
                  take: 1,
                  select: { ejercicio: { select: { datos: true } } },
                },
              },
            },
```

**Segundo, carga las clases y las citas una sola vez por asignación**, fuera del bucle de pasos. Junto a donde ya se resuelven los datos de la asignación:

```tsx
import { analizarExpresion } from "@/lib/expresion";
import { clasesParaCitar } from "@/lib/citas";
import CitarOral from "./citar-oral";
```

```tsx
  // Fuera del bucle de pasos: una consulta por asignación, no una por paso.
  const [clasesCitables, citas] = await Promise.all([
    clasesParaCitar(asignacion.id),
    prisma.citaOral.findMany({
      where: { asignacionId: asignacion.id },
      select: { pasoId: true, clase: { select: { id: true, empiezaEl: true } } },
    }),
  ]);
  const citaDe = new Map(citas.map((c) => [c.pasoId, c.clase]));
```

**Tercero, dentro del bucle**, calcula qué es cada paso:

```tsx
              const expresion = paso.ejercicios[0]
                ? analizarExpresion(paso.ejercicios[0].ejercicio.datos)
                : null;
```

Y con eso, dos cambios en lo que se pinta:

```tsx
              {/*
                Los puntos de una tarea de expresión salen de la rúbrica, no
                de un número escrito a mano: el campo suelto se sustituye por
                un enlace a la pantalla que sí sabe puntuarla.
              */}
              {expresion ? (
                <Link
                  href={`/profe/entregas/${registro?.id ?? ""}`}
                  className="shrink-0 text-xs font-semibold text-tinta-suave underline hover:text-hp-500"
                >
                  {registro?.verificadoEl ? "Ver la corrección" : "Corregir"}
                </Link>
              ) : (
                /* el formulario de otorgarPuntos que ya está, sin tocar */
              )}

              {expresion?.modalidad === "oral" && (
                <CitarOral
                  asignacionId={asignacion.id}
                  pasoId={paso.id}
                  citada={citaDe.get(paso.id) ?? null}
                  clases={clasesCitables}
                />
              )}
```

**Ojo con el enlace:** necesita el `id` del `PasoCompletado`, y ese `select` hoy trae `pasoId`, `puntos`, `verificadoEl` y `completadoEl` pero **no el `id`**. Añádeselo. Y si no hay registro —una oral que todavía no se ha evaluado nunca—, no hay fila a la que enlazar: en ese caso pinta el enlace hacia la ficha del paso o deshabilítalo, y **explica en el informe qué elegiste**, porque es el único hueco de esta pantalla.

**No quites el campo de puntos de los demás pasos**: sigue siendo como se puntúa todo lo que no es expresión.

- [ ] **Step 3: Los orales citados, en la clase**

En `app/(app)/profe/clases/[id]/page.tsx`, carga las citas de esa clase:

```tsx
  const citas = await prisma.citaOral.findMany({
    where: { claseId: clase.id },
    select: {
      pasoId: true,
      asignacion: {
        select: {
          estudianteId: true,
          estudiante: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
```

**`CitaOral` no tiene relación con `Paso`**: guarda su id a secas, porque un paso no es dueño de la cita y darle una relación obligaría a decidir qué pasa al borrar un paso que tiene orales citados. Así que el título se lee aparte, en una consulta:

```tsx
  const pasosCitados = citas.length
    ? await prisma.paso.findMany({
        where: { id: { in: citas.map((c) => c.pasoId) } },
        select: { id: true, titulo: true, recorrido: { select: { titulo: true } } },
      })
    : [];
  const tituloDe = new Map(pasosCitados.map((p) => [p.id, p]));
```

Y la sección, donde encaje en esa página:

```tsx
      {citas.length > 0 && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
            Orales citados en esta clase
          </p>
          <ul className="mt-3 space-y-2">
            {citas.map((c) => {
              const paso = tituloDe.get(c.pasoId);
              const alumno = c.asignacion.estudiante;
              const nombre =
                [alumno.firstName, alumno.lastName].filter(Boolean).join(" ") || alumno.email;
              return (
                <li key={c.pasoId} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm text-tinta">
                    <strong>{nombre}</strong>
                    {paso ? ` · ${paso.recorrido.titulo} · ${paso.titulo}` : ""}
                  </span>
                  <Link
                    href={`/profe/alumnos/${c.asignacion.estudianteId}`}
                    className="shrink-0 text-xs font-semibold text-tinta-suave underline hover:text-hp-500"
                  >
                    Evaluar
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
```

Un paso que ya no existe deja su cita apuntando al vacío —`CitaOral` no cascadea desde `Paso`—, y por eso `tituloDe.get` puede no encontrarlo. Se pinta el nombre del alumno igual, sin reventar. **Anótalo en el informe** si te parece que merece más que eso.

- [ ] **Step 4: Verificar y probar a mano**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-expresion.ts && npx next build`

Con el servidor levantado: agenda una clase con un alumno, cítale un oral desde su ficha, y comprueba que aparece en la clase. Quita la cita y comprueba que desaparece de los dos sitios. Si no puedes entrar, dilo en el informe.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/profe/alumnos/[id]" "app/(app)/profe/clases/[id]/page.tsx"
git commit -m "Citar el oral en una clase, y verlo desde la clase"
```

---

## Lo que queda anotado al cerrar

- **El simulacro completo y los grupos de calificación**: necesita las cuatro pruebas puntuando juntas.
- **Corregir sobre el texto**, señalando errores dentro de la redacción. Aquí hay un comentario general.
- **Que el alumno se grabe** o **entregue una foto de su folio**: las dos exigen abrir la subida a los estudiantes.
- **Solapes de citas**: dos orales en la misma clase se permiten a propósito.
