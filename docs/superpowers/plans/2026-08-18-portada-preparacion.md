# Portada de preparación DELE — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un estudiante entre en `/preparacion`, elija un examen concreto y lo empiece, con su estado a la vista y sin que el profesor tenga que asignárselo.

**Architecture:** Un escalón nuevo bajo la portada existente, `/preparacion/[bloque]`, que lista los recorridos publicados de ese bloque agrupados por examen. La tabla de los cuatro bloques sale de `page.tsx` a un módulo puro. Una acción de servidor crea la asignación del alumno, con el profesor de su grupo como dueño. El estado de cada tarjeta sale de una sola consulta agrupada, no de una por tarjeta.

**Tech Stack:** Next.js 16 (App Router, Server Components y Server Actions), Prisma 7 sobre PostgreSQL, Tailwind 4. Sin framework de test: las pruebas del proyecto son scripts `scripts/verificar-*.ts` que se ejecutan con `npx tsx` y afirman con una función `afirmar`.

**Spec:** `docs/superpowers/specs/2026-08-18-portada-preparacion-design.md`

## Global Constraints

- **Este no es el Next.js de tu memoria.** Antes de escribir código de framework, leer la guía correspondiente en `node_modules/next/dist/docs/`. Es la regla de `AGENTS.md` en la raíz.
- **Castellano en todo**: nombres de archivos, funciones, variables, comentarios y texto de pantalla. El código de este repo está escrito así de punta a punta.
- **Los comentarios explican el porqué, no el qué.** El repo comenta las decisiones y las trampas, no las líneas.
- **No hay framework de test.** Cada tarea añade sus afirmaciones a `scripts/verificar-preparacion.ts` y se ejecuta con `npx tsx scripts/verificar-preparacion.ts`. El script crea sus propios datos y los borra en un `.finally()`, como hace `scripts/verificar-pegado.ts`.
- **Verificación de cierre de cada tarea:** `npx tsc --noEmit` y `npm run lint` tienen que salir en 0.
- **`getUsuarioActual()` ya filtra a los bloqueados**: devuelve `null` para un usuario con `bloqueadoEl`. No hay que comprobar el bloqueo aparte.
- **El bloque 3 (examen blanco) no es autoservicio.** Ninguna ruta ni acción puede dejar que un alumno se lo abra.
- **La acción del alumno crea o no hace nada.** Nunca reutilizar `asignarA` (`lib/acciones.ts:40`): su `upsert` pone `archivada: false` y reescribe `profesorId`.

---

### Task 1: La tabla de los cuatro bloques, fuera de la página

Hoy la constante `BLOQUES` vive dentro de `app/(app)/preparacion/page.tsx` y la van a necesitar dos páginas. Sale a un módulo puro —sin Prisma— para que lo pueda importar cualquiera, cliente incluido.

**Files:**
- Create: `lib/preparacion.ts`
- Create: `scripts/verificar-preparacion.ts`
- Modify: `app/(app)/preparacion/page.tsx` (quitar la constante local, importar del módulo)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type BloquePreparacion = { orden: number; nombre: string; titulo: string; descripcion: string; acento: string; borde: string; autoservicio: boolean }`
  - `const BLOQUES: BloquePreparacion[]`
  - `function bloquePorNombre(nombre: string): BloquePreparacion | null`
  - `function bloquePorOrden(orden: number): BloquePreparacion | null`

- [ ] **Step 1: Escribir el verificador que falla**

Crear `scripts/verificar-preparacion.ts`:

```ts
/**
 * Verifica la portada de preparación: la tabla de bloques, el catálogo y la
 * puerta por la que un alumno se abre una práctica.
 *
 * Las partes puras no tocan la base. Las que sí, crean sus propios datos y los
 * borran en el `.finally()`, aunque una afirmación reviente a mitad.
 *
 * Ejecutar con:  npx tsx scripts/verificar-preparacion.ts
 */
import "dotenv/config";
import { BLOQUES, bloquePorNombre, bloquePorOrden } from "@/lib/preparacion";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function main() {
  // ─── La tabla de bloques ───────────────────────────────────────────────
  afirmar(BLOQUES.length === 4, "hay cuatro bloques");
  afirmar(
    BLOQUES.map((b) => b.orden).join(",") === "1,2,3,4",
    "los bloques van del 1 al 4, en orden",
  );
  afirmar(
    new Set(BLOQUES.map((b) => b.nombre)).size === 4,
    "los cuatro nombres de URL son distintos",
  );
  afirmar(
    bloquePorNombre("practica")?.orden === 2,
    "«practica» es el bloque 2",
  );
  afirmar(
    bloquePorOrden(3)?.nombre === "examen-blanco",
    "el bloque 3 se llama «examen-blanco» en la URL",
  );
  afirmar(bloquePorNombre("no-existe") === null, "un nombre inventado no da bloque");
  afirmar(bloquePorOrden(99) === null, "un orden inventado no da bloque");

  // El bloque 3 es el único que el alumno no se abre solo. Es la regla que
  // sostiene toda la puerta: si alguien la cambia aquí, el examen blanco se
  // vuelve autoservicio sin que nadie lo note.
  afirmar(
    BLOQUES.filter((b) => !b.autoservicio).map((b) => b.orden).join(",") === "3",
    "el examen blanco es el único bloque que no es autoservicio",
  );

  console.log("\nTodo en orden.");
}

main().then(() => process.exit(0));
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: FALLA al resolver el import, con `Cannot find module '@/lib/preparacion'`.

- [ ] **Step 3: Escribir el módulo**

Crear `lib/preparacion.ts`:

```ts
/**
 * Los cuatro bloques de la preparación al DELE.
 *
 * Vive aquí y no dentro de la página porque lo necesitan las dos: la portada,
 * que pinta las cuatro tarjetas, y `/preparacion/[bloque]`, que resuelve el
 * nombre de la URL. Duplicarlo es garantizar que se separen.
 *
 * `orden` es el campo `Recorrido.orden`: en una secuencia de preparación no
 * significa «la posición en una lista» sino a qué bloque pertenece.
 *
 * Módulo puro a propósito —ni Prisma ni nada de servidor—: así lo puede
 * importar también un componente de cliente.
 */
export type BloquePreparacion = {
  orden: number;
  /** El segmento de la URL: `/preparacion/practica`. */
  nombre: string;
  titulo: string;
  descripcion: string;
  /** Clase de color del círculo. */
  acento: string;
  /** Clase del borde al pasar por encima. */
  borde: string;
  /**
   * Si el alumno puede abrírselo por su cuenta. El examen blanco no: ese lo
   * asigna el profesor, y es lo que separa un ensayo de un simulacro.
   */
  autoservicio: boolean;
};

export const BLOQUES: BloquePreparacion[] = [
  {
    orden: 1,
    nombre: "estructura",
    titulo: "Estructura y estrategias",
    descripcion:
      "Cómo es el examen por dentro: cuántas pruebas, cuánto duran y qué busca el tribunal en cada una.",
    acento: "bg-bloque1",
    borde: "hover:border-bloque1",
    autoservicio: true,
  },
  {
    orden: 2,
    nombre: "practica",
    titulo: "Práctica por tarea",
    descripcion:
      "Propuestas reales de cada prueba, una por una, con corrección de tu profe.",
    acento: "bg-bloque2",
    borde: "hover:border-bloque2",
    autoservicio: true,
  },
  {
    orden: 3,
    nombre: "examen-blanco",
    titulo: "Examen blanco",
    descripcion:
      "Simulacro completo y cronometrado, seguido de una cita para repasar los resultados.",
    acento: "bg-bloque3",
    borde: "hover:border-bloque3",
    autoservicio: false,
  },
  {
    orden: 4,
    nombre: "tematicos",
    titulo: "Ejercicios temáticos",
    descripcion:
      "Biblioteca de ejercicios cortos clasificados por tema y categoría, para practicar suelto.",
    acento: "bg-bloque4",
    borde: "hover:border-bloque4",
    autoservicio: true,
  },
];

export function bloquePorNombre(nombre: string): BloquePreparacion | null {
  return BLOQUES.find((b) => b.nombre === nombre) ?? null;
}

export function bloquePorOrden(orden: number): BloquePreparacion | null {
  return BLOQUES.find((b) => b.orden === orden) ?? null;
}
```

- [ ] **Step 4: Ejecutarlo y ver que pasa**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: siete OK y `Todo en orden.`

- [ ] **Step 5: Quitar la constante duplicada de la página**

En `app/(app)/preparacion/page.tsx`, borrar el bloque `const BLOQUES = [...]` entero y añadir el import:

```tsx
import { BLOQUES } from "@/lib/preparacion";
```

El resto de la página no cambia en esta tarea: sigue usando `bloque.orden`, `bloque.titulo`, `bloque.descripcion`, `bloque.acento` y `bloque.borde`, que son los mismos nombres.

- [ ] **Step 6: Comprobar que la página sigue en pie**

Run: `npx tsc --noEmit && npm run lint`
Expected: las dos en 0.

- [ ] **Step 7: Commit**

```bash
git add lib/preparacion.ts scripts/verificar-preparacion.ts "app/(app)/preparacion/page.tsx"
git commit -m "Los cuatro bloques de preparación, en un módulo que pueden mirar dos páginas"
```

---

### Task 2: El número de examen, y que el bloque se elija

Dos arreglos en el modelo que el catálogo necesita: un campo para saber **qué examen** es cada secuencia, y que `orden` deje de autoincrementarse en las de preparación, donde significa el bloque. Hoy toda secuencia de preparación creada desde el formulario nace con `orden` 5, 6, 7… y no aparece en ningún bloque de la portada.

**Files:**
- Modify: `prisma/schema.prisma` (campo `examen` en `Recorrido`)
- Create: `prisma/migrations/<timestamp>_examen_del_recorrido/migration.sql` (la genera Prisma)
- Modify: `lib/acciones.ts:375-412` (`crearSecuencia`)
- Modify: `app/(app)/profe/secuencias/nueva/eleccion-dele.tsx` (dos campos nuevos)
- Modify: `scripts/verificar-preparacion.ts`

**Interfaces:**
- Consumes: `BLOQUES` y `bloquePorOrden` de la Task 1.
- Produces:
  - la columna `Recorrido.examen` (`Int?`)
  - `function bloquePedido(valor: FormDataEntryValue | null): number` en `lib/preparacion.ts`
  - `function examenPedido(valor: FormDataEntryValue | null): number | null` en `lib/preparacion.ts`
  - el contrato del formulario: `crearSecuencia` lee `bloque` (entero de 1 a 4) y `examen` (entero, o vacío).

**Nota para quien implemente:** las afirmaciones no llaman a `crearSecuencia`. Esa acción empieza por `exigirProfesor()`, que llama a `auth()` de Clerk, y fuera de una petición eso revienta. Por eso la decisión se saca a dos funciones puras y son ellas las que se verifican; la acción queda como una línea que las llama.

- [ ] **Step 1: Escribir las afirmaciones que fallan**

Añadir a `scripts/verificar-preparacion.ts`, antes del `console.log` final, con el import ampliado a `import { BLOQUES, bloquePedido, bloquePorNombre, bloquePorOrden, examenPedido } from "@/lib/preparacion";` y `import { prisma } from "@/lib/prisma";`:

```ts
  // ─── El bloque se elige, no se autoincrementa ──────────────────────────
  afirmar(bloquePedido("2") === 2, "el bloque pedido se respeta");
  afirmar(bloquePedido("3") === 3, "también el examen blanco, que lo crea el profe");
  afirmar(bloquePedido("9") === 2, "un bloque que no existe cae en la práctica (2)");
  afirmar(bloquePedido(null) === 2, "sin bloque, la práctica (2)");
  afirmar(bloquePedido("dos") === 2, "un bloque que no es un número, la práctica (2)");

  afirmar(examenPedido("3") === 3, "el número de examen se guarda");
  afirmar(examenPedido("") === null, "sin número de examen, nulo");
  afirmar(examenPedido(null) === null, "sin campo, nulo");
  afirmar(examenPedido("0") === null, "el examen cero no existe: nulo");
  afirmar(examenPedido("-2") === null, "un examen negativo: nulo");
  afirmar(examenPedido("dos") === null, "un examen que no es un número: nulo");
  afirmar(examenPedido("2.5") === null, "un examen con decimales: nulo");

  // Y que la columna existe de verdad, que es lo que la migración añade.
  const conExamen = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · con examen`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      destreza: "CE",
      orden: 2,
      examen: 3,
    },
    select: { id: true, orden: true, examen: true },
  });
  creados.recorridos.push(conExamen.id);
  afirmar(conExamen.examen === 3, `la columna examen guarda el 3 (es ${conExamen.examen})`);
```

Y arriba del `main`, la marca y el registro de lo creado, con su limpieza:

```ts
// Una marca por proceso para reconocer lo que crea esta pasada y poder
// limpiarlo desde el `.finally()` aunque una afirmación reviente a mitad.
const marca = `verificar-preparacion-${process.pid}`;
const creados = { recorridos: [] as string[], usuarios: [] as string[], grupos: [] as string[] };
```

Sustituir el cierre `main().then(() => process.exit(0));` por:

```ts
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    async function intentar(que: string, tarea: () => Promise<unknown>) {
      try {
        await tarea();
      } catch (e) {
        fallos++;
        console.error(`limpieza · ${que}: ${e instanceof Error ? e.message : e}`);
      }
    }

    // El orden importa: primero lo que apunta al recorrido, luego el recorrido.
    for (const id of creados.recorridos) {
      await intentar("asignaciones", () => prisma.asignacion.deleteMany({ where: { recorridoId: id } }));
      await intentar("pasos", () => prisma.paso.deleteMany({ where: { recorridoId: id } }));
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    for (const id of creados.grupos) {
      await intentar("miembros", () => prisma.miembroGrupo.deleteMany({ where: { grupoId: id } }));
      await intentar("grupo", () => prisma.grupo.delete({ where: { id } }));
    }
    for (const id of creados.usuarios) {
      await intentar("usuario", () => prisma.user.delete({ where: { id } }));
    }

    await intentar("desconectar", () => prisma.$disconnect());

    if (fallos > 0) {
      console.error(`\nLa limpieza falló en ${fallos} paso(s): puede haber quedado basura en la base.`);
      process.exitCode = 1;
    }
  });
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: falla al compilar, porque `examen` no existe en el `select` de Prisma (`Object literal may only specify known properties`).

- [ ] **Step 3: Añadir el campo al esquema y migrar**

En `prisma/schema.prisma`, dentro de `model Recorrido`, debajo de `destreza`:

```prisma
  /// Qué examen del Instituto Cervantes es (1-7). Nulo en las clases
  /// particulares y en los bloques que no van por examen. Vive aquí y no en el
  /// título porque el catálogo agrupa y ordena por él, y ordenar por título
  /// pone el 10 antes que el 2.
  examen       Int?
```

Run: `npx prisma migrate dev --name examen_del_recorrido`
Expected: crea `prisma/migrations/<timestamp>_examen_del_recorrido/migration.sql` con un `ALTER TABLE "Recorrido" ADD COLUMN "examen" INTEGER;` y regenera el cliente.

- [ ] **Step 4: Las dos funciones puras**

Añadir al final de `lib/preparacion.ts`:

```ts
/**
 * El bloque que pide el formulario de secuencia nueva.
 *
 * Cae en la práctica (2) ante cualquier cosa rara —campo ausente, texto, un
 * número que no es de ningún bloque— en vez de rechazar la ficha entera: es
 * dónde aparece en una portada, no una regla de negocio, y el profesor lo
 * cambia en dos clics si se equivoca.
 */
export function bloquePedido(valor: FormDataEntryValue | null): number {
  const n = Number(valor);
  return bloquePorOrden(n) ? n : 2;
}

/**
 * El número de examen que pide el formulario. Nulo si no lo hay o no es un
 * entero positivo: el catálogo agrupa por él, y un 0 o un -2 harían un grupo
 * «Examen 0» que no existe en ningún cuadernillo.
 */
export function examenPedido(valor: FormDataEntryValue | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}
```

- [ ] **Step 5: Que `crearSecuencia` las use**

En `lib/acciones.ts`, dentro de `crearSecuencia`, sustituir el cálculo de `ultimo`/`orden` por esto:

```ts
  // En una secuencia de preparación, `orden` no es la posición en una lista:
  // es el bloque de `/preparacion` al que pertenece, y lo elige el profesor.
  // Autoincrementarlo aquí las hacía nacer en el 5, 6, 7… y no aparecían en
  // ningún bloque de la portada. En las clases particulares sigue
  // autoincrementándose, que es lo que siempre significó.
  let orden: number;
  if (tipo === "PREPARACION_DELE") {
    orden = bloquePedido(formData.get("bloque"));
  } else {
    const ultimo = await prisma.recorrido.aggregate({
      where: { tipo },
      _max: { orden: true },
    });
    orden = (ultimo._max.orden ?? 0) + 1;
  }

  // El número de examen solo tiene sentido en una preparación.
  const examen =
    tipo === "PREPARACION_DELE" ? examenPedido(formData.get("examen")) : null;
```

Añadir `examen` al `data` del `prisma.recorrido.create` que va justo debajo, y el import arriba del archivo:

```ts
import { bloquePedido, examenPedido } from "@/lib/preparacion";
```

```ts
  const secuencia = await prisma.recorrido.create({
    data: {
      titulo,
      descripcion,
      nivel,
      tipo,
      destreza,
      examen,
      orden,
      autorId: profesor.id,
    },
  });
```

