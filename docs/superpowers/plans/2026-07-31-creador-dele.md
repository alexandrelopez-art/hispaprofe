# El Creador DELE — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor monte las dos pruebas de comprensión del DELE con la aplicación sabiéndose la estructura del examen, y que el estudiante oiga cada audio las dos veces que le deja el examen y ni una más.

**Architecture:** Un mapa del examen como datos (`lib/dele/`) que las pantallas ya existentes leen para proponer, prerrellenar y avisar — **nunca para prohibir**. El motor gana lo justo para los formatos que le faltaban: sobrantes y texto en `relacionar`, y audio en las parejas. Las escuchas se cuentan en el servidor, en su propia tabla, porque un contador en el navegador se devuelve recargando.

**Tech Stack:** Next.js 16 (App Router, React Server Components), React 19 (`useActionState`), Prisma 7 con adaptador `@prisma/adapter-pg`, zod 4, Clerk para sesión, Tailwind CSS 4, `tsx` para scripts.

**Diseño de referencia:** `docs/superpowers/specs/2026-07-31-creador-dele-design.md`

## Global Constraints

- **Lee la documentación de Next antes de escribir código.** `AGENTS.md` del repo: esta versión de Next tiene cambios de API respecto a lo que puedas recordar. Los guides están en `node_modules/next/dist/docs/`.
- Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos vienen de `@/lib/generated/prisma/client` y los enums de `@/lib/generated/prisma/enums`.
- Interfaz **en español con tildes**. Comentarios en español, cortos, explicando el porqué y no el qué.
- Tokens de Tailwind del proyecto: `hp-50…hp-700`, `sol-100…sol-400`, `bloque1-3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`. `bg-white` y `text-white` son convención establecida. Nada de otros colores crudos.
- **Una sola migración en todo el plan** (Tarea 1). Ninguna otra tarea toca `prisma/schema.prisma`.
- **El mapa aconseja, no manda.** Ninguna pantalla de este plan puede impedir algo que hoy se pueda hacer. Todo filtro tiene salida visible; todo aviso de número de ítems avisa y deja seguir. La única regla que rechaza es la del sobrante repetido, y es del motor.
- **Las reglas van en `lib/`, fuera de las acciones.** Una acción de servidor necesita sesión de Clerk y contexto de petición: no se puede llamar desde un script. Lo que está fuera es lo único verificable. Precedente: `lib/recursos.ts`, `lib/admin.ts`, `lib/estudiantes.ts`.
- **`lib/dele/*`, `lib/recursos.ts` y `lib/ejercicios/registro.ts` son solo de servidor** cuando toquen `node:crypto` o `prisma`. Ningún componente de cliente puede importarlos. Los tipos compartidos salen de `lib/ejercicios/tipos.ts`.
- **Ojo con el `next dev` que esté corriendo:** tras la migración de la Tarea 1 hay que reiniciarlo (`npm run fresh`), porque `lib/prisma.ts` fija el cliente en `globalThis`.
- No hay framework de pruebas. La verificación es `npx tsc --noEmit`, `npm run lint` y scripts `tsx`. **`npm run lint` tiene que quedar sin ningún aviso.**

### Seis lecciones de la ejecución de Recursos

Las revisiones del plan anterior encontraron 38 defectos, y casi todos venían del plan, no de quien lo implementaba. Estas son las que van a volver a aparecer aquí. **Todas son vinculantes.**

1. **Un id nunca se genera contando elementos.** `p${lista.length + 1}` produce ids repetidos: con `p1, p2, p3`, quitar el del medio deja la lista en 2 y el siguiente vuelve a llamarse `p3`. Los ids son la clave con la que se guardan las respuestas del estudiante, así que dos iguales hacen que responder uno puntúe los dos. Se usa **el máximo de los sufijos existentes más uno**, como `siguienteIdPregunta` en `components/recursos/editor-opcion.tsx`. **Nada de `Date.now()` ni `Math.random()`**: dos ejercicios iguales tienen que producir los mismos datos.
2. **La limpieza de un script de verificación va en el `.finally()`**, con los ids en variables de módulo, y el fallo se marca con `process.exitCode = 1` y **no** con `process.exit(1)`, que mata el proceso antes de que corra el `finally`. Precedente y comentario explicándolo: `scripts/verificar-personas.ts`.
3. **Ninguna consulta a la base decide dentro de una acción de servidor.** Si una acción necesita decidir, la decisión vive en `lib/` y la acción la llama. Validar la forma de lo que llega del formulario sí puede ir en la acción; consultar el estado de la base, no.
4. **Los mensajes de validación se enseñan en castellano**, y salen del propio esquema zod. No se redacta una segunda tanda. Si añades un `.min()`, `.max()` o un `.refine()`, **lleva su mensaje**.
5. **Los errores y las confirmaciones se pintan en un solo sitio por pantalla.** Cuatro bloques copiados son cuatro sitios donde falta uno: en Recursos, una acción falló en silencio por esto. Y ojo al reverso: un error viejo de una acción no debe tapar la confirmación nueva de otra.
6. **`z.array(...).min(n)` no dice nada del contenido de sus elementos.** Una lista de dos cadenas vacías pasa `.min(2)`. Si el elemento tiene que decir algo, el mínimo va también **dentro**, y el editor avisa antes de guardar.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `prisma/schema.prisma` | **Modificar.** `Recorrido.destreza` y el modelo `Escucha`. | 1 |
| `prisma/migrations/<ts>_prueba_y_escuchas/migration.sql` | **Crear** (lo genera Prisma). | 1 |
| `lib/escuchas.ts` | **Crear.** Contar y consultar escuchas. **Fuera de las acciones.** | 1 |
| `scripts/verificar-dele.ts` | **Crear.** El contador de escuchas contra filas reales. | 1 |
| `lib/dele/mapa.ts` | **Crear.** Los datos del examen, comentados y editables. | 2 |
| `lib/dele/index.ts` | **Crear.** Las preguntas que se le hacen al mapa. | 2 |
| `scripts/verificar-dele.ts` | **Ampliar.** El mapa consigo mismo. | 2 |
| `lib/ejercicios/relacionar.ts` | **Modificar.** `sobrantes`, `texto`, `audio` y `escuchas`. | 3 |
| `components/ejercicios/relacionar.tsx` | **Modificar.** Pintar el texto y el audio de cada fila. | 3 |
| `scripts/verificar-recursos.ts` | **Ampliar.** Los sobrantes y el audio de la izquierda. | 3 |
| `components/recursos/editor-relacionar.tsx` | **Modificar.** Sobrantes, texto y audio. | 4 |
| `app/api/archivos/route.ts` | **Modificar.** Dejar entrar el audio, con su tope. | 5 |
| `components/recursos/subir-audio.tsx` | **Crear.** Subir un archivo o pegar un enlace. | 5 |
| `components/recursos/editor-opcion.tsx` | **Modificar.** El audio de cada pregunta. | 5 |
| `lib/acciones-escuchas.ts` | **Crear.** La acción que llama el reproductor. | 6 |
| `components/ejercicios/reproductor.tsx` | **Crear.** El reproductor con su contador. | 6 |
| `lib/acciones.ts` | **Modificar.** `crearSecuencia` guarda la destreza. | 7 |
| `app/(app)/profe/secuencias/nueva/page.tsx` | **Modificar.** Nivel y prueba. | 7 |
| `app/(app)/recorridos/[id]/page.tsx` | **Modificar.** Las tareas sugeridas. | 8 |
| `app/(app)/recorridos/[id]/tareas-sugeridas.tsx` | **Crear.** La lista de tareas que faltan. | 8 |
| `app/(app)/pasos/[pasoId]/page.tsx` | **Modificar.** Filtrar el selector por formato. | 9 |
| `app/(app)/pasos/[pasoId]/selector-ejercicio.tsx` | **Modificar.** La salida del filtro de formato. | 9 |
| `app/(app)/profe/recursos/nuevo/page.tsx` | **Modificar.** Arrancar con la estructura de la tarea. | 9 |

---

### Task 1: La migración y el contador de escuchas

La única migración del plan, y la pieza que decide si las dos escuchas son de verdad o decorativas. Se escribe el script primero.

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Recorrido`, y modelo `Escucha` nuevo)
- Create: `prisma/migrations/<timestamp>_prueba_y_escuchas/migration.sql`
- Create: `lib/escuchas.ts`
- Create: `scripts/verificar-dele.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces, desde `@/lib/escuchas`:
  - `async function escuchasDe(asignacionId: string, pasoId: string, clave: string): Promise<number>`
  - `async function apuntarEscucha(asignacionId: string, pasoId: string, clave: string, maximo: number): Promise<number | null>` — las que quedan tras apuntar, o `null` si ya no quedaba ninguna.

- [ ] **Step 1: Añadir la columna y el modelo al esquema**

En `prisma/schema.prisma`, dentro del modelo `Recorrido`, junto a `nivel`:

```prisma
  /// De qué prueba del DELE es esta secuencia. Null en clases particulares,
  /// y también en una de preparación que no quiera ceñirse a una prueba.
  destreza     Destreza?
```

Y un modelo nuevo, al lado de `PasoCompletado`:

```prisma
/// Cuántas veces ha oído un estudiante un audio concreto de un paso.
///
/// Tabla propia y no una columna en PasoCompletado: esa fila significa "el
/// paso está hecho" y se crea cuando el estudiante lo marca, así que apuntar
/// ahí la primera escucha daría el paso por hecho al dar al play.
///
/// Una fila por audio y no por paso: la tarea 1 de comprensión auditiva de
/// B1 son seis monólogos, y cada uno se oye dos veces.
model Escucha {
  id           String     @id @default(cuid())
  asignacion   Asignacion @relation(fields: [asignacionId], references: [id], onDelete: Cascade)
  asignacionId String
  pasoId       String
  /// El id del elemento que lleva el audio: una pregunta en `opcion`, una
  /// pareja en `relacionar`.
  clave        String
  veces        Int        @default(0)
  createdAt    DateTime   @default(now())

  @@unique([asignacionId, pasoId, clave])
  @@index([asignacionId])
}
```

Y en el modelo `Asignacion`, junto a `completados`:

```prisma
  escuchas    Escucha[]
```

- [ ] **Step 2: Generar y aplicar la migración**

Run: `npx prisma migrate dev --name prueba_y_escuchas`

Expected: crea la carpeta de migración y la aplica. **Si propone un reset de la base, para y repórtalo**: no debería, porque solo se añade una columna nullable y una tabla nueva.

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

- [ ] **Step 3: Reiniciar el `next dev`**

Run: `npm run fresh`

Ejecútalo en segundo plano y mátalo después: no termina solo. Sin esto, el proceso abierto se queda con el cliente de Prisma viejo y da errores que no llevan a ninguna parte.

- [ ] **Step 4: Escribir el script de verificación (falla)**

Crea `scripts/verificar-dele.ts`:

```ts
/**
 * Verifica el contador de escuchas y, desde la Tarea 2, el mapa del examen.
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-dele.ts
 */
import "dotenv/config";
import { apuntarEscucha, escuchasDe } from "@/lib/escuchas";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-dele-${process.pid}`;

