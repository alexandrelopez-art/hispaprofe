# Evaluación oral · Tanda 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir `evaluacion_oral.html` por una pantalla de HispaProfe donde se convoca un examen oral, se monta el horario, se crean los sujets y se evalúa en directo con cronómetros, criterios y comentarios, con salida a CSV y ficha imprimible.

**Architecture:** Cinco modelos nuevos que apuntan a `User`, `Grupo` y `Archivo` sin duplicarlos. Todo lo verificable —los criterios, el formato y las reglas— vive en `lib/orales/*` **fuera de las acciones**, porque una acción de servidor necesita sesión de Clerk y no se puede llamar desde un script `tsx`. Las pantallas son componentes de servidor; solo el panel de evaluación es cliente, porque lleva cronómetros y autoguardado.

**Tech Stack:** Next.js (esta versión, no la de tu memoria), React Server Components, Prisma sobre PostgreSQL, Tailwind v4 con tokens en `app/globals.css`, Clerk para la sesión, `tsx` para los scripts de verificación.

**Spec:** `docs/superpowers/specs/2026-07-30-evaluacion-oral-design.md`

## Global Constraints

- **Esta no es la versión de Next.js que conoces.** Antes de escribir código de rutas, `params`, acciones o caché, lee la guía que toque en `node_modules/next/dist/docs/`. Lo dice `AGENTS.md` y es obligatorio.
- Prisma se importa siempre como `import { prisma } from "@/lib/prisma"`. Los tipos vienen de `@/lib/generated/prisma/client` y los enums de `@/lib/generated/prisma/enums`.
- **Las reglas y el formato van fuera de las acciones**, en `lib/orales/`. Las acciones solo llaman, comprueban permiso y refrescan.
- Cada acción de servidor empieza por `exigirProfesor()` de `@/lib/profesor`.
- **Tras cualquier migración hay que reiniciar el `next dev`** con `npm run fresh`: `lib/prisma.ts` fija el cliente en `globalThis` y el proceso viejo se queda con el esquema antiguo.
- No hay framework de pruebas y esta tanda no introduce ninguno. Se verifica con `npx tsc --noEmit`, `npm run lint` y `npx tsx scripts/verificar-orales.ts`.
- El script de verificación **limpia lo que crea desde un `.finally()`** y usa `process.exitCode = 1`, nunca `process.exit`. Copia la forma de `scripts/verificar-recursos.ts`.
- Todo el código, los comentarios y los mensajes de error en castellano.
- Los cinco criterios y sus máximos (4, 2, 5, 5, 4 = 20) son del liceo francés y van en una constante, no en la base.
- **La rama tiene actividad concurrente.** Haz `git pull --rebase` o comprueba `git log` antes de empezar cada tarea.

## Fuera de esta tanda

Escrito aquí para que nadie lo implemente de más:

- El viaje del `.json` (exportar, importar, validar con zod), la subida del audio y el editor de transcripción. **Tanda 2.**
- El informe colgado de la ficha del alumno. **Tanda 2.**
- `TipoEjercicio.TAREA_ORAL` y su editor en Recursos. **Plan aparte**, porque toca el motor de ejercicios, que otra sesión está implementando. En esta tanda `Sujeto.recursoId` **existe en el esquema pero siempre vale `null`**: la columna se crea ahora para que la migración de tanda 3 no tenga que tocar la tabla, y la regla que la vigila ya se escribe y se verifica.

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `prisma/schema.prisma` | **Modificar.** Cinco modelos nuevos y dos relaciones inversas. | 1 |
| `scripts/verificar-orales.ts` | **Crear.** Ejercita el formato y las reglas contra filas reales. Crece en cada tarea. | 1–9 |
| `lib/orales/criterios.ts` | **Crear.** Los cinco criterios, sus máximos, su paso, su color y sus frases. Constante pura. | 2 |
| `lib/orales/formato.ts` | **Crear.** `fmtTiempo`, `fmtNota`, `fmtTotal`, `calcularTotal`, `pasoDe`, `estadoDe`. Puras. | 2 |
| `lib/orales/reglas.ts` | **Crear.** Las cuatro reglas de esta tanda. Fuera de las acciones. | 3 |
| `lib/orales/csv.ts` | **Crear.** Las veintidós columnas, con BOM y comillas. Pura. | 9 |
| `lib/acciones-orales.ts` | **Crear.** Las acciones de servidor. Sigue a `lib/acciones-clases.ts`. | 4 |
| `app/(app)/profe/orales/page.tsx` | **Crear.** Lista de convocatorias y formulario de creación. | 5 |
| `app/(app)/profe/orales/[id]/page.tsx` | **Crear.** Horario a la izquierda, panel a la derecha. | 6, 8 |
| `app/(app)/profe/orales/[id]/sujets/page.tsx` | **Crear.** Alta y listado de sujets. | 7 |
| `app/(app)/profe/orales/evaluacion/[id]/ficha/page.tsx` | **Crear.** El A4 de una página. | 10 |
| `components/orales/horario.tsx` | **Crear.** La columna izquierda con días, pausas y semáforo. | 6 |
| `components/orales/panel.tsx` | **Crear.** Cliente: estado de la evaluación y autoguardado. | 8 |
| `components/orales/cronometro.tsx` | **Crear.** Un cronómetro, tope 300 s. | 8 |
| `components/orales/tarjeta-criterio.tsx` | **Crear.** Nota con `+`/`−`, comentario y frases. | 8 |
| `components/orales/parrilla-sujets.tsx` | **Crear.** Viñetas, ficha del elegido y preguntas de la EOI. | 7, 8 |
| `components/orales/subir-documento.tsx` | **Crear.** Puente entre `SubirImagen` (cliente, callback) y el formulario de alta. | 7 |
| `app/(app)/profe/orales/[id]/csv/route.ts` | **Crear.** La descarga del CSV. | 9 |

---

### Task 1: El esquema y su migración

**Files:**
- Modify: `prisma/schema.prisma` (añadir al final; y las relaciones inversas en `User`, líneas 93-105, y en `Grupo`, líneas 152-172)
- Create: `scripts/verificar-orales.ts`

**Interfaces:**
- Consumes: nada.
- Produces: los modelos `Convocatoria`, `Sujeto`, `Turno`, `EvaluacionOral`, `TranscripcionOral` en el cliente de Prisma, y el esqueleto de `scripts/verificar-orales.ts` con `afirmar`, `marca` y el `.finally()` de limpieza que las tareas siguientes amplían.

- [ ] **Step 1: Escribir el script que falla**

Crea `scripts/verificar-orales.ts`:

```ts
/**
 * Verifica el formato y las reglas de la evaluación oral. Crea sus propios
 * datos y los borra al terminar, incluso si una afirmación revienta a mitad
 * de camino.
 * Ejecutar con:  npx tsx scripts/verificar-orales.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-orales-${process.pid}`;

// Los ids de todo lo creado, para poder limpiarlo desde el `.finally()`
// aunque una afirmación reviente a mitad. Se rellenan en cuanto cada
// `create` responde, no al final de `main`.
let profesorId: string | undefined;
let estudianteId: string | undefined;
let grupoId: string | undefined;
let convocatoriaId: string | undefined;

