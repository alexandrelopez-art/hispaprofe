# La oral grabada — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una tarea de expresión oral pueda grabarse dentro de la aplicación y entregarse al profesor, que la corrige con la misma rúbrica y en la misma bandeja que la escrita.

**Architecture:** la grabación viaja por la columna que ya guarda lo que el alumno manda (`PasoCompletado.entrega`), con la dirección del audio en vez de un texto. La tarea gana un solo campo, `grabada`, que solo significa algo en las orales. Subir y entregar son la misma petición, para que no exista el estado «subido pero sin entregar». Y las grabaciones de alumnos dejan de servirse a quien tenga el enlace.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Prisma 7 con `@prisma/adapter-pg`, zod 4, Clerk, Tailwind, `MediaRecorder` del navegador, `comprimirAudio` de `lib/audio.ts`.

**Diseño:** `docs/superpowers/specs/2026-08-01-oral-grabada-design.md`

## Global Constraints

- **Todos los mensajes de zod, en castellano.** Un `.min(1)` sin `{ message }` sale en inglés en la pantalla del profesor.
- **Las reglas viven fuera de las acciones**, en `lib/`, para que `scripts/verificar-*.ts` pueda ejercitarlas sin sesión.
- **Una acción de servidor y una ruta de `/api` son endpoints públicos.** Lo que limita se lee en el servidor; nada que llegue del cliente decide un permiso.
- **No se crean filas de `PasoCompletado` por algo que no sea «hecho».** Esa fila significa que el paso está hecho: `hecho = Boolean(registro)`.
- **Todo lo de `app/(app)/profe/` particiona por `profesorId`, con excepción de ADMIN**, con la forma exacta de `lib/acciones-expresion.ts:95-101`.
- **Ningún componente `"use client"` importa `lib/expresion.ts`, `lib/citas.ts`, `lib/recursos.ts` ni `lib/ejercicios/registro.ts` como import de valor.** `import type` sí: se borra al compilar.
- **Una página de servidor no puede leer un valor de un módulo `"use client"`.** Al cruzar esa frontera el import no trae el objeto, trae una referencia: `Object.keys` da `[]` y toda propiedad sale `undefined`, sin error. Es el fallo que dejó la lista de «Nuevo ejercicio» vacía el 01/08/2026.
- **Los ids se calculan por máximo de los sufijos + 1**, nunca por `longitud + 1`.
- **Solo tokens de Tailwind del proyecto**: `hp-*`, `sol-*`, `bloque1-3`, `tinta`, `tinta-suave`, `fondo`, `rounded-tarjeta`, `shadow-suave`, `shadow-tarjeta`, más `bg-white` y `text-white`. Ningún color crudo.
- **Interfaz en castellano con tildes.** Comentarios en castellano, cortos, y del porqué y no del qué.
- **Una sola migración en todo el plan**, la de la Tarea 2. La base es la de trabajo de Pablo y tiene datos reales: si `prisma migrate dev` propone un `reset`, parar y avisar.
- **Verificación:** `npx tsc --noEmit`, `npx eslint <rutas propias>` y `npx tsx scripts/verificar-oral-grabada.ts`. No hay framework de tests.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/expresion.ts` | El esquema, y todas las reglas de quién puede entregar, corregir y oír | 1, 2 |
| `lib/citas.ts` | Que una grabada no se cite | 1 |
| `prisma/schema.prisma` | `Archivo.privado` | 2 |
| `app/api/archivos/[id]/route.ts` | Servir un archivo privado solo a quien puede oírlo | 2 |
| `app/api/entregas/audio/route.ts` | Recibir la grabación y entregarla, en un solo acto | 3 |
| `components/recursos/editor-expresion.tsx` | El interruptor «en clase / grabada» | 4 |
| `components/expresion/grabadora.tsx` | Grabar, escucharse, repetir y entregar | 5 |
| `components/expresion/entrega.tsx` | Elegir qué se pinta según la modalidad | 5 |
| `app/(app)/profe/entregas/page.tsx` | Que la bandeja diga la verdad | 6 |
| `app/(app)/profe/entregas/[id]/page.tsx` | Reproductor donde la escrita enseña el texto | 6 |
| `app/(app)/profe/alumnos/[id]/page.tsx` | La regla de la fila, y citar solo las de clase | 6 |
| `scripts/verificar-oral-grabada.ts` | Las afirmaciones de todo lo anterior | 1, 2, 3 |

---

## Task 1: El campo `grabada` y las reglas que dependen de él

**Files:**
- Modify: `lib/expresion.ts`
- Modify: `lib/citas.ts:15-50` (`puedeCitarse`)
- Modify: `lib/acciones-expresion.ts:161` (la llamada a `puedeCitarse`)
- Modify: `scripts/verificar-expresion.ts:281-303` (las llamadas a `puedeCitarse`)
- Create: `scripts/verificar-oral-grabada.ts`

**Interfaces:**
- Consume: `expresionSchema`, `analizarExpresion`, `expresionDelPaso`, `puedeValorarse`, `puedeEntregar` — todos ya existen en `lib/expresion.ts`.
- Produce, y las tareas siguientes cuentan con estos nombres exactos:
  - `Expresion` gana el campo `grabada: boolean`.
  - `export function esGrabada(datos: Expresion): boolean`
  - `export const MAXIMO_AUDIO_RECIBIDO = 50 * 1024 * 1024`
  - `export const MAXIMO_AUDIO_GUARDADO = 10 * 1024 * 1024`
  - `export const MINUTOS_MAXIMOS_GRABACION = 15`
  - `export async function puedeEntregarAudio(asignacionId: string, pasoId: string): Promise<string | null>`
  - `puedeCitarse(asignacionId, pasoId, claseId, profesorId)` — **cambia de firma**, gana `pasoId` en segundo lugar.

- [ ] **Step 1: Añadir `grabada` al esquema**

En `lib/expresion.ts`, dentro del `z.object`, justo después de `minutos`:

```ts
    /**
     * Solo en las orales: si el alumno la graba y la manda en vez de hacerla
     * en clase. Con valor por defecto para que las orales ya guardadas sigan
     * siendo lo que eran cuando se crearon: de clase.
     */
    grabada: z.boolean().default(false),