// Los ids de todo lo que se crea, en variables de módulo para poder
// limpiarlo desde el `.finally()` aunque una afirmación reviente a mitad.
let recorridoId: string | null = null;
let pasoId: string | null = null;
let asignacionId: string | null = null;
const usuarioIds: string[] = [];

async function main() {
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
    data: { recorridoId: recorrido.id, titulo: "Paso", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
  });
  pasoId = paso.id;

  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;

  // 1. Sin haber oído nada, cero.
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 0, "sin oír nada, cero escuchas");

  // 2. Las dos escuchas del examen.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === 1, "la primera deja una");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === 0, "la segunda deja cero");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === null, "la tercera se niega");

  // 3. La que de verdad importa: preguntar otra vez después de agotarlas
  //    sigue diciendo que no. Si esto falla, recargar la página devuelve las
  //    escuchas y el contador no sirve para nada.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "a", 2)) === null, "sigue negándose al insistir");
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 2, "el contador se quedó en dos");

  // 4. Cada audio cuenta por su cuenta: la tarea 1 de auditiva son seis.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "b", 2)) === 1, "otro audio empieza de cero");
  afirmar((await escuchasDe(asignacion.id, paso.id, "a")) === 2, "y no toca el contador del primero");

  // 5. El máximo es del ejercicio, no una constante: con cuatro, la tercera
  //    sí suena.
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 3, "con máximo cuatro, la primera deja tres");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 2, "la segunda deja dos");
  afirmar((await apuntarEscucha(asignacion.id, paso.id, "c", 4)) === 1, "la tercera deja una");

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` aquí mataría el proceso antes del `finally`, y la
    // limpieza no correría. En TDD el paso que falla lo hace a propósito,
    // así que eso dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    // El orden importa: los vínculos antes que sus extremos.
    if (asignacionId) {
      await prisma.escucha.deleteMany({ where: { asignacionId } });
      await prisma.pasoCompletado.deleteMany({ where: { asignacionId } });
      await prisma.asignacion.delete({ where: { id: asignacionId } });
    }
    if (pasoId) await prisma.paso.delete({ where: { id: pasoId } });
    if (recorridoId) await prisma.recorrido.delete({ where: { id: recorridoId } });
    if (usuarioIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    await prisma.$disconnect();
  });
```

- [ ] **Step 5: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-dele.ts`
Expected: FALLA al importar, con «Cannot find module '@/lib/escuchas'». Es el fallo correcto.

- [ ] **Step 6: Escribir `lib/escuchas.ts`**

```ts
import { prisma } from "@/lib/prisma";

// Solo de servidor: habla con la base. Vive fuera de las acciones para que
// el script de verificación pueda ejercitarlo.

/** Cuántas veces ha oído ya este estudiante este audio. */
export async function escuchasDe(
  asignacionId: string,
  pasoId: string,
  clave: string,
): Promise<number> {
  const fila = await prisma.escucha.findUnique({
    where: { asignacionId_pasoId_clave: { asignacionId, pasoId, clave } },
    select: { veces: true },
  });
  return fila?.veces ?? 0;
}

/**
 * Apunta una escucha y devuelve cuántas quedan, o `null` si ya no quedaba
 * ninguna. Quien llama distingue así "esta era la última" de "no suena".
 *
 * El tope va **dentro** de la escritura y no en un `if` previo, igual que
 * hace `desbloquear` en `lib/admin.ts`: entre comprobar y escribir cabe otra
 * pestaña del mismo estudiante, y dos pestañas se regalarían una escucha
 * cada una.
 */
export async function apuntarEscucha(
  asignacionId: string,
  pasoId: string,
  clave: string,
  maximo: number,
): Promise<number | null> {
  // Asegura que la fila existe sin contar nada: `update: {}` es idempotente
  // y no incrementa. Hace falta porque el paso siguiente es un `updateMany`
  // con condición, y un `updateMany` no crea filas.
  await prisma.escucha.upsert({
    where: { asignacionId_pasoId_clave: { asignacionId, pasoId, clave } },
    update: {},
    create: { asignacionId, pasoId, clave, veces: 0 },
  });

  const { count } = await prisma.escucha.updateMany({
    where: { asignacionId, pasoId, clave, veces: { lt: maximo } },
    data: { veces: { increment: 1 } },
  });
  if (count === 0) return null;

  return maximo - (await escuchasDe(asignacionId, pasoId, clave));
}
```

- [ ] **Step 7: Ejecutar el script hasta que pase**

Run: `npx tsx scripts/verificar-dele.ts`
Expected: una línea `OK:` por afirmación y `Todo bien.` al final.

- [ ] **Step 8: Comprobar que la limpieza funciona también al fallar**

Rompe a propósito una afirmación (cambia un `=== 1` por `=== 9` en una sola línea) y ejecuta:

Run: `npx tsx scripts/verificar-dele.ts`
Expected: sale `FALLO:` y termina con código 1.

Comprueba que no quedó basura:

Run: `npx tsx -e 'import "dotenv/config"; import { prisma } from "@/lib/prisma"; prisma.user.count({ where: { email: { contains: "ejemplo.test" } } }).then(n => console.log("usuarios de prueba:", n)).finally(() => prisma.$disconnect())'`

Si `tsx -e` no admite `await` de nivel superior en este entorno, escribe la comprobación en un archivo temporal y bórralo después.

Expected: 0. Deshaz el cambio y vuelve a ejecutar el script para dejarlo en verde.

- [ ] **Step 9: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

```bash
git add prisma/schema.prisma prisma/migrations lib/escuchas.ts scripts/verificar-dele.ts
git commit -m "Contar las escuchas donde no las pueda devolver una recarga"
```

---

### Task 2: El mapa del examen

Los datos y las cuatro preguntas que se les hacen. Sin pantallas todavía.

**Files:**
- Create: `lib/dele/mapa.ts`
- Create: `lib/dele/index.ts`
- Modify: `scripts/verificar-dele.ts`

**Interfaces:**
- Produces, desde `@/lib/dele`:
  - `type FormatoDele = "MC" | "MATCH_TEXT" | "MATCH_PERSON" | "MATCH_TOPIC" | "GAP_INSERT" | "ATTRIB" | "CLOZE"`
  - `type TareaDele = { numero: number; formato: FormatoDele; motor: MarcaEjercicio; listaComun: boolean; items: number; opciones: number; pide: string; verificado: boolean }`
  - `type PruebaDele = { nivel: Nivel; prueba: Destreza; duracionMinutos: number; tareas: TareaDele[] }`
  - `const PRUEBAS: PruebaDele[]`
  - `function pruebasDe(nivel: Nivel): PruebaDele[]`
  - `function pruebaDe(nivel: Nivel, destreza: Destreza): PruebaDele | null`
  - `function tareaDe(nivel: Nivel, destreza: Destreza, numero: number): TareaDele | null`
  - `function sobrantesDe(tarea: TareaDele): number`

**`lib/dele/mapa.ts` no importa `prisma` ni `node:crypto`:** son datos puros, así que un componente de cliente puede importarlo si le hace falta.

- [ ] **Step 1: Escribir el mapa**

Crea `lib/dele/mapa.ts`. **Es el archivo que el profesor va a corregir**, así que los comentarios importan tanto como los datos.

```ts
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";

/**
 * El mapa del examen: qué tareas tiene cada prueba y cómo se construye cada
 * una. Datos puros, sin base de datos: se edita a mano.
 *
 * Solo están las dos pruebas de comprensión —`CE` de lectura y `CO` de
 * auditiva—, que son las que el motor sabe corregir solo. Las de expresión
 * tienen su propio diseño.
 *
 * `verificado: false` marca lo que está deducido y no confirmado por el
 * profesor. La aplicación lo enseña en pantalla; corregir el dato y poner
 * `true` hace desaparecer el aviso.
 */
export type FormatoDele =
  | "MC"
  | "MATCH_TEXT"
  | "MATCH_PERSON"
  | "MATCH_TOPIC"
  | "GAP_INSERT"
  | "ATTRIB"
  | "CLOZE";

export type TareaDele = {
  numero: number;
  formato: FormatoDele;
  /** Con qué tipo del motor se construye. */
  motor: MarcaEjercicio;
  /**
   * Si las opciones son una lista común a todos los ítems.
   *
   * Es lo que decide entre `opcion` y `relacionar`, y no el nombre del
   * formato: cuando una misma opción vale para varios ítems —tres textos
   * para seis preguntas— hace falta la lista común de `opcion`, porque
   * `relacionar` es uno a uno y su esquema prohíbe dos derechas iguales.
   */
  listaComun: boolean;
  /** Los ítems oficiales de la tarea. */
  items: number;
  /**
   * Entre cuántas opciones elige **cada ítem**.
   *
   * Ojo, que no es lo mismo que «cuántas opciones hay en la pantalla». En
   * `MC` y en `CLOZE` cada pregunta trae sus tres propias, así que tres
   * opciones y seis preguntas son dieciocho opciones en total. En `ATTRIB` y
   * en `MATCH_PERSON` las tres son una lista común que todos comparten. En
   * los dos casos el número dice lo mismo desde el punto de vista del
   * estudiante: entre cuántas elige cada vez.
   *
   * **Los sobrantes solo existen en `relacionar`**, que es el único que
   * reparte de una lista única y uno a uno: ahí, nueve opciones para seis
   * ítems son tres que no emparejan con nada. En `opcion` la resta no
   * significa nada.
   */
  opciones: number;
  /** Lo que se enseña en pantalla al elegir la tarea. */
  pide: string;
  verificado: boolean;
};

export type PruebaDele = {
  nivel: Nivel;
  prueba: Destreza;
  duracionMinutos: number;
  tareas: TareaDele[];
};

