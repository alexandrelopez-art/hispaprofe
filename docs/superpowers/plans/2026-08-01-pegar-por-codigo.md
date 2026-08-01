# Pegar por código — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir una tercera puerta en la ficha del paso que entrega el encargo para una IA y recibe de vuelta la tarea ya escrita, la valida con el motor de siempre y la engancha al paso.

**Architecture:** Tres módulos puros en `lib/pegado/` —el sobre que se abre, los ejemplos resueltos y el encargo que se compone desde `lib/dele/mapa.ts`—, una acción de servidor que los usa dentro de una transacción, y un componente de cliente en la ficha del paso. No hay migración: no nace ninguna columna ni ninguna tabla.

**Tech Stack:** Next.js (ver `node_modules/next/dist/docs/` antes de tocar rutas o acciones), React 19 (`useActionState`), Prisma, zod, TypeScript. Sin framework de tests: la verificación son scripts `npx tsx scripts/verificar-*.ts`.

## Global Constraints

- **Este Next.js no es el que conoces.** Lee la guía de `node_modules/next/dist/docs/` antes de escribir una acción de servidor o tocar una página. Atiende los avisos de deprecación.
- **Todo el código, los comentarios y los mensajes de error van en castellano.** Es la lengua del proyecto entero, sin excepción.
- **Nada de framework de tests.** La verificación se escribe en `scripts/verificar-pegado.ts` con el helper `afirmar(condicion, mensaje)` copiado de `scripts/verificar-dele.ts`, y se ejecuta con `npx tsx scripts/verificar-pegado.ts`. Ese script se va ampliando tarea a tarea.
- **Lo verificable vive fuera de `"use server"`.** Una acción de servidor necesita sesión de Clerk y contexto de petición, así que un script no puede ejercitarla. Por eso `lib/pegado/*` es puro y la acción solo pega las piezas.
- **Ninguna regla se duplica.** Las negativas de `lib/recursos.ts` se reutilizan llamándolas, no copiándolas.
- **Los mensajes de rechazo del contenido los escribe zod**, que ya los tiene redactados en castellano y explicando el porqué. No se redacta otro encima.
- **El cliente de Prisma se queda pegado.** Si algo del esquema cambiara (aquí no cambia), el `next dev` abierto sigue con el cliente viejo: `npm run fresh`.
- Antes de dar nada por bueno: `npx tsc --noEmit` y `npm run lint`.

---

### Task 1: El sobre — abrirlo, o decir por qué no

**Files:**
- Create: `lib/pegado/sobre.ts`
- Create: `scripts/verificar-pegado.ts`

**Interfaces:**
- Consumes: `revisarDatos` y `type Revision` de `@/lib/recursos`; `analizar` de `@/lib/ejercicios/registro`; `type TipoEjercicio` de `@/lib/generated/prisma/enums`.
- Produces:
  - `sinValla(pegado: string): string`
  - `type SobreAbierto = { bloque: string | null; ejercicio: unknown; tipo: TipoEjercicio }`
  - `type Apertura = SobreAbierto | { error: string }`
  - `abrirSobre(pegado: string): Apertura`
  - `resumir(datos: unknown): string`

- [ ] **Step 1: Escribe la verificación que falla**

Crea `scripts/verificar-pegado.ts` entero:

```ts
/**
 * Verifica el sobre que se pega en un paso y el encargo que se le entrega a
 * la IA. Las dos primeras partes no tocan la base; la tercera crea sus
 * propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-pegado.ts
 */
import "dotenv/config";
import { abrirSobre, resumir, sinValla } from "@/lib/pegado/sobre";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/** Un sobre válido de relacionar, corto pero completo. */
const SOBRE_BUENO = {
  bloque: "## Tablón de anuncios\n\n**A.** Grupo de música busca sala.",
  ejercicio: {
    ejercicio: "relacionar",
    consigna: "Relaciona a cada joven con su anuncio.",
    parejas: [
      { id: "1", izquierda: "MARCOS: toco la guitarra.", derecha: "A. MUSICALDÍA" },
      { id: "2", izquierda: "LUCÍA: quiero una bici.", derecha: "F. AYUNTAMIENTO" },
    ],
    sobrantes: ["C. CREA TU BLOG"],
  },
};

async function main() {
  // ─── La valla de la IA ───────────────────────────────────────────────
  afirmar(
    sinValla('```json\n{"a":1}\n```') === '{"a":1}',
    "sinValla quita la valla ```json que ponen las IA",
  );
  afirmar(
    sinValla('Aquí tienes:\n```\n{"a":1}\n```\n¡Espero que sirva!') === '{"a":1}',
    "sinValla tira lo que la IA escribe antes y después de la valla",
  );
  afirmar(
    sinValla('Aquí tienes: {"a":1} ¡Espero que sirva!') === '{"a":1}',
    "sinValla recorta desde la primera llave hasta la última cuando no hay valla",
  );

  // ─── El sobre bueno ──────────────────────────────────────────────────
  const bueno = abrirSobre(JSON.stringify(SOBRE_BUENO));
  afirmar(!("error" in bueno), "un sobre válido se abre");
  if ("error" in bueno) throw new Error(bueno.error);
  afirmar(bueno.tipo === "RELACIONAR", "el sobre dice el TipoEjercicio de la base");
  afirmar(
    bueno.bloque === SOBRE_BUENO.bloque,
    "el bloque sale tal cual, con su markdown",
  );

  // ─── El ejercicio a pelo, sin sobre ──────────────────────────────────
  // Es el error más probable de una IA, y el único que se acepta en vez de
  // rechazarse: la intención no tiene otra lectura posible.
  const aPelo = abrirSobre(JSON.stringify(SOBRE_BUENO.ejercicio));
  afirmar(!("error" in aPelo), "un ejercicio pegado sin sobre se envuelve solo");
  if ("error" in aPelo) throw new Error(aPelo.error);
  afirmar(aPelo.bloque === null, "un ejercicio sin sobre se queda sin bloque");

  // ─── Las negativas ───────────────────────────────────────────────────
  const vacio = abrirSobre("   ");
  afirmar("error" in vacio, "un cuadro vacío se rechaza");

  const noJson = abrirSobre("esto no es JSON, es una frase");
  afirmar("error" in noJson, "un texto que no es JSON se rechaza");
  afirmar(
    "error" in noJson && !noJson.error.includes("undefined"),
    "el rechazo de lo que no es JSON dice algo legible, no «undefined»",
  );

  const sinCasilla = abrirSobre('{"bloque":"solo el texto"}');
  afirmar(
    "error" in sinCasilla && sinCasilla.error.includes("ejercicio"),
    "un sobre sin la casilla `ejercicio` dice que le falta",
  );

  const bloqueRaro = abrirSobre('{"bloque":42,"ejercicio":{"ejercicio":"ordenar"}}');
  afirmar("error" in bloqueRaro, "un `bloque` que no es texto se rechaza");

  const tipoRaro = abrirSobre('{"ejercicio":{"ejercicio":"inventado"}}');
  afirmar(
    "error" in tipoRaro && tipoRaro.error.includes("tipo"),
    "un ejercicio de tipo desconocido da el motivo de zod",
  );

  // El motivo lo escribe el esquema, no este módulo: se comprueba pidiendo
  // un sobrante que repita una respuesta buena, cuyo mensaje ya está escrito.
  const sobranteRepetido = abrirSobre(
    JSON.stringify({
      ejercicio: {
        ...SOBRE_BUENO.ejercicio,
        sobrantes: ["A. MUSICALDÍA"],
      },
    }),
  );
  afirmar(
    "error" in sobranteRepetido && sobranteRepetido.error.includes("sobrante"),
    "el motivo del rechazo lo escribe el esquema, en castellano",
  );

  // ─── La ida y la vuelta ──────────────────────────────────────────────
  const vuelta = abrirSobre(JSON.stringify(SOBRE_BUENO));
  if ("error" in vuelta) throw new Error(vuelta.error);
  afirmar(
    JSON.stringify(vuelta.ejercicio) === JSON.stringify(SOBRE_BUENO.ejercicio),
    "el ejercicio sale del sobre idéntico a como entró",
  );

  // ─── El resumen ──────────────────────────────────────────────────────
  const dice = resumir(SOBRE_BUENO.ejercicio);
  afirmar(dice.includes("2"), "el resumen cuenta las parejas");
  afirmar(dice.includes("1"), "el resumen cuenta los sobrantes");

  console.log("\nTodo en orden.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-pegado.ts`
Expected: FALLA al importar, con `Cannot find module '@/lib/pegado/sobre'`.

- [ ] **Step 3: Escribe `lib/pegado/sobre.ts`**

```ts
import type { TipoEjercicio } from "@/lib/generated/prisma/enums";
import { analizar } from "@/lib/ejercicios/registro";
import { revisarDatos } from "@/lib/recursos";

// Solo de servidor: `revisarDatos` arrastra `lib/ejercicios/registro.ts`, que
// importa `node:crypto`. Ningún componente de cliente puede importar esto.

/**
 * Quita la valla ```json que las IA ponen alrededor del código, y lo que
 * escriban antes o después.
 *
 * No es una comodidad: casi todas contestan con el JSON dentro de una valla,
 * y muchas con un «Aquí tienes:» delante. Sin esto, el primer intento de
 * todo el mundo falla con «eso no es JSON» y el mensaje no dice qué hacer.
 */
export function sinValla(pegado: string): string {
  const t = pegado.trim();
  const valla = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  if (valla) return valla[1].trim();
  // Sin valla: desde la primera llave hasta la última. Si no hay ninguna,
  // se devuelve tal cual para que sea `JSON.parse` quien dé el motivo.
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  return i >= 0 && j > i ? t.slice(i, j + 1) : t;
}

/** El sobre ya abierto y con su contenido validado por el motor. */
export type SobreAbierto = {
  /** El texto que se lee antes del ejercicio, o null si no traía. */
  bloque: string | null;
  /** Los datos del ejercicio, tal cual entraron. */
  ejercicio: unknown;
  /** La columna `Ejercicio.tipo` que le toca. */
  tipo: TipoEjercicio;
};

export type Apertura = SobreAbierto | { error: string };

/**
 * Abre lo que se ha pegado, o dice por qué no se puede.
 *
 * Lo de dentro no lo valida este módulo: se lo pregunta a `revisarDatos`,
 * que es el mismo portero por el que pasa el editor de Recursos. Así, un
 * ejercicio pegado y otro escrito a mano se rechazan por lo mismo y con las
 * mismas palabras.
 */
export function abrirSobre(pegado: string): Apertura {
  const texto = sinValla(pegado);
  if (!texto) return { error: "No has pegado nada." };

  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch (e) {
    const porque = e instanceof Error ? e.message : "no se pudo leer";
    return { error: `Eso no es JSON: ${porque}` };
  }

  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
    return { error: "El sobre tiene que ser un objeto con `ejercicio` dentro." };
  }

  const dentro = (crudo as Record<string, unknown>).ejercicio;

  /*
   * El ejercicio pegado a pelo, sin sobre. Se reconoce porque `ejercicio` es
   * entonces la marca del motor —una cadena, «relacionar»— en vez del objeto.
   *
   * Es el error más probable de una IA y el único que se acepta en vez de
   * rechazarse: la intención no tiene otra lectura posible, y devolver un «te
   * falta el sobre» sobre un ejercicio perfectamente escrito es pedantería.
   * Se queda sin bloque, que es lo único que se pierde.
   */
  if (typeof dentro === "string") {
    const revision = revisarDatos(crudo);
    if ("error" in revision) return { error: revision.error };
    return { bloque: null, ejercicio: crudo, tipo: revision.tipo };
  }

  if (dentro === undefined) {
    return { error: "Al sobre le falta la casilla `ejercicio`." };
  }

  const bloqueBruto = (crudo as Record<string, unknown>).bloque;
  if (bloqueBruto !== undefined && typeof bloqueBruto !== "string") {
    return { error: "`bloque` tiene que ser el texto que se lee, entre comillas." };
  }
  const bloque = typeof bloqueBruto === "string" ? bloqueBruto.trim() : "";

  const revision = revisarDatos(dentro);
  if ("error" in revision) return { error: revision.error };

  return { bloque: bloque || null, ejercicio: dentro, tipo: revision.tipo };
}

