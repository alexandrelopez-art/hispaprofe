# El audio en Vercel — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que subir, comprimir y oír audio funcione en `hispaprofe.vercel.app`, donde no hay compresor instalado y el cuerpo de una petición no puede pasar de 4,5 MB.

**Architecture:** El tope de 4,5 MB solo existe en el tramo navegador → función. Así que lo grande sale de ese tramo por los dos lados: al servir, el cuerpo pasa a ser un flujo por trozos; al recibir, el material grande del profesor lo descarga el servidor de una dirección en vez de subirlo el navegador. El compresor viaja dentro de la función como binario empaquetado. Los archivos siguen guardándose en `Archivo.datos`, sin migración ni servicio nuevo.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, Prisma 7, TypeScript, Tailwind 4, `ffmpeg-static`, scripts de verificación con `tsx`.

## Global Constraints

- **Castellano en todo**: nombres de símbolos, comentarios, mensajes al usuario y mensajes de commit. Es la convención del proyecto entero.
- **`AGENTS.md`**: esta versión de Next tiene cambios de ruptura. Antes de escribir código de Next, leer la guía correspondiente en `node_modules/next/dist/docs/`.
- **Lo verificable vive en `lib/`**: nada que dependa de la sesión, de `prisma` o del navegador entra en un módulo que un script tenga que poder ejercitar.
- **Los comentarios explican el porqué**, no el qué, y dicen la verdad sobre las trampas. Es el estilo establecido en `lib/audio.ts` y `app/api/archivos/[id]/route.ts`; seguirlo.
- **Tope de la plataforma: 4,5 MB** de cuerpo de petición, y de respuesta solo cuando el cuerpo se forma entero antes de mandarlo. Ningún número nuevo puede prometer más que eso por el camino del navegador.
- **Comprobación de tipos y estilo tras cada tarea**: `npx tsc --noEmit` y `npm run lint`, los dos limpios antes de commitear.
- **Un commit por tarea**, con el mensaje en el estilo del repositorio: una frase que diga qué cambia de comportamiento, sin prefijos tipo `feat:`.
- **Cómo se verifica aquí**: el proyecto **no tiene framework de tests**. Lo que se comprueba solo se comprueba con scripts `scripts/verificar-*.ts`, ejecutados con `npx tsx`, y por eso la lógica verificable vive en `lib/`. Las rutas de `app/api/` y los componentes de `components/` **no llevan test automático**: se comprueban a mano, y cada tarea que los toca dice cómo. No es un descuido de este plan, es la convención establecida en las quince verificaciones que ya hay en `scripts/`.

---

### Task 1: `lib/flujo.ts` — un cuerpo que sale por trozos

**Files:**
- Create: `lib/flujo.ts`
- Create: `scripts/verificar-flujo.ts`

**Interfaces:**
- Produces: `flujoDeBytes(datos: Buffer, trozo?: number): ReadableStream<Uint8Array>` — la Task 2 lo consume.

- [ ] **Step 1: Escribe la verificación que falla**

Crea `scripts/verificar-flujo.ts`:

```ts
/**
 * Verifica que un cuerpo por trozos entrega exactamente los bytes que le dan,
 * y que los entrega en varios trozos y no en uno solo.
 *
 * Ejecutar con:  npx tsx scripts/verificar-flujo.ts
 */
import { flujoDeBytes } from "@/lib/flujo";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/** Vacía un flujo y devuelve lo que salió, trozo a trozo. */
async function vaciar(flujo: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const trozos: Uint8Array[] = [];
  const lector = flujo.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
  }
  return trozos;
}

async function main() {
  // 1. Lo que sale es byte a byte lo que entró.
  const datos = Buffer.alloc(1000);
  for (let i = 0; i < datos.length; i++) datos[i] = i % 256;

  const trozos = await vaciar(flujoDeBytes(datos));
  const salida = Buffer.concat(trozos);
  afirmar(salida.length === datos.length, `salen los mismos bytes que entraron (${salida.length})`);
  afirmar(salida.equals(datos), "y en el mismo orden, sin perder ni repetir ninguno");

  // 2. Sale por trozos de verdad. Es la razón de existir del módulo: encolar
  //    el archivo entero de una vez sería un cuerpo formado con
  //    `ReadableStream` de disfraz, y entonces el tope de 4,5 MB de la
  //    plataforma seguiría aplicándose.
  const enTres = await vaciar(flujoDeBytes(datos, 400));
  afirmar(enTres.length === 3, `mil bytes en trozos de cuatrocientos salen en tres (${enTres.length})`);
  afirmar(enTres[2].length === 200, `y el último trae solo lo que queda (${enTres[2].length})`);

  // 3. El caso del borde: un archivo más pequeño que el trozo sale en uno solo,
  //    y uno vacío no cuelga esperando un trozo que no llega.
  const uno = await vaciar(flujoDeBytes(Buffer.alloc(10), 400));
  afirmar(uno.length === 1, "un archivo más pequeño que el trozo sale en un solo trozo");

  const vacio = await vaciar(flujoDeBytes(Buffer.alloc(0)));
  afirmar(vacio.length === 0, "y uno vacío cierra sin entregar nada, en vez de colgarse");

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-flujo.ts`
Expected: FAIL — no existe `@/lib/flujo`, error de resolución del módulo.

- [ ] **Step 3: Escribe `lib/flujo.ts`**

```ts
/**
 * Convierte unos bytes ya en memoria en un cuerpo de respuesta que sale por
 * trozos.
 *
 * Existe por un límite de la plataforma y no por elegancia: en Vercel, una
 * respuesta cuyo cuerpo se forma entero antes de mandarlo no puede pasar de
 * 4,5 MB, y las respuestas en streaming no tienen ese tope. Un m4a de 6 MB
 * —lo que pesa la Tarea 1 del Cervantes ya comprimida— no se puede servir de
 * la primera forma.
 *
 * Y va por trozos de verdad, no encolando el archivo entero de una vez: un
 * solo `enqueue` con seis megas dentro es un cuerpo formado con
 * `ReadableStream` de disfraz, y no hay por qué apostar a que la plataforma
 * lo mire con buenos ojos.
 *
 * No importa `prisma` ni nada del navegador: entran bytes y sale un flujo.
 */

/**
 * 256 KB. Lo bastante grande para no trocear de más un audio de seis megas
 * (veinticuatro trozos) y lo bastante pequeño para que no se parezca a mandar
 * el archivo de una vez.
 */
const TROZO_POR_DEFECTO = 256 * 1024;

export function flujoDeBytes(datos: Buffer, trozo = TROZO_POR_DEFECTO): ReadableStream<Uint8Array> {
  let enviado = 0;
  return new ReadableStream({
    // `pull` y no `start`: así se copia un trozo cuando el otro lado está
    // listo para recibirlo, en vez de empujarlos todos a la cola de golpe.
    pull(control) {
      if (enviado >= datos.length) {
        control.close();
        return;
      }
      const fin = Math.min(enviado + trozo, datos.length);
      // `new Uint8Array(...)` sobre el `subarray`: `subarray` comparte memoria
      // con el Buffer de origen, y lo que se encola tiene que ser una vista
      // que nadie más vaya a tocar.
      control.enqueue(new Uint8Array(datos.subarray(enviado, fin)));
      enviado = fin;
    },
  });
}
```

- [ ] **Step 4: Ejecútala para verla pasar**

