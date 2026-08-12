# El audio de una prueba, racionado de verdad — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un enlace de Drive en un bloque de audio lo traiga el servidor, para que el bloque nazca `AUDIO` con los bytes dentro y el `Reproductor` lo racione.

**Architecture:** No se construye nada nuevo: se recablea. `components/recursos/subir-audio.tsx` ya trae audio de una dirección y devuelve `/api/archivos/<id>`; se conecta al editor de bloques igual que `SubirImagen` ya está conectado. La regla que decide qué es un enlace de Drive va a un módulo nuevo y puro, `lib/bloques.ts`, y el portero que la aplica lo comparten las dos acciones que escriben bloques.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Prisma 7, TypeScript. Sin framework de test: la verificación es un script `npx tsx` con `afirmar`, como el resto del proyecto.

## Global Constraints

- Diseño de referencia: `docs/superpowers/specs/2026-08-12-audio-racionado-design.md`. Ante cualquier duda, manda el spec.
- **Esto NO es el Next.js de tu memoria.** Antes de escribir código de framework, lee la guía que toque en `node_modules/next/dist/docs/`. Lo pide `AGENTS.md`.
- Todo el código, los comentarios y los textos de pantalla **en castellano**, con el tono del proyecto: se explica el porqué, no el qué.
- **`lib/bloques.ts` no puede importar nada de servidor.** Lo van a importar componentes de cliente. Ni `prisma`, ni `node:crypto`, ni `lib/audio.ts`, ni `lib/enlaces.ts` (que arrastra `ffmpeg-static`).
- **Los dos detectores no son intercambiables.** `idDrive` reconoce `drive.google.com/file/d/XXX`, `open?id=XXX` y `?id=XXX` — la forma que se copia del navegador. `esAudioDeDrive` es «de Drive **y acaba en** `/preview`» — la forma ya convertida. **El portero usa `idDrive`; la marca usa `esAudioDeDrive`.** Al revés, el portero deja pasar todo salvo lo que ya estaba bien.
- El portero es **estrecho**: solo `AUDIO` + Drive. Un `EMBED` de un vídeo de Drive sigue entrando; una dirección directa que no sea de Drive en un `AUDIO` también.
- Una afirmación de test que no puede fallar es un defecto. Si añades afirmaciones, que puedan fallar, y compruébalo rompiéndolas.
- Sin dependencias nuevas. No se toca `maximoDeEscucha`. No se migra ningún bloque existente.
- Verificación: `npx tsx scripts/verificar-bloques-audio.ts`, `npx tsc --noEmit`, `npm run lint`.

## Estructura de archivos

| Archivo | De qué responde |
|---|---|
| `lib/bloques.ts` (nuevo) | Lo que se sabe de un bloque sin preguntarle a la base: los dos detectores de Drive y el portero del audio. Puro, importable desde cliente y servidor. |
| `lib/acciones.ts` (modificar) | `crearBloque` y `editarBloque` preguntan al portero y devuelven el motivo. |
| `components/recursos/subir-audio.tsx` (modificar) | Gana la prop opcional `alFallar`. |
| `app/(app)/pasos/[pasoId]/editor-bloques.tsx` (modificar) | La rama `AUDIO` usa `SubirAudio`; se quita la conversión automática a `EMBED`; la escotilla; la ayuda. |
| `app/(app)/pasos/[pasoId]/bloque-editable.tsx` (modificar) | `SubirAudio` en el formulario de edición, y la marca del audio incrustado. |
| `app/(app)/pasos/[pasoId]/page.tsx` (modificar) | Importa `esAudioDeDrive` en vez de definirla, y le pasa `racionado` a `BloqueEditable`. |
| `scripts/verificar-bloques-audio.ts` (nuevo) | Las afirmaciones del portero, de los detectores y del racionamiento. |

### Lo que el script NO puede verificar, y por qué se dice

`crearBloque` y `editarBloque` llaman a `exigirProfesor()`, así que un script no las puede ejercitar sin sesión. Por eso **la regla vive en `lib/` y el script la prueba directamente**; que las dos acciones la llamen de verdad lo comprueba la revisión leyendo el diff. Fingir lo contrario sería una afirmación que no prueba lo que dice su mensaje.

---

### Task 1: El módulo puro y sus dos detectores