/**
 * Una línea que dice qué se ha entendido: «relacionar · 6 parejas · 3
 * sobrantes».
 *
 * Se enseña antes de guardar y es la que caza el malentendido caro: un
 * ejercicio que dice tres parejas cuando la tarea lleva seis se ve aquí, no
 * cuando el alumno lo abre.
 */
export function resumir(datos: unknown): string {
  const a = analizar(datos);
  // `revisarDatos` acepta además las tareas de expresión, que `analizar` no
  // conoce: no hay nada que contarles.
  if (!a) return "tarea de expresión";

  if (a.tipo === "relacionar") {
    const sobran = a.datos.sobrantes.length;
    const cola = sobran > 0 ? ` · ${sobran} sobrantes` : "";
    return `relacionar · ${a.datos.parejas.length} parejas${cola}`;
  }
  if (a.tipo === "opcion") {
    const cola = a.datos.opcionesComunes ? " · lista común" : "";
    return `opción · ${a.datos.preguntas.length} preguntas${cola}`;
  }
  if (a.tipo === "huecos") {
    return `huecos · ${a.datos.huecos.length} huecos`;
  }
  return `ordenar · ${a.datos.piezas.length} piezas`;
}
```

- [ ] **Step 4: Ejecútala para verla pasar**

Run: `npx tsx scripts/verificar-pegado.ts`
Expected: todas las líneas `OK:` y `Todo en orden.`

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/pegado/sobre.ts scripts/verificar-pegado.ts
git commit -m "El sobre que se pega se abre solo, o dice por qué no"
```

---

### Task 2: `pasoLibre` — una sola copia de cada negativa

**Files:**
- Modify: `lib/recursos.ts:148-176` (la función `puedeEngancharse`)
- Modify: `scripts/verificar-pegado.ts`

**Interfaces:**
- Consumes: `tieneTrabajo` y `prisma`, que ya están en `lib/recursos.ts`.
- Produces: `pasoLibre(pasoId: string): Promise<string | null>` — null si se le puede colgar un ejercicio, y si no, el motivo en castellano.

- [ ] **Step 1: Escribe la verificación que falla**

En `scripts/verificar-pegado.ts`, añade el import y el bloque nuevo. El import, junto a los que ya hay arriba:

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { pasoLibre } from "@/lib/recursos";
```

Justo debajo de la constante `SOBRE_BUENO`, las variables de módulo para poder limpiar aunque una afirmación reviente a mitad. Es el patrón de `scripts/verificar-dele.ts`:

```ts
// Los ids de todo lo que se crea, en variables de módulo para poder
// limpiarlo desde el `.finally()` aunque una afirmación reviente a mitad.
const marca = `verificar-pegado-${process.pid}`;
let recorridoId: string | null = null;
let pasoId: string | null = null;
let ejercicioId: string | null = null;
```

Y dentro de `main()`, antes del `console.log` final:

```ts
  // ─── Las negativas del paso ──────────────────────────────────────────
  const recorrido = await prisma.recorrido.create({
    data: { titulo: marca, nivel: "B1", tipo: "PREPARACION_DELE", destreza: "CE", orden: 1 },
    select: { id: true },
  });
  recorridoId = recorrido.id;

  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Tarea 1" },
    select: { id: true },
  });
  pasoId = paso.id;

  afirmar((await pasoLibre(paso.id)) === null, "un paso recién creado está libre");

  const ejercicio = await prisma.ejercicio.create({
    data: {
      tipo: "RELACIONAR",
      titulo: marca,
      nivel: "B1",
      // El cast es el mismo que usa `guardarEjercicio`: `datos` es `Json` y
      // Prisma no acepta un objeto literal sin él.
      datos: SOBRE_BUENO.ejercicio as Prisma.InputJsonValue,
      publicado: true,
    },
    select: { id: true },
  });
  ejercicioId = ejercicio.id;
  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
  });

  const ocupado = await pasoLibre(paso.id);
  afirmar(
    ocupado !== null && ocupado.includes("ya tiene un ejercicio"),
    "un paso que ya tiene ejercicio deja de estar libre",
  );