Run: `npx tsx scripts/verificar-flujo.ts`
Expected: PASS — seis `OK:` y «Todo bien.»

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/flujo.ts scripts/verificar-flujo.ts
git commit -m "Un cuerpo que sale por trozos, para el tope de la respuesta"
```

---

### Task 2: Servir el archivo en flujo

**Files:**
- Modify: `app/api/archivos/[id]/route.ts` (las dos salidas con bytes: el 206 y el archivo entero)

**Interfaces:**
- Consumes: `flujoDeBytes` de `@/lib/flujo` (Task 1).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Añade el import**

En `app/api/archivos/[id]/route.ts`, junto al resto de imports:

```ts
import { flujoDeBytes } from "@/lib/flujo";
```

- [ ] **Step 2: Cambia el cuerpo del 206**

Sustituye la primera línea del `new Response(` del bloque `if (rango.clase === "trozo")`:

```ts
  if (rango.clase === "trozo") {
    return new Response(
      flujoDeBytes(contenido.datos.subarray(rango.inicio, rango.fin + 1)),
      {
        status: 206,
```

El resto del bloque —las cabeceras, el `Content-Range`, el `Vary: Range`— no se toca.

- [ ] **Step 3: Cambia el cuerpo de la respuesta entera**

La última salida de la ruta pasa a ser:

```ts
  // El cuerpo va en flujo por el tope de la plataforma: una respuesta formada
  // entera antes de mandarla no puede pasar de 4,5 MB en Vercel, y un m4a de
  // seis megas es justo lo que hay dentro de esta columna. Ver `lib/flujo.ts`.
  //
  // El `Content-Length` se queda: se sabe de antemano cuántos bytes son, y
  // anunciarlos deja que el navegador pinte la barra de progreso y sepa
  // cuándo ha terminado.
  return new Response(flujoDeBytes(contenido.datos), {
    headers: {
      "Content-Type": cabecera.tipo,
      // Los bytes que se mandan, no lo que diga la columna `tamano`: las otras
      // dos salidas ya cuentan bytes reales, y contar aquí de otra forma es la
      // manera de que un día no cuadren.
      "Content-Length": String(total),
      // Sin esto el cliente no sabe que puede pedir trozos, y WebKit ni lo
      // intenta.
      "Accept-Ranges": "bytes",
      "Cache-Control": cache,
    },
  });
```

- [ ] **Step 4: Deja el 416 y los 404 como están**

No se tocan. Su cuerpo es una frase de treinta bytes, y envolverla en un flujo sería ruido sin ninguna razón detrás.

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Comprueba a mano que un audio sigue sonando**

Run: `npm run dev`, abre un paso con audio y dale al play. Comprueba también que arrastrar la barra a la mitad funciona (eso es el 206).
Expected: suena, y saltar a un minuto concreto responde al momento.

- [ ] **Step 7: Commit**

```bash
git add app/api/archivos/[id]/route.ts
git commit -m "Servir el archivo en flujo, que es lo que no tiene tope"
```

---

### Task 3: El caudal de la grabadora y unos topes que no mienten

**Files:**
- Modify: `components/expresion/grabadora.tsx:95` (`MAXIMO_ARCHIVO`), la llamada a `getUserMedia` (~línea 341) y la construcción del `MediaRecorder` (~línea 361)
- Modify: `lib/expresion.ts:161-165` (`MAXIMO_AUDIO_RECIBIDO`)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `MAXIMO_AUDIO_RECIBIDO = 4 * 1024 * 1024` en `@/lib/expresion`, que `app/api/entregas/audio/route.ts` ya importa y no hay que tocar.

- [ ] **Step 1: Baja el tope del servidor**

En `lib/expresion.ts`, sustituye el bloque de `MAXIMO_AUDIO_RECIBIDO` entero (comentario incluido):

```ts
/**
 * Lo que aceptamos recibir de un alumno, antes de comprimir.
 *
 * Cuatro megas, y no es prudencia nuestra: en Vercel el cuerpo de una petición
 * no puede pasar de 4,5 MB, y ese corte lo da la plataforma **antes** de que
 * corra el manejador de la ruta. Un tope de cincuenta megas que en realidad
 * son cuatro y medio es un tope que miente: quien se choque con él no ve el
 * mensaje que hay escrito aquí abajo, ve un error mudo de la plataforma
 * después de haber esperado la subida entera.
 *
 * Lo que hace que cuatro megas basten está en la grabadora: graba a 32 kbps,
 * así que sus quince minutos de tope rondan los 3,6 MB.
 */
export const MAXIMO_AUDIO_RECIBIDO = 4 * 1024 * 1024;
```

- [ ] **Step 2: Baja la copia del tope en la grabadora**

En `components/expresion/grabadora.tsx`, sustituye el bloque de `MAXIMO_ARCHIVO`:

```ts
/**
 * El tope de lo que la puerta acepta recibir. Copia a mano de
 * `MAXIMO_AUDIO_RECIBIDO` en `lib/expresion.ts`, y las dos tienen que moverse
 * juntas. Comprobarlo aquí no es adornar: un archivo que se pasa no llega
 * siquiera a la puerta —lo corta Vercel, o el proxy en local— y el alumno
 * recibía «No se pudo leer la grabación enviada. Vuelve a intentarlo»,
 * después de la subida y sin que reintentar arreglara nada.
 */
const MAXIMO_ARCHIVO = 4 * 1024 * 1024;
```

- [ ] **Step 3: Cambia el mensaje del rechazo por tamaño**

En la función `elegirArchivo`, el mensaje pasa a decir qué hacer con un tope tan bajo:

```ts
    if (archivo.size > MAXIMO_ARCHIVO) {
      setError(
        `Ese archivo pesa ${enMegas(archivo.size)} y el tope son ${enMegas(MAXIMO_ARCHIVO)}. ` +
          `Graba desde aquí con el botón de arriba, o manda una grabación más corta.`,
      );
      return;
    }
```

El consejo viejo —«guárdala en MP3 antes de subirla»— sale: con cuatro megas, reguardar en MP3 no salva un archivo largo, y grabar desde la aplicación sí, porque la grabadora ya elige un caudal que cabe.

- [ ] **Step 4: Pide un solo canal al micrófono**

En `empezar()`, la llamada a `getUserMedia`:

```ts
        // Un canal, no dos: es voz, y el estéreo dobla el tamaño para no
        // aportar nada. `ideal` y no un número pelado a propósito: como
        // restricción exacta, un micrófono que solo sepa dar estéreo haría
        // que `getUserMedia` fallara y el alumno se quedaría sin botón.
        pista = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: { ideal: 1 } },
        });
```

- [ ] **Step 5: Fija el caudal de la grabadora**

Encima de `CONTENEDORES`, añade la constante:

```ts
/**
 * El caudal con el que graba, en bits por segundo.
 *
 * Sin esto Chrome graba a unos 128 kbps, y los quince minutos que la propia
 * grabadora permite salen a 14 MB: un rechazo seguro, porque el tope de lo que
 * se puede mandar son cuatro. A 32 kbps esos quince minutos rondan los 3,6 MB.
 *
 * 32 kbps en opus es de sobra para una voz hablando —el material del Cervantes
 * se comprime a 48 y se consideró calidad suficiente para un examen de
 * comprensión—, y aun así el margen contra el tope es de 400 KB: es un caudal
 * medio y no un techo, así que una grabación con mucho ruido de fondo puede
 * pasarse un poco. Por eso el tope sigue ahí, para cazarla y explicarlo.
 */
const CAUDAL = 32000;
```

Y la construcción del `MediaRecorder` pasa a llevarlo en las dos ramas:

```ts
        // El contenedor se pide, no se acepta el que salga: ver `CONTENEDORES`.
        const contenedor = contenedorPreferido();
        grabadora = contenedor
          ? new MediaRecorder(pista, { mimeType: contenedor, audioBitsPerSecond: CAUDAL })
          : new MediaRecorder(pista, { audioBitsPerSecond: CAUDAL });
```

- [ ] **Step 6: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 7: Comprueba a mano que el tamaño bajó**

Run: `npm run dev`, entra en un paso de oral grabada, graba dos minutos y entrégalo. Mira en el registro del servidor o en la base el `tamano` del `Archivo` creado.
Expected: dos minutos rondan los 500 KB (a 32 kbps son 480 KB), no los 2 MB de antes.

- [ ] **Step 8: Commit**

```bash
git add lib/expresion.ts components/expresion/grabadora.tsx
git commit -m "Grabar a 32 kbps, y unos topes que dicen la verdad"
```

---

### Task 4: El compresor viaja dentro de la función

**Files:**
- Modify: `package.json` (dependencia `ffmpeg-static`)
- Modify: `lib/audio.ts` (el tipo `Compresor`, la lista `COMPRESORES`, `compresoresInstalados`)
- Modify: `next.config.ts` (`serverExternalPackages`, `outputFileTracingIncludes`)
- Modify: `app/api/archivos/route.ts` y `app/api/entregas/audio/route.ts` (`maxDuration`)
- Modify: `scripts/verificar-audio.ts` (que el empaquetado cuenta)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `compresoresInstalados(): Promise<string[]>` sigue existiendo con la misma firma, pero devuelve **nombres legibles** (`"afconvert"`, `"ffmpeg"`, `"ffmpeg empaquetado"`) en vez de la orden que se ejecuta. La Task 5 no lo usa; solo el script.

- [ ] **Step 1: Instala la dependencia**

Run: `npm install ffmpeg-static`
Expected: entra en `dependencies`. Descarga el binario en la instalación (~78 MB en `node_modules`), así que tarda.

- [ ] **Step 2: Comprueba que el binario está y funciona**

Run: `node -e "const p=require('ffmpeg-static'); console.log(p); require('node:child_process').spawnSync(p,['-version'],{stdio:'inherit'})"`
Expected: imprime una ruta dentro de `node_modules/ffmpeg-static/` y después la versión de ffmpeg.

- [ ] **Step 3: Añade el nombre al tipo `Compresor`**

En `lib/audio.ts`, el tipo pasa a tener un nombre legible aparte de la orden, porque a partir de ahora una de las órdenes es una ruta absoluta larga y no sirve para informar:

```ts
type Compresor = {
  /** Cómo se llama para contarlo, que ya no es lo mismo que cómo se ejecuta. */
  nombre: string;
  orden: string;
  /** Los argumentos, dados el archivo de entrada y el de salida. */
  args: (entrada: string, salida: string) => string[];
};
```

- [ ] **Step 4: Añade el tercer compresor**

Arriba del todo del archivo, con el resto de imports:

```ts
import ffmpegEmpaquetado from "ffmpeg-static";
```

Y la lista pasa a ser (nótese el `nombre` nuevo en los dos que ya había, y el tercero al final):

```ts
/**
 * Los argumentos de ffmpeg, que ahora los usan dos entradas de la lista: el
 * `ffmpeg` que pueda haber en el `PATH` y el que llevamos empaquetado. Es el
 * mismo programa, así que se le habla igual; escribirlo dos veces sería dejar
 * puesta la trampa de que un día alguien arregle una copia y no la otra.
 *
 * `-vn` descarta cualquier flujo de vídeo: muchos MP3 llevan una carátula
 * incrustada, que ffmpeg trata como vídeo (mjpeg) y selecciona por defecto, y
 * el muxer de `.m4a` no admite mjpeg y aborta con un MP3 perfectamente sano.
 * `-nostdin` evita que, lanzado sin terminal, se quede esperando entrada por
 * teclado en vez de fallar o terminar.
 */
const ARGS_FFMPEG = (e: string, s: string) => [
  "-y", "-nostdin", "-i", e, "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "48k", s,
];

const COMPRESORES: Compresor[] = [
  {
    nombre: "afconvert",
    orden: "afconvert",
    args: (e, s) => ["-f", "mp4f", "-d", "aac", "-b", "48000", "-c", "1", e, s],
  },
  {
    nombre: "ffmpeg",
    orden: "ffmpeg",
    args: ARGS_FFMPEG,
  },
  // El último a propósito: es el único que existe siempre, así que ponerlo
  // antes dejaría los otros dos sin usarse nunca. Y hace falta porque en
  // Vercel no hay ninguno de los dos anteriores —`afconvert` es de macOS, y el
  // runtime no trae `ffmpeg`—: o el binario viaja dentro del despliegue o no
  // hay con qué comprimir.
  //
  // El diseño del 01/08/2026 descartó este paquete por sus 80 MB y por la
  // GPL-3.0, con la condición de que «el día que se despliegue en Linux,
  // instalar ffmpeg en ese servidor es una línea de configuración». Esa
  // condición no se cumple aquí: en Vercel no hay servidor donde instalar
  // nada. Sobre la licencia: el binario se ejecuta como proceso aparte y no se
  // distribuye —corre en nuestro servidor, a nadie le llega una copia—, y la
  // GPLv3 no tiene cláusula de uso en red.
  ...(ffmpegEmpaquetado
    ? [{ nombre: "ffmpeg empaquetado", orden: ffmpegEmpaquetado, args: ARGS_FFMPEG }]
    : []),
];
```

El `ffmpegEmpaquetado ?` no es ceremonia: el paquete declara su export como `string | null` —es `null` si no hubo binario para esta plataforma—, y sin la comprobación no compila.

- [ ] **Step 5: Que `compresoresInstalados` devuelva nombres**

```ts
export async function compresoresInstalados(): Promise<string[]> {
  return (await buscarCompresores()).map((c) => c.nombre);
}
```

- [ ] **Step 6: Que el mensaje de «no hay compresor» siga siendo verdad**

El texto del `CompresorAusenteError` dice hoy que hace falta instalar `ffmpeg`. Con el empaquetado presente, quedarse sin ninguno solo puede pasar si el binario no viajó con el despliegue, y el mensaje tiene que decir eso:

```ts
    throw new CompresorAusenteError(
      "No hay ningún compresor de audio disponible. Debería venir uno " +
        "empaquetado con la aplicación: si esto sale en el servidor, el " +
        "binario de `ffmpeg-static` no ha viajado con el despliegue.",
    );
```

- [ ] **Step 7: Que el binario viaje con la función**

En `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "ffmpeg-static"],

  // El binario de ffmpeg no es código que el empaquetador pueda seguir: nadie
  // lo importa, se lanza como proceso. Sin esto no viaja con la función y en
  // producción no hay con qué comprimir. Las claves son rutas de ruta (route
  // globs) y los valores se resuelven desde la raíz del proyecto.
  outputFileTracingIncludes: {
    "/api/archivos": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/entregas/audio": ["./node_modules/ffmpeg-static/ffmpeg"],
  },

  // Con `proxy.ts` en la raíz, Next bufferiza el cuerpo de toda petición que
  // pase por él —incluidas las de `/api`— ANTES de que corra el manejador de
  // la ruta, y por defecto solo guarda los primeros 10 MB.
  //
  // Ojo: este número solo manda en local. En Vercel el cuerpo de una petición
  // no puede pasar de 4,5 MB y lo corta la plataforma antes de llegar aquí,
  // así que los topes que de verdad valen en producción son los de las rutas
  // (`MAXIMO_SUBIDA` y `MAXIMO_AUDIO_RECIBIDO`), puestos por debajo de esa
  // cifra. Esto se queda para que en el portátil el comportamiento no sea
  // distinto por accidente.
  experimental: {
    proxyClientMaxBodySize: 100 * 1024 * 1024,
  },
};
```

- [ ] **Step 8: Dale tiempo a comprimir en las dos rutas**

Arriba del todo de `app/api/archivos/route.ts` y de `app/api/entregas/audio/route.ts`, después de los imports:

```ts
/**
 * Comprimir quince minutos de audio tarda unos segundos, pero traerse un MP3
 * de 36 MB de una dirección ajena puede tardar bastante más. Cinco minutos es
 * el máximo del plan que hay, y de sobra para las dos cosas.
 */
