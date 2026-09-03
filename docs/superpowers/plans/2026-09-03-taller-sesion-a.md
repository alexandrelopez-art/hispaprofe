# El taller del examen, sesión A: modelo, mesa de trabajo, páginas y rellenar con IA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor cree un examen A2/B1 escolar desde `/dele/taller`, suba sus páginas y el cuadernillo de claves, y rellene cada tarea con Opus 5 dejando la tarea «rellenada» con sus avisos, dudas e imágenes pedidas.

**Architecture:** Tres modelos nuevos (`Examen`, `PaginaDeExamen`, `TareaDeExamen`) por encima del modelo del estudiante, que no cambia. Un módulo `lib/taller/` con el esqueleto, las páginas, el cuadernillo, el encargo para la IA, la llamada a Anthropic y el guardado validado. Pantallas del profesor bajo `app/(app)/dele/taller/` sobre las piezas de la carcasa. Un script `verificar-taller.ts` que prueba todo contra la base local sin llamar a la API (respuesta de IA en un fixture).

**Tech Stack:** Next.js 16.2 App Router (acciones de servidor, `proxy.ts`), React 19 (`useActionState`), Prisma 7 (`prisma migrate dev`), zod 4 (`z.toJSONSchema`), `@anthropic-ai/sdk` (modelo `claude-opus-5`), `pdfjs-dist` (texto del cuadernillo en el servidor y páginas de un PDF en el navegador), Tailwind 4 con las piezas de `components/ui/`.

**Spec:** `docs/superpowers/specs/2026-09-03-taller-dele-design.md` (secciones 1 y 2; la 3 es la sesión B; la 4 y la 5, la sesión C).

## Global Constraints

- «El modelo del estudiante no cambia»: `Recorrido`, `Paso`, `Bloque`, `Ejercicio`, `PasoEjercicio`, `Asignacion`, `PasoCompletado`, `Escucha` no se tocan en esta sesión.
- Nivel único: `A2_B1_ESCOLAR`. El mapa (`lib/dele/mapa.ts`) manda: CE 4 tareas (6/6/6/7 ítems), CO 4 tareas (7/6/6/6).
- Solo `PROFESOR`/`ADMIN`; un estudiante en `/dele/taller/*` recibe **404** (`notFound()`), como `/admin`.
- Toda pantalla nueva se escribe con las piezas de `components/ui/` (`verificar-piezas.ts` tiene que seguir en «Todo en orden» con ≤ 14 excepciones; **no se añade ninguna**).
- Textos en español, en la voz del sitio (tú, sin jerga). Sin gerundios en botones de formularios GET.
- Subidas por `/api/archivos` (campo `archivo`, tope 4 MB por petición, respuesta `{ url: "/api/archivos/<id>" }`). Nada de binarios nuevos.
- La IA: modelo `claude-opus-5`, salida forzada por herramienta con el esquema zod del motor; sin `ANTHROPIC_API_KEY` el botón se deshabilita con «Falta la clave de la API». `maxDuration = 120` en la acción.
- Lo que la IA devuelva pasa por `revisarDatos` (`lib/recursos.ts`) antes de tocar la base; si no valida, no se guarda nada.
- Commits con los dos trailers:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y
  `Claude-Session: https://claude.ai/code/session_011MTFjk2FcQUCsqhsbMpp6C`.
- Antes de cada commit: `npx tsc --noEmit`, `npm run lint`, `npx tsx scripts/verificar-piezas.ts`, `npx tsx scripts/verificar-carcasa.ts`.

---

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | enums `EstadoExamen`, `EstadoTarea`, `PruebaDeExamen`; modelos `Examen`, `PaginaDeExamen`, `TareaDeExamen` |
| `prisma/migrations/<fecha>_taller_del_examen/` | la migración |
| `lib/dele/estructura.ts` | `estructuraDe(tarea)` (se muda desde `profe/recursos/nuevo/page.tsx`) y `tipoDePasoDeTarea` |
| `lib/taller/esqueleto.ts` | `crearExamen(...)`: la transacción que monta 2 recorridos, 8 pasos, 8 ejercicios, 8 tareas |
| `lib/taller/consultas.ts` | `examenDe(id)`, `listarExamenes()`, `tareaDe(id)` con sus `include` |
| `lib/taller/paginas.ts` | registrar, reordenar, borrar páginas; asignar a tareas; repartir en orden |
| `lib/taller/cuadernillo.ts` | `textoDePdf(bytes)`, `trozoDeClaves(texto, numero, prueba, tarea)` |
| `lib/taller/encargo-ia.ts` | el prompt por tarea y el esquema de la herramienta |
| `lib/taller/rellenar.ts` | la llamada a Anthropic: `pedirTarea(...)` → `RespuestaIA` |
| `lib/taller/guardar-relleno.ts` | `guardarRelleno(tareaId, respuesta)`: validar, avisos, clave, transacción |
| `lib/acciones-taller.ts` | acciones de servidor (`"use server"`) de todo lo anterior |
| `app/(app)/dele/taller/layout.tsx` | la guarda de profesor (404) |
| `app/(app)/dele/taller/page.tsx` | la lista de exámenes |
| `app/(app)/dele/taller/nuevo/page.tsx` | el formulario de creación |
| `app/(app)/dele/taller/[id]/page.tsx` | la mesa de trabajo |
| `components/taller/paginas.tsx` | cliente: subir imágenes/PDF, reordenar, borrar |
| `components/taller/cuadernillo.tsx` | cliente: subir el PDF de claves |
| `components/taller/tarjeta-tarea.tsx` | cliente: estado, páginas asignadas, «Rellenar con IA» |
| `components/taller/rellenar-todas.tsx` | cliente: las ocho en serie con progreso |
| `scripts/fixtures/taller-respuesta-ia.json` | una respuesta de IA grabada (CE tarea 3) |
| `scripts/verificar-taller.ts` | la verificación contra la base local |
| `lib/carcasa/puertas.ts`, `scripts/verificar-carcasa.ts` | «Taller» deja de ser «pronto» |

---

### Task 1: El modelo y el esqueleto

**Files:**
- Modify: `prisma/schema.prisma` (después de `model PasoEjercicio`)
- Create: `lib/dele/estructura.ts`
- Modify: `app/(app)/profe/recursos/nuevo/page.tsx:30-88` (borrar `estructuraDe` local e importarla)
- Create: `lib/taller/esqueleto.ts`
- Create: `lib/taller/consultas.ts`
- Create: `scripts/verificar-taller.ts`

**Interfaces:**
- Produces: `crearExamen(entrada: EntradaExamen): Promise<string>` (devuelve el id), `EntradaExamen = { titulo: string; fuente: string; numero: number; bloque: 2 | 3; nivel: Nivel; autorId: string }`; `examenDe(id)`, `listarExamenes()`, `tareaDe(id)`; `estructuraDe(tarea: TareaDele): unknown`.

- [ ] **Step 1: El esquema**

Añadir a `prisma/schema.prisma`, justo después de `model PasoEjercicio { … }`:

```prisma
enum EstadoExamen {
  EN_CONSTRUCCION
  PUBLICADO
  ARCHIVADO
}

enum EstadoTarea {
  VACIA
  RELLENADA
  REVISADA
}

/// Las dos pruebas que el taller sabe montar. Es `Destreza` recortada: el
/// taller no monta expresión (todavía), y un enum propio impide que una
/// tarea nazca con `EO` por error.
enum PruebaDeExamen {
  CE
  CO
}

/// Un examen del DELE como unidad de trabajo del profesor. Por debajo son dos
/// `Recorrido` (lectura y auditiva) que el estudiante abre como siempre; el
/// examen es la capa de arriba: estado, páginas subidas, revisión por tarea.
model Examen {
  id           String       @id @default(cuid())
  titulo       String
  nivel        Nivel
  /// De dónde sale: «DELE A2/B1 escolar, libro X, examen 2».
  fuente       String
  /// El número que agrupa el catálogo (`Recorrido.examen`).
  numero       Int
  estado       EstadoExamen @default(EN_CONSTRUCCION)
  /// El bloque de la puerta DELE donde se publica: 2 práctica, 3 examen blanco.
  bloque       Int          @default(2)
  /// El texto del cuadernillo de claves, extraído del PDF. Nulo si no se subió.
  clavesTexto  String?
  lecturaId    String       @unique
  auditivaId   String       @unique
  creadoPor    User         @relation("AutorExamen", fields: [creadoPorId], references: [id])
  creadoPorId  String
  paginas      PaginaDeExamen[]
  tareas       TareaDeExamen[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([nivel, estado])
  @@index([creadoPorId])
}

/// Una página del examen subida por el profesor (una imagen, un `Archivo`).
model PaginaDeExamen {
  id        String         @id @default(cuid())
  examen    Examen         @relation(fields: [examenId], references: [id], onDelete: Cascade)
  examenId  String
  orden     Int
  archivoId String
  createdAt DateTime       @default(now())

  @@index([examenId, orden])
}

/// Una de las ocho tareas del examen: su paso, su estado de revisión y lo que
/// dejó la IA. `datos` del ejercicio sigue viviendo en `Ejercicio`.
model TareaDeExamen {
  id              String         @id @default(cuid())
  examen          Examen         @relation(fields: [examenId], references: [id], onDelete: Cascade)
  examenId        String
  prueba          PruebaDeExamen
  numero          Int
  pasoId          String
  estado          EstadoTarea    @default(VACIA)
  /// Ids de `PaginaDeExamen` asignadas a esta tarea, en orden.
  paginaIds       String[]
  /// `[{ campo, texto }]`: lo que la IA no leyó con seguridad.
  dudas           Json?
  /// `[string]`: lo que no cuadra con el mapa o con la clave.
  avisos          Json?
  /// `[{ pregunta, opcion, para, archivoId }]`: imágenes que hacen falta.
  imagenesPedidas Json?
  /// `{ [preguntaId]: letra }`: las respuestas del cuadernillo.
  claveOficial    Json?
  rellenadaEl     DateTime?
  revisadaEl      DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([examenId, prueba, numero])
  @@index([pasoId])
}
```