```

Y el `.finally()` que limpia, sustituyendo el `main().catch(...)` del final del archivo por:

```ts
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    const intentar = async (que: string, hacer: () => Promise<unknown>) => {
      try {
        await hacer();
      } catch (e) {
        fallos++;
        console.error(`  no se pudo limpiar ${que}: ${e instanceof Error ? e.message : e}`);
      }
    };

    // El orden importa: primero lo que apunta al paso, luego el paso.
    if (pasoId) {
      const id = pasoId;
      await intentar("vínculos", () => prisma.pasoEjercicio.deleteMany({ where: { pasoId: id } }));
      await intentar("bloques", () => prisma.bloque.deleteMany({ where: { pasoId: id } }));
      await intentar("paso", () => prisma.paso.delete({ where: { id } }));
    }
    if (ejercicioId) {
      const id = ejercicioId;
      await intentar("ejercicio", () => prisma.ejercicio.delete({ where: { id } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }

    await intentar("desconectar", () => prisma.$disconnect());

    // Un rechazo sin capturar aquí sería silencioso: nadie lo ve y la basura
    // se descubre a mano.
    if (fallos > 0) {
      console.error(`\nLa limpieza falló en ${fallos} paso(s): puede haber quedado basura en la base.`);
      process.exitCode = 1;
    }
  });
```

- [ ] **Step 2: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-pegado.ts`
Expected: FALLA con `does not provide an export named 'pasoLibre'` (o el error de TypeScript equivalente).

- [ ] **Step 3: Extrae `pasoLibre` de `puedeEngancharse`**

En `lib/recursos.ts`, sustituye la función `puedeEngancharse` entera por estas dos:

```ts
/**
 * Si a este paso se le puede colgar un ejercicio cualquiera, o el motivo del
 * no. Las dos reglas que no miran a *qué* ejercicio es.
 *
 * Extraída de `puedeEngancharse` porque la puerta de pegar por código las
 * necesita antes de que el ejercicio exista: no hay `ejercicioId` que
 * pasarle. Extraída y no copiada, que es lo que evita que dentro de un mes
 * una de las dos puertas empiece a dejar pasar lo que la otra rechaza.
 */
export async function pasoLibre(pasoId: string): Promise<string | null> {
  // La página del paso hace `findFirst` ordenado y descarta el resto, porque
  // la corrección escribe los puntos del paso entero y dos ejercicios se
  // pisarían. Sin esta negativa, el segundo se guardaría y no lo vería nadie.
  const yaHay = await prisma.pasoEjercicio.count({ where: { pasoId } });
  if (yaHay > 0) {
    return "Ese paso ya tiene un ejercicio. Quita el que hay antes de poner otro.";
  }

  if (await tieneTrabajo(pasoId)) {
    return "Alguien ya trabajó en ese paso. Cambiarle el ejercicio dejaría sin sentido lo que respondió, lo que entregó o lo que ya le corregiste.";
  }
  return null;
}

/**
 * Si a este paso se le puede colgar este ejercicio, o el motivo del no.
 *
 * Tres negativas y las tres tienen la misma raíz: que el estudiante acabe
 * viendo algo distinto de lo que el profesor cree que puso. Las dos últimas
 * viven en `pasoLibre`, que es lo que comparte con la puerta de pegar.
 */
export async function puedeEngancharse(
  ejercicioId: string,
  pasoId: string,
): Promise<string | null> {
  const ejercicio = await prisma.ejercicio.findUnique({
    where: { id: ejercicioId },
    select: { publicado: true },
  });
  if (!ejercicio) return "Ese ejercicio no existe.";
  if (!ejercicio.publicado) {
    return "Es un borrador. Publícalo antes de colgarlo de un paso.";
  }

  return pasoLibre(pasoId);
}
```

- [ ] **Step 4: Ejecuta las dos verificaciones**

Run: `npx tsx scripts/verificar-pegado.ts && npx tsx scripts/verificar-recursos.ts`
Expected: las dos pasan. La segunda importa porque `puedeEngancharse` acaba de cambiar por dentro y sus negativas están cubiertas allí.

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/recursos.ts scripts/verificar-pegado.ts
git commit -m "Las dos negativas que no miran al ejercicio salen a pasoLibre"
```

---

### Task 3: Los ejemplos resueltos, uno por motor

**Files:**
- Create: `lib/pegado/ejemplos.ts`
- Modify: `scripts/verificar-pegado.ts`

**Interfaces:**
- Consumes: `type MarcaEjercicio` de `@/lib/ejercicios/tipos`; `abrirSobre` de `@/lib/pegado/sobre`.
- Produces: `EJEMPLOS: Record<MarcaEjercicio, unknown>` — un **sobre completo** por motor, no solo su ejercicio.

- [ ] **Step 1: Escribe la verificación que falla**

En `scripts/verificar-pegado.ts`, añade al import de `@/lib/pegado/sobre` nada nuevo, y arriba:

```ts
import { EJEMPLOS } from "@/lib/pegado/ejemplos";
import { TIPO_DE_EJERCICIO } from "@/lib/recursos";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
```

Y dentro de `main()`, antes del bloque de las negativas del paso:

```ts
  // ─── Los ejemplos resueltos ──────────────────────────────────────────
  //
  // Esta es la comprobación que sujeta el diseño entero. Un ejemplo roto
  // dentro del encargo no falla en ninguna pantalla: falla en silencio
  // enseñándole a la IA a devolver basura, y el fallo aparece tres semanas
  // después con un examen mal montado y sin saber de dónde viene.
  const MOTORES: MarcaEjercicio[] = ["opcion", "relacionar", "huecos", "ordenar"];
  for (const motor of MOTORES) {
    const abierto = abrirSobre(JSON.stringify(EJEMPLOS[motor]));
    afirmar(!("error" in abierto), `el ejemplo de ${motor} es un sobre que se abre`);
    if ("error" in abierto) throw new Error(abierto.error);
    afirmar(
      abierto.tipo === TIPO_DE_EJERCICIO[motor],
      `el ejemplo de ${motor} es del motor que dice ser`,
    );
    afirmar(
      abierto.bloque !== null || motor === "huecos" || motor === "ordenar",
      `el ejemplo de ${motor} enseña también cómo se manda el bloque`,
    );
  }
```

- [ ] **Step 2: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-pegado.ts`
Expected: FALLA con `Cannot find module '@/lib/pegado/ejemplos'`.

- [ ] **Step 3: Escribe `lib/pegado/ejemplos.ts`**

```ts
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";

/**
 * Un sobre resuelto por motor, para meterlo dentro del encargo.
 *
 * Son **sobres enteros y no ejercicios sueltos**: lo que se le pide a la IA
 * es un sobre, así que enseñarle solo el contenido sería enseñarle otra cosa
 * distinta de la que tiene que devolver.
 *
 * Salen del examen ya sembrado —A2/B1 escolar, mayo de 2015— recortados a
 * dos ítems. Recortados y no inventados a propósito: un ejemplo con la voz
 * del examen de verdad le enseña a la IA el registro además del formato.
 *
 * `scripts/verificar-pegado.ts` comprueba que cada uno pasa el esquema de su
 * motor. Es la comprobación que impide que un ejemplo roto enseñe a devolver
 * basura sin que nada avise.
 */
export const EJEMPLOS: Record<MarcaEjercicio, unknown> = {
  relacionar: {
    bloque:
      "## Tablón de anuncios\n\n" +
      "**A. MUSICALDÍA.** Si sois un grupo de música y buscáis un buen espacio para practicar, el centro cultural Musicaldía os ofrece varias salas con instrumentos.\n\n" +
      "**C. CREA TU BLOG.** Os enseñamos a crear un blog digital de forma fácil y gratuita. Días: 6 y 13 de octubre. Para jóvenes de 12 a 18 años.\n\n" +
      "**F. AYUNTAMIENTO. ÁREA DE DEPORTES.** ¿Te gustaría moverte en bici por la ciudad pero no tienes una? Tenemos la bici que buscas por solo 5 euros al mes.",
    ejercicio: {
      ejercicio: "relacionar",
      consigna:
        "Relaciona a cada joven con el anuncio que le interesa. Hay más anuncios que jóvenes.",
      parejas: [
        {
          id: "1",
          izquierda: "MARCOS: «Toco la guitarra y con mi banda no tenemos dónde ensayar.»",
          derecha: "A. MUSICALDÍA",
        },
        {
          id: "2",
          izquierda: "LUCÍA: «Voy al instituto andando y tardo mucho. Necesito una bici barata.»",
          derecha: "F. AYUNTAMIENTO. ÁREA DE DEPORTES",
        },
      ],
      sobrantes: ["C. CREA TU BLOG"],
    },
  },

  opcion: {
    bloque:
      "## Estudiar Medicina después de otra carrera\n\n" +
      "Cada año, decenas de licenciados deciden empezar Medicina cuando ya han terminado otros estudios. La mayoría son biólogos o químicos, y casi todos coinciden en que la decisión les llegó tarde pero clara.",
    ejercicio: {
      ejercicio: "opcion",
      consigna: "Lee el texto y elige la opción correcta.",
      multiple: false,
      presentacion: "botones",
      preguntas: [
        {
          id: "1",
          enunciado: "Según el texto, quienes empiezan Medicina más tarde…",
          opciones: [
            "ya han estudiado otra carrera.",
            "no terminaron sus estudios anteriores.",
            "estudian a la vez las dos carreras.",
          ],
          correctas: [0],
        },
        {
          id: "2",
          enunciado: "La mayoría de ellos vienen de…",
          opciones: ["Derecho o Economía.", "Biología o Química.", "Bellas Artes."],
          correctas: [1],
        },
      ],
    },
  },

  huecos: {
    ejercicio: {
      ejercicio: "huecos",
      consigna: "Completa el texto con la forma que falta.",
      texto:
        "Ayer {{1}} al cine con mi hermana y la película nos {{2}} muchísimo.",
      huecos: [
        { id: "1", acepta: ["fui", "fuimos"] },
        { id: "2", acepta: ["gustó"] },
      ],
    },
  },

  ordenar: {
    ejercicio: {
      ejercicio: "ordenar",
      consigna: "Ordena las frases para reconstruir el diálogo.",
      piezas: [
        { id: "1", texto: "Buenos días, ¿en qué puedo ayudarle?" },
        { id: "2", texto: "Quería información sobre los cursos de verano." },
        { id: "3", texto: "Claro. ¿Para qué nivel?" },
      ],
    },
  },
};
```

- [ ] **Step 4: Ejecútala para verla pasar**

Run: `npx tsx scripts/verificar-pegado.ts`
Expected: todas las líneas `OK:`, incluidas las doce nuevas de los ejemplos.

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/pegado/ejemplos.ts scripts/verificar-pegado.ts
git commit -m "Un sobre resuelto por motor, y una comprobación que lo sujeta"
```

---

### Task 4: El encargo, compuesto desde el mapa

**Files:**
- Create: `lib/pegado/encargo.ts`
- Modify: `scripts/verificar-pegado.ts`

**Interfaces:**
- Consumes: `type TareaDele`, `PRUEBAS` y `sobrantesDe` de `@/lib/dele`; `EJEMPLOS` de `@/lib/pegado/ejemplos`; `type MarcaEjercicio` de `@/lib/ejercicios/tipos`.
- Produces:
  - `type Encargo = { motor: MarcaEjercicio; etiqueta: string; texto: string }`
  - `componerEncargo(titulo: string, motor: MarcaEjercicio, tarea: TareaDele | null): Encargo`
  - `encargosPara(titulo: string, tarea: TareaDele | null): Encargo[]` — uno si el paso es tarea del mapa, cuatro si no.

- [ ] **Step 1: Escribe la verificación que falla**

En `scripts/verificar-pegado.ts`, añade arriba:

```ts
import { PRUEBAS, sobrantesDe } from "@/lib/dele";
import { componerEncargo, encargosPara } from "@/lib/pegado/encargo";
```

Y dentro de `main()`, después del bloque de los ejemplos:

```ts
  // ─── El encargo, tarea por tarea ─────────────────────────────────────
  let tareasVistas = 0;
  for (const prueba of PRUEBAS) {
    for (const tarea of prueba.tareas) {
      const cual = `${prueba.nivel} · ${prueba.prueba} · T${tarea.numero}`;
      const encargo = componerEncargo(`${prueba.nivel} · Tarea ${tarea.numero}`, tarea.motor, tarea);
      tareasVistas++;

      afirmar(encargo.motor === tarea.motor, `${cual}: el encargo usa el motor del mapa`);
      afirmar(
        encargo.texto.includes(`"${tarea.motor}"`),
        `${cual}: el encargo nombra el motor dentro del JSON que pide`,
      );
      afirmar(
        encargo.texto.includes(String(tarea.items)),
        `${cual}: el encargo dice cuántos ítems lleva`,
      );
      afirmar(encargo.texto.includes(tarea.pide), `${cual}: el encargo dice qué se pide`);

      // Los sobrantes solo existen en `relacionar`. En `opcion`, `opciones`
      // son las de cada ítem y restarle los ítems no significa nada, así que
      // el encargo no puede contarlos.
      //
      // Se busca la frase exacta de la cuenta —«**3 sobrantes.**»— y no la
      // palabra suelta: la palabra sale también en la lista de campos y en el
      // ejemplo resuelto de `relacionar`, así que buscarla a secas daría por
      // buena una cuenta que no está.
      const sobran = sobrantesDe(tarea);
      afirmar(
        encargo.texto.includes("sobrantes.**") === sobran > 0,
        `${cual}: el encargo cuenta los sobrantes exactamente cuando los hay`,
      );
      if (sobran > 0) {
        afirmar(
          encargo.texto.includes(`**${sobran} sobrantes.**`),
          `${cual}: el encargo dice que sobran ${sobran}`,
        );
      }

      afirmar(
        !tarea.verificado || !encargo.texto.includes("sin confirmar"),
        `${cual}: una tarea verificada no lleva el aviso de dato sin confirmar`,
      );
      if (!tarea.verificado) {
        afirmar(
          encargo.texto.includes("sin confirmar"),
          `${cual}: una tarea deducida avisa de que su dato está sin confirmar`,
        );
      }

      afirmar(
        encargo.texto.includes("no lleva audio"),
        `${cual}: el encargo dice que el audio no va dentro`,
      );
    }
  }
  afirmar(tareasVistas === 52, `el mapa tiene 52 tareas y se han recorrido las ${tareasVistas}`);

  // ─── El encargo de un paso libre ─────────────────────────────────────
  const libres = encargosPara("Calentamiento", null);
  afirmar(libres.length === 4, "un paso que no es tarea del examen ofrece los cuatro motores");
  afirmar(
    libres.every((e) => !e.texto.includes("sobrante")),
    "sin mapa no se habla de sobrantes: ese número solo lo sabe el mapa",
  );

  const deTarea = encargosPara("Tarea 1", PRUEBAS[0].tareas[0]);
  afirmar(deTarea.length === 1, "una tarea del examen ofrece un solo encargo, el suyo");
```

- [ ] **Step 2: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-pegado.ts`
Expected: FALLA con `Cannot find module '@/lib/pegado/encargo'`.

- [ ] **Step 3: Escribe `lib/pegado/encargo.ts`**

```ts
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import { sobrantesDe, type TareaDele } from "@/lib/dele";
import { EJEMPLOS } from "@/lib/pegado/ejemplos";

/**
 * El encargo que se descarga y se le da a una IA junto al PDF del examen.
 *
 * **No enseña los cuatro motores: enseña el suyo**, ya elegido por el mapa.
 * Elegir mal entre `relacionar` y `opcion` es el error caro del proyecto
 * —usar `opcion` donde las opciones no se repiten deja al alumno marcar el
 * mismo texto en dos enunciados, que el examen no permite—, así que esa
 * elección no se delega en quien lee el encargo.
 *
 * Módulo puro: solo datos y plantillas. Nada de base, nada de sesión. Por eso
 * `scripts/verificar-pegado.ts` puede recorrer las 52 tareas del mapa y
 * comprobar el encargo de cada una.
 */
export type Encargo = {
  motor: MarcaEjercicio;
  /** Cómo se llama en el desplegable, cuando hay que elegir. */
  etiqueta: string;
  /** El markdown entero, listo para descargar o copiar. */
  texto: string;
};

const ETIQUETA: Record<MarcaEjercicio, string> = {
  opcion: "Opción múltiple",
  relacionar: "Relacionar en dos columnas",
  huecos: "Huecos que se escriben",
  ordenar: "Ordenar piezas",
};

/** La forma del `ejercicio` de cada motor, campo a campo. */
const FORMA: Record<MarcaEjercicio, string[]> = {
  opcion: [
    "`ejercicio`: la cadena `\"opcion\"`.",
    "`consigna`: lo que se le dice al estudiante que haga.",
    "`multiple`: `false` salvo que una pregunta admita varias respuestas buenas.",
    "`presentacion`: `\"botones\"`, o `\"desplegable\"` si son muchas preguntas cortas.",
    "`opcionesComunes`: la lista que comparten todas las preguntas. Se pone **solo** cuando una misma opción vale para varias preguntas; si no, se omite y cada pregunta lleva las suyas.",
    "`preguntas`: una por ítem, con `id` (\"1\", \"2\", …), `enunciado`, `opciones` (si no hay lista común) y `correctas`.",
    "`correctas`: la **posición** de la opción buena empezando en cero, dentro de una lista. La primera opción es `[0]`, la tercera es `[2]`.",
  ],
  relacionar: [
    "`ejercicio`: la cadena `\"relacionar\"`.",
    "`consigna`: lo que se le dice al estudiante que haga.",
    "`parejas`: una por ítem, con `id` (\"1\", \"2\", …), `izquierda` (lo que se lee en la columna fija) y `derecha` (la opción que le corresponde).",
    "`sobrantes`: las opciones que se barajan con las buenas y no emparejan con nada. Lista vacía si no sobra ninguna.",
  ],
  huecos: [
    "`ejercicio`: la cadena `\"huecos\"`.",
    "`consigna`: lo que se le dice al estudiante que haga.",
    "`texto`: el pasaje con una marca `{{1}}`, `{{2}}`… donde falta cada palabra.",
    "`huecos`: uno por marca, con `id` (el mismo que la marca) y `acepta`, la lista de formas que se dan por buenas.",
  ],
  ordenar: [
    "`ejercicio`: la cadena `\"ordenar\"`.",
    "`consigna`: lo que se le dice al estudiante que haga.",
    "`piezas`: en **su orden correcto**, con `id` y `texto`. Al estudiante le llegan barajadas.",
  ],
};

