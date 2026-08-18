# Pegar el examen entero — plan de implementación

> **SUPERADO. NO EJECUTAR.** Ninguna de sus cinco tareas se implementó, y
> `lib/pegado-dele.ts`, `lib/acciones-pegado.ts` y `pegar-examen.tsx` no
> existen ni van a existir. El porqué está en la cabecera de su diseño,
> `docs/superpowers/specs/2026-08-11-pegar-el-examen-design.md`.
>
> Lo que se implementó es el plan del 1 de agosto,
> `docs/superpowers/plans/2026-08-01-pegar-por-codigo.md`, que resuelve el
> mismo problema con otra forma —una tarea por viaje, dentro de la ficha de su
> paso— y que además compone el encargo para la IA, cosa que este plan no
> hacía.
>
> Se deja como rastro de la decisión, no como trabajo pendiente. Que su fecha
> sea posterior no significa que sea el vigente: es al contrario.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una caja en la página de la secuencia que recibe el JSON de una prueba del DELE y monta sus tareas —paso, bloques, ejercicio publicado y enganche—, saltándose las que ya están y explicando las que no valen.

**Architecture:** Las reglas van en `lib/pegado-dele.ts`, no dentro del `"use server"`, por el motivo que `lib/recursos.ts:90` ya deja escrito: todo lo que exporta un `"use server"` es un endpoint público y un script no puede ejercitarlo sin sesión. `lib/acciones-pegado.ts` es una envoltura fina con `exigirProfesor()` y `revalidatePath`. El cliente (`pegar-examen.tsx`) hace la fase de audios llamando a `POST /api/archivos`, que ya existe.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Prisma 7, Zod 4, TypeScript. Sin framework de test: la verificación son scripts `npx tsx` con una función `afirmar`, como el resto del proyecto.

## Global Constraints

- Diseño de referencia: `docs/superpowers/specs/2026-08-11-pegar-el-examen-design.md`. Ante cualquier duda, manda el spec.
- **Esto NO es el Next.js de tu memoria.** Antes de escribir código de framework, lee la guía que toque en `node_modules/next/dist/docs/`. Lo pide `AGENTS.md`.
- Todo el código, los comentarios y los mensajes de error **en castellano**, con el tono del proyecto: se explica el porqué, no el qué.
- Ningún componente de cliente puede importar `lib/recursos.ts` ni `lib/pegado-dele.ts`: arrastran `node:crypto` y `prisma`. El aviso está en `lib/recursos.ts:12`.
- Los mensajes de error del schema **no se reescriben**: `revisarDatos` ya los devuelve redactados y con la ruta del campo. Se enseñan tal cual.
- El recuento de ítems es **aviso, no error**. Nunca impide montar.
- Verificación: `npx tsx scripts/verificar-pegado-dele.ts`. Comprobación de tipos: `npx tsc --noEmit`. Lint: `npm run lint`.
- La base de desarrollo es `hispaprofe_dev`. Lo que se monte ahí no llega a producción solo: eso es `scripts/copiar-a-produccion.ts`.

## Estructura de archivos

| Archivo | De qué responde |
|---|---|
| `lib/pegado-dele.ts` (nuevo) | El sobre, la revisión tarea a tarea y el montaje. Sin sesión: lo ejercita el script. |
| `lib/acciones-pegado.ts` (nuevo) | `"use server"`. Dos acciones finas: `exigirProfesor()`, llamar a `lib/`, `revalidatePath`. |
| `app/(app)/recorridos/[id]/pegar-examen.tsx` (nuevo) | Componente de cliente: la caja, la tabla de estados, la fase de audios. |
| `app/(app)/recorridos/[id]/page.tsx:377-383` (modificar) | Pintarlo dentro del guardián que ya existe. |
| `scripts/verificar-pegado-dele.ts` (nuevo) | Las seis afirmaciones del spec. Crece a lo largo de las tareas 1, 2 y 4. |

---

### Task 1: El sobre

**Files:**
- Create: `lib/pegado-dele.ts`
- Create: `scripts/verificar-pegado-dele.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export type TareaPegada = { numero: number; audio?: string; texto?: string; ejercicio?: unknown }`
  - `export type Sobre = { nivel: string; prueba: string; titulo?: string; duracion?: number; convocatoria?: string; tareas: TareaPegada[] }`
  - `export function analizarSobre(json: string): { sobre: Sobre } | { error: string }`

- [ ] **Step 1: Escribe el verificador con sus primeras afirmaciones**

Crea `scripts/verificar-pegado-dele.ts`:

```ts
/**
 * Verifica el pegado de una prueba del DELE: el sobre, la revisión tarea a
 * tarea y el montaje en dos pasadas.
 *
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-pegado-dele.ts
 */
import "dotenv/config";
import { analizarSobre } from "@/lib/pegado-dele";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function main() {
  // ─── El sobre ────────────────────────────────────────────────────────
  const roto = analizarSobre("{esto no es json");
  afirmar("error" in roto, "un JSON ilegible no revienta: devuelve un error");

  const sinTareas = analizarSobre(JSON.stringify({ nivel: "B1", prueba: "CE", tareas: [] }));
  afirmar("error" in sinTareas, "un sobre sin tareas se rechaza");

  const sinNivel = analizarSobre(JSON.stringify({ prueba: "CE", tareas: [{ numero: 1 }] }));
  afirmar("error" in sinNivel, "un sobre sin nivel se rechaza");

  const bueno = analizarSobre(
    JSON.stringify({
      nivel: "A2_B1_ESCOLAR",
      prueba: "CO",
      titulo: "A2/B1 escolar · Comprensión auditiva (mayo 2015)",
      duracion: 30,
      convocatoria: "mayo 2015",
      tareas: [{ numero: 2, texto: "## Mensajes", ejercicio: { ejercicio: "relacionar" } }],
    }),
  );
  afirmar("sobre" in bueno, "un sobre completo se acepta");
  if (!("sobre" in bueno)) return;
  afirmar(bueno.sobre.tareas[0].numero === 2, "el número de la tarea llega tal cual");
  afirmar(bueno.sobre.convocatoria === "mayo 2015", "la convocatoria llega tal cual");
  afirmar(bueno.sobre.duracion === 30, "la duración llega, aunque solo sea informativa");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Ejecútalo para verlo fallar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: FALLO al importar — `Cannot find module '@/lib/pegado-dele'`.

- [ ] **Step 3: Escribe `lib/pegado-dele.ts` con lo mínimo**

```ts
import { z } from "zod";