Y en `model User`, junto a las otras relaciones inversas (`recorridos`, `ejercicios`…), añadir `examenes Examen[] @relation("AutorExamen")`.

- [ ] **Step 2: La migración**

Run: `npx prisma migrate dev --name taller_del_examen && npx prisma generate`
Expected: una carpeta nueva en `prisma/migrations/` y «Your database is now in sync».

- [ ] **Step 3: Mudar `estructuraDe` a `lib/dele/estructura.ts`**

Crear `lib/dele/estructura.ts` con el cuerpo exacto de `estructuraDe` que hoy vive en `app/(app)/profe/recursos/nuevo/page.tsx:41-88` (con su comentario), exportado, más:

```ts
import type { TipoPaso } from "@/lib/generated/prisma/enums";
import type { TareaDele } from "@/lib/dele/mapa";
import { sobrantesDe } from "@/lib/dele";

/** Una tarea del examen es un paso de tipo actividad, como en los sembrados. */
export function tipoDePasoDeTarea(_tarea: TareaDele): TipoPaso {
  return "ACTIVIDAD";
}

export function estructuraDe(tarea: TareaDele): unknown { /* el cuerpo mudado */ }
```

En `app/(app)/profe/recursos/nuevo/page.tsx` borrar la función local y poner `import { estructuraDe } from "@/lib/dele/estructura";` (quitar también el import de `sobrantesDe` si ya no se usa ahí).

- [ ] **Step 4: El esqueleto**

Crear `lib/taller/esqueleto.ts`:

```ts
import type { Nivel } from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pruebaDe } from "@/lib/dele";
import { estructuraDe, tipoDePasoDeTarea } from "@/lib/dele/estructura";
import { TIPO_DE_EJERCICIO } from "@/lib/recursos";

export type EntradaExamen = {
  titulo: string;
  fuente: string;
  numero: number;
  bloque: 2 | 3;
  nivel: Nivel;
  autorId: string;
};

const NOMBRE_PRUEBA = { CE: "Comprensión de lectura", CO: "Comprensión auditiva" } as const;

/**
 * Monta el examen entero de golpe: dos secuencias sin publicar, un paso
 * «Tarea N» por tarea del mapa, un ejercicio vacío del tipo y tamaño que el
 * mapa dicta, y la fila de tarea del taller en `VACIA`. Todo o nada.
 */
export async function crearExamen(entrada: EntradaExamen): Promise<string> {
  const lectura = pruebaDe(entrada.nivel, "CE");
  const auditiva = pruebaDe(entrada.nivel, "CO");
  if (!lectura || !auditiva) throw new Error("El mapa no describe ese nivel.");

  return prisma.$transaction(async (tx) => {
    const ids: Record<"CE" | "CO", string> = { CE: "", CO: "" };
    const pasos: { prueba: "CE" | "CO"; numero: number; pasoId: string }[] = [];

    for (const prueba of [lectura, auditiva]) {
      const recorrido = await tx.recorrido.create({
        data: {
          titulo: `${entrada.titulo} · ${NOMBRE_PRUEBA[prueba.prueba as "CE" | "CO"]}`,
          nivel: entrada.nivel,
          destreza: prueba.prueba,
          examen: entrada.numero,
          tipo: "PREPARACION_DELE",
          orden: entrada.bloque,
          publicado: false,
          autorId: entrada.autorId,
        },
        select: { id: true },
      });
      ids[prueba.prueba as "CE" | "CO"] = recorrido.id;

      for (const tarea of prueba.tareas) {
        const paso = await tx.paso.create({
          data: {
            recorridoId: recorrido.id,
            orden: tarea.numero,
            ciclo: 1,
            tipo: tipoDePasoDeTarea(tarea),
            destreza: prueba.prueba,
            titulo: `Tarea ${tarea.numero}`,
          },
          select: { id: true },
        });
        const ejercicio = await tx.ejercicio.create({
          data: {
            tipo: TIPO_DE_EJERCICIO[tarea.motor],
            titulo: `${entrada.titulo} · ${NOMBRE_PRUEBA[prueba.prueba as "CE" | "CO"]} · Tarea ${tarea.numero}`,
            nivel: entrada.nivel,
            destreza: prueba.prueba,
            etiquetas: [],
            datos: estructuraDe(tarea) as Prisma.InputJsonValue,
            publicado: false,
            autorId: entrada.autorId,
          },
          select: { id: true },
        });
        await tx.pasoEjercicio.create({ data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 } });
        pasos.push({ prueba: prueba.prueba as "CE" | "CO", numero: tarea.numero, pasoId: paso.id });
      }
    }

    const examen = await tx.examen.create({
      data: {
        titulo: entrada.titulo,
        nivel: entrada.nivel,
        fuente: entrada.fuente,
        numero: entrada.numero,
        bloque: entrada.bloque,
        lecturaId: ids.CE,
        auditivaId: ids.CO,
        creadoPorId: entrada.autorId,
        tareas: { create: pasos.map((p) => ({ prueba: p.prueba, numero: p.numero, pasoId: p.pasoId })) },
      },
      select: { id: true },
    });
    return examen.id;
  });
}
```

- [ ] **Step 5: Las consultas**

Crear `lib/taller/consultas.ts`:

```ts
import { prisma } from "@/lib/prisma";

export const INCLUIR_EXAMEN = {
  paginas: { orderBy: { orden: "asc" as const } },
  tareas: { orderBy: [{ prueba: "asc" as const }, { numero: "asc" as const }] },
} as const;

export async function examenDe(id: string) {
  return prisma.examen.findUnique({ where: { id }, include: INCLUIR_EXAMEN });
}

export type ExamenCompleto = NonNullable<Awaited<ReturnType<typeof examenDe>>>;

export async function listarExamenes() {
  return prisma.examen.findMany({
    orderBy: [{ estado: "asc" }, { numero: "asc" }],
    include: { tareas: { select: { estado: true } } },
  });
}

/** La tarea con su examen y el ejercicio del paso (el `datos` vive ahí). */
export async function tareaDe(id: string) {
  const tarea = await prisma.tareaDeExamen.findUnique({
    where: { id },
    include: { examen: { include: INCLUIR_EXAMEN } },
  });
  if (!tarea) return null;
  const enganche = await prisma.pasoEjercicio.findUnique({
    where: { pasoId: tarea.pasoId },
    include: { ejercicio: true, paso: { include: { bloques: { orderBy: { orden: "asc" } } } } },
  });
  if (!enganche) return null;
  return { ...tarea, ejercicio: enganche.ejercicio, paso: enganche.paso };
}

export type TareaCompleta = NonNullable<Awaited<ReturnType<typeof tareaDe>>>;
```

- [ ] **Step 6: El script, primera parte**

Crear `scripts/verificar-taller.ts` siguiendo el patrón de `scripts/verificar-dele.ts` (`afirmar`, ids en variables de módulo, limpieza en `finally`):

```ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { crearExamen } from "@/lib/taller/esqueleto";
import { examenDe, tareaDe } from "@/lib/taller/consultas";
import { cuantosItems } from "@/lib/ejercicios/registro";
import { tareaDe as tareaDelMapa } from "@/lib/dele";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-taller-${process.pid}`;
let profeId: string | null = null;
let examenId: string | null = null;