async function main() {
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  profesorId = profesor.id;

  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, firstName: "Rose", lastName: "HERMITE" },
  });
  estudianteId = estudiante.id;

  const grupo = await prisma.grupo.create({
    data: { nombre: `Terminale ${marca}`, profesorId: profesor.id },
  });
  grupoId = grupo.id;

  // ── El ida y vuelta completo: convocatoria → sujeto → turno → evaluación.
  const convocatoria = await prisma.convocatoria.create({
    data: { nombre: `Oral ${marca}`, profesorId: profesor.id },
  });
  convocatoriaId = convocatoria.id;

  const sujeto = await prisma.sujeto.create({
    data: {
      convocatoriaId: convocatoria.id,
      numero: 7,
      eje: "Arte y poder",
      titulo: "Mafalda: la niña que desafía a los adultos",
      descripcion: "Viñeta de Quino.",
      fuente: "BBC Mundo",
      url: "https://www.bbc.com/mundo",
      preguntas: ["¿Qué ves?", "¿Por qué incomoda?"],
    },
  });

  const turno = await prisma.turno.create({
    data: {
      convocatoriaId: convocatoria.id,
      grupoId: grupo.id,
      estudianteId: estudiante.id,
      dia: "Mercredi 20/05",
      preparacion: "08h00",
      hora: "08h15",
      sala: "CDI",
      orden: 1,
    },
  });

  const evaluacion = await prisma.evaluacionOral.create({
    data: {
      turnoId: turno.id,
      sujetoId: sujeto.id,
      segundosEoc: 287.5,
      notas: { lengua: 3, fluidez: 1.5, contenido: 4, organizacion: 3.5, oratoria: 3 },
      comentarios: { general: "Bien." },
      frases: { lengua: ["Léxico variado y preciso"] },
      preguntadas: [0, 3],
    },
  });

  afirmar(evaluacion.preguntadas.length === 2, "las preguntas hechas se guardan como lista de enteros");
  afirmar(evaluacion.segundosEoc === 287.5, "los segundos admiten decimales");
  afirmar(sujeto.preguntas.length === 2, "el sujet guarda sus preguntas de la EOI");
  afirmar(sujeto.recursoId === null, "un sujet con imagen no apunta a ningún recurso");

  // Una pausa es un turno sin estudiante.
  const pausa = await prisma.turno.create({
    data: { convocatoriaId: convocatoria.id, grupoId: grupo.id, dia: "Mercredi 20/05", hora: "—", orden: 2 },
  });
  afirmar(pausa.estudianteId === null, "una pausa es un turno sin estudiante");

  // Borrar la convocatoria se lleva sujets, turnos y evaluaciones por cascada.
  await prisma.convocatoria.delete({ where: { id: convocatoria.id } });
  convocatoriaId = undefined;
  const quedan = await prisma.turno.count({ where: { id: turno.id } });
  afirmar(quedan === 0, "borrar la convocatoria se lleva sus turnos por cascada");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` aquí mataría el proceso antes del `finally` y la
    // limpieza no correría. En TDD el paso RED falla a propósito, así que
    // eso dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    // El orden importa: los vínculos antes que sus extremos.
    if (convocatoriaId) {
      await prisma.convocatoria.deleteMany({ where: { id: convocatoriaId } });
    }
    if (grupoId) await prisma.grupo.deleteMany({ where: { id: grupoId } });
    const userIds = [estudianteId, profesorId].filter(
      (id): id is string => id !== undefined,
    );
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: FALLA. `prisma.convocatoria` no existe: `TypeError: Cannot read properties of undefined (reading 'create')`.

- [ ] **Step 3: Añadir los cinco modelos al esquema**

Al final de `prisma/schema.prisma`:

```prisma
/// Un examen con nombre y fecha: «Oral de Terminale, SJDP, mayo 2026».
/// Es lo que hace el examen repetible: en octubre se convoca otro sin
/// pisar este.
model Convocatoria {
  id         String   @id @default(cuid())
  nombre     String
  profesor   User     @relation("ProfesorConvocatoria", fields: [profesorId], references: [id])
  profesorId String
  archivada  Boolean  @default(false)
  sujetos    Sujeto[]
  turnos     Turno[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([profesorId, archivada])
}

/// Un sujet: UN documento, con su eje, su fuente y sus preguntas de
/// interacción. El estudiante elige uno de los dieciséis, no uno de dos
/// documentos dentro de un sujet. Son de la convocatoria entera y no de un
/// grupo: en el examen real los comparte todo el mundo.
model Sujeto {
  id             String           @id @default(cuid())
  convocatoria   Convocatoria     @relation(fields: [convocatoriaId], references: [id], onDelete: Cascade)
  convocatoriaId String
  numero         Int
  eje            String
  titulo         String
  descripcion    String
  fuente         String?
  url            String?
  preguntas      String[]

  /// De dónde salió. Uno de los dos y solo uno; lo vigila
  /// `origenDeSujetValido` en lib/orales/reglas.ts.
  /// `recursoId` apunta a un Ejercicio y hoy siempre es null: el tipo
  /// TAREA_ORAL llega en un plan aparte. La columna se crea ya para que
  /// aquella migración no tenga que tocar esta tabla.
  imagenId       String?
  recursoId      String?
  evaluaciones   EvaluacionOral[]

  @@unique([convocatoriaId, numero])
  @@index([convocatoriaId])
}

/// Un hueco del horario. Con estudiante, o una pausa (estudiante nulo).
/// El día y la hora viven aquí y no en `User` porque son del examen,
/// no de la persona: la misma persona puede examinarse dos veces.
model Turno {
  id             String          @id @default(cuid())
  convocatoria   Convocatoria    @relation(fields: [convocatoriaId], references: [id], onDelete: Cascade)
  convocatoriaId String
  grupo          Grupo           @relation(fields: [grupoId], references: [id])
  grupoId        String
  estudiante     User?           @relation("EstudianteTurno", fields: [estudianteId], references: [id])
  estudianteId   String?
  dia            String
  preparacion    String?
  hora           String
  sala           String?
  orden          Int
  evaluacion     EvaluacionOral?

  @@unique([convocatoriaId, grupoId, orden])
  @@index([estudianteId])
}

/// Lo que el profesor rellena. Una por turno.
model EvaluacionOral {
  id       String  @id @default(cuid())
  turno    Turno   @relation(fields: [turnoId], references: [id], onDelete: Cascade)
  turnoId  String  @unique
  sujeto   Sujeto? @relation(fields: [sujetoId], references: [id])
  sujetoId String?

  /// Segundos, capados a 300. Float y no Int: el cronómetro para donde para.
  segundosEoc Float?
  segundosEoi Float?

  /// Las cinco notas y los seis comentarios, en un solo Json. Se leen y se
  /// escriben siempre juntos, y así añadir un criterio no es una migración.
  notas       Json?
  comentarios Json?

  /// Las frases sugeridas encendidas, por criterio. Aparte de `comentarios`
  /// porque hace falta saber cuáles siguen activas aunque el profesor
  /// reescriba el texto a mano.
  frases      Json?

  /// Los índices de las preguntas de la EOI ya hechas.
  preguntadas Int[]

  transcripcion TranscripcionOral?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

/// El audio, sus segmentos y el informe que devuelve la IA.
/// Aparte de EvaluacionOral porque nace después y a menudo no nace: se
/// puede calificar un examen sin transcribirlo nunca. Se rellena en tanda 2.
model TranscripcionOral {
  id           String         @id @default(cuid())
  evaluacion   EvaluacionOral @relation(fields: [evaluacionId], references: [id], onDelete: Cascade)
  evaluacionId String         @unique
  audioId      String?
  segmentos    Json?
  informe      Json?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}
```

- [ ] **Step 4: Añadir las dos relaciones inversas**

Prisma las exige. En `model User`, junto a las demás relaciones:

```prisma
  convocatorias         Convocatoria[] @relation("ProfesorConvocatoria")
  turnosOrales          Turno[]        @relation("EstudianteTurno")
```

En `model Grupo`, junto a `clases`:

```prisma
  turnosOrales     Turno[]
```

`Grupo` **no** recibe `sujetos`: los sujets cuelgan de la convocatoria.

- [ ] **Step 5: Migrar y regenerar**

```bash
npx prisma migrate dev --name evaluacion_oral
```

Expected: crea `prisma/migrations/<sello>_evaluacion_oral/` y regenera el cliente en `lib/generated/prisma`.

- [ ] **Step 6: Ejecutar el script y verlo pasar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: seis líneas `OK:` y salida 0.

- [ ] **Step 7: Comprobar tipos y estilo**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations scripts/verificar-orales.ts
git commit -m "Los cinco modelos del examen oral, con su ida y vuelta verificado"
```

---

### Task 2: Los criterios y el formato

**Files:**
- Create: `lib/orales/criterios.ts`
- Create: `lib/orales/formato.ts`
- Modify: `scripts/verificar-orales.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `type ClaveCriterio = "lengua" | "fluidez" | "contenido" | "organizacion" | "oratoria"`
  - `type Criterio = { key: ClaveCriterio; romano: string; titulo: string; descripcion: string; maximo: number; color: string; frases: string[] }`
  - `const CRITERIOS: Criterio[]`
  - `type Notas = Partial<Record<ClaveCriterio, number>>`
  - `fmtTiempo(segundos: number): string` · `fmtNota(valor: number): string` · `fmtTotal(valor: number): string` · `calcularTotal(notas: Notas): number` · `pasoDe(maximo: number): number` · `estadoDe(...): "vacio" | "medias" | "hecho"`

- [ ] **Step 1: Escribir las afirmaciones que fallan**

En `scripts/verificar-orales.ts`, añade el import y una función `comprobarFormato()` que se llama al principio de `main()`. No toca la base: es pura.

```ts
import { CRITERIOS } from "@/lib/orales/criterios";
import {
  calcularTotal,
  estadoDe,
  fmtNota,
  fmtTiempo,
  fmtTotal,
  pasoDe,
} from "@/lib/orales/formato";

function comprobarFormato() {
  // Los cinco criterios suman veinte y ni uno más.
  const suma = CRITERIOS.reduce((t, c) => t + c.maximo, 0);
  afirmar(suma === 20, "los cinco criterios suman 20");
  afirmar(CRITERIOS.length === 5, "hay cinco criterios");
  afirmar(
    CRITERIOS.every((c) => c.frases.length >= 8),
    "cada criterio trae al menos ocho frases sugeridas",
  );

  // El paso: 0,25 donde el máximo es pequeño, 0,5 en el resto.
  afirmar(pasoDe(2) === 0.25, "un criterio sobre 2 se mueve de 0,25 en 0,25");
  afirmar(pasoDe(4) === 0.5, "un criterio sobre 4 se mueve de 0,5 en 0,5");
  afirmar(pasoDe(5) === 0.5, "un criterio sobre 5 se mueve de 0,5 en 0,5");

  // El reloj, en los cuatro puntos que importan.
  afirmar(fmtTiempo(0) === "00:00", "el cronómetro parado dice 00:00");
  afirmar(fmtTiempo(59) === "00:59", "59 segundos son 00:59");
  afirmar(fmtTiempo(60) === "01:00", "60 segundos son 01:00");
  afirmar(fmtTiempo(300) === "05:00", "el tope son 05:00");
  afirmar(fmtTiempo(287.5) === "04:47", "los decimales se truncan hacia abajo");

  // Las notas: sin ceros de adorno en el criterio, con un decimal en el total.
  afirmar(fmtNota(3) === "3", "un entero se escribe sin decimales");
  afirmar(fmtNota(1.5) === "1,5", "el decimal va con coma, no con punto");
  afirmar(fmtNota(1.25) === "1,25", "los cuartos de punto se escriben enteros");
  afirmar(fmtTotal(15) === "15,0", "el total siempre lleva un decimal");

  // El total con la parrilla a medias: lo que falta no resta.
  afirmar(calcularTotal({}) === 0, "sin notas el total es 0");
  afirmar(calcularTotal({ lengua: 3 }) === 3, "una sola nota es el total");
  afirmar(
    calcularTotal({ lengua: 3, fluidez: 1.5, contenido: 4, organizacion: 3.5, oratoria: 3 }) === 15,
    "las cinco notas suman el total",
  );
  afirmar(
    calcularTotal({ lengua: 0.25, fluidez: 0.25 }) === 0.5,
    "sumar cuartos no arrastra error de coma flotante",
  );

  // El semáforo.
  afirmar(estadoDe(null) === "vacio", "sin evaluación, gris");
  afirmar(
    estadoDe({ sujetoId: "s1", notas: { lengua: 3 } }) === "medias",
    "con el sujet elegido y una nota, amarillo",
  );
  afirmar(
    estadoDe({ sujetoId: null, notas: { lengua: 3, fluidez: 1, contenido: 1, organizacion: 1, oratoria: 1 } }) === "medias",
    "las cinco notas sin sujet elegido siguen siendo amarillo",
  );
  afirmar(
    estadoDe({ sujetoId: "s1", notas: { lengua: 3, fluidez: 1, contenido: 1, organizacion: 1, oratoria: 1 } }) === "hecho",
    "sujet y cinco notas, verde",
  );
  afirmar(
    estadoDe({ sujetoId: "s1", notas: { lengua: 0, fluidez: 0, contenido: 0, organizacion: 0, oratoria: 0 } }) === "hecho",
    "un cero es una nota puesta, no una nota que falta",
  );
}
```

Y como primera línea de `main()`:

```ts
  comprobarFormato();
```

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: FALLA al resolver `@/lib/orales/criterios` — el módulo no existe.

- [ ] **Step 3: Escribir los criterios**

Crea `lib/orales/criterios.ts`. Los textos están copiados literalmente de `evaluacion_oral.html`; no los reescribas «mejor», son la parrilla oficial del liceo.

```ts
/**
 * Los cinco criterios del oral de Terminale del liceo Saint-Jean de Passy.
 *
 * No son tabla de la base a propósito: son del examen del liceo francés, no
 * de HispaProfe. Meterlos en la base obligaría a mantener una pantalla para
 * editarlos que nadie va a usar. Otro colegio con otra parrilla es otro
 * trabajo, y el sitio donde tocar sería este archivo.
 *
 * `color` es un token de app/globals.css. La traducción desde los pasteles
 * del HTML original está en el diseño: lavender→bloque1, teal→bloque2,
 * amber→bloque4, indigo→hp-400, mint→verde-500.
 */
export type ClaveCriterio =
  | "lengua"
  | "fluidez"
  | "contenido"
  | "organizacion"
  | "oratoria";

export type Criterio = {
  key: ClaveCriterio;
  romano: string;
  titulo: string;
  descripcion: string;
  maximo: number;
  color: string;
  frases: string[];
};

export const CRITERIOS: Criterio[] = [
  {
    key: "lengua",
    romano: "I.",
    titulo: "Corrección de la lengua",
    descripcion: "Corrección gramatical, riqueza del vocabulario.",
    maximo: 4,
    color: "bloque1",
    frases: [
      "Léxico variado y preciso",
      "Estructuras complejas bien manejadas",
      "Errores menores que no impiden la comprensión",
      "Errores recurrentes en concordancia",
      "Léxico limitado / repetitivo",
      "Confusión ser/estar",
      "Buen uso del subjuntivo",
      "Falsos amigos del francés",
    ],
  },
  {
    key: "fluidez",
    romano: "II.",
    titulo: "Pronunciación y fluidez",
    descripcion:
      "Pronunciación clara, entonación adecuada, fluidez sin pausas excesivas.",
    maximo: 2,
    color: "bloque2",
    frases: [
      "Pronunciación clara y comprensible",
      "Buena entonación",
      "Fluidez natural",
      "Algunas pausas, pero coherentes",
      "Pausas excesivas",
      "Acento francófono marcado",
      "Bloqueos frecuentes",
      "Buen ritmo discursivo",
    ],
  },
  {
    key: "contenido",
    romano: "III.",
    titulo: "Contenido",
    descripcion: "Pertinencia y calidad de los argumentos presentados.",
    maximo: 5,
    color: "bloque4",
    frases: [
      "Análisis pertinente y profundo",
      "Buen aprovechamiento del documento",
      "Conocimientos culturales sólidos",
      "Argumentos pertinentes",
      "Análisis superficial",
      "Falta de problemática clara",
      "Lectura descriptiva sin interpretación",
      "Vincula con el eje de manera convincente",
      "Aporta ejemplos personales relevantes",
    ],
  },
  {
    key: "organizacion",
    romano: "IV.",
    titulo: "Organización de las ideas",
    descripcion:
      "Introducción breve, desarrollo estructurado con conectores, conclusión + apertura.",
    maximo: 5,
    color: "hp-400",
    frases: [
      "Plan claro: intro / desarrollo / conclusión",
      "Buen uso de conectores lógicos",
      "Apertura pertinente y original",
      "Transiciones fluidas entre partes",
      "Falta problemática en la introducción",
      "Conclusión sin apertura",
      "Estructura difusa",
      "Sigue el plan anunciado",
    ],
  },
  {
    key: "oratoria",
    romano: "V.",
    titulo: "Cualidades oratorias",
    descripcion:
      "Gestualidad, contacto visual, convicción, recursos retóricos, seguridad al hablar.",
    maximo: 4,
    color: "verde-500",
    frases: [
      "Buen contacto visual",
      "Habla con convicción",
      "Lectura excesiva de notas",
      "Gestualidad apropiada",
      "Tono monótono",
      "Seguridad al hablar",
      "Empleo de recursos retóricos",
      "Postura nerviosa",
    ],
  },
];

/** El tope de cada cronómetro, en segundos. Cinco minutos. */
export const TOPE_SEGUNDOS = 300;
```

- [ ] **Step 4: Escribir el formato**

Crea `lib/orales/formato.ts`:

```ts
import { CRITERIOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";

/** Lo que hay dentro de `EvaluacionOral.notas`. Faltar no es valer cero. */
export type Notas = Partial<Record<ClaveCriterio, number>>;

/**
 * MM:SS. Trunca hacia abajo: el cronómetro guarda decimales porque para
 * donde para, pero 04:47,9 se lee 04:47, que es lo que marcaba el reloj.
 */
export function fmtTiempo(segundos: number): string {
  const enteros = Math.max(0, Math.floor(segundos));
  const m = Math.floor(enteros / 60);
  const s = enteros % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * La nota de un criterio, sin ceros de adorno: 3 y no 3,00. Coma decimal,
 * que es lo que espera quien lee la ficha en castellano o en francés.
 */
export function fmtNota(valor: number): string {
  return String(Math.round(valor * 100) / 100).replace(".", ",");
}

/** El total siempre con un decimal: 15,0 y no 15. */
export function fmtTotal(valor: number): string {
  return valor.toFixed(1).replace(".", ",");
}

/**
 * El paso del `+`/`−`. La fluidez va sobre 2, y con medios puntos solo
 * tendría cinco valores posibles, así que se mueve de cuarto en cuarto.
 */
export function pasoDe(maximo: number): number {
  return maximo <= 2 ? 0.25 : 0.5;
}

/**
 * La suma de lo que haya. Lo que falta no resta.
 *
 * El redondeo final no es cosmético: 0,25 + 0,25 en coma flotante da
 * 0,5000000000000001, y esa cifra acabaría en el CSV que ve el liceo.
 */
export function calcularTotal(notas: Notas | null | undefined): number {
  if (!notas) return 0;
  const suma = CRITERIOS.reduce((t, c) => t + (Number(notas[c.key]) || 0), 0);
  return Math.round(suma * 100) / 100;
}

/** El semáforo del horario. */
export type EstadoTurno = "vacio" | "medias" | "hecho";

/**
 * Verde solo cuando están las cinco notas **y** el sujet elegido: una nota
 * sin saber de qué documento se examinó no es una evaluación terminada.
 *
 * Un cero cuenta como nota puesta. Por eso se compara contra null y
 * undefined y no por veracidad: `if (nota)` daría «falta» en un cero.
 */
export function estadoDe(
  evaluacion: { sujetoId: string | null; notas: Notas | null } | null,
): EstadoTurno {
  if (!evaluacion) return "vacio";
  const puestas = CRITERIOS.filter((c) => {
    const v = evaluacion.notas?.[c.key];
    return v !== undefined && v !== null;
  }).length;
  if (puestas === CRITERIOS.length && evaluacion.sujetoId) return "hecho";
  if (puestas > 0 || evaluacion.sujetoId) return "medias";
  return "vacio";
}
```

- [ ] **Step 5: Ejecutar y verlo pasar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: todas las líneas del formato en `OK:`, más las de la tarea 1.

- [ ] **Step 6: Comprobar tipos y estilo**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add lib/orales/criterios.ts lib/orales/formato.ts scripts/verificar-orales.ts
git commit -m "La parrilla del liceo y el formato de sus notas, fuera de la base"
```

---

### Task 3: Las cuatro reglas

**Files:**
- Create: `lib/orales/reglas.ts`
- Modify: `scripts/verificar-orales.ts`

**Interfaces:**
- Consumes: `pasoDe` de `lib/orales/formato`, `CRITERIOS` y `TOPE_SEGUNDOS` de `lib/orales/criterios`, `estudianteAsignable` de `@/lib/estudiantes`.
- Produces:
  - `puedeExaminarse(estudianteId: string | null): Promise<string | null>`
  - `origenDeSujetValido(origen: { imagenId?: string | null; recursoId?: string | null }): string | null`
  - `ajustarNota(actual: number | null, direccion: 1 | -1, maximo: number): number`
  - `notaDentroDelCriterio(key: ClaveCriterio, valor: number): string | null`
  - `caparTiempo(segundos: number): number`

Cada regla devuelve **el motivo del rechazo o `null`**, siguiendo la forma de `puedeBloquearse` y `puedeEngancharse`. `ajustarNota` y `caparTiempo` son la excepción: devuelven el valor corregido, porque son lo que mueve el botón.

- [ ] **Step 1: Escribir las afirmaciones que fallan**

En `scripts/verificar-orales.ts`, añade los imports y una función `comprobarReglasPuras()` llamada desde `main()` junto a `comprobarFormato()`, más el bloque de la regla que sí toca la base, dentro de `main()` después de crear el turno.

```ts
import {
  ajustarNota,
  caparTiempo,
  notaDentroDelCriterio,
  origenDeSujetValido,
  puedeExaminarse,
} from "@/lib/orales/reglas";

function comprobarReglasPuras() {
  // Regla 5: la nota no se sale del criterio.
  afirmar(ajustarNota(null, 1, 4) === 0.5, "el primer + sobre una nota vacía pone medio punto");
  afirmar(ajustarNota(null, -1, 4) === 0, "el primer − sobre una nota vacía la deja en cero");
  afirmar(ajustarNota(4, 1, 4) === 4, "el + no pasa del máximo del criterio");
  afirmar(ajustarNota(0, -1, 4) === 0, "el − no baja de cero");
  afirmar(ajustarNota(1.5, 1, 2) === 1.75, "sobre 2 el + sube de cuarto en cuarto");
  afirmar(ajustarNota(2, 1, 2) === 2, "sobre 2 el + tampoco pasa del máximo");
  afirmar(ajustarNota(0.25, -1, 2) === 0, "restar cuartos no deja 2,7755e-17");

  afirmar(notaDentroDelCriterio("fluidez", 2) === null, "un 2 sobre 2 es válido");
  afirmar(notaDentroDelCriterio("fluidez", 2.5) !== null, "un 2,5 sobre 2 se rechaza");
  afirmar(notaDentroDelCriterio("lengua", -1) !== null, "una nota negativa se rechaza");
  afirmar(
    (notaDentroDelCriterio("fluidez", 2.5) ?? "").includes("2"),
    "el rechazo dice cuál es el máximo, no un error genérico",
  );

  // Regla 4: el cronómetro no pasa de cinco minutos.
  afirmar(caparTiempo(287.5) === 287.5, "un tiempo normal se guarda tal cual");
  afirmar(caparTiempo(1000) === 300, "un tiempo pasado de rosca se capa en 300");
  afirmar(caparTiempo(-5) === 0, "un tiempo negativo se guarda como cero");

  // Regla 6: un sujet tiene un origen y solo uno.
  afirmar(origenDeSujetValido({ imagenId: "a1" }) === null, "un sujet con imagen vale");
  afirmar(origenDeSujetValido({ recursoId: "e1" }) === null, "un sujet con recurso vale");
  afirmar(origenDeSujetValido({}) !== null, "un sujet sin origen se rechaza");
  afirmar(
    origenDeSujetValido({ imagenId: "a1", recursoId: "e1" }) !== null,
    "un sujet con imagen y recurso a la vez se rechaza",
  );
}
```

Y dentro de `main()`, después de crear el turno de la tarea 1:

```ts
  // Regla 3: a una ficha suprimida no se le crea un examen.
  afirmar(
    (await puedeExaminarse(estudiante.id)) === null,
    "a un estudiante vivo se le puede dar turno",
  );
  await prisma.user.update({
    where: { id: estudiante.id },
    data: { suprimidoEl: new Date(), bloqueadoEl: new Date() },
  });
  const negativa = await puedeExaminarse(estudiante.id);
  afirmar(negativa !== null, "a una ficha suprimida se le niega el turno");
  afirmar(
    (await puedeExaminarse(null)) === null,
    "una pausa no tiene a quién comprobar, así que pasa",
  );
  await prisma.user.update({
    where: { id: estudiante.id },
    data: { suprimidoEl: null, bloqueadoEl: null },
  });
```

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: FALLA al resolver `@/lib/orales/reglas`.

- [ ] **Step 3: Escribir las reglas**

Crea `lib/orales/reglas.ts`:

```ts
import { CRITERIOS, TOPE_SEGUNDOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";
import { fmtNota, pasoDe } from "@/lib/orales/formato";
import { estudianteAsignable } from "@/lib/estudiantes";

/**
 * Las reglas de la evaluación oral. Cada una devuelve el motivo del rechazo
 * o `null`, como `puedeBloquearse` y `puedeEngancharse`.
 *
 * Viven fuera de `lib/acciones-orales.ts` porque una acción de servidor
 * necesita sesión de Clerk y contexto de petición, así que no se puede
 * llamar desde un script. Lo que está fuera es lo único verificable.
 */

/**
 * Regla 3: a una ficha suprimida no se le crea un examen.
 *
 * No es una regla nueva de aquí; `lib/estudiantes.ts` ya la tiene escrita y
 * explica que existe porque se olvidó en tres consultas. Un examen es
 * exactamente el tipo de fila que la supresión no debe volver a ver nacer.
 *
 * Sin estudiante devuelve `null`: el turno es una pausa y no hay a quién
 * comprobar.
 */
export async function puedeExaminarse(
  estudianteId: string | null,
): Promise<string | null> {
  if (await estudianteAsignable(estudianteId)) return null;
  return "Esa ficha está suprimida. No se le puede dar turno de examen.";
}

/**
 * Regla 6: un sujet tiene un origen y solo uno. O una imagen subida o una
 * tarea de Recursos, nunca las dos ni ninguna.
 */
export function origenDeSujetValido(origen: {
  imagenId?: string | null;
  recursoId?: string | null;
}): string | null {
  const conImagen = Boolean(origen.imagenId);
  const conRecurso = Boolean(origen.recursoId);
  if (conImagen && conRecurso) {
    return "Un sujet sale de una imagen o de una tarea de Recursos, no de las dos.";
  }
  if (!conImagen && !conRecurso) {
    return "Falta el documento: sube una imagen o elige una tarea de Recursos.";
  }
  return null;
}

/**
 * Regla 5: la nota no puede salirse del criterio.
 *
 * Devuelve la nota ya movida, capada arriba y abajo. El redondeo a dos
 * decimales es imprescindible con el paso de 0,25: sin él, 0,25 − 0,25 da
 * 2,7755e-17 y la ficha enseñaría un cero que no lo es.
 */
export function ajustarNota(
  actual: number | null,
  direccion: 1 | -1,
  maximo: number,
): number {
  const paso = pasoDe(maximo);
  const desde = actual ?? (direccion === 1 ? 0 - paso : 0);
  const bruto = desde + direccion * paso;
  const dentro = Math.min(maximo, Math.max(0, bruto));
  return Math.round(dentro * 100) / 100;
}

/**
 * La misma regla, del lado del servidor: lo que llega por una acción no
 * pasó necesariamente por los botones.
 */
export function notaDentroDelCriterio(
  key: ClaveCriterio,
  valor: number,
): string | null {
  const criterio = CRITERIOS.find((c) => c.key === key);
  if (!criterio) return `«${key}» no es un criterio de esta parrilla.`;
  if (!Number.isFinite(valor)) return "Esa nota no es un número.";
  if (valor < 0) return "Una nota no puede ser negativa.";
  if (valor > criterio.maximo) {
    return `${criterio.titulo} va sobre ${fmtNota(criterio.maximo)}; ${fmtNota(valor)} se sale.`;
  }
  return null;
}

/**
 * Regla 4: el cronómetro nunca pasa de cinco minutos. El reloj del
 * navegador ya se detiene solo, pero lo que llega a la acción puede venir
 * de una pestaña dormida que despertó con un salto de reloj.
 */
export function caparTiempo(segundos: number): number {
  if (!Number.isFinite(segundos) || segundos < 0) return 0;
  return Math.min(TOPE_SEGUNDOS, segundos);
}
```

- [ ] **Step 4: Ejecutar y verlo pasar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: todas en `OK:`, incluida la de la ficha suprimida.

- [ ] **Step 5: Comprobar tipos y estilo**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/orales/reglas.ts scripts/verificar-orales.ts
git commit -m "Las cuatro reglas del oral, fuera de las acciones y verificadas"
```

---

### Task 4: Las acciones de servidor

**Files:**
- Create: `lib/acciones-orales.ts`

**Interfaces:**
- Consumes: `puedeExaminarse`, `origenDeSujetValido`, `notaDentroDelCriterio`, `caparTiempo` de `lib/orales/reglas`; `CRITERIOS` de `lib/orales/criterios`; `exigirProfesor` de `@/lib/profesor`.
- Produces, todas `async (formData: FormData) => Promise<void>` salvo la última:
  - `crearConvocatoria` · `archivarConvocatoria`
  - `crearSujeto` · `borrarSujeto`
  - `pegarHorario` · `borrarTurno`
  - `guardarEvaluacion(datos: DatosEvaluacion): Promise<{ error: string } | null>` — **no** recibe `FormData`: la llama el panel de cliente desde el autoguardado.
  - `type DatosEvaluacion = { turnoId: string; sujetoId?: string | null; notas?: Notas; comentarios?: Record<string, string>; frases?: Record<string, string[]>; preguntadas?: number[]; segundosEoc?: number; segundosEoi?: number }`

- [ ] **Step 1: Escribir las acciones**

No hay paso RED aquí: las acciones no se pueden llamar desde el script —necesitan sesión de Clerk—, que es justo el motivo por el que las reglas viven fuera. Lo que se verifica es lo de dentro, y ya está verificado en la tarea 3. Lo que se comprueba aquí es que compila y que la pantalla de la tarea 5 la usa de verdad.

Crea `lib/acciones-orales.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { CRITERIOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";
import type { Notas } from "@/lib/orales/formato";
import {
  caparTiempo,
  notaDentroDelCriterio,
  origenDeSujetValido,
  puedeExaminarse,
} from "@/lib/orales/reglas";

/**
 * La convocatoria existe y es de quien pide, o es un administrador.
 * Gemela de `exigirClaseSuya` en lib/acciones-clases.ts.
 */
async function exigirConvocatoriaSuya(convocatoriaId: string) {
  const usuario = await exigirProfesor();
  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id: convocatoriaId },
    select: { id: true, profesorId: true },
  });
  if (!convocatoria) throw new Error("Esa convocatoria no existe.");
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    throw new Error("Esa convocatoria no es tuya.");
  }
  return { convocatoria, usuario };
}

/**
 * El turno es de una convocatoria de quien pide. Sin esto, acertar un
 * `turnoId` bastaría para escribir en el examen de otro profesor: el
 * permiso estaría comprobado, pero sobre el recurso equivocado.
 */
async function exigirTurnoSuyo(turnoId: string) {
  const usuario = await exigirProfesor();
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    select: {
      id: true,
      estudianteId: true,
      convocatoria: { select: { id: true, profesorId: true } },
    },
  });
  if (!turno) throw new Error("Ese turno no existe.");
  if (turno.convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    throw new Error("Ese turno no es tuyo.");
  }
  return turno;
}