export const PRUEBAS: PruebaDele[] = [
  // ─── B1 ──────────────────────────────────────────────────────────────
  // Verificado: viene del encargo del profesor marcado como tal.
  {
    nivel: "B1", prueba: "CE", duracionMinutos: 70,
    tareas: [
      { numero: 1, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis enunciados con seis de los nueve textos breves. Sobran tres." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas de tres opciones sobre un texto informativo." },
      { numero: 3, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas sobre tres textos: para cada una, de qué texto se habla. Un texto vale para varias." },
      { numero: 4, formato: "GAP_INSERT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 8, verificado: true,
        pide: "Insertar seis de los ocho fragmentos en los huecos del texto. Sobran dos." },
      { numero: 5, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis huecos de un texto epistolar, con tres opciones cada uno." },
    ],
  },
  {
    nivel: "B1", prueba: "CO", duracionMinutos: 40,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis monólogos cortos, una pregunta de tres opciones cada uno. Un audio por pregunta." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Un monólogo largo y seis preguntas de tres opciones." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis noticias, una pregunta de tres opciones cada una." },
      { numero: 4, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 5, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Una conversación: de cada enunciado, si lo dice A, B o ninguno." },
    ],
  },

  // ─── B2 ──────────────────────────────────────────────────────────────
  {
    nivel: "B2", prueba: "CE", duracionMinutos: 70,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas de tres opciones sobre un artículo." },
      { numero: 2, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 10, opciones: 4, verificado: true,
        pide: "Diez preguntas sobre cuatro testimonios: de quién se habla en cada una." },
      { numero: 3, formato: "GAP_INSERT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 8, verificado: true,
        pide: "Insertar seis de los ocho fragmentos en los huecos del texto. Sobran dos." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 14, opciones: 3, verificado: true,
        pide: "Catorce huecos de gramática y léxico, con tres opciones cada uno." },
    ],
  },
  {
    nivel: "B2", prueba: "CO", duracionMinutos: 40,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis conversaciones breves, una pregunta de tres opciones cada una." },
      { numero: 2, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Una conversación: de cada enunciado, si lo dice A, B o ninguno." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Una entrevista y seis preguntas de tres opciones." },
      { numero: 4, formato: "MATCH_TOPIC", motor: "relacionar", listaComun: false,
        items: 6, opciones: 10, verificado: true,
        pide: "Relacionar seis hablantes con seis de los diez temas. Sobran cuatro." },
      { numero: 5, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Un monólogo y seis preguntas de tres opciones." },
    ],
  },

  // ─── A2/B1 escolar ───────────────────────────────────────────────────
  {
    nivel: "A2_B1_ESCOLAR", prueba: "CE", duracionMinutos: 50,
    tareas: [
      { numero: 1, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis enunciados con seis de los nueve textos. Sobran tres." },
      { numero: 2, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas sobre tres textos: de qué texto se habla en cada una." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Un texto y seis preguntas de tres opciones." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: true,
        pide: "Siete huecos con tres opciones cada uno." },
    ],
  },
  {
    nivel: "A2_B1_ESCOLAR", prueba: "CO", duracionMinutos: 35,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Conversaciones con apoyo de imágenes, una pregunta cada una." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis monólogos con seis de los nueve enunciados. Sobran tres." },
      { numero: 3, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "De cada enunciado, si lo dice el hombre, la mujer o ninguno." },
      { numero: 4, formato: "MC", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: true,
        pide: "Siete noticias, una pregunta de tres opciones cada una." },
    ],
  },

  // ─── A1, A2 y C1: DEDUCIDOS ──────────────────────────────────────────
  // El encargo los dejó como "completar". Están deducidos siguiendo el
  // patrón de los verificados y las especificaciones del Instituto
  // Cervantes, pero son deducción y no conocimiento confirmado. La
  // aplicación lo avisa en pantalla. Al corregir un dato, pon `verificado`
  // en `true` y el aviso desaparece.
  {
    nivel: "A1", prueba: "CE", duracionMinutos: 45,
    tareas: [
      { numero: 1, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 5, opciones: 8, verificado: false,
        pide: "Relacionar cinco enunciados con cinco de los ocho textos muy breves. Sobran tres." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 5, opciones: 3, verificado: false,
        pide: "Un texto sencillo y cinco preguntas de tres opciones." },
      { numero: 3, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 8, opciones: 3, verificado: false,
        pide: "Ocho preguntas sobre tres textos: de qué texto se habla en cada una." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: false,
        pide: "Siete huecos con tres opciones cada uno." },
    ],
  },
  {
    nivel: "A1", prueba: "CO", duracionMinutos: 25,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 5, opciones: 3, verificado: false,
        pide: "Cinco diálogos muy breves, una pregunta de tres opciones cada uno." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: false,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 3, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 7, opciones: 3, verificado: false,
        pide: "De cada enunciado, si lo dice A, B o ninguno." },
      { numero: 4, formato: "MC", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: false,
        pide: "Siete mensajes breves, una pregunta de tres opciones cada uno." },
    ],
  },
  {
    nivel: "A2", prueba: "CE", duracionMinutos: 60,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 5, opciones: 3, verificado: false,
        pide: "Un texto y cinco preguntas de tres opciones." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 8, opciones: 11, verificado: false,
        pide: "Relacionar ocho enunciados con ocho de los once textos. Sobran tres." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Un texto informativo y seis preguntas de tres opciones." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Seis huecos con tres opciones cada uno." },
    ],
  },
  {
    nivel: "A2", prueba: "CO", duracionMinutos: 40,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Seis avisos o mensajes, una pregunta de tres opciones cada uno." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: false,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 3, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: false,
        pide: "Una conversación: de cada enunciado, si lo dice A, B o ninguno." },
      { numero: 4, formato: "MC", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: false,
        pide: "Un monólogo y siete preguntas de tres opciones." },
    ],
  },
  {
    nivel: "C1", prueba: "CE", duracionMinutos: 90,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Un texto largo y seis preguntas de tres opciones." },
      { numero: 2, formato: "GAP_INSERT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 8, verificado: false,
        pide: "Insertar seis de los ocho fragmentos en los huecos del texto. Sobran dos." },
      { numero: 3, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 8, opciones: 4, verificado: false,
        pide: "Ocho preguntas sobre cuatro textos: de cuál se habla en cada una." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 12, opciones: 3, verificado: false,
        pide: "Doce huecos de uso de la lengua, con tres opciones cada uno." },
      { numero: 5, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 8, opciones: 3, verificado: false,
        pide: "Ocho huecos de léxico, con tres opciones cada uno." },
    ],
  },
  {
    nivel: "C1", prueba: "CO", duracionMinutos: 50,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Una conversación larga y seis preguntas de tres opciones." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 8, opciones: 3, verificado: false,
        pide: "Una conferencia y ocho preguntas de tres opciones." },
      { numero: 3, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: false,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 10, opciones: 3, verificado: false,
        pide: "Diez huecos sobre lo escuchado, con tres opciones cada uno." },
    ],
  },
];
```

- [ ] **Step 2: Escribir las preguntas al mapa**

Crea `lib/dele/index.ts`:

```ts
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { PRUEBAS, type PruebaDele, type TareaDele } from "@/lib/dele/mapa";

export * from "@/lib/dele/mapa";

/** Las pruebas que este nivel tiene en el mapa. Vacío si no hay ninguna. */
export function pruebasDe(nivel: Nivel): PruebaDele[] {
  return PRUEBAS.filter((p) => p.nivel === nivel);
}

export function pruebaDe(nivel: Nivel, destreza: Destreza): PruebaDele | null {
  return PRUEBAS.find((p) => p.nivel === nivel && p.prueba === destreza) ?? null;
}

/**
 * La tarea número N de una prueba, o null.
 *
 * El número de tarea es el orden del paso dentro de la secuencia, así que
 * un paso más allá de la última tarea oficial devuelve null y la pantalla
 * se comporta como si no hubiera mapa. Es a propósito: el mapa aconseja y
 * no manda, y añadir un sexto paso a una prueba de cinco está permitido.
 */
export function tareaDe(
  nivel: Nivel,
  destreza: Destreza,
  numero: number,
): TareaDele | null {
  return pruebaDe(nivel, destreza)?.tareas.find((t) => t.numero === numero) ?? null;
}

/**
 * Cuántas opciones sobran en esta tarea. Cero si no sobra ninguna.
 *
 * Solo `relacionar` puede tener sobrantes: es el único que reparte de una
 * lista única y uno a uno. En `opcion`, `opciones` son las de cada ítem
 * —tres por pregunta, no tres en total—, así que restarle los ítems no
 * significa nada y hay que devolver cero sin mirar.
 */
export function sobrantesDe(tarea: TareaDele): number {
  if (tarea.motor !== "relacionar") return 0;
  return Math.max(0, tarea.opciones - tarea.items);
}
```

- [ ] **Step 3: Añadir las afirmaciones del mapa al script (fallan)**

En `scripts/verificar-dele.ts`, añade el import y un bloque **al principio de `main`**, antes de crear ninguna fila (son comprobaciones puras y no necesitan base):

```ts
import { PRUEBAS, pruebaDe, pruebasDe, sobrantesDe, tareaDe } from "@/lib/dele";
```

```ts
  // ─── El mapa consigo mismo ──────────────────────────────────────────
  const MOTORES = new Set(["opcion", "huecos", "relacionar", "ordenar"]);

  for (const prueba of PRUEBAS) {
    const donde = `${prueba.nivel} · ${prueba.prueba}`;

    afirmar(prueba.tareas.length > 0, `${donde} tiene tareas`);
    afirmar(prueba.duracionMinutos > 0, `${donde} tiene duración`);

    const numeros = prueba.tareas.map((t) => t.numero);
    afirmar(
      new Set(numeros).size === numeros.length,
      `${donde} no repite ningún número de tarea`,
    );

    for (const tarea of prueba.tareas) {
      const cual = `${donde} · T${tarea.numero}`;
      afirmar(MOTORES.has(tarea.motor), `${cual} apunta a un tipo del motor que existe`);
      afirmar(tarea.items > 0, `${cual} tiene ítems`);
      afirmar(tarea.opciones > 0, `${cual} tiene opciones`);
      afirmar(tarea.pide.trim().length > 0, `${cual} dice qué se pide`);
      // `relacionar` es uno a uno: no puede tener menos opciones que ítems,
      // porque cada ítem necesita la suya y no se pueden repetir.
      if (tarea.motor === "relacionar") {
        afirmar(!tarea.listaComun, `${cual} con relacionar no usa lista común`);
        afirmar(
          tarea.opciones >= tarea.items,
          `${cual} con relacionar tiene al menos una opción por ítem`,
        );
      }
      // Solo `relacionar` reparte de una lista única y por tanto puede tener
      // sobrantes. En `opcion`, `opciones` son las de cada ítem, así que la
      // resta no significa nada y `sobrantesDe` tiene que dar cero.
      if (tarea.motor !== "relacionar") {
        afirmar(sobrantesDe(tarea) === 0, `${cual} no es de sobrantes`);
      }
    }
  }

  // Las pruebas verificadas tienen el número de tareas que dice el examen.
  const ESPERADAS: [Nivel, Destreza, number][] = [
    ["B1", "CE", 5], ["B1", "CO", 5],
    ["B2", "CE", 4], ["B2", "CO", 5],
    ["A2_B1_ESCOLAR", "CE", 4], ["A2_B1_ESCOLAR", "CO", 4],
  ];
  for (const [nivel, destreza, cuantas] of ESPERADAS) {
    const p = pruebaDe(nivel, destreza);
    afirmar(p !== null, `${nivel} · ${destreza} está en el mapa`);
    afirmar(p!.tareas.length === cuantas, `${nivel} · ${destreza} tiene ${cuantas} tareas`);
    afirmar(p!.tareas.every((t) => t.verificado), `${nivel} · ${destreza} está toda verificada`);
  }

  // Las cuatro preguntas al mapa.
  afirmar(pruebasDe("B1").length === 2, "B1 tiene las dos pruebas de comprensión");
  afirmar(pruebaDe("B1", "EE") === null, "las de expresión no están en el mapa");
  afirmar(tareaDe("B1", "CE", 1)?.formato === "MATCH_TEXT", "B1 · CE · T1 es MATCH_TEXT");
  afirmar(tareaDe("B1", "CE", 99) === null, "una tarea que no existe devuelve null");
  afirmar(sobrantesDe(tareaDe("B1", "CE", 1)!) === 3, "B1 · CE · T1 tiene tres sobrantes");
  afirmar(sobrantesDe(tareaDe("B1", "CE", 2)!) === 0, "B1 · CE · T2 no tiene sobrantes");