/** Las reglas que ese motor puede romper, y lo que pasa si se rompen. */
const REGLAS: Record<MarcaEjercicio, string[]> = {
  opcion: [
    "`correctas` cuenta desde cero. Escribir `[1]` para la primera opción da un ejercicio que nadie puede acertar.",
    "Con `opcionesComunes`, ninguna pregunta lleva su propio `opciones`. Sin ella, todas lo llevan.",
    "Los `id` de las preguntas no se repiten.",
  ],
  relacionar: [
    "Dos parejas no pueden compartir el mismo texto en `derecha`: el estudiante vería dos celdas idénticas y una de las dos filas quedaría mal contada pase lo que pase.",
    "Un sobrante no puede repetir el texto de una respuesta buena, por lo mismo.",
    "`izquierda` sí se puede repetir.",
  ],
  huecos: [
    "Las marcas `{{...}}` del `texto` y los `id` de `huecos` tienen que ser exactamente los mismos: ni una de más ni una de menos.",
    "Ninguna forma de `acepta` puede estar vacía: nadie podría acertar ese hueco.",
    "Se perdona la mayúscula y los espacios de sobra, pero **no la tilde**. Si una palabra se puede escribir de dos formas buenas, van las dos en `acepta`.",
  ],
  ordenar: [
    "Las piezas van en su orden correcto, no barajadas: barajarlas es cosa de la aplicación.",
    "Ninguna pieza puede estar en blanco.",
  ],
};