```

Y un `.refine` más, detrás del último:

```ts
  .refine((d) => d.modalidad === "oral" || !d.grabada, {
    message: "Solo una tarea oral se puede grabar: en una escrita eso no significa nada.",
  })
```

- [ ] **Step 2: Añadir `esGrabada` y los topes**

Debajo de `versionPublicaExpresion`:

```ts
/** Si esta tarea se graba y se entrega, en vez de hacerse en clase. */
export function esGrabada(datos: Expresion): boolean {
  return datos.modalidad === "oral" && datos.grabada;
}

/**
 * Lo que aceptamos recibir de un alumno, antes de comprimir. Cincuenta megas
 * dejan pasar un archivo del móvil sin abrir la puerta a una película.
 */
export const MAXIMO_AUDIO_RECIBIDO = 50 * 1024 * 1024;

/**
 * Lo que aceptamos guardar, ya comprimido. Quince minutos rondan los 5 MB, así
 * que diez son holgados: está para que un audio que el compresor no logre
 * encoger no entre entero en la base.
 */
export const MAXIMO_AUDIO_GUARDADO = 10 * 1024 * 1024;

/**
 * El tope duro de la grabadora. Los minutos de la tarea solo avisan —pasarse
 * es un error que puntúa el profesor, y cortar a media frase es la peor forma
 * de enterarse—; esto es lo que impide una grabación de dos horas.
 */
export const MINUTOS_MAXIMOS_GRABACION = 15;
```

- [ ] **Step 3: `puedeValorarse` exige entrega también en las grabadas**

Sustituir el primer bloque de `puedeValorarse` (líneas 141-143) por:

```ts
  // Se puntúa lo que se ha leído o lo que se ha oído. Una oral de clase es la
  // excepción a propósito: ahí no hay entrega y valorar sin ella es lo normal.
  if ((datos.modalidad === "escrita" || esGrabada(datos)) && !entrega) {
    return "El alumno todavía no ha entregado nada: no se puede corregir.";
  }
```

Y actualizar el docstring de la función, que hoy dice «En una oral no aplica», para que diga que la excepción es solo la oral de clase.

- [ ] **Step 4: `puedeEntregar` rechaza las grabadas, y nace `puedeEntregarAudio`**

En `puedeEntregar`, sustituir la comprobación de modalidad por tres negativas
separadas. Separadas y no encadenadas en una sola condición porque `datos`
puede ser `null` y `esGrabada(null)` reventaría, y porque el alumno que manda
un texto a una tarea grabada merece que se lo digan, no un «este paso no pide
ninguna redacción» que no describe lo que pasa:

```ts
  const datos = await expresionDelPaso(pasoId);
  if (!datos) return "Este paso no pide ninguna redacción.";
  if (esGrabada(datos)) return "Esta tarea se entrega grabada, no escrita.";
  if (datos.modalidad !== "escrita") return "Este paso no pide ninguna redacción.";
