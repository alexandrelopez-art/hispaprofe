# El taller del examen, sesión C: imágenes, audio con cortes, publicar y asignar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un examen del taller se pueda terminar del todo desde el sitio: subir las imágenes que pide la IA (y que una opción pueda ser una imagen), subir la grabación de cada tarea auditiva, marcar los cortes sobre la onda y racionar cada trozo, publicarlo en el catálogo, asignarlo con fecha, y que el examen blanco encadene los trozos.

**Architecture:** Cinco piezas sobre lo que ya hay: (1) el ciclo de vida del examen (`lib/taller/publicar.ts`) con sus guardas y la asignación por grupo o particular, más la relación `Examen → Recorrido` con `onDelete: Restrict`; (2) opciones con imagen en el motor de opción (`imagenes` paralelo a `opciones`), su render para el estudiante, y la subida de las imágenes pedidas; (3) el corte de audio en el servidor con el ffmpeg empaquetado (`lib/audio.ts`) y el reparto de trozos por tarea (`lib/taller/audio.ts`); (4) la onda en el navegador con marcadores y propuesta de silencios (`components/taller/onda.tsx`); (5) el reproductor encadenado del examen blanco. Todo verificado en `scripts/verificar-taller.ts` (con un WAV sintético para los cortes) y con la mutación de la guarda de publicar.

**Tech Stack:** Next.js 16.2 App Router, React 19, Prisma 7 (una migración), zod 4, `ffmpeg-static` (ya en producción), Web Audio API + canvas en el navegador, Tailwind 4 con las piezas de `components/ui/`.

**Spec:** `docs/superpowers/specs/2026-09-03-taller-dele-design.md`, secciones 4 y 5. **Desviaciones declaradas:** (a) en el motor de opción, una opción con imagen se guarda como `imagenes[i]` (url) en paralelo a `opciones[i]` (que pasa a ser la letra), no como `string | { texto, imagen }`: mismo resultado para el estudiante, sin tocar `corregir` ni la versión pública de otros tipos; (b) la tarea 3 de la auditiva (una sola conversación, sin cortes) se oye con el bloque AUDIO del paso, que en una prueba racionada tiene tope **1** literal (regla ya escrita en `lib/escuchas.ts` porque las grabaciones oficiales traen la repetición dentro); los trozos de las tareas 1, 2 y 4 sí llevan 2 escuchas.

## Global Constraints

- Única migración de la sesión: relaciones `Examen.lectura`/`auditiva` → `Recorrido` con `onDelete: Restrict`, y en `TareaDeExamen` `grabacionArchivoId String?` y `cortes Json?`. Nada más cambia en el modelo del estudiante.
- Solo `PROFESOR`/`ADMIN` (layout de `/dele/taller` da 404); toda acción con `exigirProfesor()` antes de leer o escribir.
- Piezas de `components/ui/` para todo lo visual; `verificar-piezas.ts` en «Todo en orden» **sin excepción nueva** (el canvas de la onda y los `<img>` con el comentario eslint del repo no disparan ningún patrón).
- Textos en español, en la voz del sitio (tú, sin jerga). Sin gerundios en botones de formularios GET.
- Subidas por `/api/archivos` (campo `archivo` o JSON `{ url }` para un enlace de Drive; devuelve `{ url: "/api/archivos/<id>" }`); ningún binario nuevo: los cortes usan el ffmpeg que ya empaqueta `lib/audio.ts`.
- Nada llega a `Ejercicio.datos` sin `revisarDatos`; `guardarTarea`/`guardarRelleno` ya pasan por `puedeEditarse`.
- Publicar exige: ocho tareas `REVISADA`, cero imágenes pedidas sin archivo, y grabación en las cuatro auditivas. Retirar despublica sin borrar; las asignaciones vivas se conservan.
- `verificar-taller.ts` conserva su disciplina (cuentas antes/después iguales); la mutación de la guarda de publicar tiene que ponerlo en rojo.
- Commits con los dos trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_011MTFjk2FcQUCsqhsbMpp6C`.
- Antes de cada commit: `npx tsc --noEmit`, `npm run lint` (0 avisos), `npx tsx scripts/verificar-piezas.ts`, `npx tsx scripts/verificar-carcasa.ts`, `npx tsx scripts/verificar-taller.ts`, `npx tsx scripts/verificar-dele.ts`, `npx tsx scripts/verificar-recursos.ts`.

---

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `prisma/schema.prisma`, migración `taller_publicar_y_audio` | relaciones Restrict; `grabacionArchivoId`, `cortes` en `TareaDeExamen` |
| `lib/taller/publicar.ts` | `motivosParaNoPublicar`, `publicarExamen`, `retirarExamen`, `archivarExamen`, `asignarExamen` |
| `lib/acciones.ts` | `asignarA` exportado y con `venceEl` |
| `lib/acciones-taller.ts` | + acciones de publicar/retirar/archivar/asignar, imágenes, grabación y cortes |
| `components/taller/ciclo-examen.tsx` | cliente: Publicar/Retirar/Archivar con confirmación y motivos; Asignar a… |
| `lib/ejercicios/opcion.ts` | `imagenes?: (string \| null)[]` por pregunta; `opcionesDe` intacto; versión pública con `imagenes` |
| `components/ejercicios/opcion.tsx` | pinta la imagen de una opción con su letra |
| `components/taller/editor-tarea-opcion.tsx` | miniatura de la opción con imagen |
| `lib/taller/imagenes.ts` | `asignarImagenPedida(tareaId, indice, archivoUrl)` |
| `components/taller/imagenes-pedidas.tsx` | cliente: la lista con subida (mesa y tarea) |
| `lib/audio.ts` | `cortarAudio(datos, tipo, cortes)` con el ffmpeg empaquetado; `duracionDe` |
| `lib/taller/audio.ts` | `trozosQueEspera(tarea)`, `guardarGrabacion`, `cortarGrabacion` (reparto por tarea, escuchas 2, aviso) |
| `components/taller/onda.tsx` | cliente: onda, marcadores, silencios, escucha rápida, «Cortar» |
| `components/taller/grabacion.tsx` | cliente: subir la grabación (archivo o Drive) + `Onda` |
| `lib/taller/revision.ts` | guarda de revisar: grabación y trozos según la tarea |
| `components/ejercicios/reproductor-encadenado.tsx`, `lib/escuchas.ts`, `app/(app)/pasos/[pasoId]/page.tsx` | el examen blanco encadena los trozos |
| `scripts/verificar-taller.ts` | + publicar (guardas y mutación), asignar, imágenes, cortes con `generarWav`, encadenado |

---

### Task 1: Publicar, retirar, archivar y asignar

**Files:**
- Modify: `prisma/schema.prisma` (`Examen`, `Recorrido`, `TareaDeExamen`)
- Create: `lib/taller/publicar.ts`
- Modify: `lib/acciones.ts:47-67` (`asignarA` exportado, con `venceEl`)
- Modify: `lib/acciones-taller.ts` (+ cuatro acciones)
- Create: `components/taller/ciclo-examen.tsx`
- Modify: `app/(app)/dele/taller/[id]/page.tsx` (montar `CicloExamen`)
- Modify: `scripts/verificar-taller.ts`

**Interfaces:**
- Consumes: `examenDe` (`ExamenCompleto` con `tareas`, `paginas`, `estado`, `lecturaId`, `auditivaId`, `bloque`), `motivosParaNoRevisar`, `listarEstudiantesElegibles` (`lib/estudiantes.ts`), `exigirProfesor`.
- Produces: `motivosParaNoPublicar(examen): string[]`, `publicarExamen(id)`, `retirarExamen(id)`, `archivarExamen(id)`, `asignarExamen(id, destino, profesorId, venceEl)`, `asignarA(estudianteIds, recorridoId, profesorId, nota, venceEl?)` exportado; acciones `publicarExamenAccion(formData)`, `retirarExamenAccion(formData)`, `archivarExamenAccion(formData)`, `asignarExamenAccion(prev, formData)`.

- [ ] **Step 1: El esquema y la migración**

En `model Examen`, sustituir las dos columnas sueltas por relaciones (las columnas se quedan, ganan la relación):

```prisma
  lecturaId    String       @unique
  lectura      Recorrido    @relation("ExamenLectura", fields: [lecturaId], references: [id], onDelete: Restrict)
  auditivaId   String       @unique
  auditiva     Recorrido    @relation("ExamenAuditiva", fields: [auditivaId], references: [id], onDelete: Restrict)