export const maxDuration = 300;
```

(En `app/api/entregas/audio/route.ts` el comentario sobra la parte de la dirección: ahí solo se comprime. Ajústalo a «Comprimir tarda unos segundos; cinco minutos es el máximo del plan y va de sobra.»)

- [ ] **Step 9: Que el script cuente el empaquetado**

En `scripts/verificar-audio.ts`, después de la comprobación de `hayCompresor()`, añade:

```ts
  // El empaquetado tiene que estar siempre, y eso es lo que distingue «hay
  // ffmpeg en esta máquina por casualidad» de «lo llevamos puesto». Es la
  // única afirmación que se puede hacer aquí sobre lo que habrá en Vercel.
  const instalados = await compresoresInstalados();
  afirmar(
    instalados.includes("ffmpeg empaquetado"),
    `el compresor empaquetado está disponible (hay: ${instalados.join(", ")})`,
  );
```

- [ ] **Step 10: Ejecuta la verificación**

Run: `npx tsx scripts/verificar-audio.ts`
Expected: PASS, incluida la afirmación nueva. En el Mac dirá `hay: afconvert, ffmpeg empaquetado`.

- [ ] **Step 11: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json lib/audio.ts next.config.ts app/api/archivos/route.ts app/api/entregas/audio/route.ts scripts/verificar-audio.ts
git commit -m "Llevar el compresor puesto, que en Vercel no hay ninguno"
```