**Files:**
- Create: `lib/bloques.ts`
- Create: `scripts/verificar-bloques-audio.ts`
- Modify: `app/(app)/pasos/[pasoId]/page.tsx` (quitar `esAudioDeDrive` de la línea 68 e importarla)
- Modify: `app/(app)/pasos/[pasoId]/editor-bloques.tsx` (quitar `idDrive` de la línea 72 e importarla)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export function idDrive(entrada: string): string`
  - `export function esAudioDeDrive(url: string | null): boolean`
  - `export function motivoSiAudioDeDrive(tipo: string, url: string | null): string | null`

- [ ] **Step 1: Escribe el verificador con las afirmaciones de los detectores y del portero**

Crea `scripts/verificar-bloques-audio.ts`:

```ts
/**
 * Verifica el portero del audio de un bloque y los dos detectores de Drive.
 *
 * Los detectores y el portero son puros, así que se prueban sin tocar la base.
 * La última afirmación sí escribe: comprueba que un bloque AUDIO con una
 * dirección nuestra se raciona de verdad.
 *
 * Ejecutar con:  npx tsx scripts/verificar-bloques-audio.ts
 */
import "dotenv/config";
import { esAudioDeDrive, idDrive, motivoSiAudioDeDrive } from "@/lib/bloques";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function main() {
  // ─── Los dos detectores, que no son intercambiables ──────────────────
  const DEL_NAVEGADOR = "https://drive.google.com/file/d/1AbC_dEfGhIjKlMnOpQr/view?usp=sharing";
  const YA_CONVERTIDA = "https://drive.google.com/file/d/1AbC_dEfGhIjKlMnOpQr/preview";
  const NUESTRA = "/api/archivos/cms5dr9t9000fy59gli9s09qz";
  const DIRECTA = "https://ejemplo.test/audios/tarea1.mp3";

  afirmar(
    idDrive(DEL_NAVEGADOR) !== "",
    "idDrive caza la dirección que se copia del navegador (/file/d/…/view)",
  );
  afirmar(
    idDrive("https://drive.google.com/open?id=1AbC_dEfGhIjKlMnOpQr") !== "",
    "idDrive caza la forma open?id=",
  );
  afirmar(idDrive(NUESTRA) === "", "idDrive no confunde una dirección nuestra con Drive");
  afirmar(idDrive(DIRECTA) === "", "idDrive no confunde una dirección directa con Drive");

  afirmar(esAudioDeDrive(YA_CONVERTIDA), "esAudioDeDrive reconoce la forma ya convertida a /preview");
  afirmar(
    !esAudioDeDrive(DEL_NAVEGADOR),
    "esAudioDeDrive NO reconoce la del navegador: por eso no sirve de portero",
  );
  afirmar(!esAudioDeDrive(NUESTRA), "esAudioDeDrive es falso para una dirección nuestra");
  afirmar(!esAudioDeDrive(null), "esAudioDeDrive aguanta un null");

  // ─── El portero ──────────────────────────────────────────────────────
  afirmar(
    motivoSiAudioDeDrive("AUDIO", DEL_NAVEGADOR) !== null,
    "el portero rechaza un AUDIO con la dirección de Drive del navegador",
  );
  afirmar(
    motivoSiAudioDeDrive("AUDIO", YA_CONVERTIDA) !== null,
    "el portero rechaza un AUDIO con la dirección de Drive ya convertida",
  );
  afirmar(
    motivoSiAudioDeDrive("EMBED", DEL_NAVEGADOR) === null,
    "el portero es estrecho: un EMBED de Drive sigue entrando, que puede ser un vídeo",
  );
  afirmar(
    motivoSiAudioDeDrive("AUDIO", NUESTRA) === null,
    "el portero deja pasar un AUDIO con una dirección nuestra, que es lo que se busca",
  );
  afirmar(
    motivoSiAudioDeDrive("AUDIO", DIRECTA) === null,
    "el portero deja pasar un AUDIO con una dirección directa: esa suena y se raciona",
  );
  afirmar(
    (motivoSiAudioDeDrive("AUDIO", DEL_NAVEGADOR) ?? "").toLowerCase().includes("drive"),
    "el motivo del portero menciona Drive, que es lo que hay que arreglar",
  );
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

Run: `npx tsx scripts/verificar-bloques-audio.ts`
Expected: FALLO al importar — `Cannot find module '@/lib/bloques'`.

- [ ] **Step 3: Escribe `lib/bloques.ts`**

```ts
/**
 * Lo que se sabe de un bloque sin preguntarle a la base.
 *
 * **Sin nada de servidor a propósito**: lo importan `page.tsx` (servidor),
 * `editor-bloques.tsx` y `bloque-editable.tsx` (cliente). Nada de `prisma`, ni
 * de `node:crypto`, ni de `lib/audio.ts` o `lib/enlaces.ts`, que arrastran
 * `ffmpeg-static`.
 */

/**
 * El id del archivo de Drive que hay en lo que se ha pegado, o cadena vacía.
 *
 * Reconoce las tres formas que se pegan de verdad, y la primera es la que se
 * copia de la barra del navegador. Vivía dentro de `editor-bloques.tsx`; se
 * mueve aquí porque ahora también la necesita el portero, que es de servidor.
 */
export function idDrive(entrada: string): string {
  return (
    entrada.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1] ??
    entrada.match(/drive\.google\.com\/open\?id=([\w-]+)/)?.[1] ??
    entrada.match(/[?&]id=([\w-]{20,})/)?.[1] ??
    ""
  );
}

/**
 * Si esa dirección es un audio de Drive **ya convertido** en reproductor
 * incrustable.
 *
 * Vivía dentro de `page.tsx`, que la usa para darle al iframe la altura de un
 * reproductor en vez de la de un vídeo. Ahora también la necesita
 * `bloque-editable.tsx` para marcar el bloque que no cuenta escuchas.
 *
 * **No sirve de portero, y confundirla con `idDrive` es el error que hay que
 * evitar**: solo reconoce la forma ya convertida, así que un portero montado
 * sobre esto dejaría pasar justo lo que llega del navegador.
 *
 * Hereda una imprecisión a propósito: un **vídeo** de Drive incrustado también
 * acaba en `/preview` y también encaja. Por eso el aviso que cuelga de ella
 * habla de «contenido incrustado» y no de escuchas. Afinarlo pediría una
 * columna, y no está pagada.
 */
export function esAudioDeDrive(url: string | null): boolean {
  return Boolean(url && url.includes("drive.google.com") && url.endsWith("/preview"));
}

/**
 * El motivo por el que este bloque no se puede guardar, o null.
 *
 * Un audio de Drive no se puede racionar: su reproductor vive en un iframe de
 * otro dominio, así que no hay forma de contar cuándo suena ni de impedir que
 * vuelva a sonar. Y `maximoDeEscucha` solo raciona los bloques `AUDIO`. Si el
 * audio de una prueba entra por ahí, el tope de una escucha que el examen exige
 * deja de existir sin que nada avise.
 *
 * La salida es traerlo: `SubirAudio` lo descarga y devuelve una dirección
 * `/api/archivos/<id>`, con los bytes dentro, que sí se raciona.
 *
 * **Estrecho a propósito.** Un `EMBED` de Drive puede ser un vídeo y tiene que
 * seguir entrando; una dirección directa que no sea de Drive en un `AUDIO`
 * también, porque esa suena y se raciona.
 *
 * Vive aquí y no dentro de las acciones por lo de siempre en este proyecto:
 * `lib/acciones.ts` es `"use server"`, así que todo lo que exporta es un
 * endpoint público y un script no puede ejercitarlo sin sesión.
 */
export function motivoSiAudioDeDrive(tipo: string, url: string | null): string | null {
  if (tipo !== "AUDIO" || !url) return null;
  if (idDrive(url) === "" && !esAudioDeDrive(url)) return null;
  return (
    "Un audio de Drive no se puede racionar: su reproductor va incrustado y la " +
    "aplicación no puede contar las escuchas. Pega la dirección en «Audio» y " +
    "pulsa el botón de traerlo: el servidor lo descarga y lo guarda dentro."
  );
}
```

- [ ] **Step 4: Ejecútalo para verlo pasar**

Run: `npx tsx scripts/verificar-bloques-audio.ts`
Expected: catorce líneas `OK:` y salida 0.

- [ ] **Step 5: Quita las dos copias y usa el módulo**

En `app/(app)/pasos/[pasoId]/page.tsx`: borra la función `esAudioDeDrive` (líneas 68-70) y añade `esAudioDeDrive` al bloque de imports, desde `@/lib/bloques`.

En `app/(app)/pasos/[pasoId]/editor-bloques.tsx`: borra la función `idDrive` (líneas 72-79) y añade `idDrive` al bloque de imports, desde `@/lib/bloques`.

No cambies ninguna de las llamadas: los nombres y las firmas son los mismos. `urlDirectaMedia` (línea 86) sigue usando `idDrive` y tiene que seguir funcionando igual.

- [ ] **Step 6: Comprueba que no queda ninguna copia**

Run: `grep -rn "function esAudioDeDrive\|function idDrive" app lib components scripts`
Expected: una sola aparición de cada una, las dos en `lib/bloques.ts`.

- [ ] **Step 7: Comprueba tipos, lint y el resto**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-bloques-audio.ts && npx tsx scripts/verificar-dele.ts`
Expected: sin errores, y `verificar-dele.ts` sigue pasando —es el que ejercita el racionamiento de hoy—.

- [ ] **Step 8: Rompe una afirmación y compruébalo**

Cambia `motivoSiAudioDeDrive` para que devuelva siempre `null` y ejecuta el verificador: tienen que fallar las afirmaciones del portero. Deshaz el cambio.

- [ ] **Step 9: Commit**

```bash
git add lib/bloques.ts scripts/verificar-bloques-audio.ts "app/(app)/pasos/[pasoId]/page.tsx" "app/(app)/pasos/[pasoId]/editor-bloques.tsx"
git commit -m "Los dos detectores de Drive en un solo sitio, y el portero del audio"
```

---

### Task 2: El portero en las dos acciones

**Files:**
- Modify: `lib/acciones.ts` (`crearBloque` en la línea 617, `editarBloque` en la 858)
- Modify: `app/(app)/pasos/[pasoId]/editor-bloques.tsx` (la función `enviar`, línea 184)
- Modify: `app/(app)/pasos/[pasoId]/bloque-editable.tsx` (la función que llama a `editarBloque`, línea 77)

**Interfaces:**
- Consumes: `motivoSiAudioDeDrive(tipo, url)` de `@/lib/bloques`.
- Produces: `crearBloque` y `editarBloque` pasan a devolver `Promise<{ error: string } | undefined>`. Devuelven `undefined` cuando todo va bien, para no tocar a ningún otro llamante.

- [ ] **Step 1: Comprueba quién llama a las dos acciones**

Run: `grep -rn "crearBloque\|editarBloque" app components lib | grep -v "export async function"`
Expected: `editor-bloques.tsx` y `bloque-editable.tsx`, las dos llamándolas con `await` dentro de una función propia —no como `action={}` de un formulario—. Por eso pueden devolver un motivo y enseñarlo. Si aparece algún llamante más, para y dilo antes de seguir.

- [ ] **Step 2: Añade el portero a `crearBloque`**

En `lib/acciones.ts`, dentro de `crearBloque`, justo después de las comprobaciones que ya hay (`if (tipo !== "TEXTO" && !url) return;`) y **antes** del `aggregate`:

```ts
  // El portero del audio: un audio de Drive no se puede racionar. Vive en
  // `lib/bloques.ts` y no aquí porque este archivo es `"use server"` —todo lo
  // que exporta es un endpoint público— y un script no puede ejercitarlo sin
  // sesión. Lo pregunta también `editarBloque`: sin las dos, la puerta que
  // quedara abierta bastaría para colar el audio sin racionar.
  const motivo = motivoSiAudioDeDrive(tipo, url);
  if (motivo) return { error: motivo };
```

Y añade `motivoSiAudioDeDrive` al import de `@/lib/bloques` en la cabecera del archivo.

Cambia la firma para que declare lo que devuelve:

```ts
export async function crearBloque(
  formData: FormData,
): Promise<{ error: string } | undefined> {
```

Los `return` sueltos que ya había se quedan como están: devolver `undefined` es lo que significan.

- [ ] **Step 3: Añade el portero a `editarBloque`**

En `lib/acciones.ts`, dentro de `editarBloque`, después de las dos comprobaciones de vacío y **antes** del `update`:

```ts
  // La segunda puerta, y la que tenía el fallo más raro: `editarBloque` no
  // cambia el `tipo`, así que pegarle una dirección de Drive a un bloque que
  // ya es `AUDIO` lo dejaba racionado pero mudo —el `Reproductor` recibía una
  // dirección que el navegador no puede reproducir—.
  const motivo = motivoSiAudioDeDrive(existente.tipo, url);
  if (motivo) return { error: motivo };
```

Y su firma:

```ts
export async function editarBloque(
  formData: FormData,
): Promise<{ error: string } | undefined> {
```

Fíjate en que el tipo sale de `existente.tipo`, no del formulario: el formulario de edición no manda el tipo, y aceptarlo de quien llama sería dejar que el cliente decida por qué puerta pasa.

- [ ] **Step 4: Enseña el motivo en el editor de bloques**

En `app/(app)/pasos/[pasoId]/editor-bloques.tsx`, añade un estado para el motivo junto a los que ya hay:

```tsx
  // Lo que el servidor contesta cuando se niega. Es la única forma de saberlo:
  // `crearBloque` es una acción, y aquí se llama a mano y se espera.
  const [motivo, setMotivo] = useState<string | null>(null);
```

Y en `enviar`, recoge lo que devuelve en vez de tirarlo:

```tsx
    setEnviando(true);
    setMotivo(null);
    try {
      const fd = new FormData();
      fd.set("pasoId", pasoId);
      fd.set("tipo", tipoFinal);
      fd.set("texto", texto);
      fd.set("url", src);
      fd.set("etiqueta", etiqueta);
      fd.set("imagen", imagen);
      const resultado = await crearBloque(fd);
      if (resultado?.error) {
        setMotivo(resultado.error);
        return;
      }
      reiniciar();
    } finally {
      setEnviando(false);
    }
```

Y píntalo encima del botón de añadir, con la forma que ya usa el proyecto para los errores:

```tsx
      {motivo && (
        <p className="mt-3 rounded-xl bg-bloque3/20 px-4 py-2 text-sm text-tinta">
          {motivo}
        </p>
      )}
```

- [ ] **Step 5: Enseña el motivo en el formulario de edición**

En `app/(app)/pasos/[pasoId]/bloque-editable.tsx`, el mismo patrón: un `const [motivo, setMotivo] = useState<string | null>(null);`, recoger lo que devuelve `editarBloque`, y pintarlo dentro del bloque de edición con la misma clase. Si hay motivo, **no** se sale del modo de edición: el profesor tiene que poder arreglar la dirección sin volver a entrar.

- [ ] **Step 6: Comprueba tipos, lint y los scripts**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-bloques-audio.ts && npx tsx scripts/verificar-dele.ts && npx tsx scripts/verificar-recursos.ts`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/acciones.ts "app/(app)/pasos/[pasoId]/editor-bloques.tsx" "app/(app)/pasos/[pasoId]/bloque-editable.tsx"
git commit -m "Las dos puertas del bloque preguntan al portero, y dicen el motivo"
```

---

### Task 3: `SubirAudio` avisa de lo que no pudo traer

**Files:**
- Modify: `components/recursos/subir-audio.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `SubirAudio` acepta una prop más, **opcional**: `alFallar?: (direccion: string) => void`.

- [ ] **Step 1: Añade la prop**

En `components/recursos/subir-audio.tsx`, la firma pasa a:

```tsx
export default function SubirAudio({
  valor,
  alCambiar,
  alFallar,
}: {
  valor?: string;
  alCambiar: (url: string | undefined) => void;
  /**
   * Avisa con la dirección que no se pudo traer, para que quien pinta este
   * componente pueda ofrecer otra salida.
   *
   * Opcional porque el editor de Recursos no tiene ninguna que ofrecer: allí,
   * un audio que no se puede traer es un audio que no entra. El editor de
   * bloques sí, porque un audio de Drive todavía se puede incrustar —sin
   * racionar—, y esa decisión es del profesor y no de este componente.
   *
   * `SubirAudio` no sabe qué es un bloque ni qué es un `EMBED`: solo dice qué
   * dirección falló.
   */
  alFallar?: (direccion: string) => void;
}) {
```

- [ ] **Step 2: Llámala cuando la traída falla**

Dentro de `traer`, en la rama del error de la respuesta:

```tsx
      if (!respuesta.ok) {
        setError(json.error ?? "No se pudo traer el audio de esa dirección.");
        alFallar?.(enlace);
        return;
      }
```

Y también en el `catch`, que es el otro camino por el que no se trae:

```tsx
    } catch {
      setError("No se pudo traer el audio de esa dirección.");
      alFallar?.(enlace);
    } finally {
```

No la llames desde `subir`: un archivo del ordenador que no entra no tiene ninguna dirección que incrustar.

- [ ] **Step 3: Comprueba que el editor de Recursos no se ha enterado**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-recursos.ts && npx tsx scripts/verificar-expresion.ts`
Expected: sin errores. La prop es opcional, así que la llamada que ya existe en `components/recursos/editor-expresion.tsx` y en los demás sitios sigue compilando sin tocarla.

- [ ] **Step 4: Commit**

```bash
git add components/recursos/subir-audio.tsx
git commit -m "SubirAudio dice qué dirección no pudo traer, sin saber para qué"
```

---

### Task 4: El editor de bloques trae el audio, y su escotilla

**Files:**
- Modify: `app/(app)/pasos/[pasoId]/editor-bloques.tsx`

**Interfaces:**
- Consumes: `SubirAudio` con `alCambiar` y `alFallar` (Task 3); `idDrive` de `@/lib/bloques` (Task 1).
- Produces: nada que consuma otra tarea.

- [ ] **Step 1: Pon `SubirAudio` en la rama del audio**

Añade el import: `import SubirAudio from "@/components/recursos/subir-audio";`

Y, junto al bloque que ya existe para `IMAGEN` (línea 247), el del audio:

```tsx
      {tipo === "AUDIO" && (
        <div className="mt-3">
          <SubirAudio
            valor={entrada.startsWith("/api/archivos/") ? entrada : undefined}
            alCambiar={(url) => {
              setEntrada(url ?? "");
              setFalloImagen(false);
              setDriveQueFallo(null);
            }}
            alFallar={setDriveQueFallo}
          />
        </div>
      )}
```

`valor` solo cuando la dirección ya es nuestra: `SubirAudio` lo usa para pintar su reproductor, y una dirección de Drive ahí no suena.

- [ ] **Step 2: Quita la conversión automática a `EMBED`**

Esta es la línea que era el agujero. En la línea 135:

```tsx
  const tipoFinal: Tipo = audioDeDrive ? "EMBED" : tipo;
```

pasa a:

```tsx
  // Un audio de Drive ya no se convierte solo en `EMBED`: eso lo dejaba fuera
  // del racionamiento sin decírselo a nadie (ver `motivoSiAudioDeDrive`). La
  // conversión sigue existiendo, pero solo cuando el profesor la pide a mano,
  // en la escotilla de abajo.
  const tipoFinal: Tipo = incrustarDrive ? "EMBED" : tipo;
```

Y añade el estado que la gobierna, junto a los demás:

```tsx
  // La dirección de Drive que no se pudo traer, si la hubo. Es lo que habilita
  // la escotilla, y solo aparece después de un intento fallido: sin eso, la
  // salida fácil estaría siempre delante de la buena.
  const [driveQueFallo, setDriveQueFallo] = useState<string | null>(null);
  // Si el profesor ha pedido a mano incrustarla igualmente.
  const [incrustarDrive, setIncrustarDrive] = useState(false);
```

- [ ] **Step 3: Haz que `src` respete la escotilla**

`src` (línea 127) usa `audioDeDrive` para montar la dirección `/preview`. Ahora eso solo vale cuando se ha pedido incrustar:

```tsx
  const audioDeDrive = tipo === "AUDIO" && incrustarDrive ? idDrive(driveQueFallo ?? "") : "";
```

Deja el resto de la expresión de `src` como está: con `audioDeDrive` vacío, el audio sigue el camino de `urlDirectaMedia`, que es el que vale para `/api/archivos/<id>`.

- [ ] **Step 4: Pinta la escotilla**

Debajo del bloque de `SubirAudio` del Step 1:

```tsx
      {tipo === "AUDIO" && driveQueFallo && !incrustarDrive && (
        <div className="mt-3 rounded-xl bg-sol-100 px-4 py-3">
          <p className="text-sm text-tinta">
            Si no consigues que el servidor lo traiga, puedes ponerlo como
            reproductor de Drive. Cuenta que <strong>así no se cuentan las
            escuchas</strong>: en una prueba del examen, el estudiante podrá
            oírlo tantas veces como quiera.
          </p>
          <button
            type="button"
            onClick={() => setIncrustarDrive(true)}
            className="mt-2 h-9 rounded-full border border-hp-200 bg-white px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400"
          >
            Ponerlo como reproductor de Drive
          </button>
        </div>
      )}
```

- [ ] **Step 5: Reescribe la ayuda del tipo `AUDIO`**

En la tabla `TIPOS` (línea 33), la `ayuda` de `AUDIO` dice hoy «*Dirección directa de un archivo mp3. Si es de Google Drive, se convierte solo en reproductor incrustado*», y la segunda mitad deja de ser verdad. Pasa a:

```tsx
    ayuda:
      "Súbelo desde el ordenador, o pega su dirección de Drive y el servidor irá a buscarlo. El archivo se guarda dentro, así que se puede racionar en una prueba.",
```

- [ ] **Step 6: Comprueba que `entrada` y la escotilla no se contradicen**

Con la escotilla pulsada, `src` sale de `driveQueFallo` y no de `entrada`. Comprueba leyendo el código que `listo` (línea 137, `src !== ""`) da verdadero en ese caso, o el botón de añadir no se encenderá. Si no lo da, arréglalo ahí y **escribe por qué** en un comentario.

- [ ] **Step 7: Comprueba tipos, lint y los scripts**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-bloques-audio.ts && npx tsx scripts/verificar-dele.ts`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/pasos/[pasoId]/editor-bloques.tsx"
git commit -m "El audio de un bloque lo trae el servidor, y la escotilla se pide a mano"
```

---

### Task 5: `SubirAudio` al editar, y la marca del audio que no cuenta

**Files:**
- Modify: `app/(app)/pasos/[pasoId]/bloque-editable.tsx`
- Modify: `app/(app)/pasos/[pasoId]/page.tsx` (la llamada a `BloqueEditable`, línea 447)
- Modify: `scripts/verificar-bloques-audio.ts` (la afirmación del racionamiento)

**Interfaces:**
- Consumes: `esAudioDeDrive` de `@/lib/bloques` (Task 1); `SubirAudio` (Task 3).
- Produces: `BloqueEditable` acepta una prop más: `racionado: boolean`.

- [ ] **Step 1: Añade la afirmación del racionamiento al verificador**

Es la única que escribe en la base. Añade estos imports a `scripts/verificar-bloques-audio.ts`:

```ts
import { maximoDeEscucha } from "@/lib/escuchas";
```

y este bloque al final de `main()`:

```ts
  // ─── El racionamiento, de verdad y no solo la fila ───────────────────
  const marca = `verificar-bloques-audio-${process.pid}`;
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
      orden: 9990,
      autorId: profe.id,
    },
    select: { id: true },
  });
  recorridoId = secuencia.id;

  const paso = await prisma.paso.create({
    data: { recorridoId: secuencia.id, titulo: "Tarea 1", tipo: "ACTIVIDAD", ciclo: 1, orden: 1 },
    select: { id: true },
  });

  const nuestro = await prisma.bloque.create({
    data: { pasoId: paso.id, orden: 1, tipo: "AUDIO", url: NUESTRA, etiqueta: "Audio de la tarea 1" },
    select: { id: true },
  });
  afirmar(
    (await maximoDeEscucha(paso.id, nuestro.id)) === 1,
    "un bloque AUDIO con dirección nuestra se puede oír una sola vez en una prueba",
  );

  // El mismo bloque, incrustado: `maximoDeEscucha` no lo raciona, y eso es
  // justo lo que la marca de la pantalla tiene que avisar.
  const incrustado = await prisma.bloque.create({
    data: { pasoId: paso.id, orden: 2, tipo: "EMBED", url: YA_CONVERTIDA },
    select: { id: true },
  });
  afirmar(
    (await maximoDeEscucha(paso.id, incrustado.id)) === null,
    "un EMBED de Drive NO se raciona: por eso hace falta la marca en la ficha del paso",
  );
