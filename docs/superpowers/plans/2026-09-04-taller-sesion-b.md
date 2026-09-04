# El taller del examen, sesión B: la revisión de una tarea

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor abra cada tarea rellenada con la página original al lado, corrija el texto, las preguntas y las correctas ítem a ítem sobre las piezas de la carcasa, la pruebe como estudiante, y la marque revisada solo cuando no quede nada rojo.

**Architecture:** Una pantalla nueva `/dele/taller/[id]/tarea/[prueba]/[n]` a dos columnas: las páginas asignadas a la izquierda y un editor por ítems a la derecha (`components/taller/editor-tarea-*.tsx`, sobre `Campo`/`Boton`/`Tarjeta`, sin las clases sueltas `campo`/`area` de los editores viejos). Las reglas viven en `lib/taller/revision.ts` (guardar con re-validación y re-cálculo de avisos; marcar revisada con sus guardas) y en `lib/taller/estados.ts` (nombres y tonos de los estados, compartidos por la lista, la mesa y la tarea). «Ver como estudiante» reutiliza la `Previsualizacion` existente, que ya corrige con el motor real sin crear ninguna asignación.

**Tech Stack:** Next.js 16.2 App Router, React 19 (`useTransition`), Prisma 7, zod 4, Tailwind 4 con las piezas de `components/ui/`.

**Spec:** `docs/superpowers/specs/2026-09-03-taller-dele-design.md`, sección 3. **Desviación declarada:** la spec dice que «Ver como estudiante» abre `/pasos/[pasoId]` con una asignación de prueba `dePrueba`; este plan usa `components/recursos/previsualizacion.tsx` embebida (mismo motor, misma corrección, cero filas en la base y ningún listado que excluir). La guarda de «audio presente» en la auditiva se cumple con un `Bloque AUDIO` en el paso (hoy se sube desde la ficha del paso; la sesión C lo trae a la tarea).

## Global Constraints

- «El modelo del estudiante no cambia»: sin cambios en `prisma/schema.prisma` en esta sesión.
- Solo `PROFESOR`/`ADMIN` (el layout de `/dele/taller` ya da 404 al resto).
- Toda pantalla nueva sobre las piezas de `components/ui/`; `verificar-piezas.ts` en «Todo en orden» **sin excepción nueva**; los editores nuevos no importan `campo`/`area` de `components/recursos/campos.tsx`.
- Textos en español, en la voz del sitio (tú, sin jerga).
- Nada llega a `Ejercicio.datos` sin pasar `revisarDatos` (`lib/recursos.ts`).
- Estados de tarea: `VACIA → RELLENADA → REVISADA`; editar una `REVISADA` la devuelve a `RELLENADA` y lo dice.
- «Marcar revisada» exige: cero avisos, todos los ítems con correcta (opción) o con `derecha` no vacía (relacionar), cero imágenes pedidas sin archivo, y en `CO` un `Bloque AUDIO` en el paso.
- `verificar-taller.ts` conserva su disciplina: la base queda como se encontró (cuentas antes/después).
- Commits con los dos trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_011MTFjk2FcQUCsqhsbMpp6C`.
- Antes de cada commit: `npx tsc --noEmit`, `npm run lint` (0 avisos), `npx tsx scripts/verificar-piezas.ts`, `npx tsx scripts/verificar-carcasa.ts`, `npx tsx scripts/verificar-taller.ts`.

---

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `lib/taller/estados.ts` | `NOMBRE_ESTADO_EXAMEN`, `TONO_ESTADO_EXAMEN`, `NOMBRE_ESTADO_TAREA`, `TONO_ESTADO_TAREA` (sustituyen los mapas duplicados de la lista y la mesa) |
| `lib/taller/revision.ts` | `guardarTarea`, `motivosParaNoRevisar`, `marcarRevisada`, `quitarImagenPedida`, `contrastarClaveGuardada` |
| `lib/acciones-taller.ts` | + `guardarTareaAccion`, `marcarRevisadaAccion`, `quitarImagenPedidaAccion` |
| `lib/taller/consultas.ts` | + `tareaPorNumero(examenId, prueba, numero)` |
| `components/taller/editor-tarea-opcion.tsx` | editor por ítems de `opcion` sobre piezas |
| `components/taller/editor-tarea-relacionar.tsx` | editor por ítems de `relacionar` sobre piezas |
| `components/taller/revision-tarea.tsx` | cliente: estado, dudas/avisos, Guardar, Volver a rellenar, Marcar revisada, Ver como estudiante |
| `app/(app)/dele/taller/[id]/tarea/[prueba]/[n]/page.tsx` | la pantalla a dos columnas |
| `components/taller/tarjeta-tarea.tsx` | «Abrir» → la pantalla nueva |
| `app/(app)/dele/taller/page.tsx`, `[id]/page.tsx` | usan `lib/taller/estados.ts` |
| `scripts/verificar-taller.ts` | + guardar, guardas de revisar, mutación |

---

### Task 1: Las reglas de la revisión

**Files:**
- Create: `lib/taller/estados.ts`
- Create: `lib/taller/revision.ts`
- Modify: `lib/taller/consultas.ts` (+ `tareaPorNumero`)
- Modify: `lib/acciones-taller.ts` (+ tres acciones)
- Modify: `app/(app)/dele/taller/page.tsx`, `app/(app)/dele/taller/[id]/page.tsx` (usar `estados.ts`, borrar los mapas locales)
- Modify: `scripts/verificar-taller.ts`

**Interfaces:**
- Consumes: `tareaDe(id)` (`TareaCompleta` con `examen`, `ejercicio`, `paso.bloques`, `avisos`, `dudas`, `imagenesPedidas`, `claveOficial`, `estado`), `revisarDatos`, `avisosDelMapa` y `contrastarClave` (`lib/taller/guardar-relleno.ts`), `tareaDe` del mapa (`lib/dele`).
- Produces: `guardarTarea(tareaId, datos, bloque): Promise<ResultadoGuardado>`, `motivosParaNoRevisar(tarea): string[]`, `marcarRevisada(tareaId): Promise<{ ok: true } | { ok: false; motivos: string[] }>`, `quitarImagenPedida(tareaId, indice)`, `tareaPorNumero(examenId, prueba, numero)`; las acciones `guardarTareaAccion(tareaId, datosJson, bloque)`, `marcarRevisadaAccion(tareaId)`, `quitarImagenPedidaAccion(formData)`.

- [ ] **Step 1: `lib/taller/estados.ts`**

```ts
import type { TonoEtiqueta } from "@/components/ui/etiqueta";