```

En `model Recorrido`, las inversas: `examenComoLectura Examen? @relation("ExamenLectura")` y `examenComoAuditiva Examen? @relation("ExamenAuditiva")`.

En `model TareaDeExamen`, tras `claveOficial`:

```prisma
  /// La grabación completa de una tarea auditiva (un `Archivo`), de la que
  /// salen los trozos. Se guarda aparte del bloque AUDIO para poder volver a
  /// cortar sin pedir el MP3 otra vez.
  grabacionArchivoId String?
  /// `number[]`: los cortes en segundos que el profesor marcó la última vez.
  cortes             Json?
```

Run: `npx prisma migrate dev --name taller_publicar_y_audio && npx prisma generate`. El SQL generado tiene que llevar `FOREIGN KEY ... ON DELETE RESTRICT` para las dos columnas (comprobar en `migration.sql`).

`crearExamen` (`lib/taller/esqueleto.ts`) sigue escribiendo `lecturaId`/`auditivaId` por id: con Prisma 7 y una relación declarada, `create` con las columnas escalares sigue valiendo dentro de `data` solo si se usa `lecturaId` como escalar sin `lectura`; si tsc protesta, cambiar a `lectura: { connect: { id: ids.CE } }, auditiva: { connect: { id: ids.CO } }`.

- [ ] **Step 2: `asignarA` con fecha**

En `lib/acciones.ts:47`, exportar y ampliar:

```ts
export async function asignarA(
  estudianteIds: string[],
  recorridoId: string,
  profesorId: string,
  nota: string,
  venceEl: Date | null = null,
) {
  await prisma.$transaction(
    estudianteIds.map((estudianteId) =>
      prisma.asignacion.upsert({
        where: { estudianteId_recorridoId: { estudianteId, recorridoId } },
        update: { archivada: false, nota: nota || null, profesorId, ...(venceEl ? { venceEl } : {}) },
        create: { estudianteId, recorridoId, profesorId, nota: nota || null, venceEl },
      }),
    ),
  );
}
```

Los llamadores existentes no cambian (el quinto parámetro tiene valor por defecto).

- [ ] **Step 3: `lib/taller/publicar.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { asignarA } from "@/lib/acciones";
import { examenDe, type ExamenCompleto } from "@/lib/taller/consultas";

type ImagenPedida = { archivoId: string | null };

/** Por qué no se puede publicar todavía. Vacío = se puede. */
export function motivosParaNoPublicar(examen: ExamenCompleto): string[] {
  const motivos: string[] = [];
  const sinRevisar = examen.tareas.filter((t) => t.estado !== "REVISADA").length;
  if (sinRevisar) motivos.push(`${sinRevisar} tarea(s) sin revisar.`);
  const pendientes = examen.tareas.reduce(
    (n, t) => n + (((t.imagenesPedidas as ImagenPedida[] | null) ?? []).filter((i) => !i.archivoId).length), 0);
  if (pendientes) motivos.push(`${pendientes} imagen(es) por subir.`);
  const sinGrabacion = examen.tareas.filter((t) => t.prueba === "CO" && !t.grabacionArchivoId).length;
  if (sinGrabacion) motivos.push(`${sinGrabacion} tarea(s) auditiva(s) sin grabación.`);
  return motivos;
}

export async function publicarExamen(id: string): Promise<{ ok: true } | { ok: false; motivos: string[] }> {
  const examen = await examenDe(id);
  if (!examen) return { ok: false, motivos: ["Ese examen ya no existe."] };
  const motivos = motivosParaNoPublicar(examen);
  if (motivos.length) return { ok: false, motivos };
  const pasoIds = examen.tareas.map((t) => t.pasoId);
  await prisma.$transaction(async (tx) => {
    await tx.recorrido.updateMany({ where: { id: { in: [examen.lecturaId, examen.auditivaId] } }, data: { publicado: true, orden: examen.bloque } });
    const enganches = await tx.pasoEjercicio.findMany({ where: { pasoId: { in: pasoIds } }, select: { ejercicioId: true } });
    await tx.ejercicio.updateMany({ where: { id: { in: enganches.map((e) => e.ejercicioId) } }, data: { publicado: true } });
    await tx.examen.update({ where: { id }, data: { estado: "PUBLICADO" } });
  });
  return { ok: true };
}

/** Despublica sin borrar nada: las asignaciones vivas se conservan. */
export async function retirarExamen(id: string): Promise<void> {
  const examen = await prisma.examen.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    prisma.recorrido.updateMany({ where: { id: { in: [examen.lecturaId, examen.auditivaId] } }, data: { publicado: false } }),
    prisma.examen.update({ where: { id }, data: { estado: "EN_CONSTRUCCION" } }),
  ]);
}

export async function archivarExamen(id: string): Promise<void> {
  const examen = await prisma.examen.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    prisma.recorrido.updateMany({ where: { id: { in: [examen.lecturaId, examen.auditivaId] } }, data: { publicado: false } }),
    prisma.examen.update({ where: { id }, data: { estado: "ARCHIVADO" } }),
  ]);
}

export type Destino = { tipo: "grupo"; id: string } | { tipo: "alumno"; id: string };

export function partirDestino(bruto: string): Destino | null {
  const [tipo, id] = bruto.split(":");
  if ((tipo === "grupo" || tipo === "alumno") && id) return { tipo, id };
  return null;
}

/** Asigna las dos secuencias del examen a un grupo o a un particular, con fecha. */
export async function asignarExamen(id: string, destino: Destino, profesorId: string, venceEl: Date | null): Promise<{ ok: true; cuantos: number } | { ok: false; error: string }> {
  const examen = await prisma.examen.findUnique({ where: { id } });
  if (!examen) return { ok: false, error: "Ese examen ya no existe." };
  const estudianteIds =
    destino.tipo === "grupo"
      ? (await prisma.miembroGrupo.findMany({ where: { grupoId: destino.id }, select: { estudianteId: true } })).map((m) => m.estudianteId)
      : [destino.id];
  if (estudianteIds.length === 0) return { ok: false, error: "Ese grupo no tiene estudiantes." };
  for (const recorridoId of [examen.lecturaId, examen.auditivaId]) {
    await asignarA(estudianteIds, recorridoId, profesorId, "", venceEl);
  }
  return { ok: true, cuantos: estudianteIds.length };
}
```

- [ ] **Step 4: Las acciones**

En `lib/acciones-taller.ts`:

```ts
import { archivarExamen, asignarExamen, partirDestino, publicarExamen, retirarExamen } from "@/lib/taller/publicar";