/**
 * El sobre que se pega: una prueba entera del DELE.
 *
 * `nivel` y `prueba` son cadenas y no enums a propósito: no se validan contra
 * una lista repetida aquí, sino contra el `nivel` y la `destreza` de la
 * secuencia elegida, que es lo único que puede decir si este JSON va en este
 * sitio. Duplicar la lista de niveles sería un segundo sitio donde
 * desincronizarse del enum de la base.
 *
 * `ejercicio` es `unknown` porque es literalmente la columna `datos`: quien
 * la valida es `revisarDatos`, con el esquema del tipo que declare por dentro.
 * Un esquema intermedio aquí solo podría equivocarse.
 */
const tareaPegadaSchema = z.object({
  numero: z.number().int({ message: "El número de la tarea tiene que ser un número entero." }),
  audio: z.string().optional(),
  texto: z.string().optional(),
  ejercicio: z.unknown(),
});

export const sobreSchema = z.object({
  nivel: z.string().min(1, { message: "Al sobre le falta el nivel." }),
  prueba: z.string().min(1, { message: "Al sobre le falta la prueba." }),
  /** Informativos: se enseñan y ahí acaban. Ver el diseño. */
  titulo: z.string().optional(),
  duracion: z.number().optional(),
  /** Lo único del sobre que llega a la base: las etiquetas del ejercicio. */
  convocatoria: z.string().optional(),
  tareas: z
    .array(tareaPegadaSchema)
    .min(1, { message: "El sobre no trae ninguna tarea." }),
});

export type TareaPegada = z.infer<typeof tareaPegadaSchema>;
export type Sobre = z.infer<typeof sobreSchema>;

/**
 * Lee el JSON pegado, o dice por qué no se pudo.
 *
 * Los dos fallos se distinguen porque piden arreglos distintos: un JSON
 * ilegible es un copiado a medias, y un sobre incompleto es un JSON bien
 * formado al que le falta algo.
 */
export function analizarSobre(json: string): { sobre: Sobre } | { error: string } {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch {
    return { error: "Eso no es JSON: puede que se haya copiado a medias." };
  }

  const r = sobreSchema.safeParse(crudo);
  if (!r.success) {
    // El primero basta: arreglado ese, al volver a pegar sale el siguiente.
    // Misma regla que `motivoDeZod` en `lib/recursos.ts`.
    const primero = r.error.issues[0];
    const donde = primero.path.length > 0 ? ` (${primero.path.join(" → ")})` : "";
    return { error: `${primero.message}${donde}` };
  }

  return { sobre: r.data };
}
```

- [ ] **Step 4: Ejecútalo para verlo pasar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: siete líneas `OK:` y salida 0.

- [ ] **Step 5: Comprueba tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/pegado-dele.ts scripts/verificar-pegado-dele.ts
git commit -m "El sobre de una prueba pegada, y su verificador"
```

---

### Task 2: La revisión, tarea a tarea

**Files:**
- Modify: `lib/pegado-dele.ts`
- Modify: `scripts/verificar-pegado-dele.ts`

**Interfaces:**
- Consumes: `analizarSobre`, `Sobre`, `TareaPegada` de la tarea 1.
- Produces:
  - `export type Contexto = { nivel: Nivel; destreza: Destreza; titulo: string; ocupados: Set<number> }`
  - `export type FilaRevision = { numero: number; estado: "monta" | "ya-esta" | "error"; error?: string; aviso?: string; audioPorTraer?: string }`
  - `export type Revision = { error: string } | { filas: FilaRevision[] }`
  - `export function revisarPrueba(sobre: Sobre, contexto: Contexto): Revision`

- [ ] **Step 1: Añade las afirmaciones de la revisión al verificador**

Añade estos imports al principio de `scripts/verificar-pegado-dele.ts`:

```ts
import { analizarSobre, revisarPrueba, type Contexto, type Sobre } from "@/lib/pegado-dele";
```

Y este bloque dentro de `main()`, después del bloque «El sobre»:

```ts
  // ─── La revisión ─────────────────────────────────────────────────────
  // A2/B1 escolar CO: cuatro tareas. La 2 es `relacionar` (seis parejas de
  // nueve opciones) y la 3 es `opcion` con lista común.
  const contexto: Contexto = {
    nivel: "A2_B1_ESCOLAR",
    destreza: "CO",
    titulo: "Prueba de mayo",
    ocupados: new Set<number>(),
  };

  /** Una tarea 2 válida: seis parejas, nueve derechas (tres sobran). */
  function tarea2(extra: Record<string, unknown> = {}) {
    return {
      numero: 2,
      texto: "## Mensajes",
      ejercicio: {
        ejercicio: "relacionar",
        consigna: "Relaciona cada mensaje con su enunciado.",
        parejas: Array.from({ length: 6 }, (_, i) => ({
          id: `p${i + 1}`,
          izquierda: `Mensaje ${i + 1}`,
          derecha: `Enunciado ${i + 1}`,
        })),
        sobrantes: ["Sobrante A", "Sobrante B", "Sobrante C"],
      },
      ...extra,
    };
  }

  const sobreDe = (tareas: unknown[]): Sobre => {
    const r = analizarSobre(JSON.stringify({ nivel: "A2_B1_ESCOLAR", prueba: "CO", tareas }));
    if (!("sobre" in r)) throw new Error(`el sobre de prueba no vale: ${r.error}`);
    return r.sobre;
  };

  // El sobre que no cuadra con la secuencia: se rechaza entero.
  const otraPrueba = analizarSobre(
    JSON.stringify({ nivel: "A2_B1_ESCOLAR", prueba: "CE", tareas: [tarea2()] }),
  );
  if (!("sobre" in otraPrueba)) throw new Error("el sobre de CE no se pudo leer");
  const cruzada = revisarPrueba(otraPrueba.sobre, contexto);
  afirmar("error" in cruzada, "un sobre de CE contra una secuencia de CO se rechaza entero");

  // La tarea buena.
  const sana = revisarPrueba(sobreDe([tarea2()]), contexto);
  afirmar("filas" in sana, "un sobre que cuadra devuelve filas");
  if (!("filas" in sana)) return;
  afirmar(sana.filas[0].estado === "monta", "una tarea válida sale como «monta»");
  afirmar(sana.filas[0].aviso === undefined, "seis parejas son las que pide el mapa: sin aviso");

  // El paso ya existe.
  const ocupada = revisarPrueba(sobreDe([tarea2()]), {
    ...contexto,
    ocupados: new Set([2]),
  });
  if (!("filas" in ocupada)) return;
  afirmar(ocupada.filas[0].estado === "ya-esta", "una tarea que ya tiene paso sale como «ya está»");

  // Un número que el mapa no tiene.
  const fuera = revisarPrueba(sobreDe([{ ...tarea2(), numero: 9 }]), contexto);
  if (!("filas" in fuera)) return;
  afirmar(fuera.filas[0].estado === "error", "una tarea 9 en una prueba de cuatro es un error");

  // El motor equivocado: el mapa pide `relacionar` en la tarea 2.
  const motorMalo = revisarPrueba(
    sobreDe([
      {
        numero: 2,
        ejercicio: {
          ejercicio: "opcion",
          consigna: "…",
          multiple: false,
          preguntas: [{ id: "1", enunciado: "¿?", opciones: ["a", "b"], correctas: [0] }],
        },
      },
    ]),
    contexto,
  );
  if (!("filas" in motorMalo)) return;
  afirmar(
    motorMalo.filas[0].estado === "error" && /relacionar/.test(motorMalo.filas[0].error ?? ""),
    "un motor que no es el que pide el mapa es un error, y lo dice",
  );

  // Datos que el esquema no acepta: el motivo sale de `revisarDatos`.
  const datosMalos = revisarPrueba(
    sobreDe([{ numero: 2, ejercicio: { ejercicio: "relacionar", consigna: "…", parejas: [] } }]),
    contexto,
  );
  if (!("filas" in datosMalos)) return;
  afirmar(
    datosMalos.filas[0].estado === "error" && (datosMalos.filas[0].error ?? "").length > 0,
    "unos datos que el esquema rechaza salen con el motivo que da el esquema",
  );

  // EL PORTERO DE LAS ESCUCHAS: audio dentro de una pareja.
  const audioDentro = revisarPrueba(
    sobreDe([
      {
        numero: 2,
        ejercicio: {
          ejercicio: "relacionar",
          consigna: "Relaciona.",
          parejas: Array.from({ length: 6 }, (_, i) => ({
            id: `p${i + 1}`,
            izquierda: `Mensaje ${i + 1}`,
            derecha: `Enunciado ${i + 1}`,
            ...(i === 0 ? { audio: "/api/archivos/abc" } : {}),
          })),
          sobrantes: ["A", "B", "C"],
        },
      },
    ]),
    contexto,
  );
  if (!("filas" in audioDentro)) return;
  afirmar(
    audioDentro.filas[0].estado === "error",
    "un audio dentro de una pareja se rechaza: las escuchas se cuentan por pareja y el racionamiento quedaría roto",
  );

  // El audio de la tarea: enlace externo → hay que traerlo.
  const conEnlace = revisarPrueba(
    sobreDe([tarea2({ audio: "https://drive.google.com/file/d/xyz/view" })]),
    contexto,
  );
  if (!("filas" in conEnlace)) return;
  afirmar(
    conEnlace.filas[0].audioPorTraer === "https://drive.google.com/file/d/xyz/view",
    "un audio externo se apunta como «por traer»",
  );

  const yaNuestro = revisarPrueba(sobreDe([tarea2({ audio: "/api/archivos/abc" })]), contexto);
  if (!("filas" in yaNuestro)) return;
  afirmar(
    yaNuestro.filas[0].audioPorTraer === undefined,
    "un audio que ya es nuestro no se vuelve a traer",
  );

  // El aviso de ítems: cinco parejas donde el mapa pide seis.
  const pocas = revisarPrueba(
    sobreDe([
      {
        numero: 2,
        ejercicio: {
          ejercicio: "relacionar",
          consigna: "Relaciona.",
          parejas: Array.from({ length: 5 }, (_, i) => ({
            id: `p${i + 1}`,
            izquierda: `Mensaje ${i + 1}`,
            derecha: `Enunciado ${i + 1}`,
          })),
          sobrantes: ["A", "B", "C", "D"],
        },
      },
    ]),
    contexto,
  );
  if (!("filas" in pocas)) return;
  afirmar(
    pocas.filas[0].estado === "monta" && (pocas.filas[0].aviso ?? "").length > 0,
    "faltarle un ítem es AVISO y no error: se sigue pudiendo montar (la tarea 1 de esta prueba solo puede llevar 3 de 7)",
  );
```

- [ ] **Step 2: Ejecútalo para verlo fallar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: FALLO — `revisarPrueba` no existe (`Cannot find name` en `tsx`, o `is not a function`).

- [ ] **Step 3: Implementa `revisarPrueba`**

Añade a `lib/pegado-dele.ts`, después de `analizarSobre`:

```ts
import { avisoDeItems, tareaDe } from "@/lib/dele";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { revisarDatos } from "@/lib/recursos";

// Este módulo es solo de servidor: `revisarDatos` arrastra `lib/recursos.ts`,
// que importa `prisma` y `node:crypto`. Ningún componente de cliente puede
// importarlo — el mismo aviso que lleva `lib/recursos.ts:12`.

/**
 * Lo que la secuencia elegida aporta a la revisión. Se pasa entero en vez de
 * un `recorridoId` para que esto no consulte nada: así el verificador puede
 * ejercitar las once reglas de abajo sin crear una sola fila.
 */
export type Contexto = {
  nivel: Nivel;
  destreza: Destreza;
  /** El título de la secuencia: da nombre a los ejercicios. */
  titulo: string;
  /** Los números de tarea que ya tienen paso, según `numeroDeTarea`. */
  ocupados: Set<number>;
};

export type FilaRevision = {
  numero: number;
  estado: "monta" | "ya-esta" | "error";
  /** El motivo del no. Solo cuando el estado es `error`. */
  error?: string;
  /** Lo que el mapa dice del recuento de ítems. Nunca impide montar. */
  aviso?: string;
  /** La dirección externa del audio de la tarea, si hay que traerla. */
  audioPorTraer?: string;
};

export type Revision = { error: string } | { filas: FilaRevision[] };

/**
 * Si el `datos` de un ejercicio lleva un audio colgado de un ítem.
 *
 * Hace falta comprobarlo a mano porque `audio: z.string().optional()` acepta
 * cualquier cadena: Zod no puede ser el portero de esto. Y hay que ser
 * portero, porque las escuchas se cuentan por id de pregunta o de pareja
 * (`maximoDeEscucha`, `lib/escuchas.ts:106`): seis ítems apuntando al MP3 de
 * la tarea le darían a cada uno su propia cuota, y el racionamiento del
 * examen dejaría de significar nada. El audio de una tarea va como bloque
 * `AUDIO` del paso, cuyo tope es 1.
 */
function audioEnLosItems(datos: unknown): boolean {
  const d = datos as
    | { preguntas?: unknown; parejas?: unknown }
    | null
    | undefined;
  return [d?.preguntas, d?.parejas].some(
    (lista) =>
      Array.isArray(lista) &&
      lista.some(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          (item as { audio?: unknown }).audio !== undefined,
      ),
  );
}

/** Si esa dirección ya apunta a un archivo nuestro. */
function esNuestro(direccion: string): boolean {
  return direccion.startsWith("/api/archivos/");
}

/**
 * Revisa el sobre contra la secuencia elegida y el mapa del examen. No
 * escribe nada y no consulta nada.
 *
 * Devuelve `error` —y ninguna fila— cuando el fallo es del sobre entero: eso
 * no es un problema de una tarea suelta y montar «las que valen» no tendría
 * sentido si el JSON es de otro examen.
 */
export function revisarPrueba(sobre: Sobre, contexto: Contexto): Revision {
  if (sobre.nivel !== contexto.nivel || sobre.prueba !== contexto.destreza) {
    return {
      error:
        `Este JSON es de ${sobre.nivel} · ${sobre.prueba} y esta secuencia es de ` +
        `${contexto.nivel} · ${contexto.destreza}. Comprueba de qué examen es.`,
    };
  }

  const filas = sobre.tareas.map((tarea): FilaRevision => {
    const delMapa = tareaDe(contexto.nivel, contexto.destreza, tarea.numero);
    if (!delMapa) {
      return {
        numero: tarea.numero,
        estado: "error",
        error: `El mapa no tiene una tarea ${tarea.numero} en esta prueba.`,
      };
    }

    // Antes de mirar el contenido: si el paso ya está, no hay nada que decir
    // de él. Es lo que hace que volver a pegar sea gratis.
    if (contexto.ocupados.has(tarea.numero)) {
      return { numero: tarea.numero, estado: "ya-esta" };
    }

    if (audioEnLosItems(tarea.ejercicio)) {
      return {
        numero: tarea.numero,
        estado: "error",
        error:
          "Hay un audio colgado de una pregunta o de una pareja. El audio de " +
          "una tarea va en el campo `audio` de la tarea, no dentro del " +
          "ejercicio: si no, cada ítem traería su propia cuota de escuchas.",
      };
    }

    const revision = revisarDatos(tarea.ejercicio);
    if ("error" in revision) {
      // El motivo sale tal cual: ya viene en castellano y con la ruta del
      // campo. Reescribirlo aquí solo lo empeoraría.
      return { numero: tarea.numero, estado: "error", error: revision.error };
    }

    const marca = (tarea.ejercicio as { ejercicio?: unknown }).ejercicio;
    if (marca !== delMapa.motor) {
      return {
        numero: tarea.numero,
        estado: "error",
        error: `La tarea ${tarea.numero} de esta prueba se construye con «${delMapa.motor}», y esto es «${String(marca)}».`,
      };
    }

    return {
      numero: tarea.numero,
      estado: "monta",
      // Aviso y no error: el mapa tiene tareas `verificado: false`, y hay
      // tareas que el motor no sabe construir enteras —la 1 de A2/B1 escolar
      // CO responde con dibujos en cuatro de sus siete ítems—.
      aviso: avisoDeItems(delMapa, tarea.ejercicio) ?? undefined,
      // Solo de las que se van a montar: bajar 28 MB para una tarea que la
      // escritura va a rechazar es tiempo del profesor y una fila que nadie
      // usará.
      audioPorTraer:
        tarea.audio && !esNuestro(tarea.audio) ? tarea.audio : undefined,
    };
  });

  return { filas };
}
```

- [ ] **Step 4: Ejecútalo para verlo pasar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: todas las líneas en `OK:`.

Si falla «seis parejas son las que pide el mapa: sin aviso», abre `lib/dele/mapa.ts` y comprueba `items` y `opciones` de la tarea 2 de `A2_B1_ESCOLAR`/`CO` (deben ser 6 y 9) y el esquema de `sobrantes` en `lib/ejercicios/relacionar.ts`. Ajusta los datos del verificador, **no** la regla.

- [ ] **Step 5: Comprueba tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/pegado-dele.ts scripts/verificar-pegado-dele.ts
git commit -m "Revisar una prueba pegada contra el mapa y la secuencia"
```

---

### Task 3: El contexto, leído de la secuencia

**Files:**
- Modify: `lib/pegado-dele.ts`
- Modify: `scripts/verificar-pegado-dele.ts`

**Interfaces:**
- Consumes: `Contexto` de la tarea 2.
- Produces: `export async function contextoDe(recorridoId: string): Promise<Contexto | { error: string }>`

- [ ] **Step 1: Añade las afirmaciones del contexto**

Añade `contextoDe` al import de `@/lib/pegado-dele` en el verificador, declara estas variables de módulo junto a las demás (arriba del archivo, fuera de `main`):

```ts
// Los ids de todo lo que se crea, en variables de módulo para poder limpiarlo
// desde el `.finally()` aunque una afirmación reviente a mitad.
let recorridoId: string | null = null;
let profesorId: string | null = null;
```

y añade este bloque al final de `main()`:

```ts
  // ─── El contexto, leído de la secuencia ──────────────────────────────
  const marca = `verificar-pegado-${process.pid}`;
  const profe = await prisma.user.create({
    data: { email: `${marca}@ejemplo.test`, role: "PROFESOR" },
    select: { id: true },
  });
  profesorId = profe.id;

  const secuencia = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · CO`,
      nivel: "A2_B1_ESCOLAR",
      destreza: "CO",
      tipo: "PREPARACION_DELE",
      orden: 9999,
      autorId: profe.id,
    },
    select: { id: true },
  });
  recorridoId = secuencia.id;

  const ctx = await contextoDe(secuencia.id);
  afirmar(!("error" in ctx), "una secuencia de preparación con prueba da contexto");
  if ("error" in ctx) return;
  afirmar(ctx.destreza === "CO" && ctx.nivel === "A2_B1_ESCOLAR", "el contexto trae nivel y prueba");
  afirmar(ctx.titulo === `${marca} · CO`, "el contexto trae el título, que nombra los ejercicios");
  afirmar(ctx.ocupados.size === 0, "una secuencia recién creada no tiene ninguna tarea ocupada");

  // Un paso «Tarea 3» ocupa la tarea 3, por su título y no por su posición.
  await prisma.paso.create({
    data: { recorridoId: secuencia.id, titulo: "Tarea 3", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  const ctx2 = await contextoDe(secuencia.id);
  if ("error" in ctx2) return;
  afirmar(
    ctx2.ocupados.has(3) && !ctx2.ocupados.has(1),
    "un paso «Tarea 3» con orden 1 ocupa la 3 y no la 1: manda el título, como en numeroDeTarea",
  );

  // Una secuencia que no es una prueba no da contexto.
  const libre = await prisma.recorrido.create({
    data: { titulo: `${marca} · libre`, nivel: "B1", tipo: "CLASES_PARTICULARES", orden: 9998, autorId: profe.id },
    select: { id: true },
  });
  const ctxLibre = await contextoDe(libre.id);
  afirmar("error" in ctxLibre, "una secuencia de clases particulares no da contexto");
  await prisma.recorrido.delete({ where: { id: libre.id } });
```

