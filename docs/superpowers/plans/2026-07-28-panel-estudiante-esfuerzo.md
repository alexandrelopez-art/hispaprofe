# Panel del estudiante: que vea su esfuerzo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar a la vista del estudiante los puntos que el profesor ya le otorga, y cerrar el agujero por el que desmarcar un paso borra esos puntos.

**Architecture:** Una capa de datos nueva (`lib/progreso.ts`) concentra las consultas de puntos y estado de paso, y expone la regla de "no se desmarca lo revisado" como función comprobable desde un script. Encima de ella, tres vistas de servidor: el panel del estudiante (partido en su propio archivo), la lista de pasos de una secuencia y la página de un paso.

**Tech Stack:** Next.js 16 (App Router, React Server Components), React 19, Prisma 7 con adaptador `@prisma/adapter-pg`, Tailwind CSS 4, Clerk para sesión, `tsx` para scripts.

**Diseño de referencia:** `docs/superpowers/specs/2026-07-28-panel-estudiante-esfuerzo-design.md`

## Global Constraints

- **Lee la documentación de Next antes de escribir código.** `AGENTS.md` del repo: esta versión de Next tiene cambios de API respecto a lo que puedas recordar. Los guides están en `node_modules/next/dist/docs/`.
- El cliente de Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos generados viven en `@/lib/generated/prisma/client`.
- Todas las páginas tocadas ya declaran `export const dynamic = "force-dynamic"`. No quitarlo.
- La interfaz va **en español, con tildes**. Los comentarios de código siguen el estilo del repo: español, frases cortas que explican el porqué, no el qué.
- Tokens de Tailwind del proyecto, no colores crudos: `hp-50…hp-700`, `sol-100…sol-400`, `bloque1`, `bloque2`, `bloque3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`.
- **No se toca el esquema de Prisma.** Cero migraciones en todo este plan.
- **No se modifica la vista del profesor.** En la Tarea 2 se mueve de archivo tal cual, sin cambiar una línea de su contenido.
- Los puntos son una hucha acumulativa: sin techo, sin nota, sin "X sobre Y".
- Un paso `REVISADO` con 0 puntos se muestra como "0 pts", no se oculta.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/progreso.ts` | **Crear.** Consultas de puntos y estado de paso, y la regla del desmarcado. | 1 |
| `lib/acciones.ts` | **Modificar** (`desmarcarPasoHecho`, ~línea 893). Delega la regla en `lib/progreso.ts`. | 1 |
| `scripts/verificar-puntos.ts` | **Crear.** Comprueba las tres reglas contra la base de desarrollo. | 1 |
| `app/(app)/dashboard/page.tsx` | **Reescribir.** Resuelve usuario, decide rol, delega. | 2 |
| `app/(app)/dashboard/panel-profesor.tsx` | **Crear.** La vista de profesor actual, movida sin cambios. | 2 |
| `app/(app)/dashboard/panel-estudiante.tsx` | **Crear.** Hucha, bandejas y secuencias. | 2, 3 |
| `app/(app)/recorridos/[id]/page.tsx` | **Modificar.** Marcas de estado en la lista de pasos. | 4 |
| `app/(app)/pasos/[pasoId]/page.tsx` | **Modificar.** Línea de estado y bloqueo del botón. | 5 |

---

### Task 1: Capa de datos, regla del desmarcado y su verificación

Es la base de todo lo demás y lo único con lógica de verdad. Se hace primero y se comprueba con un script antes de tocar ni un píxel.

**Files:**
- Create: `lib/progreso.ts`
- Create: `scripts/verificar-puntos.ts`
- Modify: `lib/acciones.ts` (función `desmarcarPasoHecho`, ~líneas 893-925)

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`. Modelos `PasoCompletado` (campos `asignacionId`, `pasoId`, `completadoEl`, `puntos`, `verificadoEl`), `Asignacion` (`estudianteId`, `archivada`), `Paso` (`titulo`, `recorridoId`), `Recorrido` (`titulo`).
- Produces, todo desde `@/lib/progreso`:
  - `type EstadoPaso = "PENDIENTE" | "ENTREGADO" | "REVISADO"`
  - `type PasoEnBandeja = { pasoId: string; pasoTitulo: string; recorridoId: string; recorridoTitulo: string; fecha: Date; puntos: number | null }`
  - `type ResumenEstudiante = { puntosTotales: number; pasosRevisados: number; esperandoRevision: PasoEnBandeja[]; revisadosRecientes: PasoEnBandeja[] }`
  - `resumenEstudiante(usuarioId: string): Promise<ResumenEstudiante>`
  - `estadoDePasos(asignacionId: string): Promise<Map<string, { estado: EstadoPaso; puntos: number | null }>>`
  - `desmarcarSiNoRevisado(asignacionId: string, pasoId: string): Promise<boolean>`