export const NOMBRE_ESTADO_EXAMEN: Record<string, string> = {
  EN_CONSTRUCCION: "En construcción",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};
export const TONO_ESTADO_EXAMEN: Record<string, TonoEtiqueta> = {
  EN_CONSTRUCCION: "sol",
  PUBLICADO: "verde",
  ARCHIVADO: "neutro",
};
export const NOMBRE_ESTADO_TAREA: Record<string, string> = {
  VACIA: "Vacía",
  RELLENADA: "Rellenada",
  REVISADA: "Revisada",
};
export const TONO_ESTADO_TAREA: Record<string, TonoEtiqueta> = {
  VACIA: "neutro",
  RELLENADA: "sol",
  REVISADA: "verde",
};
```

Sustituir en `app/(app)/dele/taller/page.tsx` y `[id]/page.tsx` los `TONO`/`NOMBRE` locales por estos (y en `components/taller/tarjeta-tarea.tsx` el `ESTADO` local por `NOMBRE_ESTADO_TAREA`/`TONO_ESTADO_TAREA`). Comprobar con `grep -rn 'const TONO\|const NOMBRE\|const ESTADO' app components/taller` que no queda ninguno.

- [ ] **Step 2: `tareaPorNumero`**

En `lib/taller/consultas.ts`:

```ts
/** La tarea por su sitio en el examen; null si el examen o la tarea no existen. */
export async function tareaPorNumero(examenId: string, prueba: "CE" | "CO", numero: number) {
  const fila = await prisma.tareaDeExamen.findUnique({
    where: { examenId_prueba_numero: { examenId, prueba, numero } },
    select: { id: true },
  });
  return fila ? tareaDe(fila.id) : null;
}
```

- [ ] **Step 3: `lib/taller/revision.ts`**

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { revisarDatos } from "@/lib/recursos";
import { avisosDelMapa, contrastarClave } from "@/lib/taller/guardar-relleno";
import { tareaDe, type TareaCompleta } from "@/lib/taller/consultas";

export type ResultadoGuardado =
  | { ok: true; avisos: string[]; volvioARellenada: boolean }
  | { ok: false; error: string };

type ImagenPedida = { pregunta: string; opcion: number | null; para: string; archivoId: string | null };

/**
 * La clave oficial contra lo que hay guardado. Solo en `opcion`: la IA
 * devolvió las letras por pregunta, y esas se pueden comparar con
 * `correctas`. En `relacionar` hacía falta `textosConLetra`, que no se
 * guarda, así que el aviso de la clave desaparece en el primer guardado:
 * el profesor acaba de mirar las parejas con la página delante.
 */
export function contrastarClaveGuardada(datos: unknown, claveOficial: unknown, motor: "opcion" | "relacionar"): string[] {
  if (motor !== "opcion" || !claveOficial || typeof claveOficial !== "object") return [];
  return contrastarClave(
    { bloque: null, ejercicio: datos, textosConLetra: [], imagenesPedidas: [], dudas: [], claveOficial: claveOficial as Record<string, string> },
    "opcion",
  );
}

/**
 * Guarda lo que el profesor corrigió: `datos` del ejercicio y el estímulo
 * (`bloque`, markdown o null). Vuelve a validar y a calcular los avisos,
 * y si la tarea estaba revisada la devuelve a rellenada, porque lo revisado
 * ya no es lo que hay.
 */
export async function guardarTarea(tareaId: string, datos: unknown, bloque: string | null): Promise<ResultadoGuardado> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { ok: false, error: "El mapa no describe esta tarea." };

  const revision = revisarDatos(datos);
  if ("error" in revision) return { ok: false, error: revision.error };
  if (revision.tipo !== tarea.ejercicio.tipo) return { ok: false, error: "El ejercicio es de otro tipo del que espera la tarea." };

  const avisos = [
    ...avisosDelMapa(delMapa, datos),
    ...contrastarClaveGuardada(datos, tarea.claveOficial, delMapa.motor as "opcion" | "relacionar"),
  ];
  const volvioARellenada = tarea.estado === "REVISADA";
  const texto = bloque?.trim() ? bloque.trim() : null;

  await prisma.$transaction(async (tx) => {
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "TEXTO" } });
    if (texto) await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "TEXTO", texto, orden: 1 } });
    await tx.tareaDeExamen.update({
      where: { id: tareaId },
      data: { avisos, ...(volvioARellenada ? { estado: "RELLENADA", revisadaEl: null } : {}) },
    });
  });
  return { ok: true, avisos, volvioARellenada };
}

function itemsSinRespuesta(datos: unknown, motor: string): number {
  const d = datos as { preguntas?: { correctas?: number[] }[]; parejas?: { derecha?: string }[] };
  if (motor === "relacionar") return (d.parejas ?? []).filter((p) => !p.derecha?.trim()).length;
  return (d.preguntas ?? []).filter((p) => !p.correctas || p.correctas.length === 0).length;
}

/** Por qué no se puede marcar revisada todavía. Vacío = se puede. */
export function motivosParaNoRevisar(tarea: TareaCompleta): string[] {
  const motivos: string[] = [];
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (tarea.estado === "VACIA") motivos.push("La tarea está vacía: rellénala con IA o a mano.");
  const avisos = (tarea.avisos as string[] | null) ?? [];
  if (avisos.length) motivos.push(`Quedan ${avisos.length} aviso(s) en rojo.`);
  const sinRespuesta = itemsSinRespuesta(tarea.ejercicio.datos, delMapa?.motor ?? "opcion");
  if (sinRespuesta) motivos.push(`${sinRespuesta} ítem(s) sin respuesta correcta.`);
  const pendientes = ((tarea.imagenesPedidas as ImagenPedida[] | null) ?? []).filter((i) => !i.archivoId).length;
  if (pendientes) motivos.push(`${pendientes} imagen(es) por subir.`);
  if (tarea.prueba === "CO" && !tarea.paso.bloques.some((b) => b.tipo === "AUDIO")) {
    motivos.push("Falta la grabación de la tarea (se sube desde la ficha del paso).");
  }
  return motivos;
}

export async function marcarRevisada(tareaId: string): Promise<{ ok: true } | { ok: false; motivos: string[] }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, motivos: ["Esa tarea ya no existe."] };
  const motivos = motivosParaNoRevisar(tarea);
  if (motivos.length) return { ok: false, motivos };
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { estado: "REVISADA", revisadaEl: new Date() } });
  return { ok: true };
}

/** Quita una petición de imagen que el profesor decide que no hace falta. */
export async function quitarImagenPedida(tareaId: string, indice: number): Promise<void> {
  const tarea = await prisma.tareaDeExamen.findUniqueOrThrow({ where: { id: tareaId }, select: { imagenesPedidas: true } });
  const lista = ((tarea.imagenesPedidas as ImagenPedida[] | null) ?? []).filter((_, i) => i !== indice);
  await prisma.tareaDeExamen.update({ where: { id: tareaId }, data: { imagenesPedidas: lista } });
}
```