```

Declara `let recorridoId: string | null = null;` y `let profesorId: string | null = null;` como variables de módulo, y cambia el `.finally()` para limpiar:

```ts
  .finally(async () => {
    if (recorridoId) {
      const pasos = await prisma.paso.findMany({ where: { recorridoId }, select: { id: true } });
      const pasoIds = pasos.map((p) => p.id);
      await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
      await prisma.paso.deleteMany({ where: { recorridoId } });
      await prisma.recorrido.delete({ where: { id: recorridoId } });
    }
    if (profesorId) await prisma.user.delete({ where: { id: profesorId } });
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Ejecútalo**

Run: `npx tsx scripts/verificar-bloques-audio.ts`
Expected: pasa, incluidas las dos afirmaciones nuevas, y sin dejar basura.

Si la segunda falla, lee `maximoDeEscucha` (`lib/escuchas.ts:106`) y comprueba qué devuelve para un bloque que no es `AUDIO`. Ajusta la afirmación a lo que la función dice de verdad, **no** la función.

- [ ] **Step 3: Pásale `racionado` a `BloqueEditable`**

En `app/(app)/pasos/[pasoId]/page.tsx`, la llamada de la línea 447:

```tsx
              <BloqueEditable
                key={bloque.id}
                bloque={bloque}
                indice={i}
                total={paso.bloques.length}
                racionado={racionado}
              >
```

- [ ] **Step 4: Pinta la marca**

En `app/(app)/pasos/[pasoId]/bloque-editable.tsx`, añade la prop a la firma (`racionado: boolean;`), importa `esAudioDeDrive` de `@/lib/bloques`, y pinta la marca junto a la etiqueta del tipo (línea 91):

```tsx
      {racionado && esAudioDeDrive(bloque.url) && (
        <p className="mt-2 rounded-xl bg-sol-100 px-3 py-2 text-xs text-tinta">
          Este contenido va incrustado de Drive: la aplicación no puede contar
          cuántas veces se abre. En una prueba, el estudiante puede oírlo sin
          límite.
        </p>
      )}
```

**Solo la ve el profesor, y no por una condición sino por dónde está:** la página envuelve el bloque en `BloqueEditable` únicamente cuando `esProfe` (línea 446). Escribe eso en un comentario, para que nadie mueva la marca a `BloqueContenido` creyendo que da igual.

- [ ] **Step 5: Pon `SubirAudio` en el formulario de edición**

Junto al bloque que ya existe para `IMAGEN` (línea 156), el del audio, con el mismo patrón:

```tsx
              {bloque.tipo === "AUDIO" && (
                <div className="mt-2">
                  <SubirAudio
                    valor={url.startsWith("/api/archivos/") ? url : undefined}
                    alCambiar={(nueva) => setUrl(nueva ?? "")}
                  />
                </div>
              )}
```

Sin `alFallar`: aquí no hay escotilla. Cambiar un audio ya puesto por uno incrustado es empeorarlo a propósito, y para eso está borrar el bloque y crearlo de nuevo. El campo de dirección se queda —igual que en `IMAGEN`—, y si alguien escribe ahí una dirección de Drive, el portero de la Task 2 lo rechaza con su motivo.

- [ ] **Step 6: Comprueba tipos, lint y todos los scripts**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-bloques-audio.ts && npx tsx scripts/verificar-dele.ts && npx tsx scripts/verificar-recursos.ts && npx tsx scripts/verificar-ejercicios.ts`
Expected: sin errores.

- [ ] **Step 7: Pruébalo en el navegador**

```bash
npm run dev
```

1. En una secuencia de preparación con prueba, abre un paso y añade un bloque de audio pegando la dirección de Drive de uno de los MP3 del examen. Pulsa el botón de traerlo: tarda, y al acabar la dirección tiene que ser `/api/archivos/<id>`.
2. Guarda el bloque y recarga: tiene que salir el reproductor con el contador de escuchas, no un iframe.
3. Pega una dirección de Drive que **no** esté compartida. Tiene que salir el motivo, y debajo la escotilla con su aviso.
4. Pulsa la escotilla, añade el bloque, y comprueba que en la ficha del paso sale la marca de «no puede contar cuántas veces se abre».
5. Edita un bloque de audio y escríbele a mano una dirección de Drive en el campo: tiene que salir el motivo del portero y **no** guardarse.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/pasos/[pasoId]/bloque-editable.tsx" "app/(app)/pasos/[pasoId]/page.tsx" scripts/verificar-bloques-audio.ts
git commit -m "Cambiar el audio al editar, y marcar el que no cuenta escuchas"
```

---

## Autorrevisión del plan

**Cobertura del spec.** Cada apartado tiene tarea: recablear con `SubirAudio` (4), quitar la conversión automática (4), la ayuda reescrita (4), la escotilla (4) con su `alFallar` (3), la marca y su prop `racionado` (5), el módulo compartido con los dos detectores (1), el portero en el servidor compartido por las dos acciones (2), y `SubirAudio` en el formulario de edición (5). Las cinco afirmaciones del spec caen en la 1 (detectores y portero, que absorben las tres primeras del spec porque el script no puede llamar a las acciones) y en la 5 (racionamiento).

**Una desviación deliberada del spec, y su porqué.** El spec pedía afirmar que «`crearBloque` … se rechaza» y «`editarBloque` … se rechaza». Un script no puede llamar a esas dos acciones: `exigirProfesor()` necesita sesión. Así que el script afirma la **regla** (`motivoSiAudioDeDrive`) y el **cableado** lo comprueba la revisión leyendo el diff, que es lo que el Step 1 de la Task 2 deja preparado con su `grep`. Escribir una afirmación que dijera «la acción rechaza» sin llamar a la acción sería peor que no tenerla.

**Nombres, comprobados de punta a punta:** `idDrive`, `esAudioDeDrive` y `motivoSiAudioDeDrive` en `lib/bloques.ts`; `alFallar` en `SubirAudio`; `racionado` en `BloqueEditable`; `driveQueFallo` e `incrustarDrive` en el editor de bloques, usados en los Steps 1, 2, 3 y 4 de la Task 4 con la misma grafía.

**Un aviso para quien lo ejecute.** Los números de línea son del estado de `main` al escribir esto (`b44cf32`). Si alguna tarea anterior los ha movido, busca por el nombre de la función o por el texto citado, que es lo que no cambia.