async function main() {
  const profe = await prisma.user.create({
    data: { email: `${marca}@prueba.local`, name: "Profe de prueba", role: "PROFESOR" },
    select: { id: true },
  });
  profeId = profe.id;

  // ─── El esqueleto ───────────────────────────────────────────────────
  examenId = await crearExamen({
    titulo: `Examen ${marca}`, fuente: "prueba", numero: 99, bloque: 2, nivel: "A2_B1_ESCOLAR", autorId: profe.id,
  });
  const examen = await examenDe(examenId);
  afirmar(examen !== null, "el examen existe");
  afirmar(examen!.tareas.length === 8, "tiene ocho tareas");
  afirmar(examen!.tareas.every((t) => t.estado === "VACIA"), "las ocho nacen vacías");
  const recorridos = await prisma.recorrido.findMany({ where: { id: { in: [examen!.lecturaId, examen!.auditivaId] } }, include: { pasos: true } });
  afirmar(recorridos.length === 2 && recorridos.every((r) => !r.publicado && r.tipo === "PREPARACION_DELE" && r.examen === 99), "dos secuencias sin publicar, del examen 99");
  afirmar(recorridos.every((r) => r.pasos.length === 4), "cuatro pasos por secuencia");
  for (const t of examen!.tareas) {
    const completa = await tareaDe(t.id);
    const delMapa = tareaDelMapa("A2_B1_ESCOLAR", t.prueba, t.numero)!;
    afirmar(completa !== null && completa.paso.titulo === `Tarea ${t.numero}`, `${t.prueba} ${t.numero}: el paso se llama Tarea ${t.numero}`);
    // El esqueleto no pasa el esquema (campos en blanco), así que se cuenta a mano.
    const d = completa!.ejercicio.datos as { preguntas?: unknown[]; parejas?: unknown[] };
    const lista = delMapa.motor === "relacionar" ? d.parejas : d.preguntas;
    afirmar(Array.isArray(lista) && lista.length === delMapa.items, `${t.prueba} ${t.numero}: ${delMapa.items} ítems del mapa`);
    afirmar(cuantosItems(completa!.ejercicio.datos) === null, `${t.prueba} ${t.numero}: el esqueleto todavía no valida (está en blanco)`);
  }
  console.log("\nTodo en orden.");
}

