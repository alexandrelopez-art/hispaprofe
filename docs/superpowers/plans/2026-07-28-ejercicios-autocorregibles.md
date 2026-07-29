# Cinco tipos de ejercicio autocorregible — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el estudiante pueda resolver cinco tipos de ejercicio distintos, que se corrijan solos en el servidor y que sus puntos entren en la hucha sin que el profesor toque nada.

**Architecture:** Un motor y cinco caras. Cada tipo aporta tres piezas —su forma (esquema zod), su cara (componente de cliente) y su cuenta (función de corrección)— y las registra en un índice. Una sola acción de servidor reparte según el tipo, corrige, guarda las respuestas y escribe los puntos. La corrección nunca sale del servidor mientras el ejercicio está abierto.

**Tech Stack:** Next.js 16 (App Router, React Server Components), React 19, Prisma 7 con adaptador `@prisma/adapter-pg`, zod 4, Tailwind CSS 4, `tsx` para scripts.

**Diseño de referencia:** `docs/superpowers/specs/2026-07-28-ejercicios-autocorregibles-design.md`

## Global Constraints

- **Lee la documentación de Next antes de escribir código.** `AGENTS.md` del repo: esta versión de Next tiene cambios de API respecto a lo que puedas recordar. Los guides están en `node_modules/next/dist/docs/`.
- Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos generados vienen de `@/lib/generated/prisma/client`.
- **Una sola migración en todo el plan** (Tarea 1): añadir `respuestas Json?` a `PasoCompletado`. Ninguna otra tarea toca `prisma/schema.prisma`.
- Interfaz **en español con tildes**. Comentarios en español, cortos, explicando el porqué y no el qué.
- **Las soluciones no salen del servidor** mientras el ejercicio está abierto. Solo viaja la versión pública.
- **Se responde una sola vez.** Si `PasoCompletado.verificadoEl` tiene fecha, la acción no hace nada.
- **Un ejercicio autocorregible por paso.** Se renderiza el primero por orden.
- Los fallos **solo restan en opción múltiple**, y nunca por debajo de cero en esa pregunta.
- **Ordenar puntúa por parejas consecutivas**, no por posición absoluta. N piezas valen N−1 puntos.
- **Los huecos ignoran mayúsculas y espacios sobrantes; los acentos sí cuentan.**
- Tokens de Tailwind del proyecto: `hp-50…hp-700`, `sol-100…sol-400`, `bloque1-3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`. Nada de colores crudos.
- No hay framework de pruebas. La verificación es `npx tsc --noEmit`, `npm run lint` y `scripts/verificar-ejercicios.ts`, siguiendo el precedente de `scripts/verificar-cifrado.ts`.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `prisma/schema.prisma` | **Modificar.** `respuestas Json?` en `PasoCompletado`. | 1 |
| `lib/ejercicios/tipos.ts` | **Crear.** Contrato común: `Respuestas`, `Correccion`, `ItemCorregido`, `normalizar`, `barajarEstable`. | 1 |
| `lib/ejercicios/opcion.ts` | **Crear.** Opción única, múltiple y lista compartida con desplegable. Sustituye a `opcion-multiple.ts`. | 1 |
| `lib/ejercicios/huecos.ts` | **Crear.** Huecos. | 2 |
| `lib/ejercicios/relacionar.ts` | **Crear.** Relacionar. | 3 |
| `lib/ejercicios/ordenar.ts` | **Crear.** Ordenar, con la cuenta por vecindad. | 4 |
| `lib/ejercicios/registro.ts` | **Crear.** Índice de los cinco tipos y `analizar()`. | 4 |
| `lib/acciones.ts` | **Modificar.** `responderEjercicio` sustituye a `responderOpcionMultiple`. | 5 |
| `components/ejercicios/ejercicio.tsx` | **Crear.** Reparte por tipo, pinta consigna, botón y nota. | 6 |
| `components/ejercicios/opcion.tsx` | **Crear.** La cara de opción. Sustituye a `components/opcion-multiple.tsx`. | 6 |
| `components/ejercicios/huecos.tsx` | **Crear.** La cara de huecos. | 6 |
| `components/ejercicios/relacionar.tsx` | **Crear.** La cara de relacionar, arrastrando. | 7 |
| `components/ejercicios/ordenar.tsx` | **Crear.** La cara de ordenar, arrastrando. | 7 |
| `app/(app)/pasos/[pasoId]/page.tsx` | **Modificar.** Renderiza el repartidor en vez del componente suelto. | 6 |
| `scripts/verificar-ejercicios.ts` | **Reescribir.** Cubre los cinco tipos. | 1-4 |
| `scripts/sembrar-ejercicios-demo.ts` | **Crear.** Un ejercicio de cada tipo para probar a mano. | 8 |

Archivos que desaparecen: `lib/ejercicios/opcion-multiple.ts` y `components/opcion-multiple.tsx`, absorbidos en la Tarea 1 y la 6.

---

### Task 1: El contrato común, la migración y el tipo opción

Es la base: define cómo hablan entre sí las cinco piezas y reescribe el tipo que ya existe con la forma nueva.

**Files:**
- Modify: `prisma/schema.prisma` (modelo `PasoCompletado`)
- Create: `prisma/migrations/<timestamp>_respuestas_de_ejercicio/migration.sql` (lo genera Prisma)
- Create: `lib/ejercicios/tipos.ts`
- Create: `lib/ejercicios/opcion.ts`
- Delete: `lib/ejercicios/opcion-multiple.ts`
- Rewrite: `scripts/verificar-ejercicios.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces, desde `@/lib/ejercicios/tipos`:
  - `type Respuestas = Record<string, string | string[]>`
  - `type ItemCorregido = { id: string; acertado: boolean; correcta: string }`
  - `type Correccion = { aciertos: number; total: number; items: ItemCorregido[] }`
  - `function normalizar(s: string): string`
  - `function barajarEstable<T>(items: T[], semilla: string): T[]`
- Produces, desde `@/lib/ejercicios/opcion`:
  - `const opcionSchema` (zod)
  - `type Opcion`
  - `function versionPublicaOpcion(datos: Opcion): OpcionPublica`
  - `function corregirOpcion(datos: Opcion, respuestas: Respuestas): Correccion`
  - `type OpcionPublica = { consigna: string; multiple: boolean; preguntas: { id: string; enunciado: string; opciones: string[]; audio?: string }[] }`

- [ ] **Step 1: Añadir la columna al esquema**

En `prisma/schema.prisma`, dentro del modelo `PasoCompletado`, debajo de `verificadoEl`:

```prisma
  // Lo que respondió el estudiante, con la forma que define cada tipo de
  // ejercicio. Sostiene la corrección al recargar y deja ver al profesor
  // qué contestó, no solo cuánto sacó.
  respuestas   Json?
```

- [ ] **Step 2: Generar y aplicar la migración**

Run: `npx prisma migrate dev --name respuestas_de_ejercicio`
Expected: crea `prisma/migrations/<timestamp>_respuestas_de_ejercicio/migration.sql` con `ALTER TABLE "PasoCompletado" ADD COLUMN "respuestas" JSONB;` y la aplica. El cliente se regenera solo.

- [ ] **Step 3: Escribir el script de verificación (falla, no existe nada)**

Reescribir `scripts/verificar-ejercicios.ts` entero:

```ts
/**
 * Verifica los cinco tipos de ejercicio: que la solución no viaje al
 * navegador y que la cuenta de puntos sea la que dice el diseño.
 * Ejecutar con:  npx tsx scripts/verificar-ejercicios.ts
 */
import "dotenv/config";
import { corregirOpcion, opcionSchema, versionPublicaOpcion, type Opcion } from "@/lib/ejercicios/opcion";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const UNICA: Opcion = {
  ejercicio: "opcion",
  consigna: "Elige",
  multiple: false,
  preguntas: [
    { id: "a", enunciado: "1", opciones: ["si", "no"], correctas: [0] },
    { id: "b", enunciado: "2", opciones: ["si", "no"], correctas: [1] },
  ],
};

const MULTIPLE: Opcion = {
  ejercicio: "opcion",
  consigna: "Marca todas",
  multiple: true,
  presentacion: "botones",
  preguntas: [
    { id: "m", enunciado: "¿Cuáles son habitaciones?", opciones: ["la cocina", "el balcón", "el perro"], correctas: [0, 1] },
  ],
};

// Lista compartida: las mismas opciones para todas las preguntas, y la
// misma opción puede valer en varias. Este es el formato de la captura del
// profesor: frases y un desplegable de nombres.
const COMPARTIDA: Opcion = opcionSchema.parse({
  ejercicio: "opcion",
  consigna: "¿De quién habla cada frase?",
  multiple: false,
  opcionesComunes: ["Fede", "Luisa", "Carmen"],
  presentacion: "desplegable",
  preguntas: [
    { id: "c1", enunciado: "Tiene el pelo rizado.", correctas: [2] },
    { id: "c2", enunciado: "Lleva gafas.", correctas: [2] },
    { id: "c3", enunciado: "Lleva barba.", correctas: [0] },
  ],
});