**Por qué la regla baja a `lib/progreso.ts`:** la acción `desmarcarPasoHecho` no se puede llamar desde un script — pide sesión de Clerk y contexto de petición de Next. Bajando la regla a una función de datos pura queda comprobable de verdad, y la acción se limita a delegar.

- [ ] **Step 1: Escribir el script de verificación (falla, todavía no existe nada)**

Crear `scripts/verificar-puntos.ts`:

```ts
/**
 * Verifica las reglas de puntos del estudiante contra la base de desarrollo.
 * Crea sus propios datos y los borra al terminar. Ejecutar con:
 *   npx tsx scripts/verificar-puntos.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { desmarcarSiNoRevisado, resumenEstudiante } from "@/lib/progreso";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) {
    console.error(`FALLO: ${mensaje}`);
    process.exit(1);
  }
  console.log(`OK: ${mensaje}`);
}

// Marca única para no chocar con datos reales ni con otra ejecución.
const marca = `verificar-puntos-${process.pid}`;

async function main() {
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: `Secuencia de prueba ${marca}`,
      nivel: "B2",
      orden: 999,
      autorId: profesor.id,
      pasos: {
        create: [
          { orden: 1, ciclo: 1, tipo: "ACTIVACION", titulo: "Paso revisado" },
          { orden: 2, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Paso solo entregado" },
        ],
      },
    },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });
  const [pasoRevisado, pasoEntregado] = recorrido.pasos;

  const asignacion = await prisma.asignacion.create({
    data: {
      estudianteId: estudiante.id,
      profesorId: profesor.id,
      recorridoId: recorrido.id,
    },
  });

  await prisma.pasoCompletado.create({
    data: {
      asignacionId: asignacion.id,
      pasoId: pasoRevisado.id,
      puntos: 40,
      verificadoEl: new Date(),
    },
  });
  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: pasoEntregado.id },
  });

  try {
    // 1. Un paso revisado sobrevive al desmarcado.
    const borroRevisado = await desmarcarSiNoRevisado(
      asignacion.id,
      pasoRevisado.id,
    );
    afirmar(borroRevisado === false, "desmarcar un paso revisado no borra nada");

    const sigue = await prisma.pasoCompletado.findUnique({
      where: {
        asignacionId_pasoId: {
          asignacionId: asignacion.id,
          pasoId: pasoRevisado.id,
        },
      },
      select: { puntos: true },
    });
    afirmar(sigue?.puntos === 40, "los puntos del paso revisado siguen ahí");

    // 2. La hucha suma lo mismo que las filas verificadas.
    const resumen = await resumenEstudiante(estudiante.id);
    afirmar(resumen.puntosTotales === 40, "la hucha suma 40 puntos");
    afirmar(resumen.pasosRevisados === 1, "cuenta un paso revisado");
    afirmar(
      resumen.esperandoRevision.length === 1,
      "una entrega esperando revisión",
    );
    afirmar(
      resumen.revisadosRecientes.length === 1,
      "un paso en la bandeja de revisados",
    );
    afirmar(
      resumen.revisadosRecientes[0].recorridoTitulo === recorrido.titulo,
      "la bandeja trae el título de la secuencia",
    );

    // 3. Un paso solo entregado sí se desmarca.
    const borroEntregado = await desmarcarSiNoRevisado(
      asignacion.id,
      pasoEntregado.id,
    );
    afirmar(borroEntregado === true, "desmarcar un paso solo entregado sí borra");

    const resumenFinal = await resumenEstudiante(estudiante.id);
    afirmar(
      resumenFinal.esperandoRevision.length === 0,
      "la bandeja de espera queda vacía",
    );
    afirmar(
      resumenFinal.puntosTotales === 40,
      "la hucha no cambia al desmarcar una entrega",
    );
  } finally {
    // Limpieza en orden inverso a las dependencias.
    await prisma.pasoCompletado.deleteMany({
      where: { asignacionId: asignacion.id },
    });
    await prisma.asignacion.deleteMany({ where: { recorridoId: recorrido.id } });
    await prisma.paso.deleteMany({ where: { recorridoId: recorrido.id } });
    await prisma.recorrido.delete({ where: { id: recorrido.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [profesor.id, estudiante.id] } },
    });
  }

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ejecutarlo y comprobar que falla**

Run: `npx tsx scripts/verificar-puntos.ts`
Expected: FAIL al resolver el import — `Cannot find module '@/lib/progreso'`.

- [ ] **Step 3: Crear `lib/progreso.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Estado de un paso desde el punto de vista del estudiante. El check lo
 * pone él (ENTREGADO); los puntos solo el profesor (REVISADO). Un paso
 * sin fila de PasoCompletado está PENDIENTE.
 */