async function limpiar() {
  if (examenId) {
    const ex = await prisma.examen.findUnique({ where: { id: examenId }, include: { tareas: true } });
    if (ex) {
      const pasoIds = ex.tareas.map((t) => t.pasoId);
      const enganches = await prisma.pasoEjercicio.findMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.examen.delete({ where: { id: examenId } });
      await prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.ejercicio.deleteMany({ where: { id: { in: enganches.map((e) => e.ejercicioId) } } });
      await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.paso.deleteMany({ where: { id: { in: pasoIds } } });
      await prisma.recorrido.deleteMany({ where: { id: { in: [ex.lecturaId, ex.auditivaId] } } });
    }
  }
  if (profeId) await prisma.user.delete({ where: { id: profeId } });
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(async () => { await limpiar(); await prisma.$disconnect(); });
```

(Comprobar en `prisma/schema.prisma` los campos obligatorios de `User` y ajustar el `create` si `name` no existe o hace falta algo más.)

Run: `npx tsx scripts/verificar-taller.ts`
Expected: todos `OK` y «Todo en orden.», y la base queda sin restos (`prisma.examen.count()` igual que antes).

- [ ] **Step 7: Comprobar y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-piezas.ts && npx tsx scripts/verificar-carcasa.ts && npx tsx scripts/verificar-dele.ts`
Expected: todo en verde.

```bash
git add prisma lib/dele/estructura.ts lib/taller 'app/(app)/profe/recursos/nuevo/page.tsx' scripts/verificar-taller.ts
git commit -m "Taller A: el examen como unidad, con su esqueleto de dos pruebas y ocho tareas"
```

---

### Task 2: Páginas y cuadernillo

**Files:**
- Create: `lib/taller/paginas.ts`
- Create: `lib/taller/cuadernillo.ts`
- Create: `lib/acciones-taller.ts` (primeras acciones)
- Create: `components/taller/paginas.tsx`
- Create: `components/taller/cuadernillo.tsx`
- Modify: `package.json` (`pdfjs-dist`)
- Modify: `scripts/verificar-taller.ts`

**Interfaces:**
- Consumes: `examenDe`, `INCLUIR_EXAMEN` (Task 1); `/api/archivos` (campo `archivo`).
- Produces: `registrarPagina(examenId, archivoId)`, `reordenarPaginas(examenId, ids)`, `borrarPagina(paginaId)`, `asignarPaginas(tareaId, paginaIds)`, `repartirEnOrden(examenId)`, `guardarCuadernillo(examenId, bytes)`, `textoDePdf(bytes): Promise<string>`, `trozoDeClaves(texto, numero, prueba, tarea): { texto: string; recortado: boolean }`.

- [ ] **Step 1: Instalar pdfjs**

Run: `npm install pdfjs-dist@^5`
Añadir `"pdfjs-dist"` a `serverExternalPackages` en `next.config.ts` (junto a `ffmpeg-static`).

- [ ] **Step 2: `lib/taller/paginas.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { pruebaDe } from "@/lib/dele";

export async function registrarPagina(examenId: string, archivoId: string): Promise<void> {
  const ultimo = await prisma.paginaDeExamen.aggregate({ where: { examenId }, _max: { orden: true } });
  await prisma.paginaDeExamen.create({ data: { examenId, archivoId, orden: (ultimo._max.orden ?? 0) + 1 } });
}

export async function reordenarPaginas(examenId: string, ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, i) => prisma.paginaDeExamen.update({ where: { id, examenId }, data: { orden: i + 1 } })),
  );
}

/** Borra la página y la quita de las tareas que la tuvieran asignada. */
export async function borrarPagina(paginaId: string): Promise<void> {
  const pagina = await prisma.paginaDeExamen.findUnique({ where: { id: paginaId } });
  if (!pagina) return;
  await prisma.$transaction(async (tx) => {
    const tareas = await tx.tareaDeExamen.findMany({ where: { examenId: pagina.examenId, paginaIds: { has: paginaId } } });
    for (const t of tareas) {
      await tx.tareaDeExamen.update({ where: { id: t.id }, data: { paginaIds: t.paginaIds.filter((p) => p !== paginaId) } });
    }
    await tx.paginaDeExamen.delete({ where: { id: paginaId } });
    await tx.archivo.deleteMany({ where: { id: pagina.archivoId } });
  });
}

export async function asignarPaginas(tareaId: string, paginaIds: string[]): Promise<void> {
  const tarea = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaId } });
  const validas = await prisma.paginaDeExamen.findMany({ where: { examenId: tarea.examenId, id: { in: paginaIds } }, orderBy: { orden: "asc" } });
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { paginaIds: validas.map((p) => p.id) } });
}

/**
 * Reparte las páginas en el orden del libro: lectura 1-4 y auditiva 1-4, dos
 * páginas por tarea salvo la última de cada prueba, que se queda con lo que
 * sobre. El profesor corrige después lo que no cuadre.
 */
export async function repartirEnOrden(examenId: string): Promise<void> {
  const examen = await prisma.examen.findUniqueOrThrow({
    where: { id: examenId },
    include: { paginas: { orderBy: { orden: "asc" } }, tareas: { orderBy: [{ prueba: "asc" }, { numero: "asc" }] } },
  });
  const paginas = examen.paginas.map((p) => p.id);
  const porPrueba = Math.ceil(paginas.length / 2);
  const reparto = new Map<string, string[]>();
  for (const prueba of ["CE", "CO"] as const) {
    const tareas = examen.tareas.filter((t) => t.prueba === prueba);
    const desde = prueba === "CE" ? 0 : porPrueba;
    const mias = paginas.slice(desde, prueba === "CE" ? porPrueba : paginas.length);
    tareas.forEach((t, i) => {
      const esUltima = i === tareas.length - 1;
      reparto.set(t.id, esUltima ? mias.slice(i * 2) : mias.slice(i * 2, i * 2 + 2));
    });
  }
  await prisma.$transaction(
    [...reparto].map(([id, paginaIds]) => prisma.tareaDeExamen.update({ where: { id }, data: { paginaIds } })),
  );
}

export function nombreDePrueba(prueba: "CE" | "CO"): string {
  return prueba === "CE" ? "Lectura" : "Auditiva";
}

export function tareasDelMapa(nivel: Parameters<typeof pruebaDe>[0], prueba: "CE" | "CO") {
  return pruebaDe(nivel, prueba)?.tareas ?? [];
}
```

- [ ] **Step 3: `lib/taller/cuadernillo.ts`**

```ts
import { prisma } from "@/lib/prisma";

/** Texto de un PDF con capa de texto, página a página. Vacío si es un escaneo. */
export async function textoDePdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    let linea = "";
    let ultimoY: number | null = null;
    const lineas: string[] = [];
    for (const item of contenido.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (ultimoY !== null && Math.abs(y - ultimoY) > 2) { lineas.push(linea.trim()); linea = ""; }
      linea += (linea && !linea.endsWith(" ") ? " " : "") + item.str;
      ultimoY = y;
    }
    if (linea.trim()) lineas.push(linea.trim());
    paginas.push(lineas.join("\n"));
  }
  return paginas.join("\n\n").trim();
}

const LIMITE = 40_000;

/**
 * El trozo del cuadernillo que le toca a una tarea. Busca el rótulo del
 * examen («EXAMEN 2») y se queda desde ahí hasta el siguiente examen, y añade
 * los bloques «SOLUCIONES». Si no encuentra el rótulo, manda el cuadernillo
 * entero (recortado a 40.000 caracteres) y lo dice.
 */
export function trozoDeClaves(
  texto: string,
  numero: number,
  prueba: "CE" | "CO",
  tarea: number,
): { texto: string; recortado: boolean } {
  const inicio = texto.search(new RegExp(`EXAMEN\\s+${numero}\\b`, "i"));
  if (inicio < 0) return { texto: texto.slice(0, LIMITE), recortado: true };
  const resto = texto.slice(inicio);
  const fin = resto.slice(10).search(new RegExp(`EXAMEN\\s+${numero + 1}\\b`, "i"));
  const delExamen = fin < 0 ? resto : resto.slice(0, fin + 10);
  const soluciones = [...texto.matchAll(/SOLUCIONES[\s\S]{0,3000}/g)].map((m) => m[0]).join("\n\n");
  const nombre = prueba === "CE" ? "LECTURA" : "AUDITIVA";
  const cabecera = `Examen ${numero}, prueba de comprensión ${nombre.toLowerCase()}, tarea ${tarea}.\n\n`;
  return { texto: (cabecera + delExamen + "\n\n" + soluciones).slice(0, LIMITE), recortado: false };
}

export async function guardarCuadernillo(examenId: string, bytes: Uint8Array): Promise<{ caracteres: number }> {
  const texto = await textoDePdf(bytes);
  await prisma.examen.update({ where: { id: examenId }, data: { clavesTexto: texto || null } });
  return { caracteres: texto.length };
}
```

- [ ] **Step 4: Las acciones**

Crear `lib/acciones-taller.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirProfesor } from "@/lib/profesor";
import { prisma } from "@/lib/prisma";
import { crearExamen } from "@/lib/taller/esqueleto";
import { asignarPaginas, borrarPagina, registrarPagina, reordenarPaginas, repartirEnOrden } from "@/lib/taller/paginas";
import { guardarCuadernillo } from "@/lib/taller/cuadernillo";

export type EstadoTaller = { error?: string; ok?: string };

async function examenDelProfesor(examenId: string) {
  await exigirProfesor();
  const examen = await prisma.examen.findUnique({ where: { id: examenId }, select: { id: true, numero: true } });
  if (!examen) throw new Error("Ese examen ya no existe.");
  return examen;
}

export async function crearExamenAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const usuario = await exigirProfesor();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const fuente = String(formData.get("fuente") ?? "").trim();
  const numero = Number(formData.get("numero"));
  const bloque = Number(formData.get("bloque")) === 3 ? 3 : 2;
  if (!titulo) return { error: "Ponle un título al examen." };
  if (!Number.isInteger(numero) || numero < 1) return { error: "El número del examen tiene que ser 1 o más." };
  const id = await crearExamen({ titulo, fuente, numero, bloque, nivel: "A2_B1_ESCOLAR", autorId: usuario.id });
  redirect(`/dele/taller/${id}`);
}

export async function registrarPaginaAccion(examenId: string, archivoUrl: string): Promise<EstadoTaller> {
  await examenDelProfesor(examenId);
  const id = archivoUrl.replace(/^\/api\/archivos\//, "");
  if (!id || id === archivoUrl) return { error: "Esa dirección no es de un archivo del sitio." };
  await registrarPagina(examenId, id);
  revalidatePath(`/dele/taller/${examenId}`);
  return { ok: "Página guardada." };
}

export async function reordenarPaginasAccion(examenId: string, ids: string[]): Promise<void> {
  await examenDelProfesor(examenId);
  await reordenarPaginas(examenId, ids);
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function borrarPaginaAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await borrarPagina(String(formData.get("paginaId") ?? ""));
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function asignarPaginasAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const tareaId = String(formData.get("tareaId") ?? "");
  await asignarPaginas(tareaId, formData.getAll("paginaId").map(String));
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function repartirEnOrdenAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await repartirEnOrden(examenId);
  revalidatePath(`/dele/taller/${examenId}`);
}

export async function subirCuadernilloAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const fichero = formData.get("cuadernillo");
  if (!(fichero instanceof File) || fichero.size === 0) return { error: "Elige el PDF del cuadernillo." };
  if (fichero.size > 4 * 1024 * 1024) return { error: "El cuadernillo pasa de 4 MB. Comprímelo o sube solo las páginas de este examen." };
  const { caracteres } = await guardarCuadernillo(examenId, new Uint8Array(await fichero.arrayBuffer()));
  revalidatePath(`/dele/taller/${examenId}`);
  if (caracteres === 0) return { error: "Ese PDF no tiene texto (es un escaneo). El examen sigue sin claves." };
  return { ok: `Cuadernillo guardado (${caracteres.toLocaleString("es")} caracteres).` };
}
```

- [ ] **Step 5: `components/taller/paginas.tsx`**

Cliente. Acepta imágenes y PDF; un PDF se convierte a JPEG por página con pdfjs en el navegador; cada imagen se reduce como en `components/subir-imagen.tsx` (misma función `reducir`, copiada aquí con el mismo comentario, salida `image/jpeg` 0,85 y ancho máximo 1600) y se sube a `/api/archivos` en el campo `archivo`; con la `url` que devuelve se llama a `registrarPaginaAccion`. Mientras sube, una barra «Subiendo página 3 de 7…».

```tsx
"use client";

import { useState, useTransition } from "react";
import { borrarPaginaAccion, registrarPaginaAccion, reordenarPaginasAccion } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Rotulo from "@/components/ui/rotulo";

type Pagina = { id: string; orden: number; archivoId: string };

async function reducir(archivo: Blob, nombre: string): Promise<File> {
  const mapa = await createImageBitmap(archivo);
  const maximo = 1600;
  const escala = Math.min(1, maximo / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext("2d")?.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  mapa.close();
  const blob = await new Promise<Blob>((r) => lienzo.toBlob((b) => r(b ?? archivo), "image/jpeg", 0.85));
  return new File([blob], nombre.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Un PDF, a una imagen por página. */
async function paginasDePdf(archivo: File): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  const salida: File[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: 2 });
    const lienzo = document.createElement("canvas");
    lienzo.width = vista.width;
    lienzo.height = vista.height;
    await pagina.render({ canvasContext: lienzo.getContext("2d")!, viewport: vista, canvas: lienzo }).promise;
    const blob = await new Promise<Blob>((r) => lienzo.toBlob((b) => r(b!), "image/jpeg", 0.85));
    salida.push(new File([blob], `${archivo.name.replace(/\.pdf$/i, "")}-${n}.jpg`, { type: "image/jpeg" }));
  }
  return salida;
}

async function subir(f: File): Promise<string> {
  const cuerpo = new FormData();
  cuerpo.append("archivo", f);
  const r = await fetch("/api/archivos", { method: "POST", body: cuerpo });
  const json = (await r.json()) as { url?: string; error?: string };
  if (!r.ok || !json.url) throw new Error(json.error ?? "No se pudo subir la página.");
  return json.url;
}

export default function Paginas({ examenId, paginas }: { examenId: string; paginas: Pagina[] }) {
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  async function alElegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setError(null);
    try {
      const ficheros: File[] = [];
      for (const f of Array.from(lista)) {
        if (f.type === "application/pdf") ficheros.push(...(await paginasDePdf(f)));
        else ficheros.push(await reducir(f, f.name));
      }
      for (let i = 0; i < ficheros.length; i++) {
        setProgreso(`Subiendo página ${i + 1} de ${ficheros.length}…`);
        const url = await subir(ficheros[i]);
        const r = await registrarPaginaAccion(examenId, url);
        if (r.error) throw new Error(r.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron subir las páginas.");
    } finally {
      setProgreso(null);
    }
  }

  function mover(id: string, sentido: -1 | 1) {
    const ids = paginas.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + sentido;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    empezar(() => reordenarPaginasAccion(examenId, ids));
  }

  return (
    <div>
      <Rotulo>Páginas del examen</Rotulo>
      <label className="mt-2 block text-sm text-tinta-suave">
        Imágenes o un PDF; cada página se sube por separado.
        <input type="file" accept="image/*,application/pdf" multiple className="mt-2 block text-sm" onChange={(e) => alElegir(e.target.files)} disabled={progreso !== null} />
      </label>
      {progreso && <Aviso tono="info" className="mt-3">{progreso}</Aviso>}
      {error && <Aviso tono="error" className="mt-3">{error}</Aviso>}
      <ol className="mt-4 flex flex-wrap gap-3">
        {paginas.map((p, i) => (
          <li key={p.id} className="w-36">
            <img src={`/api/archivos/${p.archivoId}`} alt={`Página ${i + 1}`} className="rounded-tarjeta border border-hp-100" />
            <div className="mt-1 flex items-center justify-between text-xs text-tinta-suave">
              <span>{i + 1}</span>
              <span className="flex gap-1">
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(p.id, -1)} title="Antes">↑</Boton>
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(p.id, 1)} title="Después">↓</Boton>
                <form action={borrarPaginaAccion}>
                  <input type="hidden" name="examenId" value={examenId} />
                  <input type="hidden" name="paginaId" value={p.id} />
                  <BotonEnviar gerundio="Quitando…" variante="peligro" tamano="pequeno">Quitar</BotonEnviar>
                </form>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

Si Turbopack se queja del `new URL(...worker...)`, la alternativa es copiar `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` a `public/pdf.worker.min.mjs` en un `postinstall` y poner `workerSrc = "/pdf.worker.min.mjs"`; documentarlo en el informe.

- [ ] **Step 6: `components/taller/cuadernillo.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { subirCuadernilloAccion, type EstadoTaller } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Rotulo from "@/components/ui/rotulo";

export default function Cuadernillo({ examenId, caracteres }: { examenId: string; caracteres: number | null }) {
  const [estado, accion] = useActionState<EstadoTaller, FormData>(subirCuadernilloAccion, {});
  return (
    <form action={accion}>
      <Rotulo>Cuadernillo de claves</Rotulo>
      <p className="mt-1 text-sm text-tinta-suave">
        {caracteres ? `Guardado: ${caracteres.toLocaleString("es")} caracteres de texto.` : "Sin cuadernillo: la IA rellenará sin marcar las respuestas correctas."}
      </p>
      <input type="hidden" name="examenId" value={examenId} />
      <input type="file" name="cuadernillo" accept="application/pdf" className="mt-2 block text-sm" required />
      <BotonEnviar gerundio="Leyendo el PDF…" variante="secundario" tamano="pequeno" className="mt-2">Guardar cuadernillo</BotonEnviar>
      {estado.error && <Aviso tono="error" className="mt-2">{estado.error}</Aviso>}
      {estado.ok && <Aviso tono="ok" className="mt-2">{estado.ok}</Aviso>}
    </form>
  );
}
```

- [ ] **Step 7: El script, segunda parte**

Añadir a `scripts/verificar-taller.ts`, tras el esqueleto: crear tres `Archivo` mínimos (`tipo: "image/jpeg"`, `datos: Buffer.from([0xff, 0xd8, 0xff, 0xd9])`, `tamano: 4`), registrarlos como páginas, comprobar el orden 1-2-3, reordenar a 3-1-2 y comprobar, `repartirEnOrden` con 8 páginas simuladas (crear cinco más) y afirmar el reparto exacto: con 8 páginas cada prueba recibe 4, así que CE1 = [1,2], CE2 = [3,4], CE3 = [], CE4 = [], CO1 = [5,6], CO2 = [7,8], CO3 = [], CO4 = [] (comparando `paginaIds` con los ids de las páginas en ese orden); borrar una página asignada y afirmar que desaparece de `paginaIds`. Para el cuadernillo: `trozoDeClaves` con un texto sintético `"EXAMEN 1 – … EXAMEN 2 – PRUEBA … SOLUCIONES A B C … EXAMEN 3 –"` afirmando que con `numero = 2` el trozo contiene «EXAMEN 2» y «SOLUCIONES» y no contiene «EXAMEN 3 –», y que con `numero = 7` sale `recortado: true`. `textoDePdf` con un PDF mínimo escrito a mano en el script (un objeto de página con un `BT /F1 12 Tf (Hola taller) Tj ET`) afirmando que devuelve «Hola taller». Limpiar los archivos en `limpiar()`.

Run: `npx tsx scripts/verificar-taller.ts`
Expected: verde.

- [ ] **Step 8: Comprobar y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-piezas.ts`
Expected: verde (los `<input type="file">` no disparan «casilla nativa»: el patrón solo mira date/datetime-local/time/url/search).

```bash
git add package.json package-lock.json next.config.ts lib/taller lib/acciones-taller.ts components/taller scripts/verificar-taller.ts
git commit -m "Taller A: las páginas del examen y el cuadernillo de claves"
```

---

### Task 3: Las pantallas del taller

**Files:**
- Create: `app/(app)/dele/taller/layout.tsx`, `page.tsx`, `nuevo/page.tsx`, `[id]/page.tsx`
- Create: `components/taller/tarjeta-tarea.tsx` (sin el botón de IA todavía: lo añade la Task 4)
- Modify: `lib/carcasa/puertas.ts:25`, `scripts/verificar-carcasa.ts:37`

**Interfaces:**
- Consumes: `listarExamenes`, `examenDe`, `tareaDe` (Task 1); acciones de Task 2; `Paginas`, `Cuadernillo`.
- Produces: rutas `/dele/taller`, `/dele/taller/nuevo`, `/dele/taller/[id]`; `TarjetaTarea` con props `{ tarea, delMapa, paginas, examenId, hijos?: ReactNode }`.

- [ ] **Step 1: La guarda**

`app/(app)/dele/taller/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";

export default async function TallerLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) notFound();
  return <>{children}</>;
}
```

- [ ] **Step 2: La lista**

`app/(app)/dele/taller/page.tsx`: `Encabezado titulo="Taller del examen" lede="Un examen entra aquí desde sus páginas; tú revisas y publicas." acciones={<Boton href="/dele/taller/nuevo">Nuevo examen</Boton>}`; tres grupos con `Rotulo` («En construcción», «Publicados», «Archivados»); cada examen una `Tarjeta href={`/dele/taller/${e.id}`} titulo={e.titulo}` con `Etiqueta` del estado y el texto «N de 8 tareas revisadas» (contar `tareas.filter(t => t.estado === "REVISADA")`). Sin exámenes: `Vacio` con «Todavía no hay ningún examen. Crea el primero.» y la acción «Nuevo examen». `export const dynamic = "force-dynamic";`.

- [ ] **Step 3: Crear**

`app/(app)/dele/taller/nuevo/page.tsx` es un componente de servidor que pinta un cliente `components/taller/formulario-nuevo.tsx` con `useActionState(crearExamenAccion, {})` y cuatro `Campo`: «Título» (`name="titulo"`, `required`), «De dónde sale» (`name="fuente"`, ayuda «Libro y examen, o convocatoria. Solo para ti.»), «Número» (`tipo="numero"`, `name="numero"`, `min={1}`, `required`), «Bloque de la puerta DELE» (`tipo="elegir"`, `name="bloque"`, opciones `2 → "Práctica por tarea"`, `3 → "Examen blanco"`); un `Aviso tono="info"` que dice «Nivel: A2/B1 escolar. Se montan las dos pruebas con sus ocho tareas.»; `BotonEnviar gerundio="Montando el examen…"`; `estado.error` en `Aviso tono="error"`. `Encabezado titulo="Nuevo examen" volver={{ href: "/dele/taller", texto: "Taller" }}`.

- [ ] **Step 4: La mesa de trabajo**

`app/(app)/dele/taller/[id]/page.tsx` (`params` es `Promise<{ id: string }>`; `notFound()` si `examenDe` devuelve null):

- `Encabezado titulo={examen.titulo} lede={examen.fuente} volver={{ href: "/dele/taller", texto: "Taller" }} acciones={<Etiqueta tono=…>{estado}</Etiqueta>}` (tonos: EN_CONSTRUCCION `sol`, PUBLICADO `verde`, ARCHIVADO `neutro`). Los botones Publicar/Retirar/Asignar son de la sesión C: aquí solo la etiqueta.
- Una `Tarjeta` con `<Paginas examenId paginas />` y debajo un `form action={repartirEnOrdenAccion}` con `BotonEnviar gerundio="Repartiendo…" variante="sutil" tamano="pequeno"` «Repartir en orden» (deshabilitado si no hay páginas).
- Una `Tarjeta` con `<Cuadernillo examenId caracteres={examen.clavesTexto?.length ?? null} />`.
- Una `Tarjeta titulo="Imágenes que faltan"` que cuenta las `imagenesPedidas` sin `archivoId` de las ocho tareas y dice «N imágenes por subir. Se suben desde aquí en la siguiente entrega.» o «Ninguna por ahora.» (`Vacio`).
- Dos columnas (`grid gap-6 md:grid-cols-2`), «Lectura» y «Auditiva», cada una con `Rotulo` y cuatro `TarjetaTarea`.

`components/taller/tarjeta-tarea.tsx` (cliente por el selector de páginas, que es un `form` con casillas):

```tsx
"use client";

import type { ReactNode } from "react";
import { asignarPaginasAccion } from "@/lib/acciones-taller";
import type { TareaDele } from "@/lib/dele/mapa";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";

export type TareaParaTarjeta = {
  id: string; numero: number; prueba: "CE" | "CO"; estado: "VACIA" | "RELLENADA" | "REVISADA";
  pasoId: string; paginaIds: string[]; avisos: string[]; dudas: number; imagenesPendientes: number;
};

const ESTADO = { VACIA: ["Vacía", "neutro"], RELLENADA: ["Rellenada", "sol"], REVISADA: ["Revisada", "verde"] } as const;

export default function TarjetaTarea({ tarea, delMapa, paginas, examenId, children }: {
  tarea: TareaParaTarjeta; delMapa: TareaDele; paginas: { id: string; orden: number }[]; examenId: string; children?: ReactNode;
}) {
  const [nombre, tono] = ESTADO[tarea.estado];
  return (
    <Tarjeta titulo={`Tarea ${tarea.numero}`} relleno="compacto">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-tinta-suave">{delMapa.pide}</p>
        <Etiqueta tono={tono}>{nombre}</Etiqueta>
      </div>
      {tarea.avisos.length > 0 && <p className="mt-2 text-xs font-bold text-error-600">{tarea.avisos.length} aviso(s)</p>}
      {tarea.dudas > 0 && <p className="mt-1 text-xs font-bold text-tinta">{tarea.dudas} duda(s) de lectura</p>}
      {tarea.imagenesPendientes > 0 && <p className="mt-1 text-xs text-tinta-suave">{tarea.imagenesPendientes} imagen(es) por subir</p>}
      <form action={asignarPaginasAccion} className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <input type="hidden" name="examenId" value={examenId} />
        <input type="hidden" name="tareaId" value={tarea.id} />
        <span className="text-tinta-suave">Está en las páginas</span>
        {paginas.map((p) => (
          <label key={p.id} className="flex items-center gap-1">
            <input type="checkbox" name="paginaId" value={p.id} defaultChecked={tarea.paginaIds.includes(p.id)} />
            {p.orden}
          </label>
        ))}
        <BotonEnviar gerundio="Guardando…" variante="sutil" tamano="pequeno">Guardar</BotonEnviar>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {children}
        <Boton href={`/pasos/${tarea.pasoId}`} variante="sutil" tamano="pequeno">Abrir</Boton>
      </div>
    </Tarjeta>
  );
}
```

(«Abrir» lleva por ahora a la página del paso que ya existe; la pantalla de revisión propia es la sesión B.)

La página de servidor construye `TareaParaTarjeta` desde `examen.tareas`: `avisos: (t.avisos as string[] | null) ?? []`, `dudas: ((t.dudas as unknown[] | null) ?? []).length`, `imagenesPendientes: ((t.imagenesPedidas as { archivoId?: string }[] | null) ?? []).filter((i) => !i.archivoId).length`, y `delMapa` con `tareaDe("A2_B1_ESCOLAR", t.prueba, t.numero)!` de `@/lib/dele`.

- [ ] **Step 5: La herramienta deja de ser «pronto»**

`lib/carcasa/puertas.ts:25` → `{ nombre: "Taller", ruta: "/dele/taller" }`. En `scripts/verificar-carcasa.ts:37` cambiar la afirmación por `afirmar(herramientasDe(dele, "PROFESOR").some((h) => !h.pronto && h.ruta === "/dele/taller"), "el taller es una herramienta real de la puerta DELE")`; la comprobación de existencia de rutas del propio script cubrirá `app/(app)/dele/taller/page.tsx`. Comprobar también que para `STUDENT` `herramientasDe` no devuelve el taller (si la función ya filtra por rol, afirmarlo; si no, no tocarla: la guarda es el layout).

- [ ] **Step 6: Comprobar, barrido y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-piezas.ts && npx tsx scripts/verificar-carcasa.ts && npx tsx scripts/verificar-taller.ts`
Expected: verde, `verificar-piezas` sin hallazgo nuevo.

Barrido con `npm run dev` y una sesión de profesor (crear un token como en las sesiones anteriores: fila en `Sesion` con `hashDeToken` de `lib/sesion.ts` y la cookie `hp_sesion`): `GET /dele/taller` 200 «Taller del examen»; `GET /dele/taller/nuevo` 200 «Nuevo examen»; crear un examen con `curl --form-string` contra la acción (o desde el navegador) y `GET /dele/taller/<id>` 200 con «Tarea 1» ocho veces; con sesión de estudiante, `GET /dele/taller` → 404. Matar el servidor.

```bash
git add 'app/(app)/dele/taller' components/taller lib/carcasa/puertas.ts scripts/verificar-carcasa.ts
git commit -m "Taller A: la lista, el formulario de creación y la mesa de trabajo del examen"
```

---

### Task 4: Rellenar con IA

**Files:**
- Modify: `package.json` (`@anthropic-ai/sdk`), `.env.example` si existe (`ANTHROPIC_API_KEY=`)
- Modify: `lib/pegado/encargo.ts` (exportar `REGLAS` y `REGLAS_CLOZE`)
- Create: `lib/taller/encargo-ia.ts`, `lib/taller/rellenar.ts`, `lib/taller/guardar-relleno.ts`
- Modify: `lib/acciones-taller.ts` (+ `rellenarConIAAccion`, `hayClaveDeIA`)
- Create: `components/taller/boton-rellenar.tsx`, `components/taller/rellenar-todas.tsx`
- Modify: `app/(app)/dele/taller/[id]/page.tsx` (los botones), `components/taller/tarjeta-tarea.tsx` (sin cambios de firma)
- Create: `scripts/fixtures/taller-respuesta-ia.json`
- Modify: `scripts/verificar-taller.ts`

**Interfaces:**
- Consumes: `tareaDe` (Task 1), `trozoDeClaves` (Task 2), `revisarDatos` y `TIPO_DE_EJERCICIO` (`lib/recursos.ts`), `avisoDeItems`, `sobrantesDe`, `tareaDe` del mapa (`lib/dele`), `opcionSchema`, `relacionarSchema`.
- Produces: `RespuestaIA` (tipo), `pedirTarea(entrada): Promise<RespuestaIA>`, `guardarRelleno(tareaId, respuesta): Promise<ResultadoRelleno>`, `rellenarConIAAccion(tareaId): Promise<EstadoTaller>`.

- [ ] **Step 1: Instalar el SDK y exportar las reglas**

Run: `npm install @anthropic-ai/sdk`
En `lib/pegado/encargo.ts` poner `export` delante de `const REGLAS` y `const REGLAS_CLOZE`.

- [ ] **Step 2: El encargo y el esquema de la herramienta**

`lib/taller/encargo-ia.ts`:

```ts
import { z } from "zod";
import type { TareaDele } from "@/lib/dele/mapa";
import { sobrantesDe } from "@/lib/dele";
import { opcionSchema } from "@/lib/ejercicios/opcion";
import { relacionarSchema } from "@/lib/ejercicios/relacionar";
import { REGLAS, REGLAS_CLOZE } from "@/lib/pegado/encargo";

export const respuestaIASchema = z.object({
  bloque: z.string().nullable(),
  ejercicio: z.unknown(),
  textosConLetra: z.array(z.object({ letra: z.string(), texto: z.string() })).default([]),
  imagenesPedidas: z.array(z.object({ pregunta: z.string(), opcion: z.number().int().nullable(), para: z.string() })).default([]),
  dudas: z.array(z.object({ campo: z.string(), texto: z.string() })).default([]),
  claveOficial: z.record(z.string(), z.string()).nullable(),
});
export type RespuestaIA = z.infer<typeof respuestaIASchema>;

export const NOMBRE_HERRAMIENTA = "entregar_tarea";

/** El esquema JSON que Anthropic exige a la respuesta: el del motor, dentro del sobre. */
export function esquemaDeHerramienta(tarea: TareaDele): Record<string, unknown> {
  const motor = tarea.motor === "relacionar" ? relacionarSchema : opcionSchema;
  const ejercicio = z.toJSONSchema(motor, { unrepresentable: "any" });
  const sobre = z.toJSONSchema(respuestaIASchema.omit({ ejercicio: true }), { unrepresentable: "any" }) as { properties: Record<string, unknown>; required?: string[] };
  return {
    type: "object",
    properties: { ...sobre.properties, ejercicio },
    required: ["bloque", "ejercicio", "imagenesPedidas", "dudas", "claveOficial"],
  };
}

export function textoDelEncargo(tarea: TareaDele, prueba: "CE" | "CO", numeroExamen: number, claves: { texto: string; recortado: boolean } | null): string {
  const cloze = tarea.formato === "CLOZE";
  const reglas = tarea.motor === "opcion" ? (cloze ? [...REGLAS.opcion, ...REGLAS_CLOZE] : REGLAS.opcion) : REGLAS.relacionar;
  const sobrantes = sobrantesDe(tarea);
  const nombrePrueba = prueba === "CE" ? "comprensión de lectura" : "comprensión auditiva";
  return [
    `Estás transcribiendo la tarea ${tarea.numero} de la prueba de ${nombrePrueba} del examen ${numeroExamen} del DELE A2/B1 para escolares, a partir de las imágenes de sus páginas. Lo que devuelvas lo verá un estudiante tal cual, así que copia los textos exactos, con sus tildes y su puntuación.`,
    `Qué pide la tarea: ${tarea.pide}`,
    `Números que tiene que cumplir: ${tarea.items} ítems; ${tarea.opciones} opciones por ítem${tarea.listaComun ? " en una lista común a todos" : ""}${sobrantes ? `; ${sobrantes} sobrantes` : ""}.`,
    tarea.motor === "opcion"
      ? `El ejercicio es de tipo "opcion". ${tarea.listaComun ? "Las opciones van en `opcionesComunes` (por ejemplo los nombres de las tres personas o «A», «B», «C»)." : "Cada pregunta lleva sus tres `opciones` con el texto de cada una, sin la letra delante."} Los ids de las preguntas son p1…p${tarea.items}. ${cloze ? "El pasaje va en `texto` con una marca {{p1}}…{{p7}} en cada hueco." : ""}`
      : `El ejercicio es de tipo "relacionar". Cada pareja tiene en \`izquierda\` el enunciado o la persona (con su texto de presentación completo) y en \`derecha\` el TÍTULO del texto que le corresponde; los títulos de los ${sobrantes} textos que no casan van en \`sobrantes\`. Los ids son r1…r${tarea.items}. Devuelve además en \`textosConLetra\` los ${tarea.opciones} textos con su letra (A…) y su título.`,
    `El estímulo (el texto o los textos que se leen antes de contestar, con su título y su autor si los hay) va en \`bloque\` en markdown${cloze ? ", salvo el pasaje del cloze, que va en `texto`" : ""}. En la auditiva no hay estímulo escrito: \`bloque\` va a null y las preguntas llevan solo su enunciado y opciones.`,
    `Reglas que no se pueden romper:\n${reglas.map((r) => `- ${r}`).join("\n")}`,
    `Imágenes: si una opción o un ítem es un dibujo o una foto y no un texto, NO lo describas como opción; pon en la opción el texto «(imagen)» y añade una entrada en \`imagenesPedidas\` con el id de la pregunta, el índice de la opción (desde cero) o null si es el ítem entero, y en \`para\` una descripción corta de lo que se ve, para que el profesor la busque.`,
    `Dudas: cada texto que no hayas podido leer con seguridad va en \`dudas\` con el campo (por ejemplo «p3.opciones[1]») y lo que crees que pone.`,
    claves
      ? `Cuadernillo de claves${claves.recortado ? " (entero, no se pudo recortar: busca tú el examen y la tarea)" : ""}. Toma de ahí las respuestas correctas: marca \`correctas\` (o la pareja buena) según la clave, y devuelve en \`claveOficial\` la letra de cada ítem tal como aparece en el cuadernillo, con el id del ítem como clave. Si la clave de esta tarea no está, \`claveOficial\` va a null y marcas lo que leas del examen.\n\n${claves.texto}`
      : "No hay cuadernillo de claves: \`claveOficial\` va a null. Marca como correcta lo que deduzcas del ejemplo resuelto si lo hay; si no, deja \`correctas\` vacío y anótalo en \`dudas\`.",
    `Responde solo llamando a la herramienta ${NOMBRE_HERRAMIENTA}.`,
  ].join("\n\n");
}
```

- [ ] **Step 3: La llamada**

`lib/taller/rellenar.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { TareaDele } from "@/lib/dele/mapa";
import { esquemaDeHerramienta, NOMBRE_HERRAMIENTA, respuestaIASchema, textoDelEncargo, type RespuestaIA } from "@/lib/taller/encargo-ia";

export const MODELO = "claude-opus-5";

export function hayClaveDeIA(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class SinClaveError extends Error {
  constructor() { super("Falta la clave de la API. Ponla en Vercel como ANTHROPIC_API_KEY."); }
}

export type EntradaDePeticion = {
  tarea: TareaDele;
  prueba: "CE" | "CO";
  numeroExamen: number;
  paginas: { bytes: Uint8Array; tipo: "image/jpeg" | "image/png" | "image/webp" }[];
  claves: { texto: string; recortado: boolean } | null;
};

/**
 * Una tarea, una llamada. Salida forzada por herramienta y sin pensamiento
 * extendido: la API no admite forzar la herramienta con el pensamiento
 * encendido, y lo que queremos aquí es una transcripción fiel con el JSON
 * bien formado, no un razonamiento largo. El cuadernillo va marcado para la
 * caché de prompts: se repite en las ocho llamadas del examen.
 */
export async function pedirTarea(entrada: EntradaDePeticion): Promise<RespuestaIA> {
  if (!hayClaveDeIA()) throw new SinClaveError();
  const cliente = new Anthropic();
  const texto = textoDelEncargo(entrada.tarea, entrada.prueba, entrada.numeroExamen, entrada.claves);
  const respuesta = await cliente.messages.create({
    model: MODELO,
    max_tokens: 8000,
    tools: [{ name: NOMBRE_HERRAMIENTA, description: "Entrega la tarea transcrita en el formato del sitio.", input_schema: esquemaDeHerramienta(entrada.tarea) as Anthropic.Tool["input_schema"] }],
    tool_choice: { type: "tool", name: NOMBRE_HERRAMIENTA },
    messages: [{
      role: "user",
      content: [
        ...entrada.paginas.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.tipo, data: Buffer.from(p.bytes).toString("base64") } })),
        { type: "text" as const, text: texto, cache_control: { type: "ephemeral" as const } },
      ],
    }],
  });
  const uso = respuesta.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") throw new Error("La IA no devolvió la tarea.");
  const abierto = respuestaIASchema.safeParse(uso.input);
  if (!abierto.success) throw new Error(`La IA devolvió algo que no es una tarea: ${abierto.error.issues[0]?.message ?? "formato desconocido"}.`);
  return abierto.data;
}
```

Si el SDK rechaza `tool_choice` con esa forma, consultar `node_modules/@anthropic-ai/sdk` (`MessageCreateParams`) y ajustar; no cambiar el modelo ni añadir `thinking`.

- [ ] **Step 4: Guardar validado**

`lib/taller/guardar-relleno.ts`:

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { avisoDeItems, sobrantesDe, tareaDe as tareaDelMapa } from "@/lib/dele";
import { revisarDatos } from "@/lib/recursos";
import type { RespuestaIA } from "@/lib/taller/encargo-ia";
import { tareaDe } from "@/lib/taller/consultas";

export type ResultadoRelleno = { ok: true; avisos: string[] } | { ok: false; error: string };

const LETRAS = "ABCDEFGHIJKLMNOP";

/** Lo que no cuadra con el mapa: ítems, opciones por ítem, sobrantes. */
export function avisosDelMapa(tarea: Parameters<typeof avisoDeItems>[0], datos: unknown): string[] {
  const avisos: string[] = [];
  const deItems = avisoDeItems(tarea, datos);
  if (deItems) avisos.push(deItems);
  const d = datos as { preguntas?: { opciones?: string[] }[]; opcionesComunes?: string[]; sobrantes?: string[] };
  if (tarea.motor === "opcion") {
    const mal = (d.preguntas ?? []).filter((p) => (p.opciones ?? d.opcionesComunes ?? []).length !== tarea.opciones);
    if (mal.length) avisos.push(`${mal.length} pregunta(s) no tienen ${tarea.opciones} opciones.`);
  } else {
    const esperados = sobrantesDe(tarea);
    if ((d.sobrantes ?? []).length !== esperados) avisos.push(`El examen deja ${esperados} sobrantes; hay ${(d.sobrantes ?? []).length}.`);
  }
  return avisos;
}

/** La clave oficial contra lo marcado: por letra en opción, por título en relacionar. */
export function contrastarClave(respuesta: RespuestaIA, motor: "opcion" | "relacionar"): string[] {
  if (!respuesta.claveOficial) return [];
  const fallan: string[] = [];
  const d = respuesta.ejercicio as { preguntas?: { id: string; correctas: number[] }[]; parejas?: { id: string; derecha: string }[] };
  if (motor === "opcion") {
    for (const p of d.preguntas ?? []) {
      const letra = respuesta.claveOficial[p.id];
      if (letra && LETRAS.indexOf(letra.toUpperCase()) !== p.correctas[0]) fallan.push(p.id);
    }
  } else {
    const porLetra = new Map(respuesta.textosConLetra.map((t) => [t.letra.toUpperCase(), t.texto]));
    for (const r of d.parejas ?? []) {
      const letra = respuesta.claveOficial[r.id];
      if (letra && porLetra.size && porLetra.get(letra.toUpperCase()) !== r.derecha) fallan.push(r.id);
    }
  }
  return fallan.length ? [`La clave oficial no cuadra con lo leído en: ${fallan.join(", ")}.`] : [];
}

export async function guardarRelleno(tareaId: string, respuesta: RespuestaIA): Promise<ResultadoRelleno> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { ok: false, error: "El mapa no describe esta tarea." };

  const revision = revisarDatos(respuesta.ejercicio);
  if ("error" in revision) return { ok: false, error: `La IA devolvió un ejercicio que no vale: ${revision.error}` };
  if (revision.tipo !== tarea.ejercicio.tipo) return { ok: false, error: "La IA devolvió un ejercicio de otro tipo." };

  const avisos = [...avisosDelMapa(delMapa, respuesta.ejercicio), ...contrastarClave(respuesta, delMapa.motor as "opcion" | "relacionar")];

  await prisma.$transaction(async (tx) => {
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: respuesta.ejercicio as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "TEXTO" } });
    if (respuesta.bloque) {
      await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "TEXTO", texto: respuesta.bloque, orden: 1 } });
    }
    await tx.tareaDeExamen.update({
      where: { id: tareaId },
      data: {
        estado: "RELLENADA",
        rellenadaEl: new Date(),
        revisadaEl: null,
        avisos,
        dudas: respuesta.dudas,
        imagenesPedidas: respuesta.imagenesPedidas.map((i) => ({ ...i, archivoId: null })),
        claveOficial: respuesta.claveOficial ?? Prisma.DbNull,
      },
    });
  });
  return { ok: true, avisos };
}
```