- [ ] **Step 6: Ejecutar el verificador**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: pasa, incluidas las dos afirmaciones nuevas.

- [ ] **Step 7: Los dos campos en el formulario**

En `app/(app)/profe/secuencias/nueva/eleccion-dele.tsx`, dentro del bloque `{tipo === "PREPARACION_DELE" && (…)}`, justo después del `<label>` de la prueba, añadir:

```tsx
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-tinta">
              Bloque de la preparación
              <select name="bloque" defaultValue="2" className={campo}>
                {BLOQUES.map((b) => (
                  <option key={b.orden} value={b.orden}>
                    {b.orden} · {b.titulo}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-tinta-suave">
                Dónde aparece en la portada del alumno.
              </span>
            </label>

            <label className="block text-sm font-semibold text-tinta">
              Examen
              <input
                type="number"
                name="examen"
                min={1}
                placeholder="1"
                className={campo}
              />
              <span className="mt-1 block text-xs font-normal text-tinta-suave">
                El número del examen del Cervantes. Déjalo vacío si esta
                secuencia no es de un examen concreto.
              </span>
            </label>
          </div>
```

Envolver el `<>…</>` requiere el import arriba del archivo:

```tsx
import { BLOQUES } from "@/lib/preparacion";
```

- [ ] **Step 8: Comprobar tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: las dos en 0.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/acciones.ts "app/(app)/profe/secuencias/nueva/eleccion-dele.tsx" scripts/verificar-preparacion.ts
git commit -m "Qué examen es, y que el bloque de una preparación se elija en vez de contarse"
```

---

### Task 3: El catálogo de un bloque, con su estado

Una consulta que devuelve las tarjetas de un bloque: los recorridos publicados, ordenados por examen y prueba, cada uno con en qué punto está ese alumno. Una consulta por página, no una por tarjeta.

**Files:**
- Create: `lib/catalogo-preparacion.ts`
- Modify: `scripts/verificar-preparacion.ts`

**Interfaces:**
- Consumes: `BloquePreparacion` y `bloquePorOrden` de la Task 1; la columna `examen` de la Task 2.
- Produces:
  - `type EstadoTarjeta = { clase: "SIN_EMPEZAR" } | { clase: "A_MEDIAS"; hechos: number; total: number } | { clase: "ENTREGADO"; total: number } | { clase: "REVISADO"; puntos: number }`
  - `type Tarjeta = { recorridoId: string; titulo: string; nivel: Nivel; destreza: Destreza | null; examen: number | null; pasos: number; estado: EstadoTarjeta }`
  - `function estadoDeAsignacion(pasos: number, completados: { verificadoEl: Date | null; puntos: number | null }[]): EstadoTarjeta`
  - `async function catalogoDeBloque(orden: number, estudianteId: string | null): Promise<Tarjeta[]>`

- [ ] **Step 1: Escribir las afirmaciones que fallan**

Añadir a `scripts/verificar-preparacion.ts` (y el import `import { catalogoDeBloque, estadoDeAsignacion } from "@/lib/catalogo-preparacion";`):

```ts
  // ─── El resumen de estado, sin tocar la base ───────────────────────────
  afirmar(
    estadoDeAsignacion(4, []).clase === "SIN_EMPEZAR",
    "sin pasos hechos, la tarjeta está sin empezar",
  );
  const aMedias = estadoDeAsignacion(4, [
    { verificadoEl: null, puntos: null },
    { verificadoEl: null, puntos: null },
  ]);
  afirmar(
    aMedias.clase === "A_MEDIAS" && aMedias.hechos === 2 && aMedias.total === 4,
    "dos pasos de cuatro son «a medias, 2 de 4»",
  );
  afirmar(
    estadoDeAsignacion(2, [
      { verificadoEl: null, puntos: null },
      { verificadoEl: null, puntos: null },
    ]).clase === "ENTREGADO",
    "todos los pasos entregados y ninguno revisado es «entregado»",
  );
  const revisado = estadoDeAsignacion(2, [
    { verificadoEl: new Date(), puntos: 12 },
    { verificadoEl: new Date(), puntos: 9 },
  ]);
  afirmar(
    revisado.clase === "REVISADO" && revisado.puntos === 21,
    "con todo revisado se suman los puntos (son 21)",
  );
  // Un paso revisado y otro sin entregar sigue siendo «a medias»: enseñar
  // «revisado» ahí le diría al alumno que ha terminado cuando no lo ha hecho.
  afirmar(
    estadoDeAsignacion(3, [{ verificadoEl: new Date(), puntos: 8 }]).clase === "A_MEDIAS",
    "un paso revisado de tres sigue siendo «a medias»",
  );

  // ─── El catálogo ───────────────────────────────────────────────────────
  const borrador = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · borrador`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      destreza: "CO",
      orden: 2,
      examen: 1,
      publicado: false,
    },
    select: { id: true },
  });
  creados.recorridos.push(borrador.id);

  const publicado = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · publicado`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      destreza: "CE",
      orden: 2,
      examen: 1,
      publicado: true,
      pasos: {
        create: [
          { orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Tarea 1" },
          { orden: 2, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Tarea 2" },
        ],
      },
    },
    select: { id: true },
  });
  creados.recorridos.push(publicado.id);

  const catalogo = await catalogoDeBloque(2, null);
  const mios = catalogo.filter((t) => t.titulo.startsWith(marca));
  afirmar(mios.length === 1, `el catálogo trae solo lo publicado (trae ${mios.length})`);
  afirmar(mios[0].recorridoId === publicado.id, "y es el publicado, no el borrador");
  afirmar(mios[0].pasos === 2, "la tarjeta sabe cuántos pasos tiene");
  afirmar(mios[0].estado.clase === "SIN_EMPEZAR", "sin alumno, la tarjeta está sin empezar");

  const vacio = await catalogoDeBloque(3, null);
  afirmar(
    !vacio.some((t) => t.titulo.startsWith(marca)),
    "lo del bloque 2 no sale en el bloque 3",
  );
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: FALLA con `Cannot find module '@/lib/catalogo-preparacion'`.