```

Y debajo de `puedeEntregar`, su hermana:

```ts
/**
 * Si el alumno todavía puede mandar una grabación en este paso, o el motivo
 * del no.
 *
 * Las mismas dos negativas que la escrita, menos la del tamaño: ahí lo que
 * llega es un archivo, y su tope lo comprueba la ruta con `MAXIMO_AUDIO_RECIBIDO`
 * antes de leerlo entero en memoria.
 */
export async function puedeEntregarAudio(
  asignacionId: string,
  pasoId: string,
): Promise<string | null> {
  const datos = await expresionDelPaso(pasoId);
  if (!datos || !esGrabada(datos)) {
    return "Este paso no pide ninguna grabación.";
  }

  const registro = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId, pasoId } },
    select: { verificadoEl: true },
  });
  if (registro?.verificadoEl) {
    return "Esta tarea ya está corregida: no se puede cambiar lo entregado.";
  }
  return null;
}
```

- [ ] **Step 5: Una grabada no se cita**

`puedeCitarse` en `lib/citas.ts` gana `pasoId` como segundo parámetro y una cuarta negativa, la primera de todas porque es la que no depende de la clase:

```ts
export async function puedeCitarse(
  asignacionId: string,
  pasoId: string,
  claseId: string,
  profesorId: string | null,
): Promise<string | null> {
  // Una grabada no se agenda: se entrega cuando el alumno quiera.
  const tarea = await expresionDelPaso(pasoId);
  if (tarea && esGrabada(tarea)) {
    return "Esa tarea se entrega grabada: no hay nada que citar.";
  }
  ...
```

Con `import { esGrabada, expresionDelPaso } from "@/lib/expresion";` arriba. Los dos módulos son de servidor, así que no hay frontera que cruzar.

Actualiza la llamada de `citarOral` en `lib/acciones-expresion.ts:161` y las seis de `scripts/verificar-expresion.ts:281-303`, que ya tienen un `pasoId` a mano.

- [ ] **Step 6: El script nuevo, con las afirmaciones de esta tarea**

Crea `scripts/verificar-oral-grabada.ts` copiando la forma exacta de `scripts/verificar-expresion.ts`: `afirmar(condicion, texto)`, siembra con una `marca` única, y **limpieza en un `.finally()` que ponga `process.exitCode`**, para que un fallo no deje filas sueltas en la base de Pablo.

Afirmaciones de esta tarea, y **todas tienen que discriminar**: una que pase con y sin el arreglo no prueba nada. Por eso van en pares, el caso que sí y el caso que no:

```
- una oral con `grabada: true` es válida
- una oral sin `grabada` es válida y sale `false` (el valor por defecto)
- una escrita con `grabada: true` se rechaza, y el mensaje lo dice
- `esGrabada` es cierto en una oral grabada y falso en una oral de clase
- `puedeValorarse` rechaza una grabada sin entrega
- `puedeValorarse` acepta una oral de clase sin entrega
- `puedeEntregar` (texto) rechaza el paso de una grabada
- `puedeEntregarAudio` acepta el paso de una grabada
- `puedeEntregarAudio` rechaza el paso de una oral de clase
- `puedeEntregarAudio` rechaza el paso de una escrita
- `puedeEntregarAudio` rechaza un paso sin ejercicio
- `puedeEntregarAudio` rechaza después de corregir
- `puedeCitarse` rechaza una grabada
- `puedeCitarse` acepta una oral de clase en una clase suya
```

- [ ] **Step 7: Comprobar**

```
npx tsc --noEmit
npx eslint lib/expresion.ts lib/citas.ts lib/acciones-expresion.ts scripts/verificar-oral-grabada.ts scripts/verificar-expresion.ts
npx tsx scripts/verificar-oral-grabada.ts
npx tsx scripts/verificar-expresion.ts
```

Los dos scripts tienen que acabar con su «Todo bien». El segundo importa: es el que dice que la firma nueva de `puedeCitarse` no rompió el diseño C.

- [ ] **Step 8: Commit**

```bash
git add lib/expresion.ts lib/citas.ts lib/acciones-expresion.ts scripts/verificar-oral-grabada.ts scripts/verificar-expresion.ts
git commit -m "La tarea oral sabe si se graba, y las reglas que eso cambia"
```

---

## Task 2: El archivo privado

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Archivo`)
- Create: `prisma/migrations/<fecha>_archivo_privado/migration.sql` (la genera Prisma)
- Modify: `lib/expresion.ts` (añadir `puedeOirse`)
- Modify: `app/api/archivos/[id]/route.ts`
- Modify: `scripts/verificar-oral-grabada.ts`