function refrescarExamen(examenId: string) {
  revalidatePath(`/dele/taller/${examenId}`);
  revalidatePath("/dele/taller");
  revalidatePath("/dele");
  revalidatePath("/recorridos");
  revalidatePath("/clases");
}

export async function publicarExamenAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const r = await publicarExamen(examenId);
  refrescarExamen(examenId);
  return r.ok ? { ok: "Publicado: ya está en el catálogo del nivel." } : { error: r.motivos.join(" ") };
}

export async function retirarExamenAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await retirarExamen(examenId);
  refrescarExamen(examenId);
}

export async function archivarExamenAccion(formData: FormData): Promise<void> {
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  await archivarExamen(examenId);
  refrescarExamen(examenId);
  redirect("/dele/taller");
}

export async function asignarExamenAccion(_prev: EstadoTaller, formData: FormData): Promise<EstadoTaller> {
  const usuario = await exigirProfesor();
  const examenId = String(formData.get("examenId") ?? "");
  await examenDelProfesor(examenId);
  const destino = partirDestino(String(formData.get("destino") ?? ""));
  if (!destino) return { error: "Elige un grupo o un estudiante." };
  const fecha = String(formData.get("venceEl") ?? "");
  const venceEl = fecha ? new Date(`${fecha}T23:59:59`) : null;
  if (fecha && Number.isNaN(venceEl!.getTime())) return { error: "Esa fecha no vale." };
  const r = await asignarExamen(examenId, destino, usuario.id, venceEl);
  refrescarExamen(examenId);
  revalidatePath("/profe/alumnos");
  if (!r.ok) return { error: r.error };
  return { ok: `Asignado a ${r.cuantos} estudiante(s)${venceEl ? `, para el ${fecha}` : ""}.` };
}
```

- [ ] **Step 5: `components/taller/ciclo-examen.tsx`**

Cliente. Props: `{ examenId, estado, motivos: string[], destinos: { valor: string; nombre: string }[] }`. Pinta:

- Si `estado === "EN_CONSTRUCCION"`: un `form` con `useActionState(publicarExamenAccion, {})`, `input hidden examenId`, `BotonEnviar gerundio="Publicando…" variante="primario" deshabilitado={motivos.length > 0}` «Publicar examen»; debajo, si hay motivos, un `Aviso tono="aviso"` con la lista; y el `estado.error`/`ok` en su `Aviso`.
- Si `estado === "PUBLICADO"`: `form action={retirarExamenAccion}` con `BotonEnviar gerundio="Retirando…" variante="secundario"` «Retirar del catálogo» (con `onClick` que pide `window.confirm("Se retira del catálogo. Los estudiantes que ya lo tenían lo conservan. ¿Seguir?")` y hace `e.preventDefault()` si dice que no).
- Siempre (salvo `ARCHIVADO`): `form action={archivarExamenAccion}` con `BotonEnviar gerundio="Archivando…" variante="sutil" tamano="pequeno"` «Archivar», con confirmación igual.
- Asignar: `Tarjeta titulo="Asignar a…" relleno="compacto"` con `useActionState(asignarExamenAccion, {})`: `Campo tipo="elegir" name="destino" etiqueta="Grupo o estudiante"` con `opciones={[{ valor: "", nombre: "Elige…", deshabilitada: true }, ...destinos]}`, `Campo tipo="fecha" name="venceEl" etiqueta="Fecha límite (opcional)"`, `BotonEnviar gerundio="Asignando…" variante="secundario"` «Asignar las dos pruebas»; deshabilitado si `estado !== "PUBLICADO"` con un texto «Publica el examen antes de asignarlo.».

En la mesa (`[id]/page.tsx`): construir `destinos` con los grupos no archivados del profesor (`prisma.grupo.findMany({ where: { profesorId: usuario.id, archivado: false }, select: { id, nombre } })` → `grupo:<id>` «Grupo · nombre») y los particulares (`listarEstudiantesElegibles({ select: { id: true, firstName: true, lastName: true, email: true, gruposDondeEsta?: … } })` — mirar en `prisma/schema.prisma` el nombre de la relación inversa de `MiembroGrupo.estudiante` en `User` y filtrar los que no tienen ninguna membresía → `alumno:<id>` «Particular · nombre»). Montar `<CicloExamen>` en el `acciones` del `Encabezado` (los botones) y la tarjeta de asignar debajo del cuadernillo. `motivos = motivosParaNoPublicar(examen)`.

- [ ] **Step 6: El script**

Tras la sección de revisión de la sesión B (CE 3 queda `REVISADA` al final de aquella sección; si no, marcarla), añadir:

```ts
// ─── Publicar, retirar, asignar ─────────────────────────────────────
const { motivosParaNoPublicar, publicarExamen, retirarExamen, asignarExamen } = await import("@/lib/taller/publicar");
let ex = (await examenDe(examenId!))!;
let motivosPub = motivosParaNoPublicar(ex);
afirmar(motivosPub.some((m) => m.includes("sin revisar")), "con tareas sin revisar no se publica");
afirmar(motivosPub.some((m) => m.includes("grabación")), "sin grabación en la auditiva no se publica");
const negadoPub = await publicarExamen(examenId!);
afirmar(negadoPub.ok === false, "publicarExamen se niega con motivos");
afirmar((await prisma.recorrido.findUnique({ where: { id: ex.lecturaId } }))!.publicado === false, "y no publica la lectura");

// Forzar el estado bueno directamente en la base: siete revisadas → sigue negado; ocho → publica.
const ids = ex.tareas.map((t) => t.id);
await prisma.tareaDeExamen.updateMany({ where: { id: { in: ids.slice(0, 7) } }, data: { estado: "REVISADA", imagenesPedidas: [] } });
await prisma.tareaDeExamen.updateMany({ where: { examenId: examenId!, prueba: "CO" }, data: { grabacionArchivoId: "falso" } });
afirmar((await publicarExamen(examenId!)).ok === false, "con siete revisadas se niega");
await prisma.tareaDeExamen.update({ where: { id: ids[7] }, data: { estado: "REVISADA", imagenesPedidas: [] } });
const publicado = await publicarExamen(examenId!);
afirmar(publicado.ok === true, "con ocho revisadas publica");
ex = (await examenDe(examenId!))!;
afirmar(ex.estado === "PUBLICADO", "el examen queda PUBLICADO");
const recs = await prisma.recorrido.findMany({ where: { id: { in: [ex.lecturaId, ex.auditivaId] } } });
afirmar(recs.every((r) => r.publicado && r.orden === ex.bloque), "las dos secuencias quedan publicadas en el bloque del examen");
const ejs = await prisma.pasoEjercicio.findMany({ where: { pasoId: { in: ex.tareas.map((t) => t.pasoId) } }, include: { ejercicio: true } });
afirmar(ejs.every((e) => e.ejercicio.publicado), "los ocho ejercicios quedan publicados");