- [ ] **Step 4: Las acciones**

En `lib/acciones-taller.ts`:

```ts
import { guardarTarea, marcarRevisada, quitarImagenPedida } from "@/lib/taller/revision";

export type EstadoGuardado = { error?: string; ok?: string; avisos?: string[] };

export async function guardarTareaAccion(tareaId: string, datosJson: string, bloque: string | null): Promise<EstadoGuardado> {
  await exigirProfesor();
  let datos: unknown;
  try { datos = JSON.parse(datosJson); } catch { return { error: "El contenido de la tarea no se pudo leer." }; }
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await guardarTarea(tareaId, datos, bloque);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.error };
  return { ok: r.volvioARellenada ? "Guardado. La tarea vuelve a «rellenada»: revísala otra vez." : "Guardado.", avisos: r.avisos };
}

export async function marcarRevisadaAccion(tareaId: string): Promise<EstadoGuardado> {
  await exigirProfesor();
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { error: "Esa tarea ya no existe." };
  const r = await marcarRevisada(tareaId);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
  if (!r.ok) return { error: r.motivos.join(" ") };
  return { ok: "Revisada." };
}

export async function quitarImagenPedidaAccion(formData: FormData): Promise<void> {
  await exigirProfesor();
  const tareaId = String(formData.get("tareaId") ?? "");
  const indice = Number(formData.get("indice"));
  const tarea = await tareaDe(tareaId);
  if (!tarea || !Number.isInteger(indice)) return;
  await quitarImagenPedida(tareaId, indice);
  revalidatePath(`/dele/taller/${tarea.examenId}`);
  revalidatePath(`/dele/taller/${tarea.examenId}/tarea/${tarea.prueba}/${tarea.numero}`);
}
```

- [ ] **Step 5: El script**

En `scripts/verificar-taller.ts`, tras las pruebas de `guardarRelleno` (la tarea CE 3 queda `RELLENADA` con el fixture malo: 5 preguntas y dos avisos), añadir:

```ts
// ─── La revisión ────────────────────────────────────────────────────
const { guardarTarea, marcarRevisada, motivosParaNoRevisar, quitarImagenPedida } = await import("@/lib/taller/revision");
const { tareaPorNumero } = await import("@/lib/taller/consultas");

const porNumero = await tareaPorNumero(examenId!, "CE", 3);
afirmar(porNumero !== null && porNumero.id === tareaCE3.id, "tareaPorNumero encuentra CE 3");
afirmar((await tareaPorNumero(examenId!, "CE", 9)) === null, "tareaPorNumero da null para una tarea que no existe");

// Guardar el fixture bueno a mano: los avisos del malo desaparecen.
const guardado = await guardarTarea(tareaCE3.id, bueno.ejercicio, "Un texto corregido por el profesor.");
afirmar(guardado.ok === true && guardado.avisos.length === 0, "guardarTarea con datos buenos deja cero avisos");
const trasGuardar = await tareaDe(tareaCE3.id);
afirmar((trasGuardar!.avisos as string[]).length === 0, "los avisos guardados se recalculan al guardar");
afirmar(trasGuardar!.paso.bloques.filter((b) => b.tipo === "TEXTO").length === 1 && trasGuardar!.paso.bloques.some((b) => b.texto === "Un texto corregido por el profesor."), "guardarTarea sustituye el bloque TEXTO");
afirmar(trasGuardar!.paso.bloques.some((b) => b.tipo === "AUDIO"), "guardarTarea no toca el bloque AUDIO");

const roto = await guardarTarea(tareaCE3.id, { ejercicio: "opcion" }, null);
afirmar(roto.ok === false, "guardarTarea rechaza datos que no validan");
afirmar(isDeepStrictEqual((await tareaDe(tareaCE3.id))!.ejercicio.datos, bueno.ejercicio), "y no cambia nada al rechazar");

// La clave oficial se sigue contrastando en opción tras editar.
const conCorrectaCambiada = { ...bueno.ejercicio, preguntas: (bueno.ejercicio as { preguntas: { correctas: number[] }[] }).preguntas.map((p, i) => (i === 0 ? { ...p, correctas: [(p.correctas[0] + 1) % 3] } : p)) };
const contrastado = await guardarTarea(tareaCE3.id, conCorrectaCambiada, null);
afirmar(contrastado.ok === true && contrastado.avisos.some((a) => a.includes("clave oficial")), "cambiar una correcta contra la clave oficial deja aviso");
await guardarTarea(tareaCE3.id, bueno.ejercicio, "Texto.");

// Marcar revisada: las guardas.
let motivos = motivosParaNoRevisar((await tareaDe(tareaCE3.id))!);
afirmar(motivos.length === 0, "CE 3 con datos buenos, sin avisos y con bloque se puede revisar");
const tareaCO1 = examen!.tareas.find((t) => t.prueba === "CO" && t.numero === 1)!;
motivos = motivosParaNoRevisar((await tareaDe(tareaCO1.id))!);
afirmar(motivos.some((m) => m.includes("vacía")), "una tarea vacía no se puede revisar");
afirmar(motivos.some((m) => m.includes("grabación")), "una auditiva sin AUDIO no se puede revisar");

await prisma.tareaDeExamen.update({ where: { id: tareaCE3.id }, data: { imagenesPedidas: [{ pregunta: "p1", opcion: 0, para: "una foto", archivoId: null }] } });
motivos = motivosParaNoRevisar((await tareaDe(tareaCE3.id))!);
afirmar(motivos.some((m) => m.includes("imagen")), "una imagen pedida sin subir impide revisar");
await quitarImagenPedida(tareaCE3.id, 0);
afirmar(motivosParaNoRevisar((await tareaDe(tareaCE3.id))!).length === 0, "quitar la imagen pedida desbloquea la revisión");

const revisada = await marcarRevisada(tareaCE3.id);
afirmar(revisada.ok === true && (await tareaDe(tareaCE3.id))!.estado === "REVISADA", "marcarRevisada deja la tarea REVISADA");
const negada = await marcarRevisada(tareaCO1.id);
afirmar(negada.ok === false && negada.motivos.length >= 2, "marcarRevisada se niega con motivos");

const reeditada = await guardarTarea(tareaCE3.id, bueno.ejercicio, "Otro texto.");
afirmar(reeditada.ok === true && reeditada.volvioARellenada && (await tareaDe(tareaCE3.id))!.estado === "RELLENADA", "editar una revisada la devuelve a RELLENADA");
```

Mutación obligatoria (hacerla a mano, registrar en el informe, y revertir): quitar en `motivosParaNoRevisar` la guarda de los avisos y correr el script → tiene que ponerse en rojo en «una tarea vacía no se puede revisar» o en «marcarRevisada se niega con motivos» (el fixture malo de CO no existe, así que para la mutación usar CE 3 con `avisos` puestos a mano: añadir antes una afirmación `afirmar(motivosParaNoRevisar({ ...tarea, avisos: ["x"] }).some((m) => m.includes("aviso")), "un aviso impide revisar")`).

Run: `npx tsx scripts/verificar-taller.ts`
Expected: verde, cuentas iguales antes y después.

- [ ] **Step 6: Comprobar y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-piezas.ts && npx tsx scripts/verificar-carcasa.ts && npx tsx scripts/verificar-taller.ts`

```bash
git add lib/taller lib/acciones-taller.ts 'app/(app)/dele/taller' components/taller/tarjeta-tarea.tsx scripts/verificar-taller.ts
git commit -m "Taller B: las reglas de la revisión, guardar con re-validación y marcar revisada con sus guardas"
```

---

### Task 2: Los editores por ítems sobre piezas

**Files:**
- Create: `components/taller/editor-tarea-opcion.tsx`
- Create: `components/taller/editor-tarea-relacionar.tsx`
- Create: `components/taller/dudas.ts`

**Interfaces:**
- Produces: `EditorTareaOpcion({ datos, alCambiar, dudas })` y `EditorTareaRelacionar({ datos, alCambiar, dudas })` con `datos: unknown`, `alCambiar: (nuevo: unknown) => void`, `dudas: Duda[]`; `type Duda = { campo: string; texto: string }`; `dudaDe(dudas, campo): string | null`.

Los dos editores son **controlados** (reciben `datos`, emiten `alCambiar` con el objeto entero nuevo), no llevan `name` en ningún `Campo` (nada los lee por formulario), y no importan nada de `components/recursos/campos.tsx`.

- [ ] **Step 1: `components/taller/dudas.ts`**

```ts
export type Duda = { campo: string; texto: string };

/**
 * La duda que la IA dejó sobre un campo, si la hay. Los caminos que
 * escribe la IA son «p3.opciones[1]», «p3.enunciado», «r2.derecha»,
 * «consigna», «bloque»; se comparan tal cual, sin espacios.
 */
export function dudaDe(dudas: Duda[], campo: string): string | null {
  const limpio = campo.replace(/\s+/g, "");
  return dudas.find((d) => d.campo.replace(/\s+/g, "") === limpio)?.texto ?? null;
}
```

- [ ] **Step 2: `components/taller/editor-tarea-opcion.tsx`**

```tsx
"use client";

import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import { dudaDe, type Duda } from "./dudas";

type Pregunta = { id: string; enunciado: string; opciones?: string[]; correctas: number[]; audio?: string };
type DatosOpcion = {
  ejercicio: "opcion"; consigna: string; multiple: boolean; opcionesComunes?: string[];
  presentacion: "botones" | "desplegable"; texto?: string; escuchas?: number; preguntas: Pregunta[];
};

const LETRAS = "ABCDEFGHIJ";

function siguienteId(preguntas: Pregunta[]): string {
  const max = preguntas.reduce((m, p) => { const r = /^p(\d+)$/.exec(p.id); return r ? Math.max(m, Number(r[1])) : m; }, 0);
  return `p${max + 1}`;
}