- [ ] **Step 3: Escribir el catálogo**

Crear `lib/catalogo-preparacion.ts`:

```ts
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Las tarjetas de un bloque de `/preparacion` y en qué punto está el alumno.
 *
 * Solo de servidor: importa `prisma`. La tabla de bloques vive aparte, en
 * `lib/preparacion.ts`, que es pura y la puede mirar también el cliente.
 */

export type EstadoTarjeta =
  | { clase: "SIN_EMPEZAR" }
  | { clase: "A_MEDIAS"; hechos: number; total: number }
  | { clase: "ENTREGADO"; total: number }
  | { clase: "REVISADO"; puntos: number };

export type Tarjeta = {
  recorridoId: string;
  titulo: string;
  nivel: Nivel;
  destreza: Destreza | null;
  examen: number | null;
  pasos: number;
  estado: EstadoTarjeta;
};

/**
 * En qué punto está una asignación, a partir de sus pasos completados.
 *
 * «Revisado» pide que estén **todos** revisados. Con uno revisado y otro sin
 * entregar sigue siendo «a medias»: decirle «revisado» al alumno cuando le
 * queda media prueba es decirle que ha terminado.
 */
export function estadoDeAsignacion(
  pasos: number,
  completados: { verificadoEl: Date | null; puntos: number | null }[],
): EstadoTarjeta {
  if (completados.length === 0) return { clase: "SIN_EMPEZAR" };
  if (completados.length < pasos) {
    return { clase: "A_MEDIAS", hechos: completados.length, total: pasos };
  }
  if (completados.every((c) => c.verificadoEl !== null)) {
    return {
      clase: "REVISADO",
      puntos: completados.reduce((suma, c) => suma + (c.puntos ?? 0), 0),
    };
  }
  return { clase: "ENTREGADO", total: pasos };
}

/**
 * Las tarjetas de un bloque.
 *
 * Dos consultas y no una por tarjeta: con siete exámenes de cuatro pruebas, el
 * bloque 2 tiene veintiocho secuencias, y una consulta de estado por tarjeta
 * son veintiocho viajes a la base para pintar una lista.
 */
export async function catalogoDeBloque(
  orden: number,
  estudianteId: string | null,
): Promise<Tarjeta[]> {
  const recorridos = await prisma.recorrido.findMany({
    where: { tipo: "PREPARACION_DELE", orden, publicado: true },
    select: {
      id: true,
      titulo: true,
      nivel: true,
      destreza: true,
      examen: true,
      _count: { select: { pasos: true } },
    },
    // Por examen y prueba, no por título: con diez exámenes, el título pone el
    // 10 antes que el 2. Las que no son de un examen concreto van al final.
    orderBy: [{ examen: "asc" }, { destreza: "asc" }, { titulo: "asc" }],
  });

  const porRecorrido = new Map<string, { verificadoEl: Date | null; puntos: number | null }[]>();
  if (estudianteId && recorridos.length > 0) {
    const asignaciones = await prisma.asignacion.findMany({
      where: {
        estudianteId,
        archivada: false,
        recorridoId: { in: recorridos.map((r) => r.id) },
      },
      select: {
        recorridoId: true,
        completados: { select: { verificadoEl: true, puntos: true } },
      },
    });
    for (const a of asignaciones) porRecorrido.set(a.recorridoId, a.completados);
  }

  return recorridos.map((r) => ({
    recorridoId: r.id,
    titulo: r.titulo,
    nivel: r.nivel,
    destreza: r.destreza,
    examen: r.examen,
    pasos: r._count.pasos,
    estado: estadoDeAsignacion(r._count.pasos, porRecorrido.get(r.id) ?? []),
  }));
}
```

- [ ] **Step 4: Ejecutar el verificador**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: pasa, con las diez afirmaciones nuevas en verde.

- [ ] **Step 5: Comprobar tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: las dos en 0.

- [ ] **Step 6: Commit**

```bash
git add lib/catalogo-preparacion.ts scripts/verificar-preparacion.ts
git commit -m "El catálogo de un bloque, con el estado de cada examen en una sola consulta"
```

---

### Task 4: La puerta — empezar una práctica

La única escritura de todo esto. Se parte en dos: la lógica, que se puede verificar sin sesión de Clerk, y la acción de servidor, que es la cáscara que la llama.

**Files:**
- Create: `lib/acciones-preparacion.ts`
- Modify: `lib/catalogo-preparacion.ts` (añadir `profesorDelEstudiante` y `abrirPractica`)
- Modify: `scripts/verificar-preparacion.ts`

**Interfaces:**
- Consumes: `bloquePorOrden` (Task 1), `catalogoDeBloque` (Task 3).
- Produces:
  - `async function profesorDelEstudiante(estudianteId: string): Promise<string | null>`
  - `async function abrirPractica(estudianteId: string, recorridoId: string): Promise<{ error: string } | { asignacionId: string }>`
  - `async function empezarPractica(formData: FormData): Promise<void>` (acción de servidor; redirige a `/recorridos/<id>`)

- [ ] **Step 1: Escribir las afirmaciones que fallan**

Añadir a `scripts/verificar-preparacion.ts` (import: `import { abrirPractica, profesorDelEstudiante } from "@/lib/catalogo-preparacion";`):