export type EstadoPaso = "PENDIENTE" | "ENTREGADO" | "REVISADO";

export type PasoEnBandeja = {
  pasoId: string;
  pasoTitulo: string;
  recorridoId: string;
  recorridoTitulo: string;
  /** Fecha de revisión si la hay; si no, la de entrega. */
  fecha: Date;
  puntos: number | null;
};

export type ResumenEstudiante = {
  puntosTotales: number;
  pasosRevisados: number;
  esperandoRevision: PasoEnBandeja[];
  revisadosRecientes: PasoEnBandeja[];
};

const REVISADOS_RECIENTES = 5;

// `satisfies` y no una anotación de tipo: valida la forma sin ensanchar
// los literales, que es lo que Prisma necesita para inferir el resultado.
const seleccionBandeja = {
  pasoId: true,
  completadoEl: true,
  verificadoEl: true,
  puntos: true,
  paso: {
    select: {
      titulo: true,
      recorridoId: true,
      recorrido: { select: { titulo: true } },
    },
  },
} satisfies Prisma.PasoCompletadoSelect;

type FilaBandeja = {
  pasoId: string;
  completadoEl: Date;
  verificadoEl: Date | null;
  puntos: number | null;
  paso: {
    titulo: string;
    recorridoId: string;
    recorrido: { titulo: string };
  };
};

function aBandeja(fila: FilaBandeja): PasoEnBandeja {
  return {
    pasoId: fila.pasoId,
    pasoTitulo: fila.paso.titulo,
    recorridoId: fila.paso.recorridoId,
    recorridoTitulo: fila.paso.recorrido.titulo,
    fecha: fila.verificadoEl ?? fila.completadoEl,
    puntos: fila.puntos,
  };
}

/**
 * Todo lo que el panel del estudiante necesita saber de su esfuerzo.
 *
 * La hucha cuenta también las asignaciones archivadas: es el historial de
 * la persona, y archivar una secuencia no debe vaciarle el marcador. Las
 * dos bandejas, en cambio, solo miran asignaciones vivas: son trabajo de
 * ahora, no memoria.
 */
export async function resumenEstudiante(
  usuarioId: string,
): Promise<ResumenEstudiante> {
  const [totales, esperando, revisados] = await Promise.all([
    prisma.pasoCompletado.aggregate({
      where: {
        asignacion: { estudianteId: usuarioId },
        verificadoEl: { not: null },
      },
      _sum: { puntos: true },
      _count: { _all: true },
    }),
    prisma.pasoCompletado.findMany({
      where: {
        asignacion: { estudianteId: usuarioId, archivada: false },
        verificadoEl: null,
      },
      orderBy: { completadoEl: "desc" },
      select: seleccionBandeja,
    }),
    prisma.pasoCompletado.findMany({
      where: {
        asignacion: { estudianteId: usuarioId, archivada: false },
        verificadoEl: { not: null },
      },
      orderBy: { verificadoEl: "desc" },
      take: REVISADOS_RECIENTES,
      select: seleccionBandeja,
    }),
  ]);

  return {
    puntosTotales: totales._sum.puntos ?? 0,
    pasosRevisados: totales._count._all,
    esperandoRevision: esperando.map(aBandeja),
    revisadosRecientes: revisados.map(aBandeja),
  };
}

/**
 * Estado de cada paso de una asignación, indexado por pasoId. Los pasos
 * que no aparecen en el mapa están PENDIENTE.
 */
