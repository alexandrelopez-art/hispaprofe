# Recomprimir el audio al subirlo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor suba los MP3 oficiales del Cervantes tal como los descarga —hasta 35,7 MB— y la aplicación los guarde comprimidos a unos 5 MB, sin que tenga que recomprimir nada a mano.

**Architecture:** Un módulo `lib/audio.ts` que encuentra un compresor ya instalado en la máquina (`afconvert` en macOS, `ffmpeg` si está en el `PATH`) y lo invoca sobre archivos temporales. La ruta de subida lo llama antes de guardar: el tope pasa de ser «lo que guardamos» a «lo que aceptamos recibir», y lo que llega a la base es siempre el resultado comprimido.

**Tech Stack:** Next.js (ver `AGENTS.md`: **esta no es la versión de Next que conoces**, lee `node_modules/next/dist/docs/` antes de escribir código de framework), React, Prisma, `node:child_process`, `node:fs/promises`.

## Global Constraints

- **Los comentarios se escriben en castellano**, como todo el código del proyecto, y explican el porqué y no el qué.
- **Nada de tests con framework**: este proyecto verifica con scripts en `scripts/verificar-*.ts` que afirman contra código real, con una función `afirmar(condicion, mensaje)`. Se ejecutan con `npx tsx`.
- **Ninguna dependencia nueva de npm.** El compresor es el que ya hay en la máquina. Si el implementador cree necesitar un paquete, es señal de que se ha desviado del diseño.
- **`lib/audio.ts` no importa `prisma` ni nada del navegador**: recibe unos bytes y devuelve otros. Sí puede usar módulos de Node (`node:child_process`, `node:fs/promises`, `node:os`, `node:path`), porque solo lo importan la ruta y el script — nunca un componente de cliente. Esto **no** es `lib/ejercicios/tipos.ts`, que sí tiene esa restricción.
- **Los archivos temporales se borran siempre**, también cuando la compresión falla. Un `finally`, no un camino feliz.
- Verificación de cada tarea: `npx tsc --noEmit && npm run lint`, más el script que toque.

---

## Datos medidos en esta máquina

No son estimaciones: se comprobaron antes de escribir el plan, y el implementador debería obtener lo mismo.

| Entrada | Salida con `-b 48000 -c 1` |
|---|---|
| WAV PCM 16 bits mono 44,1 kHz, 20 s — 1.764.044 bytes | 113.562 bytes |
| `A2B1E_2015-05_T1.mp3` — 35.702.117 bytes | 4.761.022 bytes |
| Ese mismo m4a de 113.562 bytes, recomprimido | 108.305 bytes — **encoge**, no sirve para probar la rama de «conservar el original» |
| WAV de **20 ms** — 1.808 bytes | 4.393 bytes — **engorda**: el contenedor pesa más que el sonido |

`afconvert` con basura de `/dev/urandom` sale con código **1**. `afconvert` **no acepta tuberías**: `- -` da `Unknown option: -` y código 2. De ahí los archivos temporales.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/audio.ts` | **Crear.** Encontrar el compresor y comprimir. Fuera de las acciones. | 1 |
| `scripts/verificar-audio.ts` | **Crear.** El compresor contra archivos de verdad. | 1 |
| `app/api/archivos/route.ts` | **Modificar.** Subir el tope y comprimir antes de guardar. | 2 |
| `components/recursos/subir-audio.tsx` | **Modificar.** Decir que está comprimiendo. | 2 |

---

### Task 1: El módulo que comprime

Todo el trabajo de verdad. Al terminar, `lib/audio.ts` comprime y su script lo demuestra; nadie lo llama todavía.

**Files:**
- Create: `lib/audio.ts`
- Create: `scripts/verificar-audio.ts`

**Interfaces:**
- Produces, desde `@/lib/audio`:
  - `type AudioComprimido = { datos: Buffer; tipo: string; nombre: string }`
  - `async function comprimirAudio(datos: Buffer, nombre: string): Promise<AudioComprimido>` — devuelve el resultado comprimido, o el original si comprimir no lo hace más pequeño. Lanza `Error` si no hay compresor o si el archivo no es audio.
  - `async function hayCompresor(): Promise<boolean>`
  - `function generarWav(segundos: number): Buffer` — un WAV de prueba, para que el script no necesite traer un archivo al repositorio.

- [ ] **Step 1: Escribir el script de verificación (falla)**

Crea `scripts/verificar-audio.ts`. **Escríbelo entero antes de tocar `lib/audio.ts`.**

```ts
/**
 * Verifica el compresor de audio contra archivos de verdad.
 *
 * No trae ningún audio al repositorio: se fabrica uno.
 * Ejecutar con:  npx tsx scripts/verificar-audio.ts
 */