```ts
  // ─── La puerta ─────────────────────────────────────────────────────────
  const profe = await prisma.user.create({
    data: { email: `${marca}-profe@ejemplo.test`, role: "PROFESOR" },
    select: { id: true },
  });
  creados.usuarios.push(profe.id);

  const alumno = await prisma.user.create({
    data: { email: `${marca}-alumno@ejemplo.test`, role: "STUDENT" },
    select: { id: true },
  });
  creados.usuarios.push(alumno.id);

  const huerfano = await prisma.user.create({
    data: { email: `${marca}-huerfano@ejemplo.test`, role: "STUDENT" },
    select: { id: true },
  });
  creados.usuarios.push(huerfano.id);

  const grupo = await prisma.grupo.create({
    data: {
      nombre: `${marca} · grupo`,
      profesorId: profe.id,
      miembros: { create: [{ estudianteId: alumno.id }] },
    },
    select: { id: true },
  });
  creados.grupos.push(grupo.id);

  afirmar(
    (await profesorDelEstudiante(alumno.id)) === profe.id,
    "el profesor de un alumno sale de su grupo",
  );
  afirmar(
    (await profesorDelEstudiante(huerfano.id)) === null,
    "un alumno sin grupo no tiene profesor",
  );

  const blanco = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · examen blanco`,
      nivel: "B1",
      tipo: "PREPARACION_DELE",
      orden: 3,
      publicado: true,
    },
    select: { id: true },
  });
  creados.recorridos.push(blanco.id);

  const rechazoBorrador = await abrirPractica(alumno.id, borrador.id);
  afirmar(
    "error" in rechazoBorrador,
    `un borrador no se puede empezar (dijo: ${JSON.stringify(rechazoBorrador)})`,
  );

  const rechazoBlanco = await abrirPractica(alumno.id, blanco.id);
  afirmar(
    "error" in rechazoBlanco,
    "un examen blanco no se puede empezar aunque se escriba su id a mano",
  );

  const rechazoSinGrupo = await abrirPractica(huerfano.id, publicado.id);
  afirmar("error" in rechazoSinGrupo, "un alumno sin grupo recibe el motivo");
  afirmar(
    (await prisma.asignacion.count({ where: { estudianteId: huerfano.id } })) === 0,
    "y no se le crea ninguna asignación",
  );

  const abierta = await abrirPractica(alumno.id, publicado.id);
  afirmar("asignacionId" in abierta, "un alumno con grupo sí puede empezar");
  const asignacion = await prisma.asignacion.findFirstOrThrow({
    where: { estudianteId: alumno.id, recorridoId: publicado.id },
    select: { id: true, profesorId: true, archivada: true },
  });
  afirmar(
    asignacion.profesorId === profe.id,
    "la asignación nace con el profesor de su grupo",
  );

  // Si ya la tenía, empezar otra vez no toca nada. Es lo que separa esta
  // puerta de `asignarA`, cuyo upsert desarchivaría y reescribiría el dueño.
  await prisma.asignacion.update({
    where: { id: asignacion.id },
    data: { archivada: true, profesorId: huerfano.id },
  });
  const segunda = await abrirPractica(alumno.id, publicado.id);
  afirmar("asignacionId" in segunda, "empezar dos veces no da error, lleva a la suya");
  const despues = await prisma.asignacion.findUniqueOrThrow({
    where: { id: asignacion.id },
    select: { archivada: true, profesorId: true },
  });
  afirmar(despues.archivada === true, "no desarchiva la que su profe archivó");
  afirmar(despues.profesorId === huerfano.id, "ni le cambia el dueño a la entrega");
  afirmar(
    (await prisma.asignacion.count({ where: { estudianteId: alumno.id, recorridoId: publicado.id } })) === 1,
    "y no crea una segunda",
  );

  // Un grupo archivado cuenta como no tener grupo: su profesor ya no responde
  // por ese alumno.
  await prisma.grupo.update({ where: { id: grupo.id }, data: { archivado: true } });
  afirmar(
    (await profesorDelEstudiante(alumno.id)) === null,
    "con el grupo archivado, el alumno se queda sin profesor",
  );
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: FALLA en el import, `'"@/lib/catalogo-preparacion"' has no exported member 'abrirPractica'`.

- [ ] **Step 3: Escribir la lógica**

Añadir al final de `lib/catalogo-preparacion.ts`:

```ts
import { bloquePorOrden } from "@/lib/preparacion";

/**
 * El profesor que responde por este alumno: el de su grupo.
 *
 * Un alumno no tiene «su profesor» guardado en ninguna parte; se deduce del
 * grupo, que es el único vínculo real que existe hoy. Con varios grupos
 * activos se toma aquel en el que entró más tarde: es un desempate arbitrario
 * y por eso se escribe aquí, en vez de dejarlo al orden que devuelva la base.
 *
 * Un grupo archivado no cuenta: su profesor ya no responde por ese alumno.
 */
export async function profesorDelEstudiante(estudianteId: string): Promise<string | null> {
  const membresia = await prisma.miembroGrupo.findFirst({
    where: { estudianteId, grupo: { archivado: false } },
    orderBy: { createdAt: "desc" },
    select: { grupo: { select: { profesorId: true } } },
  });
  return membresia?.grupo.profesorId ?? null;
}

/**
 * Abre una práctica a un alumno: comprueba y crea la asignación, o dice por
 * qué no.
 *
 * Si ya tenía asignación de ese recorrido **no se toca nada** y se devuelve la
 * suya. No se reutiliza `asignarA` (`lib/acciones.ts`), cuyo `upsert` pone
 * `archivada: false` y reescribe el `profesorId`: por esa vía un alumno
 * resucitaría una asignación que su profe archivó, o le cambiaría el dueño a su
 * propia entrega. Esta puerta crea, o no hace nada.
 */
export async function abrirPractica(
  estudianteId: string,
  recorridoId: string,
): Promise<{ error: string } | { asignacionId: string }> {
  const recorrido = await prisma.recorrido.findUnique({
    where: { id: recorridoId },
    select: { tipo: true, orden: true, publicado: true },
  });
  if (!recorrido || recorrido.tipo !== "PREPARACION_DELE") {
    return { error: "Esa secuencia no es de preparación al DELE." };
  }
  if (!recorrido.publicado) {
    return { error: "Esta secuencia todavía es un borrador." };
  }

  const bloque = bloquePorOrden(recorrido.orden);
  if (!bloque || !bloque.autoservicio) {
    return { error: "Este examen lo abre tu profesor." };
  }

  const yaLaTiene = await prisma.asignacion.findUnique({
    where: { estudianteId_recorridoId: { estudianteId, recorridoId } },
    select: { id: true },
  });
  if (yaLaTiene) return { asignacionId: yaLaTiene.id };

  const profesorId = await profesorDelEstudiante(estudianteId);
  if (!profesorId) {
    return { error: "Habla con tu profe para que te dé un grupo." };
  }

  const nueva = await prisma.asignacion.create({
    data: { estudianteId, recorridoId, profesorId },
    select: { id: true },
  });
  return { asignacionId: nueva.id };
}
```