// Asignar a un particular con fecha: dos asignaciones con venceEl.
const alumno = await prisma.user.create({ data: { email: `${marca}-alumno@prueba.local`, firstName: "Alumno", lastName: "de prueba", role: "STUDENT" }, select: { id: true } });
usuarioIds.push(alumno.id); // añadir a la limpieza (borrar sus asignaciones antes que el usuario)
const asignado = await asignarExamen(examenId!, { tipo: "alumno", id: alumno.id }, profeId!, new Date("2026-12-01T23:59:59"));
afirmar(asignado.ok === true && asignado.cuantos === 1, "asignarExamen a un particular asigna a uno");
const asigs = await prisma.asignacion.findMany({ where: { estudianteId: alumno.id } });
afirmar(asigs.length === 2 && asigs.every((a) => a.venceEl?.toISOString().startsWith("2026-12-01")), "dos asignaciones con la fecha límite");
afirmar((await asignarExamen(examenId!, { tipo: "grupo", id: "no-existe" }, profeId!, null)).ok === false, "un grupo vacío o inexistente no asigna");

await retirarExamen(examenId!);
ex = (await examenDe(examenId!))!;
afirmar(ex.estado === "EN_CONSTRUCCION" && (await prisma.recorrido.count({ where: { id: { in: [ex.lecturaId, ex.auditivaId] }, publicado: true } })) === 0, "retirar despublica y vuelve a construcción");
afirmar((await prisma.asignacion.count({ where: { estudianteId: alumno.id, archivada: false } })) === 2, "retirar conserva las asignaciones vivas");

// La relación Restrict: borrar la lectura de un examen tiene que fallar.
let restringido = false;
try { await prisma.recorrido.delete({ where: { id: ex.lecturaId } }); } catch { restringido = true; }
afirmar(restringido, "la base impide borrar una secuencia que es de un examen");
```

Mutación obligatoria (a mano, registrada en el informe, revertida): quitar en `motivosParaNoPublicar` la línea de `sinRevisar` → el script tiene que ponerse en rojo en «con siete revisadas se niega».

La limpieza: las asignaciones del alumno de prueba se borran antes que el usuario (`asignacion.deleteMany({ where: { estudianteId } })`), y `contar()` ya incluye `asignacion`.

- [ ] **Step 7: Comprobar, barrido y commitear**

Run: la lista de comprobaciones de las Global Constraints. Barrido con `npm run dev` y sesión de profesor: `GET /dele/taller/<id>` → 200 con «Publicar examen», «Asignar a…», «Publica el examen antes de asignarlo.».

```bash
git add prisma lib/taller/publicar.ts lib/acciones.ts lib/acciones-taller.ts components/taller/ciclo-examen.tsx 'app/(app)/dele/taller/[id]/page.tsx' scripts/verificar-taller.ts
git commit -m "Taller C: publicar, retirar, archivar y asignar con fecha, y la secuencia de un examen ya no se puede borrar"
```

---

### Task 2: Opciones con imagen y las imágenes pedidas

**Files:**
- Modify: `lib/ejercicios/opcion.ts` (`imagenes` en `preguntaOpcionSchema`, en `OpcionPublica` y en `versionPublica`)
- Modify: `components/ejercicios/opcion.tsx` (pintar la imagen)
- Modify: `components/taller/editor-tarea-opcion.tsx` (miniatura)
- Create: `lib/taller/imagenes.ts`
- Create: `components/taller/imagenes-pedidas.tsx`
- Modify: `lib/acciones-taller.ts` (+ `asignarImagenPedidaAccion`)
- Modify: `app/(app)/dele/taller/[id]/page.tsx` (panel real), `components/taller/revision-tarea.tsx` (usa la lista nueva)
- Modify: `lib/taller/encargo-ia.ts` (el esquema de herramienta sigue sin `imagenes`: la IA no las rellena)
- Modify: `scripts/verificar-taller.ts`, `scripts/verificar-recursos.ts` (una afirmación del esquema)

**Interfaces:**
- Produces: `preguntaOpcionSchema.imagenes?: (string | null)[]` (misma longitud que las opciones de esa pregunta); `OpcionPublica.preguntas[].imagenes?`; `asignarImagenPedida(tareaId, indice, archivoUrl): Promise<{ ok: true } | { ok: false; error: string }>`; acción `asignarImagenPedidaAccion(tareaId, indice, archivoUrl)`; componente `ImagenesPedidas({ tareaId, pedidas, bloqueado })`.

- [ ] **Step 1: El esquema**

En `lib/ejercicios/opcion.ts`, `preguntaOpcionSchema` gana:

```ts
  /**
   * Una imagen por opción, en paralelo a `opciones` (null donde la opción es
   * solo texto). Es lo que hace la tarea 1 de la auditiva escolar: las tres
   * opciones son dibujos. El texto de esa opción es su letra («A»), que es lo
   * que el estudiante ve al pie y lo que el corrector enseña al fallar.
   */
  imagenes: z.array(z.string().nullable()).optional(),
```

y un `refine` en `opcionSchema`: `d.preguntas.every((p) => p.imagenes === undefined || p.imagenes.length === (p.opciones ?? d.opcionesComunes ?? []).length)` con mensaje «Cada pregunta con imágenes necesita una por opción (o null).». En `OpcionPublica.preguntas[]` añadir `imagenes?: (string | null)[]` y en `versionPublica` copiarlo. `corregir` no cambia.

En `scripts/verificar-recursos.ts` añadir: un `opcion` con `imagenes` de la longitud correcta valida; con longitud distinta se rechaza; la versión pública lleva las `imagenes`.

- [ ] **Step 2: El render para el estudiante**

En `components/ejercicios/opcion.tsx`, dentro del `label` de cada opción, cuando `pregunta.imagenes?.[indice]`:

```tsx
{pregunta.imagenes?.[indice] ? (
  <span className="flex flex-col items-center gap-1">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={pregunta.imagenes[indice]!} alt={`Opción ${opcion}`} className="max-h-40 rounded-lg object-contain" />
    <span>{opcion}</span>
  </span>
) : (
  <span>{opcion}</span>
)}
```

y el `grid` pasa a `sm:grid-cols-3` cuando la pregunta tiene alguna imagen (tres dibujos en fila, como en el examen). En `editor-tarea-opcion.tsx`, junto a cada `Campo` de opción, si `p.imagenes?.[k]` existe, una miniatura de 64 px con el mismo `<img>` y comentario.

- [ ] **Step 3: `lib/taller/imagenes.ts`**

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { revisarDatos } from "@/lib/recursos";
import { tareaDe } from "@/lib/taller/consultas";

type Pedida = { pregunta: string; opcion: number | null; para: string; archivoId: string | null };
const LETRAS = "ABCDEFGHIJ";

/**
 * Coloca una imagen subida en el sitio que la IA dejó marcado: en la opción
 * (`imagenes[opcion]`, y el texto de la opción pasa a ser su letra) o, si la
 * petición era del ítem entero, como bloque IMAGEN del paso con su etiqueta.
 */
export async function asignarImagenPedida(tareaId: string, indice: number, archivoUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  const archivoId = archivoUrl.replace(/^\/api\/archivos\//, "");
  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId }, select: { id: true, tipo: true, privado: true } });
  if (!archivo || archivo.privado || !archivo.tipo.startsWith("image/")) return { ok: false, error: "Ese archivo no es una imagen del sitio." };
  const lista = ((tarea.imagenesPedidas as Pedida[] | null) ?? []);
  const pedida = lista[indice];
  if (!pedida) return { ok: false, error: "Esa petición ya no está en la lista." };

  const datos = structuredClone(tarea.ejercicio.datos) as { preguntas?: { id: string; opciones?: string[]; imagenes?: (string | null)[] }[]; opcionesComunes?: string[] };
  if (pedida.opcion !== null) {
    const pregunta = datos.preguntas?.find((p) => p.id === pedida.pregunta);
    if (!pregunta) return { ok: false, error: "La pregunta de esa imagen ya no existe." };
    const opciones = pregunta.opciones ?? datos.opcionesComunes ?? [];
    if (pedida.opcion < 0 || pedida.opcion >= opciones.length) return { ok: false, error: "Esa opción ya no existe." };
    pregunta.imagenes = pregunta.imagenes ?? opciones.map(() => null);
    pregunta.imagenes[pedida.opcion] = archivoUrl;
    if (pregunta.opciones && /^\(imagen\)$/i.test(pregunta.opciones[pedida.opcion].trim())) {
      pregunta.opciones[pedida.opcion] = LETRAS[pedida.opcion] ?? String(pedida.opcion + 1);
    }
    const revision = revisarDatos(datos);
    if ("error" in revision) return { ok: false, error: revision.error };
  }

  await prisma.$transaction(async (tx) => {
    if (pedida.opcion !== null) {
      await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    } else {
      const ultimo = await tx.bloque.aggregate({ where: { pasoId: tarea.pasoId }, _max: { orden: true } });
      await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "IMAGEN", url: archivoUrl, etiqueta: pedida.para, orden: (ultimo._max.orden ?? 0) + 1 } });
    }
    const nueva = lista.map((p, i) => (i === indice ? { ...p, archivoId: archivo.id } : p));
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { imagenesPedidas: nueva } });
  });
  return { ok: true };
}
```