import { comprimirAudio, generarWav, hayCompresor } from "@/lib/audio";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

async function main() {
  // Sin compresor no se puede verificar nada, y decirlo claro evita
  // interpretar el fallo como un error del código.
  if (!(await hayCompresor())) {
    throw new Error(
      "No hay compresor de audio en esta máquina (ni afconvert ni ffmpeg), " +
        "así que no se puede verificar nada. En macOS afconvert viene puesto.",
    );
  }
  afirmar(true, "hay un compresor disponible");

  // 1. Comprimir reduce. Veinte segundos de WAV son 1,7 MB; comprimidos no
  //    llegan a 200 KB.
  const wav = generarWav(20);
  afirmar(wav.length > 1_000_000, `el WAV de prueba es grande (${wav.length} bytes)`);

  const comprimido = await comprimirAudio(wav, "tono.wav");
  afirmar(
    comprimido.datos.length < wav.length / 5,
    `comprimir reduce a menos de una quinta parte (${wav.length} → ${comprimido.datos.length})`,
  );
  afirmar(comprimido.tipo === "audio/mp4", "el resultado se declara audio/mp4");
  afirmar(comprimido.nombre === "tono.m4a", "la extensión del nombre acompaña al formato");

  // 2. Lo devuelto es audio de verdad, no bytes cualesquiera. La prueba es
  //    que el compresor lo puede volver a leer: si fuera basura, fallaría.
  const otraVez = await comprimirAudio(comprimido.datos, "tono.m4a");
  afirmar(otraVez.datos.length > 0, "el resultado se puede volver a comprimir: es audio válido");

  // 3. Cuando comprimir engordaría, se conserva la entrada tal cual.
  //
  //    El caso hay que buscarlo a propósito: recomprimir el m4a de arriba
  //    NO sirve, porque sale un poco más pequeño (113.562 → 108.305 medido
  //    en esta máquina) y la afirmación pasaría sin ejercitar nada. Veinte
  //    milisegundos sí: son 1.808 bytes de WAV y el m4a mínimo ronda los
  //    4.393, porque el contenedor pesa más que el sonido.
  //
  //    Se compara byte a byte y no por tamaño: lo que se promete es que
  //    devuelve *la entrada*, no algo que casualmente mide lo mismo.
  const brevisimo = generarWav(0.02);
  const sinTocar = await comprimirAudio(brevisimo, "brevisimo.wav");
  afirmar(
    sinTocar.datos.equals(brevisimo),
    `un audio que engordaría al comprimirse se devuelve idéntico (${brevisimo.length} bytes)`,
  );
  afirmar(sinTocar.tipo === "", "y se marca como no comprimido con el tipo vacío");
  afirmar(sinTocar.nombre === "brevisimo.wav", "y conserva su nombre original");

  // 4. Lo que no es audio se rechaza. Si esto no lanzara, la ruta guardaría
  //    en la base cualquier cosa que le manden con un tipo de audio.
  let lanzo = false;
  try {
    await comprimirAudio(Buffer.from("esto no es audio, es texto plano"), "falso.mp3");
  } catch {
    lanzo = true;
  }
  afirmar(lanzo, "un archivo que no es audio se rechaza con un error");

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-audio.ts`
Expected: falla al resolver el import, porque `lib/audio.ts` todavía no existe. **Que falle aquí es el objetivo del paso.**

- [ ] **Step 3: Escribir `lib/audio.ts`**

```ts
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Comprime el audio que sube el profesor, para que no tenga que hacerlo él.
 *
 * Los MP3 oficiales del Cervantes vienen en mono a 320 kbps —siete veces más
 * calidad de la que necesita una voz— y pesan hasta 35,7 MB. Como los
 * archivos se guardan dentro de la base de datos, eso son 88 MB por examen
 * de calidad tirada. A 48 kbps la tarea 1 baja a 4,8 MB sin diferencia
 * audible.
 *
 * No importa `prisma` ni nada del navegador: entran bytes y salen bytes.
 */

/** AAC de 48 kbps en mono: lo entienden todos los navegadores. */
const TIPO_SALIDA = "audio/mp4";

type Compresor = {
  orden: string;
  /** Los argumentos, dados el archivo de entrada y el de salida. */
  args: (entrada: string, salida: string) => string[];
};

// En el orden en que se prueban. `afconvert` primero porque viene con macOS
// y es la máquina donde esto corre hoy; `ffmpeg` para cualquier otra.
const COMPRESORES: Compresor[] = [
  {
    orden: "afconvert",
    args: (e, s) => ["-f", "mp4f", "-d", "aac", "-b", "48000", "-c", "1", e, s],
  },
  {
    orden: "ffmpeg",
    args: (e, s) => ["-y", "-i", e, "-ac", "1", "-c:a", "aac", "-b:a", "48k", s],
  },
];

/**
 * El compresor encontrado, recordado tras la primera búsqueda.
 *
 * `undefined` = todavía no se ha buscado; `null` = se buscó y no hay ninguno.
 * Sin esto, cada subida lanzaría un proceso por candidato solo para
 * averiguar algo que no cambia mientras la aplicación esté viva.
 */
let recordado: Compresor | null | undefined;

/** Lanza una orden y resuelve con su código de salida y lo que dijo. */
function lanzar(orden: string, args: string[]): Promise<{ codigo: number; error: string }> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(orden, args);
    let error = "";
    proceso.stderr.on("data", (trozo) => {
      error += String(trozo);
    });
    // ENOENT aquí significa "esa orden no existe en esta máquina", que es
    // justo lo que `buscarCompresor` quiere distinguir de un fallo real.
    proceso.on("error", rechazar);
    proceso.on("close", (codigo) => resolver({ codigo: codigo ?? 1, error }));
  });
}