async function main() {
  // 1. La versión pública no lleva soluciones.
  const publica = JSON.stringify(versionPublicaOpcion(UNICA));
  afirmar(!publica.includes("correctas"), "opción: la versión pública no lleva las soluciones");

  // 2. La cuenta en opción única.
  afirmar(corregirOpcion(UNICA, { a: "0", b: "1" }).aciertos === 2, "opción única: todo acertado da 2");
  afirmar(corregirOpcion(UNICA, { a: "1", b: "1" }).aciertos === 1, "opción única: un acierto da 1");
  afirmar(corregirOpcion(UNICA, {}).aciertos === 0, "opción única: sin responder da 0");

  // 3. En múltiple, marcarlo todo no da el máximo.
  afirmar(corregirOpcion(MULTIPLE, { m: ["0", "1"] }).aciertos === 2, "múltiple: las dos buenas dan 2");
  afirmar(corregirOpcion(MULTIPLE, { m: ["0", "1", "2"] }).aciertos === 1, "múltiple: una mala resta un punto");
  afirmar(corregirOpcion(MULTIPLE, { m: ["2"] }).aciertos === 0, "múltiple: solo la mala da 0, no negativo");
  afirmar(corregirOpcion(MULTIPLE, { m: ["0"] }).aciertos === 1, "múltiple: media respuesta da 1");

  // 4. La corrección dice cuál era la buena.
  const c = corregirOpcion(UNICA, { a: "1", b: "1" });
  afirmar(c.items.length === 2, "la corrección devuelve un resultado por pregunta");
  afirmar(c.items[0].acertado === false, "marca la fallada como fallada");
  afirmar(c.items[0].correcta === "si", "dice cuál era la buena");

  // 5. La lista compartida.
  const pubComp = versionPublicaOpcion(COMPARTIDA);
  afirmar(pubComp.presentacion === "desplegable", "compartida: la presentación viaja al navegador");
  afirmar(
    pubComp.preguntas.every((p) => p.opciones.length === 3),
    "compartida: cada pregunta sale con la lista común ya resuelta",
  );
  afirmar(
    corregirOpcion(COMPARTIDA, { c1: "2", c2: "2", c3: "0" }).aciertos === 3,
    "compartida: la misma opción puede acertar en varias preguntas",
  );
  afirmar(
    corregirOpcion(COMPARTIDA, { c1: "2" }).items[0].correcta === "Carmen",
    "compartida: la corrección resuelve el nombre desde la lista común",
  );
  afirmar(
    opcionSchema.safeParse({
      ejercicio: "opcion", consigna: "x", multiple: false,
      preguntas: [{ id: "z", enunciado: "sin opciones", correctas: [0] }],
    }).success === false,
    "compartida: sin opciones propias ni lista común, la forma se rechaza",
  );
  afirmar(
    opcionSchema.safeParse({
      ejercicio: "opcion", consigna: "x", multiple: false,
      opcionesComunes: ["a", "b"],
      preguntas: [{ id: "z", enunciado: "fuera de rango", correctas: [7] }],
    }).success === false,
    "compartida: una respuesta correcta fuera de rango se rechaza",
  );

  // 5. Lo guardado en la base tiene forma válida.
  const enBase = await prisma.ejercicio.findMany({ select: { titulo: true, datos: true } });
  for (const e of enBase) {
    const d = e.datos as { ejercicio?: string };
    if (d?.ejercicio !== "opcion") continue;
    afirmar(opcionSchema.safeParse(e.datos).success, `"${e.titulo}" tiene forma válida`);
  }

  console.log("\nTodas las verificaciones pasan.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Ejecutarlo y comprobar que falla**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: FAIL al resolver el import — `Cannot find module '@/lib/ejercicios/opcion'`.

- [ ] **Step 5: Crear el contrato común**

Crear `lib/ejercicios/tipos.ts`:

```ts
/**
 * El contrato que comparten los cinco tipos de ejercicio.
 *
 * Cada tipo aporta tres piezas: su forma (esquema zod), su version publica
 * (lo mismo sin las soluciones) y su cuenta (respuestas -> aciertos). Este
 * archivo define el lenguaje en el que esas piezas se hablan.
 */

/**
 * Lo que envia el estudiante, indexado por el identificador del elemento.
 * Cadena cuando la respuesta es una (una opcion, un hueco, una pareja) y
 * lista cuando son varias (opcion multiple, o el orden completo).
 */
export type Respuestas = Record<string, string | string[]>;

export type ItemCorregido = {
  /** Identificador del elemento: pregunta, hueco, pareja o pieza. */
  id: string;
  acertado: boolean;
  /** La respuesta buena, en texto, para poder ensenarsela al fallar. */
  correcta: string;
};

export type Correccion = {
  aciertos: number;
  total: number;
  items: ItemCorregido[];
};

/**
 * Para comparar lo que escribe el estudiante en un hueco: se perdona la
 * mayuscula y los espacios de sobra, pero no la tilde. Escribir "balcon"
 * por "balcon" con tilde es un fallo: esto es una clase de lengua.
 */
export function normalizar(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Baraja siempre igual para la misma semilla. Hace falta porque relacionar
 * y ordenar tienen que ensenar las piezas desordenadas, y un barajado al
 * azar daria un orden distinto en el servidor y en el navegador, que es
 * justo lo que React no perdona.
 */
export function barajarEstable<T>(items: T[], semilla: string): T[] {
  let estado = 0;
  for (let i = 0; i < semilla.length; i++) {
    estado = (estado * 31 + semilla.charCodeAt(i)) >>> 0;
  }
  const siguiente = () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(siguiente() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Una respuesta puede llegar suelta o en lista; aqui se normaliza a lista. */
export function comoLista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return [];
  return Array.isArray(valor) ? valor : [valor];
}
```

- [ ] **Step 6: Crear el tipo opción**

Crear `lib/ejercicios/opcion.ts`:

```ts
import { z } from "zod";
import {
  comoLista,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

// Opcion unica y opcion multiple son el mismo ejercicio con distinto
// control: boton redondo o casilla. Lo decide `multiple`.

export const preguntaOpcionSchema = z.object({
  id: z.string(),
  enunciado: z.string(),
  /** Sus propias opciones. Se omite cuando el ejercicio usa lista comun. */
  opciones: z.array(z.string()).min(2).optional(),
  /** Indices de las opciones buenas. Una sola cuando `multiple` es false. */
  correctas: z.array(z.number().int().min(0)).min(1),
  /** Audio que hay que escuchar para responder. Opcional. */
  audio: z.string().optional(),
});

export const opcionSchema = z
  .object({
    ejercicio: z.literal("opcion"),
    consigna: z.string(),
    multiple: z.boolean(),
    /**
     * Opciones iguales para todas las preguntas: una lista de nombres, por
     * ejemplo. La misma opcion puede valer en varias preguntas, que es lo
     * que distingue este formato de `relacionar`.
     */
    opcionesComunes: z.array(z.string()).min(2).optional(),
    /** Con muchas preguntas y lista comun, once filas de botones son un muro. */
    presentacion: z.enum(["botones", "desplegable"]).default("botones"),
    preguntas: z.array(preguntaOpcionSchema).min(1),
  })
  .refine(
    (d) => d.opcionesComunes !== undefined || d.preguntas.every((p) => p.opciones),
    { message: "Cada pregunta necesita opciones propias, o el ejercicio una lista común." },
  )
  .refine(
    (d) =>
      d.preguntas.every((p) =>
        p.correctas.every((i) => i < (p.opciones ?? d.opcionesComunes ?? []).length),
      ),
    { message: "Alguna respuesta correcta apunta a una opción que no existe." },
  );

export type PreguntaOpcion = z.infer<typeof preguntaOpcionSchema>;
export type Opcion = z.infer<typeof opcionSchema>;

/** Las opciones que le tocan a una pregunta: las suyas, o las comunes. */
export function opcionesDe(datos: Opcion, pregunta: PreguntaOpcion): string[] {
  return pregunta.opciones ?? datos.opcionesComunes ?? [];
}

export type OpcionPublica = {
  consigna: string;
  multiple: boolean;
  presentacion: "botones" | "desplegable";
  preguntas: { id: string; enunciado: string; opciones: string[]; audio?: string }[];
};

export function versionPublicaOpcion(datos: Opcion): OpcionPublica {
  return {
    consigna: datos.consigna,
    multiple: datos.multiple,
    presentacion: datos.presentacion,
    // Cada pregunta sale con su lista ya resuelta: al navegador le da igual
    // si venia de la pregunta o de la lista comun.
    preguntas: datos.preguntas.map((p) => ({
      id: p.id,
      enunciado: p.enunciado,
      opciones: opcionesDe(datos, p),
      audio: p.audio,
    })),
  };
}

/**
 * Un punto por opcion buena marcada. En multiple, cada mala marcada resta
 * uno, sin bajar de cero en esa pregunta: si no, marcarlo todo daria el
 * maximo sin saber nada.
 */
export function corregirOpcion(datos: Opcion, respuestas: Respuestas): Correccion {
  const items: ItemCorregido[] = [];
  let aciertos = 0;
  let total = 0;

  for (const pregunta of datos.preguntas) {
    const opciones = opcionesDe(datos, pregunta);
    const buenas = new Set(pregunta.correctas);
    const marcadas = comoLista(respuestas[pregunta.id])
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n));

    const bien = marcadas.filter((i) => buenas.has(i)).length;
    const mal = marcadas.filter((i) => !buenas.has(i)).length;
    const puntos = datos.multiple ? Math.max(0, bien - mal) : bien;

    aciertos += puntos;
    total += buenas.size;

    items.push({
      id: pregunta.id,
      acertado: puntos === buenas.size && mal === 0,
      correcta: pregunta.correctas.map((i) => opciones[i]).join(", "),
    });
  }

  return { aciertos, total, items };
}
```

- [ ] **Step 7: Dejar el archivo viejo en su sitio, de momento**

**No borres `lib/ejercicios/opcion-multiple.ts` todavía.** `components/opcion-multiple.tsx`, la acción `responderOpcionMultiple` y la página del paso siguen apuntando a él, y borrarlo ahora dejaría un commit que no compila.

Los tres archivos viejos —el módulo, el componente y la acción— conviven sin estorbar con los nuevos hasta que sus sustitutos estén listos: la acción se cambia en la Tarea 5 y el componente y el módulo se borran en la Tarea 6, cuando ya nada les apunta. Cada commit de este plan compila por sí solo.

- [ ] **Step 8: Ejecutar el script y comprobar que pasa**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: once líneas `OK:` y `Todas las verificaciones pasan.`

- [ ] **Step 9: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/ejercicios scripts/verificar-ejercicios.ts lib/acciones.ts "app/(app)/pasos/[pasoId]/page.tsx"
git commit -m "Contrato común de ejercicios, columna de respuestas y tipo opción"
```

---

### Task 2: Huecos

**Files:**
- Create: `lib/ejercicios/huecos.ts`
- Modify: `scripts/verificar-ejercicios.ts`

**Interfaces:**
- Consumes: `Respuestas`, `Correccion`, `ItemCorregido`, `normalizar` de `@/lib/ejercicios/tipos`.
- Produces, desde `@/lib/ejercicios/huecos`:
  - `const huecosSchema` (zod)
  - `type Huecos`
  - `type HuecosPublica = { consigna: string; texto: string; huecos: { id: string }[] }`
  - `function versionPublicaHuecos(datos: Huecos): HuecosPublica`
  - `function corregirHuecos(datos: Huecos, respuestas: Respuestas): Correccion`
  - `function trozos(texto: string): { tipo: "texto" | "hueco"; valor: string }[]`

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Añadir a `scripts/verificar-ejercicios.ts`, al import y al cuerpo de `main`:

```ts
import { corregirHuecos, huecosSchema, trozos, versionPublicaHuecos, type Huecos } from "@/lib/ejercicios/huecos";
```

```ts
const HUECOS: Huecos = {
  ejercicio: "huecos",
  consigna: "Completa",
  texto: "En mi piso {{h1}} tres habitaciones y no {{h2}} balcón.",
  huecos: [
    { id: "h1", acepta: ["hay"] },
    { id: "h2", acepta: ["hay"] },
  ],
};

// Huecos
afirmar(!JSON.stringify(versionPublicaHuecos(HUECOS)).includes("acepta"), "huecos: la versión pública no lleva las soluciones");
afirmar(corregirHuecos(HUECOS, { h1: "hay", h2: "hay" }).aciertos === 2, "huecos: los dos bien dan 2");
afirmar(corregirHuecos(HUECOS, { h1: "Hay", h2: "  hay  " }).aciertos === 2, "huecos: se perdonan mayúsculas y espacios");
afirmar(corregirHuecos(HUECOS, { h1: "hay" }).aciertos === 1, "huecos: uno solo da 1");
afirmar(corregirHuecos(HUECOS, { h1: "es", h2: "es" }).aciertos === 0, "huecos: mal da 0");
afirmar(corregirHuecos(HUECOS, { h1: "balcon", h2: "hay" }).aciertos === 1, "huecos: la tilde y la palabra cuentan");
const partes = trozos(HUECOS.texto);
afirmar(partes.filter((p) => p.tipo === "hueco").length === 2, "huecos: el texto se parte en dos huecos");
afirmar(partes[0].valor.startsWith("En mi piso"), "huecos: conserva el texto de alrededor");
afirmar(huecosSchema.safeParse(HUECOS).success, "huecos: el ejemplo tiene forma válida");
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: FAIL — `Cannot find module '@/lib/ejercicios/huecos'`.

- [ ] **Step 3: Crear el tipo huecos**

Crear `lib/ejercicios/huecos.ts`:

```ts
import { z } from "zod";
import {
  comoLista,
  normalizar,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

// El texto lleva marcas {{id}} donde falta una palabra. Cada marca se
// corresponde con un hueco de la lista.

export const huecoSchema = z.object({
  id: z.string(),
  /** Todas las formas que se dan por buenas en este hueco. */
  acepta: z.array(z.string()).min(1),
});

export const huecosSchema = z.object({
  ejercicio: z.literal("huecos"),
  consigna: z.string(),
  texto: z.string(),
  huecos: z.array(huecoSchema).min(1),
});

export type Huecos = z.infer<typeof huecosSchema>;

export type HuecosPublica = {
  consigna: string;
  texto: string;
  huecos: { id: string }[];
};

export function versionPublicaHuecos(datos: Huecos): HuecosPublica {
  return {
    consigna: datos.consigna,
    texto: datos.texto,
    huecos: datos.huecos.map(({ id }) => ({ id })),
  };
}

/** Parte el texto en trozos alternos para poder dibujar los recuadros. */
export function trozos(
  texto: string,
): { tipo: "texto" | "hueco"; valor: string }[] {
  const salida: { tipo: "texto" | "hueco"; valor: string }[] = [];
  const patron = /\{\{([^}]+)\}\}/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(texto)) !== null) {
    if (m.index > ultimo) {
      salida.push({ tipo: "texto", valor: texto.slice(ultimo, m.index) });
    }
    salida.push({ tipo: "hueco", valor: m[1] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) {
    salida.push({ tipo: "texto", valor: texto.slice(ultimo) });
  }
  return salida;
}

/** Un punto por hueco. Aqui no hay nada que marcar de mas, asi que no resta. */
export function corregirHuecos(datos: Huecos, respuestas: Respuestas): Correccion {
  const items: ItemCorregido[] = [];
  let aciertos = 0;

  for (const hueco of datos.huecos) {
    const escrito = comoLista(respuestas[hueco.id])[0] ?? "";
    const acertado = hueco.acepta.some(
      (bueno) => normalizar(bueno) === normalizar(escrito),
    );
    if (acertado) aciertos++;
    items.push({ id: hueco.id, acertado, correcta: hueco.acepta[0] });
  }

  return { aciertos, total: datos.huecos.length, items };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: todas las líneas `OK:`, incluidas las ocho de huecos.

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/ejercicios/huecos.ts scripts/verificar-ejercicios.ts
git commit -m "Tipo de ejercicio: huecos"
```

---

### Task 3: Relacionar

**Files:**
- Create: `lib/ejercicios/relacionar.ts`
- Modify: `scripts/verificar-ejercicios.ts`

**Interfaces:**
- Consumes: `Respuestas`, `Correccion`, `ItemCorregido`, `barajarEstable`, `comoLista` de `@/lib/ejercicios/tipos`.
- Produces, desde `@/lib/ejercicios/relacionar`:
  - `const relacionarSchema` (zod)
  - `type Relacionar`
  - `type RelacionarPublica = { consigna: string; izquierdas: { id: string; texto: string }[]; derechas: { clave: string; texto: string }[] }`
  - `function versionPublicaRelacionar(datos: Relacionar, semilla: string): RelacionarPublica`
  - `function corregirRelacionar(datos: Relacionar, respuestas: Respuestas, semilla: string): Correccion`

**Nota de diseño — por qué la derecha NO lleva el id de su pareja.** La tentación es mandar cada elemento de la derecha con el `id` de su pareja y comparar. Sería un agujero: los identificadores llegan al navegador, así que bastaría con mirar el código de la página para saber qué va con qué, y todo el cuidado de no mandar soluciones no serviría de nada.

En su lugar, la derecha viaja con una **clave opaca** —`d0`, `d1`, `d2`…— asignada por su posición en la lista barajada, que no dice nada de la pareja. El servidor reconstruye el mismo barajado (la semilla es el id del ejercicio, siempre la misma) y así sabe qué clave corresponde a qué pareja. El estudiante responde `{ [idIzquierda]: clave }` y solo el servidor puede resolverlo.

Por eso `corregirRelacionar` necesita la semilla: sin ella no puede rehacer el barajado.

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Añadir a `scripts/verificar-ejercicios.ts`:

```ts
import { corregirRelacionar, relacionarSchema, versionPublicaRelacionar, type Relacionar } from "@/lib/ejercicios/relacionar";
```

```ts
const RELACIONAR: Relacionar = {
  ejercicio: "relacionar",
  consigna: "Une cada habitación con lo que hay dentro",
  parejas: [
    { id: "p1", izquierda: "la cocina", derecha: "la nevera" },
    { id: "p2", izquierda: "el salón", derecha: "el sofá" },
    { id: "p3", izquierda: "la habitación", derecha: "la cama" },
  ],
};

// Relacionar
const SEMILLA = "semilla-fija";
const pubRel = versionPublicaRelacionar(RELACIONAR, SEMILLA);

// Lo más importante: los ids de pareja NO pueden llegar al navegador.
const jsonRel = JSON.stringify(pubRel);
for (const id of ["p1", "p2", "p3"]) {
  afirmar(!jsonRel.includes(`"${id}"` ) || !jsonRel.includes(`{"clave":"${id}"`), `relacionar: la clave opaca no delata la pareja ${id}`);
}
afirmar(pubRel.derechas.every((d) => /^d\d+$/.test(d.clave)), "relacionar: las derechas usan claves opacas d0, d1, d2");
afirmar(pubRel.izquierdas.length === 3 && pubRel.derechas.length === 3, "relacionar: manda las dos columnas completas");
afirmar(
  versionPublicaRelacionar(RELACIONAR, SEMILLA).derechas.map((d) => d.texto).join() ===
    pubRel.derechas.map((d) => d.texto).join(),
  "relacionar: la misma semilla baraja siempre igual",
);

// La clave que le toca a cada pareja, para poder simular respuestas.
const claveDe = (izquierda: string) => {
  const pareja = RELACIONAR.parejas.find((p) => p.izquierda === izquierda)!;
  return pubRel.derechas.find((d) => d.texto === pareja.derecha)!.clave;
};
afirmar(
  corregirRelacionar(RELACIONAR, { p1: claveDe("la cocina"), p2: claveDe("el salón"), p3: claveDe("la habitación") }, SEMILLA).aciertos === 3,
  "relacionar: las tres bien dan 3",
);
afirmar(
  corregirRelacionar(RELACIONAR, { p1: claveDe("la cocina"), p2: claveDe("la habitación"), p3: claveDe("el salón") }, SEMILLA).aciertos === 1,
  "relacionar: una bien da 1",
);
afirmar(corregirRelacionar(RELACIONAR, {}, SEMILLA).aciertos === 0, "relacionar: sin unir nada da 0");
afirmar(
  corregirRelacionar(RELACIONAR, { p1: claveDe("el salón") }, SEMILLA).items[0].correcta === "la nevera",
  "relacionar: dice cuál era la pareja buena",
);
afirmar(relacionarSchema.safeParse(RELACIONAR).success, "relacionar: el ejemplo tiene forma válida");
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: FAIL — `Cannot find module '@/lib/ejercicios/relacionar'`.

- [ ] **Step 3: Crear el tipo relacionar**

Crear `lib/ejercicios/relacionar.ts`:

```ts
import { z } from "zod";
import {
  barajarEstable,
  comoLista,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

export const parejaSchema = z.object({
  id: z.string(),
  izquierda: z.string(),
  derecha: z.string(),
});

export const relacionarSchema = z.object({
  ejercicio: z.literal("relacionar"),
  consigna: z.string(),
  parejas: z.array(parejaSchema).min(2),
});

export type Relacionar = z.infer<typeof relacionarSchema>;

export type RelacionarPublica = {
  consigna: string;
  izquierdas: { id: string; texto: string }[];
  /** `clave` es opaca a proposito: no dice a que pareja pertenece. */
  derechas: { clave: string; texto: string }[];
};

/**
 * Reparte una clave opaca a cada elemento de la derecha segun su posicion
 * en la lista barajada. Es el nucleo de la seguridad de este tipo: si la
 * derecha viajara con el id de su pareja, bastaria con mirar el codigo de
 * la pagina para resolver el ejercicio entero.
 *
 * El barajado es estable —misma semilla, mismo orden— por dos razones: el
 * servidor tiene que poder rehacerlo para corregir, y un orden distinto en
 * servidor y navegador rompe la hidratacion de React.
 */
function repartirClaves(datos: Relacionar, semilla: string) {
  return barajarEstable(datos.parejas, semilla).map((pareja, i) => ({
    clave: `d${i}`,
    parejaId: pareja.id,
    texto: pareja.derecha,
  }));
}

export function versionPublicaRelacionar(
  datos: Relacionar,
  semilla: string,
): RelacionarPublica {
  return {
    consigna: datos.consigna,
    izquierdas: datos.parejas.map((p) => ({ id: p.id, texto: p.izquierda })),
    derechas: repartirClaves(datos, semilla).map(({ clave, texto }) => ({
      clave,
      texto,
    })),
  };
}

/**
 * Un punto por pareja. No hay nada que marcar de mas, asi que no resta.
 *
 * Necesita la semilla para rehacer el reparto de claves y saber que pareja
 * hay detras de la clave que eligio el estudiante.
 */
export function corregirRelacionar(
  datos: Relacionar,
  respuestas: Respuestas,
  semilla: string,
): Correccion {
  const porClave = new Map(
    repartirClaves(datos, semilla).map((d) => [d.clave, d.parejaId]),
  );

  const items: ItemCorregido[] = [];
  let aciertos = 0;

  for (const pareja of datos.parejas) {
    const clave = comoLista(respuestas[pareja.id])[0];
    const acertado = clave !== undefined && porClave.get(clave) === pareja.id;
    if (acertado) aciertos++;
    items.push({ id: pareja.id, acertado, correcta: pareja.derecha });
  }

  return { aciertos, total: datos.parejas.length, items };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: todas las líneas `OK:`, incluidas las ocho de relacionar.

- [ ] **Step 5: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/ejercicios/relacionar.ts scripts/verificar-ejercicios.ts
git commit -m "Tipo de ejercicio: relacionar"
```

---

### Task 4: Ordenar y el índice de tipos

**Files:**
- Create: `lib/ejercicios/ordenar.ts`
- Create: `lib/ejercicios/registro.ts`
- Modify: `scripts/verificar-ejercicios.ts`

**Interfaces:**
- Consumes: todo lo de las tareas 1-3.
- Produces, desde `@/lib/ejercicios/ordenar`:
  - `const ordenarSchema` (zod), `type Ordenar`
  - `type OrdenarPublica = { consigna: string; piezas: { id: string; texto: string }[] }`
  - `function versionPublicaOrdenar(datos: Ordenar, semilla: string): OrdenarPublica`
  - `function corregirOrdenar(datos: Ordenar, respuestas: Respuestas): Correccion`
- Produces, desde `@/lib/ejercicios/registro`:
  - `type EjercicioAnalizado` — unión discriminada de los cuatro módulos
  - `function analizar(datos: unknown): EjercicioAnalizado | null`
  - `function versionPublica(e: EjercicioAnalizado, semilla: string): unknown`
  - `function corregir(e: EjercicioAnalizado, respuestas: Respuestas): Correccion`

**Nota de diseño:** ordenar cuenta **parejas consecutivas**, no posiciones. Con el orden bueno `A B C D`, quien responda `B C D A` acierta `B→C` y `C→D`: 2 de 3. Con N piezas hay N−1 parejas, así que un ejercicio de seis piezas vale cinco puntos.

- [ ] **Step 1: Escribir las verificaciones (fallan)**

Añadir a `scripts/verificar-ejercicios.ts`:

```ts
import { corregirOrdenar, ordenarSchema, versionPublicaOrdenar, type Ordenar } from "@/lib/ejercicios/ordenar";
import { analizar, corregir, versionPublica } from "@/lib/ejercicios/registro";
```

```ts
const ORDENAR: Ordenar = {
  ejercicio: "ordenar",
  consigna: "Ordena el diálogo",
  piezas: [
    { id: "o1", texto: "Hola, buenos días." },
    { id: "o2", texto: "Busco un piso." },
    { id: "o3", texto: "¿Cuántas habitaciones?" },
    { id: "o4", texto: "Tres, por favor." },
  ],
};

// Ordenar
afirmar(versionPublicaOrdenar(ORDENAR, "s").piezas.length === 4, "ordenar: manda las cuatro piezas");
afirmar(corregirOrdenar(ORDENAR, { orden: ["o1", "o2", "o3", "o4"] }).aciertos === 3, "ordenar: el orden bueno da 3 (cuatro piezas, tres parejas)");
afirmar(corregirOrdenar(ORDENAR, { orden: ["o1", "o2", "o3", "o4"] }).total === 3, "ordenar: el máximo es una pieza menos");
afirmar(corregirOrdenar(ORDENAR, { orden: ["o2", "o3", "o4", "o1"] }).aciertos === 2, "ordenar: el desplazamiento cuesta un punto, no todos");
afirmar(corregirOrdenar(ORDENAR, { orden: ["o4", "o3", "o2", "o1"] }).aciertos === 0, "ordenar: del revés da 0");
afirmar(corregirOrdenar(ORDENAR, {}).aciertos === 0, "ordenar: sin ordenar da 0");
afirmar(ordenarSchema.safeParse(ORDENAR).success, "ordenar: el ejemplo tiene forma válida");

// El índice reparte bien
for (const [nombre, datos] of [["opción", UNICA], ["huecos", HUECOS], ["relacionar", RELACIONAR], ["ordenar", ORDENAR]] as const) {
  const analizado = analizar(datos);
  afirmar(analizado !== null, `el índice reconoce ${nombre}`);
  if (analizado) {
    const publicaJson = JSON.stringify(versionPublica(analizado, "s"));
    for (const palabraProhibida of ["correctas", "acepta", "derecha\":"]) {
      afirmar(!publicaJson.includes(palabraProhibida), `${nombre}: la versión pública no filtra "${palabraProhibida}"`);
    }
    afirmar(corregir(analizado, {}).aciertos === 0, `${nombre}: sin responder, el índice da 0`);
  }
}
afirmar(analizar({ ejercicio: "inventado" }) === null, "el índice rechaza un tipo desconocido");
afirmar(analizar(null) === null, "el índice rechaza datos vacíos");
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: FAIL — `Cannot find module '@/lib/ejercicios/ordenar'`.

- [ ] **Step 3: Crear el tipo ordenar**

Crear `lib/ejercicios/ordenar.ts`:

```ts
import { z } from "zod";
import {
  barajarEstable,
  comoLista,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";

export const piezaSchema = z.object({
  id: z.string(),
  texto: z.string(),
});

export const ordenarSchema = z.object({
  ejercicio: z.literal("ordenar"),
  consigna: z.string(),
  /** Las piezas en su orden correcto. Al estudiante le llegan barajadas. */
  piezas: z.array(piezaSchema).min(2),
});

export type Ordenar = z.infer<typeof ordenarSchema>;

export type OrdenarPublica = {
  consigna: string;
  piezas: { id: string; texto: string }[];
};

export function versionPublicaOrdenar(
  datos: Ordenar,
  semilla: string,
): OrdenarPublica {
  return {
    consigna: datos.consigna,
    piezas: barajarEstable(datos.piezas, semilla),
  };
}

/**
 * Cuenta parejas consecutivas, no posiciones. Con el orden bueno A B C D,
 * responder B C D A acierta B->C y C->D: dos de tres. Puntuar por posicion
 * habria dado cero por un desplazamiento, que castiga un descuido como si
 * fuera desconocimiento.
 *
 * Consecuencia: N piezas valen N-1 puntos.
 */
export function corregirOrdenar(datos: Ordenar, respuestas: Respuestas): Correccion {
  const bueno = datos.piezas.map((p) => p.id);
  const dado = comoLista(respuestas.orden);
  const total = bueno.length - 1;

  // Que pieza va detras de cual, en el orden correcto.
  const siguienteBueno = new Map<string, string>();
  for (let i = 0; i < bueno.length - 1; i++) {
    siguienteBueno.set(bueno[i], bueno[i + 1]);
  }

  const items: ItemCorregido[] = [];
  let aciertos = 0;
  for (let i = 0; i < bueno.length - 1; i++) {
    const id = bueno[i];
    const acertado =
      dado.indexOf(id) !== -1 && dado[dado.indexOf(id) + 1] === siguienteBueno.get(id);
    if (acertado) aciertos++;
    const textoSiguiente =
      datos.piezas.find((p) => p.id === siguienteBueno.get(id))?.texto ?? "";
    items.push({
      id,
      acertado,
      correcta: `después va: ${textoSiguiente}`,
    });
  }

  return { aciertos, total, items };
}
```

- [ ] **Step 4: Crear el índice de tipos**

Crear `lib/ejercicios/registro.ts`:

```ts
import type { Correccion, Respuestas } from "@/lib/ejercicios/tipos";
import { corregirOpcion, opcionSchema, versionPublicaOpcion, type Opcion } from "@/lib/ejercicios/opcion";
import { corregirHuecos, huecosSchema, versionPublicaHuecos, type Huecos } from "@/lib/ejercicios/huecos";
import { corregirRelacionar, relacionarSchema, versionPublicaRelacionar, type Relacionar } from "@/lib/ejercicios/relacionar";
import { corregirOrdenar, ordenarSchema, versionPublicaOrdenar, type Ordenar } from "@/lib/ejercicios/ordenar";

/**
 * El unico sitio que sabe cuantos tipos hay. Anadir un sexto es anadir un
 * caso aqui y su modulo, sin tocar la accion ni la pagina.
 */
export type EjercicioAnalizado =
  | { tipo: "opcion"; datos: Opcion }
  | { tipo: "huecos"; datos: Huecos }
  | { tipo: "relacionar"; datos: Relacionar }
  | { tipo: "ordenar"; datos: Ordenar };

export function analizar(datos: unknown): EjercicioAnalizado | null {
  if (typeof datos !== "object" || datos === null) return null;
  const marca = (datos as { ejercicio?: unknown }).ejercicio;

  if (marca === "opcion") {
    const r = opcionSchema.safeParse(datos);
    return r.success ? { tipo: "opcion", datos: r.data } : null;
  }
  if (marca === "huecos") {
    const r = huecosSchema.safeParse(datos);
    return r.success ? { tipo: "huecos", datos: r.data } : null;
  }
  if (marca === "relacionar") {
    const r = relacionarSchema.safeParse(datos);
    return r.success ? { tipo: "relacionar", datos: r.data } : null;
  }
  if (marca === "ordenar") {
    const r = ordenarSchema.safeParse(datos);
    return r.success ? { tipo: "ordenar", datos: r.data } : null;
  }
  return null;
}

/** Lo que puede ver el estudiante mientras el ejercicio esta abierto. */
export function versionPublica(e: EjercicioAnalizado, semilla: string) {
  switch (e.tipo) {
    case "opcion":
      return versionPublicaOpcion(e.datos);
    case "huecos":
      return versionPublicaHuecos(e.datos);
    case "relacionar":
      return versionPublicaRelacionar(e.datos, semilla);
    case "ordenar":
      return versionPublicaOrdenar(e.datos, semilla);
  }
}

/**
 * La semilla es siempre el id del ejercicio. Relacionar la necesita para
 * rehacer el reparto de claves opacas que hizo `versionPublica`; los demas
 * la ignoran, pero se pasa a todos para que la firma sea una sola.
 */
export function corregir(
  e: EjercicioAnalizado,
  respuestas: Respuestas,
  semilla: string,
): Correccion {
  switch (e.tipo) {
    case "opcion":
      return corregirOpcion(e.datos, respuestas);
    case "huecos":
      return corregirHuecos(e.datos, respuestas);
    case "relacionar":
      return corregirRelacionar(e.datos, respuestas, semilla);
    case "ordenar":
      return corregirOrdenar(e.datos, respuestas);
  }
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: todas las líneas `OK:`, incluidas las de ordenar y las del índice.

- [ ] **Step 6: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/ejercicios/ordenar.ts lib/ejercicios/registro.ts scripts/verificar-ejercicios.ts
git commit -m "Tipo de ejercicio: ordenar, e índice de los cuatro módulos"
```

---

### Task 5: La acción del servidor

**Files:**
- Modify: `lib/acciones.ts` (sustituir `responderOpcionMultiple` por `responderEjercicio`)

**Interfaces:**
- Consumes: `analizar`, `corregir` de `@/lib/ejercicios/registro`; `type Respuestas` de `@/lib/ejercicios/tipos`.
- Produces: `async function responderEjercicio(formData: FormData): Promise<void>`, exportada desde `lib/acciones.ts`.

**Contrato del formulario** que consumen los componentes de las Tareas 6 y 7:

| Campo | Contenido |
|---|---|
| `pasoId` | id del paso |
| `ejercicioId` | id del ejercicio |
| `respuestas` | JSON con la forma `Respuestas` |

Mandar las respuestas como un solo campo JSON, y no como campos sueltos, evita tener que inventar un formato de nombres distinto por tipo.

- [ ] **Step 1: Sustituir la acción**

En `lib/acciones.ts`, cambiar el import de la cabecera:

```ts
import { corregir, analizar } from "@/lib/ejercicios/registro";
import type { Respuestas } from "@/lib/ejercicios/tipos";
```

Y sustituir la función `responderOpcionMultiple` entera (comentada en la Tarea 1) por:

```ts
/**
 * Corrige un ejercicio y convierte los aciertos en puntos.
 *
 * La corrección vive aquí y no en el navegador: las respuestas correctas
 * nunca salen del servidor mientras el ejercicio está abierto.
 *
 * Se responde una sola vez. Si el paso ya tiene fecha de verificación —
 * porque el estudiante ya lo envió, o porque el profesor lo puntuó a mano —
 * la acción no hace nada: repetir hasta acertar vaciaría de sentido la hucha.
 */
export async function responderEjercicio(formData: FormData) {
  const usuario = await getUsuarioActual();
  if (!usuario) return;

  const pasoId = String(formData.get("pasoId") ?? "");
  const ejercicioId = String(formData.get("ejercicioId") ?? "");
  if (!pasoId || !ejercicioId) return;

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return;

  const asignacion = await prisma.asignacion.findUnique({
    where: {
      estudianteId_recorridoId: {
        estudianteId: usuario.id,
        recorridoId: paso.recorridoId,
      },
    },
    select: { id: true, archivada: true },
  });
  if (!asignacion || asignacion.archivada) return;

  // El ejercicio tiene que estar colgado de este paso: si no, cualquiera
  // podría puntuarse con las preguntas de otro.
  const vinculo = await prisma.pasoEjercicio.findUnique({
    where: { pasoId_ejercicioId: { pasoId, ejercicioId } },
    select: { ejercicio: { select: { datos: true } } },
  });
  if (!vinculo) return;

  const analizado = analizar(vinculo.ejercicio.datos);
  if (!analizado) return;

  let respuestas: Respuestas;
  try {
    const bruto: unknown = JSON.parse(String(formData.get("respuestas") ?? "{}"));
    if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return;
    respuestas = bruto as Respuestas;
  } catch {
    return;
  }

  const yaRespondido = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId } },
    select: { verificadoEl: true },
  });
  if (yaRespondido?.verificadoEl) return;

  // La semilla es el id del ejercicio: la misma que usó `versionPublica`
  // al repartir las claves opacas de relacionar.
  const { aciertos } = corregir(analizado, respuestas, ejercicioId);

  // Un ejercicio autocorregible es objetivo, así que sus puntos entran ya
  // verificados: no necesitan el visto bueno del profesor.
  await prisma.pasoCompletado.upsert({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId } },
    update: { puntos: aciertos, verificadoEl: new Date(), respuestas },
    create: {
      asignacionId: asignacion.id,
      pasoId,
      puntos: aciertos,
      verificadoEl: new Date(),
      respuestas,
    },
  });

  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath(`/recorridos/${paso.recorridoId}`);
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (`components/opcion-multiple.tsx` ya no existe o está comentado desde la Tarea 1; si sigue estorbando, bórralo ahora con `git rm components/opcion-multiple.tsx` — se rehace en la Tarea 6.)

- [ ] **Step 3: Volver a pasar el script de ejercicios**

Run: `npx tsx scripts/verificar-ejercicios.ts`
Expected: todas las verificaciones pasan. Confirma que el cambio en la acción no rompió la corrección.

- [ ] **Step 4: Commit**

```bash
git add lib/acciones.ts
git commit -m "Una sola acción de servidor para los cuatro tipos de ejercicio"
```

---

### Task 6: El repartidor, la cara de opción y la de huecos

**Files:**
- Create: `components/ejercicios/ejercicio.tsx`
- Create: `components/ejercicios/opcion.tsx`
- Create: `components/ejercicios/huecos.tsx`
- Delete: `components/opcion-multiple.tsx`
- Modify: `app/(app)/pasos/[pasoId]/page.tsx`

**Interfaces:**
- Consumes: `responderEjercicio` de `@/lib/acciones`; `analizar`, `versionPublica`, `corregir` de `@/lib/ejercicios/registro`; `type Correccion` de `@/lib/ejercicios/tipos`; los tipos públicos de `@/lib/ejercicios/opcion` y `@/lib/ejercicios/huecos`.
- Produces:
  - `components/ejercicios/ejercicio.tsx` → `export default function Ejercicio(props: PropsEjercicio)`, donde
    `type PropsEjercicio = { pasoId: string; ejercicioId: string; tipo: "opcion" | "huecos" | "relacionar" | "ordenar"; publica: unknown; respondido: boolean; puntos: number | null; correccion: Correccion | null }`
  - Cada cara recibe `{ publica, valor, alCambiar, correccion }` y no sabe nada de formularios ni de servidor.

**Cómo encajan:** el repartidor es un componente de cliente que guarda el estado de las respuestas, dibuja la cara que toque, y al enviar manda un único campo `respuestas` con el JSON. Las caras solo pintan y avisan de los cambios.

- [ ] **Step 1: Crear el repartidor**

Crear `components/ejercicios/ejercicio.tsx`:

```tsx
"use client";

import { useState } from "react";
import { responderEjercicio } from "@/lib/acciones";
import type { Correccion, Respuestas } from "@/lib/ejercicios/tipos";
import CaraOpcion from "./opcion";
import CaraHuecos from "./huecos";
import CaraRelacionar from "./relacionar";
import CaraOrdenar from "./ordenar";

export type PropsEjercicio = {
  pasoId: string;
  ejercicioId: string;
  tipo: "opcion" | "huecos" | "relacionar" | "ordenar";
  /** La versión sin soluciones. Su forma la fija cada tipo. */
  publica: unknown;
  respondido: boolean;
  puntos: number | null;
  /** Solo llega cuando el ejercicio ya está cerrado. */
  correccion: Correccion | null;
};

export type PropsCara = {
  publica: unknown;
  valor: Respuestas;
  alCambiar: (nuevo: Respuestas) => void;
  correccion: Correccion | null;
};

export default function Ejercicio({
  pasoId,
  ejercicioId,
  tipo,
  publica,
  respondido,
  puntos,
  correccion,
}: PropsEjercicio) {
  const [valor, setValor] = useState<Respuestas>({});
  const [enviando, setEnviando] = useState(false);

  const consigna = (publica as { consigna?: string }).consigna ?? "";

  const cara = (() => {
    const props: PropsCara = { publica, valor, alCambiar: setValor, correccion };
    switch (tipo) {
      case "opcion":
        return <CaraOpcion {...props} />;
      case "huecos":
        return <CaraHuecos {...props} />;
      case "relacionar":
        return <CaraRelacionar {...props} />;
      case "ordenar":
        return <CaraOrdenar {...props} />;
    }
  })();

  if (respondido) {
    return (
      <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
        <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
          Ejercicio corregido
        </p>
        <p className="mt-2 text-3xl font-extrabold text-tinta">
          {puntos ?? 0}
          <span className="ml-2 text-base font-bold text-tinta-suave">
            de {correccion?.total ?? puntos ?? 0} puntos
          </span>
        </p>
        <p className="mt-1 text-sm text-tinta-suave">
          Ya está sumado a tus puntos. Este ejercicio se responde una sola vez.
        </p>
        <div className="mt-6">{cara}</div>
      </section>
    );
  }

  return (
    <form
      action={async (formData) => {
        setEnviando(true);
        formData.set("respuestas", JSON.stringify(valor));
        await responderEjercicio(formData);
      }}
      className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave"
    >
      <input type="hidden" name="pasoId" value={pasoId} />
      <input type="hidden" name="ejercicioId" value={ejercicioId} />

      <p className="font-bold text-tinta">{consigna}</p>
      <p className="mt-1 text-sm text-tinta-suave">
        Un punto por acierto. Solo puedes enviarlo una vez.
      </p>

      <div className="mt-6">{cara}</div>

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? "Corrigiendo…" : "Enviar respuestas"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Crear la cara de opción**

Crear `components/ejercicios/opcion.tsx`:

```tsx
"use client";

import type { OpcionPublica } from "@/lib/ejercicios/opcion";
import { comoLista } from "@/lib/ejercicios/tipos";
import type { PropsCara } from "./ejercicio";

export default function CaraOpcion({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as OpcionPublica;

  function alternar(preguntaId: string, indice: number) {
    if (!datos.multiple) {
      alCambiar({ ...valor, [preguntaId]: String(indice) });
      return;
    }
    const actuales = new Set(comoLista(valor[preguntaId]));
    const clave = String(indice);
    if (actuales.has(clave)) actuales.delete(clave);
    else actuales.add(clave);
    alCambiar({ ...valor, [preguntaId]: [...actuales] });
  }

  return (
    <ol className="space-y-6">
      {datos.preguntas.map((pregunta, i) => {
        const marcadas = new Set(comoLista(valor[pregunta.id]));
        const item = correccion?.items.find((x) => x.id === pregunta.id);
        return (
          <li key={pregunta.id}>
            <p className="font-semibold text-tinta">
              {i + 1}. {pregunta.enunciado}
            </p>
            {pregunta.audio && (
              <audio controls preload="none" src={pregunta.audio} className="mt-3 w-full max-w-sm">
                Tu navegador no puede reproducir este audio.
              </audio>
            )}

            {/*
              Con lista compartida y muchas preguntas, una fila de botones
              por pregunta sería un muro. El desplegable cabe.
            */}
            {datos.presentacion === "desplegable" ? (
              <select
                value={comoLista(valor[pregunta.id])[0] ?? ""}
                disabled={Boolean(correccion)}
                onChange={(e) => alCambiar({ ...valor, [pregunta.id]: e.target.value })}
                aria-label={pregunta.enunciado}
                className="mt-2 h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400 disabled:opacity-70"
              >
                <option value="">?</option>
                {pregunta.opciones.map((opcion, indice) => (
                  <option key={indice} value={String(indice)}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pregunta.opciones.map((opcion, indice) => {
                const elegida = marcadas.has(String(indice));
                return (
                  <label
                    key={indice}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition ${
                      correccion ? "cursor-default" : "cursor-pointer"
                    } ${
                      elegida
                        ? "border-hp-400 bg-hp-50 font-bold text-tinta"
                        : "border-hp-100 bg-fondo text-tinta hover:border-hp-200"
                    }`}
                  >
                    <input
                      type={datos.multiple ? "checkbox" : "radio"}
                      name={`p-${pregunta.id}`}
                      checked={elegida}
                      disabled={Boolean(correccion)}
                      onChange={() => alternar(pregunta.id, indice)}
                      className="h-4 w-4 shrink-0 accent-hp-400"
                    />
                    <span>{opcion}</span>
                  </label>
                );
              })}
            </div>
            )}
            {item && <Veredicto acertado={item.acertado} correcta={item.correcta} />}
          </li>
        );
      })}
    </ol>
  );
}