/**
 * Compone el encargo de una tarea concreta.
 *
 * `tarea` es null en un paso que no es tarea del examen. Entonces el encargo
 * sale sin número de ítems ni sobrantes, que son datos que solo tiene el
 * mapa: pedírselos a la IA sería pedirle que se los invente.
 */
export function componerEncargo(
  titulo: string,
  motor: MarcaEjercicio,
  tarea: TareaDele | null,
): Encargo {
  const sobran = tarea ? sobrantesDe(tarea) : 0;

  const cuenta: string[] = [];
  if (tarea) {
    cuenta.push(`- **${tarea.items} ítems.** Ni uno más ni uno menos: es lo que lleva esta tarea en el examen.`);
    if (sobran > 0) {
      cuenta.push(
        `- **${sobran} sobrantes.** Son ${tarea.opciones} opciones en total para ${tarea.items} ítems: ${sobran} no emparejan con nada y van en la lista \`sobrantes\`.`,
      );
    }
    if (tarea.motor === "opcion") {
      cuenta.push(
        tarea.listaComun
          ? `- **Lista común de ${tarea.opciones} opciones**, en \`opcionesComunes\`. Es una lista común porque en esta tarea **una misma opción contesta a varias preguntas**. Ninguna pregunta lleva su propio \`opciones\`.`
          : `- **${tarea.opciones} opciones por pregunta**, cada una en su propio \`opciones\`. Nada de \`opcionesComunes\`: aquí cada pregunta tiene las suyas.`,
      );
    }
  }

  const aviso = tarea && !tarea.verificado
    ? "\n> **Ojo:** los números de esta tarea están deducidos y **sin confirmar** contra un examen oficial. Si el PDF que tienes delante dice otra cosa, manda el PDF.\n"
    : "";

  const texto = `# Encargo: ${titulo}

Vas a transcribir **una tarea de un examen del Instituto Cervantes** al formato
que lee HispaProfe. Te doy el formato; el contenido sale del PDF que te adjunto.

${tarea ? `## Qué es esta tarea\n\n${tarea.pide}\n${aviso}` : `## Qué es esta tarea\n\nUn ejercicio de **${ETIQUETA[motor].toLowerCase()}**. El contenido y cuántos ítems lleva los decides a partir del material que te adjunto.\n`}
## Qué me tienes que devolver

Un único objeto JSON con **dos casillas** y nada más:

\`\`\`json
{
  "bloque": "el texto que el estudiante lee antes de responder, en markdown",
  "ejercicio": { }
}
\`\`\`

\`bloque\` es **opcional** y se omite si la tarea no tiene nada que leer aparte
de los propios ítems. Ojo: \`bloque\` va **fuera** de \`ejercicio\`. Dentro de
\`ejercicio\` hay a veces otro campo llamado \`texto\`, y significa otra cosa.

Dentro de \`ejercicio\` van estos campos:

${FORMA[motor].map((l) => `- ${l}`).join("\n")}

${cuenta.length ? `## Los números de esta tarea\n\n${cuenta.join("\n")}\n` : ""}
## Reglas que no se pueden romper

${REGLAS[motor].map((l) => `- ${l}`).join("\n")}

## Lo que **no** tienes que poner

- **El título, el nivel ni la destreza.** Los pone la aplicación: ya sabe de qué
  examen y de qué prueba es este paso.
- **Nada de audio.** Esta tarea **no lleva audio dentro del ejercicio**. Cuando
  el examen tiene audio, es un MP3 por tarea que se sube aparte, con las dos
  escuchas ya grabadas dentro. No inventes rutas ni campos \`audio\`.
- **Nada de explicaciones.** Devuelve el JSON y solo el JSON.

## Un ejemplo resuelto

Del mismo tipo, recortado a dos ítems:

\`\`\`json
${JSON.stringify(EJEMPLOS[motor], null, 2)}
\`\`\`

## Al transcribir

- Copia el texto del examen **literal**, con sus tildes y su puntuación. No lo
  resumas ni lo modernices: la dificultad del examen está en cómo está escrito.
- Las respuestas correctas salen de la **clave oficial**, no de tu lectura. Si el
  PDF no la trae, dilo en vez de deducirla.
- Si algo del examen no cabe en este formato —una opción que es un dibujo, por
  ejemplo—, dilo en vez de inventarte un equivalente.
`;

  return { motor, etiqueta: ETIQUETA[motor], texto };
}