**Interfaces:**
- Consume: `esGrabada` de la Tarea 1.
- Produce: `export async function puedeOirse(archivoId: string, usuario: { id: string; role: string } | null): Promise<boolean>`, y la columna `Archivo.privado`.

- [ ] **Step 1: La columna**

En `prisma/schema.prisma`, dentro de `model Archivo`, detrás de `datos`:

```prisma
  /// Una entrega de un alumno, no material del profesor: se sirve solo a su
  /// autor, a su profesor y al administrador, y no se cachea en público.
  privado     Boolean  @default(false)
```

- [ ] **Step 2: Crear la migración**

```
npx prisma migrate dev --name archivo_privado
```

**Si propone un `reset`, para y avisa**: la base es la de trabajo de Pablo y tiene datos reales. Que proponga un reset significa deriva —otra rama aplicó algo—, y la salida no es aceptar.

- [ ] **Step 3: `puedeOirse`, en `lib/expresion.ts`**

```ts
/**
 * Si esta persona puede oír este archivo.
 *
 * Un archivo que no es privado se sirve a cualquiera, como hasta ahora: son
 * las imágenes y los audios de los ejercicios, material del profesor con una
 * dirección imposible de adivinar.
 *
 * Uno privado es la voz de un alumno, y solo lo oyen tres: su autor, el
 * profesor de la asignación donde está entregado, y un administrador. Al
 * profesor se le reconoce por dónde está la entrega, que es lo que ata la
 * grabación a una asignación y esa asignación a un profesor.
 *
 * Vive aquí y no dentro de la ruta para que el script pueda ejercitarla con
 * los cinco casos sin levantar un servidor.
 */
export async function puedeOirse(
  archivoId: string,
  usuario: { id: string; role: string } | null,
): Promise<boolean> {
  const archivo = await prisma.archivo.findUnique({
    where: { id: archivoId },
    select: { privado: true, subidoPorId: true },
  });
  if (!archivo) return false;
  if (!archivo.privado) return true;
  if (!usuario) return false;
  if (usuario.role === "ADMIN") return true;
  if (archivo.subidoPorId === usuario.id) return true;

  // El profesor de la asignación donde está entregado. Sin índice sobre
  // `entrega` a propósito: esa columna guarda redacciones enteras y un índice
  // btree de Postgres revienta pasados unos 2.700 bytes, así que indexarla
  // rompería la entrega de un texto largo.
  const entregado = await prisma.pasoCompletado.findFirst({
    where: { entrega: `/api/archivos/${archivoId}` },
    select: { asignacion: { select: { profesorId: true } } },
  });
  return entregado?.asignacion.profesorId === usuario.id;
}
```

- [ ] **Step 4: La ruta pregunta antes de servir**

En `app/api/archivos/[id]/route.ts`, entre leer el archivo y devolverlo:

```ts
  const usuario = await getUsuarioActual();
  if (!(await puedeOirse(id, usuario))) {
    // El mismo 404 que si no existiera: decir «no puedes» confirma que existe.
    return new Response("No encontrado", { status: 404 });
  }
```

Y la cabecera de caché deja de ser siempre pública:

```ts
      "Cache-Control": archivo.privado
        ? "private, no-store"
        : "public, max-age=31536000, immutable",
```

Para eso el `select` de la consulta necesita también `privado`. Actualiza el docstring de la ruta, que hoy dice «Sin comprobación de sesión a propósito».

- [ ] **Step 5: Afirmaciones**

En `scripts/verificar-oral-grabada.ts`, con dos alumnos, dos profesores y un administrador sembrados:

```
- un archivo NO privado se sirve sin sesión (`puedeOirse(id, null)` es cierto)
- un archivo privado no se sirve sin sesión
- un archivo privado se le sirve a su autor
- un archivo privado NO se le sirve a otro alumno
- un archivo privado se le sirve al profesor de la asignación donde está entregado
- un archivo privado NO se le sirve a otro profesor
- un archivo privado se le sirve a un administrador
- un archivo que no existe da falso, sin reventar
```