/** El campo con la duda de la IA debajo, en amarillo. `ayuda` de Campo la lleva. */
function ayudaCon(dudas: Duda[], campo: string, normal?: string): string | undefined {
  const duda = dudaDe(dudas, campo);
  return duda ? `Duda de la IA: ${duda}` : normal;
}

export default function EditorTareaOpcion({ datos, alCambiar, dudas }: { datos: unknown; alCambiar: (nuevo: unknown) => void; dudas: Duda[] }) {
  const d = datos as DatosOpcion;
  const comunes = d.opcionesComunes !== undefined;
  const cambiar = (parcial: Partial<DatosOpcion>) => alCambiar({ ...d, ...parcial });
  const cambiarPregunta = (i: number, parcial: Partial<Pregunta>) =>
    cambiar({ preguntas: d.preguntas.map((p, j) => (j === i ? { ...p, ...parcial } : p)) });
  const mover = (i: number, sentido: -1 | 1) => {
    const j = i + sentido;
    if (j < 0 || j >= d.preguntas.length) return;
    const preguntas = [...d.preguntas];
    [preguntas[i], preguntas[j]] = [preguntas[j], preguntas[i]];
    cambiar({ preguntas });
  };

  return (
    <div className="space-y-6">
      <Campo etiqueta="Consigna" tipo="area" rows={2} value={d.consigna} onChange={(e) => cambiar({ consigna: e.target.value })} ayuda={ayudaCon(dudas, "consigna")} />
      {d.texto !== undefined && (
        <Campo etiqueta="Pasaje con huecos" tipo="area" rows={8} value={d.texto} onChange={(e) => cambiar({ texto: e.target.value })}
          ayuda={ayudaCon(dudas, "texto", "Cada hueco es una marca {{p1}}, {{p2}}… con el id de su pregunta.")} />
      )}
      {comunes && (
        <Tarjeta relleno="compacto">
          <Rotulo>Opciones comunes a todas las preguntas</Rotulo>
          <div className="mt-2 space-y-2">
            {d.opcionesComunes!.map((o, i) => (
              <Campo key={i} etiqueta={`Opción ${LETRAS[i] ?? i + 1}`} value={o}
                onChange={(e) => cambiar({ opcionesComunes: d.opcionesComunes!.map((x, j) => (j === i ? e.target.value : x)) })}
                ayuda={ayudaCon(dudas, `opcionesComunes[${i}]`)} />
            ))}
          </div>
        </Tarjeta>
      )}
      <ol className="space-y-4">
        {d.preguntas.map((p, i) => {
          const opciones = p.opciones ?? d.opcionesComunes ?? [];
          return (
            <li key={p.id}>
              <Tarjeta relleno="compacto" titulo={`Pregunta ${i + 1} · ${p.id}`}>
                <Campo etiqueta="Enunciado" tipo="area" rows={2} value={p.enunciado} onChange={(e) => cambiarPregunta(i, { enunciado: e.target.value })} ayuda={ayudaCon(dudas, `${p.id}.enunciado`)} />
                <fieldset className="mt-3 space-y-2">
                  <legend><Rotulo>Opciones y correcta</Rotulo></legend>
                  {opciones.map((o, k) => (
                    <div key={k} className="flex items-start gap-3">
                      <label className="mt-2 flex items-center gap-1 text-sm">
                        <input type={d.multiple ? "checkbox" : "radio"} name={`correcta-${p.id}`} checked={p.correctas.includes(k)}
                          onChange={() => cambiarPregunta(i, { correctas: d.multiple ? (p.correctas.includes(k) ? p.correctas.filter((c) => c !== k) : [...p.correctas, k].sort()) : [k] })} />
                        {LETRAS[k] ?? k + 1}
                      </label>
                      {p.opciones ? (
                        <Campo etiqueta={`Opción ${LETRAS[k] ?? k + 1}`} className="flex-1" value={o}
                          onChange={(e) => cambiarPregunta(i, { opciones: p.opciones!.map((x, j) => (j === k ? e.target.value : x)) })}
                          ayuda={ayudaCon(dudas, `${p.id}.opciones[${k}]`)} />
                      ) : (
                        <span className="mt-2 text-sm text-tinta">{o || "(sin texto)"}</span>
                      )}
                    </div>
                  ))}
                </fieldset>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir">↑</Boton>
                  <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, 1)} disabled={i === d.preguntas.length - 1} title="Bajar">↓</Boton>
                  <Boton variante="peligro" tamano="pequeno" onClick={() => cambiar({ preguntas: d.preguntas.filter((_, j) => j !== i) })} disabled={d.preguntas.length <= 1}>Quitar</Boton>
                </div>
              </Tarjeta>
            </li>
          );
        })}
      </ol>
      <Boton variante="secundario" onClick={() => cambiar({ preguntas: [...d.preguntas, { id: siguienteId(d.preguntas), enunciado: "", ...(comunes ? {} : { opciones: Array.from({ length: (d.preguntas[0]?.opciones ?? ["", "", ""]).length }, () => "") }), correctas: [] }] })}>
        Añadir pregunta
      </Boton>
    </div>
  );
}
```

(`Campo` tiene `ayuda`; el color amarillo de la duda se consigue anteponiendo «Duda de la IA:» y, si `Campo` no admite un tono de ayuda, se deja en el tono normal: el texto ya lo dice. No tocar `components/ui/campo.tsx` en esta sesión.)

- [ ] **Step 3: `components/taller/editor-tarea-relacionar.tsx`**

```tsx
"use client";

import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import { dudaDe, type Duda } from "./dudas";

type Pareja = { id: string; izquierda: string; derecha: string; audio?: string };
type DatosRelacionar = { ejercicio: "relacionar"; consigna: string; texto?: string; parejas: Pareja[]; sobrantes: string[]; escuchas?: number };