export async function crearConvocatoria(formData: FormData) {
  const usuario = await exigirProfesor();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("La convocatoria necesita un nombre.");

  const creada = await prisma.convocatoria.create({
    data: { nombre, profesorId: usuario.id },
    select: { id: true },
  });
  revalidatePath("/profe/orales");
  redirect(`/profe/orales/${creada.id}`);
}

export async function archivarConvocatoria(formData: FormData) {
  const id = String(formData.get("convocatoriaId") ?? "");
  await exigirConvocatoriaSuya(id);
  const actual = await prisma.convocatoria.findUniqueOrThrow({
    where: { id },
    select: { archivada: true },
  });
  await prisma.convocatoria.update({
    where: { id },
    data: { archivada: !actual.archivada },
  });
  revalidatePath("/profe/orales");
}

export async function crearSujeto(formData: FormData) {
  const convocatoriaId = String(formData.get("convocatoriaId") ?? "");
  await exigirConvocatoriaSuya(convocatoriaId);

  const imagenId = String(formData.get("imagenId") ?? "") || null;
  const motivo = origenDeSujetValido({ imagenId });
  if (motivo) throw new Error(motivo);

  const numero = Number(formData.get("numero"));
  if (!Number.isInteger(numero) || numero < 1) {
    throw new Error("El número del sujet es un entero positivo.");
  }

  // Una pregunta por línea: es como se pegan desde el documento del liceo.
  const preguntas = String(formData.get("preguntas") ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  await prisma.sujeto.create({
    data: {
      convocatoriaId,
      numero,
      eje: String(formData.get("eje") ?? "").trim(),
      titulo: String(formData.get("titulo") ?? "").trim(),
      descripcion: String(formData.get("descripcion") ?? "").trim(),
      fuente: String(formData.get("fuente") ?? "").trim() || null,
      url: String(formData.get("url") ?? "").trim() || null,
      preguntas,
      imagenId,
    },
  });
  revalidatePath(`/profe/orales/${convocatoriaId}/sujets`);
  revalidatePath(`/profe/orales/${convocatoriaId}`);
}

export async function borrarSujeto(formData: FormData) {
  const id = String(formData.get("sujetoId") ?? "");
  const sujeto = await prisma.sujeto.findUnique({
    where: { id },
    select: { convocatoriaId: true, _count: { select: { evaluaciones: true } } },
  });
  if (!sujeto) throw new Error("Ese sujet no existe.");
  await exigirConvocatoriaSuya(sujeto.convocatoriaId);

  // Borrarlo dejaría exámenes sin saber de qué documento se examinaron.
  if (sujeto._count.evaluaciones > 0) {
    throw new Error("Ese sujet ya se usó en un examen. No se puede borrar.");
  }
  await prisma.sujeto.delete({ where: { id } });
  revalidatePath(`/profe/orales/${sujeto.convocatoriaId}/sujets`);
}

/**
 * Monta el horario de un grupo de una vez, pegando las filas del liceo.
 *
 * Una línea por turno, con tabuladores o punto y coma:
 *   Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI
 * Una línea con solo `---` es una pausa.
 *
 * Los estudiantes se emparejan por correo si la línea trae uno; si no, por
 * apellido y nombre entre los miembros del grupo. Lo que no se empareja se
 * queda sin estudiante y sale en la pantalla como pendiente, en vez de
 * fallar la importación entera por una tilde.
 */
export async function pegarHorario(formData: FormData) {
  const convocatoriaId = String(formData.get("convocatoriaId") ?? "");
  await exigirConvocatoriaSuya(convocatoriaId);
  const grupoId = String(formData.get("grupoId") ?? "");
  if (!grupoId) throw new Error("Elige el grupo que se examina.");

  const miembros = await prisma.miembroGrupo.findMany({
    where: { grupoId },
    select: {
      estudiante: {
        select: { id: true, email: true, firstName: true, lastName: true, suprimidoEl: true },
      },
    },
  });

  const porNombre = new Map<string, string>();
  const porCorreo = new Map<string, string>();
  for (const { estudiante } of miembros) {
    if (estudiante.suprimidoEl) continue;
    porCorreo.set(estudiante.email.toLowerCase(), estudiante.id);
    const nombre = `${estudiante.lastName ?? ""} ${estudiante.firstName ?? ""}`
      .trim()
      .toLowerCase();
    if (nombre) porNombre.set(nombre, estudiante.id);
  }

  const lineas = String(formData.get("horario") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // El orden arranca donde acabó lo que ya hubiera, para poder pegar en dos
  // veces sin chocar con @@unique([convocatoriaId, grupoId, orden]).
  const ultimo = await prisma.turno.findFirst({
    where: { convocatoriaId, grupoId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  let orden = (ultimo?.orden ?? 0) + 1;

  for (const linea of lineas) {
    const campos = linea.split(/[\t;]/).map((c) => c.trim());
    if (campos[0] === "---" || campos[3] === "---") {
      await prisma.turno.create({
        data: { convocatoriaId, grupoId, dia: campos[0] === "---" ? "" : campos[0], hora: "—", orden },
      });
      orden += 1;
      continue;
    }
    const [dia, preparacion, hora, apellido, nombre, sala, correo] = campos;
    const clave = `${apellido ?? ""} ${nombre ?? ""}`.trim().toLowerCase();
    const estudianteId =
      (correo ? porCorreo.get(correo.toLowerCase()) : undefined) ??
      porNombre.get(clave) ??
      null;

    // Regla 3: aunque el emparejamiento acierte, una ficha suprimida no
    // recibe turno. Se deja el hueco sin estudiante, no se rompe el pegado.
    const motivo = await puedeExaminarse(estudianteId);
    await prisma.turno.create({
      data: {
        convocatoriaId,
        grupoId,
        estudianteId: motivo ? null : estudianteId,
        dia: dia ?? "",
        preparacion: preparacion || null,
        hora: hora ?? "",
        sala: sala || null,
        orden,
      },
    });
    orden += 1;
  }
  revalidatePath(`/profe/orales/${convocatoriaId}`);
}

export async function borrarTurno(formData: FormData) {
  const turnoId = String(formData.get("turnoId") ?? "");
  const turno = await exigirTurnoSuyo(turnoId);
  await prisma.turno.delete({ where: { id: turnoId } });
  revalidatePath(`/profe/orales/${turno.convocatoria.id}`);
}

export type DatosEvaluacion = {
  turnoId: string;
  sujetoId?: string | null;
  notas?: Notas;
  comentarios?: Record<string, string>;
  frases?: Record<string, string[]>;
  preguntadas?: number[];
  segundosEoc?: number;
  segundosEoi?: number;
};

/**
 * El autoguardado del panel. Devuelve el motivo del rechazo o `null`: un
 * editor que se traga un error es inusable, y este escribe cada medio
 * segundo mientras el profesor evalúa.
 *
 * No lleva `revalidatePath`: la llama un componente de cliente que ya tiene
 * el estado en la mano, y refrescar la ruta entera en cada tecla haría
 * parpadear el panel. El semáforo del horario se refresca al cambiar de
 * estudiante, que es cuando la pantalla se vuelve a pintar.
 */
export async function guardarEvaluacion(
  datos: DatosEvaluacion,
): Promise<{ error: string } | null> {
  await exigirTurnoSuyo(datos.turnoId);

  if (datos.notas) {
    for (const criterio of CRITERIOS) {
      const valor = datos.notas[criterio.key];
      if (valor === undefined || valor === null) continue;
      const motivo = notaDentroDelCriterio(criterio.key as ClaveCriterio, valor);
      if (motivo) return { error: motivo };
    }
  }

  const escribible = {
    sujetoId: datos.sujetoId,
    notas: datos.notas,
    comentarios: datos.comentarios,
    frases: datos.frases,
    preguntadas: datos.preguntadas,
    segundosEoc:
      datos.segundosEoc === undefined ? undefined : caparTiempo(datos.segundosEoc),
    segundosEoi:
      datos.segundosEoi === undefined ? undefined : caparTiempo(datos.segundosEoi),
  };

  await prisma.evaluacionOral.upsert({
    where: { turnoId: datos.turnoId },
    create: { turnoId: datos.turnoId, ...escribible },
    update: escribible,
  });
  return null;
}
```

- [ ] **Step 2: Comprobar tipos y estilo**

```bash
npx tsc --noEmit && npm run lint
```

Expected: verde. Si `escribible` se queja por los `Json`, tipa los campos como `Prisma.InputJsonValue`; no los pases a `any`.

- [ ] **Step 3: Commit**

```bash
git add lib/acciones-orales.ts
git commit -m "Las acciones del oral: convocar, pegar el horario y guardar la parrilla"
```

---

### Task 5: La lista de convocatorias

**Files:**
- Create: `app/(app)/profe/orales/page.tsx`

**Interfaces:**
- Consumes: `crearConvocatoria`, `archivarConvocatoria` de `@/lib/acciones-orales`.
- Produces: la ruta `/profe/orales`, desde la que se entra a `/profe/orales/[id]`.

- [ ] **Step 1: Leer cómo se escriben las páginas en esta versión de Next**

Lee `node_modules/next/dist/docs/` en lo que toque a componentes de servidor y acciones en formularios, y mira `app/(app)/profe/clases/page.tsx` como patrón vivo. **No escribas la página antes de esto.**

- [ ] **Step 2: Escribir la página**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { archivarConvocatoria, crearConvocatoria } from "@/lib/acciones-orales";

export const dynamic = "force-dynamic";

export default async function OralesPage() {
  const usuario = await exigirProfesor();
  const convocatorias = await prisma.convocatoria.findMany({
    where: usuario.role === "ADMIN" ? {} : { profesorId: usuario.id },
    orderBy: [{ archivada: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nombre: true,
      archivada: true,
      createdAt: true,
      _count: { select: { turnos: true, sujetos: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-tinta">Evaluación oral</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Cada convocatoria es un examen con su horario, sus sujets y sus notas.
      </p>

      <form
        action={crearConvocatoria}
        className="mt-6 flex gap-2 rounded-tarjeta bg-white p-4 shadow-suave"
      >
        <input
          name="nombre"
          required
          maxLength={120}
          placeholder="Oral de Terminale · SJDP · mayo 2026"
          className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-hp-400 px-4 py-2 text-sm font-bold text-white"
        >
          Convocar
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {convocatorias.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-tarjeta bg-white p-4 shadow-suave"
          >
            <Link href={`/profe/orales/${c.id}`} className="flex-1">
              <span className="font-bold text-tinta">{c.nombre}</span>
              <span className="ml-2 text-xs text-tinta-suave">
                {c._count.turnos} turnos · {c._count.sujetos} sujets
              </span>
              {c.archivada && (
                <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-xs text-tinta-suave">
                  archivada
                </span>
              )}
            </Link>
            <form action={archivarConvocatoria}>
              <input type="hidden" name="convocatoriaId" value={c.id} />
              <button
                type="submit"
                className="text-xs font-bold text-tinta-suave hover:text-tinta"
              >
                {c.archivada ? "Desarchivar" : "Archivar"}
              </button>
            </form>
          </li>
        ))}
      </ul>

      {convocatorias.length === 0 && (
        <p className="mt-6 text-sm text-tinta-suave">
          Todavía no hay ninguna. Ponle nombre arriba y entra a montar el horario.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Comprobar tipos, estilo y pantalla**

```bash
npx tsc --noEmit && npm run lint && npm run fresh
```

Abre `http://localhost:3000/profe/orales`, crea una convocatoria y comprueba que redirige a su página (que dará 404 hasta la tarea 6: es lo esperado). Archiva y desarchiva.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/profe/orales/page.tsx"
git commit -m "La lista de convocatorias, con crear y archivar"
```

---

### Task 6: El horario

**Files:**
- Create: `app/(app)/profe/orales/[id]/page.tsx`
- Create: `components/orales/horario.tsx`
- Modify: `scripts/verificar-orales.ts`

**Interfaces:**
- Consumes: `estadoDe`, `fmtTotal`, `calcularTotal` de `lib/orales/formato`; `pegarHorario`, `borrarTurno` de `@/lib/acciones-orales`.
- Produces:
  - `<Horario turnos={...} activoId={...} convocatoriaId={...} />` en `components/orales/horario.tsx`
  - `type TurnoDeLista = { id: string; dia: string; preparacion: string | null; hora: string; sala: string | null; estudiante: { id: string; firstName: string | null; lastName: string | null; email: string } | null; evaluacion: { sujetoId: string | null; notas: Notas | null } | null }`

- [ ] **Step 1: Comprobar el semáforo contra una fila real**

Aquí no hay ciclo RED→GREEN y fingirlo sería teatro: `estadoDe` y `calcularTotal` ya se implementaron y se verificaron en la tarea 2. Lo que falta comprobar es otra cosa —que lo que devuelve Prisma encaja con lo que esas funciones esperan, con `notas` llegando como `Json` y no como el objeto literal del script—, y eso solo se ve contra una fila real.

En `scripts/verificar-orales.ts`, dentro de `main()`, después de crear la evaluación:

```ts
  // El semáforo con una fila real, no con un objeto inventado.
  const conEvaluacion = await prisma.turno.findUniqueOrThrow({
    where: { id: turno.id },
    select: { evaluacion: { select: { sujetoId: true, notas: true } } },
  });
  afirmar(
    estadoDe(conEvaluacion.evaluacion as { sujetoId: string | null; notas: Notas | null }) === "hecho",
    "un turno con sujet y cinco notas sale en verde",
  );
  afirmar(
    fmtTotal(calcularTotal(conEvaluacion.evaluacion?.notas as Notas)) === "15,0",
    "y su nota se lee 15,0",
  );
```

Añade `import type { Notas } from "@/lib/orales/formato";` arriba, y `calcularTotal` y `fmtTotal` al import que ya existe.

- [ ] **Step 2: Ejecutarlo**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: PASA. Si falla con `notas` valiendo `null`, el `create` de la tarea 1 no está guardando el `Json`: arréglalo antes de escribir ninguna pantalla, porque el semáforo entero cuelga de ese dato.

- [ ] **Step 3: Escribir el componente del horario**

Crea `components/orales/horario.tsx`. Es de servidor: no tiene estado.

```tsx
import Link from "next/link";
import { calcularTotal, estadoDe, fmtTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export type TurnoDeLista = {
  id: string;
  dia: string;
  preparacion: string | null;
  hora: string;
  sala: string | null;
  estudiante: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  evaluacion: { sujetoId: string | null; notas: unknown } | null;
};

const semaforo: Record<string, string> = {
  vacio: "bg-fondo text-tinta-suave",
  medias: "bg-sol-300/40 text-tinta",
  hecho: "bg-verde-500 text-white",
};

export default function Horario({
  turnos,
  activoId,
  convocatoriaId,
}: {
  turnos: TurnoDeLista[];
  activoId?: string;
  convocatoriaId: string;
}) {
  let ultimoDia: string | null = null;

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-hp-100 bg-white">
      {turnos.map((t) => {
        const cabecera = t.dia !== ultimoDia ? t.dia : null;
        ultimoDia = t.dia;
        // Una pausa es un turno sin estudiante: separador, sin interacción.
        const esPausa = t.estudiante === null;
        const estado = estadoDe(
          t.evaluacion
            ? { sujetoId: t.evaluacion.sujetoId, notas: t.evaluacion.notas as Notas | null }
            : null,
        );
        const nota =
          estado === "hecho"
            ? fmtTotal(calcularTotal(t.evaluacion?.notas as Notas))
            : estado === "medias"
              ? "…"
              : "—";

        return (
          <div key={t.id}>
            {cabecera && (
              <div className="sticky top-0 border-b border-hp-100 bg-white px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-tinta-suave">
                {cabecera}
              </div>
            )}
            {esPausa ? (
              <div className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-tinta-suave">
                · · · pausa · · ·
              </div>
            ) : (
              <Link
                href={`/profe/orales/${convocatoriaId}?turno=${t.id}`}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border-l-4 px-5 py-3 text-sm ${
                  t.id === activoId
                    ? "border-l-verde-500 bg-verde-500/10"
                    : "border-l-transparent hover:bg-fondo"
                }`}
              >
                <span className="tabular-nums text-xs font-semibold text-tinta-suave">
                  {t.hora}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-tinta-suave">
                    {t.estudiante?.lastName ?? t.estudiante?.email}
                  </span>
                  <span className="block truncate font-bold text-tinta">
                    {t.estudiante?.firstName ?? ""}
                  </span>
                </span>
                <span
                  className={`min-w-[28px] rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${semaforo[estado]}`}
                >
                  {nota}
                </span>
              </Link>
            )}
          </div>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 4: Escribir la página de la convocatoria**

Crea `app/(app)/profe/orales/[id]/page.tsx`. En esta tarea la columna derecha es solo un hueco; la llena la tarea 8.

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { pegarHorario } from "@/lib/acciones-orales";
import Horario from "@/components/orales/horario";

export const dynamic = "force-dynamic";

export default async function ConvocatoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ turno?: string }>;
}) {
  const { id } = await params;
  const { turno: turnoActivo } = await searchParams;
  const usuario = await exigirProfesor();

  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id },
    select: { id: true, nombre: true, profesorId: true },
  });
  if (!convocatoria) notFound();
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    notFound();
  }

  const turnos = await prisma.turno.findMany({
    where: { convocatoriaId: id },
    orderBy: { orden: "asc" },
    select: {
      id: true,
      dia: true,
      preparacion: true,
      hora: true,
      sala: true,
      estudiante: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      evaluacion: { select: { sujetoId: true, notas: true } },
    },
  });

  const grupos = await prisma.grupo.findMany({
    where: usuario.role === "ADMIN" ? { archivado: false } : { profesorId: usuario.id, archivado: false },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center gap-4 border-b border-hp-100 bg-white px-6 py-4">
        <h1 className="text-xl font-extrabold text-tinta">{convocatoria.nombre}</h1>
        <Link
          href={`/profe/orales/${id}/sujets`}
          className="ml-auto text-sm font-bold text-hp-400"
        >
          Sujets
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <Horario turnos={turnos} activoId={turnoActivo} convocatoriaId={id} />
        <section className="flex-1 overflow-y-auto p-6">
          {turnos.length === 0 ? (
            <form
              action={pegarHorario}
              className="max-w-xl space-y-3 rounded-tarjeta bg-white p-5 shadow-suave"
            >
              <input type="hidden" name="convocatoriaId" value={id} />
              <h2 className="font-bold text-tinta">Pega el horario del liceo</h2>
              <p className="text-sm text-tinta-suave">
                Una línea por turno, separando con tabulador o punto y coma:
                <br />
                <code className="text-xs">
                  Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI
                </code>
                <br />
                Una línea con <code className="text-xs">---</code> es una pausa.
              </p>
              <select
                name="grupoId"
                required
                className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
              >
                <option value="">¿Qué grupo se examina?</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              <textarea
                name="horario"
                required
                rows={10}
                className="w-full rounded-lg border border-hp-100 p-3 font-mono text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-hp-400 px-4 py-2 text-sm font-bold text-white"
              >
                Montar el horario
              </button>
            </form>
          ) : (
            <p className="text-sm text-tinta-suave">
              Elige a alguien en la lista para empezar a evaluar.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Comprobar tipos, estilo y pantalla**

```bash
npx tsc --noEmit && npm run lint && npm run fresh
```

A mano: entra en la convocatoria, pega cinco líneas —una de ellas `---`—, y comprueba que salen agrupadas por día, que la pausa es un separador sin enlace, y que quien no se empareja aparece igualmente en la lista.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/profe/orales/[id]/page.tsx" components/orales/horario.tsx scripts/verificar-orales.ts
git commit -m "El horario del examen, pegado del liceo y con su semáforo"
```

---

### Task 7: Los sujets

**Files:**
- Create: `app/(app)/profe/orales/[id]/sujets/page.tsx`
- Create: `components/orales/parrilla-sujets.tsx`
- Modify: `scripts/verificar-orales.ts`

**Interfaces:**
- Consumes: `crearSujeto`, `borrarSujeto` de `@/lib/acciones-orales`; `SubirImagen` de `@/components/subir-imagen`; `origenDeSujetValido` de `lib/orales/reglas`.
- Produces:
  - `<ParrillaSujets sujetos={...} elegidoId={...} alElegir={...} />` en `components/orales/parrilla-sujets.tsx`, cliente
  - `type SujetoDeParrilla = { id: string; numero: number; eje: string; titulo: string; descripcion: string; fuente: string | null; url: string | null; preguntas: string[]; imagenId: string | null }`

- [ ] **Step 1: Escribir la afirmación que falla**

En `scripts/verificar-orales.ts`, dentro de `main()`:

```ts
  // Regla 6 contra la base: un sujet que ya se usó no se borra, y el
  // @@unique impide dos sujets con el mismo número en la convocatoria.
  let repetido = false;
  try {
    await prisma.sujeto.create({
      data: {
        convocatoriaId: convocatoria.id,
        numero: 7,
        eje: "Otro",
        titulo: "Repetido",
        descripcion: "",
        preguntas: [],
        imagenId: "otra",
      },
    });
  } catch {
    repetido = true;
  }
  afirmar(repetido, "dos sujets con el mismo número en la misma convocatoria chocan");
```

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: PASA a la primera si el `@@unique` de la tarea 1 está bien puesto. Si falla, el `@@unique([convocatoriaId, numero])` no llegó a la migración: arréglalo antes de seguir.

- [ ] **Step 3: Escribir la parrilla**

Crea `components/orales/parrilla-sujets.tsx`. Es cliente porque el panel de la tarea 8 la usa con estado.

```tsx
"use client";

export type SujetoDeParrilla = {
  id: string;
  numero: number;
  eje: string;
  titulo: string;
  descripcion: string;
  fuente: string | null;
  url: string | null;
  preguntas: string[];
  imagenId: string | null;
};

export default function ParrillaSujets({
  sujetos,
  elegidoId,
  alElegir,
  preguntadas = [],
  alPreguntar,
}: {
  sujetos: SujetoDeParrilla[];
  elegidoId: string | null;
  alElegir: (id: string) => void;
  preguntadas?: number[];
  alPreguntar?: (indice: number) => void;
}) {
  const elegido = sujetos.find((s) => s.id === elegidoId) ?? null;

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">
        {sujetos.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => alElegir(s.id)}
            className={`relative overflow-hidden rounded-lg border bg-white p-1.5 text-left ${
              s.id === elegidoId ? "border-2 border-verde-500" : "border-hp-100"
            }`}
          >
            <span className="absolute left-2 top-2 rounded bg-tinta px-1.5 py-0.5 text-[10px] font-extrabold text-white">
              {s.numero}
            </span>
            {s.imagenId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/archivos/${s.imagenId}`}
                alt={`Sujet ${s.numero}`}
                className="aspect-[1/1.18] w-full rounded object-cover object-top"
              />
            ) : (
              <span className="flex aspect-[1/1.18] items-center justify-center rounded bg-fondo text-xs text-tinta-suave">
                sin imagen
              </span>
            )}
            <span className="mt-1 block text-center text-[10px] font-semibold leading-tight text-tinta-suave">
              {s.titulo.length > 30 ? `${s.titulo.slice(0, 28)}…` : s.titulo}
            </span>
          </button>
        ))}
      </div>

      {elegido && (
        <div className="mt-4 rounded-tarjeta bg-white p-5 shadow-suave">
          <span className="inline-block rounded-full bg-bloque1/25 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-tinta">
            {elegido.eje} · Doc. {elegido.numero}
          </span>
          <h3 className="mt-2 text-lg font-extrabold text-tinta">{elegido.titulo}</h3>
          <p className="mt-1 text-sm text-tinta-suave">{elegido.descripcion}</p>
          {elegido.fuente && (
            <p className="mt-1 text-xs text-tinta-suave">
              {elegido.fuente}
              {elegido.url && (
                <>
                  {" — "}
                  <a
                    href={elegido.url}
                    target="_blank"
                    rel="noopener"
                    className="font-bold text-hp-400"
                  >
                    ver fuente ↗
                  </a>
                </>
              )}
            </p>
          )}

          {elegido.preguntas.length > 0 && alPreguntar && (
            <div className="mt-4 border-l-4 border-bloque1 pl-4">
              <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
                Preguntas para la interacción · clic para marcar
              </h4>
              <ol className="mt-2 space-y-1.5">
                {elegido.preguntas.map((q, i) => {
                  const hecha = preguntadas.includes(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => alPreguntar(i)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          hecha
                            ? "border-verde-500 bg-verde-500/10 text-tinta-suave line-through"
                            : "border-transparent bg-fondo text-tinta"
                        }`}
                      >
                        {hecha ? "✓ " : `${i + 1}. `}
                        {q}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Escribir la pantalla de alta**

Crea `app/(app)/profe/orales/[id]/sujets/page.tsx`. Usa `SubirImagen`, que ya reduce en el navegador y devuelve la url `/api/archivos/<id>`; de ahí se saca el id.

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { borrarSujeto, crearSujeto } from "@/lib/acciones-orales";
import SubirImagen from "@/components/subir-imagen";

export const dynamic = "force-dynamic";

export default async function SujetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirProfesor();
  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id },
    select: { id: true, nombre: true, profesorId: true },
  });
  if (!convocatoria) notFound();
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") notFound();

  const sujetos = await prisma.sujeto.findMany({
    where: { convocatoriaId: id },
    orderBy: { numero: "asc" },
    select: {
      id: true,
      numero: true,
      eje: true,
      titulo: true,
      imagenId: true,
      _count: { select: { evaluaciones: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-extrabold text-tinta">
        Sujets · {convocatoria.nombre}
      </h1>

      <form
        action={crearSujeto}
        className="mt-5 space-y-3 rounded-tarjeta bg-white p-5 shadow-suave"
      >
        <input type="hidden" name="convocatoriaId" value={id} />
        <div className="flex gap-3">
          <input
            name="numero"
            type="number"
            min={1}
            required
            placeholder="Nº"
            className="w-20 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
          <input
            name="eje"
            required
            placeholder="Eje (Arte y poder)"
            className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
        </div>
        <input
          name="titulo"
          required
          placeholder="Título del documento"
          className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <textarea
          name="descripcion"
          rows={2}
          placeholder="De qué es la imagen"
          className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <input
            name="fuente"
            placeholder="Fuente (BBC Mundo)"
            className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
          <input
            name="url"
            type="url"
            placeholder="https://…"
            className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          name="preguntas"
          rows={5}
          placeholder="Una pregunta de interacción por línea"
          className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <SubirDocumento />
        <button
          type="submit"
          className="rounded-lg bg-hp-400 px-4 py-2 text-sm font-bold text-white"
        >
          Añadir el sujet
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {sujetos.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-tarjeta bg-white p-3 shadow-suave"
          >
            <span className="w-8 text-center font-extrabold text-tinta">{s.numero}</span>
            <span className="flex-1">
              <span className="block font-bold text-tinta">{s.titulo}</span>
              <span className="text-xs text-tinta-suave">{s.eje}</span>
            </span>
            {s._count.evaluaciones === 0 && (
              <form action={borrarSujeto}>
                <input type="hidden" name="sujetoId" value={s.id} />
                <button type="submit" className="text-xs font-bold text-coral">
                  Borrar
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

Y cambia el import de `SubirImagen` por `import SubirDocumento from "@/components/orales/subir-documento";`.

- [ ] **Step 5: Escribir el puente entre la subida y el formulario**

`SubirImagen` (`components/subir-imagen.tsx`) es un componente **de cliente** con la firma `{ alSubir: (url: string) => void; etiqueta?: string }`: sube a `/api/archivos` reduciendo la imagen en el navegador y devuelve la url `/api/archivos/<id>` por callback. Un formulario de servidor no puede recibir eso, así que hace falta un puente mínimo de cliente que guarde el id en un `<input type="hidden">`.

Crea `components/orales/subir-documento.tsx`:

```tsx
"use client";

import { useState } from "react";
import SubirImagen from "@/components/subir-imagen";

/**
 * El puente entre `SubirImagen`, que devuelve la url por callback, y el
 * formulario de alta, que se envía a una acción de servidor. Guarda solo el
 * id: la ruta `/api/archivos/<id>` se reconstruye donde haga falta, igual
 * que hace `Bloque` con sus imágenes.
 */
export default function SubirDocumento() {
  const [imagenId, setImagenId] = useState("");

  return (
    <div className="flex items-center gap-3">
      <SubirImagen
        etiqueta="Subir el documento"
        alSubir={(url) => setImagenId(url.split("/").pop() ?? "")}
      />
      {/* `required` deja que el navegador impida enviar sin documento, y
          la regla 6 lo vuelve a comprobar en el servidor. */}
      <input type="hidden" name="imagenId" value={imagenId} required />
      {imagenId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/archivos/${imagenId}`}
          alt="Vista previa del documento"
          className="h-16 rounded border border-hp-100"
        />
      ) : (
        <span className="text-xs text-tinta-suave">Sin documento todavía</span>
      )}
    </div>
  );
}
```

**Ojo:** un `<input type="hidden" required>` no lo valida el navegador. Si al probarlo se puede enviar el formulario sin imagen, quita el `required` y fíate de la regla 6 del servidor, que devuelve «Falta el documento…». Lo que no vale es quedarse sin ninguna de las dos comprobaciones.

- [ ] **Step 6: Comprobar tipos, estilo y pantalla**

```bash
npx tsc --noEmit && npm run lint && npm run fresh
```

A mano: crea dos sujets con imagen, comprueba que se ven en la lista, que el segundo con el mismo número se rechaza, y que el botón de borrar desaparece en cuanto un sujet se usa en una evaluación.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/profe/orales/[id]/sujets/page.tsx" components/orales/parrilla-sujets.tsx components/orales/subir-documento.tsx scripts/verificar-orales.ts
git commit -m "Los sujets: alta con imagen, parrilla de viñetas y preguntas de la EOI"
```

---

### Task 8: El panel de evaluación

**Files:**
- Create: `components/orales/cronometro.tsx`
- Create: `components/orales/tarjeta-criterio.tsx`
- Create: `components/orales/panel.tsx`
- Modify: `app/(app)/profe/orales/[id]/page.tsx`

**Interfaces:**
- Consumes: `CRITERIOS`, `TOPE_SEGUNDOS`; `fmtTiempo`, `fmtNota`, `fmtTotal`, `calcularTotal`; `ajustarNota`; `guardarEvaluacion` y `DatosEvaluacion`; `<ParrillaSujets />`.
- Produces: `<Panel turno={...} sujetos={...} />`, el componente de cliente donde se pasa el 90% del tiempo.

- [ ] **Step 1: Escribir el cronómetro**

Crea `components/orales/cronometro.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { TOPE_SEGUNDOS } from "@/lib/orales/criterios";
import { fmtTiempo } from "@/lib/orales/formato";

/**
 * Un cronómetro que cuenta hacia arriba hasta cinco minutos y se para solo.
 *
 * El tiempo se calcula desde una marca de inicio y no sumando ticks: un
 * `setInterval` pierde milisegundos en cada vuelta y en cinco minutos eso
 * se nota. El intervalo solo repinta.
 */
export default function Cronometro({
  etiqueta,
  sub,
  romano,
  segundos,
  corriendo,
  alCambiar,
  alArrancar,
}: {
  etiqueta: string;
  sub: string;
  romano: string;
  segundos: number;
  corriendo: boolean;
  alCambiar: (segundos: number, corriendo: boolean) => void;
  alArrancar: () => void;
}) {
  const [mostrado, setMostrado] = useState(segundos);
  const desde = useRef<number | null>(null);

  useEffect(() => {
    if (!corriendo) {
      desde.current = null;
      setMostrado(segundos);
      return;
    }
    desde.current = Date.now() - segundos * 1000;
    const id = setInterval(() => {
      const va = (Date.now() - (desde.current ?? Date.now())) / 1000;
      if (va >= TOPE_SEGUNDOS) {
        setMostrado(TOPE_SEGUNDOS);
        alCambiar(TOPE_SEGUNDOS, false);
        return;
      }
      setMostrado(va);
    }, 250);
    return () => clearInterval(id);
  }, [corriendo, segundos, alCambiar]);

  const acabado = mostrado >= TOPE_SEGUNDOS;

  return (
    <div className="flex flex-col gap-1.5 rounded-tarjeta border border-hp-100 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="rounded bg-fondo px-2 py-1 font-mono text-xs font-bold text-tinta">
          {romano}
        </span>
        <span className="flex flex-col">
          <span className="font-bold text-tinta">{etiqueta}</span>
          <span className="text-xs text-tinta-suave">{sub}</span>
        </span>
      </div>
      <span
        className={`font-mono text-5xl font-bold tabular-nums ${
          acabado ? "text-coral" : "text-tinta"
        }`}
      >
        {fmtTiempo(mostrado)}
        <span className="ml-1 text-lg font-medium text-tinta-suave">/ 05:00</span>
      </span>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (acabado) {
              alCambiar(0, false);
              return;
            }
            if (corriendo) {
              alCambiar(mostrado, false);
              return;
            }
            // Regla 4: arrancar uno para el otro. Lo hace el panel, que es
            // quien ve los dos.
            alArrancar();
          }}
          className={`flex-1 rounded-lg px-4 py-2.5 font-bold text-white ${
            acabado ? "bg-coral" : corriendo ? "bg-sol-300 text-tinta" : "bg-tinta"
          }`}
        >
          {acabado ? "Terminado · reiniciar" : corriendo ? "Pausar" : mostrado > 0 ? "Reanudar" : "Iniciar"}
        </button>
        <button
          type="button"
          onClick={() => alCambiar(0, false)}
          className="rounded-lg border border-hp-100 px-3.5 py-2.5 text-tinta-suave"
          title="Reiniciar"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Escribir la tarjeta de criterio**

Crea `components/orales/tarjeta-criterio.tsx`:

```tsx
"use client";

import type { Criterio } from "@/lib/orales/criterios";
import { fmtNota } from "@/lib/orales/formato";
import { ajustarNota } from "@/lib/orales/reglas";

export default function TarjetaCriterio({
  criterio,
  nota,
  comentario,
  frases,
  alPuntuar,
  alComentar,
  alPulsarFrase,
}: {
  criterio: Criterio;
  nota: number | null;
  comentario: string;
  frases: string[];
  alPuntuar: (valor: number) => void;
  alComentar: (texto: string) => void;
  alPulsarFrase: (frase: string) => void;
}) {
  const puesta = nota !== null && nota !== undefined;

  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-start gap-x-5 gap-y-2 rounded-tarjeta border border-hp-100 border-l-4 bg-white p-5 border-l-${criterio.color}`}
    >
      <div>
        <div className="flex items-center gap-2.5 text-lg font-extrabold text-tinta">
          <span className="rounded bg-fondo px-2 py-0.5 font-mono text-xs">
            {criterio.romano}
          </span>
          {criterio.titulo}
        </div>
        <p className="text-xs text-tinta-suave">{criterio.descripcion}</p>
      </div>

      <div className="flex items-center gap-1 rounded-full bg-fondo px-1 py-1">
        <button
          type="button"
          disabled={!puesta || nota <= 0}
          onClick={() => alPuntuar(ajustarNota(nota, -1, criterio.maximo))}
          className="h-7 w-7 rounded-full text-lg font-bold text-tinta-suave disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-9 text-center font-extrabold tabular-nums text-tinta">
          {puesta ? fmtNota(nota) : "—"}
        </span>
        <span className="pr-2 text-xs font-semibold text-tinta-suave">
          / {fmtNota(criterio.maximo)}
        </span>
        <button
          type="button"
          disabled={puesta && nota >= criterio.maximo}
          onClick={() => alPuntuar(ajustarNota(puesta ? nota : null, 1, criterio.maximo))}
          className="h-7 w-7 rounded-full text-lg font-bold text-tinta-suave disabled:opacity-30"
        >
          +
        </button>
      </div>

      <textarea
        value={comentario}
        onChange={(e) => alComentar(e.target.value)}
        placeholder={`Comentarios sobre ${criterio.titulo.toLowerCase()}…`}
        className="col-span-2 min-h-14 w-full rounded-lg border border-hp-100 bg-fondo p-3 text-sm"
      />

      <div className="col-span-2 flex flex-wrap gap-1.5">
        {criterio.frases.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => alPulsarFrase(f)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              frases.includes(f)
                ? "border-tinta bg-tinta text-white"
                : "border-hp-100 bg-white text-tinta-suave"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Ojo con Tailwind v4 y `border-l-${criterio.color}`:** las clases generadas al vuelo no existen si el compilador no las ve escritas. Si el borde sale sin color, cambia `color` por una clase completa en `criterios.ts` (`"border-l-bloque1"`, etc.) o pásalo por `style={{ borderLeftColor: "var(--color-bloque1)" }}`. Compruébalo en pantalla antes de dar la tarea por buena.

- [ ] **Step 3: Escribir el panel**

Crea `components/orales/panel.tsx`. Es el que junta todo y guarda.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CRITERIOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";
import { calcularTotal, fmtTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";
import { guardarEvaluacion } from "@/lib/acciones-orales";
import Cronometro from "@/components/orales/cronometro";
import TarjetaCriterio from "@/components/orales/tarjeta-criterio";
import ParrillaSujets from "@/components/orales/parrilla-sujets";
import type { SujetoDeParrilla } from "@/components/orales/parrilla-sujets";

type Estado = {
  sujetoId: string | null;
  notas: Notas;
  comentarios: Record<string, string>;
  frases: Record<string, string[]>;
  preguntadas: number[];
  segundosEoc: number;
  segundosEoi: number;
};

export default function Panel({
  turnoId,
  nombre,
  meta,
  sujetos,
  inicial,
}: {
  turnoId: string;
  nombre: string;
  meta: string[];
  sujetos: SujetoDeParrilla[];
  inicial: Estado;
}) {
  const [estado, setEstado] = useState<Estado>(inicial);
  const [corriendo, setCorriendo] = useState<"eoc" | "eoi" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al cambiar de estudiante el componente se remonta con otro turnoId:
  // hay que soltar el estado viejo o el panel enseñaría las notas del
  // anterior mientras llega el guardado.
  useEffect(() => {
    setEstado(inicial);
    setCorriendo(null);
  }, [turnoId, inicial]);

  /** Guarda medio segundo después del último cambio, como el original. */
  function guardar(siguiente: Estado) {
    setEstado(siguiente);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      const fallo = await guardarEvaluacion({ turnoId, ...siguiente });
      setError(fallo?.error ?? null);
    }, 500);
  }

  const total = calcularTotal(estado.notas);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-4 border-b border-hp-100 pb-4">
        <h2 className="text-2xl font-extrabold text-tinta">{nombre}</h2>
        <div className="flex flex-wrap gap-1.5">
          {meta.map((m) => (
            <span
              key={m}
              className="rounded-full border border-hp-100 bg-fondo px-2.5 py-1 text-xs font-semibold text-tinta-suave"
            >
              {m}
            </span>
          ))}
        </div>
        <div className="ml-auto text-right">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-tinta-suave">
            Nota /20
          </span>
          <span className="text-3xl font-extrabold tabular-nums text-tinta">
            {fmtTotal(total)}
            <span className="text-base font-semibold text-tinta-suave"> / 20</span>
          </span>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-coral/15 px-4 py-2 text-sm font-semibold text-coral">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Cronometro
          romano="I"
          etiqueta="Expresión oral en continuo"
          sub="EOC · 5 min · el alumno habla solo"
          segundos={estado.segundosEoc}
          corriendo={corriendo === "eoc"}
          alArrancar={() => setCorriendo("eoc")}
          alCambiar={(s, sigue) => {
            setCorriendo(sigue ? "eoc" : null);
            guardar({ ...estado, segundosEoc: s });
          }}
        />
        <Cronometro
          romano="II"
          etiqueta="Expresión oral en interacción"
          sub="EOI · 5 min · diálogo con el examinador"
          segundos={estado.segundosEoi}
          corriendo={corriendo === "eoi"}
          alArrancar={() => setCorriendo("eoi")}
          alCambiar={(s, sigue) => {
            setCorriendo(sigue ? "eoi" : null);
            guardar({ ...estado, segundosEoi: s });
          }}
        />
      </div>

      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
        Documento elegido
      </h3>
      <ParrillaSujets
        sujetos={sujetos}
        elegidoId={estado.sujetoId}
        preguntadas={estado.preguntadas}
        alElegir={(id) => {
          // Regla 4: cambiar de sujet también para los cronómetros.
          setCorriendo(null);
          guardar({ ...estado, sujetoId: id });
        }}
        alPreguntar={(i) =>
          guardar({
            ...estado,
            preguntadas: estado.preguntadas.includes(i)
              ? estado.preguntadas.filter((x) => x !== i)
              : [...estado.preguntadas, i],
          })
        }
      />

      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
        Baremo · 5 criterios / 20 puntos
      </h3>
      <div className="space-y-3.5">
        {CRITERIOS.map((c) => (
          <TarjetaCriterio
            key={c.key}
            criterio={c}
            nota={estado.notas[c.key] ?? null}
            comentario={estado.comentarios[c.key] ?? ""}
            frases={estado.frases[c.key] ?? []}
            alPuntuar={(v) =>
              guardar({ ...estado, notas: { ...estado.notas, [c.key]: v } })
            }
            alComentar={(t) =>
              guardar({ ...estado, comentarios: { ...estado.comentarios, [c.key]: t } })
            }
            alPulsarFrase={(f) => {
              const activas = estado.frases[c.key] ?? [];
              const encendida = activas.includes(f);
              const texto = estado.comentarios[c.key] ?? "";
              // Encender una frase la escribe en el comentario; apagarla no
              // borra el texto, que a esas alturas el profesor ya lo tocó.
              const nuevoTexto =
                !encendida && !texto.includes(f)
                  ? texto
                    ? `${texto.replace(/\s+$/, "")} · ${f}`
                    : f
                  : texto;
              guardar({
                ...estado,
                frases: {
                  ...estado.frases,
                  [c.key]: encendida ? activas.filter((x) => x !== f) : [...activas, f],
                },
                comentarios: { ...estado.comentarios, [c.key]: nuevoTexto },
              });
            }}
          />
        ))}
      </div>

      <div className="rounded-tarjeta border border-hp-100 bg-white p-5">
        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
          Comentario general
        </h3>
        <textarea
          value={estado.comentarios.general ?? ""}
          onChange={(e) =>
            guardar({
              ...estado,
              comentarios: { ...estado.comentarios, general: e.target.value },
            })
          }
          placeholder="Apreciación global, consejos, puntos a trabajar…"
          className="mt-2 min-h-24 w-full rounded-lg border border-hp-100 bg-fondo p-3 text-sm"
        />
      </div>
    </div>
  );
}
```

Nota: `ClaveCriterio` se importa para tipar `estado.notas`; si el `tsc` avisa de que no se usa, quítalo del import en vez de silenciar la regla.

- [ ] **Step 4: Enganchar el panel en la página**

En `app/(app)/profe/orales/[id]/page.tsx`, sustituye el `<p>` de «Elige a alguien…» por la carga del turno activo y el panel:

```tsx
  const activo = turnoActivo
    ? await prisma.turno.findFirst({
        where: { id: turnoActivo, convocatoriaId: id },
        select: {
          id: true,
          dia: true,
          preparacion: true,
          hora: true,
          sala: true,
          estudiante: { select: { firstName: true, lastName: true, email: true } },
          evaluacion: {
            select: {
              sujetoId: true,
              notas: true,
              comentarios: true,
              frases: true,
              preguntadas: true,
              segundosEoc: true,
              segundosEoi: true,
            },
          },
        },
      })
    : null;

  const sujetos = await prisma.sujeto.findMany({
    where: { convocatoriaId: id },
    orderBy: { numero: "asc" },
    select: {
      id: true, numero: true, eje: true, titulo: true, descripcion: true,
      fuente: true, url: true, preguntas: true, imagenId: true,
    },
  });
```

Y en el JSX, donde iba el hueco:

```tsx
          {activo && activo.estudiante ? (
            <Panel
              turnoId={activo.id}
              nombre={[activo.estudiante.lastName, activo.estudiante.firstName]
                .filter(Boolean)
                .join(" ") || activo.estudiante.email}
              meta={[
                activo.dia,
                activo.preparacion ? `Prép. ${activo.preparacion}` : "",
                `Pasaje ${activo.hora}`,
                activo.sala ?? "",
              ].filter(Boolean)}
              sujetos={sujetos}
              inicial={{
                sujetoId: activo.evaluacion?.sujetoId ?? null,
                notas: (activo.evaluacion?.notas as Notas) ?? {},
                comentarios: (activo.evaluacion?.comentarios as Record<string, string>) ?? {},
                frases: (activo.evaluacion?.frases as Record<string, string[]>) ?? {},
                preguntadas: activo.evaluacion?.preguntadas ?? [],
                segundosEoc: activo.evaluacion?.segundosEoc ?? 0,
                segundosEoi: activo.evaluacion?.segundosEoi ?? 0,
              }}
            />
          ) : turnos.length === 0 ? (
            /* … el formulario de pegar el horario, tal cual estaba … */
          ) : (
            <p className="text-sm text-tinta-suave">
              Elige a alguien en la lista para empezar a evaluar.
            </p>
          )}
```

- [ ] **Step 5: Comprobar tipos, estilo y pantalla**

```bash
npx tsc --noEmit && npm run lint && npm run fresh
```

A mano, y esto no lo ve ningún script:
1. Arranca la EOC, arranca la EOI y comprueba que **la EOC se para y guarda su tiempo**.
2. Deja uno llegar a 05:00: se detiene solo y el botón pasa a «Terminado · reiniciar».
3. Pon las cinco notas y comprueba que el `+` se apaga en el máximo de cada criterio y el `−` en cero.
4. Enciende una frase: se escribe en el comentario. Apágala: el texto no desaparece.
5. Marca dos preguntas de la EOI, cambia de estudiante, vuelve: siguen marcadas.
6. Recarga la página entera: todo sigue donde estaba.

- [ ] **Step 6: Commit**

```bash
git add components/orales "app/(app)/profe/orales/[id]/page.tsx"
git commit -m "El panel del examen: dos cronómetros, cinco criterios y autoguardado"
```

---

### Task 9: El CSV para el liceo

**Files:**
- Create: `lib/orales/csv.ts`
- Create: `app/(app)/profe/orales/[id]/csv/route.ts`
- Modify: `scripts/verificar-orales.ts`
- Modify: `app/(app)/profe/orales/[id]/page.tsx` (enlace de descarga en la cabecera)

**Interfaces:**
- Consumes: `CRITERIOS`, `calcularTotal`, `fmtNota`, `fmtTotal`.
- Produces:
  - `type FilaCsv = { dia: string; hora: string; apellido: string; nombre: string; sala: string; sujetNumero: number | null; sujetTitulo: string; eje: string; segundosEoc: number; segundosEoi: number; notas: Notas; comentarios: Record<string, string> }`
  - `celda(valor: unknown): string`
  - `construirCsv(filas: FilaCsv[]): string` — devuelve el texto **con BOM** al principio

- [ ] **Step 1: Escribir las afirmaciones que fallan**

En `scripts/verificar-orales.ts`, una función `comprobarCsv()` llamada desde `main()`:

```ts
import { celda, construirCsv } from "@/lib/orales/csv";

function comprobarCsv() {
  afirmar(celda("hola") === "hola", "un texto normal va sin comillas");
  afirmar(celda('dijo "sí"') === '"dijo ""sí"""', "las comillas se duplican y la celda se entrecomilla");
  afirmar(celda("uno, dos") === '"uno, dos"', "una coma obliga a entrecomillar");
  afirmar(celda("uno\ndos") === '"uno\ndos"', "un salto de línea obliga a entrecomillar");
  afirmar(celda(null) === "", "un vacío es una celda vacía, no «null»");

  const csv = construirCsv([
    {
      dia: "Mercredi 20/05", hora: "08h15", apellido: "HERMITE", nombre: "Rose",
      sala: "CDI", sujetNumero: 7, sujetTitulo: "Mafalda", eje: "Arte y poder",
      segundosEoc: 287, segundosEoi: 300,
      notas: { lengua: 3, fluidez: 1.5, contenido: 4, organizacion: 3.5, oratoria: 3 },
      comentarios: { general: "Bien, con un «pero»" },
    },
  ]);

  afirmar(csv.startsWith("﻿"), "el CSV empieza por el BOM, o Excel se come las tildes");
  const lineas = csv.split("\r\n");
  afirmar(lineas[0].split(",").length === 22, "la cabecera tiene veintidós columnas");
  afirmar(lineas.length === 2, "una fila de datos por estudiante");
  afirmar(lineas[1].includes("15,0") === false, "el total del CSV va con punto decimal, no con coma");
  afirmar(lineas[1].includes('"Bien, con un «pero»"'), "el comentario con coma sale entrecomillado");
}
```

**Ojo:** el total del CSV va con **punto** decimal aunque la pantalla use coma. Una coma decimal dentro de un CSV separado por comas es una celda partida en dos en cuanto alguien lo abra sin entrecomillar. Es la única cifra del proyecto que no usa `fmtTotal`.

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: FALLA al resolver `@/lib/orales/csv`.

- [ ] **Step 3: Escribir el CSV**

Crea `lib/orales/csv.ts`:

```ts
import { CRITERIOS } from "@/lib/orales/criterios";
import { calcularTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export type FilaCsv = {
  dia: string;
  hora: string;
  apellido: string;
  nombre: string;
  sala: string;
  sujetNumero: number | null;
  sujetTitulo: string;
  eje: string;
  segundosEoc: number;
  segundosEoi: number;
  notas: Notas;
  comentarios: Record<string, string>;
};

/** Una celda. Entrecomilla en cuanto aparece algo que rompería la fila. */
export function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (/[",\r\n;]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/**
 * Las veintidós columnas que espera el liceo, con el BOM delante.
 *
 * El BOM no es capricho: sin él, Excel en Windows abre el archivo en su
 * página de códigos y «Philomène» sale como «PhilomÃ¨ne».
 *
 * Las filas de pausa no llegan aquí: las filtra quien llama, porque una
 * pausa no es un estudiante sin nota, es que no hay nadie.
 */
export function construirCsv(filas: FilaCsv[]): string {
  const cabecera = [
    "Día", "Hora pasaje", "Apellido", "Nombre", "Sala",
    "Doc nº", "Doc título", "Eje",
    "EOC seg", "EOI seg",
    ...CRITERIOS.flatMap((c) => [`${c.titulo} /${c.maximo}`, `${c.titulo} — comentario`]),
    "Nota /20", "Comentario general",
  ];

  const cuerpo = filas.map((f) => [
    f.dia, f.hora, f.apellido, f.nombre, f.sala,
    f.sujetNumero ?? "", f.sujetTitulo, f.eje,
    Math.round(f.segundosEoc), Math.round(f.segundosEoi),
    ...CRITERIOS.flatMap((c) => [
      f.notas[c.key] ?? "",
      f.comentarios[c.key] ?? "",
    ]),
    // Punto decimal a propósito: una coma decimal en un CSV separado por
    // comas parte la celda en dos en cuanto alguien lo abre.
    calcularTotal(f.notas).toFixed(1),
    f.comentarios.general ?? "",
  ]);

  return (
    "﻿" +
    [cabecera, ...cuerpo].map((fila) => fila.map(celda).join(",")).join("\r\n")
  );
}
```

- [ ] **Step 4: Ejecutar y verlo pasar**

Run: `npx tsx scripts/verificar-orales.ts`
Expected: las seis líneas del CSV en `OK:`.

- [ ] **Step 5: Escribir la ruta de descarga**

Crea `app/(app)/profe/orales/[id]/csv/route.ts`. Lee la guía de rutas de esta versión de Next antes.

```ts
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { construirCsv } from "@/lib/orales/csv";
import type { FilaCsv } from "@/lib/orales/csv";
import type { Notas } from "@/lib/orales/formato";

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const usuario = await exigirProfesor();

  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id },
    select: { nombre: true, profesorId: true },
  });
  if (!convocatoria) return new Response("No encontrado", { status: 404 });
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    return new Response("Sin permiso", { status: 403 });
  }

  const turnos = await prisma.turno.findMany({
    // Las pausas fuera: no son un estudiante sin nota.
    where: { convocatoriaId: id, NOT: { estudianteId: null } },
    orderBy: { orden: "asc" },
    select: {
      dia: true, hora: true, sala: true,
      estudiante: { select: { firstName: true, lastName: true, email: true } },
      evaluacion: {
        select: {
          notas: true, comentarios: true, segundosEoc: true, segundosEoi: true,
          sujeto: { select: { numero: true, titulo: true, eje: true } },
        },
      },
    },
  });

  const filas: FilaCsv[] = turnos.map((t) => ({
    dia: t.dia,
    hora: t.hora,
    apellido: t.estudiante?.lastName ?? "",
    nombre: t.estudiante?.firstName ?? t.estudiante?.email ?? "",
    sala: t.sala ?? "",
    sujetNumero: t.evaluacion?.sujeto?.numero ?? null,
    sujetTitulo: t.evaluacion?.sujeto?.titulo ?? "",
    eje: t.evaluacion?.sujeto?.eje ?? "",
    segundosEoc: t.evaluacion?.segundosEoc ?? 0,
    segundosEoi: t.evaluacion?.segundosEoi ?? 0,
    notas: (t.evaluacion?.notas as Notas) ?? {},
    comentarios: (t.evaluacion?.comentarios as Record<string, string>) ?? {},
  }));

  const nombre = convocatoria.nombre.replace(/[^\w-]+/g, "_").slice(0, 60);
  return new Response(construirCsv(filas), {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}.csv"`,
    },
  });
}
```

- [ ] **Step 6: Poner el enlace en la cabecera**

En `app/(app)/profe/orales/[id]/page.tsx`, junto al enlace de «Sujets»:

```tsx
        <a href={`/profe/orales/${id}/csv`} className="text-sm font-bold text-hp-400">
          Exportar CSV
        </a>
```

- [ ] **Step 7: Comprobar tipos, estilo y descarga**

```bash
npx tsc --noEmit && npm run lint && npm run fresh
```

A mano: descarga el CSV con dos estudiantes evaluados y una pausa en el horario. Ábrelo en Excel o Numbers y comprueba que las tildes salen bien, que la pausa no aparece y que un comentario con comas ocupa una sola celda.

- [ ] **Step 8: Commit**

```bash
git add lib/orales/csv.ts "app/(app)/profe/orales/[id]/csv/route.ts" "app/(app)/profe/orales/[id]/page.tsx" scripts/verificar-orales.ts
git commit -m "El CSV del liceo: veintidós columnas, con BOM y sin pausas"
```

---

### Task 10: La ficha imprimible

**Files:**
- Create: `app/(app)/profe/orales/evaluacion/[id]/ficha/page.tsx`
- Modify: `app/globals.css` (reglas de `@media print` para la ficha)

**Interfaces:**
- Consumes: `CRITERIOS`, `fmtTiempo`, `fmtNota`, `fmtTotal`, `calcularTotal`.
- Produces: la ruta `/profe/orales/evaluacion/[id]/ficha`, enlazada desde el panel.

- [ ] **Step 1: Escribir la ficha**

Una página propia para poder guardarla en PDF o enlazarla. Sin cabecera de la aplicación, sin barra lateral.

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { CRITERIOS } from "@/lib/orales/criterios";
import { calcularTotal, fmtNota, fmtTiempo, fmtTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export const dynamic = "force-dynamic";

export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirProfesor();

  const evaluacion = await prisma.evaluacionOral.findUnique({
    where: { id },
    select: {
      notas: true,
      comentarios: true,
      segundosEoc: true,
      segundosEoi: true,
      sujeto: { select: { numero: true, titulo: true, eje: true, imagenId: true } },
      turno: {
        select: {
          dia: true, hora: true, sala: true,
          convocatoria: { select: { nombre: true, profesorId: true } },
          estudiante: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
  if (!evaluacion) notFound();
  if (
    evaluacion.turno.convocatoria.profesorId !== usuario.id &&
    usuario.role !== "ADMIN"
  ) {
    notFound();
  }

  const notas = (evaluacion.notas as Notas) ?? {};
  const comentarios = (evaluacion.comentarios as Record<string, string>) ?? {};
  const alumno = evaluacion.turno.estudiante;

  return (
    <main className="ficha mx-auto max-w-[210mm] bg-white p-8 text-tinta">
      <header className="flex items-end justify-between border-b border-hp-100 pb-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {[alumno?.lastName, alumno?.firstName].filter(Boolean).join(" ") ??
              alumno?.email}
          </h1>
          <p className="text-xs text-tinta-suave">
            {evaluacion.turno.convocatoria.nombre} · {evaluacion.turno.dia}{" "}
            {evaluacion.turno.hora} {evaluacion.turno.sala ?? ""}
          </p>
        </div>
        <span className="text-3xl font-extrabold tabular-nums">
          {fmtTotal(calcularTotal(notas))}
          <span className="text-base font-semibold text-tinta-suave"> / 20</span>
        </span>
      </header>

      {/* La tira de tiempos. En el HTML original se perdía al imprimir:
          una regla `display:none` de pantalla ganaba a la de @media print. */}
      <div className="tiempos mt-3 flex gap-6 text-sm">
        <span>EOC <b className="font-mono">{fmtTiempo(evaluacion.segundosEoc ?? 0)}</b></span>
        <span>EOI <b className="font-mono">{fmtTiempo(evaluacion.segundosEoi ?? 0)}</b></span>
      </div>

      {evaluacion.sujeto && (
        <section className="mt-4 flex gap-4">
          {evaluacion.sujeto.imagenId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/archivos/${evaluacion.sujeto.imagenId}`}
              alt=""
              className="w-28 rounded border border-hp-100"
            />
          )}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-tinta-suave">
              {evaluacion.sujeto.eje} · Doc. {evaluacion.sujeto.numero}
            </p>
            <p className="font-bold">{evaluacion.sujeto.titulo}</p>
          </div>
        </section>
      )}

      <section className="mt-4 space-y-2">
        {CRITERIOS.map((c) => (
          <div
            key={c.key}
            className="break-inside-avoid border-l-4 border-hp-100 pl-3"
            style={{ borderLeftColor: `var(--color-${c.color})` }}
          >
            <p className="text-sm font-bold">
              {c.romano} {c.titulo}{" "}
              <span className="tabular-nums">
                {notas[c.key] !== undefined ? fmtNota(notas[c.key] as number) : "—"} /{" "}
                {fmtNota(c.maximo)}
              </span>
            </p>
            {comentarios[c.key] && (
              <p className="text-xs text-tinta-suave">{comentarios[c.key]}</p>
            )}
          </div>
        ))}
      </section>

      {comentarios.general && (
        <section className="mt-4 break-inside-avoid border-l-4 pl-3" style={{ borderLeftColor: "var(--color-sol-300)" }}>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-tinta-suave">
            Comentario general
          </p>
          <p className="text-sm">{comentarios.general}</p>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Añadir las reglas de impresión**

Al final de `app/globals.css`:

```css
/* La ficha del examen oral en A4. Aquí no se esconde ningún bloque de
   contenido: en el HTML original la tira de tiempos desaparecía al
   imprimir porque entraba en la misma lista de `display:none` que la
   barra de herramientas. */
@media print {
  body { background: #fff; }
  .ficha { max-width: none; padding: 0; }
  .ficha section, .ficha div { break-inside: avoid; }
}
```

- [ ] **Step 3: Enlazar la ficha desde el panel**

En `app/(app)/profe/orales/[id]/page.tsx`, dentro del bloque del turno activo, sobre el `<Panel>`. Hace falta el id de la evaluación, así que añádelo al `select` de `activo`: `evaluacion: { select: { id: true, … } }`.

```tsx
              {activo.evaluacion && (
                <a
                  href={`/profe/orales/evaluacion/${activo.evaluacion.id}/ficha`}
                  target="_blank"
                  className="text-sm font-bold text-hp-400"
                >
                  Ver la ficha ↗
                </a>
              )}
```

- [ ] **Step 4: Comprobar tipos, estilo e impresión**

```bash
npx tsc --noEmit && npm run lint && npm run fresh
```

A mano, y esto es lo que un script no puede ver: abre la ficha de alguien evaluado, dale a imprimir y comprueba en la vista previa que **cabe en una página**, que **la tira de tiempos EOC/EOI aparece** y que ningún criterio se parte entre dos páginas.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/profe/orales/evaluacion/[id]/ficha/page.tsx" app/globals.css "app/(app)/profe/orales/[id]/page.tsx"
git commit -m "La ficha del examen en A4, con la tira de tiempos que el original perdía"
```

---

## Cierre de la tanda

- [ ] `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-orales.ts` en verde, y el script deja la base como la encontró (compruébalo con `prisma.convocatoria.count()` antes y después).
- [ ] La comprobación a mano completa: convocar, pegar el horario, crear tres sujets, evaluar a alguien de principio a fin con los cronómetros corriendo, descargar el CSV e imprimir la ficha.
- [ ] Anota en el cuaderno de la rama qué quedó fuera: el viaje del `.json`, el audio, la transcripción y `TAREA_ORAL`.