/**
 * Los encargos que se le ofrecen a un paso: el suyo si es tarea del examen, y
 * los cuatro si no.
 *
 * El mapa aconseja y no manda, que es el principio de toda esta pantalla: un
 * paso libre de una clase particular sigue pudiendo pegar lo que quiera.
 */
export function encargosPara(titulo: string, tarea: TareaDele | null): Encargo[] {
  if (tarea) return [componerEncargo(titulo, tarea.motor, tarea)];
  const motores: MarcaEjercicio[] = ["opcion", "relacionar", "huecos", "ordenar"];
  return motores.map((m) => componerEncargo(titulo, m, null));
}
```

- [ ] **Step 4: Ejecútala para verla pasar**

Run: `npx tsx scripts/verificar-pegado.ts`
Expected: pasa, con más de trescientas líneas `OK:` — cuatro afirmaciones por cada una de las 52 tareas, más las de los sobrantes y el aviso.

Si falla la afirmación de las 52 tareas, **no la cambies sin mirar el mapa**: o alguien ha añadido una prueba, o `PRUEBAS` tiene una errata. Cuéntalas con `npx tsx -e "import {PRUEBAS} from './lib/dele/mapa'; console.log(PRUEBAS.reduce((n,p)=>n+p.tareas.length,0))"`.

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/pegado/encargo.ts scripts/verificar-pegado.ts
git commit -m "El encargo sale del mapa, con los números de su tarea ya puestos"
```

---

### Task 5: Las dos acciones — comprobar sin escribir, pegar en transacción

**Files:**
- Modify: `lib/acciones-recursos.ts` (añadir al final, y ampliar el import de `@/lib/recursos`)

**Interfaces:**
- Consumes: `abrirSobre` y `resumir` de `@/lib/pegado/sobre`; `pasoLibre` de `@/lib/recursos`; `avisoDeItems`, `numeroDeTarea` y `tareaDe` de `@/lib/dele`; `exigirProfesor`, `prisma`, `revalidatePath` y `refrescar`, que ya están en el archivo.
- Produces:
  - `type EstadoPegado = { error?: string; ok?: string; entendido?: { resumen: string; aviso: string | null; bloque: string | null; datos: unknown } }`
  - `comprobarPegado(_prev: EstadoPegado, formData: FormData): Promise<EstadoPegado>` — lee `pasoId` y `pegado`. No escribe nada.
  - `pegarEjercicio(_prev: EstadoPegado, formData: FormData): Promise<EstadoPegado>` — lee `pasoId` y `pegado`. Crea las tres filas en una transacción.

- [ ] **Step 1: Amplía los imports**

En `lib/acciones-recursos.ts`, añade `pasoLibre` a la lista que ya se importa de `@/lib/recursos`, y estos dos imports nuevos:

```ts
import { avisoDeItems, numeroDeTarea, tareaDe } from "@/lib/dele";
import { abrirSobre, resumir } from "@/lib/pegado/sobre";
```

- [ ] **Step 2: Escribe lo que comparten las dos acciones**

Al final de `lib/acciones-recursos.ts`:

```ts
/**
 * Lo que devuelve la puerta de pegar por código.
 *
 * No reutiliza `EstadoRecurso` porque tiene algo más que decir: qué ha
 * entendido del texto pegado, para poder enseñarlo y previsualizarlo antes de
 * escribir nada. Ver ese ejercicio antes de guardarlo es la mitad del valor de
 * esta pantalla.
 */
export type EstadoPegado = {
  error?: string;
  ok?: string;
  entendido?: {
    /** «relacionar · 6 parejas · 3 sobrantes». */
    resumen: string;
    /** «En el examen esta tarea lleva 6…». Avisa, no rechaza. */
    aviso: string | null;
    /** El texto que se convertirá en bloque, para enseñarlo. */
    bloque: string | null;
    /** Los datos del ejercicio, para dárselos a `Previsualizacion`. */
    datos: unknown;
  };
};

/**
 * El paso con lo que hace falta para nombrar y situar su ejercicio.
 *
 * Lo comparten las dos acciones: la que comprueba y la que guarda. Se lee dos
 * veces a propósito —una por acción— porque entre pulsar «Comprobar» y pulsar
 * «Guardar» pueden pasar diez minutos, y en ese rato otro puede haber
 * enganchado un ejercicio a ese mismo paso.
 */
async function pasoParaPegar(pasoId: string) {
  return prisma.paso.findUnique({
    where: { id: pasoId },
    select: {
      id: true,
      titulo: true,
      orden: true,
      destreza: true,
      recorrido: { select: { titulo: true, nivel: true, destreza: true, tipo: true } },
    },
  });
}

type PasoParaPegar = NonNullable<Awaited<ReturnType<typeof pasoParaPegar>>>;

/**
 * Qué tarea del examen es este paso, o null.
 *
 * La misma regla que usa la ficha del paso, llamada y no copiada: el título
 * manda —«Tarea 3»— y el `orden` es la reserva.
 */
function tareaDelPaso(paso: PasoParaPegar) {
  if (paso.recorrido.tipo !== "PREPARACION_DELE" || !paso.recorrido.destreza) return null;
  return tareaDe(paso.recorrido.nivel, paso.recorrido.destreza, numeroDeTarea(paso));
}
```

- [ ] **Step 3: Escribe `comprobarPegado`**

A continuación, en el mismo archivo:

```ts
/**
 * Lee lo pegado y dice qué ha entendido, **sin tocar la base**.
 *
 * Las negativas del paso se comprueban aquí y no solo al guardar: dejar pegar
 * y validar un examen entero para decir al final que el paso estaba ocupado es
 * hacer trabajar para nada.
 */
export async function comprobarPegado(
  _prev: EstadoPegado,
  formData: FormData,
): Promise<EstadoPegado> {
  await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const pegado = String(formData.get("pegado") ?? "");
  if (!pasoId) return { error: "Falta el paso." };

  const paso = await pasoParaPegar(pasoId);
  if (!paso) return { error: "Ese paso ya no existe." };

  const motivo = await pasoLibre(pasoId);
  if (motivo) return { error: motivo };

  const abierto = abrirSobre(pegado);
  if ("error" in abierto) return { error: abierto.error };

  // El aviso de ítems avisa y no rechaza, que es como funciona todo el mapa:
  // un ejercicio de práctica más corto que la tarea oficial es una decisión
  // pedagógica, no un error.
  const tarea = tareaDelPaso(paso);
  const aviso = tarea ? avisoDeItems(tarea, abierto.ejercicio) : null;

  return {
    entendido: {
      resumen: resumir(abierto.ejercicio),
      aviso,
      bloque: abierto.bloque,
      datos: abierto.ejercicio,
    },
  };
}
```