- [ ] **Step 4: La acción y el componente**

En `lib/acciones-taller.ts`: `asignarImagenPedidaAccion(tareaId, indice, archivoUrl): Promise<EstadoGuardado>` con `exigirProfesor`, `Number.isInteger(indice)`, llamada a `asignarImagenPedida`, `revalidatePath` del examen y de la tarea.

`components/taller/imagenes-pedidas.tsx` (cliente): recibe `{ tareaId, pedidas: Pedida[], bloqueado: boolean }`; para cada pedida sin `archivoId`: el texto («p3 · opción B: un chico con una bici») y un `<input type="file" accept="image/*">` que reduce como `components/subir-imagen.tsx` (copiar `reducir` con su comentario, salida WebP), sube a `/api/archivos` (campo `archivo`) y llama a `asignarImagenPedidaAccion`; mientras sube, «Subiendo…»; errores en `Aviso tono="error"`; el botón «No hace falta» de la sesión B se mantiene (`quitarImagenPedidaAccion`). Con `archivoId`: «(subida)» y una miniatura `<img src=/api/archivos/<archivoId>>`. Con `bloqueado` (cambios sin guardar), inputs y botones deshabilitados con `title="Guarda o descarta tus cambios antes"`. Se usa en `revision-tarea.tsx` (sustituye al panel de la sesión B) y en la mesa, en la tarjeta «Imágenes que faltan», agrupando por tarea («Auditiva · Tarea 1»).

- [ ] **Step 5: El script**

En `verificar-taller.ts`: crear un `Archivo` `image/webp` mínimo; poner en CE 3 `imagenesPedidas: [{ pregunta: "p1", opcion: 1, para: "un dibujo", archivoId: null }]` con `opciones[1] = "(imagen)"` vía `guardarTarea`; `asignarImagenPedida(tarea, 0, "/api/archivos/<id>")` → `ok`; el `datos` guardado tiene `preguntas[0].imagenes[1] === "/api/archivos/<id>"` y `opciones[1] === "B"`; la pedida queda con `archivoId`; `revisarDatos` sigue válido; una pedida con `opcion: null` crea un `Bloque IMAGEN` con la etiqueta `para`; un archivo `privado: true` se rechaza. Limpiar archivos y bloques.

- [ ] **Step 6: Comprobar y commitear**

Run: la lista completa. Barrido: `GET /dele/taller/<id>/tarea/CE/3` con una pedida → 200 con «No hace falta» y un `input type="file"`.

```bash
git add lib/ejercicios/opcion.ts components/ejercicios/opcion.tsx components/taller lib/taller/imagenes.ts lib/acciones-taller.ts 'app/(app)/dele/taller' scripts
git commit -m "Taller C: una opción puede ser una imagen, y las imágenes que pide la IA se suben desde la mesa y desde la tarea"
```

---

### Task 3: Cortar la grabación en el servidor y repartir los trozos

**Files:**
- Modify: `lib/audio.ts` (+ `cortarAudio`, `duracionDe`)
- Create: `lib/taller/audio.ts`
- Modify: `lib/taller/revision.ts` (la guarda de la auditiva)
- Modify: `lib/acciones-taller.ts` (+ `guardarGrabacionAccion`, `cortarGrabacionAccion`)
- Modify: `scripts/verificar-taller.ts`

**Interfaces:**
- Consumes: `lanzar`/`buscarCompresores` internos de `lib/audio.ts`; `generarWav(segundos)`; `tareaDe`; `guardarTarea`.
- Produces: `cortarAudio(datos: Buffer, tipo: string, cortes: number[]): Promise<{ trozos: Buffer[]; tipo: "audio/mp4" }>`, `duracionDe(datos, tipo): Promise<number>`; `trozosQueEspera(tarea: TareaDele): number | null` (null = no se corta); `guardarGrabacion(tareaId, archivoUrl)`, `cortarGrabacion(tareaId, cortes: number[]): Promise<{ ok: true; avisos: string[]; trozos: number } | { ok: false; error: string }>`; acciones `guardarGrabacionAccion(tareaId, archivoUrl)`, `cortarGrabacionAccion(tareaId, cortes)`.

- [ ] **Step 1: `cortarAudio` y `duracionDe` en `lib/audio.ts`**

Junto a `comprimirAudio`, usando el mismo `lanzar` y solo los compresores cuyo `nombre` empieza por «ffmpeg» (afconvert no corta):