- [ ] **Step 4: Ejecutar el verificador**

Run: `npx tsx scripts/verificar-preparacion.ts`
Expected: pasa, con las trece afirmaciones nuevas en verde.

- [ ] **Step 5: Escribir la acción de servidor**

Crear `lib/acciones-preparacion.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { abrirPractica } from "@/lib/catalogo-preparacion";
import { getUsuarioActual } from "@/lib/usuario";

/**
 * Gemelo de `exigirProfesor` un escalón por debajo, para el otro lado de la
 * casa. Del bloqueo no se ocupa: `getUsuarioActual` ya devuelve `null` para un
 * usuario bloqueado, así que un bloqueado cae por el mismo sitio que uno sin
 * sesión.
 */
async function exigirEstudiante() {
  const usuario = await getUsuarioActual();
  if (!usuario) throw new Error("Hay que entrar para empezar una práctica.");
  return usuario;
}

/**
 * El alumno se abre una práctica. Toda la decisión vive en `abrirPractica`,
 * que se puede verificar sin sesión; esto es la cáscara que la llama.
 */
export async function empezarPractica(formData: FormData) {
  const usuario = await exigirEstudiante();
  const recorridoId = String(formData.get("recorridoId") ?? "");
  if (!recorridoId) return;

  const resultado = await abrirPractica(usuario.id, recorridoId);

  // El motivo no se enseña desde aquí: la tarjeta ya lo sabe antes de pintar el
  // botón. Si se llega hasta aquí con un motivo, es que alguien ha mandado el
  // formulario a mano, y entonces lo que toca es parar.
  if ("error" in resultado) throw new Error(resultado.error);

  revalidatePath("/preparacion");
  revalidatePath("/dashboard");
  redirect(`/recorridos/${recorridoId}`);
}
```

- [ ] **Step 6: Comprobar tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: las dos en 0.

- [ ] **Step 7: Commit**

```bash
git add lib/catalogo-preparacion.ts lib/acciones-preparacion.ts scripts/verificar-preparacion.ts
git commit -m "La puerta del alumno: crea su asignación, o dice por qué no"
```

---

### Task 5: Las pantallas

El escalón nuevo y el arreglo de la portada. La página de un bloque lista sus exámenes agrupados; la portada deja de enlazar recorridos sueltos y pasa a enlazar bloques, filtrando además lo que no está publicado.

**Files:**
- Create: `app/(app)/preparacion/[bloque]/page.tsx`
- Create: `app/(app)/preparacion/[bloque]/tarjeta-examen.tsx`
- Modify: `app/(app)/preparacion/page.tsx`

**Interfaces:**
- Consumes: `BLOQUES`, `bloquePorNombre` (Task 1); `catalogoDeBloque`, `profesorDelEstudiante`, `Tarjeta` (Tasks 3 y 4); `empezarPractica` (Task 4).
- Produces: las rutas `/preparacion` y `/preparacion/<nombre>`.

- [ ] **Step 1: La tarjeta**

Crear `app/(app)/preparacion/[bloque]/tarjeta-examen.tsx`:

```tsx
import Link from "next/link";
import { empezarPractica } from "@/lib/acciones-preparacion";
import type { Tarjeta } from "@/lib/catalogo-preparacion";

const NOMBRE_PRUEBA: Record<string, string> = {
  CO: "Comprensión auditiva",
  CE: "Comprensión de lectura",
  EE: "Expresión escrita",
  EO: "Expresión oral",
  EEI: "Expresión e interacción escritas",
  EOI: "Expresión e interacción orales",
};

function textoDelEstado(estado: Tarjeta["estado"]): string {
  if (estado.clase === "A_MEDIAS") {
    return `A medias · ${estado.hechos} de ${estado.total} tareas`;
  }
  if (estado.clase === "ENTREGADO") return "Entregado · esperando corrección";
  if (estado.clase === "REVISADO") return `Revisado · ${estado.puntos} puntos`;
  return "Sin empezar";
}

/**
 * Un examen del catálogo.
 *
 * `motivo` llega ya resuelto por la página: es la razón por la que este alumno
 * no puede abrirlo (sin grupo, o es un examen blanco). Con motivo no se pinta
 * botón, se pinta la razón: un botón que solo sirve para dar un error no es un
 * botón.
 */
export default function TarjetaExamen({
  tarjeta,
  motivo,
}: {
  tarjeta: Tarjeta;
  motivo: string | null;
}) {
  const empezada = tarjeta.estado.clase !== "SIN_EMPEZAR";

  return (
    <article className="flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-tinta">
          {tarjeta.destreza
            ? (NOMBRE_PRUEBA[tarjeta.destreza] ?? tarjeta.destreza)
            : tarjeta.titulo}
        </h3>
        <p className="mt-1 text-sm text-tinta-suave">
          {tarjeta.pasos} {tarjeta.pasos === 1 ? "tarea" : "tareas"} ·{" "}
          {textoDelEstado(tarjeta.estado)}
        </p>
      </div>

      {empezada ? (
        <Link
          href={`/recorridos/${tarjeta.recorridoId}`}
          className="rounded-full bg-hp-400 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-hp-500"
        >
          Seguir
        </Link>
      ) : motivo ? (
        <p className="rounded-full bg-fondo px-4 py-2 text-xs font-bold text-tinta-suave">
          {motivo}
        </p>
      ) : (
        <form action={empezarPractica}>
          <input type="hidden" name="recorridoId" value={tarjeta.recorridoId} />
          <button
            type="submit"
            className="rounded-full bg-hp-400 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-hp-500"
          >
            Empezar
          </button>
        </form>
      )}
    </article>
  );
}
```