---

### Task 5: `lib/enlaces.ts` — traducir una dirección, y decir que no

**Files:**
- Create: `lib/enlaces.ts`
- Create: `scripts/verificar-enlaces.ts`

**Interfaces:**
- Consumes: `TIPOS_AUDIO` y `tipoBase` de `@/lib/audio`.
- Produces, para la Task 6:
  - `class EnlaceInvalidoError extends Error`
  - `direccionDeDescarga(enlace: string): string`
  - `traerAudio(enlace: string, maximo: number, pedir?: typeof fetch): Promise<{ datos: Buffer<ArrayBuffer>; tipo: string; nombre: string }>`

- [ ] **Step 1: Escribe la verificación que falla**

Crea `scripts/verificar-enlaces.ts`:

```ts
/**
 * Verifica la traducción de direcciones y, sobre todo, las que hay que
 * rechazar: le estamos pidiendo al servidor que vaya a una dirección escrita
 * por una persona.
 *
 * No sale a la red: `traerAudio` recibe un `pedir` de mentira.
 *
 * Ejecutar con:  npx tsx scripts/verificar-enlaces.ts
 */
import { direccionDeDescarga, EnlaceInvalidoError, traerAudio } from "@/lib/enlaces";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/** Que `accion` lance un `EnlaceInvalidoError`, y no otra cosa cualquiera. */
async function rechaza(accion: () => unknown, mensaje: string) {
  try {
    await accion();
  } catch (e) {
    afirmar(e instanceof EnlaceInvalidoError, `${mensaje} (${(e as Error).message})`);
    return;
  }
  throw new Error(`FALLO: ${mensaje} — no lanzó nada`);
}

/** Una respuesta de mentira, con los bytes y las cabeceras que se le digan. */
function respuesta(cuerpo: Uint8Array, cabeceras: Record<string, string>): Response {
  return new Response(cuerpo, { status: 200, headers: cabeceras });
}

async function main() {
  // 1. El enlace que Drive da al compartir se traduce a uno de descarga. El de
  //    compartir es una página web: descargarlo se trae HTML, no un MP3.
  const compartido = "https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing";
  const traducido = direccionDeDescarga(compartido);
  afirmar(
    traducido.includes("1AbC_dEf-123") && !traducido.includes("/view"),
    `el enlace de compartir de Drive lleva el id a una descarga (${traducido})`,
  );

  // 2. La otra forma que da Drive, la de `open?id=`.
  const abierto = direccionDeDescarga("https://drive.google.com/open?id=1AbC_dEf-123");
  afirmar(abierto === traducido, "y `open?id=` acaba en la misma dirección que `/file/d/`");

  // 3. Lo que ya es una dirección directa se deja en paz. Drive no es el único
  //    sitio del mundo donde se puede tener un audio.
  const directa = "https://ejemplo.org/audios/tarea1.mp3";
  afirmar(direccionDeDescarga(directa) === directa, "una dirección directa no se toca");

  // 4. Los rechazos. Esto es la razón de ser del módulo: el servidor va a
  //    pedir lo que ponga aquí, así que lo que no sea la web pública se para.
  await rechaza(() => direccionDeDescarga("file:///etc/passwd"), "un `file:` se rechaza");
  await rechaza(() => direccionDeDescarga("data:audio/mp3;base64,AAAA"), "un `data:` se rechaza");
  await rechaza(() => direccionDeDescarga("http://localhost:3000/api/archivos"), "localhost se rechaza");
  await rechaza(() => direccionDeDescarga("http://127.0.0.1/"), "127.0.0.1 se rechaza");
  await rechaza(() => direccionDeDescarga("http://192.168.1.10/audio.mp3"), "una IP de red local se rechaza");
  await rechaza(() => direccionDeDescarga("http://10.0.0.5/audio.mp3"), "una IP de red privada se rechaza");
  await rechaza(
    () => direccionDeDescarga("http://169.254.169.254/latest/meta-data/"),
    "el servicio de metadatos de la nube se rechaza",
  );
  await rechaza(() => direccionDeDescarga("no es una dirección"), "un texto que no es una dirección se rechaza");

  // 5. `traerAudio` corta cuando se pasa del tope, en vez de leer en memoria
  //    lo que el otro lado quiera mandar.
  const grande = new Uint8Array(5000);
  await rechaza(
    () => traerAudio(directa, 1000, async () => respuesta(grande, { "content-type": "audio/mpeg" })),
    "un archivo que se pasa del tope se corta",
  );

  // 6. El tipo, en cascada. Drive manda `application/octet-stream`, así que
  //    comprobar contra `TIPOS_AUDIO` a secas rechazaría un MP3 sano.
  const bytes = new Uint8Array(100);
  const porCabecera = await traerAudio(directa, 10_000, async () =>
    respuesta(bytes, { "content-type": "audio/mpeg" }),
  );
  afirmar(porCabecera.tipo === "audio/mpeg", "si el servidor declara un tipo de los nuestros, se usa");
  afirmar(porCabecera.nombre === "tarea1.mp3", `y el nombre sale de la dirección (${porCabecera.nombre})`);

  const porNombre = await traerAudio(directa, 10_000, async () =>
    respuesta(bytes, {
      "content-type": "application/octet-stream",
      "content-disposition": 'attachment; filename="Tarea 1.mp3"',
    }),
  );
  afirmar(
    porNombre.tipo === "audio/mpeg",
    `con octet-stream, el tipo lo dice la extensión del nombre (${porNombre.tipo})`,
  );
  afirmar(porNombre.nombre === "Tarea 1.mp3", "y el nombre sale del Content-Disposition");

  const sinPista = await traerAudio("https://ejemplo.org/descarga", 10_000, async () =>
    respuesta(bytes, { "content-type": "application/octet-stream" }),
  );
  afirmar(
    sinPista.tipo === "",
    "y si no hay ninguna pista, el tipo se deja vacío para que decida el compresor",
  );

  // 7. Una página web no es un audio: Drive contesta HTML cuando el archivo no
  //    está compartido, y guardar ese HTML creyendo que es un MP3 es el fallo
  //    que este caso evita.
  await rechaza(
    () =>
      traerAudio(directa, 10_000, async () =>
        respuesta(new TextEncoder().encode("<html>No tienes acceso</html>"), {
          "content-type": "text/html; charset=utf-8",
        }),
      ),
    "una página web en vez de un audio se rechaza",
  );

  // 8. Un 404 del otro lado no se guarda como si fuera el archivo.
  await rechaza(
    () => traerAudio(directa, 10_000, async () => new Response("No existe", { status: 404 })),
    "una respuesta con error se rechaza",
  );

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-enlaces.ts`
Expected: FAIL — no existe `@/lib/enlaces`.