Las dos negativas son las que discriminan: sin ellas, una implementación que devolviera siempre `true` pasaría igual.

- [ ] **Step 6: Comprobar y commitear**

```
npx tsc --noEmit
npx eslint lib/expresion.ts "app/api/archivos/[id]/route.ts" scripts/verificar-oral-grabada.ts
npx tsx scripts/verificar-oral-grabada.ts
```

```bash
git add prisma/schema.prisma prisma/migrations lib/expresion.ts "app/api/archivos/[id]/route.ts" scripts/verificar-oral-grabada.ts
git commit -m "La grabación de un alumno solo la oyen él, su profe y el administrador"
```

---

## Task 3: La puerta de la entrega

**Files:**
- Create: `app/api/entregas/audio/route.ts`
- Modify: `scripts/verificar-oral-grabada.ts`

**Interfaces:**
- Consume: `puedeEntregarAudio`, `MAXIMO_AUDIO_RECIBIDO`, `MAXIMO_AUDIO_GUARDADO` (Tarea 1); `comprimirAudio` y `CompresorAusenteError` de `lib/audio.ts`.
- Produce: `POST /api/entregas/audio`, que recibe `FormData` con `pasoId` y `archivo`, y responde `{ ok: true }` o `{ error: "..." }` con su código.

- [ ] **Step 1: La ruta**

Copia la forma de `app/api/archivos/route.ts`, que ya resuelve el `formData()` que revienta, la lista de tipos de audio y el compresor. Diferencias, y son el motivo de que sea una ruta aparte y no un parámetro más de aquella:

- **Es de alumnos**, no de profesores: el 403 de `/api/archivos` es justo lo contrario de lo que hace falta aquí.
- **Solo audio.** Nada de imágenes.
- **Subir y entregar son el mismo acto.** No devuelve una dirección para que alguien la use luego: escribe la entrega. Así no existe el estado «subido pero sin entregar», que es de donde salen los archivos huérfanos.

El orden de las comprobaciones importa, y es este:

```ts
export async function POST(peticion: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario) return Response.json({ error: "No hay sesión." }, { status: 403 });

  // 1. El formulario
  //    (el try/catch de `formData()`, igual que en /api/archivos)
  // 2. `pasoId` y `archivo`, los dos presentes y `archivo instanceof File`
  // 3. El paso existe → su `recorridoId`
  // 4. La asignación de ESTE usuario a ESE recorrido, viva (no archivada).
  //    Nada de aceptar un `asignacionId` del formulario: se deriva de la
  //    sesión y del paso, igual que hace `entregar` en lib/acciones-expresion.ts.
  // 5. `puedeEntregarAudio(asignacion.id, pasoId)` → si devuelve motivo, 400
  // 6. El tipo está en la lista de audios; si no, 400 con mensaje propio
  // 7. `archivo.size > MAXIMO_AUDIO_RECIBIDO` → 400
  // 8. `comprimirAudio`, con el mismo tratamiento de `CompresorAusenteError`
  //    (500, es culpa del servidor) y del resto (400, es culpa del archivo)
  // 9. `datos.length > MAXIMO_AUDIO_GUARDADO` → 400
  // 10. `prisma.archivo.create({ ..., privado: true, subidoPorId: usuario.id })`
  // 11. `upsert` de PasoCompletado con `entrega: "/api/archivos/" + id`
  // 12. revalidar: `/pasos/<pasoId>`, `/profe/entregas`, `/dashboard` y
  //     `/profe/alumnos/<usuario.id>`, exactamente lo que revalida `entregar`
}
```

La lista de tipos de audio se copia de `app/api/archivos/route.ts` con su comentario: un mismo formato llega con nombres distintos según el navegador, y grabar produce `audio/webm` en Chrome y Firefox y `audio/mp4` en Safari. Los dos ya están en esa lista.

**El nombre del archivo:** una grabación del navegador no trae nombre. Ponle uno legible tú —`grabacion.webm` o lo que diga su tipo— antes de pasárselo a `comprimirAudio`, que lo usa para nombrar el temporal.

**No borres la grabación anterior** al entregar una nueva. Es tentador y está mal: si el borrado ocurre antes de que la nueva esté escrita y algo falla en medio, el alumno se queda sin ninguna de las dos. Los archivos viejos se quedan, que es lo mismo que ya pasa con los audios de los ejercicios.