- [ ] **Step 4: Escribe `pegarEjercicio`**

A continuación:

```ts
/**
 * Crea el ejercicio, lo engancha al paso y, si el sobre traía texto, le pone
 * su bloque. **Las tres cosas o ninguna**: un ejercicio creado y sin enganchar
 * sería un huérfano en la lista de Recursos que nadie sabría de dónde salió.
 *
 * **Nace publicado.** `puedeEngancharse` exige que un ejercicio no sea un
 * borrador para colgarlo de un paso, y con razón. Aquí esa regla no se salta:
 * se cumple por adelantado, porque quien pulsa este botón acaba de ver la
 * previsualización, que es exactamente lo que significa publicar. De propina,
 * el ejercicio queda en Recursos y otro paso lo puede reutilizar.
 */
export async function pegarEjercicio(
  _prev: EstadoPegado,
  formData: FormData,
): Promise<EstadoPegado> {
  const usuario = await exigirProfesor();
  const pasoId = String(formData.get("pasoId") ?? "");
  const pegado = String(formData.get("pegado") ?? "");
  if (!pasoId) return { error: "Falta el paso." };

  const paso = await pasoParaPegar(pasoId);
  if (!paso) return { error: "Ese paso ya no existe." };

  // Se vuelve a preguntar aunque «Comprobar» ya lo hiciera: entre las dos
  // pulsaciones pueden pasar diez minutos y otra pestaña puede haber
  // enganchado un ejercicio a este mismo paso.
  const motivo = await pasoLibre(pasoId);
  if (motivo) return { error: motivo };

  const abierto = abrirSobre(pegado);
  if ("error" in abierto) return { error: abierto.error };

  const creadoId = await prisma.$transaction(async (tx) => {
    const ejercicio = await tx.ejercicio.create({
      data: {
        tipo: abierto.tipo,
        // El título lo pone la aplicación y no el sobre: ya sabe de qué
        // secuencia y de qué paso se trata, así que pedírselo a quien escriba
        // el sobre es pedirle que acierte algo que está en la pantalla.
        titulo: `${paso.recorrido.titulo} · ${paso.titulo}`,
        nivel: paso.recorrido.nivel,
        // La del paso manda sobre la del recorrido: un paso puede llevar la
        // suya propia, y si no la lleva hereda la de la prueba.
        destreza: paso.destreza ?? paso.recorrido.destreza,
        etiquetas: [],
        datos: abierto.ejercicio as Prisma.InputJsonValue,
        publicado: true,
        autorId: usuario.id,
      },
      select: { id: true },
    });

    await tx.pasoEjercicio.create({
      data: { pasoId, ejercicioId: ejercicio.id, orden: 1 },
    });

    if (abierto.bloque) {
      // Al final de los que ya haya, igual que `crearBloque`: un paso puede
      // llevar ya una consigna escrita a mano y el texto de la lectura va
      // después, no encima.
      const ultimo = await tx.bloque.aggregate({
        where: { pasoId },
        _max: { orden: true },
      });
      await tx.bloque.create({
        data: {
          pasoId,
          tipo: "TEXTO",
          texto: abierto.bloque,
          orden: (ultimo._max.orden ?? 0) + 1,
        },
      });
    }

    return ejercicio.id;
  });

  revalidatePath(`/pasos/${pasoId}`);
  refrescar(creadoId);
  return { ok: "Pegado y enganchado." };
}
```

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si `Prisma` sale como no usado o no importado, comprueba el import de `@/lib/generated/prisma/client` que ya está en la cabecera del archivo.

- [ ] **Step 6: Ejecuta la verificación por si algo se ha movido**

Run: `npx tsx scripts/verificar-pegado.ts && npx tsx scripts/verificar-recursos.ts`
Expected: las dos pasan.

- [ ] **Step 7: Commit**

```bash
git add lib/acciones-recursos.ts
git commit -m "Comprobar no escribe; pegar escribe las tres filas o ninguna"
```

---

### Task 6: La puerta en la ficha del paso

**Files:**
- Create: `app/(app)/pasos/[pasoId]/pegar-codigo.tsx`
- Modify: `app/(app)/pasos/[pasoId]/page.tsx` (el import, el cálculo del encargo, y el JSX junto a `<SelectorEjercicio>` sobre la línea 506)

**Interfaces:**
- Consumes: `comprobarPegado`, `pegarEjercicio` y `type EstadoPegado` de `@/lib/acciones-recursos`; `encargosPara` y `type Encargo` de `@/lib/pegado/encargo`; `Previsualizacion` de `@/components/recursos/previsualizacion`; `tarea` y `paso`, que la página ya tiene calculados.
- Produces: el componente `PegarCodigo({ pasoId, titulo, encargos }: { pasoId: string; titulo: string; encargos: Encargo[] })`.