- [ ] **Step 2: La página del bloque**

Crear `app/(app)/preparacion/[bloque]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogoDeBloque, profesorDelEstudiante } from "@/lib/catalogo-preparacion";
import { bloquePorNombre } from "@/lib/preparacion";
import { getUsuarioActual } from "@/lib/usuario";
import TarjetaExamen from "./tarjeta-examen";

export const dynamic = "force-dynamic";

export default async function BloquePage({
  params,
}: {
  params: Promise<{ bloque: string }>;
}) {
  const { bloque: nombre } = await params;
  const bloque = bloquePorNombre(nombre);
  if (!bloque) notFound();

  const usuario = await getUsuarioActual();
  const tarjetas = await catalogoDeBloque(bloque.orden, usuario?.id ?? null);

  // El motivo se resuelve una vez para toda la página: es el mismo para todas
  // las tarjetas y depende del alumno, no del examen.
  const tieneProfesor = usuario ? (await profesorDelEstudiante(usuario.id)) !== null : false;
  const motivo = !bloque.autoservicio
    ? "Este examen lo abre tu profesor"
    : !usuario
      ? "Entra para empezar"
      : tieneProfesor
        ? null
        : "Habla con tu profe para que te dé un grupo";

  // Agrupadas por examen, en el orden en que vienen del catálogo. Las que no
  // son de un examen concreto caen juntas al final.
  const porExamen = new Map<number | null, typeof tarjetas>();
  for (const t of tarjetas) {
    const lista = porExamen.get(t.examen) ?? [];
    lista.push(t);
    porExamen.set(t.examen, lista);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/preparacion"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Preparación DELE
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        Bloque {bloque.orden} · {bloque.titulo}
      </h1>
      <p className="mt-2 text-tinta-suave">{bloque.descripcion}</p>

      {tarjetas.length === 0 ? (
        <p className="mt-10 rounded-tarjeta border border-hp-100 bg-white p-6 text-sm text-tinta-suave shadow-suave">
          {bloque.autoservicio
            ? "Todavía no hay nada publicado en este bloque."
            : "Tu profe no te ha abierto ningún examen blanco todavía."}
        </p>
      ) : (
        <div className="mt-10 space-y-8">
          {[...porExamen.entries()].map(([examen, lista]) => (
            <section key={examen ?? "sueltos"}>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-tinta-suave">
                {examen === null ? "Sin examen concreto" : `Examen ${examen}`}
              </h2>
              <div className="mt-3 space-y-3">
                {lista.map((t) => (
                  <TarjetaExamen key={t.recorridoId} tarjeta={t} motivo={motivo} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: La portada, enlazando bloques**

En `app/(app)/preparacion/page.tsx`:

Sustituir la consulta por una que **filtre lo publicado** y solo cuente:

```tsx
  const disponibles = await prisma.recorrido.groupBy({
    by: ["orden"],
    where: { tipo: "PREPARACION_DELE", publicado: true },
    _count: { _all: true },
  });
```

Y dentro del `map`, sustituir el cálculo de `versiones`/`activo` y el bloque de enlaces por:

```tsx
          const cuantos =
            disponibles.find((d) => d.orden === bloque.orden)?._count._all ?? 0;
          const activo = cuantos > 0;
```

```tsx
                {activo ? (
                  <Link
                    href={`/preparacion/${bloque.nombre}`}
                    className="mt-4 inline-block rounded-full bg-hp-400 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-hp-500"
                  >
                    Ver los {cuantos}
                  </Link>
                ) : (
                  <p className="mt-4 inline-block rounded-full bg-fondo px-4 py-2 text-xs font-bold text-tinta-suave">
                    En preparación
                  </p>
                )}
```

Con eso sobra el mapa `nivelLabel` de esa página, que ya no se usa: borrarlo.

- [ ] **Step 4: Comprobar tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: las dos en 0. Si `eslint` se queja de una variable sin usar, es el `nivelLabel` que había que borrar.

- [ ] **Step 5: El viaje a mano**

Lo que ningún script ve. Arrancar con `npm run dev` y, con sesión de profesor:

1. `/preparacion` — los cuatro bloques. El 2 dice «Ver los N» con el número de secuencias publicadas; los vacíos siguen diciendo «En preparación».
2. `/preparacion/practica` — los exámenes agrupados por examen, con su prueba y su estado.
3. `/preparacion/examen-blanco` — sin botón de empezar. Si no hay nada asignado, el aviso de pedírselo al profe.
4. `/preparacion/inventado` — 404.
5. Con la cuenta de estudiante (`ndo.lopez.ele@gmail.com`), en `/preparacion/practica`: pulsar «Empezar» en un examen sin empezar lleva a `/recorridos/<id>`; al volver, esa tarjeta dice «Seguir». Responder una tarea y volver: dice «A medias · 1 de 4 tareas».

Si algo falla, se corrige donde toque y se vuelve a empezar.

- [ ] **Step 6: La verificación completa, una última vez**

Run: `npx tsx scripts/verificar-preparacion.ts && npx tsx scripts/verificar-recursos.ts && npx tsc --noEmit && npm run lint`
Expected: todo pasa.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/preparacion"
git commit -m "El catálogo de un bloque, y una portada que enlaza bloques y no borradores"
```

---

## Lo que este plan no hace

- **Reintentos.** Un examen se hace una vez, como decidió el diseño.
- **Panel del alumno**: historial y evolución son otro proyecto.
- **Encadenar las cuatro pruebas** en un simulacro cronometrado.
- **Rellenar el campo `examen`** del material ya sembrado (mayo 2015 y modelo 0). Se hace desde la ficha de cada secuencia cuando el campo exista, o con un `UPDATE` de una línea; no es parte de este plan.