- [ ] **Step 5: La acción y el «hay clave»**

En `lib/acciones-taller.ts` añadir:

```ts
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { tareaDe } from "@/lib/taller/consultas";
import { trozoDeClaves } from "@/lib/taller/cuadernillo";
import { hayClaveDeIA, pedirTarea, SinClaveError } from "@/lib/taller/rellenar";
import { guardarRelleno } from "@/lib/taller/guardar-relleno";

export async function rellenarConIAAccion(tareaId: string): Promise<EstadoTaller> {
  await exigirProfesor();
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { error: "El mapa no describe esta tarea." };
  if (tarea.paginaIds.length === 0) return { error: "Marca antes en qué páginas está esta tarea." };
  const paginas = tarea.examen.paginas.filter((p) => tarea.paginaIds.includes(p.id));
  const archivos = await prisma.archivo.findMany({ where: { id: { in: paginas.map((p) => p.archivoId) } } });
  const porId = new Map(archivos.map((a) => [a.id, a]));
  const imagenes = paginas.map((p) => porId.get(p.archivoId)).filter((a) => a !== undefined)
    .map((a) => ({ bytes: new Uint8Array(a.datos), tipo: (a.tipo as "image/jpeg" | "image/png" | "image/webp") }));
  const claves = tarea.examen.clavesTexto ? trozoDeClaves(tarea.examen.clavesTexto, tarea.examen.numero, tarea.prueba, tarea.numero) : null;
  try {
    const respuesta = await pedirTarea({ tarea: delMapa, prueba: tarea.prueba, numeroExamen: tarea.examen.numero, paginas: imagenes, claves });
    const resultado = await guardarRelleno(tareaId, respuesta);
    revalidatePath(`/dele/taller/${tarea.examenId}`);
    if (!resultado.ok) return { error: resultado.error };
    return { ok: resultado.avisos.length ? `Rellenada, con ${resultado.avisos.length} aviso(s) que revisar.` : "Rellenada." };
  } catch (e) {
    if (e instanceof SinClaveError) return { error: e.message };
    console.error("Rellenar con IA:", e);
    return { error: e instanceof Error ? e.message : "La IA no respondió." };
  }
}

export async function hayClaveDeIAAccion(): Promise<boolean> {
  await exigirProfesor();
  return hayClaveDeIA();
}
```