Y cambia el `.finally()` para que limpie:

```ts
  .finally(async () => {
    if (recorridoId) {
      const pasos = await prisma.paso.findMany({ where: { recorridoId }, select: { id: true } });
      const pasoIds = pasos.map((p) => p.id);
      const vinculos = await prisma.pasoEjercicio.findMany({
        where: { pasoId: { in: pasoIds } },
        select: { ejercicioId: true },
      });
      // El orden importa: primero lo que apunta al paso, luego el paso.
      await prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.ejercicio.deleteMany({
        where: { id: { in: vinculos.map((v) => v.ejercicioId) } },
      });
      await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.paso.deleteMany({ where: { recorridoId } });
      await prisma.recorrido.delete({ where: { id: recorridoId } });
    }
    if (profesorId) await prisma.user.delete({ where: { id: profesorId } });
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Ejecútalo para verlo fallar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: FALLO — `contextoDe` no existe.

- [ ] **Step 3: Implementa `contextoDe`**

Añade a `lib/pegado-dele.ts` (y añade `numeroDeTarea` al import de `@/lib/dele`, y `import { prisma } from "@/lib/prisma";`):

```ts
/**
 * El contexto de una secuencia, o el motivo de que no lo tenga.
 *
 * `ocupados` se calcula con `numeroDeTarea`, la misma regla que usan la ficha
 * del paso y el panel de tareas sugeridas. Contarlo de otra manera aquí haría
 * que el pegado diera por libre una tarea que sí está, y `puedeEngancharse`
 * lo pararía después con un mensaje que no explica nada.
 */
export async function contextoDe(
  recorridoId: string,
): Promise<Contexto | { error: string }> {
  const recorrido = await prisma.recorrido.findUnique({
    where: { id: recorridoId },
    select: {
      titulo: true,
      nivel: true,
      destreza: true,
      tipo: true,
      pasos: { select: { titulo: true, orden: true } },
    },
  });
  if (!recorrido) return { error: "Esa secuencia no existe." };

  if (recorrido.tipo !== "PREPARACION_DELE" || !recorrido.destreza) {
    return {
      error: "Esta secuencia no es una prueba del DELE, así que no hay tareas que montar.",
    };
  }

  return {
    nivel: recorrido.nivel,
    destreza: recorrido.destreza,
    titulo: recorrido.titulo,
    ocupados: new Set(recorrido.pasos.map(numeroDeTarea)),
  };
}
```

- [ ] **Step 4: Ejecútalo para verlo pasar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: todas en `OK:`, y ninguna línea de basura en la limpieza.

- [ ] **Step 5: Comprueba tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/pegado-dele.ts scripts/verificar-pegado-dele.ts
git commit -m "El contexto de la secuencia para el pegado, con ocupados por numeroDeTarea"
```

---

### Task 4: El montaje

**Files:**
- Modify: `lib/pegado-dele.ts`
- Modify: `scripts/verificar-pegado-dele.ts`

**Interfaces:**
- Consumes: `contextoDe`, `revisarPrueba`, `Sobre`, `FilaRevision`.
- Produces: `export async function montarPrueba(recorridoId: string, sobre: Sobre, autorId: string): Promise<{ error: string } | { filas: FilaRevision[]; montadas: number[] }>`

- [ ] **Step 1: Añade las afirmaciones del montaje**

Añade `montarPrueba` al import y este bloque al final de `main()`:

```ts
  // ─── El montaje ──────────────────────────────────────────────────────
  // Una secuencia limpia para las dos pasadas. La de arriba ya tiene un paso
  // «Tarea 3» puesto a mano, que serviría de excusa a un fallo.
  const dos = await prisma.recorrido.create({
    data: {
      titulo: `${marca} · dos pasadas`,
      nivel: "A2_B1_ESCOLAR",
      destreza: "CO",
      tipo: "PREPARACION_DELE",
      orden: 9997,
      autorId: profe.id,
    },
    select: { id: true },
  });
  segundoRecorridoId = dos.id;

  // Tarea 2 buena, tarea 3 con los datos rotos (una lista común de una sola
  // opción, que su esquema rechaza).
  const tarea3Mala = {
    numero: 3,
    ejercicio: {
      ejercicio: "opcion",
      consigna: "¿Quién lo dice?",
      multiple: false,
      opcionesComunes: ["Ella"],
      preguntas: [{ id: "1", enunciado: "Enunciado 1", correctas: [0] }],
    },
  };

  const conAudio = tarea2({ audio: "/api/archivos/inventado" });
  const primeraPasada = await montarPrueba(dos.id, sobreDe([conAudio, tarea3Mala]), profe.id);
  afirmar(!("error" in primeraPasada), "la primera pasada no falla por tener una tarea mala");
  if ("error" in primeraPasada) return;
  afirmar(
    primeraPasada.montadas.length === 1 && primeraPasada.montadas[0] === 2,
    "monta las que valen: la 2 entra y la 3 no",
  );

  const trasUna = await prisma.paso.findMany({
    where: { recorridoId: dos.id },
    select: { titulo: true, orden: true, bloques: true, ejercicios: { select: { ejercicio: true } } },
  });
  afirmar(trasUna.length === 1, "solo se creó un paso");
  afirmar(trasUna[0].titulo === "Tarea 2", "el paso se llama «Tarea 2»");
  afirmar(trasUna[0].orden === 2, "el orden es el número de la tarea, no max+1");
  afirmar(
    trasUna[0].ejercicios.length === 1 && trasUna[0].ejercicios[0].ejercicio.publicado,
    "el ejercicio queda enganchado y publicado, o puedeEngancharse lo rechazaría",
  );
  afirmar(
    trasUna[0].ejercicios[0].ejercicio.titulo === `${marca} · dos pasadas · Tarea 2`,
    "el ejercicio se llama «<secuencia> · Tarea N»",
  );
  afirmar(
    analizar(trasUna[0].ejercicios[0].ejercicio.datos) !== null,
    "el motor acepta los datos que se guardaron",
  );

  // Los bloques: el AUDIO antes del TEXTO.
  const bloques = [...trasUna[0].bloques].sort((a, b) => a.orden - b.orden);
  afirmar(bloques.length === 2, "se crearon los dos bloques: el audio y el texto");
  afirmar(bloques[0].tipo === "AUDIO" && bloques[0].url === "/api/archivos/inventado", "el audio va primero");
  afirmar(bloques[1].tipo === "TEXTO" && bloques[1].texto === "## Mensajes", "el texto va después");

  // EL RACIONAMIENTO DE VERDAD, no solo la fila creada.
  const maximo = await maximoDeEscucha(
    (await prisma.paso.findFirstOrThrow({ where: { recorridoId: dos.id }, select: { id: true } })).id,
    bloques[0].id,
  );
  afirmar(maximo === 1, "el bloque AUDIO de una prueba se puede oír una sola vez");

  // Segunda pasada: la 3 arreglada. La 2 no se duplica.
  const tarea3Buena = {
    numero: 3,
    ejercicio: {
      ejercicio: "opcion",
      consigna: "¿Quién lo dice?",
      multiple: false,
      opcionesComunes: ["Ella", "Él", "Ninguno"],
      preguntas: Array.from({ length: 6 }, (_, i) => ({
        id: `${i + 1}`,
        enunciado: `Enunciado ${i + 1}`,
        correctas: [i % 3],
      })),
    },
  };
  const segundaPasada = await montarPrueba(dos.id, sobreDe([conAudio, tarea3Buena]), profe.id);
  if ("error" in segundaPasada) return;
  afirmar(
    segundaPasada.montadas.length === 1 && segundaPasada.montadas[0] === 3,
    "la segunda pasada monta solo la 3: la 2 ya estaba",
  );
  afirmar(
    (await prisma.paso.count({ where: { recorridoId: dos.id, titulo: "Tarea 2" } })) === 1,
    "no hay dos «Tarea 2»: volver a pegar es gratis",
  );

  // Un audio que no es nuestro no se monta: la fase 2 tenía que haberlo traído.
  const sinTraer = await montarPrueba(
    dos.id,
    sobreDe([{ ...tarea2(), numero: 4, audio: "https://drive.google.com/file/d/x/view" }]),
    profe.id,
  );
  afirmar("error" in sinTraer, "un audio de Drive sin traer no se monta");
  afirmar(
    (await prisma.paso.count({ where: { recorridoId: dos.id } })) === 2,
    "y no dejó ningún paso a medias",
  );
```