export async function estadoDePasos(
  asignacionId: string,
): Promise<Map<string, { estado: EstadoPaso; puntos: number | null }>> {
  const filas = await prisma.pasoCompletado.findMany({
    where: { asignacionId },
    select: { pasoId: true, verificadoEl: true, puntos: true },
  });

  return new Map(
    filas.map((fila) => [
      fila.pasoId,
      {
        estado: (fila.verificadoEl ? "REVISADO" : "ENTREGADO") as EstadoPaso,
        puntos: fila.puntos,
      },
    ]),
  );
}

/**
 * Quita el check de un paso, salvo que el profesor ya lo haya revisado.
 * La fila de PasoCompletado guarda los puntos y la fecha de verificación,
 * así que borrarla tras una corrección perdería el trabajo del profesor.
 * El filtro va dentro del propio delete para que no haya carrera entre
 * comprobar y borrar.
 *
 * Devuelve true si borró algo.
 */
export async function desmarcarSiNoRevisado(
  asignacionId: string,
  pasoId: string,
): Promise<boolean> {
  const { count } = await prisma.pasoCompletado.deleteMany({
    where: { asignacionId, pasoId, verificadoEl: null },
  });
  return count > 0;
}
```

- [ ] **Step 4: Ejecutar el script y comprobar que pasa**

Run: `npx tsx scripts/verificar-puntos.ts`
Expected: nueve líneas `OK:` y `Todas las verificaciones pasan.`

Si falla por `DATABASE_URL`, comprobar que el `.env` de la raíz la define; el script la carga con `dotenv/config` igual que `prisma.config.ts`.

- [ ] **Step 5: Enganchar la regla en la acción del servidor**

En `lib/acciones.ts`, añadir `desmarcarSiNoRevisado` a los imports de la cabecera:

```ts
import { desmarcarSiNoRevisado } from "@/lib/progreso";
```

Y en `desmarcarPasoHecho`, sustituir el borrado directo. Cambiar el comentario de la función y el bloque del `deleteMany`:

```ts
/** Desmarca un paso, salvo que el profesor ya lo haya revisado. */
export async function desmarcarPasoHecho(formData: FormData) {
```

```ts
  await prisma.pasoCompletado.deleteMany({
    where: { asignacionId: asignacion.id, pasoId },
  });
```

pasa a ser:

```ts
  await desmarcarSiNoRevisado(asignacion.id, pasoId);
```

El resto de la función (búsqueda del paso, de la asignación, y los tres `revalidatePath`) se queda igual.

- [ ] **Step 6: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/progreso.ts scripts/verificar-puntos.ts lib/acciones.ts
git commit -m "Capa de progreso del estudiante y protección de los puntos revisados"
```

---

### Task 2: Partir el dashboard en tres archivos

Sin ningún cambio de comportamiento. Es una mudanza: separar las dos páginas que hoy conviven en un `if`, para que la del estudiante pueda crecer en la Tarea 3.

**Files:**
- Modify: `app/(app)/dashboard/page.tsx` (reescritura completa, 233 → ~15 líneas)
- Create: `app/(app)/dashboard/panel-profesor.tsx`
- Create: `app/(app)/dashboard/panel-estudiante.tsx`

**Interfaces:**
- Consumes: `getUsuarioActual` de `@/lib/usuario`, `prisma` de `@/lib/prisma`.
- Produces:
  - `app/(app)/dashboard/panel-profesor.tsx` → `export default async function PanelProfesor({ usuario }: { usuario: Usuario })`
  - `app/(app)/dashboard/panel-estudiante.tsx` → `export default async function PanelEstudiante({ usuario }: { usuario: Usuario })`
  - En ambos, el tipo local: `type Usuario = { id: string; firstName: string | null; email: string }`

- [ ] **Step 1: Crear `panel-profesor.tsx` con el contenido actual de la rama del profesor**

Contenido íntegro del archivo nuevo:

```tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type Usuario = { id: string; firstName: string | null; email: string };

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

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

export default async function PanelProfesor({ usuario }: { usuario: Usuario }) {
  const saludo = `Hola, ${usuario.firstName ?? usuario.email}`;

  const [misSecuencias, totalSecuencias, estudiantes, grupos, asignaciones] =
    await Promise.all([
      prisma.recorrido.count({ where: { autorId: usuario.id } }),
      prisma.recorrido.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.grupo.count({ where: { profesorId: usuario.id, archivado: false } }),
      prisma.asignacion.findMany({
        where: { archivada: false },
        include: {
          estudiante: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          recorrido: {
            select: { titulo: true, _count: { select: { pasos: true } } },
          },
          _count: { select: { completados: true } },
        },
      }),
    ]);

  const pasosTotales = asignaciones.reduce(
    (suma, a) => suma + a.recorrido._count.pasos,
    0,
  );
  const pasosHechos = asignaciones.reduce(
    (suma, a) => suma + a._count.completados,
    0,
  );
  const progresoMedio =
    pasosTotales > 0 ? Math.round((pasosHechos / pasosTotales) * 100) : 0;

  const sinEmpezar = asignaciones.filter((a) => a._count.completados === 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        {saludo}
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Dato n={misSecuencias} etiqueta="Secuencias tuyas" />
        <Dato n={estudiantes} etiqueta="Estudiantes" />
        <Dato n={asignaciones.length} etiqueta="Asignaciones vivas" />
        <Dato n={`${progresoMedio}%`} etiqueta="Progreso medio" />
      </div>

      {misSecuencias === 0 && totalSecuencias > 0 && (
        <p className="mt-4 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          Hay {totalSecuencias} secuencias en la base, pero ninguna tiene autor
          asignado. Las sembradas antes de hoy se crearon sin ese campo.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/profe/secuencias/nueva"
          className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold leading-10 text-white transition-colors hover:bg-hp-500"
        >
          + Nueva secuencia
        </Link>
        <Link
          href="/profe/grupos"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold leading-9 text-hp-600 transition-colors hover:border-hp-400"
        >
          + Nuevo grupo ({grupos})
        </Link>
        <Link
          href="/profe/alumnos/nuevo"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold leading-9 text-hp-600 transition-colors hover:border-hp-400"
        >
          + Nuevo estudiante
        </Link>
        <Link
          href="/profe/importar"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold leading-9 text-hp-600 transition-colors hover:border-hp-400"
        >
          Importar resultados
        </Link>
      </div>

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Todavía no han empezado
      </h2>
      {sinEmpezar.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-8 text-center text-tinta-suave">
          {asignaciones.length === 0
            ? "No hay asignaciones vivas."
            : "Todos han empezado al menos una secuencia."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sinEmpezar.map((asignacion) => (
            <li
              key={asignacion.id}
              className="flex items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave"
            >
              <Link
                href={`/profe/alumnos/${asignacion.estudiante.id}`}
                className="truncate font-semibold text-tinta hover:text-hp-500"
              >
                {nombreDe(asignacion.estudiante)}
              </Link>
              <span className="ml-auto truncate text-sm text-tinta-suave">
                {asignacion.recorrido.titulo}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear `panel-estudiante.tsx` con el contenido actual de la rama del estudiante**

Mudanza literal. La hucha y las bandejas llegan en la Tarea 3.

```tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

type Usuario = { id: string; firstName: string | null; email: string };

const servicioLabel: Record<string, string> = {
  RECORRIDO: "Clases particulares",
  PREPARACION: "Preparación DELE",
};

export default async function PanelEstudiante({
  usuario,
}: {
  usuario: Usuario;
}) {
  const saludo = `Hola, ${usuario.firstName ?? usuario.email}`;

  const asignaciones = await prisma.asignacion.findMany({
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
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        {saludo}
      </h1>

      <h2 className="mt-10 text-lg font-bold text-tinta">Tus secuencias</h2>

      {asignaciones.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          Todavía no tienes secuencias asignadas. Tu profe te las asigna desde
          aquí.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {asignaciones.map((asignacion) => {
            const total = asignacion.recorrido._count.pasos;
            const hechos = asignacion._count.completados;
            const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;

            return (
              <li key={asignacion.id}>
                <Link
                  href={`/recorridos/${asignacion.recorrido.id}`}
                  className="block rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
                    {servicioLabel[asignacion.recorrido.tipo] ??
                      asignacion.recorrido.tipo}
                  </p>
                  <p className="mt-1 font-bold text-tinta">
                    {asignacion.recorrido.titulo}
                  </p>
                  {asignacion.nota && (
                    <p className="mt-1 text-sm text-tinta-suave">
                      {asignacion.nota}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-hp-50">
                      <div
                        className="h-full rounded-full bg-bloque2"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-bold text-tinta-suave">
                      {hechos}/{total}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Reescribir `page.tsx` para que solo enrute**

Sustituir todo el contenido de `app/(app)/dashboard/page.tsx` por:

```tsx
import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import PanelEstudiante from "./panel-estudiante";
import PanelProfesor from "./panel-profesor";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/");

  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";

  return esProfe ? (
    <PanelProfesor usuario={usuario} />
  ) : (
    <PanelEstudiante usuario={usuario} />
  );
}
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Comprobar a mano que nada cambió**

Run: `npm run dev`
Abrir `http://localhost:3000/dashboard` con la cuenta de profesor. Debe verse **exactamente** igual que antes: los cuatro recuadros, los cuatro botones y la lista de "Todavía no han empezado".

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/dashboard"
git commit -m "Partir el panel en vista de profesor y vista de estudiante"
```

---

### Task 3: La hucha y las bandejas

**Files:**
- Modify: `app/(app)/dashboard/panel-estudiante.tsx`

**Interfaces:**
- Consumes: `resumenEstudiante` de `@/lib/progreso` (Tarea 1), con los campos `puntosTotales`, `pasosRevisados`, `esperandoRevision[]`, `revisadosRecientes[]`; cada elemento de bandeja trae `pasoId`, `pasoTitulo`, `recorridoTitulo`, `fecha`, `puntos`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Añadir el import y la consulta del resumen**

En `panel-estudiante.tsx`, añadir a los imports:

```tsx
import { resumenEstudiante } from "@/lib/progreso";
```

Y sustituir la consulta suelta de asignaciones por las dos en paralelo:

```tsx
  const [resumen, asignaciones] = await Promise.all([
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
  ]);

  // Sin secuencias y sin puntos no hay nada que contar: se salta la hucha
  // para no recibir a alguien nuevo con un cero.
  const mostrarHucha = asignaciones.length > 0 || resumen.pasosRevisados > 0;
```

- [ ] **Step 2: Añadir el ayudante de fechas**

Justo debajo de `servicioLabel`, antes del componente:

```tsx
/** Distancia en palabras, sin librerías. Solo días completos. */
function haceCuanto(fecha: Date): string {
  const dias = Math.floor((Date.now() - fecha.getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  const semanas = Math.floor(dias / 7);
  if (semanas === 1) return "hace una semana";
  if (semanas < 5) return `hace ${semanas} semanas`;
  const meses = Math.max(1, Math.floor(dias / 30));
  return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
}
```

- [ ] **Step 3: Insertar la hucha y las bandejas en el JSX**

Entre el `<h1>` del saludo y el `<h2>Tus secuencias</h2>`, insertar:

```tsx
      {mostrarHucha && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          {resumen.pasosRevisados === 0 ? (
            <>
              <p className="text-lg font-bold text-tinta">
                Aún no tienes puntos.
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                Se ganan cuando tu profe revisa un paso.
              </p>
            </>
          ) : (
            <>
              <p className="text-5xl font-extrabold leading-none text-tinta">
                {resumen.puntosTotales}
                <span className="ml-2 text-lg font-bold text-tinta-suave">
                  puntos
                </span>
              </p>
              <p className="mt-2 text-sm text-tinta-suave">
                {resumen.pasosRevisados} paso
                {resumen.pasosRevisados !== 1 ? "s" : ""} revisado
                {resumen.pasosRevisados !== 1 ? "s" : ""} por tu profe
              </p>
            </>
          )}
        </section>
      )}

      {mostrarHucha && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
              Esperando revisión
            </h2>
            {resumen.esperandoRevision.length === 0 ? (
              <p className="mt-3 text-sm text-tinta-suave">
                No tienes nada pendiente de revisión.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {resumen.esperandoRevision.map((paso) => (
                  <li key={paso.pasoId}>
                    <Link
                      href={`/pasos/${paso.pasoId}`}
                      className="block rounded-xl bg-fondo px-3 py-2 transition hover:bg-hp-50"
                    >
                      <p className="truncate text-sm font-semibold text-tinta">
                        {paso.pasoTitulo}
                      </p>
                      <p className="truncate text-xs text-tinta-suave">
                        {paso.recorridoTitulo} · entregado{" "}
                        {haceCuanto(paso.fecha)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
              Tu profe ha revisado
            </h2>
            {resumen.revisadosRecientes.length === 0 ? (
              <p className="mt-3 text-sm text-tinta-suave">
                Todavía no hay nada revisado.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {resumen.revisadosRecientes.map((paso) => (
                  <li key={paso.pasoId}>
                    <Link
                      href={`/pasos/${paso.pasoId}`}
                      className="flex items-center gap-3 rounded-xl bg-fondo px-3 py-2 transition hover:bg-hp-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-tinta">
                          {paso.pasoTitulo}
                        </span>
                        <span className="block truncate text-xs text-tinta-suave">
                          {paso.recorridoTitulo} · {haceCuanto(paso.fecha)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-sol-300 px-2.5 py-0.5 text-xs font-extrabold text-tinta">
                        {paso.puntos ?? 0} pts
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Comprobar a mano el bucle completo**

Run: `npm run dev`

1. Con una cuenta de estudiante que tenga una secuencia asignada, marcar un paso como hecho.
2. En `/dashboard` de esa cuenta: aparece en "Esperando revisión", y la hucha dice "Aún no tienes puntos".
3. Con la cuenta de profesor, en `/profe/alumnos/<id>`, dar 40 puntos a ese paso.
4. Volver al panel del estudiante: la hucha marca 40, el paso salta a "Tu profe ha revisado" con "40 pts" y desaparece de la bandeja de espera.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/dashboard/panel-estudiante.tsx"
git commit -m "Panel del estudiante: hucha de puntos y bandejas de entregado y revisado"
```

---

### Task 4: Marcas de estado en la lista de pasos

**Files:**
- Modify: `app/(app)/recorridos/[id]/page.tsx`

**Interfaces:**
- Consumes: `estadoDePasos` y el tipo `EstadoPaso` de `@/lib/progreso` (Tarea 1). El mapa devuelto va de `pasoId` a `{ estado, puntos }`; los pasos ausentes están pendientes.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Importar la capa de progreso**

Añadir junto a los demás imports de la cabecera del archivo:

```tsx
import { estadoDePasos, type EstadoPaso } from "@/lib/progreso";
```

- [ ] **Step 2: Cargar la asignación del estudiante y sus estados**

Después del bloque que calcula `esProfe` y antes del `return`, añadir:

```tsx
  // La página ya carga datos cuando quien mira es profesor. Aquí se
  // atiende el otro caso: un estudiante con asignación viva ve marcado
  // su propio recorrido por la secuencia.
  const asignacionPropia =
    usuario && !esProfe
      ? await prisma.asignacion.findUnique({
          where: {
            estudianteId_recorridoId: {
              estudianteId: usuario.id,
              recorridoId: recorrido.id,
            },
          },
          select: { id: true, archivada: true },
        })
      : null;

  const estados =
    asignacionPropia && !asignacionPropia.archivada
      ? await estadoDePasos(asignacionPropia.id)
      : new Map<string, { estado: EstadoPaso; puntos: number | null }>();
```

- [ ] **Step 3: Marcar el círculo numerado y el título**

Dentro del `{pasos.map((paso) => (`, como primera línea del cuerpo de la función flecha, sacar la marca:

```tsx
                {pasos.map((paso) => {
                  const marca = estados.get(paso.id);
                  return (
```

(y cerrar con `);` y `})}` en lugar del `))}` actual).

Sustituir el `<span>` del círculo:

```tsx
                    <span className="absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full bg-tinta text-xs font-bold text-white ring-4 ring-fondo">
                      {paso.orden}
                    </span>
```

por:

```tsx
                    <span
                      className={`absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-4 ring-fondo ${
                        marca ? "bg-bloque2 text-tinta" : "bg-tinta text-white"
                      }`}
                      title={
                        marca?.estado === "REVISADO"
                          ? "Revisado por tu profe"
                          : marca
                            ? "Entregado, esperando revisión"
                            : undefined
                      }
                    >
                      {marca ? "✓" : paso.orden}
                    </span>
```

Y sustituir el párrafo del título:

```tsx
                      <p className="mt-2 text-sm font-semibold text-tinta">
                        {paso.titulo}
                      </p>
```

por:

```tsx
                      <div className="mt-2 flex items-center gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold text-tinta">
                          {paso.titulo}
                        </p>
                        {marca?.estado === "REVISADO" && (
                          <span className="shrink-0 rounded-full bg-sol-300 px-2 py-0.5 text-[11px] font-extrabold text-tinta">
                            {marca.puntos ?? 0} pts
                          </span>
                        )}
                      </div>
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Comprobar a mano**

Run: `npm run dev`
Con la cuenta de estudiante, abrir `/recorridos/<id>` de una secuencia asignada: los pasos entregados llevan ✓ verde en el círculo, y el revisado además muestra sus puntos junto al título. Con la cuenta de profesor, la lista se ve como siempre: sin ✓ ni puntos.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/recorridos/[id]/page.tsx"
git commit -m "Marcar el estado de cada paso en la lista de una secuencia"
```

---

### Task 5: Estado y bloqueo en la página del paso

**Files:**
- Modify: `app/(app)/pasos/[pasoId]/page.tsx` (~líneas 198-330)

**Interfaces:**
- Consumes: nada nuevo de tareas anteriores; consulta `prisma.pasoCompletado` directamente porque solo necesita una fila.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Añadir el formateador de fechas**

Junto a los demás `const` de la cabecera del archivo (después de `tipoDescripcion`):

```tsx
const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
});
```

- [ ] **Step 2: Sustituir el booleano `hecho` por la fila completa**

Reemplazar el bloque actual:

```tsx
  const hecho = puedeMarcar
    ? Boolean(
        await prisma.pasoCompletado.findUnique({
          where: {
            asignacionId_pasoId: {
              asignacionId: asignacion!.id,
              pasoId: paso.id,
            },
          },
          select: { id: true },
        }),
      )
    : false;
```

por:

```tsx
  const registro = puedeMarcar
    ? await prisma.pasoCompletado.findUnique({
        where: {
          asignacionId_pasoId: {
            asignacionId: asignacion!.id,
            pasoId: paso.id,
          },
        },
        select: { completadoEl: true, verificadoEl: true, puntos: true },
      })
    : null;

  const hecho = Boolean(registro);
  // Revisado por el profesor: ya no se puede desmarcar, porque la fila
  // guarda sus puntos.
  const revisado = Boolean(registro?.verificadoEl);
```

- [ ] **Step 3: Reescribir el bloque del botón**

Reemplazar todo el bloque `{puedeMarcar && ( ... )}` por:

```tsx
      {/* Marcar como hecho: solo con asignación viva de este recorrido. */}
      {puedeMarcar && (
        <div className="mt-10 flex flex-col items-center gap-3">
          {registro && (
            <p className="text-sm text-tinta-suave">
              {revisado
                ? `Tu profe lo revisó: ${registro.puntos ?? 0} puntos.`
                : `Entregado el ${formatoFecha.format(registro.completadoEl)}. Esperando a tu profe.`}
            </p>
          )}

          {revisado ? (
            <span className="rounded-full bg-sol-300 px-6 py-3 text-sm font-extrabold text-tinta">
              Revisado ✓
            </span>
          ) : hecho ? (
            <form action={desmarcarPasoHecho}>
              <input type="hidden" name="pasoId" value={paso.id} />
              <button
                type="submit"
                className="rounded-full bg-bloque2 px-6 py-3 text-sm font-extrabold text-tinta transition hover:opacity-80"
                title="Pulsa para desmarcar"
              >
                Hecho ✓
              </button>
            </form>
          ) : (
            <form action={marcarPasoHecho}>
              <input type="hidden" name="pasoId" value={paso.id} />
              <button
                type="submit"
                className="rounded-full bg-hp-400 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-hp-500"
              >
                Marcar como hecho
              </button>
            </form>
          )}
        </div>
      )}
```

- [ ] **Step 4: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Volver a pasar el script de la Tarea 1**

Run: `npx tsx scripts/verificar-puntos.ts`
Expected: todas las verificaciones pasan. Confirma que nada de la interfaz rompió la regla del servidor.

- [ ] **Step 6: Comprobar a mano los tres estados**

Run: `npm run dev`

Con la cuenta de estudiante, sobre una secuencia asignada:
1. Paso sin tocar → botón "Marcar como hecho", sin línea de estado.
2. Tras marcarlo → "Entregado el <fecha>. Esperando a tu profe." y botón "Hecho ✓" que se puede desmarcar.
3. Tras darle puntos desde la ficha del alumno → "Tu profe lo revisó: N puntos." y la marca fija "Revisado ✓", sin botón que pulsar.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/pasos/[pasoId]/page.tsx"
git commit -m "Página del paso: línea de estado y bloqueo de lo revisado"
```

---

## Fuera de alcance

Rachas y constancia, avance por destrezas, avisos de novedades desde la última visita, notificaciones por correo, y guardar el máximo posible por paso para convertir los puntos en nota.

Detectado durante el diseño y **no** abordado aquí: en `/recorridos` cualquier estudiante ve todas las secuencias de la base, incluidas las no publicadas y las que no tiene asignadas. Merece su propio análisis.