- [ ] **Step 3: Escribe `lib/enlaces.ts`**

```ts
import { tipoBase, TIPOS_AUDIO } from "@/lib/audio";

/**
 * Traerse un audio de una dirección que ha escrito el profesor.
 *
 * Existe por un límite de la plataforma: en Vercel el cuerpo de una petición
 * no puede pasar de 4,5 MB, así que los MP3 del Cervantes —35,7 MB el mayor—
 * no caben por el formulario. Pero ese tope solo está en el tramo navegador →
 * función: una función que **descarga** un archivo no tiene ninguno. Así que
 * el profesor sube el archivo a Drive, pega el enlace, y el servidor va a por
 * él.
 *
 * No importa `prisma` ni nada del navegador: entra un texto y salen bytes.
 *
 * La otra mitad del módulo es decir que no. Le estamos pidiendo al servidor
 * que haga una petición a una dirección escrita por una persona, y aunque esa
 * persona sea profesor —la ruta ya exige PROFESOR o ADMIN—, esa puerta se
 * cierra desde el primer día: que hoy no haya nada interesante detrás no es
 * motivo para dejarla abierta.
 */

/** Que la dirección no se puede pedir, con el motivo dicho en castellano. */
export class EnlaceInvalidoError extends Error {}

/**
 * Lo que esta puerta **no** cierra, dicho para que nadie la crea más fuerte de
 * lo que es: se mira el nombre de máquina que viene escrito, no la IP a la que
 * resuelve. Un dominio público que apunte a 127.0.0.1 pasa. Cerrar eso pide
 * resolver el nombre a mano y volver a comprobarlo al conectar, y no se hace
 * hoy porque quien puede pegar una dirección aquí ya es profesor o
 * administrador. Si algún día esta ruta se abre a más gente, esto es lo
 * primero que hay que arreglar.
 */

/**
 * Los nombres de máquina que no se piden nunca. `169.254.169.254` es el
 * servicio de metadatos de las nubes: quien consiga que un servidor lo pida
 * por él se lleva las credenciales de la máquina.
 */
const PROHIBIDOS = [/^localhost$/i, /^\[?::1\]?$/, /\.local$/i, /\.internal$/i];

/** Los rangos de IPv4 que no salen a la web pública. */
function esPrivada(maquina: string): boolean {
  const partes = maquina.split(".");
  if (partes.length !== 4) return false;
  const [a, b] = partes.map((p) => Number(p));
  if (partes.some((p) => !/^\d+$/.test(p)) || [a, b].some((n) => Number.isNaN(n))) return false;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 169.254.0.0/16: enlace local, y dentro está el servicio de metadatos.
  if (a === 169 && b === 254) return true;
  return false;
}

/** El id del archivo, si la dirección es una de las dos formas de Drive. */
function idDeDrive(direccion: URL): string | null {
  if (!/(^|\.)drive\.google\.com$/i.test(direccion.hostname)) return null;
  // https://drive.google.com/file/d/<id>/view?usp=sharing
  const enRuta = direccion.pathname.match(/^\/file\/d\/([^/]+)/);
  if (enRuta) return enRuta[1];
  // https://drive.google.com/open?id=<id>
  return direccion.searchParams.get("id");
}

/**
 * La dirección de la que hay que descargar de verdad.
 *
 * Para Drive no es la misma que la que te da al compartir: esa
 * (`/file/d/<id>/view`) es una página web, y descargarla se trae HTML. Para
 * todo lo demás, la que venga.
 *
 * Lanza `EnlaceInvalidoError` si la dirección no se puede pedir.
 */
export function direccionDeDescarga(enlace: string): string {
  let direccion: URL;
  try {
    direccion = new URL(enlace.trim());
  } catch {
    throw new EnlaceInvalidoError("Eso no parece una dirección de internet.");
  }

  if (direccion.protocol !== "http:" && direccion.protocol !== "https:") {
    throw new EnlaceInvalidoError("Solo se pueden traer direcciones http o https.");
  }

  const maquina = direccion.hostname;
  if (PROHIBIDOS.some((p) => p.test(maquina)) || esPrivada(maquina)) {
    throw new EnlaceInvalidoError("Esa dirección no es pública, así que no se puede traer.");
  }

  const id = idDeDrive(direccion);
  if (id) {
    // `drive.usercontent.google.com` con `confirm=t` es lo que hoy sirve el
    // archivo sin pasar por la pantalla de aviso de antivirus que Drive
    // interpone con los archivos grandes.
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  }

  return direccion.toString();
}

/** De la extensión del nombre al tipo, para cuando el servidor no lo dice. */
const POR_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

/** El nombre que anuncia el otro lado, si anuncia alguno. */
function nombreDeCabecera(disposicion: string | null): string | null {
  if (!disposicion) return null;
  const entrecomillado = disposicion.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return entrecomillado ? decodeURIComponent(entrecomillado[1].trim()) : null;
}

function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase();
}

/**
 * Descarga el audio, cortando en cuanto se pasa del tope.
 *
 * `pedir` existe para poder verificar esto sin salir a la red, que es lo único
 * que hace comprobable un módulo que por definición habla con fuera.
 *
 * El tipo se resuelve en cascada y con motivo: **Drive no manda el tipo real**,
 * manda `application/octet-stream`. Comprobar contra `TIPOS_AUDIO` a secas
 * —lo primero que uno escribe— rechazaría un MP3 perfectamente sano. Así que:
 * el que declara el servidor si es de los nuestros; si no, el que diga la
 * extensión del nombre; y si tampoco, vacío, y que decida el compresor, que es
 * el único que abre el archivo de verdad.
 */
export async function traerAudio(
  enlace: string,
  maximo: number,
  pedir: typeof fetch = fetch,
): Promise<{ datos: Buffer<ArrayBuffer>; tipo: string; nombre: string }> {
  const direccion = direccionDeDescarga(enlace);

  let respuesta: Response;
  try {
    respuesta = await pedir(direccion, { redirect: "follow" });
  } catch {
    throw new EnlaceInvalidoError(
      "No se pudo conectar con esa dirección. Comprueba que el enlace es correcto.",
    );
  }

  if (!respuesta.ok) {
    throw new EnlaceInvalidoError(
      `Esa dirección contestó con un error (${respuesta.status}). Si es de Drive, ` +
        `comprueba que el archivo está compartido con enlace.`,
    );
  }

  const declarado = tipoBase(respuesta.headers.get("content-type") ?? "");

  // Una página web no es un audio. Es el caso de un archivo de Drive que no
  // está compartido: contesta 200 con el HTML de «pide acceso», y sin esto se
  // guardaría ese HTML creyendo que es un MP3.
  if (declarado.startsWith("text/")) {
    throw new EnlaceInvalidoError(
      "Esa dirección devuelve una página web, no un archivo de audio. Si es de " +
        "Drive, comprueba que está compartido con «cualquier persona con el enlace».",
    );
  }

  const anunciado = Number(respuesta.headers.get("content-length") ?? "");
  if (Number.isFinite(anunciado) && anunciado > maximo) {
    throw new EnlaceInvalidoError(
      `Ese archivo pesa ${Math.round(anunciado / (1024 * 1024))} MB y el tope son ` +
        `${Math.round(maximo / (1024 * 1024))} MB.`,
    );
  }

  // Y aun así se cuenta al leer: el `Content-Length` es una promesa del otro
  // lado, no un hecho, y puede no venir.
  const trozos: Uint8Array[] = [];
  let leidos = 0;
  const lector = respuesta.body?.getReader();
  if (!lector) throw new EnlaceInvalidoError("Esa dirección no devolvió ningún contenido.");
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    leidos += value.length;
    if (leidos > maximo) {
      await lector.cancel();
      throw new EnlaceInvalidoError(
        `Ese archivo pesa más de ${Math.round(maximo / (1024 * 1024))} MB, que es el tope.`,
      );
    }
    trozos.push(value);
  }

  const nombre =
    nombreDeCabecera(respuesta.headers.get("content-disposition")) ??
    decodeURIComponent(new URL(direccion).pathname.split("/").pop() || "");

  const tipo = TIPOS_AUDIO.includes(declarado)
    ? declarado
    : (POR_EXTENSION[extensionDe(nombre)] ?? "");

  return {
    datos: Buffer.concat(trozos) as Buffer<ArrayBuffer>,
    tipo,
    nombre: nombre || "audio",
  };
}
```