Añade a los imports del verificador:

```ts
import { analizar } from "@/lib/ejercicios/registro";
import { maximoDeEscucha } from "@/lib/escuchas";
```

Declara `let segundoRecorridoId: string | null = null;` junto a las otras variables de módulo, y en el `.finally()` haz la misma limpieza para él. Extrae la limpieza a una función para no copiarla dos veces:

```ts
async function limpiarSecuencia(id: string) {
  const pasos = await prisma.paso.findMany({ where: { recorridoId: id }, select: { id: true } });
  const pasoIds = pasos.map((p) => p.id);
  const vinculos = await prisma.pasoEjercicio.findMany({
    where: { pasoId: { in: pasoIds } },
    select: { ejercicioId: true },
  });
  await prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } });
  await prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } });
  await prisma.ejercicio.deleteMany({ where: { id: { in: vinculos.map((v) => v.ejercicioId) } } });
  await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
  await prisma.paso.deleteMany({ where: { recorridoId: id } });
  await prisma.recorrido.delete({ where: { id } });
}
```

- [ ] **Step 2: Ejecútalo para verlo fallar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: FALLO — `montarPrueba` no existe.

- [ ] **Step 3: Implementa `montarPrueba`**

Añade a `lib/pegado-dele.ts`:

```ts
/**
 * Monta las tareas que valen. Escribe, y no toca la red.
 *
 * Repite entera la revisión antes de escribir: no se fía de lo que el cliente
 * diga que estaba bien, por el mismo motivo que `maximoDeEscucha` no acepta el
 * tope de quien llama —un `"use server"` exportado es un endpoint público—.
 *
 * Una transacción **por tarea**, no una para todo: si una fallara a mitad, una
 * transacción única deshacería también las buenas, y eso es «todo o nada».
 * Por tarea, cada una es atómica —no queda un paso sin su ejercicio— y las
 * demás sobreviven.
 */
export async function montarPrueba(
  recorridoId: string,
  sobre: Sobre,
  autorId: string,
): Promise<{ error: string } | { filas: FilaRevision[]; montadas: number[] }> {
  const contexto = await contextoDe(recorridoId);
  if ("error" in contexto) return contexto;

  const revision = revisarPrueba(sobre, contexto);
  if ("error" in revision) return revision;

  // A estas alturas ya no puede quedar ningún enlace de fuera: traerlos es la
  // fase anterior, y montarlos tal cual dejaría un reproductor que no suena.
  const pendiente = revision.filas.find((f) => f.audioPorTraer);
  if (pendiente) {
    return {
      error: `El audio de la tarea ${pendiente.numero} todavía no se ha traído. Tráelo antes de montar.`,
    };
  }

  const porNumero = new Map(sobre.tareas.map((t) => [t.numero, t]));
  const nivelLegible =
    contexto.nivel === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : contexto.nivel;
  const montadas: number[] = [];

  for (const fila of revision.filas) {
    if (fila.estado !== "monta") continue;
    const tarea = porNumero.get(fila.numero);
    if (!tarea) continue;

    // El tipo de la columna sale de `revisarDatos`, que es el único sitio
    // donde `Ejercicio.tipo` y `datos.ejercicio` pueden discrepar.
    const revisada = revisarDatos(tarea.ejercicio);
    if ("error" in revisada) continue;

    await prisma.$transaction(async (tx) => {
      const paso = await tx.paso.create({
        data: {
          recorridoId,
          titulo: `Tarea ${tarea.numero}`,
          tipo: "ACTIVIDAD",
          ciclo: 1,
          destreza: contexto.destreza,
          // El número y no `max+1`: montar la 3 después de la 4 la dejaría
          // pintada al final, detrás de la 4.
          orden: tarea.numero,
        },
        select: { id: true },
      });

      // El audio antes del texto: en la auditiva se escucha antes de leer.
      let orden = 1;
      if (tarea.audio) {
        await tx.bloque.create({
          data: {
            pasoId: paso.id,
            orden: orden++,
            tipo: "AUDIO",
            url: tarea.audio,
            etiqueta: `Audio de la tarea ${tarea.numero}`,
          },
        });
      }
      if (tarea.texto) {
        await tx.bloque.create({
          data: { pasoId: paso.id, orden: orden++, tipo: "TEXTO", texto: tarea.texto },
        });
      }

      const ejercicio = await tx.ejercicio.create({
        data: {
          tipo: revisada.tipo,
          titulo: `${contexto.titulo} · Tarea ${tarea.numero}`,
          nivel: contexto.nivel,
          destreza: contexto.destreza,
          etiquetas: ["DELE", nivelLegible, ...(sobre.convocatoria ? [sobre.convocatoria] : [])],
          datos: tarea.ejercicio as Prisma.InputJsonValue,
          // Publicado, porque `puedeEngancharse` se niega a colgar un
          // borrador de un paso. No expone nada: lo que ve el alumno depende
          // de su asignación y del `publicado` del recorrido.
          publicado: true,
          autorId,
        },
        select: { id: true },
      });

      await tx.pasoEjercicio.create({
        data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
      });
    });

    montadas.push(tarea.numero);
  }

  return { filas: revision.filas, montadas };
}
```