```

Añade los tipos que necesita el bloque al import de enums:

```ts
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
```

- [ ] **Step 4: Ejecutar y arreglar lo que salga**

Run: `npx tsx scripts/verificar-dele.ts`
Expected: todas en verde. **Si alguna falla, el error está en el mapa, no en las afirmaciones**: es justo para lo que están. Corrige el dato.

- [ ] **Step 5: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

```bash
git add lib/dele scripts/verificar-dele.ts
git commit -m "El mapa del examen, con lo deducido marcado como tal"
```

---

### Task 3: Sobrantes, texto y audio en `relacionar`

El motor. Sin editor todavía: al terminar esta tarea, un ejercicio con sobrantes se corrige bien si se siembra a mano.

**Files:**
- Modify: `lib/ejercicios/relacionar.ts`
- Modify: `components/ejercicios/relacionar.tsx`
- Modify: `scripts/verificar-recursos.ts`

**Interfaces:**
- Produces: `relacionarSchema` con tres campos nuevos (`sobrantes`, `texto`, `escuchas`) y `parejaSchema` con `audio`; `RelacionarPublica` gana `texto` y el audio en cada izquierda.

- [ ] **Step 1: Añadir las afirmaciones al script (fallan)**

En `scripts/verificar-recursos.ts`, añade el import del esquema y un bloque nuevo dentro de `main`, después de las que ya hay:

```ts
import { corregirRelacionar, relacionarSchema, versionPublicaRelacionar } from "@/lib/ejercicios/relacionar";
```

```ts
  // ─── Sobrantes, texto y audio en relacionar ─────────────────────────
  const CON_SOBRANTES = {
    ejercicio: "relacionar",
    consigna: "Relaciona cada enunciado con su texto.",
    texto: "Un pasaje con dos huecos: {1} y {2}.",
    parejas: [
      { id: "r1", izquierda: "Hueco 1", derecha: "el primero", audio: "/api/archivos/uno" },
      { id: "r2", izquierda: "Hueco 2", derecha: "el segundo" },
    ],
    sobrantes: ["el tercero", "el cuarto"],
  };

  const parseado = relacionarSchema.safeParse(CON_SOBRANTES);
  afirmar(parseado.success, "un relacionar con sobrantes, texto y audio es válido");

  const datos = parseado.success ? parseado.data : null;
  afirmar(datos !== null, "el parseo devolvió datos");

  const publica = versionPublicaRelacionar(datos!, "semilla-de-prueba");
  afirmar(publica.derechas.length === 4, "las derechas públicas son las buenas más las sobrantes");
  afirmar(publica.texto === CON_SOBRANTES.texto, "el texto viaja a la versión pública");
  afirmar(
    publica.izquierdas[0].audio === "/api/archivos/uno",
    "el audio de la pareja viaja a su izquierda",
  );
  afirmar(publica.izquierdas[1].audio === undefined, "una pareja sin audio no lo inventa");
  // Las claves tienen que ser indistinguibles: si una sobrante llevara otra
  // forma, el ejercicio se resolvería mirando el código de la página.
  afirmar(
    publica.derechas.every((d) => /^d\d+$/.test(d.clave)),
    "las claves de sobrantes y buenas tienen la misma forma",
  );

  // Un sobrante nunca puntúa, aunque el estudiante lo empareje.
  const claveSobrante = publica.derechas.find((d) => d.texto === "el tercero")!.clave;
  const claveBuena = publica.derechas.find((d) => d.texto === "el primero")!.clave;
  const conSobrante = corregirRelacionar(
    datos!,
    { r1: claveSobrante, r2: claveBuena },
    "semilla-de-prueba",
  );
  afirmar(conSobrante.aciertos === 0, "emparejar un sobrante no da ningún punto");
  afirmar(conSobrante.total === 2, "el total sigue siendo el número de parejas, no de opciones");

  // Y lo bueno sigue puntuando igual que antes.
  const claveDos = publica.derechas.find((d) => d.texto === "el segundo")!.clave;
  const bien = corregirRelacionar(
    datos!,
    { r1: claveBuena, r2: claveDos },
    "semilla-de-prueba",
  );
  afirmar(bien.aciertos === 2, "las dos bien emparejadas dan dos puntos");

  // La regla nueva: un sobrante no puede repetir una respuesta buena.
  afirmar(
    !relacionarSchema.safeParse({
      ...CON_SOBRANTES,
      sobrantes: ["el primero"],
    }).success,
    "un sobrante que repite una respuesta buena se rechaza",
  );

  // Sin sobrantes sigue funcionando como siempre.
  afirmar(
    relacionarSchema.safeParse({
      ejercicio: "relacionar",
      consigna: "c",
      parejas: [
        { id: "r1", izquierda: "a", derecha: "b" },
        { id: "r2", izquierda: "c", derecha: "d" },
      ],
    }).success,
    "un relacionar sin sobrantes sigue siendo válido",
  );
```

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-recursos.ts`
Expected: FALLA en «un relacionar con sobrantes, texto y audio es válido», porque el esquema todavía tira los campos que no conoce y `publica.texto` sale `undefined`.

- [ ] **Step 3: Ampliar el esquema**

En `lib/ejercicios/relacionar.ts`, sustituye `parejaSchema` y `relacionarSchema`:

```ts
export const parejaSchema = z.object({
  id: z.string(),
  izquierda: z.string(),
  derecha: z.string(),
  /**
   * Lo que hay que escuchar para emparejar esta fila. Opcional.
   *
   * Hace falta porque dos tareas auditivas del DELE no son preguntas sino
   * emparejamientos —relacionar seis hablantes con temas, o seis audios con
   * enunciados—, y en las dos lo que suena está a la izquierda.
   */
  audio: z.string().optional(),
});

export const relacionarSchema = z
  .object({
    ejercicio: z.literal("relacionar"),
    consigna: z.string(),
    /** Pasaje que se pinta encima de las columnas. Para insertar fragmentos. */
    texto: z.string().optional(),
    parejas: z.array(parejaSchema).min(2, { message: "El ejercicio necesita al menos dos parejas." }),
    /**
     * Textos que se mezclan con los de la derecha y no emparejan con nada.
     * Nueve textos para seis enunciados son seis parejas y tres sobrantes.
     */
    sobrantes: z.array(z.string()).default([]),
    /** Cuántas veces se puede oír cada audio. Dos, como en el examen. */
    escuchas: z.number().int().min(1, { message: "Hay que poder oír el audio al menos una vez." }).default(2),
  })
  .refine(
    (d) => new Set(d.parejas.map((p) => p.derecha)).size === d.parejas.length,
    {
      message:
        "Dos parejas no pueden compartir el mismo texto en `derecha`: el estudiante vería dos celdas idénticas y una de las dos filas quedaría mal contada pase lo que pase. Repetir `izquierda` sí está permitido.",
    },
  )
  .refine(
    (d) => {
      const buenas = new Set(d.parejas.map((p) => p.derecha));
      return d.sobrantes.every((s) => !buenas.has(s));
    },
    {
      message:
        "Un sobrante no puede repetir el texto de una respuesta correcta: serían dos celdas idénticas y una de las dos filas quedaría mal contada pase lo que pase.",
    },
  )
  .refine(
    (d) => new Set(d.sobrantes).size === d.sobrantes.length,
    { message: "Dos sobrantes no pueden ser iguales, por el mismo motivo." },
  );
```

- [ ] **Step 4: Repartir las claves entre buenas y sobrantes**

En el mismo archivo, sustituye `repartirClaves` y `versionPublicaRelacionar`:

```ts
export type RelacionarPublica = {
  consigna: string;
  /** Pasaje de arriba, si lo hay. */
  texto?: string;
  izquierdas: { id: string; texto: string; audio?: string }[];
  /** `clave` es opaca a proposito: no dice a que pareja pertenece. */
  derechas: { clave: string; texto: string }[];
  /** Cuántas veces se puede oír cada audio. */
  escuchas: number;
};

/**
 * Reparte una clave opaca a cada elemento de la derecha segun su posicion
 * en la lista barajada. Es una pieza de la seguridad de este tipo, no toda:
 * si la derecha viajara con el id de su pareja, bastaria con mirar el
 * codigo de la pagina para resolver el ejercicio entero. La otra pieza es
 * la propia `semilla`: quien la llama (`lib/ejercicios/registro.ts`) la
 * deriva del id del ejercicio mezclado con `ENCRYPTION_KEY`, un secreto que
 * el navegador nunca recibe.
 *
 * Los sobrantes entran en el mismo barajado y reciben claves de la misma
 * forma: uno que se distinguiera por su clave resolvería el ejercicio a
 * quien mirase el código. Su `parejaId` es null, y por eso `corregir` no
 * necesita saber nada de ellos: nunca coincide con el id de una pareja.
 *
 * El barajado es estable —misma semilla, mismo orden— por dos razones: el
 * servidor tiene que poder rehacerlo para corregir, y un orden distinto en
 * servidor y navegador rompe la hidratacion de React.
 */
function repartirClaves(datos: Relacionar, semilla: string) {
  const todas = [
    ...datos.parejas.map((p) => ({ parejaId: p.id as string | null, texto: p.derecha })),
    ...datos.sobrantes.map((s) => ({ parejaId: null, texto: s })),
  ];
  return barajarEstable(todas, semilla).map((x, i) => ({
    clave: `d${i}`,
    parejaId: x.parejaId,
    texto: x.texto,
  }));
}

export function versionPublicaRelacionar(
  datos: Relacionar,
  semilla: string,
): RelacionarPublica {
  return {
    consigna: datos.consigna,
    texto: datos.texto,
    izquierdas: datos.parejas.map((p) => ({
      id: p.id,
      texto: p.izquierda,
      audio: p.audio,
    })),
    derechas: repartirClaves(datos, semilla).map(({ clave, texto }) => ({
      clave,
      texto,
    })),
    escuchas: datos.escuchas,
  };
}
```

**`corregirRelacionar` no se toca.** Su `porClave` ahora puede devolver `null` para un sobrante, y `porClave.get(clave) === pareja.id` es falso, que es exactamente lo que tiene que pasar.

- [ ] **Step 5: Ejecutar el script**

Run: `npx tsx scripts/verificar-recursos.ts`
Expected: todo en verde, incluidas las afirmaciones nuevas.

- [ ] **Step 6: Pintar el texto y el audio en la cara del estudiante**

En `components/ejercicios/relacionar.tsx`, dentro del `return` del componente y **antes** del `<div className="grid gap-6 sm:grid-cols-2">`, añade el pasaje:

```tsx
      {datos.texto && (
        <p className="mb-6 whitespace-pre-wrap rounded-tarjeta border border-hp-100 bg-white p-5 text-sm leading-relaxed text-tinta">
          {datos.texto}
        </p>
      )}
```

Y dentro del `<div>` de cada izquierda, **después** del `<span>` del texto y antes del `<span className="ml-auto…">`, el reproductor. En esta tarea es un `<audio>` corriente; la Tarea 6 lo sustituye por el que cuenta escuchas:

```tsx
                  {izq.audio && (
                    <audio controls preload="none" src={izq.audio} className="max-w-[14rem]">
                      Tu navegador no puede reproducir este audio.
                    </audio>
                  )}
```

- [ ] **Step 7: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-recursos.ts && npx tsx scripts/verificar-ejercicios.ts`
Expected: todo limpio y en verde.

```bash
git add lib/ejercicios/relacionar.ts components/ejercicios/relacionar.tsx scripts/verificar-recursos.ts
git commit -m "Sobrantes, pasaje y audio en relacionar, sin tocar la corrección"
```

---

### Task 4: El editor de `relacionar` con sobrantes, texto y audio

La cara de autoría de lo que la Tarea 3 hizo posible.

**Files:**
- Modify: `components/recursos/editor-relacionar.tsx`

**Interfaces:**
- Consumes: `campo`, `area`, `botonSecundario`, `BotonQuitar` de `./campos`.

- [ ] **Step 1: Ampliar el tipo y el valor inicial**

En `components/recursos/editor-relacionar.tsx`, sustituye el tipo y `RELACIONAR_VACIO`:

```tsx
type Pareja = { id: string; izquierda: string; derecha: string; audio?: string };

type DatosRelacionar = {
  ejercicio: "relacionar";
  consigna: string;
  texto?: string;
  parejas: Pareja[];
  sobrantes: string[];
  escuchas: number;
};

export const RELACIONAR_VACIO: DatosRelacionar = {
  ejercicio: "relacionar",
  consigna: "",
  parejas: [
    { id: "r1", izquierda: "", derecha: "" },
    { id: "r2", izquierda: "", derecha: "" },
  ],
  sobrantes: [],
  escuchas: 2,
};
```

- [ ] **Step 2: Añadir el pasaje**

Después del campo de consigna:

```tsx
      <label className="block text-sm font-semibold text-tinta">
        Pasaje (opcional)
        <textarea
          rows={5}
          value={d.texto ?? ""}
          onChange={(e) => alCambiar({ ...d, texto: e.target.value || undefined })}
          placeholder="Para las tareas de insertar fragmentos: el texto con los huecos numerados."
          className={area}
        />
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Se pinta encima de las dos columnas. Numera los huecos en el texto y
          escribe «Hueco 1», «Hueco 2»… en la columna de la izquierda.
        </span>
      </label>
```

- [ ] **Step 3: Añadir el audio a cada pareja**

Dentro del bloque de cada pareja, después del campo «Derecha», añade el del audio. La Tarea 5 lo sustituye por el componente de subida; aquí es un campo de texto para poder pegar una dirección:

```tsx
            <label className="block w-full text-sm font-semibold text-tinta">
              Audio de esta fila (opcional)
              <input
                type="text"
                value={p.audio ?? ""}
                onChange={(e) => cambiarPareja(i, { audio: e.target.value || undefined })}
                placeholder="Dirección del audio"
                className={campo}
              />
            </label>
```

- [ ] **Step 4: Añadir los sobrantes**

Después del bloque de parejas y antes del botón «Añadir pareja»:

```tsx
      <fieldset className="rounded-tarjeta border border-hp-100 p-4">
        <legend className="px-2 text-sm font-bold text-tinta">Sobrantes</legend>
        <p className="text-sm text-tinta-suave">
          Opciones que se mezclan con las buenas y no emparejan con nada. En el
          DELE son las que hacen que haya nueve textos para seis enunciados.
        </p>

        <div className="mt-3 space-y-2">
          {d.sobrantes.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="text"
                value={s}
                onChange={(e) => {
                  const sobrantes = [...d.sobrantes];
                  sobrantes[i] = e.target.value;
                  alCambiar({ ...d, sobrantes });
                }}
                className={`${campo} mt-0`}
              />
              <BotonQuitar
                onClick={() =>
                  alCambiar({ ...d, sobrantes: d.sobrantes.filter((_, j) => j !== i) })
                }
              >
                Quitar
              </BotonQuitar>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => alCambiar({ ...d, sobrantes: [...d.sobrantes, ""] })}
          className={`${botonSecundario} mt-3`}
        >
          Añadir sobrante
        </button>
      </fieldset>
```

- [ ] **Step 5: Añadir el número de escuchas**

Solo tiene sentido si hay algún audio, así que se enseña únicamente entonces. Ponlo justo después del bloque de sobrantes:

```tsx
      {d.parejas.some((p) => p.audio) && (
        <label className="block w-56 text-sm font-semibold text-tinta">
          Escuchas por audio
          <input
            type="number"
            min={1}
            value={d.escuchas}
            onChange={(e) =>
              alCambiar({ ...d, escuchas: Math.max(1, Number(e.target.value) || 1) })
            }
            className={campo}
          />
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            Dos es lo que da el examen. Sube el número para practicar.
          </span>
        </label>
      )}
```

- [ ] **Step 6: Ampliar los avisos**

Los dos avisos que ya existen tienen que contar también con los sobrantes. Sustituye el cálculo de `incompleta` y `repetida`:

```tsx
  const incompleta =
    d.parejas.some((p) => !p.izquierda.trim() || !p.derecha.trim()) ||
    d.sobrantes.some((s) => !s.trim());

  // El esquema rechaza dos derechas iguales, y también un sobrante que
  // repita una respuesta buena o a otro sobrante: en los tres casos el
  // estudiante vería dos celdas idénticas. Se avisa aquí para no
  // descubrirlo al guardar.
  const todas = [
    ...d.parejas.map((p) => p.derecha.trim()),
    ...d.sobrantes.map((s) => s.trim()),
  ].filter(Boolean);
  const repetida = !incompleta && todas.find((v, i) => todas.indexOf(v) !== i);
```

Y el texto del aviso de repetidos, para que hable de las dos cosas:

```tsx
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          «{repetida}» está dos veces entre las opciones de la derecha, contando
          los sobrantes. El estudiante vería dos celdas idénticas y una de las
          dos filas quedaría mal contada pase lo que pase.
        </p>
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

- [ ] **Step 8: Probarlo a mano**

Run: `npm run dev` (en segundo plano; mátalo después)

Con la cuenta de profesor, en `/profe/recursos/nuevo?tipo=relacionar`: crea dos parejas y dos sobrantes, comprueba que la previsualización enseña **cuatro** opciones a la derecha y solo dos filas a la izquierda, y que emparejar un sobrante da cero. Escribe un sobrante igual que una respuesta buena y comprueba que sale el aviso antes de guardar.

Si no puedes entrar por falta de credenciales, **dilo en el informe** en vez de afirmar que lo probaste.

- [ ] **Step 9: Commit**

```bash
git add components/recursos/editor-relacionar.tsx
git commit -m "Editor de relacionar: sobrantes, pasaje y audio por fila"
```

---

### Task 5: Subir audio

La subida que ya existe deja entrar audio, y los dos editores ganan una forma de elegirlo.

**Files:**
- Modify: `app/api/archivos/route.ts`
- Create: `components/recursos/subir-audio.tsx`
- Modify: `components/recursos/editor-relacionar.tsx`
- Modify: `components/recursos/editor-opcion.tsx`

**Interfaces:**
- Produces, desde `@/components/recursos/subir-audio`: `export default function SubirAudio({ valor, alCambiar }: { valor?: string; alCambiar: (url: string | undefined) => void })`

- [ ] **Step 1: Dejar entrar el audio en la subida**

En `app/api/archivos/route.ts`, sustituye la lista de permitidos y el tope por dos, uno para cada familia:

```ts
// Tope tras redimensionar en el navegador. Una foto de 4000 px comprimida
// a WebP baja de 400 KB, asi que 4 MB solo salta con algo muy raro.
const MAXIMO_IMAGEN = 4 * 1024 * 1024;

// El audio no se puede reducir en el navegador como una imagen, y un audio
// DELE de cinco minutos ronda los 5 MB. Doce deja margen para uno largo sin
// abrir la puerta a subir una película.
const MAXIMO_AUDIO = 12 * 1024 * 1024;

const IMAGENES = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];

const AUDIOS = ["audio/mpeg", "audio/mp4", "audio/m4a", "audio/ogg", "audio/wav", "audio/webm"];
```

Y sustituye las dos comprobaciones:

```ts
  const esImagen = IMAGENES.includes(archivo.type);
  const esAudio = AUDIOS.includes(archivo.type);

  if (!esImagen && !esAudio) {
    return Response.json(
      { error: "Solo se admiten imágenes y audios." },
      { status: 400 },
    );
  }

  const maximo = esImagen ? MAXIMO_IMAGEN : MAXIMO_AUDIO;
  if (archivo.size > maximo) {
    return Response.json(
      {
        error: esImagen
          ? "La imagen pesa demasiado incluso después de reducirla."
          : "El audio pesa demasiado. El tope son 12 MB.",
      },
      { status: 400 },
    );
  }
```

- [ ] **Step 2: Escribir el componente de subida**

Crea `components/recursos/subir-audio.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { campo } from "./campos";

/**
 * Elige el audio de un ejercicio: subiendo un archivo o pegando una
 * dirección. Las dos vías acaban siendo lo mismo —una dirección en el campo
 * `audio`—, así que subir solo añade una forma de generarla.
 *
 * No reduce nada antes de subir, a diferencia de `subir-imagen.tsx`:
 * recomprimir audio en el navegador estropea la voz, que es justo lo que
 * hay que entender.
 */
export default function SubirAudio({
  valor,
  alCambiar,
}: {
  valor?: string;
  alCambiar: (url: string | undefined) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.set("archivo", archivo);
      const respuesta = await fetch("/api/archivos", { method: "POST", body: cuerpo });
      const json = await respuesta.json();
      if (!respuesta.ok) {
        setError(json.error ?? "No se pudo subir el audio.");
        return;
      }
      alCambiar(json.url);
    } catch {
      setError("No se pudo subir el audio.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-2">
      {valor && (
        <audio controls preload="none" src={valor} className="w-full max-w-sm">
          Tu navegador no puede reproducir este audio.
        </audio>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entrada}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) subir(archivo);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={subiendo}
          onClick={() => entrada.current?.click()}
          className="h-9 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400 disabled:opacity-40"
        >
          {subiendo ? "Subiendo…" : "Subir un archivo"}
        </button>

        <input
          type="text"
          value={valor ?? ""}
          onChange={(e) => alCambiar(e.target.value || undefined)}
          placeholder="…o pegar una dirección"
          className={`${campo} mt-0 flex-1`}
        />

        {valor && (
          <button
            type="button"
            onClick={() => alCambiar(undefined)}
            className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
          >
            Quitar
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-2 text-sm text-tinta">{error}</p>
      )}
    </div>
  );
}
```