- [ ] **Step 4: Ejecútala para verla pasar**

Run: `npx tsx scripts/verificar-enlaces.ts`
Expected: PASS — todas las afirmaciones y «Todo bien.»

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/enlaces.ts scripts/verificar-enlaces.ts
git commit -m "Traerse un audio de una dirección, y las que no se piden nunca"
```

---

### Task 6: La segunda entrada de `/api/archivos`

**Files:**
- Modify: `app/api/archivos/route.ts` (los topes, la rama por dirección, y el tramo común extraído)

**Interfaces:**
- Consumes: `traerAudio`, `EnlaceInvalidoError` de `@/lib/enlaces` (Task 5); `comprimirAudio`, `CompresorAusenteError`, `tipoBase`, `TIPOS_AUDIO` de `@/lib/audio`.
- Produces, para la Task 7: la ruta acepta `POST` con `Content-Type: application/json` y cuerpo `{ "url": "<enlace>" }`, y contesta igual que la de siempre — `{ url: "/api/archivos/<id>" }` con 200, o `{ error: "<texto>" }` con 400/403/500.

- [ ] **Step 1: Parte el tope de recepción en dos**

En `app/api/archivos/route.ts`, sustituye el bloque de `MAXIMO_AUDIO` por los dos topes que ahora hacen falta, porque los dos caminos ya no aguantan lo mismo:

```ts
// Lo que aceptamos recibir **por el formulario**, o sea desde el navegador.
// Cuatro megas, y el número no es nuestro: en Vercel el cuerpo de una petición
// no puede pasar de 4,5 MB y lo corta la plataforma antes de que este
// manejador llegue a opinar. Prometer más sería mentir.
const MAXIMO_SUBIDA = 4 * 1024 * 1024;

// Lo que aceptamos recibir **por dirección**, que es otra cosa: aquí quien
// descarga es el servidor, y ese tramo no tiene tope de plataforma. Cien megas
// dejan pasar de sobra el peor caso conocido —los 35,7 MB de la tarea 1 del
// A2/B1 escolar— sin abrir la puerta a traerse una película.
const MAXIMO_TRAIDO = 100 * 1024 * 1024;
```

- [ ] **Step 2: Extrae el tramo que las dos ramas comparten**

Debajo de las constantes, antes del `POST`, añade la función que comprime y guarda. Es literalmente lo que hoy hay al final del manejador, movido aquí para que las dos entradas lo usen sin duplicarlo:

```ts
/**
 * Comprimir, comprobar el tope de guardado y escribir la fila. Es el tramo
 * final común: da igual si los bytes llegaron por el formulario o si los trajo
 * el servidor de una dirección, a partir de aquí pasa lo mismo.
 *
 * Devuelve la respuesta ya montada, de acierto o de error, porque los tres
 * errores posibles se distinguen aquí dentro y no fuera.
 */