Añade `import { Prisma } from "@/lib/generated/prisma/client";` a los imports del módulo.

- [ ] **Step 4: Ejecútalo para verlo pasar**

Run: `npx tsx scripts/verificar-pegado-dele.ts`
Expected: todas en `OK:`, sin líneas de basura en la limpieza.

- [ ] **Step 5: Comprueba tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/pegado-dele.ts scripts/verificar-pegado-dele.ts
git commit -m "Montar las tareas que valen, una transaccion por tarea"
```

---

### Task 5: La pantalla

**Files:**
- Create: `lib/acciones-pegado.ts`
- Create: `app/(app)/recorridos/[id]/pegar-examen.tsx`
- Modify: `app/(app)/recorridos/[id]/page.tsx:377-383`

**Interfaces:**
- Consumes: `contextoDe`, `revisarPrueba`, `montarPrueba`, `analizarSobre`, `FilaRevision`.
- Produces: nada que consuma otra tarea.

- [ ] **Step 1: Escribe las dos acciones**

Crea `lib/acciones-pegado.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { exigirProfesor } from "@/lib/profesor";
import {
  analizarSobre,
  contextoDe,
  montarPrueba,
  revisarPrueba,
  type FilaRevision,
} from "@/lib/pegado-dele";

/**
 * Envoltura fina, a propósito. Las reglas viven en `lib/pegado-dele.ts` por lo
 * de siempre en este proyecto: este archivo es `"use server"`, así que todo lo
 * que exporta es un endpoint público y un script no puede ejercitarlo sin
 * sesión. Ver el mismo razonamiento en `lib/recursos.ts:90`.
 */
export type ResultadoPegado =
  | { error: string }
  | { filas: FilaRevision[]; montadas?: number[] };

/** Revisa sin escribir nada. */
export async function revisarPruebaPegada(
  recorridoId: string,
  json: string,
): Promise<ResultadoPegado> {
  await exigirProfesor();

  const leido = analizarSobre(json);
  if ("error" in leido) return leido;

  const contexto = await contextoDe(recorridoId);
  if ("error" in contexto) return contexto;

  return revisarPrueba(leido.sobre, contexto);
}

/** Monta las que valgan y devuelve qué entró. */
export async function montarPruebaPegada(
  recorridoId: string,
  json: string,
): Promise<ResultadoPegado> {
  const profesor = await exigirProfesor();

  const leido = analizarSobre(json);
  if ("error" in leido) return leido;

  const resultado = await montarPrueba(recorridoId, leido.sobre, profesor.id);
  if ("error" in resultado) return resultado;

  revalidatePath(`/recorridos/${recorridoId}`);
  revalidatePath("/recorridos");
  return resultado;
}
```

- [ ] **Step 2: Escribe el componente de cliente**

Crea `app/(app)/recorridos/[id]/pegar-examen.tsx`:

```tsx
"use client";

import { useState } from "react";
import { montarPruebaPegada, revisarPruebaPegada } from "@/lib/acciones-pegado";
import type { FilaRevision } from "@/lib/pegado-dele";

// Solo tipos de `lib/pegado-dele`: ese módulo arrastra `prisma` y
// `node:crypto`. `import type` se borra al compilar, así que no viaja nada.

const ETIQUETA: Record<FilaRevision["estado"], string> = {
  monta: "se monta",
  "ya-esta": "ya está, se salta",
  error: "no se puede",
};

/**
 * Pega el JSON de una prueba entera y monta sus tareas.
 *
 * Tres fases, y la del medio es la que obliga a que esto sea un componente de
 * cliente: los audios se traen **uno por petición** a `/api/archivos`, que ya
 * es el descargador entero. Hacerlo desde el navegador le da a cada descarga
 * sus 300 s enteros, deja ver el progreso, y un fallo en el tercero no pierde
 * los dos primeros: siguen sustituidos en el JSON que hay aquí en memoria.
 */