- [ ] **Step 2: Afirmaciones**

Una ruta no se puede llamar desde un script sin levantar el servidor, así que lo que se afirma es lo que la ruta usa, que ya vive en `lib/`. Añade lo que falte para que quede cubierto el camino entero:

```
- `puedeEntregarAudio` con la asignación de OTRO alumno sobre ese paso rechaza
- una entrega escrita en `entrega` deja el paso hecho (`hecho = Boolean(registro)`)
- guardar una segunda entrega sobre la misma fila no crea una fila nueva
- guardar una segunda entrega no borra `valoracion` si ya la hubiera
```

- [ ] **Step 3: Comprobar y commitear**

```
npx tsc --noEmit
npx eslint app/api/entregas/audio/route.ts scripts/verificar-oral-grabada.ts
npx tsx scripts/verificar-oral-grabada.ts
```

```bash
git add app/api/entregas/audio/route.ts scripts/verificar-oral-grabada.ts
git commit -m "Subir la grabación y entregarla son la misma petición"
```

---

## Task 4: El interruptor en el editor

**Files:**
- Modify: `components/recursos/editor-expresion.tsx:73-99`

**Interfaces:**
- Consume: `DatosExpresion`, el tipo local del propio archivo, que gana `grabada?: boolean`.
- Produce: nada que lean otras tareas.

- [ ] **Step 1: El tipo local**

`DatosExpresion` está declarado en el propio archivo (líneas 8-20). Añádele:

```ts
  /** Solo en las orales: si el alumno la graba en vez de hacerla en clase. */
  grabada?: boolean;
```

- [ ] **Step 2: El desplegable, debajo del de modalidad**

Solo cuando `d.modalidad === "oral"`. Dos opciones, y el texto de ayuda cambia con ellas:

```tsx
      {!esEscrita && (
        <label className="block w-72 text-sm font-semibold text-tinta">
          ¿Dónde se hace?
          <select
            value={d.grabada ? "grabada" : "clase"}
            onChange={(e) => cambiar({ grabada: e.target.value === "grabada" })}
            className={campo}
          >
            <option value="clase">En clase, contigo delante</option>
            <option value="grabada">La graba y te la manda</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            {d.grabada
              ? "El alumno graba su respuesta en la aplicación y te llega a Entregas."
              : "La citas en una de sus clases y la evalúas con él delante."}
          </span>
        </label>
      )}
```

- [ ] **Step 3: Al cambiar de modalidad, `grabada` vuelve a su sitio**

En el `onChange` del desplegable de modalidad (líneas 79-88), la rama de «escrita» tiene que apagar también `grabada`:

```ts
                ? { modalidad, palabras: { minimo: 100, maximo: 120 }, minutos: undefined, grabada: false }
```

Sin esto, marcar «grabada» en una oral y volver a escrita deja una escrita con `grabada: true`, que el esquema rechaza al guardar con un mensaje sobre un campo que ya no se ve en pantalla. Es exactamente el callejón de las opciones fuera de rango del diseño A.

- [ ] **Step 4: El texto de ayuda de la modalidad oral**

Hoy dice, para las orales: «No hay entrega: la evalúas con el alumno delante, en clase». Ya no es verdad siempre. Déjalo hablando solo de lo que la modalidad significa, y que el detalle lo dé el desplegable nuevo.

- [ ] **Step 5: Comprobar y commitear**

```
npx tsc --noEmit
npx eslint components/recursos/editor-expresion.tsx
```

```bash
git add components/recursos/editor-expresion.tsx
git commit -m "Al crear una oral se elige si es de clase o grabada"
```

---

## Task 5: La grabadora

**Files:**
- Create: `components/expresion/grabadora.tsx`
- Modify: `components/expresion/entrega.tsx`
- Modify: `app/(app)/pasos/[pasoId]/page.tsx:308-313` (`escrita` → `entregable`)

**Interfaces:**
- Consume: `MINUTOS_MAXIMOS_GRABACION` — **como `import type` no vale**: es un valor. Y `lib/expresion.ts` arrastra `prisma`, así que un componente de cliente no puede importarlo. **Escribe el 15 en `grabadora.tsx` con un comentario que diga que es el mismo tope que `MINUTOS_MAXIMOS_GRABACION`**, igual que el proyecto ya duplica topes entre cliente y servidor.
- Produce: `<Grabadora pasoId minutos entrega cerrada />`.