(`hayClaveDeIA` se lee también directamente en la página de servidor; la acción solo existe para el cliente de «rellenar las ocho».)

El tiempo de la función lo fija la página que aloja las acciones, no el módulo `"use server"`: en `app/(app)/dele/taller/[id]/page.tsx` añadir `export const maxDuration = 120;` junto a `export const dynamic = "force-dynamic";`.

- [ ] **Step 6: Los botones**

`components/taller/boton-rellenar.tsx` (cliente):

```tsx
"use client";

import { useState, useTransition } from "react";
import { rellenarConIAAccion } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";

export default function BotonRellenar({ tareaId, hayClave, yaRellenada }: { tareaId: string; hayClave: boolean; yaRellenada: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  function pulsar() {
    if (yaRellenada && !window.confirm("Esta tarea ya está rellenada. ¿Sustituir lo que hay?")) return;
    empezar(async () => {
      const r = await rellenarConIAAccion(tareaId);
      setMensaje(r.error ? { tono: "error", texto: r.error } : { tono: "ok", texto: r.ok ?? "Rellenada." });
    });
  }
  return (
    <span className="flex flex-col gap-2">
      <Boton variante="primario" tamano="pequeno" onClick={pulsar} disabled={!hayClave || pendiente} title={hayClave ? undefined : "Falta la clave de la API"}>
        {pendiente ? "Leyendo la página…" : "Rellenar con IA"}
      </Boton>
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
    </span>
  );
}
```