export default function PegarExamen({ recorridoId }: { recorridoId: string }) {
  const [json, setJson] = useState("");
  const [filas, setFilas] = useState<FilaRevision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [trayendo, setTrayendo] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  /** Cuántas tareas se van a montar, para el botón. */
  const montables = filas?.filter((f) => f.estado === "monta") ?? [];
  const porTraer = montables.filter((f) => f.audioPorTraer);

  async function revisar() {
    setOcupado(true);
    setError(null);
    setHecho(null);
    try {
      const r = await revisarPruebaPegada(recorridoId, json);
      if ("error" in r) {
        setFilas(null);
        setError(r.error);
        return;
      }
      setFilas(r.filas);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Trae los audios que faltan y los sustituye en el JSON de la caja.
   *
   * Se reescribe el texto pegado y no una copia aparte: así lo que se manda a
   * montar es exactamente lo que el profesor tiene delante, y si algo sale
   * mal puede verlo y arreglarlo a mano.
   */
  async function traerAudios() {
    setOcupado(true);
    setError(null);
    try {
      const sobre = JSON.parse(json) as {
        tareas: { numero: number; audio?: string }[];
      };

      for (const fila of porTraer) {
        setTrayendo(`Trayendo el audio de la tarea ${fila.numero}…`);
        const respuesta = await fetch("/api/archivos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: fila.audioPorTraer }),
        });
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) {
          // El mensaje del route ya está redactado y dice qué arreglar.
          setError(`Tarea ${fila.numero}: ${cuerpo.error ?? "no se pudo traer el audio."}`);
          return;
        }
        const tarea = sobre.tareas.find((t) => t.numero === fila.numero);
        if (tarea) tarea.audio = cuerpo.url;
        // Se guarda tras cada uno, no al final: si el siguiente falla, lo ya
        // traído no se pierde y no hay que volver a descargarlo.
        setJson(JSON.stringify(sobre, null, 2));
      }
      await revisar();
    } catch {
      setError("No se pudo leer el JSON para sustituir los audios.");
    } finally {
      setTrayendo(null);
      setOcupado(false);
    }
  }

  async function montar() {
    setOcupado(true);
    setError(null);
    try {
      const r = await montarPruebaPegada(recorridoId, json);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setFilas(r.filas);
      const n = r.montadas?.length ?? 0;
      setHecho(
        n === 0
          ? "No había ninguna tarea que montar."
          : `Montada${n !== 1 ? "s" : ""} ${n} tarea${n !== 1 ? "s" : ""}.`,
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-6 border-t border-hp-100 pt-5">
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
        …o pega el examen entero
      </p>
      <p className="mt-1 text-sm text-tinta-suave">
        El JSON de la prueba. Las tareas que ya tengan paso se saltan.
      </p>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={'{"nivel":"A2_B1_ESCOLAR","prueba":"CO","tareas":[…]}'}
        className="mt-3 w-full rounded-tarjeta border border-hp-200 bg-white p-3 font-mono text-xs text-tinta outline-none focus:border-hp-400"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void revisar()}
          disabled={ocupado || json.trim() === ""}
          className="h-9 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400 disabled:opacity-50"
        >
          Revisar
        </button>

        {porTraer.length > 0 && (
          <button
            onClick={() => void traerAudios()}
            disabled={ocupado}
            className="h-9 rounded-full bg-hp-400 px-4 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-50"
          >
            Traer {porTraer.length} audio{porTraer.length !== 1 ? "s" : ""}
          </button>
        )}

        {filas && porTraer.length === 0 && montables.length > 0 && (
          <button
            onClick={() => void montar()}
            disabled={ocupado}
            className="h-9 rounded-full bg-hp-400 px-4 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-50"
          >
            Montar {montables.length} tarea{montables.length !== 1 ? "s" : ""}
          </button>
        )}

        {trayendo && <span className="text-sm text-tinta-suave">{trayendo}</span>}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-bloque3/20 px-4 py-2 text-sm text-tinta">{error}</p>
      )}
      {hecho && (
        <p className="mt-3 rounded-xl bg-bloque2/25 px-4 py-2 text-sm font-semibold text-tinta">
          {hecho}
        </p>
      )}

      {filas && (
        <ul className="mt-4 space-y-2">
          {filas.map((fila) => (
            <li
              key={fila.numero}
              className={`rounded-xl px-3 py-2 text-sm ${
                fila.estado === "error" ? "bg-sol-100" : "bg-fondo"
              }`}
            >
              <span className="font-semibold text-tinta">Tarea {fila.numero}</span>
              <span className="ml-2 text-tinta-suave">{ETIQUETA[fila.estado]}</span>
              {fila.error && <p className="mt-1 text-tinta">{fila.error}</p>}
              {fila.aviso && <p className="mt-1 text-tinta-suave">{fila.aviso}</p>}
              {fila.audioPorTraer && (
                <p className="mt-1 text-tinta-suave">Su audio está fuera: hay que traerlo.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Píntalo en la página de la secuencia**

En `app/(app)/recorridos/[id]/page.tsx`, añade el import junto al de `TareasSugeridas` (línea 17):

```tsx
import PegarExamen from "./pegar-examen";
```

Y dentro del guardián que ya existe en la línea 377 —`esProfe && recorrido.tipo === "PREPARACION_DELE" && recorrido.destreza`—, añade el componente **después** de `<TareasSugeridas …/>`, dentro del mismo bloque. Si el guardián envuelve un solo elemento, pásalo a un fragmento `<>…</>`.

```tsx
<PegarExamen recorridoId={recorrido.id} />
```

Nota: `TareasSugeridas` se esconde solo cuando no falta ninguna tarea (`if (faltan.length === 0) return null`). `PegarExamen` **no** se esconde: pegar sobre una prueba completa es válido —enseña las cuatro como «ya está»— y es la forma de comprobar que no falta nada.

- [ ] **Step 4: Comprueba tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si `tsc` se queja de que un componente de cliente importa `lib/pegado-dele`, comprueba que el import es `import type` y no un import de valor.

- [ ] **Step 5: Pruébalo en el navegador**

```bash
npm run dev
```

1. Crea una secuencia de preparación de A2/B1 escolar con prueba CO en `/profe/secuencias/nueva`.
2. Ábrela y pega un sobre con la tarea 2 y la 3 (los mismos datos que usa el verificador sirven).
3. «Revisar» → dos filas en «se monta». «Montar 2 tareas» → los pasos aparecen.
4. Vuelve a pegar lo mismo → las dos salen como «ya está» y el botón de montar no aparece.
5. Con un audio de Drive en la tarea: «Traer 1 audio» y comprueba que el JSON de la caja se reescribe con `/api/archivos/<id>`.

- [ ] **Step 6: Commit**

```bash
git add lib/acciones-pegado.ts "app/(app)/recorridos/[id]/pegar-examen.tsx" "app/(app)/recorridos/[id]/page.tsx"
git commit -m "La caja de pegar el examen en la pagina de la secuencia"
```

---

## Autorrevisión del plan

**Cobertura del spec.** Las diez secciones del diseño tienen tarea: la forma del sobre (1), las cinco preguntas por tarea y el portero de las escuchas (2), el `ocupados` por `numeroDeTarea` (3), la escritura con sus tres decisiones —transacción por tarea, `publicado: true`, `orden: N`— (4), las tres fases y el sitio en la página (5). Las seis afirmaciones de «Verificación» quedan repartidas: la 1 y la 2 en la tarea 2, la 3, 4, 5 y 6 en la tarea 4.

**Lo que el plan NO hace, y el spec tampoco pedía:** no borra los `Archivo` que quedan sueltos al abandonar la pantalla a mitad. Está en «Lo que queda suelto» del diseño como precio aceptado.

**Nombres, comprobados de punta a punta:** `analizarSobre` → `revisarPrueba` → `contextoDe` → `montarPrueba` en `lib/pegado-dele.ts`; `revisarPruebaPegada` y `montarPruebaPegada` en las acciones. `FilaRevision.estado` usa `"ya-esta"` con guion en las cuatro apariciones (tarea 2, tarea 4, `ETIQUETA`, la tabla).

**Un aviso para quien lo ejecute:** los datos de ejercicio del verificador (`tarea2`, `tarea3Buena`) están escritos contra los esquemas de `lib/ejercicios/relacionar.ts` y `opcion.ts` tal como están hoy. Si alguna afirmación de datos falla, arregla **los datos del verificador** contra el esquema real, no la regla que se está verificando.