/** La marca de acierto o fallo, con la respuesta buena cuando toca. */
export function Veredicto({ acertado, correcta }: { acertado: boolean; correcta: string }) {
  return (
    <p
      className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
        acertado ? "bg-bloque2/25 text-tinta" : "bg-sol-200 text-tinta"
      }`}
    >
      {acertado ? "Bien ✓" : `No. La respuesta era: ${correcta}`}
    </p>
  );
}
```

- [ ] **Step 3: Crear la cara de huecos**

Crear `components/ejercicios/huecos.tsx`:

```tsx
"use client";

import { trozos, type HuecosPublica } from "@/lib/ejercicios/huecos";
import { comoLista } from "@/lib/ejercicios/tipos";
import type { PropsCara } from "./ejercicio";
import { Veredicto } from "./opcion";

export default function CaraHuecos({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as HuecosPublica;
  const partes = trozos(datos.texto);

  return (
    <div>
      <p className="text-lg leading-loose text-tinta">
        {partes.map((parte, i) =>
          parte.tipo === "texto" ? (
            <span key={i}>{parte.valor}</span>
          ) : (
            <input
              key={i}
              type="text"
              value={comoLista(valor[parte.valor])[0] ?? ""}
              disabled={Boolean(correccion)}
              onChange={(e) => alCambiar({ ...valor, [parte.valor]: e.target.value })}
              aria-label="Palabra que falta"
              className="mx-1 inline-block w-32 rounded-lg border-2 border-hp-200 bg-fondo px-2 py-1 text-base text-tinta outline-none focus:border-hp-400 disabled:opacity-70"
            />
          ),
        )}
      </p>

      {correccion && (
        <ul className="mt-4 space-y-2">
          {correccion.items.map((item) => (
            <li key={item.id}>
              <Veredicto acertado={item.acertado} correcta={item.correcta} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Enchufarlo en la página del paso**

En `app/(app)/pasos/[pasoId]/page.tsx`, sustituir los imports del ejercicio:

```tsx
import Ejercicio from "@/components/ejercicios/ejercicio";
import { analizar, corregir, versionPublica } from "@/lib/ejercicios/registro";
import type { Respuestas } from "@/lib/ejercicios/tipos";
```

Sustituir el bloque que cargaba el ejercicio por:

```tsx
  const vinculo = await prisma.pasoEjercicio.findFirst({
    where: { pasoId: paso.id },
    orderBy: { orden: "asc" },
    select: { ejercicio: { select: { id: true, datos: true } } },
  });
  const analizado = vinculo ? analizar(vinculo.ejercicio.datos) : null;
  const hayEjercicio = analizado !== null;

  // La corrección solo se calcula —y por tanto solo viaja al navegador—
  // cuando el ejercicio ya está cerrado y no se puede reenviar.
  const correccion =
    analizado && revisado && registro?.respuestas && vinculo
      ? corregir(analizado, registro.respuestas as Respuestas, vinculo.ejercicio.id)
      : null;
```

Y añadir `respuestas: true` al `select` de `registro`:

```tsx
        select: { completadoEl: true, verificadoEl: true, puntos: true, respuestas: true },
```

Sustituir el render del ejercicio (el bloque `{ejercicio?.success && asignacion && (...)}` y el del profesor) por:

```tsx
      {analizado && asignacion && (
        <Ejercicio
          pasoId={paso.id}
          ejercicioId={vinculo!.ejercicio.id}
          tipo={analizado.tipo}
          publica={versionPublica(analizado, vinculo!.ejercicio.id)}
          respondido={revisado}
          puntos={registro?.puntos ?? null}
          correccion={correccion}
        />
      )}

      {analizado && esProfe && !asignacion && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
            Ejercicio autocorregible · tipo {analizado.tipo}
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-fondo p-4 text-xs text-tinta">
            {JSON.stringify(analizado.datos, null, 2)}
          </pre>
        </section>
      )}