- [ ] **Step 1: Escribe `pegar-codigo.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import {
  comprobarPegado,
  pegarEjercicio,
  type EstadoPegado,
} from "@/lib/acciones-recursos";
import type { Encargo } from "@/lib/pegado/encargo";
import Previsualizacion from "@/components/recursos/previsualizacion";

/**
 * La tercera puerta para poner el ejercicio de un paso: pegarlo ya escrito.
 *
 * Dos mitades y en este orden: primero el encargo que se le da a una IA, y
 * luego el cuadro donde se pega lo que devuelva. El orden importa porque es
 * el del viaje: sin el encargo, lo que se pegue no tiene por qué encajar.
 */
export default function PegarCodigo({
  pasoId,
  titulo,
  encargos,
}: {
  pasoId: string;
  titulo: string;
  encargos: Encargo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cual, setCual] = useState(0);
  const [copiado, setCopiado] = useState(false);

  const [comprobado, comprobar, comprobando] = useActionState<EstadoPegado, FormData>(
    comprobarPegado,
    {},
  );
  const [guardado, guardar, guardando] = useActionState<EstadoPegado, FormData>(
    pegarEjercicio,
    {},
  );

  const encargo = encargos[cual] ?? encargos[0];
  const error = guardado.error ?? comprobado.error;
  const entendido = guardado.ok ? undefined : comprobado.entendido;

  function descargar() {
    // Un Blob y un enlace de usar y tirar: no hace falta ninguna ruta nueva,
    // porque el encargo ya viaja entero en las props.
    const url = URL.createObjectURL(new Blob([encargo.texto], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `encargo-${titulo.replace(/[^\wáéíóúñü]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiar() {
    await navigator.clipboard.writeText(encargo.texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-4 rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
      >
        Pegar por código
      </button>
    );
  }

  return (
    <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-extrabold text-tinta">Pegar por código</h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
        >
          Cerrar
        </button>
      </div>

      {/* ① El encargo */}
      <p className="mt-4 text-sm font-bold text-tinta">1. El encargo para la IA</p>
      {encargos.length > 1 && (
        <label className="mt-2 block text-sm text-tinta-suave">
          Este paso no es una tarea del examen, así que elige el tipo:{" "}
          <select
            value={cual}
            onChange={(e) => setCual(Number(e.target.value))}
            className="mt-1 block rounded-xl border-2 border-hp-200 px-3 py-1.5 text-sm font-semibold text-tinta"
          >
            {encargos.map((e, i) => (
              <option key={e.motor} value={i}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={descargar}
          className="rounded-full bg-hp-500 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-hp-600"
        >
          Descargar encargo.md
        </button>
        <button
          type="button"
          onClick={copiar}
          className="rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        Dáselo a la IA junto al PDF del examen. El audio no va aquí: va en un
        bloque aparte.
      </p>

      {/* ② El cuadro */}
      <p className="mt-6 text-sm font-bold text-tinta">
        2. Lo que te devuelva, pégalo aquí
      </p>
      <form action={comprobar} className="mt-2">
        <input type="hidden" name="pasoId" value={pasoId} />
        <textarea
          name="pegado"
          rows={10}
          spellCheck={false}
          placeholder='{ "bloque": "…", "ejercicio": { … } }'
          className="w-full rounded-xl border-2 border-hp-200 p-3 font-mono text-xs text-tinta"
        />
        <button
          type="submit"
          disabled={comprobando}
          className="mt-2 rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400 disabled:opacity-50"
        >
          {comprobando ? "Comprobando…" : "Comprobar"}
        </button>
      </form>

      {/* `bg-sol-100` y no un rojo: es el color que el editor de Recursos ya
          usa tanto para el aviso como para el motivo del rechazo, y aquí no
          se inventa una convención nueva. No hay ningún `rojo-*` en el
          sistema de color del proyecto. */}
      {error && (
        <p className="mt-3 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{error}</p>
      )}

      {guardado.ok && (
        <p className="mt-3 rounded-tarjeta bg-hp-100 px-4 py-3 text-sm font-semibold text-tinta">
          {guardado.ok}
        </p>
      )}

      {entendido && (
        <div className="mt-4 border-t border-hp-100 pt-4">
          <p className="text-sm font-bold text-tinta">{entendido.resumen}</p>
          {entendido.aviso && (
            <p className="mt-2 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
              {entendido.aviso}
            </p>
          )}
          {entendido.bloque && (
            <p className="mt-2 text-xs text-tinta-suave">
              Trae también un texto de {entendido.bloque.length} caracteres, que
              se guardará como bloque encima del ejercicio.
            </p>
          )}

          <Previsualizacion datos={entendido.datos} />

          {/*
            El texto se manda otra vez en un campo oculto en vez de fiarse de lo
            que haya en el textarea al pulsar: si se toca después de comprobar,
            lo que se guardaría no sería lo que se ha previsualizado.
          */}
          <form action={guardar} className="mt-4">
            <input type="hidden" name="pasoId" value={pasoId} />
            <input
              type="hidden"
              name="pegado"
              value={JSON.stringify({
                bloque: entendido.bloque ?? undefined,
                ejercicio: entendido.datos,
              })}
            />
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-hp-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-hp-600 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar en este paso"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Engánchalo en la página del paso**

En `app/(app)/pasos/[pasoId]/page.tsx`, junto a los demás imports:

```ts
import PegarCodigo from "./pegar-codigo";
import { encargosPara } from "@/lib/pegado/encargo";
```

Justo después de la línea que calcula `const tipoDeLaTarea = …` (sobre la línea 344), añade:

```ts
  // El encargo se compone aquí y viaja entero en las props: es texto puro
  // sacado del mapa, así que no hace falta ninguna ruta que lo sirva. Si el
  // paso no es tarea del examen, `encargosPara` devuelve los cuatro motores y
  // la puerta enseña un desplegable.
  const encargos = esProfe
    ? encargosPara(`${paso.recorrido.titulo} · ${paso.titulo}`, tarea)
    : [];
```

Y en el JSX, justo después del bloque `{esProfe && (<SelectorEjercicio … />)}` que termina sobre la línea 526:

```tsx
      {esProfe && !hayEjercicio && (
        <PegarCodigo
          pasoId={paso.id}
          titulo={`${paso.recorrido.titulo} · ${paso.titulo}`}
          encargos={encargos}
        />
      )}
```

`!hayEjercicio` porque con uno ya puesto la acción lo rechazaría igualmente: es mejor no ofrecer la puerta que ofrecerla para que dé un no.

- [ ] **Step 3: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si `hayEjercicio` no estuviera definido en ese punto del archivo, búscalo: la página ya lo usa sobre la línea 439 para decidir si pinta el área de contenido.

- [ ] **Step 4: Arranca la aplicación y ábrela**

Run: `npm run fresh`
Abre `/pasos/<id de un paso vacío de la prueba ya sembrada>` con la cuenta de profesor y comprueba que sale el botón «Pegar por código», que se despliega, y que «Descargar encargo.md» baja un archivo con los números de esa tarea dentro.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/pasos/[pasoId]/pegar-codigo.tsx" "app/(app)/pasos/[pasoId]/page.tsx"
git commit -m "La tercera puerta del paso: entrega el encargo y recibe la tarea"
```

---

### Task 7: El viaje entero, a mano

Lo que un script no puede ver. **Ninguno de estos pasos se salta**: son el examen de este diseño, y el `tsc` no lo es.

**Files:** ninguno. Si algo falla, se corrige donde toque y se vuelve a empezar.

- [ ] **Step 1: El viaje de verdad, con una IA**

En la secuencia «A2/B1 escolar · Comprensión de lectura (mayo 2015)», crea un paso nuevo titulado `Tarea 2`. Descarga su encargo, dáselo a una IA junto al PDF `a2b1_cl_t2.pdf` y su clave, y pega lo que devuelva.

Esperado: sale a la primera, o el motivo del rechazo dice exactamente qué corregir. Si la IA se equivoca en algo **que el encargo no le advertía**, el arreglo va en `lib/pegado/encargo.ts`, no en el sobre pegado.

- [ ] **Step 2: Que lo pegado se vea igual que lo sembrado**

Abre el paso con la cuenta de estudiante (`ndo.lopez.ele@gmail.com`, que es la que puede entrar de verdad) y responde la tarea.

Esperado: el texto se lee arriba con su markdown, el ejercicio se responde, y la corrección da los puntos que toca. Indistinguible de las tareas sembradas por el script.

- [ ] **Step 3: Las dos negativas**

Con el ejercicio ya pegado, vuelve a `/pasos/<ese id>`: la puerta no está. Quita el ejercicio con «Quitar», vuelve a pegar, y esta vez responde antes con la cuenta de estudiante; luego intenta quitarlo.

Esperado: «Alguien ya trabajó en ese paso…».

- [ ] **Step 4: Lo que la IA hace mal de verdad**

Pega, a propósito: el JSON dentro de una valla ```` ```json ````; el ejercicio a pelo sin sobre; y un texto con «Aquí tienes:» delante.

Esperado: los tres se abren sin quejarse. El segundo, sin bloque.

- [ ] **Step 5: Un paso que no es del examen**

En una secuencia de clases particulares, crea un paso y abre la puerta.

Esperado: sale el desplegable con los cuatro motores, y el encargo elegido no habla de sobrantes ni de un número de ítems.

- [ ] **Step 6: Commit de lo que se haya corregido**

Si los pasos anteriores han cambiado algo:

```bash
git add -A
git commit -m "Lo que enseñó el viaje entero a mano"
```

- [ ] **Step 7: La verificación completa, una última vez**

Run: `npx tsx scripts/verificar-pegado.ts && npx tsx scripts/verificar-recursos.ts && npx tsx scripts/verificar-dele.ts && npx tsc --noEmit && npm run lint`
Expected: todo pasa.

`verificar-cifrado.ts` no entra en esta lista: necesita `--env-file=.env` y no es una regresión de este trabajo.

---

## Lo que este plan no hace

Es lo mismo que dice el diseño, repetido aquí para que no se cuele por descuido:

- **El audio.** Va en su bloque `AUDIO`, con el editor que ya existe. El encargo lo dice para que la IA no invente rutas.
- **Las pruebas de expresión.** Un sobre con una tarea de expresión se abre —`revisarDatos` la acepta— y se guarda, pero nada de este plan compone su encargo.
- **Subir el examen entero de una vez.** Tarea a tarea, por decisión explícita.
- **Que la aplicación hable con la IA.** El viaje lo hace el profesor: descarga, sale de la aplicación y vuelve con la respuesta.
- **Editar lo pegado desde ahí.** Guardado, se edita en el editor de Recursos como cualquier otro ejercicio.