async function buscarCompresor(): Promise<Compresor | null> {
  if (recordado !== undefined) return recordado;
  for (const compresor of COMPRESORES) {
    try {
      // Sin argumentos las dos órdenes salen con error y escriben su ayuda.
      // Da igual: lo único que se comprueba es que exista el ejecutable, y
      // eso lo dice que `lanzar` no reviente con ENOENT.
      await lanzar(compresor.orden, []);
      recordado = compresor;
      return recordado;
    } catch {
      // No está en esta máquina; se prueba el siguiente.
    }
  }
  recordado = null;
  return recordado;
}

export async function hayCompresor(): Promise<boolean> {
  return (await buscarCompresor()) !== null;
}

export type AudioComprimido = { datos: Buffer; tipo: string; nombre: string };

/**
 * Comprime, o devuelve la entrada intacta si comprimir no la hace más
 * pequeña —lo que pasa con un audio ya comprimido y corto—.
 *
 * Escribe archivos temporales porque `afconvert` no acepta tuberías: pasarle
 * `-` como entrada o salida responde «Unknown option: -». Se borran siempre,
 * también cuando algo falla.
 */
export async function comprimirAudio(
  datos: Buffer,
  nombre: string,
): Promise<AudioComprimido> {
  const compresor = await buscarCompresor();
  if (!compresor) {
    throw new Error(
      "No hay ningún compresor de audio en esta máquina. En macOS viene " +
        "`afconvert`; en otros sistemas hace falta instalar `ffmpeg`.",
    );
  }

  const carpeta = await mkdtemp(join(tmpdir(), "hispaprofe-audio-"));
  try {
    const entrada = join(carpeta, "entrada");
    const salida = join(carpeta, "salida.m4a");
    await writeFile(entrada, datos);

    const { codigo, error } = await lanzar(compresor.orden, compresor.args(entrada, salida));
    if (codigo !== 0) {
      // Pasa con un archivo que no es audio, y con uno corrupto. Los dos
      // tienen que rebotar aquí y no acabar guardados en la base.
      throw new Error(
        `No se pudo comprimir el audio: puede que el archivo esté dañado o no sea audio.` +
          (error.trim() ? ` (${error.trim().split("\n")[0]})` : ""),
      );
    }

    const comprimido = await readFile(salida);
    // Un audio ya comprimido y corto puede salir más grande: recomprimir solo
    // lo empeoraría, así que en ese caso se guarda lo que llegó.
    if (comprimido.length >= datos.length) {
      return { datos, tipo: "", nombre };
    }
    return { datos: comprimido, tipo: TIPO_SALIDA, nombre: conExtensionM4a(nombre) };
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/** «T1.mp3» pasa a «T1.m4a»: el nombre guardado no debe mentir del formato. */
function conExtensionM4a(nombre: string): string {
  return nombre.replace(/\.[^./\\]*$/, "") + ".m4a";
}

/**
 * Un WAV de prueba: PCM de 16 bits, mono, 44,1 kHz, con una onda sencilla.
 *
 * Vive aquí y no en el script porque el script no puede fabricarlo con el
 * compresor: `afconvert` solo convierte, no sintetiza, y en la máquina del
 * profesor no hay `ffmpeg`. Escribir el WAV a mano funciona con los dos, y
 * además es el formato más grande posible, que es lo que conviene para
 * comprobar que comprimir reduce.
 */
export function generarWav(segundos: number): Buffer {
  const hz = 44100;
  // Redondeado porque se le pasan fracciones: el caso que prueba la rama de
  // "conservar el original" son veinte milisegundos.
  const muestras = Math.round(hz * segundos);
  const cuerpo = Buffer.alloc(muestras * 2);
  for (let i = 0; i < muestras; i++) {
    cuerpo.writeInt16LE(Math.round(12000 * Math.sin((2 * Math.PI * 440 * i) / hz)), i * 2);
  }

  const cabecera = Buffer.alloc(44);
  cabecera.write("RIFF", 0);
  cabecera.writeUInt32LE(36 + cuerpo.length, 4);
  cabecera.write("WAVE", 8);
  cabecera.write("fmt ", 12);
  cabecera.writeUInt32LE(16, 16); // tamaño del bloque "fmt "
  cabecera.writeUInt16LE(1, 20); // 1 = PCM sin comprimir
  cabecera.writeUInt16LE(1, 22); // un canal
  cabecera.writeUInt32LE(hz, 24);
  cabecera.writeUInt32LE(hz * 2, 28); // bytes por segundo
  cabecera.writeUInt16LE(2, 32); // bytes por muestra
  cabecera.writeUInt16LE(16, 34); // bits por muestra
  cabecera.write("data", 36);
  cabecera.writeUInt32LE(cuerpo.length, 40);

  return Buffer.concat([cabecera, cuerpo]);
}
```

**Sobre el `tipo: ""` cuando no se comprime:** significa «no lo cambies, quédate con el que traía». Quien llama ya conoce el tipo original —se lo dijo el navegador— y no tiene por qué recibirlo de vuelta. El paso siguiente lo usa así.

- [ ] **Step 4: Ejecutar hasta que pase**

Run: `npx tsx scripts/verificar-audio.ts`
Expected: las siete afirmaciones en verde y «Todo bien.».

Si falla la de «se devuelve idéntico», comprueba primero el tamaño que imprime: la rama de conservar el original solo se activa cuando el comprimido sale mayor o igual, y eso con veinte milisegundos está medido (1.808 → 4.393). Si en tu máquina saliera al revés, sube la duración hasta que engorde y ajusta el número del mensaje, pero **no relajes la comparación byte a byte**: es lo único que distingue "devuelve la entrada" de "devuelve algo del mismo tamaño".

- [ ] **Step 5: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

```bash
git add lib/audio.ts scripts/verificar-audio.ts
git commit -m "Comprimir el audio con lo que ya hay en la máquina"
```

---

### Task 2: La subida usa el compresor

**Files:**
- Modify: `app/api/archivos/route.ts`
- Modify: `components/recursos/subir-audio.tsx`

**Interfaces:**
- Consumes: `comprimirAudio` de `@/lib/audio` (Task 1).

- [ ] **Step 1: Subir el tope y cambiar lo que significa**

En `app/api/archivos/route.ts`, sustituye el bloque del comentario y la constante `MAXIMO_AUDIO` por:

```ts
// Lo que aceptamos **recibir**, no lo que guardamos: el audio se comprime
// antes de entrar en la base, así que lo guardado es mucho más pequeño.
// Cien megas dejan pasar de sobra el peor caso conocido —los 35,7 MB de la
// tarea 1 del A2/B1 escolar— sin abrir la puerta a subir una película.
const MAXIMO_AUDIO = 100 * 1024 * 1024;
```

- [ ] **Step 2: Comprimir antes de guardar**

En el mismo archivo, añade el import:

```ts
import { comprimirAudio } from "@/lib/audio";
```

Y sustituye el bloque que va desde `const datos = Buffer.from(...)` hasta el `prisma.archivo.create({...})` incluido por:

```ts
  const recibido = Buffer.from(await archivo.arrayBuffer());

  // El audio se comprime aquí, durante la subida: quince minutos tardan unos
  // segundos. Si algún día esto corre en una máquina con límite de tiempo por
  // petición, habrá que sacarlo fuera y enseñar un estado «procesando».
  let datos = recibido;
  let tipo = archivo.type;
  let nombre = archivo.name;
  if (esAudio) {
    try {
      const comprimido = await comprimirAudio(recibido, archivo.name);
      datos = comprimido.datos;
      // `tipo` vacío significa que no se comprimió y hay que conservar el
      // que traía. Ver el comentario de `comprimirAudio`.
      if (comprimido.tipo) {
        tipo = comprimido.tipo;
        nombre = comprimido.nombre;
      }
    } catch (e) {
      // Se rechaza en vez de guardar el original de 36 MB callando: si esto
      // pasara en silencio, se descubriría con cincuenta audios ya dentro.
      return Response.json(
        { error: e instanceof Error ? e.message : "No se pudo comprimir el audio." },
        { status: 400 },
      );
    }
  }

  const guardado = await prisma.archivo.create({
    data: {
      nombre: nombre.slice(0, 200),
      tipo,
      tamano: datos.length,
      datos,
      subidoPorId: usuario.id,
    },
    select: { id: true },
  });
```

- [ ] **Step 3: Arreglar el mensaje del tope**

El mensaje que había enseñaba a recomprimir a mano, que es justo lo que esta tarea elimina. En el bloque `if (archivo.size > maximo)`, sustituye la rama del audio:

```ts
          : "El audio pesa demasiado. El tope son 100 MB.",
```

- [ ] **Step 4: Decir que está comprimiendo**

En `components/recursos/subir-audio.tsx`, el botón dice «Subiendo…» durante toda la espera, y ahora esa espera incluye la compresión, que es la parte lenta. Sustituye el texto del botón (sobre la línea 72):

```tsx
          {subiendo ? "Subiendo y comprimiendo…" : "Subir un archivo"}
```

Y actualiza el comentario de cabecera del archivo, que hoy afirma algo que deja de ser cierto. Sustituye el párrafo que empieza por «No reduce nada antes de subir» por:

```tsx
 * No reduce nada en el navegador, a diferencia de `subir-imagen.tsx`:
 * recomprimir audio en el navegador estropea la voz. Lo hace el servidor al
 * recibirlo, que es la parte lenta de la espera y por eso el botón lo dice.
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-audio.ts`
Expected: todo limpio y en verde.

- [ ] **Step 6: Probarlo a mano**

Levanta `npm run dev`. Entra como profesor, ve a `/profe/recursos/nuevo`, crea un ejercicio de tipo `opcion`, añade audio a una pregunta y **sube el MP3 real de la Tarea 1** (35,7 MB). Comprueba tres cosas: que el botón dice «Subiendo y comprimiendo…» mientras trabaja; que termina sin error; y que lo guardado ronda los 5 MB y no los 36. Lo último se mira así:

```bash
npx tsx -e "
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
(async () => {
  const a = await prisma.archivo.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { nombre: true, tipo: true, tamano: true } });
  for (const x of a) console.log(x.nombre, '|', x.tipo, '|', x.tamano, 'bytes');
  await prisma.\$disconnect();
})();
"
```

Y por último, que el audio suena: pega el ejercicio en un paso y ábrelo.

- [ ] **Step 7: Commit**

```bash
git add app/api/archivos/route.ts components/recursos/subir-audio.tsx
git commit -m "La subida comprime el audio: el tope pasa a ser lo que aceptamos recibir"
```

---

## Autorrevisión

**Cobertura del spec**, sección a sección:

| Requisito del spec | Dónde |
|---|---|
| El tope pasa a significar «lo que aceptamos recibir», 100 MB | Task 2, Step 1 |
| El tope de las imágenes no se toca | Task 2 no lo menciona: `MAXIMO_IMAGEN` no aparece en ningún paso |
| Busca `afconvert`, luego `ffmpeg` | Task 1, Step 3 (`COMPRESORES`) |
| Sin compresor, se rechaza diciendo qué falta | Task 1, Step 3 (el `throw` de `comprimirAudio`) y Task 2, Step 2 (la ruta lo devuelve al navegador) |
| AAC 48 kbps mono en `.m4a` | Task 1, Step 3 (`COMPRESORES`, `TIPO_SALIDA`) |
| Si el resultado sale más grande, se guarda el original | Task 1, Step 3 (`comprimido.length >= datos.length`) y su afirmación en Step 1 |
| El profesor ve que está comprimiendo | Task 2, Step 4 |
| `lib/audio.ts` fuera de las acciones, sin `prisma` | Task 1, Step 3 (no hay ningún import de prisma) |
| El WAV de prueba se escribe a mano | Task 1, Step 3 (`generarWav`) |
| Verificación: reduce, es audio válido, rechaza lo que no es audio, conserva el original cuando engordaría | Task 1, Step 1 |
| A mano: subir el MP3 real y comprobar el tamaño guardado | Task 2, Step 6 |

Sin huecos.

**Marcadores de posición:** ninguno. Todos los pasos llevan el código real.

**Consistencia de tipos:** `comprimirAudio(datos: Buffer, nombre: string): Promise<AudioComprimido>` se declara en Task 1, Step 3 y se consume en Task 2, Step 2 con esa firma. `AudioComprimido` tiene `datos`, `tipo` y `nombre`, y los tres se usan en la ruta. `generarWav(segundos: number): Buffer` y `hayCompresor(): Promise<boolean>` se declaran en Task 1, Step 3 y se consumen en Task 1, Step 1.

**Una nota sobre el orden:** Task 2 depende de Task 1 y no al revés. No las reordenes.

**Un riesgo que el implementador debe conocer:** la afirmación «un archivo que no es audio se rechaza» depende de que el compresor salga con código distinto de cero ante basura. Se comprobó con `afconvert` y `/dev/urandom`: sale con 1. Con `ffmpeg` el comportamiento es el mismo, pero si algún día se añadiera un tercer compresor habría que volver a comprobarlo.