```

- [ ] **Step 5: Borrar el componente viejo**

Run: `git rm components/opcion-multiple.tsx`

- [ ] **Step 6: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Fallará hasta que existan `relacionar.tsx` y `ordenar.tsx` (Tarea 7): créalos ahora como archivos mínimos que devuelvan `null`, con un comentario `// Se rellena en la Tarea 7.`, para que este commit compile.

- [ ] **Step 7: Commit**

```bash
git add components/ejercicios "app/(app)/pasos/[pasoId]/page.tsx"
git commit -m "Repartidor de ejercicios y las caras de opción y huecos"
```

---

### Task 7: Las caras de relacionar y ordenar

**Files:**
- Rewrite: `components/ejercicios/relacionar.tsx`
- Rewrite: `components/ejercicios/ordenar.tsx`

**Interfaces:**
- Consumes: `PropsCara` de `./ejercicio`; `Veredicto` de `./opcion`; `RelacionarPublica` de `@/lib/ejercicios/relacionar`; `OrdenarPublica` de `@/lib/ejercicios/ordenar`; `comoLista` de `@/lib/ejercicios/tipos`.
- Produces: los dos componentes por defecto, con la misma firma que las otras caras.

**Nota:** se arrastra con la API nativa del navegador (`draggable`, `onDragStart`, `onDrop`), sin librería. Además responden a un clic simple —pinchar origen, pinchar destino— para que sigan siendo usables con el dedo o con teclado.