El campo `json.url` es el correcto: `app/api/archivos/route.ts` termina con `return Response.json({ url: \`/api/archivos/${guardado.id}\` })`.

- [ ] **Step 3: Enchufarlo en el editor de `relacionar`**

Sustituye el campo de texto del audio que puso la Tarea 4 por el componente:

```tsx
import SubirAudio from "./subir-audio";
```

```tsx
            <div className="w-full">
              <span className="block text-sm font-semibold text-tinta">
                Audio de esta fila (opcional)
              </span>
              <div className="mt-1">
                <SubirAudio
                  valor={p.audio}
                  alCambiar={(url) => cambiarPareja(i, { audio: url })}
                />
              </div>
            </div>
```

- [ ] **Step 4: Añadir el audio a cada pregunta en el editor de `opcion`**

`preguntaOpcionSchema.audio` ya existe en el motor y la cara del estudiante ya lo pinta; lo que falta es poder ponerlo.

En `components/recursos/editor-opcion.tsx`, añade `audio?: string` al tipo `Pregunta`, y dentro del bloque de cada pregunta, después del enunciado:

```tsx
          <div className="mt-4">
            <span className="block text-sm font-semibold text-tinta">
              Audio de esta pregunta (opcional)
            </span>
            <div className="mt-1">
              <SubirAudio
                valor={p.audio}
                alCambiar={(url) => cambiarPregunta(i, { audio: url })}
              />
            </div>
          </div>
```

Y el número de escuchas, solo si hay algún audio, junto a los controles de arriba:

```tsx
      {d.preguntas.some((p) => p.audio) && (
        <label className="block w-56 text-sm font-semibold text-tinta">
          Escuchas por audio
          <input
            type="number"
            min={1}
            value={d.escuchas ?? 2}
            onChange={(e) =>
              cambiar({ escuchas: Math.max(1, Number(e.target.value) || 1) })
            }
            className={campo}
          />
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            Dos es lo que da el examen. Sube el número para practicar.
          </span>
        </label>
      )}
```

Añade `escuchas?: number` al tipo `DatosOpcion` del editor.

- [ ] **Step 5: Añadir `escuchas` al esquema de `opcion`**

En `lib/ejercicios/opcion.ts`, dentro de `opcionSchema`, junto a `presentacion`:

```ts
    /** Cuántas veces se puede oír cada audio. Dos, como en el examen. */
    escuchas: z.number().int().min(1, { message: "Hay que poder oír el audio al menos una vez." }).default(2),
```

Y en `OpcionPublica` y `versionPublicaOpcion`, para que llegue al navegador:

```ts
export type OpcionPublica = {
  consigna: string;
  multiple: boolean;
  presentacion: "botones" | "desplegable";
  escuchas: number;
  preguntas: { id: string; enunciado: string; opciones: string[]; audio?: string }[];
};
```

```ts
    escuchas: datos.escuchas,
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-recursos.ts && npx tsx scripts/verificar-ejercicios.ts && npx tsx scripts/sembrar-ejercicios-demo.ts`
Expected: todo limpio. La siembra tiene que seguir funcionando: `escuchas` tiene valor por defecto, así que los datos sembrados sin ese campo siguen validando.

- [ ] **Step 7: Commit**

```bash
git add app/api/archivos/route.ts components/recursos lib/ejercicios/opcion.ts
git commit -m "Subir audio o pegar su dirección, en los dos editores que lo admiten"
```

---

### Task 6: El reproductor con las dos escuchas

La pieza que hace que el contador de la Tarea 1 signifique algo en pantalla.

**Files:**
- Create: `lib/acciones-escuchas.ts`
- Create: `components/ejercicios/reproductor.tsx`
- Modify: `components/ejercicios/opcion.tsx`
- Modify: `components/ejercicios/relacionar.tsx`
- Modify: `app/(app)/pasos/[pasoId]/page.tsx`

**Interfaces:**
- Consumes: `apuntarEscucha`, `escuchasDe` de `@/lib/escuchas`.
- Produces:
  - Desde `@/lib/acciones-escuchas`: `async function pedirEscucha(pasoId: string, clave: string, maximo: number): Promise<{ quedan: number } | { error: string }>`
  - Desde `@/components/ejercicios/reproductor`: `export default function Reproductor({ src, pasoId, clave, maximo, cerrado }: {...})`

- [ ] **Step 1: La acción**

Crea `lib/acciones-escuchas.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { apuntarEscucha } from "@/lib/escuchas";

/**
 * Apunta una escucha y dice cuántas quedan.
 *
 * La decisión —si queda alguna— vive en `lib/escuchas.ts` y no aquí, para
 * que el script de verificación pueda ejercitarla. Esto solo comprueba la
 * sesión, encuentra la asignación y llama.
 */
export async function pedirEscucha(
  pasoId: string,
  clave: string,
  maximo: number,
): Promise<{ quedan: number } | { error: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "No hay sesión." };

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

  const quedan = await apuntarEscucha(asignacion.id, pasoId, clave, maximo);
  if (quedan === null) return { error: "Ya has oído este audio todas las veces." };

  return { quedan };
}
```

- [ ] **Step 2: El reproductor**

Crea `components/ejercicios/reproductor.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { pedirEscucha } from "@/lib/acciones-escuchas";

/**
 * Un audio que solo suena las veces que deja el examen.
 *
 * Se cuenta al dar al play y no al terminar: es lo que hace el examen, donde
 * el audio suena una vez y no se rebobina. Y como `/api/archivos/[id]` sirve
 * con caché permanente, una vez empieza a sonar el archivo ya está en el
 * navegador: que se caiga la conexión a mitad no corta la reproducción.
 *
 * El contador vive en el servidor porque uno en el navegador se devuelve
 * recargando la página, y entonces no cuenta nada. `quedan` empieza en null
 * —no lo sabemos hasta preguntar— y por eso el botón no dice un número hasta
 * la primera escucha.
 */
export default function Reproductor({
  src,
  pasoId,
  clave,
  maximo,
  cerrado,
}: {
  src: string;
  pasoId: string;
  clave: string;
  maximo: number;
  /** El ejercicio ya está respondido: no tiene sentido seguir contando. */
  cerrado: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [quedan, setQuedan] = useState<number | null>(null);
  const [agotado, setAgotado] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  // Ya respondido: se puede volver a oír sin contar, que es lo que hace
  // falta para repasar la corrección.
  if (cerrado) {
    return (
      <audio controls preload="none" src={src} className="w-full max-w-sm">
        Tu navegador no puede reproducir este audio.
      </audio>
    );
  }

  async function sonar() {
    if (pidiendo || agotado) return;
    setPidiendo(true);
    const r = await pedirEscucha(pasoId, clave, maximo);
    setPidiendo(false);

    if ("error" in r) {
      setAgotado(true);
      return;
    }
    setQuedan(r.quedan);
    await audio.current?.play();
  }

  return (
    <div className="space-y-1">
      <audio ref={audio} preload="none" src={src} className="hidden">
        Tu navegador no puede reproducir este audio.
      </audio>

      <button
        type="button"
        onClick={sonar}
        disabled={pidiendo || agotado}
        className="h-9 rounded-full bg-hp-400 px-5 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {agotado ? "Sin escuchas" : pidiendo ? "…" : "Escuchar"}
      </button>

      <p className="text-xs text-tinta-suave">
        {agotado
          ? "Ya lo has oído todas las veces."
          : quedan === null
            ? `Puedes oírlo ${maximo} ${maximo === 1 ? "vez" : "veces"}.`
            : quedan === 0
              ? "Era la última."
              : `Te queda ${quedan} ${quedan === 1 ? "escucha" : "escuchas"}.`}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Pasar el `pasoId` a las caras**

Las caras no lo reciben hoy. En `components/ejercicios/ejercicio.tsx`, añade `pasoId` a `PropsCara`:

```tsx
export type PropsCara = {
  publica: unknown;
  valor: Respuestas;
  alCambiar: (nuevo: Respuestas) => void;
  correccion: Correccion | null;
  cerrado: boolean;
  /**
   * El paso al que pertenece este ejercicio. Lo necesitan los audios para
   * contar escuchas; el resto de las caras lo ignoran. Vacío en la
   * previsualización del profesor, donde no se cuenta nada.
   */
  pasoId: string;
};
```

Y en el objeto `props` que construye:

```tsx
      pasoId,
```

En `components/recursos/previsualizacion.tsx`, añade `pasoId: ""` al objeto `props`. Con la cadena vacía, el reproductor no cuenta: ver el paso siguiente.

- [ ] **Step 4: Usar el reproductor en las dos caras**

En `components/ejercicios/opcion.tsx`, sustituye el `<audio>` de cada pregunta:

```tsx
            {pregunta.audio && (
              <div className="mt-3">
                <Reproductor
                  src={pregunta.audio}
                  pasoId={pasoId}
                  clave={pregunta.id}
                  maximo={datos.escuchas}
                  cerrado={cerrado || pasoId === ""}
                />
              </div>
            )}
```

En `components/ejercicios/relacionar.tsx`, lo mismo para el de cada izquierda:

```tsx
                  {izq.audio && (
                    <Reproductor
                      src={izq.audio}
                      pasoId={pasoId}
                      clave={izq.id}
                      maximo={datos.escuchas}
                      cerrado={cerrado || pasoId === ""}
                    />
                  )}
```

**`cerrado || pasoId === ""` es lo que hace que la previsualización del profesor no cuente nada**: sin paso al que apuntar, el reproductor cae en su rama de audio corriente y el profesor puede oírlo las veces que quiera mientras monta el ejercicio.

- [ ] **Step 5: Pasar el `pasoId` desde la página**

En `app/(app)/pasos/[pasoId]/page.tsx`, el componente `<Ejercicio>` ya recibe `pasoId`. Comprueba que lo sigue pasando y que llega hasta las caras.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-dele.ts && npx tsx scripts/verificar-recursos.ts`
Expected: todo limpio y en verde.

- [ ] **Step 7: Commit**

```bash
git add lib/acciones-escuchas.ts components/ejercicios components/recursos/previsualizacion.tsx
git commit -m "Un reproductor que cuenta las escuchas donde no se pueden devolver"
```

---

### Task 7: La prueba al crear la secuencia

**Files:**
- Modify: `lib/acciones.ts` (`crearSecuencia`)
- Modify: `app/(app)/profe/secuencias/nueva/page.tsx`
- Create: `app/(app)/profe/secuencias/nueva/eleccion-dele.tsx`

**Interfaces:**
- Consumes: `pruebasDe` de `@/lib/dele`.

- [ ] **Step 1: Guardar la destreza**

En `lib/acciones.ts`, dentro de `crearSecuencia`, después de leer `tipo`:

```ts
  // La prueba del DELE, si la secuencia es de preparación. Se guarda en el
  // recorrido y no solo en sus pasos porque una prueba recién creada aún no
  // tiene ninguno, y al volver a abrirla hay que saber de cuál es.
  const destrezaBruta = String(formData.get("destreza") ?? "");
  const destreza =
    tipo === "PREPARACION_DELE" && destrezaBruta
      ? (destrezaBruta as Destreza)
      : null;
```