async function comprimirYGuardar(
  recibido: Buffer<ArrayBuffer>,
  nombreOriginal: string,
  tipoRecibido: string,
  usuarioId: string,
): Promise<Response> {
  // El recorte va antes de que `comprimirAudio` pueda añadirle `.m4a` al
  // nombre: recortar después se comía justo esa extensión con un nombre de más
  // de 200 caracteres. Se reserva sitio para la extensión más larga que puede
  // añadirse (".m4a", 4 caracteres).
  const nombreMaximo = 200;
  const margenExtension = 4;
  let nombre =
    nombreOriginal.length > nombreMaximo
      ? nombreOriginal.slice(0, nombreMaximo - margenExtension)
      : nombreOriginal;

  let datos = recibido;
  let tipo = tipoRecibido;
  try {
    ({ datos, tipo, nombre } = await comprimirAudio(recibido, nombre, tipoRecibido));
  } catch (e) {
    if (e instanceof CompresorAusenteError) {
      // Culpa del servidor, no del profesor ni de su archivo. Un 400 lo
      // disfrazaría de «tu archivo está mal» y nadie miraría el servidor.
      return Response.json({ error: e.message }, { status: 500 });
    }
    // Aquí sí es cosa del archivo: no es audio, o está dañado. Se rechaza en
    // vez de guardar el original de 36 MB callando.
    return Response.json(
      { error: e instanceof Error ? e.message : "No se pudo comprimir el audio." },
      { status: 400 },
    );
  }

  if (datos.length > MAXIMO_AUDIO_GUARDADO) {
    return Response.json(
      {
        error:
          "El audio comprimido sigue pesando demasiado. Prueba con un " +
          "archivo más corto o ya comprimido de otra forma.",
      },
      { status: 400 },
    );
  }

  const guardado = await prisma.archivo.create({
    data: { nombre, tipo, tamano: datos.length, datos, subidoPorId: usuarioId },
    select: { id: true },
  });

  return Response.json({ url: `/api/archivos/${guardado.id}` });
}
```

- [ ] **Step 3: Reparte el `POST` entre las dos entradas**

El manejador empieza igual —el 403 de siempre— y a continuación bifurca por el `Content-Type`:

```ts
export async function POST(peticion: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    return Response.json({ error: "Sin permiso." }, { status: 403 });
  }

  // Dos entradas para lo mismo. El formulario es el camino corto de lo
  // pequeño; la dirección es el único por el que puede entrar un MP3 de 36 MB,
  // porque el tope de 4,5 MB del cuerpo de una petición solo existe en el
  // tramo navegador → función: cuando quien descarga es el servidor, no hay.
  if (tipoBase(peticion.headers.get("content-type") ?? "") === "application/json") {
    return await porDireccion(peticion, usuario.id);
  }
  return await porFormulario(peticion, usuario.id);
}
```

- [ ] **Step 4: Escribe la rama por dirección**

Debajo de `comprimirYGuardar`:

```ts
/** El profesor pega un enlace y el servidor va a por el archivo. */
async function porDireccion(peticion: Request, usuarioId: string): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return Response.json({ error: "No se pudo leer la petición." }, { status: 400 });
  }

  const url =
    typeof cuerpo === "object" && cuerpo !== null && "url" in cuerpo
      ? String((cuerpo as { url: unknown }).url ?? "")
      : "";
  if (!url.trim()) {
    return Response.json({ error: "No llegó ninguna dirección." }, { status: 400 });
  }

  let traido;
  try {
    traido = await traerAudio(url, MAXIMO_TRAIDO);
  } catch (e) {
    if (e instanceof EnlaceInvalidoError) {
      // El mensaje ya está escrito en castellano y dice qué hacer: sale tal
      // cual. Es culpa de lo que se pegó, no del servidor.
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("No se pudo traer un audio de una dirección:", e);
    return Response.json(
      { error: "No se pudo traer el archivo de esa dirección." },
      { status: 400 },
    );
  }

  // Solo por dirección se admite un tipo vacío, y con motivo: Drive manda
  // `application/octet-stream`, así que exigir aquí uno de `TIPOS_AUDIO`
  // rechazaría un MP3 sano. Quien decide entonces es el compresor, que es el
  // único que abre el archivo de verdad y ya sabe rechazar lo que no es audio.
  if (traido.tipo && !TIPOS_AUDIO.includes(traido.tipo)) {
    return Response.json(
      { error: "Lo que hay en esa dirección no es un audio de los que admitimos." },
      { status: 400 },
    );
  }

  return await comprimirYGuardar(traido.datos, traido.nombre, traido.tipo, usuarioId);
}
```

- [ ] **Step 5: Escribe la rama del formulario**

Es el manejador de hoy, con el tope nuevo y sin el tramo final que ahora vive en `comprimirYGuardar`:

```ts
/** La subida de siempre, para lo que cabe por el navegador. */
async function porFormulario(peticion: Request, usuarioId: string): Promise<Response> {
  let formulario;
  try {
    formulario = await peticion.formData();
  } catch {
    // Pasa cuando el cuerpo se recorta antes de llegar aquí: en Vercel, porque
    // pasa de 4,5 MB; en local, por el tope del proxy en `next.config.ts`.
    // `formData()` no consigue reconstruir el `multipart` y lanza.
    return Response.json(
      {
        error:
          "No se pudo leer el archivo enviado: puede que sea demasiado grande. " +
          "Si es un audio, súbelo a Drive y pega aquí su enlace.",
      },
      { status: 400 },
    );
  }
  const archivo = formulario.get("archivo");

  if (!(archivo instanceof File)) {
    return Response.json({ error: "No llegó ningún archivo." }, { status: 400 });
  }
  // Sin los parámetros que puede traer detrás (`;codecs=…`, `;charset=…`):
  // comparar el tipo crudo rechaza archivos perfectamente válidos.
  const recibidoTipo = tipoBase(archivo.type);
  const esImagen = IMAGENES.includes(recibidoTipo);
  const esAudio = TIPOS_AUDIO.includes(recibidoTipo);

  if (!esImagen && !esAudio) {
    return Response.json({ error: "Solo se admiten imágenes y audios." }, { status: 400 });
  }

  const maximo = esImagen ? MAXIMO_IMAGEN : MAXIMO_SUBIDA;
  if (archivo.size > maximo) {
    return Response.json(
      {
        error: esImagen
          ? "La imagen pesa demasiado incluso después de reducirla."
          : "El audio pesa demasiado para subirlo desde el navegador. Súbelo a " +
            "Drive y pega aquí su enlace.",
      },
      { status: 400 },
    );
  }

  const recibido = Buffer.from(await archivo.arrayBuffer());

  // Una imagen no se comprime aquí —ya viene reducida del navegador—, así que
  // no pasa por el tramo del audio.
  if (esImagen) {
    const nombre = archivo.name.slice(0, 200);
    const guardado = await prisma.archivo.create({
      data: {
        nombre,
        tipo: recibidoTipo,
        tamano: recibido.length,
        datos: recibido,
        subidoPorId: usuarioId,
      },
      select: { id: true },
    });
    return Response.json({ url: `/api/archivos/${guardado.id}` });
  }

  return await comprimirYGuardar(recibido, archivo.name, recibidoTipo, usuarioId);
}
```

- [ ] **Step 6: Ajusta los imports del archivo**

Arriba tiene que estar `EnlaceInvalidoError` y `traerAudio`:

```ts
import { comprimirAudio, CompresorAusenteError, tipoBase, TIPOS_AUDIO } from "@/lib/audio";
import { EnlaceInvalidoError, traerAudio } from "@/lib/enlaces";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
```

- [ ] **Step 7: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si sale `archive`, es el error del Step 5.

- [ ] **Step 8: Comprueba a mano las dos entradas**

Run: `npm run dev`. Con la sesión de profesor abierta, en otra terminal:

```bash
# La dirección de un MP3 público cualquiera. Cambia la cookie por la tuya
# —cópiala del navegador— o hazlo desde la pantalla en la Task 7.
curl -s -X POST http://localhost:3000/api/archivos \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://ejemplo.org/audio.mp3"}'
```

Expected: `{"url":"/api/archivos/<id>"}`, y abriendo esa dirección en el navegador suena el audio. Con una dirección interna (`http://localhost:3000/x.mp3`) tiene que contestar el rechazo del módulo de enlaces.

- [ ] **Step 9: Commit**

```bash
git add app/api/archivos/route.ts
git commit -m "Que el servidor pueda ir a buscar el audio a una dirección"
```

---

### Task 7: La pantalla del profesor

**Files:**
- Modify: `components/recursos/subir-audio.tsx`

**Interfaces:**
- Consumes: la ruta de la Task 6 (`POST /api/archivos` con JSON `{ url }`).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Añade el tope y el estado que faltan**

Dentro del componente, junto a `subiendo` y `error`:

```ts
  const [trayendo, setTrayendo] = useState(false);
  // Lo que hay escrito en el campo de la dirección, que ya no se guarda solo
  // por escribirlo: ahora hay un botón que va a buscarlo.
  const [direccion, setDireccion] = useState("");
```

Y arriba del componente, con el resto de constantes del archivo:

```ts
/**
 * Lo que cabe por el navegador. Copia a mano de `MAXIMO_SUBIDA` en
 * `app/api/archivos/route.ts`, y las dos tienen que moverse juntas.
 *
 * Comprobarlo aquí no es adornar: por encima de 4,5 MB el cuerpo lo corta
 * Vercel antes de que la ruta llegue a contestar, así que el mensaje que
 * explica qué hacer —súbelo a Drive— solo puede darlo el navegador.
 */
const MAXIMO_SUBIDA = 4 * 1024 * 1024;

/** «35,7 MB», para poder decir cuánto pesa lo que se ha elegido. */
function enMegas(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}
```