`components/taller/rellenar-todas.tsx` (cliente): recibe `tareas: { id: string; nombre: string }[]` y `hayClave`; un `Boton` «Rellenar las ocho» que, en un `useTransition`, recorre las tareas en serie llamando a `rellenarConIAAccion` y pinta una lista con «Lectura · Tarea 1: rellenada / error: …», sin parar en los errores; al acabar, `router.refresh()` (`useRouter` de `next/navigation`).

En la mesa de trabajo: `const hayClave = hayClaveDeIA();` (importado de `@/lib/taller/rellenar`); si no hay clave, un `Aviso tono="aviso"` arriba: «Falta la clave de la API de Anthropic: ponla en Vercel como ANTHROPIC_API_KEY para poder rellenar con IA.»; `<RellenarTodas>` en el encabezado (`acciones`), y dentro de cada `TarjetaTarea` `<BotonRellenar tareaId hayClave yaRellenada={tarea.estado !== "VACIA"} />` como `children`.

- [ ] **Step 7: El fixture y el script, tercera parte**

`scripts/fixtures/taller-respuesta-ia.json`: una `RespuestaIA` para **CE tarea 3** (opción, 6 preguntas de 3 opciones, `bloque` con un texto corto de 3 párrafos, `claveOficial` `{ "p1": "B", … }` coherente con `correctas`, una duda en `p2.opciones[0]`, `imagenesPedidas: []`, `textosConLetra: []`). Y un segundo fixture `taller-respuesta-ia-mal.json` con la misma tarea pero 5 preguntas y la clave de `p1` en «C» mientras `correctas` dice `[1]`.