Y en el `data` del `create`, junto a `nivel`:

```ts
      destreza,
```

Comprueba que `Destreza` está importado en ese archivo; si no, añádelo al import que ya trae los enums.

- [ ] **Step 2: El selector de prueba**

Crea `app/(app)/profe/secuencias/nueva/eleccion-dele.tsx`. Es de cliente porque la lista de pruebas depende del nivel y del servicio elegidos, que cambian sin recargar:

```tsx
"use client";

import { useState } from "react";
import { pruebasDe } from "@/lib/dele";
import type { Nivel } from "@/lib/generated/prisma/enums";

const NIVELES: Nivel[] = ["A1", "A2", "B1", "B2", "C1", "A2_B1_ESCOLAR"];

const nombreNivel = (n: string) => (n === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : n);

const NOMBRE_PRUEBA: Record<string, string> = {
  CE: "Comprensión de lectura",
  CO: "Comprensión auditiva",
};

const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

/**
 * El servicio, el nivel y —si es preparación— la prueba, más el título que
 * se propone a partir de los tres.
 *
 * El título se propone y no se impone: en cuanto el profesor lo toca, deja
 * de reescribirse. El mapa aconseja, no manda.
 */
export default function EleccionDele({ tituloInicial }: { tituloInicial: string }) {
  const [tipo, setTipo] = useState("CLASES_PARTICULARES");
  const [nivel, setNivel] = useState<Nivel | "">("");
  const [destreza, setDestreza] = useState("");
  const [titulo, setTitulo] = useState(tituloInicial);
  const [tituloTocado, setTituloTocado] = useState(false);

  const pruebas = nivel ? pruebasDe(nivel) : [];

  function proponerTitulo(n: string, d: string) {
    if (tituloTocado) return;
    if (n && d) setTitulo(`${nombreNivel(n)} · ${NOMBRE_PRUEBA[d] ?? d}`);
  }

  return (
    <>
      <label className="block text-sm font-semibold text-tinta">
        Título
        <input
          type="text"
          name="titulo"
          required
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setTituloTocado(true);
          }}
          placeholder="El barrio: describir dónde vivo"
          className={campo}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex-1 text-sm font-semibold text-tinta">
          Servicio
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={campo}
          >
            <option value="CLASES_PARTICULARES">Clases particulares</option>
            <option value="PREPARACION_DELE">Preparación DELE</option>
          </select>
        </label>

        <label className="flex-1 text-sm font-semibold text-tinta">
          Nivel
          <select
            name="nivel"
            required
            value={nivel}
            onChange={(e) => {
              const n = e.target.value as Nivel;
              setNivel(n);
              proponerTitulo(n, destreza);
            }}
            className={campo}
          >
            <option value="" disabled>
              Elige
            </option>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {nombreNivel(n)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tipo === "PREPARACION_DELE" && (
        <label className="mt-4 block text-sm font-semibold text-tinta">
          Prueba
          <select
            name="destreza"
            value={destreza}
            onChange={(e) => {
              setDestreza(e.target.value);
              proponerTitulo(nivel, e.target.value);
            }}
            className={campo}
          >
            <option value="">Ninguna en concreto</option>
            {pruebas.map((p) => (
              <option key={p.prueba} value={p.prueba}>
                {NOMBRE_PRUEBA[p.prueba] ?? p.prueba} · {p.tareas.length} tareas ·{" "}
                {p.duracionMinutos} min
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            {nivel === ""
              ? "Elige antes el nivel."
              : pruebas.length === 0
                ? "Este nivel todavía no tiene pruebas en el mapa."
                : "Elegir una hace que la ficha te proponga sus tareas. Puedes dejarlo sin elegir."}
          </span>
        </label>
      )}
    </>
  );
}
```

- [ ] **Step 3: Enchufarlo en la página**

En `app/(app)/profe/secuencias/nueva/page.tsx`, sustituye los campos de título, servicio y nivel por el componente, dejando el resto del formulario como está:

```tsx
import EleccionDele from "./eleccion-dele";
```

```tsx
        <EleccionDele tituloInicial="" />
```

Borra las etiquetas de título, servicio y nivel que había, y **comprueba que la constante `campo` y el import de `servicioLabel` siguen usándose**; si alguno se queda sin usar, quítalo, porque `npm run lint` tiene que quedar sin avisos.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

- [ ] **Step 5: Probarlo a mano**

Run: `npm run dev` (en segundo plano)

Crea una secuencia de preparación de B1: al elegir la prueba, el título tiene que rellenarse solo con «B1 · Comprensión de lectura». Cámbialo a mano y comprueba que ya no se reescribe al cambiar de prueba. Crea otra de clases particulares y comprueba que el desplegable de prueba no aparece.

Si no puedes entrar, dilo en el informe.

- [ ] **Step 6: Commit**

```bash
git add lib/acciones.ts "app/(app)/profe/secuencias/nueva"
git commit -m "Elegir la prueba al crear una secuencia de preparación"
```

---

### Task 8: Las tareas que le faltan a la prueba

**Files:**
- Create: `app/(app)/recorridos/[id]/tareas-sugeridas.tsx`
- Modify: `app/(app)/recorridos/[id]/page.tsx`

**Interfaces:**
- Consumes: `pruebaDe` de `@/lib/dele`; `crearPaso` de `@/lib/acciones`.

- [ ] **Step 1: El componente**

Crea `app/(app)/recorridos/[id]/tareas-sugeridas.tsx`:

```tsx
import { crearPaso } from "@/lib/acciones";
import { pruebaDe, type TareaDele } from "@/lib/dele";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";

/**
 * Las tareas que le faltan a esta prueba, con un botón que crea el paso ya
 * nombrado.
 *
 * Sugiere y no obliga: el «añadir paso» libre sigue al lado, y nada impide
 * saltarse una tarea, repetirla ni cambiarles el orden.
 */
export default function TareasSugeridas({
  recorridoId,
  nivel,
  destreza,
  ordenesOcupados,
}: {
  recorridoId: string;
  nivel: Nivel;
  destreza: Destreza;
  /** Los `orden` de los pasos que ya existen: esas tareas ya están puestas. */
  ordenesOcupados: number[];
}) {
  const prueba = pruebaDe(nivel, destreza);
  if (!prueba) return null;

  const ocupados = new Set(ordenesOcupados);
  const faltan = prueba.tareas.filter((t) => !ocupados.has(t.numero));
  if (faltan.length === 0) return null;

  return (
    <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
        Tareas de esta prueba
      </p>
      <p className="mt-1 text-sm text-tinta-suave">
        {prueba.duracionMinutos} minutos · {prueba.tareas.length} tareas. Faltan{" "}
        {faltan.length}.
      </p>

      <ul className="mt-4 space-y-2">
        {faltan.map((tarea) => (
          <li key={tarea.numero}>
            <form action={crearPaso} className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 px-4 py-3">
              <input type="hidden" name="recorridoId" value={recorridoId} />
              <input type="hidden" name="titulo" value={`Tarea ${tarea.numero}`} />
              <input type="hidden" name="tipo" value="ACTIVIDAD" />
              <input type="hidden" name="ciclo" value="1" />
              <input type="hidden" name="destreza" value={destreza} />

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-tinta">
                  Tarea {tarea.numero}
                  {!tarea.verificado && (
                    <span className="ml-2 rounded-full bg-sol-100 px-2 py-0.5 text-xs font-bold text-tinta">
                      sin confirmar
                    </span>
                  )}
                </p>
                <p className="text-sm text-tinta-suave">{tarea.pide}</p>
              </div>

              <button
                type="submit"
                className="h-9 shrink-0 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400"
              >
                Añadir
              </button>
            </form>
          </li>
        ))}
      </ul>

      {faltan.some((t: TareaDele) => !t.verificado) && (
        <p className="mt-4 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Las tareas marcadas «sin confirmar» están deducidas, no verificadas
          contra las especificaciones oficiales. Puedes usarlas igual; si
          compruebas alguna, corrígela en <code>lib/dele/mapa.ts</code> y el
          aviso desaparece.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Enchufarlo**

En `app/(app)/recorridos/[id]/page.tsx`:

Añade el import y, donde ya se consulta el recorrido, comprueba que el `select` trae `destreza` y `nivel`; si no, añádelos.

```tsx
import TareasSugeridas from "./tareas-sugeridas";
```

Y en el JSX, **justo antes** del formulario de `crearPaso` que ya existe:

```tsx
      {recorrido.tipo === "PREPARACION_DELE" && recorrido.destreza && (
        <TareasSugeridas
          recorridoId={recorrido.id}
          nivel={recorrido.nivel}
          destreza={recorrido.destreza}
          ordenesOcupados={recorrido.pasos.map((p) => p.orden)}
        />
      )}
```

**No quites ni escondas el formulario de «añadir paso»**: es la salida del mapa.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

- [ ] **Step 4: Probarlo a mano**

Run: `npm run dev` (en segundo plano)

Abre la secuencia de preparación que creaste en la Tarea 7. Deben salir sus cinco tareas con su descripción. Pulsa «Añadir» en la tarea 1: se crea el paso y esa tarea desaparece de la lista. Comprueba que el «añadir paso» de siempre sigue estando.

Crea una secuencia de preparación de A1 y comprueba que sale el aviso de «sin confirmar».

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/recorridos/[id]"
git commit -m "Proponer las tareas que le faltan a la prueba, sin quitar el paso libre"
```

---

### Task 9: El paso guiado

El último eslabón: que abrir la tarea 1 de B1 lleve al formato que esa tarea admite.

**Files:**
- Modify: `app/(app)/pasos/[pasoId]/page.tsx`
- Modify: `app/(app)/pasos/[pasoId]/selector-ejercicio.tsx`
- Modify: `app/(app)/profe/recursos/nuevo/page.tsx`

**Interfaces:**
- Consumes: `tareaDe`, `sobrantesDe` de `@/lib/dele`.

- [ ] **Step 1: Averiguar la tarea en la página del paso**

En `app/(app)/pasos/[pasoId]/page.tsx`, después de cargar el paso y antes de los candidatos:

```tsx
import { tareaDe } from "@/lib/dele";
```

```tsx
  // Si este paso es una tarea del mapa, el selector se acota a su formato.
  // El número de tarea es el orden del paso: un paso más allá de la última
  // tarea oficial devuelve null y todo se comporta como si no hubiera mapa.
  const tarea =
    paso.recorrido.tipo === "PREPARACION_DELE" && paso.recorrido.destreza
      ? tareaDe(paso.recorrido.nivel, paso.recorrido.destreza, paso.orden)
      : null;
```

Comprueba que el `select` del paso trae `recorrido: { select: { nivel, tipo, destreza } }` y `orden`; añade lo que falte.

- [ ] **Step 2: Filtrar los candidatos por el tipo del motor**