- [ ] **Step 1: El componente**

`components/expresion/grabadora.tsx`, `"use client"`. Estados: `"inicio" | "grabando" | "grabado" | "enviando"`.

Lo que tiene que hacer, y las trampas de cada parte:

- **Preguntar por `MediaRecorder` antes de pintar el botón.** Si no existe, o si `getUserMedia` falla —permiso denegado, sin micrófono—, se pinta el rodeo: un `<input type="file" accept="audio/*">` que manda al mismo sitio. Es la única puerta de repuesto y no es opcional.
- **Parar la pista al terminar.** `stream.getTracks().forEach(t => t.stop())` al parar y al desmontar. Sin eso, el punto rojo del navegador se queda encendido y el micrófono ocupado.
- **`URL.createObjectURL` para escucharse**, y `URL.revokeObjectURL` al repetir y al desmontar.
- **El contador de tiempo**, con `setInterval` de un segundo, limpiado en el `return` del `useEffect`. Enseña `m:ss`.
- **Aviso al pasarse de los minutos de la tarea**, que no bloquea, con las mismas palabras que el contador de palabras de la escrita: «Puedes entregarlo igual, pero cuenta para la nota».
- **Corte duro a los 15 minutos:** el `MediaRecorder` se para solo y lo dice.
- **Entregar:** `FormData` con `pasoId` y `archivo`, `fetch("/api/entregas/audio", { method: "POST", body })`. Si va bien, `router.refresh()` de `next/navigation` para que la página vuelva a pintarse con la entrega guardada. Si va mal, el `error` del JSON tal cual en pantalla, en el mismo recuadro que usa `entrega.tsx`.
- **Si falla el envío, no se pierde lo grabado.** Sigue en pantalla, con su reproductor y su botón, hasta que entre.

Si ya hay entrega (`entrega` no es nulo), lo primero que se ve es esa grabación con su reproductor, y debajo **«Volver a grabar»**, que devuelve el componente al estado inicial. Si `cerrada` es cierto, solo el reproductor: ni grabar ni entregar.

- [ ] **Step 2: `entrega.tsx` elige qué pintar**

Hoy decide entre dos ramas con `publica.modalidad === "oral"`. Pasa a decidir entre tres:

```tsx
      {publica.modalidad === "oral" && !publica.grabada ? (
        // Lo de hoy: la línea de «esta tarea se hace en clase» y la cita.
      ) : publica.modalidad === "oral" ? (
        <Grabadora
          pasoId={pasoId}
          minutos={publica.minutos ?? 0}
          entrega={entrega}
          cerrada={cerrada}
        />
      ) : (
        // El formulario de texto de hoy, sin tocar.
      )}
```

`ExpresionPublica` ya llevará `grabada` porque sale de `Expresion`. El bloque de la corrección y el del texto modelo, debajo, valen igual para las tres.

- [ ] **Step 3: La página del paso no pinta «Hecho ✓» sobre una grabada**

En `app/(app)/pasos/[pasoId]/page.tsx:312-313`, `escrita` pasa a ser «esto se marca solo al entregar»:

```ts
  // Entregar es lo que marca el paso, así que el par «marcar / Hecho ✓» sobra
  // —y peor que sobrar: «Hecho ✓» desmarca, y desmarcar borraba la entrega—.
  // Vale para la escrita y para la oral grabada. La oral de clase se queda:
  // ahí marcar sigue siendo la única señal que da el alumno.
  const entregable =
    expresion?.modalidad === "escrita" || (expresion?.modalidad === "oral" && expresion.grabada);
  const marcable = puedeMarcar && !entregable;
```

Renombra los usos de `escrita` a `entregable`. Es el único sitio donde se usa.

- [ ] **Step 4: La cita solo se busca en las orales de clase**

Cuatro líneas más abajo, la consulta de `CitaOral` se hace con `expresion?.modalidad === "oral"`. Una grabada no se cita nunca, así que esa consulta sobra en su caso: añade la condición.

- [ ] **Step 5: Comprobar**

```
npx tsc --noEmit
npx eslint components/expresion/grabadora.tsx components/expresion/entrega.tsx "app/(app)/pasos/[pasoId]/page.tsx"
npx tsx scripts/verificar-expresion.ts
```

Ese último comprueba que la pantalla del alumno no se ha llevado por delante nada del diseño C.