function siguienteId(parejas: Pareja[]): string {
  const max = parejas.reduce((m, p) => { const r = /^r(\d+)$/.exec(p.id); return r ? Math.max(m, Number(r[1])) : m; }, 0);
  return `r${max + 1}`;
}

function ayudaCon(dudas: Duda[], campo: string, normal?: string): string | undefined {
  const duda = dudaDe(dudas, campo);
  return duda ? `Duda de la IA: ${duda}` : normal;
}

export default function EditorTareaRelacionar({ datos, alCambiar, dudas }: { datos: unknown; alCambiar: (nuevo: unknown) => void; dudas: Duda[] }) {
  const d = datos as DatosRelacionar;
  const cambiar = (parcial: Partial<DatosRelacionar>) => alCambiar({ ...d, ...parcial });
  const cambiarPareja = (i: number, parcial: Partial<Pareja>) => cambiar({ parejas: d.parejas.map((p, j) => (j === i ? { ...p, ...parcial } : p)) });
  const mover = (i: number, sentido: -1 | 1) => {
    const j = i + sentido;
    if (j < 0 || j >= d.parejas.length) return;
    const parejas = [...d.parejas];
    [parejas[i], parejas[j]] = [parejas[j], parejas[i]];
    cambiar({ parejas });
  };

  return (
    <div className="space-y-6">
      <Campo etiqueta="Consigna" tipo="area" rows={2} value={d.consigna} onChange={(e) => cambiar({ consigna: e.target.value })} ayuda={ayudaCon(dudas, "consigna")} />
      <ol className="space-y-4">
        {d.parejas.map((p, i) => (
          <li key={p.id}>
            <Tarjeta relleno="compacto" titulo={`Pareja ${i + 1} · ${p.id}`}>
              <Campo etiqueta="Enunciado o persona" tipo="area" rows={3} value={p.izquierda} onChange={(e) => cambiarPareja(i, { izquierda: e.target.value })} ayuda={ayudaCon(dudas, `${p.id}.izquierda`)} />
              <Campo etiqueta="Texto que le corresponde (su título)" className="mt-3" value={p.derecha} onChange={(e) => cambiarPareja(i, { derecha: e.target.value })} ayuda={ayudaCon(dudas, `${p.id}.derecha`, "Tiene que ser distinto en cada pareja.")} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir">↑</Boton>
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, 1)} disabled={i === d.parejas.length - 1} title="Bajar">↓</Boton>
                <Boton variante="peligro" tamano="pequeno" onClick={() => cambiar({ parejas: d.parejas.filter((_, j) => j !== i) })} disabled={d.parejas.length <= 2}>Quitar</Boton>
              </div>
            </Tarjeta>
          </li>
        ))}
      </ol>
      <Boton variante="secundario" onClick={() => cambiar({ parejas: [...d.parejas, { id: siguienteId(d.parejas), izquierda: "", derecha: "" }] })}>Añadir pareja</Boton>
      <Tarjeta relleno="compacto">
        <Rotulo>Sobrantes</Rotulo>
        <p className="mt-1 text-sm text-tinta-suave">Los textos que no casan con nadie. En el examen son tres.</p>
        <div className="mt-2 space-y-2">
          {d.sobrantes.map((s, i) => (
            <div key={i} className="flex items-end gap-2">
              <Campo etiqueta={`Sobrante ${i + 1}`} className="flex-1" value={s} onChange={(e) => cambiar({ sobrantes: d.sobrantes.map((x, j) => (j === i ? e.target.value : x)) })} ayuda={ayudaCon(dudas, `sobrantes[${i}]`)} />
              <Boton variante="peligro" tamano="pequeno" onClick={() => cambiar({ sobrantes: d.sobrantes.filter((_, j) => j !== i) })}>Quitar</Boton>
            </div>
          ))}
        </div>
        <Boton variante="sutil" tamano="pequeno" className="mt-3" onClick={() => cambiar({ sobrantes: [...d.sobrantes, ""] })}>Añadir sobrante</Boton>
      </Tarjeta>
    </div>
  );
}
```

- [ ] **Step 4: Comprobar y commitear**

Los editores no se montan aún (Task 3): `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-piezas.ts` (los `input type="radio|checkbox"` no disparan ningún patrón; ninguna clase de `campo`/`area` copiada).

```bash
git add components/taller/dudas.ts components/taller/editor-tarea-opcion.tsx components/taller/editor-tarea-relacionar.tsx
git commit -m "Taller B: los editores por ítems de opción y relacionar, sobre las piezas y con las dudas de la IA al pie de cada campo"
```

---

### Task 3: La pantalla de revisión

**Files:**
- Create: `app/(app)/dele/taller/[id]/tarea/[prueba]/[n]/page.tsx`
- Create: `components/taller/revision-tarea.tsx`
- Modify: `components/taller/tarjeta-tarea.tsx:45` («Abrir»)
- Modify: `scripts/verificar-carcasa.ts` solo si comprueba rutas dinámicas (no debería hacer falta)

**Interfaces:**
- Consumes: `tareaPorNumero`, `motivosParaNoRevisar`, `NOMBRE_ESTADO_TAREA`/`TONO_ESTADO_TAREA` (Task 1); `guardarTareaAccion`, `marcarRevisadaAccion`, `quitarImagenPedidaAccion`, `rellenarConIAAccion` (existente), `EstadoGuardado`; `EditorTareaOpcion`, `EditorTareaRelacionar`, `Duda` (Task 2); `Previsualizacion` (`components/recursos/previsualizacion.tsx`, prop `datos`); `hayClaveDeIA` (`lib/taller/rellenar.ts`); `tareaDe` del mapa.

- [ ] **Step 1: La página**

`app/(app)/dele/taller/[id]/tarea/[prueba]/[n]/page.tsx` (`params: Promise<{ id: string; prueba: string; n: string }>`; `notFound()` si `prueba` no es `CE`/`CO`, `n` no es 1-4, o `tareaPorNumero` devuelve null):

```tsx
import { notFound } from "next/navigation";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { tareaPorNumero } from "@/lib/taller/consultas";
import { motivosParaNoRevisar } from "@/lib/taller/revision";
import { NOMBRE_ESTADO_TAREA, TONO_ESTADO_TAREA } from "@/lib/taller/estados";
import { hayClaveDeIA } from "@/lib/taller/rellenar";
import { quitarImagenPedidaAccion } from "@/lib/acciones-taller";
import RevisionTarea from "@/components/taller/revision-tarea";
import type { Duda } from "@/components/taller/dudas";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NOMBRE_PRUEBA = { CE: "Lectura", CO: "Auditiva" } as const;