```ts
/** Los ffmpeg disponibles, en orden: el del sistema si lo hay, si no el empaquetado. */
async function ffmpegs(): Promise<Compresor[]> {
  return (await buscarCompresores()).filter((c) => c.nombre.startsWith("ffmpeg"));
}

/** Duración en segundos, leída con ffmpeg (`-f null` y el `time=` del stderr). */
export async function duracionDe(datos: Buffer, tipo: string): Promise<number> {
  const [ff] = await ffmpegs();
  if (!ff) throw new CompresorAusenteError("No hay ffmpeg para leer el audio.");
  const carpeta = await mkdtemp(join(tmpdir(), "duracion-"));
  const entrada = join(carpeta, `in.${extensionDe(tipo)}`);
  try {
    await writeFile(entrada, datos);
    const { error } = await lanzar(ff.orden, ["-nostdin", "-i", entrada, "-f", "null", "-"]);
    const m = [...error.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
    if (!m) throw new Error("No se pudo leer la duración del audio.");
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/**
 * Corta en los segundos dados (ordenados, dentro de la duración) y devuelve
 * un trozo por tramo, en AAC mono a 48 kbps como todo el audio del sitio.
 * Se re-codifica en vez de copiar: copiar corta en el marco AAC anterior y
 * deja hasta 20 ms del diálogo siguiente al final de cada trozo.
 */
export async function cortarAudio(datos: Buffer, tipo: string, cortes: number[]): Promise<{ trozos: Buffer[]; tipo: "audio/mp4" }> {
  const [ff] = await ffmpegs();
  if (!ff) throw new CompresorAusenteError("No hay ffmpeg para cortar el audio.");
  const duracion = await duracionDe(datos, tipo);
  const puntos = [0, ...cortes.filter((c) => c > 0 && c < duracion).sort((a, b) => a - b), duracion];
  const carpeta = await mkdtemp(join(tmpdir(), "cortes-"));
  const entrada = join(carpeta, `in.${extensionDe(tipo)}`);
  try {
    await writeFile(entrada, datos);
    const trozos: Buffer[] = [];
    for (let i = 0; i < puntos.length - 1; i++) {
      const salida = join(carpeta, `t${i}.m4a`);
      const r = await lanzar(ff.orden, ["-y", "-nostdin", "-ss", String(puntos[i]), "-to", String(puntos[i + 1]), "-i", entrada, "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "48k", salida]);
      if (r.codigo !== 0) throw new Error(`ffmpeg no pudo cortar el trozo ${i + 1}: ${r.error.slice(-300)}`);
      trozos.push(await readFile(salida));
    }
    return { trozos, tipo: "audio/mp4" };
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}
```

(`extensionDe(tipo)`: mapa mínimo `audio/mp4|m4a → m4a`, `audio/mpeg|mp3 → mp3`, `audio/wav|wave|x-wav → wav`, `audio/ogg → ogg`, `audio/webm → webm`; si ya existe algo equivalente en el fichero, reutilizarlo.) Comprobar que `next.config.ts` ya traza `ffmpeg-static` para `/api/archivos`; la acción de cortar vive bajo `app/(app)/dele/taller/[id]/tarea/[prueba]/[n]` → añadir esa ruta a `outputFileTracingIncludes` con `./node_modules/ffmpeg-static/ffmpeg`.

- [ ] **Step 2: `lib/taller/audio.ts`**

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TareaDele } from "@/lib/dele/mapa";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { cortarAudio } from "@/lib/audio";
import { revisarDatos } from "@/lib/recursos";
import { tareaDe } from "@/lib/taller/consultas";

/**
 * Cuántos trozos tiene la grabación de una tarea auditiva, según el examen:
 * uno por pregunta (siete diálogos), uno por pareja (seis mensajes), tres
 * noticias con dos preguntas cada una, y una sola conversación que no se
 * corta (null).
 */
export function trozosQueEspera(tarea: TareaDele): number | null {
  if (tarea.formato === "ATTRIB") return null;
  if (tarea.pide.includes("noticias")) return 3;
  return tarea.items;
}

/** La grabación completa: se guarda en la tarea y, mientras no haya trozos, como bloque AUDIO del paso. */
export async function guardarGrabacion(tareaId: string, archivoUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  if (tarea.prueba !== "CO") return { ok: false, error: "Solo las tareas auditivas llevan grabación." };
  const archivoId = archivoUrl.replace(/^\/api\/archivos\//, "");
  const archivo = await prisma.archivo.findUnique({ where: { id: archivoId }, select: { id: true, tipo: true, privado: true } });
  if (!archivo || archivo.privado || !archivo.tipo.startsWith("audio/")) return { ok: false, error: "Ese archivo no es un audio del sitio." };
  await prisma.$transaction(async (tx) => {
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { grabacionArchivoId: archivo.id, cortes: Prisma.DbNull } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "AUDIO" } });
    await tx.bloque.create({ data: { pasoId: tarea.pasoId, tipo: "AUDIO", url: archivoUrl, etiqueta: "Grabación completa", orden: 1 } });
  });
  return { ok: true };
}

/**
 * Corta la grabación en los segundos dados y reparte los trozos: en `opcion`
 * uno por pregunta (o uno por cada dos, en las noticias), en `relacionar`
 * uno por pareja; cada trozo con dos escuchas. Cuando hay trozos, el bloque
 * AUDIO de la grabación completa se retira del paso (el examen blanco los
 * encadena) y se conserva en la tarea para poder volver a cortar.
 */