- [ ] **Step 6: Commit**

```bash
git add components/expresion/grabadora.tsx components/expresion/entrega.tsx "app/(app)/pasos/[pasoId]/page.tsx"
git commit -m "El alumno graba, se escucha, repite y entrega"
```

---

## Task 6: Las pantallas del profesor

**Files:**
- Modify: `app/(app)/profe/entregas/page.tsx:53-56`
- Modify: `app/(app)/profe/entregas/[id]/page.tsx:73-80`
- Modify: `app/(app)/profe/alumnos/[id]/page.tsx` (la regla de la fila y el bloque de citar)

**Interfaces:**
- Consume: `esGrabada` y `analizarExpresion` de `lib/expresion.ts`. Las tres son páginas de servidor, así que el import de valor es legal.
- Produce: nada.

- [ ] **Step 1: La bandeja dice la verdad**

El párrafo de `entregas/page.tsx:53-56` dice hoy que las orales no salen ahí. Ya solo es cierto de las de clase. Reescríbelo para que distinga las dos, en una frase.

El resto de la página no cambia: filtra por `entrega: { not: null }`, y una grabada tiene entrega.

- [ ] **Step 2: La pantalla de corrección enseña un reproductor**

En `entregas/[id]/page.tsx`, el bloque `{registro.entrega && (...)}` de las líneas 73-80 enseña «Lo que escribió» y el texto. Pasa a decidir por la tarea, que ya está analizada ahí mismo en `datos`:

```tsx
      {registro.entrega && (
        <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
            {esGrabada(datos) ? "Lo que grabó" : "Lo que escribió"}
          </p>
          {esGrabada(datos) ? (
            <audio controls preload="none" src={registro.entrega} className="mt-3 w-full max-w-md">
              Tu navegador no puede reproducir este audio.
            </audio>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-tinta">
              {registro.entrega}
            </p>
          )}
        </section>
      )}
```

- [ ] **Step 3: La regla de la fila, en la ficha del alumno**

Hoy la fila de cada paso decide entre tres cosas. Con la grabada son cuatro, y la forma no cambia porque **una grabada se comporta exactamente como una escrita**:

- Asignación que no es de este profesor → solo el rótulo del estado.
- **Oral de clase** → la rúbrica: en línea si no hay registro, el enlace si lo hay.
- **Oral grabada o escrita** → el enlace a corregir si hay entrega; el campo de puntos a mano si no la hay.

Localiza dónde se calcula hoy `conRubrica` y añade `esGrabada` a esa cuenta, en vez de escribir una rama nueva: la regla es «la rúbrica en línea es solo de las orales de clase».

- [ ] **Step 4: Citar, solo en las orales de clase**

El bloque de `<CitarOral>` se pinta hoy con `expresion?.modalidad === "oral"`. Añádele que no sea grabada. `puedeCitarse` ya lo rechaza desde la Tarea 1 —el tope de verdad está en el servidor—, pero un desplegable que solo sirve para recibir un no no debe estar en pantalla.

- [ ] **Step 5: Comprobar**

```
npx tsc --noEmit
npx eslint "app/(app)/profe/entregas/page.tsx" "app/(app)/profe/entregas/[id]/page.tsx" "app/(app)/profe/alumnos/[id]/page.tsx"
npx tsx scripts/verificar-oral-grabada.ts
npx tsx scripts/verificar-expresion.ts
```

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/profe/entregas/page.tsx" "app/(app)/profe/entregas/[id]/page.tsx" "app/(app)/profe/alumnos/[id]/page.tsx"
git commit -m "Escuchar la grabación desde la bandeja y desde la ficha"
```

---

## La comprobación a mano

Ningún script puede probar un micrófono. Al terminar las seis tareas, esto es lo que hay que hacer con las manos, y **es parte del plan, no un extra**:

1. Crear una expresión oral con «La graba y te la manda», publicarla y engancharla a un paso.
2. Como alumno: grabar, escucharse, repetir, entregar.
3. Denegar el permiso del micrófono y comprobar que aparece el rodeo del archivo.
4. Como profesor: oírla en `/profe/entregas` y corregirla con la rúbrica.
5. Como alumno: ver la nota, el comentario y el texto modelo.
6. Copiar la dirección del audio y abrirla en una ventana privada, sin sesión: **tiene que dar 404**.

El punto 6 es el que prueba que la privacidad no es solo una intención.