export default async function TareaPage({ params }: { params: Promise<{ id: string; prueba: string; n: string }> }) {
  const { id, prueba, n } = await params;
  const numero = Number(n);
  if ((prueba !== "CE" && prueba !== "CO") || !Number.isInteger(numero) || numero < 1 || numero > 4) notFound();
  const tarea = await tareaPorNumero(id, prueba, numero);
  if (!tarea) notFound();
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) notFound();

  const paginas = tarea.examen.paginas.filter((p) => tarea.paginaIds.includes(p.id));
  const bloqueTexto = tarea.paso.bloques.find((b) => b.tipo === "TEXTO")?.texto ?? null;
  const avisos = (tarea.avisos as string[] | null) ?? [];
  const dudas = (tarea.dudas as Duda[] | null) ?? [];
  const pedidas = ((tarea.imagenesPedidas as { pregunta: string; opcion: number | null; para: string; archivoId: string | null }[] | null) ?? []);
  const motivos = motivosParaNoRevisar(tarea);
  const vecina = (k: number) => (k >= 1 && k <= 4 ? `/dele/taller/${id}/tarea/${prueba}/${k}` : null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Encabezado
        titulo={`${NOMBRE_PRUEBA[prueba]} · Tarea ${numero}`}
        lede={delMapa.pide}
        volver={{ href: `/dele/taller/${id}`, texto: tarea.examen.titulo }}
        acciones={<Etiqueta tono={TONO_ESTADO_TAREA[tarea.estado]}>{NOMBRE_ESTADO_TAREA[tarea.estado]}</Etiqueta>}
      />
      {avisos.length > 0 && (
        <Aviso tono="error" className="mb-6"><ul className="list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul></Aviso>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Rotulo>La página original</Rotulo>
          {paginas.length === 0 ? (
            <Vacio className="mt-2">Esta tarea no tiene páginas asignadas. Márcalas en la mesa de trabajo.</Vacio>
          ) : (
            <div className="mt-2 space-y-3">
              {paginas.map((p) => (
                <Tarjeta key={p.id} href={`/api/archivos/${p.archivoId}`} externo relleno="ninguno" className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/archivos/${p.archivoId}`} alt={`Página ${p.orden}`} className="w-full" />
                </Tarjeta>
              ))}
              <p className="text-xs text-tinta-suave">Pulsa una página para verla a tamaño completo en otra pestaña.</p>
            </div>
          )}
          {pedidas.length > 0 && (
            <Tarjeta className="mt-6" titulo="Imágenes que pide esta tarea" relleno="compacto">
              <ul className="space-y-2 text-sm">
                {pedidas.map((img, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span>{img.pregunta}{img.opcion !== null ? ` · opción ${"ABCDEFGHIJ"[img.opcion] ?? img.opcion + 1}` : ""}: {img.para}{img.archivoId ? " (subida)" : ""}</span>
                    {!img.archivoId && (
                      <form action={quitarImagenPedidaAccion}>
                        <input type="hidden" name="tareaId" value={tarea.id} />
                        <input type="hidden" name="indice" value={i} />
                        <BotonEnviar gerundio="Quitando…" variante="sutil" tamano="pequeno">No hace falta</BotonEnviar>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-tinta-suave">Subirlas llega en la siguiente entrega. Si una no hace falta, quítala.</p>
            </Tarjeta>
          )}
        </div>
        <RevisionTarea
          tareaId={tarea.id}
          motor={delMapa.motor === "relacionar" ? "relacionar" : "opcion"}
          datosIniciales={tarea.ejercicio.datos}
          bloqueInicial={bloqueTexto}
          dudas={dudas}
          estado={tarea.estado}
          motivos={motivos}
          hayClave={hayClaveDeIA()}
          anterior={vecina(numero - 1)}
          siguiente={vecina(numero + 1)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `components/taller/revision-tarea.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarTareaAccion, marcarRevisadaAccion, rellenarConIAAccion, type EstadoGuardado } from "@/lib/acciones-taller";
import Previsualizacion from "@/components/recursos/previsualizacion";
import EditorTareaOpcion from "./editor-tarea-opcion";
import EditorTareaRelacionar from "./editor-tarea-relacionar";
import type { Duda } from "./dudas";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";

export default function RevisionTarea({ tareaId, motor, datosIniciales, bloqueInicial, dudas, estado, motivos, hayClave, anterior, siguiente }: {
  tareaId: string; motor: "opcion" | "relacionar"; datosIniciales: unknown; bloqueInicial: string | null; dudas: Duda[];
  estado: "VACIA" | "RELLENADA" | "REVISADA"; motivos: string[]; hayClave: boolean; anterior: string | null; siguiente: string | null;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState<unknown>(datosIniciales);
  const [bloque, setBloque] = useState(bloqueInicial ?? "");
  const [sucio, setSucio] = useState(false);
  const [mensaje, setMensaje] = useState<EstadoGuardado | null>(null);
  const [comoEstudiante, setComoEstudiante] = useState(false);
  const [pendiente, empezar] = useTransition();

  const cambiar = (nuevo: unknown) => { setDatos(nuevo); setSucio(true); };

  function guardar(despues?: () => void) {
    empezar(async () => {
      const r = await guardarTareaAccion(tareaId, JSON.stringify(datos), bloque || null);
      setMensaje(r);
      if (!r.error) { setSucio(false); router.refresh(); despues?.(); }
    });
  }

  function revisar() {
    if (sucio) { setMensaje({ error: "Guarda antes de marcarla revisada." }); return; }
    empezar(async () => {
      const r = await marcarRevisadaAccion(tareaId);
      setMensaje(r);
      if (!r.error) router.refresh();
    });
  }

  function volverARellenar() {
    if (!window.confirm("Se sustituye todo lo que hay en esta tarea por una lectura nueva de la IA. ¿Seguir?")) return;
    empezar(async () => {
      const r = await rellenarConIAAccion(tareaId);
      setMensaje(r);
      if (!r.error) router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Rotulo>La tarea, como la verá el estudiante</Rotulo>
        <Boton variante="sutil" tamano="pequeno" onClick={() => setComoEstudiante((v) => !v)}>{comoEstudiante ? "Volver a editar" : "Ver como estudiante"}</Boton>
      </div>
      {comoEstudiante ? (
        <div className="mt-3"><Previsualizacion datos={datos} /></div>
      ) : (
        <div className="mt-3 space-y-6">
          {motor === "opcion" && (datos as { texto?: string }).texto === undefined && (
            <Campo etiqueta="Estímulo (lo que se lee antes de contestar)" tipo="area" rows={8} value={bloque} onChange={(e) => { setBloque(e.target.value); setSucio(true); }}
              ayuda={dudas.find((d) => d.campo === "bloque") ? `Duda de la IA: ${dudas.find((d) => d.campo === "bloque")!.texto}` : "En markdown. En la auditiva se deja vacío."} />
          )}
          {motor === "relacionar" && (
            <Campo etiqueta="Estímulo (los textos, si van aparte)" tipo="area" rows={8} value={bloque} onChange={(e) => { setBloque(e.target.value); setSucio(true); }} ayuda="En markdown. Vacío si cada texto va en su pareja." />
          )}
          {motor === "opcion" ? <EditorTareaOpcion datos={datos} alCambiar={cambiar} dudas={dudas} /> : <EditorTareaRelacionar datos={datos} alCambiar={cambiar} dudas={dudas} />}
        </div>
      )}
      <Tarjeta className="mt-6" relleno="compacto">
        {mensaje?.error && <Aviso tono="error" className="mb-3">{mensaje.error}</Aviso>}
        {mensaje?.ok && <Aviso tono="ok" className="mb-3">{mensaje.ok}{mensaje.avisos?.length ? ` Quedan ${mensaje.avisos.length} aviso(s).` : ""}</Aviso>}
        {estado !== "REVISADA" && motivos.length > 0 && !sucio && (
          <Aviso tono="aviso" className="mb-3"><ul className="list-disc pl-5">{motivos.map((m) => <li key={m}>{m}</li>)}</ul></Aviso>
        )}
        <div className="flex flex-wrap gap-2">
          <Boton variante="primario" onClick={() => guardar()} disabled={pendiente || !sucio}>{pendiente ? "Guardando…" : "Guardar"}</Boton>
          <Boton variante="secundario" onClick={revisar} disabled={pendiente || estado === "REVISADA" || sucio || motivos.length > 0}>Marcar revisada</Boton>
          <Boton variante="sutil" onClick={volverARellenar} disabled={pendiente || !hayClave} title={hayClave ? undefined : "Falta la clave de la API"}>Volver a rellenar con IA</Boton>
        </div>
        <div className="mt-4 flex justify-between text-sm">
          {anterior ? <Boton href={anterior} variante="sutil" tamano="pequeno">← Tarea anterior</Boton> : <span />}
          {siguiente ? <Boton href={siguiente} variante="sutil" tamano="pequeno">Tarea siguiente →</Boton> : <span />}
        </div>
      </Tarjeta>
    </div>
  );
}
```

- [ ] **Step 3: «Abrir» y la mesa**

En `components/taller/tarjeta-tarea.tsx:45`, `href` pasa a `/dele/taller/${examenId}/tarea/${tarea.prueba}/${tarea.numero}` (el prop `examenId` ya llega). En la mesa de trabajo, la etiqueta de estado de cada tarjeta ya viene de `estados.ts` (Task 1).

- [ ] **Step 4: Comprobar, barrido y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-piezas.ts && npx tsx scripts/verificar-carcasa.ts && npx tsx scripts/verificar-taller.ts`

Barrido con `npm run dev` y sesión de profesor (receta del informe de la sesión A, Task 3): crear un examen con `crearExamen` desde un script desechable, rellenar CE 3 con `guardarRelleno` y el fixture bueno, y `GET /dele/taller/<id>/tarea/CE/3` → 200 con «Lectura · Tarea 3», «Pregunta 1 · p1», «Marcar revisada», «Ver como estudiante»; `GET /dele/taller/<id>/tarea/CO/1` → 200 con «Vacía»; `GET /dele/taller/<id>/tarea/XX/1` → 404; `GET /dele/taller/<id>/tarea/CE/9` → 404; sesión de estudiante → 404. Borrar el examen de prueba, matar el servidor, quitar temporales. Build de producción con el env exportado.

```bash
git add 'app/(app)/dele/taller' components/taller
git commit -m "Taller B: la pantalla de revisión, con la página al lado, el editor por ítems y la prueba como estudiante"
```

---

## Lo que queda para la sesión C

Opciones con imagen en `opcionSchema` y `components/ejercicios/opcion.tsx`; subir las imágenes pedidas desde la mesa y desde la tarea; audio por tarea con onda y cortes (ffmpeg), racionado, y el reproductor encadenado del examen blanco; Publicar/Retirar/Archivar; Asignar a…; `Examen → Recorrido` con `onDelete: Restrict`; el resto de `verificar-taller.ts` (publicar se niega con siete revisadas; mutación de esa guarda).