- [ ] **Step 2: Para el archivo grande antes de mandarlo**

Al principio de `subir(archivo)`:

```ts
  async function subir(archivo: File) {
    if (archivo.size > MAXIMO_SUBIDA) {
      setError(
        `Ese archivo pesa ${enMegas(archivo.size)} y por el navegador solo caben ` +
          `${enMegas(MAXIMO_SUBIDA)}. Súbelo a Drive, compártelo con enlace y pega ` +
          `aquí abajo la dirección: el servidor irá a buscarlo él.`,
      );
      return;
    }
    setSubiendo(true);
    // …el resto igual
```

- [ ] **Step 3: Escribe la función que trae de una dirección**

```ts
  async function traer() {
    const enlace = direccion.trim();
    if (!enlace) return;
    setTrayendo(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/archivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: enlace }),
      });
      const json = await respuesta.json();
      if (!respuesta.ok) {
        setError(json.error ?? "No se pudo traer el audio de esa dirección.");
        return;
      }
      // Lo que se guarda es la dirección **nuestra**, no la de Drive: el
      // archivo ya está dentro, y así la clase sigue funcionando aunque el de
      // Drive se mueva, se descomparta o se borre.
      alCambiar(json.url);
      setDireccion("");
    } catch {
      setError("No se pudo traer el audio de esa dirección.");
    } finally {
      setTrayendo(false);
    }
  }
```

- [ ] **Step 4: Cambia el campo de la dirección por campo + botón**

Sustituye el `<input type="text">` de «…o pegar una dirección» por:

```tsx
        <input
          type="text"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="…o pegar la dirección de Drive"
          className={`${campo} mt-0 flex-1`}
        />
        <button
          type="button"
          disabled={trayendo || !direccion.trim()}
          onClick={traer}
          className="h-9 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400 disabled:opacity-40"
        >
          {trayendo ? "Trayendo y comprimiendo…" : "Traer de esa dirección"}
        </button>
```

El campo deja de escribir en `valor` según se teclea: antes, media dirección a medio pegar ya quedaba guardada como el audio del ejercicio.

- [ ] **Step 5: Que el reproductor y el «Quitar» sigan colgando de `valor`**

No se tocan: `valor` sigue siendo la dirección guardada, y ahora la ponen las dos vías —subir y traer— en vez de tres.

- [ ] **Step 6: Actualiza el comentario de cabecera del componente**

```tsx
/**
 * Elige el audio de un ejercicio: subiendo un archivo o pegando una dirección
 * de la que lo traiga el servidor. Las dos vías acaban en lo mismo —una
 * dirección de `/api/archivos/<id>` en el campo `audio`—, porque las dos
 * guardan el archivo dentro.
 *
 * Que la segunda vía exista no es comodidad: por el navegador solo caben 4 MB
 * —el tope del cuerpo de una petición en Vercel— y los MP3 del Cervantes pesan
 * hasta 35,7. Pegando la dirección, quien descarga es el servidor, y ahí no
 * hay tope.
 *
 * No reduce nada en el navegador, a diferencia de `subir-imagen.tsx`:
 * recomprimir audio en el navegador estropea la voz. Lo hace el servidor al
 * recibirlo, que es la parte lenta de la espera y por eso los botones lo dicen.
 */
```

- [ ] **Step 7: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 8: Comprueba a mano el recorrido entero**

Run: `npm run dev`, entra en Recursos → editar un ejercicio con audio.

1. Elige un MP3 de más de 4 MB con el botón de subir: tiene que salir el aviso que manda a Drive, **sin** llegar a subir nada.
2. Pega la dirección de compartir de un archivo de Drive y pulsa «Traer de esa dirección»: tiene que acabar con el reproductor puesto y sonando.
3. Comprueba que lo guardado es `/api/archivos/<id>` y no la dirección de Drive.

- [ ] **Step 9: Commit**

```bash
git add components/recursos/subir-audio.tsx
git commit -m "Pegar la dirección y que el servidor vaya a por el audio"
```

---

### Task 8: La comprobación en el despliegue de vista previa

Esta tarea no escribe código: comprueba en la máquina de verdad lo que ninguna verificación local puede ver, porque el fallo que arregla todo este plan está en la plataforma y no en el código.

**Files:** ninguno.

- [ ] **Step 1: Sube la rama y deja que Vercel haga la vista previa**

```bash
git push -u origin audio-en-vercel
```

Expected: Vercel construye un despliegue de vista previa y da una dirección `hispaprofe-git-audio-en-vercel-*.vercel.app`.

- [ ] **Step 2: Comprueba que la construcción no se pasó de tamaño**

En el registro de construcción de Vercel, busca el aviso de tamaño de función.
Expected: ninguna función pasa de 250 MB. `ffmpeg-static` son unos 78 MB, así que hay margen, pero es lo bastante justo como para mirarlo en vez de suponerlo.

- [ ] **Step 3: Comprueba que el compresor empaquetado está y se puede ejecutar**

Sube un audio pequeño (menos de 4 MB) desde la vista previa.
Expected: termina y suena. Si contesta el `CompresorAusenteError`, el binario no viajó: revisa `outputFileTracingIncludes` en `next.config.ts`. Si el error trae `EACCES`, viajó pero sin permiso de ejecución, y hay que darle `chmod` en el arranque.

- [ ] **Step 4: El caso que motivó todo esto**

Sube a Drive el MP3 real de la Tarea 1 del A2/B1 escolar (35,7 MB), compártelo con enlace, y pega la dirección en la vista previa.
Expected: tarda, termina, y lo guardado ronda los 6 MB.

- [ ] **Step 5: Oírlo, y desde un iPhone**

Abre el paso como estudiante y dale al play, en el ordenador y en un iPhone.
Expected: suena en los dos, y saltar a la mitad responde. El iPhone es el que de verdad ejercita el 206: WebKit no arranca sin rangos.

- [ ] **Step 6: La oral grabada, de punta a punta**

Graba diez minutos desde la vista previa y entrégalo.
Expected: entra —a 32 kbps son unos 2,4 MB—, el profesor la oye desde la bandeja, y otro alumno no.

- [ ] **Step 7: Anota lo que salga**

Si algo de esto falla, **no lo arregles a ciegas**: apunta el error exacto del registro de Vercel y vuelve a la tarea que lo cubre.

---

## Verificación final

Antes de fusionar a `main`:

```bash
npx tsc --noEmit
npm run lint
npx tsx scripts/verificar-flujo.ts
npx tsx scripts/verificar-enlaces.ts
npx tsx scripts/verificar-audio.ts
npx tsx scripts/verificar-expresion.ts
npx tsx scripts/verificar-oral-grabada.ts
```

Los dos últimos no cambian en este plan, pero tocan los topes que sí cambian: si alguno afirmaba algo sobre los 50 MB, tiene que salir ahora.

## Fuera de alcance

- Vercel Blob y sacar los archivos de la base de datos.
- Comprimir fuera de la petición, con un estado «procesando».
- Usar el OAuth de Google que ya hay para leer archivos privados de Drive.
- Recomprimir lo ya guardado.
- La rama `pegar-por-codigo`, que está a medias y no entra en este despliegue.