- [ ] **Step 1: Escribir la cara de relacionar**

Reescribir `components/ejercicios/relacionar.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { RelacionarPublica } from "@/lib/ejercicios/relacionar";
import { comoLista } from "@/lib/ejercicios/tipos";
import type { PropsCara } from "./ejercicio";
import { Veredicto } from "./opcion";

export default function CaraRelacionar({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as RelacionarPublica;
  const [cogida, setCogida] = useState<string | null>(null);
  const cerrado = Boolean(correccion);

  function unir(izquierdaId: string, clave: string) {
    if (cerrado) return;
    // Una pieza de la derecha solo puede estar en un sitio: si ya estaba
    // usada en otra fila, se suelta de allí.
    const limpio: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(valor)) {
      if (comoLista(v)[0] !== clave) limpio[k] = v;
    }
    alCambiar({ ...limpio, [izquierdaId]: clave });
    setCogida(null);
  }

  const textoDe = (clave: string) =>
    datos.derechas.find((d) => d.clave === clave)?.texto ?? "";
  const usadas = new Set(Object.values(valor).map((v) => comoLista(v)[0]));

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        <ul className="space-y-2">
          {datos.izquierdas.map((izq) => {
            const elegida = comoLista(valor[izq.id])[0];
            const item = correccion?.items.find((x) => x.id === izq.id);
            return (
              <li key={izq.id}>
                <div
                  onDragOver={(e) => !cerrado && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) unir(izq.id, id);
                  }}
                  onClick={() => cogida && unir(izq.id, cogida)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                    cogida && !cerrado ? "border-hp-400 bg-hp-50" : "border-hp-100 bg-fondo"
                  }`}
                >
                  <span className="text-sm font-semibold text-tinta">{izq.texto}</span>
                  <span className="ml-auto text-sm text-tinta-suave">
                    {elegida ? textoDe(elegida) : "—"}
                  </span>
                </div>
                {item && <Veredicto acertado={item.acertado} correcta={item.correcta} />}
              </li>
            );
          })}
        </ul>

        <ul className="space-y-2">
          {datos.derechas.map((der) => (
            <li key={der.id}>
              <button
                type="button"
                draggable={!cerrado}
                disabled={cerrado}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", der.id)}
                onClick={() => setCogida(der.id === cogida ? null : der.id)}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                  cogida === der.id
                    ? "border-hp-400 bg-hp-50 font-bold"
                    : usadas.has(der.id)
                      ? "border-hp-100 bg-white text-tinta-suave"
                      : "border-hp-100 bg-fondo text-tinta hover:border-hp-200"
                }`}
              >
                {der.texto}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!cerrado && (
        <p className="mt-4 text-xs text-tinta-suave">
          Arrastra cada pieza de la derecha a su fila, o toca una y luego la otra.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Escribir la cara de ordenar**

Reescribir `components/ejercicios/ordenar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { OrdenarPublica } from "@/lib/ejercicios/ordenar";
import { comoLista } from "@/lib/ejercicios/tipos";
import type { PropsCara } from "./ejercicio";
import { Veredicto } from "./opcion";

export default function CaraOrdenar({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as OrdenarPublica;
  const cerrado = Boolean(correccion);

  const guardado = comoLista(valor.orden);
  const [orden, setOrden] = useState<string[]>(
    guardado.length ? guardado : datos.piezas.map((p) => p.id),
  );
  const [cogida, setCogida] = useState<string | null>(null);

  // El repartidor guarda el estado; aquí solo se le avisa del orden actual.
  useEffect(() => {
    alCambiar({ ...valor, orden });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function mover(desde: string, hasta: string) {
    if (cerrado || desde === hasta) return;
    const copia = orden.filter((id) => id !== desde);
    copia.splice(copia.indexOf(hasta), 0, desde);
    setOrden(copia);
    setCogida(null);
  }

  const textoDe = (id: string) => datos.piezas.find((p) => p.id === id)?.texto ?? "";

  return (
    <div>
      <ol className="space-y-2">
        {orden.map((id, i) => {
          const item = correccion?.items.find((x) => x.id === id);
          return (
            <li key={id}>
              <div
                draggable={!cerrado}
                onDragStart={() => setCogida(id)}
                onDragOver={(e) => !cerrado && e.preventDefault()}
                onDrop={() => cogida && mover(cogida, id)}
                onClick={() => (cogida ? mover(cogida, id) : setCogida(id))}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                  cogida === id
                    ? "border-hp-400 bg-hp-50"
                    : "border-hp-100 bg-fondo hover:border-hp-200"
                } ${cerrado ? "cursor-default" : "cursor-grab"}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tinta text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm text-tinta">{textoDe(id)}</span>
              </div>
              {item && <Veredicto acertado={item.acertado} correcta={item.correcta} />}
            </li>
          );
        })}
      </ol>

      {!cerrado && (
        <p className="mt-4 text-xs text-tinta-suave">
          Arrastra las frases para ordenarlas, o toca una y luego el sitio donde va.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Comprobar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Comprobar que el servidor compila**

Run: `npm run dev`, esperar a `Ready`, luego `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` y parar el servidor.
Expected: HTTP 200, sin errores de compilación en el log.

- [ ] **Step 5: Commit**

```bash
git add components/ejercicios/relacionar.tsx components/ejercicios/ordenar.tsx
git commit -m "Caras de relacionar y ordenar, arrastrando o tocando"
```

---

### Task 8: Un ejercicio de cada tipo para probar a mano

**Files:**
- Create: `scripts/sembrar-ejercicios-demo.ts`

**Interfaces:**
- Consumes: los cuatro esquemas de `@/lib/ejercicios/*`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir el sembrador**

Crear `scripts/sembrar-ejercicios-demo.ts`:

```ts
/**
 * Crea una secuencia de prueba con un paso por tipo de ejercicio, para
 * poder recorrerlos a mano con una cuenta de estudiante.
 *
 * Idempotente. Ejecutar con:  npx tsx scripts/sembrar-ejercicios-demo.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { opcionSchema } from "@/lib/ejercicios/opcion";
import { huecosSchema } from "@/lib/ejercicios/huecos";
import { relacionarSchema } from "@/lib/ejercicios/relacionar";
import { ordenarSchema } from "@/lib/ejercicios/ordenar";

const TITULO = "PRUEBA — los cuatro tipos de ejercicio";
const CORREO_PROFE = "a.lopez.ele@hotmail.com";
const CORREO_ALUMNO = "gaspard@hotmail.com";

const EJERCICIOS = [
  {
    titulo: "Prueba · opción única",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "Elige la respuesta correcta.",
      multiple: false,
      preguntas: [
        { id: "a", enunciado: "En mi piso ___ tres habitaciones.", opciones: ["hay", "son", "están"], correctas: [0] },
        { id: "b", enunciado: "En España, a un apartamento se le llama…", opciones: ["piso", "casa"], correctas: [0] },
      ],
    },
  },
  {
    titulo: "Prueba · opción múltiple",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "Marca TODAS las que son partes de la casa.",
      multiple: true,
      preguntas: [
        { id: "m", enunciado: "¿Cuáles son partes de la casa?", opciones: ["la cocina", "el balcón", "el autobús", "el salón"], correctas: [0, 1, 3] },
      ],
    },
  },
  {
    titulo: "Prueba · lista compartida con desplegable",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "¿De quién habla cada frase?",
      multiple: false,
      opcionesComunes: ["Fede", "Luisa", "Carmen", "Manolo", "Nacho", "Elena"],
      presentacion: "desplegable",
      preguntas: [
        { id: "d1", enunciado: "Tiene el pelo rizado.", correctas: [2] },
        { id: "d2", enunciado: "Lleva gafas.", correctas: [2] },
        { id: "d3", enunciado: "Lleva barba.", correctas: [0] },
        { id: "d4", enunciado: "Tiene el pelo largo.", correctas: [1] },
        { id: "d5", enunciado: "Tiene el pelo blanco.", correctas: [3] },
      ],
    },
  },
  {
    titulo: "Prueba · huecos",
    tipoPaso: "ANDAMIAJE" as const,
    esquema: huecosSchema,
    datos: {
      ejercicio: "huecos",
      consigna: "Completa con hay o no hay.",
      texto: "En mi piso {{h1}} dos habitaciones. {{h2}} balcón, pero {{h3}} una terraza.",
      huecos: [
        { id: "h1", acepta: ["hay"] },
        { id: "h2", acepta: ["No hay", "no hay"] },
        { id: "h3", acepta: ["hay"] },
      ],
    },
  },
  {
    titulo: "Prueba · relacionar",
    tipoPaso: "ACTIVIDAD" as const,
    esquema: relacionarSchema,
    datos: {
      ejercicio: "relacionar",
      consigna: "Une cada habitación con lo que hay dentro.",
      parejas: [
        { id: "r1", izquierda: "la cocina", derecha: "la nevera" },
        { id: "r2", izquierda: "el salón", derecha: "el sofá" },
        { id: "r3", izquierda: "la habitación", derecha: "la cama" },
        { id: "r4", izquierda: "el cuarto de baño", derecha: "la ducha" },
      ],
    },
  },
  {
    titulo: "Prueba · ordenar",
    tipoPaso: "MACRO_TAREA" as const,
    esquema: ordenarSchema,
    datos: {
      ejercicio: "ordenar",
      consigna: "Ordena el correo a la inmobiliaria.",
      piezas: [
        { id: "o1", texto: "Hola, buenos días." },
        { id: "o2", texto: "Busco un piso en Valencia." },
        { id: "o3", texto: "¿Hay ascensor?" },
        { id: "o4", texto: "Gracias, un saludo." },
      ],
    },
  },
];

async function main() {
  const profe = await prisma.user.findUnique({ where: { email: CORREO_PROFE } });
  if (!profe) throw new Error(`No encuentro al profesor ${CORREO_PROFE}`);
  const alumno = await prisma.user.findUnique({ where: { email: CORREO_ALUMNO } });
  if (!alumno) throw new Error(`No encuentro al estudiante ${CORREO_ALUMNO}`);

  const previos = await prisma.recorrido.findMany({
    where: { titulo: TITULO },
    select: { id: true, pasos: { select: { id: true } } },
  });
  for (const r of previos) {
    const pasoIds = r.pasos.map((p) => p.id);
    const vinculos = await prisma.pasoEjercicio.findMany({ where: { pasoId: { in: pasoIds } }, select: { ejercicioId: true } });
    await prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.ejercicio.deleteMany({ where: { id: { in: vinculos.map((v) => v.ejercicioId) } } });
    await prisma.asignacion.deleteMany({ where: { recorridoId: r.id } });
    await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.paso.deleteMany({ where: { recorridoId: r.id } });
    await prisma.recorrido.delete({ where: { id: r.id } });
    console.log("Versión anterior borrada.");
  }

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: TITULO,
      descripcion: "Secuencia de prueba: un paso por tipo de ejercicio.",
      nivel: "A1",
      tipo: "RECORRIDO",
      orden: 99,
      publicado: false,
      autorId: profe.id,
    },
    select: { id: true },
  });

  let orden = 1;
  for (const e of EJERCICIOS) {
    e.esquema.parse(e.datos);
    const paso = await prisma.paso.create({
      data: {
        recorridoId: recorrido.id,
        orden,
        ciclo: 1,
        tipo: e.tipoPaso,
        titulo: e.titulo,
      },
      select: { id: true },
    });
    const ejercicio = await prisma.ejercicio.create({
      data: {
        tipo: "OPCION_MULTIPLE",
        titulo: e.titulo,
        nivel: "A1",
        etiquetas: ["prueba"],
        datos: e.datos,
        publicado: false,
        autorId: profe.id,
      },
      select: { id: true },
    });
    await prisma.pasoEjercicio.create({
      data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
    });
    console.log(`  paso ${orden}: ${e.titulo}`);
    orden++;
  }

  await prisma.asignacion.create({
    data: {
      estudianteId: alumno.id,
      profesorId: profe.id,
      recorridoId: recorrido.id,
      nota: "Secuencia de prueba de los cuatro tipos.",
    },
  });

  console.log(`\nAsignada a ${CORREO_ALUMNO}. Ábrela en /recorridos/${recorrido.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Nota sobre `tipo: "OPCION_MULTIPLE"`:** la columna `Ejercicio.tipo` sirve para filtrar en la biblioteca, pero quien manda de verdad es el discriminador `ejercicio` que va dentro de `datos`. Los cuatro se guardan con el mismo valor de columna porque `TipoEjercicio` no tiene un valor por tipo y este plan no toca la enumeración. Queda anotado como deuda para el proyecto del editor.

- [ ] **Step 2: Ejecutar el sembrador**

Run: `npx tsx scripts/sembrar-ejercicios-demo.ts`
Expected: cinco pasos creados y la secuencia asignada.

- [ ] **Step 3: Pasar todas las verificaciones**

Run: `npx tsx scripts/verificar-ejercicios.ts && npx tsx scripts/verificar-puntos.ts && npx tsc --noEmit && npm run lint`
Expected: todo pasa.

- [ ] **Step 4: Comprobación a mano**

Run: `npm run dev`

Con una cuenta de estudiante, recorrer los seis pasos:
1. **Opción única** — solo deja marcar una por pregunta.
2. **Opción múltiple** — deja marcar varias. Marcarlas todas debe dar menos puntos que marcar solo las buenas.
3. **Lista compartida** — un desplegable por frase con los seis nombres; **Carmen debe poder elegirse en dos frases a la vez**, que es lo que distingue este formato de relacionar.
4. **Huecos** — escribir "Hay" con mayúscula cuenta como acierto.
5. **Relacionar** — arrastrar una pieza a su fila; soltarla en otra fila la quita de la primera.
6. **Ordenar** — arrastrar para reordenar; los números se renumeran.

Y una comprobación de seguridad que solo se puede hacer aquí: en el paso de **relacionar**, abrir el código fuente de la página (clic derecho → ver código) y buscar los identificadores de pareja (`r1`, `r2`…). **No deben aparecer junto a la columna derecha**: si aparecieran, el ejercicio sería resoluble leyendo la página.

Después de enviar cada uno: aparece la nota, cada elemento se marca en verde o rojo, los fallados muestran la respuesta buena, y no se puede reenviar. Recargar la página conserva la corrección.

Comprobar por último en `/dashboard` de esa cuenta que la hucha ha subido con la suma de los cinco.

- [ ] **Step 5: Commit**

```bash
git add scripts/sembrar-ejercicios-demo.ts
git commit -m "Secuencia de prueba con un ejercicio de cada tipo"
```

---

## Fuera de alcance

- **Seleccionar palabras dentro de un texto.** Aplazado por el profesor.
- **La pantalla para crear ejercicios.** Hoy se siembran con script.
- **Varios ejercicios autocorregibles en un mismo paso.**
- **Ver las respuestas del estudiante desde la ficha del profesor.** La columna queda guardada; la pantalla que la muestra no entra aquí.
- **Un valor de `TipoEjercicio` por tipo.** Los cuatro se guardan como `OPCION_MULTIPLE`; el discriminador real vive en `datos.ejercicio`.