Sustituye el `where` de la consulta de candidatos para que, si hay tarea y no se ha pedido ver todos, se acote también por el tipo:

```tsx
  // El `tipo` de la base que le toca al motor de esta tarea. La tabla vive
  // en lib/recursos.ts para que solo haya un sitio donde puedan discrepar.
  const tipoDeLaTarea = tarea ? TIPO_DE_EJERCICIO[tarea.motor] : null;
  const verTodos = todosLosNiveles || parametros.formato === "todos";

  const candidatos: Candidato[] = esProfe
    ? await prisma.ejercicio.findMany({
        where: {
          publicado: true,
          tipo: { not: "WIDGET" },
          ...(todosLosNiveles ? {} : { nivel: paso.recorrido.nivel }),
          ...(tipoDeLaTarea && !verTodos ? { tipo: tipoDeLaTarea } : {}),
        },
        orderBy: { titulo: "asc" },
        select: { id: true, titulo: true, tipo: true, nivel: true },
      })
    : [];
```

Añade `import { TIPO_DE_EJERCICIO } from "@/lib/recursos";`. Es un `Record<MarcaEjercicio, TipoEjercicio>` con las cuatro entradas (`opcion → OPCION_MULTIPLE`, `huecos → HUECOS`, `relacionar → RELACIONAR`, `ordenar → ORDENAR`), así que `TIPO_DE_EJERCICIO[tarea.motor]` siempre acierta.

`parametros` es el `await searchParams` que esta página ya hace más arriba para leer `todos`. **No lo vuelvas a `await`**: si el que hay está en línea, sácalo antes a una constante —`const parametros = await searchParams;`— y usa esa en los dos sitios. Y añade `formato?: string` al tipo de `searchParams` de la página.

- [ ] **Step 3: Pasar la tarea al selector**

```tsx
        <SelectorEjercicio
          pasoId={paso.id}
          actual={ejercicioActual}
          candidatos={candidatos}
          nivel={paso.recorrido.nivel}
          todosLosNiveles={todosLosNiveles}
          tarea={
            tarea
              ? {
                  numero: tarea.numero,
                  pide: tarea.pide,
                  verificado: tarea.verificado,
                  filtrado: !verTodos,
                }
              : null
          }
        />
```

- [ ] **Step 4: Enseñar la tarea y su salida en el selector**

En `app/(app)/pasos/[pasoId]/selector-ejercicio.tsx`, añade la prop y, encima del desplegable, la ficha de la tarea con su enlace de salida:

```tsx
  tarea,
}: {
  …
  tarea: {
    numero: number;
    pide: string;
    verificado: boolean;
    /** Si la lista viene acotada al formato de la tarea. */
    filtrado: boolean;
  } | null;
```

```tsx
      {tarea && (
        <div className="mt-3 rounded-xl border border-hp-100 bg-fondo px-4 py-3">
          <p className="text-sm font-bold text-tinta">
            Tarea {tarea.numero}
            {!tarea.verificado && (
              <span className="ml-2 rounded-full bg-sol-100 px-2 py-0.5 text-xs font-bold">
                sin confirmar
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-tinta-suave">{tarea.pide}</p>
          {tarea.filtrado && (
            <p className="mt-2 text-xs text-tinta-suave">
              Se ofrecen solo los del formato de esta tarea.{" "}
              <Link
                href={`/pasos/${pasoId}?formato=todos`}
                className="font-semibold underline hover:text-hp-500"
              >
                Ver todos los formatos
              </Link>
              .
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 5: Arrancar el editor con la estructura de la tarea**

En `app/(app)/profe/recursos/nuevo/page.tsx`, acepta los tres parámetros que identifican la tarea y usa el mapa para elegir el tipo y montar la estructura:

```tsx
import { sobrantesDe, tareaDe, type TareaDele } from "@/lib/dele";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
```

```tsx
  const { tipo, nivel: nivelBruto, prueba, tarea: tareaBruta } = await searchParams;

  // Si vienen los tres, el editor arranca por la tarea del mapa en vez de
  // por el tipo a secas.
  const numero = Number(tareaBruta);
  const tareaDele =
    nivelBruto && prueba && Number.isInteger(numero)
      ? tareaDe(nivelBruto as Nivel, prueba as Destreza, numero)
      : null;
```

Y cuando haya `tareaDele`, en vez de `VACIO[marca]` se le pasa al editor una estructura montada. Escribe la función que la monta **en el mismo archivo**, porque solo la usa él:

```tsx
/**
 * El punto de partida de un ejercicio para esta tarea: tantos ítems y tantas
 * opciones como dice el mapa, y los sobrantes ya separados.
 *
 * Los ids van `p1…pN` y `r1…rN` porque es lo que esperan los editores, que
 * calculan el siguiente por el máximo de los sufijos existentes.
 */
function estructuraDe(tarea: TareaDele): unknown {
  const sobrantes = sobrantesDe(tarea);

  if (tarea.motor === "relacionar") {
    return {
      ejercicio: "relacionar",
      consigna: "",
      ...(tarea.formato === "GAP_INSERT" ? { texto: "" } : {}),
      parejas: Array.from({ length: tarea.items }, (_, i) => ({
        id: `r${i + 1}`,
        izquierda: tarea.formato === "GAP_INSERT" ? `Hueco ${i + 1}` : "",
        derecha: "",
      })),
      sobrantes: Array.from({ length: sobrantes }, () => ""),
      escuchas: 2,
    };
  }

  // `opcion`, con lista común o sin ella según lo que diga el mapa.
  return {
    ejercicio: "opcion",
    consigna: "",
    multiple: false,
    presentacion: tarea.listaComun && tarea.opciones > 4 ? "desplegable" : "botones",
    ...(tarea.listaComun
      ? { opcionesComunes: Array.from({ length: tarea.opciones }, () => "") }
      : {}),
    escuchas: 2,
    preguntas: Array.from({ length: tarea.items }, (_, i) => ({
      id: `p${i + 1}`,
      enunciado: "",
      ...(tarea.listaComun
        ? {}
        : { opciones: Array.from({ length: tarea.opciones }, () => "") }),
      correctas: [],
    })),
  };
}
```

`Editor` hoy recibe `{ inicial, marca, bloqueado }` y arranca sus datos con `inicial?.datos ?? VACIO[marca]`. Le añades **una prop opcional**, para no tocar las dos páginas que ya lo usan:

```tsx
export default function Editor({
  inicial,
  marca,
  bloqueado,
  partida,
}: {
  inicial: FilaEjercicio | null;
  marca: MarcaEjercicio;
  /** El motivo por el que no se puede editar, si lo hay. */
  bloqueado: string | null;
  /**
   * Punto de partida para un ejercicio nuevo, cuando se crea desde una
   * tarea del DELE: la estructura ya montada y lo que el mapa sabe del
   * nivel. Se ignora al editar uno que ya existe.
   */
  partida?: { datos: unknown; nivel?: string; titulo?: string };
}) {
```

Y las tres líneas de estado inicial pasan a mirarla:

```tsx
  const [titulo, setTitulo] = useState(inicial?.titulo ?? partida?.titulo ?? "");
  const [nivel, setNivel] = useState(inicial?.nivel ?? partida?.nivel ?? "B1");
  const [datos, setDatos] = useState<unknown>(
    inicial?.datos ?? partida?.datos ?? VACIO[marca],
  );
```

Desde la página, cuando haya `tareaDele`:

```tsx
        <Editor
          inicial={null}
          marca={tareaDele.motor}
          bloqueado={null}
          partida={{
            datos: estructuraDe(tareaDele),
            nivel: nivelBruto,
            titulo: `Tarea ${tareaDele.numero}`,
          }}
        />
```

**Que el nivel venga puesto no es un detalle:** el editor arranca en B1 por omisión, y un ejercicio creado para una prueba de A1 que se quedara en B1 no aparecería después en el selector de su propio paso, que se acota al nivel del recorrido. Es exactamente el fallo que la revisión de Recursos encontró en su día.

Enseña también arriba qué tarea es, con su `pide` y su aviso de «sin confirmar» si lo lleva:

```tsx
      {tareaDele && (
        <div className="mt-4 rounded-tarjeta border border-hp-100 bg-fondo p-4">
          <p className="text-sm font-bold text-tinta">
            Tarea {tareaDele.numero}
            {!tareaDele.verificado && (
              <span className="ml-2 rounded-full bg-sol-100 px-2 py-0.5 text-xs font-bold">
                sin confirmar
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-tinta-suave">{tareaDele.pide}</p>
        </div>
      )}
```

- [ ] **Step 6: Llevar la tarea desde el selector al editor**

En `selector-ejercicio.tsx`, el enlace de «Crear uno» lleva los tres parámetros cuando hay tarea. Añade a las props del componente `nivel` (ya está) y `prueba`, y compón:

```tsx
        href={
          tarea && prueba
            ? `/profe/recursos/nuevo?nivel=${nivel}&prueba=${prueba}&tarea=${tarea.numero}`
            : "/profe/recursos/nuevo"
        }
```

Pásale `prueba={paso.recorrido.destreza}` desde la página.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-dele.ts && npx tsx scripts/verificar-recursos.ts`
Expected: todo limpio y en verde.

- [ ] **Step 8: La vuelta completa a mano**

Run: `npm run dev` (en segundo plano)

1. Crea la secuencia «B1 · Comprensión de lectura».
2. Añade la Tarea 1 desde las sugeridas.
3. Ábrela: debe salir la ficha de la tarea y el selector filtrado, con «Ver todos los formatos» al lado.
4. Pulsa «Crear uno»: el editor debe abrirse en `relacionar` con **seis parejas y tres sobrantes** ya puestos.
5. Rellénalo, publícalo, engánchalo.
6. Haz lo mismo con la Tarea 4 (insertar fragmentos): el editor debe traer el pasaje y las izquierdas ya dichas «Hueco 1»… «Hueco 6».
7. Con la cuenta de estudiante, responde los dos y comprueba que la corrección coincide con la previsualización.
8. Crea una tarea auditiva, súbele un audio, y con la cuenta de estudiante óyelo dos veces, comprueba que a la tercera no suena, **recarga la página** y comprueba que sigue sin sonar.

Si no puedes entrar, dilo en el informe y ejercita en su lugar `pedirEscucha` con un script suelto contra filas reales, borrándolo después.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/pasos/[pasoId]" "app/(app)/profe/recursos/nuevo"
git commit -m "El paso guiado: el formato de la tarea y el editor ya montado"
```

---

## Lo que queda anotado al cerrar

Para el diseño C y para el que venga después:

- **Soltar los fragmentos dentro del texto.** Aquí queda la versión de dos columnas. La fiel es una cara de cliente nueva.
- **El cronómetro.** El mapa guarda la duración de cada prueba y la enseña; nadie cuenta el tiempo.
- **El simulacro completo** y la calificación por grupos. Necesita las pruebas de expresión.
- **La transcripción oculta del audio**, que el encargo mencionaba y no se ha diseñado.
- **Generar un borrador con IA.** La aplicación no habla con ninguna IA.