En `scripts/verificar-taller.ts`: `guardarRelleno` con el fixture bueno → `ok: true`, `avisos.length === 0`, la tarea en `RELLENADA` con `rellenadaEl`, el `Ejercicio.datos` igual al fixture, un `Bloque TEXTO` en el paso, `cuantosItems === 6`; con el fixture malo → `ok: true` y dos avisos (ítems y clave), y la duda guardada; con `{ ...bueno, ejercicio: { ejercicio: "opcion" } }` → `ok: false` y la tarea intacta (sigue `RELLENADA` del paso anterior, `datos` sin cambiar). `pedirTarea` sin clave (`delete process.env.ANTHROPIC_API_KEY` al principio del script) → rechaza con `SinClaveError`. `esquemaDeHerramienta` para CE 1 y CE 3 → devuelve `properties.ejercicio` con `type: "object"` y `required` con `"ejercicio"`. `textoDelEncargo` para CE 4 contiene «{{p1}}» y para CO 1 contiene «imagenesPedidas» y «null».

Run: `npx tsx scripts/verificar-taller.ts`
Expected: verde.

- [ ] **Step 8: Comprobar, barrido y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-piezas.ts && npx tsx scripts/verificar-carcasa.ts && npx tsx scripts/verificar-taller.ts && npx tsx scripts/verificar-dele.ts && npx tsx scripts/verificar-recursos.ts`
Expected: verde. Build: exportar `DATABASE_URL`/`DIRECT_URL` del `.env` y `npm run build` limpio.

Barrido con sesión de profesor: `GET /dele/taller/<id>` 200 con «Rellenar con IA» ocho veces y, sin `ANTHROPIC_API_KEY` en el entorno del servidor, con «Falta la clave de la API».

```bash
git add package.json package-lock.json lib/pegado/encargo.ts lib/taller lib/acciones-taller.ts components/taller 'app/(app)/dele/taller' scripts
git commit -m "Taller A: rellenar una tarea con Opus 5, validado contra el mapa y la clave"
```

---

## Lo que queda para las sesiones B y C

- **B (spec §3):** `/dele/taller/[id]/tarea/[prueba]/[n]` con la página al lado y el editor por ítems sobre piezas nuevas (`ListaDeItems`, `Item`), «Guardar», «Volver a rellenar», «Marcar revisada» con sus guardas, «Ver como estudiante» (`Asignacion.dePrueba`).
- **C (spec §4 y §5):** opciones con imagen en `opcionSchema` y `components/ejercicios/opcion.tsx`; el panel de imágenes con subida; audio por tarea con onda y cortes (ffmpeg); reproductor encadenado; Publicar/Retirar/Archivar; Asignar a…; la parte final de `verificar-taller.ts` (publicar se niega con siete revisadas; mutación de la guarda).