export async function cortarGrabacion(tareaId: string, cortes: number[]): Promise<{ ok: true; avisos: string[]; trozos: number } | { ok: false; error: string }> {
  const tarea = await tareaDe(tareaId);
  if (!tarea) return { ok: false, error: "Esa tarea ya no existe." };
  if (!tarea.grabacionArchivoId) return { ok: false, error: "Sube antes la grabación de la tarea." };
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) return { ok: false, error: "El mapa no describe esta tarea." };
  const esperados = trozosQueEspera(delMapa);
  if (esperados === null) return { ok: false, error: "Esta tarea se oye entera: no se corta." };
  const archivo = await prisma.archivo.findUnique({ where: { id: tarea.grabacionArchivoId } });
  if (!archivo) return { ok: false, error: "La grabación ya no está." };

  const { trozos, tipo } = await cortarAudio(Buffer.from(archivo.datos), archivo.tipo, cortes);
  const datos = structuredClone(tarea.ejercicio.datos) as { escuchas?: number; preguntas?: { audio?: string }[]; parejas?: { audio?: string }[] };
  const avisos = ((tarea.avisos as string[] | null) ?? []).filter((a) => !a.startsWith("La grabación tiene"));
  if (trozos.length !== esperados) avisos.push(`La grabación tiene ${trozos.length} trozo(s) y el examen espera ${esperados}: revisa los cortes.`);

  // Los trozos de un corte anterior se borran: nadie más los referencia y, si
  // se quedaran, cada nuevo corte dejaría siete archivos huérfanos en la base.
  const listaVieja = delMapa.motor === "relacionar" ? datos.parejas ?? [] : datos.preguntas ?? [];
  const viejos = [...new Set(listaVieja.map((i) => i.audio).filter((u): u is string => Boolean(u)))]
    .map((u) => u.replace(/^\/api\/archivos\//, ""))
    .filter((id) => id !== tarea.grabacionArchivoId);

  const resultado = await prisma.$transaction(async (tx) => {
    if (viejos.length) await tx.archivo.deleteMany({ where: { id: { in: viejos }, privado: false } });
    const urls: string[] = [];
    for (let i = 0; i < trozos.length; i++) {
      const guardado = await tx.archivo.create({ data: { nombre: `${tarea.prueba}-tarea-${tarea.numero}-trozo-${i + 1}.m4a`, tipo, tamano: trozos[i].length, datos: trozos[i], subidoPorId: tarea.examen.creadoPorId }, select: { id: true } });
      urls.push(`/api/archivos/${guardado.id}`);
    }
    const porItem = delMapa.pide.includes("noticias") ? 2 : 1;
    const lista = delMapa.motor === "relacionar" ? datos.parejas ?? [] : datos.preguntas ?? [];
    lista.forEach((item, i) => { item.audio = urls[Math.floor(i / porItem)] ?? undefined; });
    datos.escuchas = 2;
    const revision = revisarDatos(datos);
    if ("error" in revision) throw new Error(revision.error);
    await tx.ejercicio.update({ where: { id: tarea.ejercicio.id }, data: { datos: datos as Prisma.InputJsonValue } });
    await tx.bloque.deleteMany({ where: { pasoId: tarea.pasoId, tipo: "AUDIO" } });
    await tx.tareaDeExamen.update({ where: { id: tareaId }, data: { cortes, avisos } });
    return urls.length;
  });
  return { ok: true, avisos, trozos: resultado };
}
```

- [ ] **Step 3: La guarda de revisar**

En `lib/taller/revision.ts` `motivosParaNoRevisar`, sustituir la comprobación del bloque AUDIO por: en `CO`, si `!tarea.grabacionArchivoId` → «Falta la grabación de la tarea.»; si `trozosQueEspera(delMapa) !== null` y ningún ítem lleva `audio` → «La grabación está sin cortar: marca los cortes y pulsa Cortar.». El motivo antiguo («desde la ficha del paso») desaparece, y el enlace «Subir la grabación» de la sesión B se quita en la Task 4 (lo sustituye el componente de grabación).

- [ ] **Step 4: Las acciones**

`guardarGrabacionAccion(tareaId, archivoUrl): Promise<EstadoGuardado>` y `cortarGrabacionAccion(tareaId, cortes: number[]): Promise<EstadoGuardado>` (valida: array de números finitos ≥ 0, máximo 30; `exigirProfesor`; revalida examen y tarea; en error del compresor devuelve «No se pudo cortar el audio: …» en español). Añadir la ruta de la tarea a `outputFileTracingIncludes` (Step 1).

- [ ] **Step 5: El script**

En `verificar-taller.ts`: generar `generarWav(9)` (nueve segundos), guardarlo como `Archivo` `audio/wav`; `guardarGrabacion(CO1, url)` → `grabacionArchivoId` puesto y bloque AUDIO «Grabación completa»; `trozosQueEspera` para CO1 = 7, CO2 = 6, CO3 = null, CO4 = 3; `cortarGrabacion(CO1, [1.5, 3, 4.5, 6, 7.5, 8.5])` → `ok`, `trozos === 7`, sin aviso de cuenta, las siete preguntas con `audio` distintos, `escuchas === 2`, cero bloques AUDIO en el paso, `cortes` guardados; `cortarGrabacion(CO1, [4.5])` → 2 trozos y aviso «espera 7»; `cortarGrabacion(CO3, [1])` → error «se oye entera». Antes de cortar CO1 hay que darle `datos` válidos (7 preguntas, `guardarTarea` como en la sesión B). Cada `Archivo` de trozo se apunta para la limpieza (buscarlos por `nombre` que empiece por `CO-tarea-`). Si el compresor no está en la máquina (`hayCompresor()` false), el script salta la sección de cortes con un aviso y lo dice; en esta máquina el ffmpeg empaquetado existe, así que debe correr.

- [ ] **Step 6: Comprobar y commitear**

```bash
git add lib/audio.ts lib/taller/audio.ts lib/taller/revision.ts lib/acciones-taller.ts next.config.ts scripts/verificar-taller.ts
git commit -m "Taller C: la grabación se corta en el servidor y cada trozo va a su pregunta con dos escuchas"
```

---

### Task 4: La onda, los marcadores y la subida de la grabación

**Files:**
- Create: `components/taller/onda.tsx`
- Create: `components/taller/grabacion.tsx`
- Modify: `components/taller/revision-tarea.tsx` (monta `Grabacion` en `CO`; quita el enlace «Subir la grabación»)
- Modify: `app/(app)/dele/taller/[id]/tarea/[prueba]/[n]/page.tsx` (props: `grabacionUrl`, `cortesGuardados`, `trozosEsperados`)

**Interfaces:**
- Consumes: `guardarGrabacionAccion`, `cortarGrabacionAccion` (Task 3), `SubirAudio` (`components/recursos/subir-audio.tsx`, props `{ valor?, alCambiar, alFallar? }`), `trozosQueEspera` (Task 3, calculado en la página).
- Produces: `Onda({ src, cortesIniciales, esperados, alCortar, bloqueado })`, `Grabacion({ tareaId, grabacionUrl, cortesGuardados, trozosEsperados, bloqueado })`.

- [ ] **Step 1: `components/taller/onda.tsx`**

Cliente. Al montar: `fetch(src)` → `arrayBuffer` → `new AudioContext().decodeAudioData` → canal 0 → `picos`: 1200 cubos con el máximo absoluto de cada uno; pintar en un `<canvas>` (ancho del contenedor, alto 120) barras `bg` en `hp-200` y marcadores en `coral`. Silencios: ventanas de 100 ms, RMS < 2 % del máximo, tramos ≥ 1,5 s; un marcador propuesto al final de cada tramo (donde vuelve el sonido), saltando los primeros 3 s (las instrucciones); solo se proponen si no hay `cortesIniciales`. Estado: `marcadores: number[]` ordenados. Interacción: clic en la onda añade un marcador en ese tiempo; arrastrar un marcador (mousedown a menos de 6 px, mousemove, mouseup) lo mueve; lista debajo con «mm:ss», «Escuchar 5 s» (un `<audio>` oculto: `currentTime = t; play(); setTimeout(pause, 5000)`) y «Quitar». Encima, el texto «N cortes → N+1 trozos; el examen espera M» en `text-tinta-suave`, en `text-error-600` si no coincide. Botón `Boton variante="primario"` «Cortar y repartir» → `alCortar(marcadores)`; `Boton variante="sutil"` «Proponer cortes por los silencios» (recalcula). Todo con piezas para botones y avisos; el canvas es el único elemento nativo grande. Sin `AudioContext` (Safari viejo) o si la decodificación falla: `Aviso tono="aviso"` «No se pudo dibujar la onda en este navegador; puedes escribir los cortes a mano» y una `Campo` de texto con segundos separados por comas.

El análisis, como funciones puras exportadas del mismo fichero (se afirman en el script con un canal sintético):

```ts
/** El pico de cada cubo, de 0 a 1, para pintar la onda. */
export function picosDe(canal: Float32Array, cubos: number): number[] {
  const porCubo = Math.max(1, Math.floor(canal.length / cubos));
  const picos: number[] = [];
  for (let c = 0; c < cubos; c++) {
    let max = 0;
    const desde = c * porCubo;
    for (let i = desde; i < Math.min(desde + porCubo, canal.length); i++) max = Math.max(max, Math.abs(canal[i]));
    picos.push(max);
  }
  const tope = Math.max(...picos, 1e-6);
  return picos.map((p) => p / tope);
}

/**
 * Dónde vuelve el sonido tras cada silencio largo: ventanas de 100 ms cuyo
 * RMS no llega al 2 % del máximo, encadenadas ≥ 1,5 s, saltando los primeros
 * `saltarSegundos` (las instrucciones). Devuelve segundos, ordenados.
 */
export function silenciosDe(canal: Float32Array, frecuencia: number, saltarSegundos = 3, minimoSegundos = 1.5, umbral = 0.02): number[] {
  const ventana = Math.floor(frecuencia / 10);
  const rms: number[] = [];
  for (let i = 0; i + ventana <= canal.length; i += ventana) {
    let suma = 0;
    for (let j = i; j < i + ventana; j++) suma += canal[j] * canal[j];
    rms.push(Math.sqrt(suma / ventana));
  }
  const tope = Math.max(...rms, 1e-6);
  const cortes: number[] = [];
  let enSilencio = 0;
  for (let v = 0; v < rms.length; v++) {
    if (rms[v] / tope < umbral) { enSilencio++; continue; }
    if (enSilencio * 0.1 >= minimoSegundos) {
      const t = v * 0.1;
      if (t >= saltarSegundos) cortes.push(Number(t.toFixed(1)));
    }
    enSilencio = 0;
  }
  return cortes;
}
```

Afirmaciones en `verificar-taller.ts` (sin base): un canal de 10 s a 1000 Hz con ruido de amplitud 1 salvo silencio total entre 4,0 y 6,0 s → `silenciosDe(canal, 1000)` devuelve `[6]` (con tolerancia ±0,1); el mismo canal con el silencio entre 1,0 y 2,7 s → `[]` (cae dentro de los 3 s saltados); `picosDe` de un canal de ceros con un 1 en el centro devuelve exactamente un cubo a 1 y el resto a 0.

- [ ] **Step 2: `components/taller/grabacion.tsx`**

Cliente. Si no hay `grabacionUrl`: `Rotulo` «Grabación de la tarea» + `SubirAudio valor={undefined} alCambiar={(url) => url && empezar(async () => { const r = await guardarGrabacionAccion(tareaId, url); setMensaje(r); if (!r.error) router.refresh(); })}` (archivo o enlace de Drive, como en el editor de recursos). Si hay: un `<audio controls>` con la grabación completa, `Boton variante="sutil" tamano="pequeno"` «Cambiar la grabación» (vuelve a enseñar `SubirAudio`), y, si `trozosEsperados !== null`, `<Onda src={grabacionUrl} cortesIniciales={cortesGuardados} esperados={trozosEsperados} alCortar={(cortes) => empezar(async () => { const r = await cortarGrabacionAccion(tareaId, cortes); setMensaje(r); if (!r.error) router.refresh(); })} bloqueado={bloqueado} />`; si es null, el texto «Esta tarea se oye entera: no se corta.». Con `bloqueado` (cambios sin guardar), todo deshabilitado con el `title` habitual.

- [ ] **Step 3: Montar y limpiar**

La página pasa `grabacionUrl = tarea.grabacionArchivoId ? `/api/archivos/${tarea.grabacionArchivoId}` : null`, `cortesGuardados = (tarea.cortes as number[] | null) ?? []`, `trozosEsperados = trozosQueEspera(delMapa)` (solo `CO`). `revision-tarea.tsx` monta `<Grabacion>` en `CO` encima del editor y quita el `Boton` «Subir la grabación» y sus props `faltaGrabacion`/`pasoId` de la sesión B. El `key` del editor gana `|${tarea.grabacionArchivoId ?? "-"}|${(tarea.cortes as number[] | null)?.length ?? 0}` para remontar tras subir o cortar.

- [ ] **Step 4: Comprobar, barrido y commitear**

Run: la lista completa (`verificar-piezas.ts` sin excepción nueva: el `<canvas>` y el `<audio controls>` no disparan patrones). Barrido: `GET /dele/taller/<id>/tarea/CO/1` → 200 con «Grabación de la tarea»; con una grabación guardada por script → 200 con «Cortar y repartir». Build de producción.

```bash
git add components/taller 'app/(app)/dele/taller'
git commit -m "Taller C: la onda con marcadores, la propuesta por silencios y la subida de la grabación desde la tarea"
```

---

### Task 5: El examen blanco encadena los trozos

**Files:**
- Create: `components/ejercicios/reproductor-encadenado.tsx`
- Modify: `lib/escuchas.ts:106-135` (`maximoDeEscucha` conoce la clave `encadenado`)
- Modify: `components/ejercicios/opcion.tsx`, `relacionar.tsx` (prop `encadenado`) y `app/(app)/pasos/[pasoId]/page.tsx` (pasa `encadenado` cuando `recorrido.orden === 3`)
- Modify: `scripts/verificar-taller.ts` o `verificar-dele.ts` (la clave `encadenado`)

**Interfaces:**
- Consumes: `Reproductor` (props `{ src, pasoId, clave, maximo, usadas, cerrado }`), `apuntarEscucha`, `escuchasDelPaso`, `PropsCara`.
- Produces: `ReproductorEncadenado({ srcs: string[], pasoId, maximo, usadas, cerrado })`; `PropsCara.encadenado?: boolean`; clave `encadenado` en `maximoDeEscucha`.

- [ ] **Step 1: El reproductor**

`components/ejercicios/reproductor-encadenado.tsx`: un solo botón «Escuchar la tarea entera (N de M)» que reproduce `srcs` seguidos (un `<audio>` y `ended` → siguiente), dos veces seguidas por audición (como el examen: la grabación se repite), y cuenta UNA escucha al empezar con `apuntarEscucha(pasoId, "encadenado")` a través de la misma acción de servidor que usa `Reproductor` (leer cómo la llama y reutilizarla). Con `usadas >= maximo` o `cerrado`, el botón se deshabilita y dice «Ya has oído la tarea las veces del examen». Pausa y reanuda sin gastar otra escucha; no se puede saltar de trozo.

- [ ] **Step 2: La clave**

En `lib/escuchas.ts` `maximoDeEscucha`, antes de mirar la pregunta: si `clave === "encadenado"` y el ejercicio es `opcion` o `relacionar` con algún ítem con `audio`, devolver `analizado.datos.escuchas`. En `scripts/verificar-dele.ts` (donde ya se prueba `maximoDeEscucha`): con un `opcion` con audio en una pregunta, `maximoDeEscucha(paso, "encadenado") === 2`; sin audios, `null`.

- [ ] **Step 3: Las caras**

`PropsCara` gana `encadenado?: boolean`. En `CaraOpcion` y `CaraRelacionar`, cuando `encadenado` y hay ítems con audio: se pinta `ReproductorEncadenado` arriba con `srcs` = los audios en orden (sin repetidos: en las noticias dos preguntas comparten trozo), `usadas={escuchasUsadas["encadenado"] ?? 0}`, `maximo={datos.escuchas}`, y los reproductores por ítem no se pintan. La página del paso pasa `encadenado={paso.recorrido.orden === 3 && paso.recorrido.tipo === "PREPARACION_DELE"}` (el bloque 3 es el examen blanco; `lib/preparacion.ts`).

- [ ] **Step 4: Comprobar y commitear**

Run: la lista completa; `verificar-dele.ts` con la clave nueva. Barrido: un paso de un recorrido con `orden: 3` y una pregunta con audio, con sesión de estudiante asignado → 200 con «Escuchar la tarea entera».

```bash
git add components/ejercicios lib/escuchas.ts 'app/(app)/pasos/[pasoId]/page.tsx' scripts
git commit -m "Taller C: el examen blanco encadena los trozos y los cuenta como una escucha"
```

---

## Fuera de esta sesión

Expresión escrita y oral (Entrega siguiente); otros niveles; corte automático sin marca del profesor; reordenar imágenes pedidas; borrar exámenes (solo archivar).
