# El cloze dentro del texto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la Tarea 4 de comprensión de lectura se lea de corrido, con cada desplegable dentro del texto en el sitio de su hueco, en vez de en una lista debajo.

**Architecture:** `opcion` gana un campo `texto` opcional con marcas `{{id}}`, igual que `huecos` ya tiene. Cuando está, la cara pinta el pasaje y sustituye cada marca por el desplegable de esa pregunta; cuando no está, todo se comporta como hoy. `trozos` —la función que parte el texto por las marcas— se muda de `huecos.ts` a `tipos.ts`, que es el contrato común de los cuatro tipos.

**Tech Stack:** Next.js (ver `AGENTS.md`: **esta no es la versión de Next que conoces**, lee `node_modules/next/dist/docs/` antes de escribir código de framework), React, zod, Prisma, Tailwind.

## Global Constraints

- **Los comentarios se escriben en castellano**, como todo el código del proyecto, y explican el porqué y no el qué.
- **Nada de tests con framework**: este proyecto verifica con scripts en `scripts/verificar-*.ts` que afirman contra código real. Una afirmación nueva se escribe ahí y se ejecuta con `npx tsx`.
- **`lib/ejercicios/tipos.ts` no puede importar `node:crypto` ni `prisma`**: lo importan componentes de cliente, y cualquier cosa que arrastre se lleva medio Node al navegador. Es la razón por la que ese archivo existe.
- **`texto` es opcional y sin valor por defecto**: ningún ejercicio ya guardado puede quedarse inválido.
- Verificación de cada tarea: `npx tsc --noEmit && npm run lint`, más el script que toque.

---

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/ejercicios/tipos.ts` | **Modificar.** Recibe `trozos` y estrena `marcasCuadran`. | 1 |
| `lib/ejercicios/huecos.ts` | **Modificar.** Importa `trozos` de `tipos` y usa `marcasCuadran` en su `refine`. | 1 |
| `components/ejercicios/huecos.tsx` | **Modificar.** Una línea: de dónde importa `trozos`. | 1 |
| `lib/ejercicios/opcion.ts` | **Modificar.** El campo `texto`, su regla y su viaje a la versión pública. | 2 |
| `scripts/verificar-recursos.ts` | **Ampliar.** Las afirmaciones del texto en `opcion`. | 2 |
| `components/ejercicios/opcion.tsx` | **Modificar.** La cara del cloze dentro del texto. | 3 |
| `scripts/sembrar-dele-a2b1-lectura.ts` | **Modificar.** El pasaje de la Tarea 4 pasa del bloque al ejercicio. | 4 |
| `components/recursos/editor-opcion.tsx` | **Modificar.** El campo del pasaje y su aviso. | 5 |

---

### Task 1: `trozos` y `marcasCuadran` se mudan al contrato común

Un refactor sin cambio de comportamiento. Al terminar, `huecos` hace exactamente lo mismo que antes, pero la pieza que `opcion` necesita ya está donde puede cogerla.

**Files:**
- Modify: `lib/ejercicios/tipos.ts`
- Modify: `lib/ejercicios/huecos.ts`
- Modify: `components/ejercicios/huecos.tsx`

**Interfaces:**
- Produces, desde `@/lib/ejercicios/tipos`:
  - `function trozos(texto: string): { tipo: "texto" | "hueco"; valor: string }[]`
  - `function marcasCuadran(texto: string, ids: string[]): boolean`
- Deja de producir, desde `@/lib/ejercicios/huecos`: `trozos`.

- [ ] **Step 1: Mover `trozos` a `tipos.ts` y escribir `marcasCuadran`**

En `lib/ejercicios/tipos.ts`, al final del archivo, añade las dos funciones. `trozos` es un corta y pega literal de `lib/ejercicios/huecos.ts` — no cambies ni el comentario:

```ts
/**
 * Parte el texto en trozos alternos para poder dibujar los huecos.
 *
 * Vive aquí y no en `huecos.ts` porque la usan dos tipos: los recuadros de
 * `huecos` y los desplegables del cloze de `opcion`. No sabe nada de
 * ninguno de los dos; solo parte por `{{...}}`.
 */
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

/**
 * Si las marcas `{{...}}` del texto son exactamente los ids que se le pasan.
 *
 * Ni marcas huérfanas ni ids sin marca. Las dos listas se escriben en sitios
 * distintos del mismo objeto y nada las enlaza, así que se comprueban: con
 * una que no cuadre, la cara dibuja un control por marca y el progreso
 * cuenta sobre la otra lista, de modo que el estudiante puede rellenar todo
 * lo que ve y el contador nunca llega al total. El botón de enviar no se
 * activa nunca, y desde fuera parece que la aplicación está rota.
 */
export function marcasCuadran(texto: string, ids: string[]): boolean {
  const marcas = new Set(
    [...texto.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]),
  );
  const esperados = new Set(ids);
  return (
    marcas.size === esperados.size && [...marcas].every((m) => esperados.has(m))
  );
}
```

- [ ] **Step 2: Quitar `trozos` de `huecos.ts` y usar `marcasCuadran`**

En `lib/ejercicios/huecos.ts`, borra la función `trozos` entera con su comentario, e importa las dos nuevas. El import de arriba pasa a ser:

```ts
import {
  comoLista,
  marcasCuadran,
  normalizar,
  type Correccion,
  type ItemCorregido,
  type Respuestas,
} from "@/lib/ejercicios/tipos";
```

Y el `refine` que comprobaba las marcas a mano se queda en una llamada. Sustituye el bloque entero del primer `.refine(...)` por:

```ts
  .refine(
    (d) => marcasCuadran(d.texto, d.huecos.map((h) => h.id)),
    {
      // Nada obliga a que las marcas {{id}} del texto y los ids de `huecos`
      // coincidan: se escriben a mano en dos sitios distintos del script de
      // siembra, sin editor que los enlace. El porqué largo está en
      // `marcasCuadran`.
      message:
        "Las marcas {{...}} del texto no coinciden con los ids de `huecos`.",
    },
  );
```

- [ ] **Step 3: Arreglar el import de la cara**

En `components/ejercicios/huecos.tsx`, línea 3, `trozos` ya no está en `huecos.ts`. Separa los dos imports:

```tsx
import { type HuecosPublica } from "@/lib/ejercicios/huecos";
import { comoLista, trozos, type Respuestas } from "@/lib/ejercicios/tipos";
```

- [ ] **Step 4: Verificar que nada cambió**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-recursos.ts && npx tsx scripts/verificar-ejercicios.ts`
Expected: todo limpio y en verde. **Este es un refactor puro: si algo falla, es que se movió mal, no que haya que ajustar una afirmación.**

- [ ] **Step 5: Commit**

```bash
git add lib/ejercicios/tipos.ts lib/ejercicios/huecos.ts components/ejercicios/huecos.tsx
git commit -m "trozos y marcasCuadran, al contrato que comparten los tipos"
```

---

### Task 2: `opcion` acepta un pasaje con huecos

El esquema. Sin cara todavía: al terminar esta tarea, un `opcion` con `texto` valida y viaja al navegador, pero se sigue pintando como una lista.

**Files:**
- Modify: `lib/ejercicios/opcion.ts`
- Modify: `scripts/verificar-recursos.ts`

**Interfaces:**
- Consumes: `marcasCuadran` de `@/lib/ejercicios/tipos` (Task 1).
- Produces: `opcionSchema` con `texto?: string`; `OpcionPublica` gana `texto?: string`.

- [ ] **Step 1: Añadir las afirmaciones al script (fallan)**

En `scripts/verificar-recursos.ts`, al final de `main`, antes del cierre, añade el bloque. El script no importa hoy nada de `opcion` ni de `tipos`, así que añade las dos líneas junto al import de `relacionar` que ya hay:

```ts
import { opcionSchema, versionPublicaOpcion } from "@/lib/ejercicios/opcion";
import { trozos } from "@/lib/ejercicios/tipos";
```

```ts
  // ─── El pasaje con huecos de `opcion` ───────────────────────────────
  const CLOZE = {
    ejercicio: "opcion" as const,
    consigna: "Rellena los huecos.",
    multiple: false,
    presentacion: "desplegable" as const,
    texto: "Nunca {{19}} sabe dónde puede estar tu {{20}} libre.",
    preguntas: [
      { id: "19", enunciado: "19.", opciones: ["me", "se", "le"], correctas: [1] },
      { id: "20", enunciado: "20.", opciones: ["momento", "tiempo", "ocio"], correctas: [1] },
    ],
  };

  const cloze = opcionSchema.safeParse(CLOZE);
  afirmar(cloze.success, "un opcion con texto y marcas que cuadran es válido");

  // Una marca que no es de ninguna pregunta: la cara dibujaría un
  // desplegable que no cuenta para el progreso y el envío no se activaría.
  afirmar(
    !opcionSchema.safeParse({
      ...CLOZE,
      texto: "Nunca {{19}} sabe dónde puede estar tu {{21}} libre.",
    }).success,
    "una marca que no corresponde a ninguna pregunta se rechaza",
  );

  // Y al revés: una pregunta sin sitio en el texto no se puede contestar,
  // así que el contador tampoco llegaría nunca al total.
  afirmar(
    !opcionSchema.safeParse({
      ...CLOZE,
      texto: "Nunca {{19}} sabe dónde puede estar tu tiempo libre.",
    }).success,
    "una pregunta sin marca en el texto se rechaza",
  );

  // Lo de siempre sigue valiendo: casi ningún `opcion` lleva pasaje.
  afirmar(
    opcionSchema.safeParse({
      ejercicio: "opcion",
      consigna: "Elige.",
      multiple: false,
      preguntas: [{ id: "a", enunciado: "¿?", opciones: ["sí", "no"], correctas: [0] }],
    }).success,
    "un opcion sin texto sigue siendo válido",
  );

  // Sin el texto en la versión pública, la cara no puede pintar nada.
  const clozePublica = versionPublicaOpcion(cloze.data!);
  afirmar(clozePublica.texto === CLOZE.texto, "el pasaje viaja a la versión pública");
  afirmar(
    versionPublicaOpcion(
      opcionSchema.parse({
        ejercicio: "opcion",
        consigna: "Elige.",
        multiple: false,
        preguntas: [{ id: "a", enunciado: "¿?", opciones: ["sí", "no"], correctas: [0] }],
      }),
    ).texto === undefined,
    "sin pasaje, la versión pública no lo inventa",
  );

  // La versión pública nunca lleva las respuestas buenas, con pasaje o sin él.
  afirmar(
    !JSON.stringify(clozePublica).includes("correctas"),
    "la versión pública del cloze no lleva las correctas",
  );

  // `trozos` es la misma para los dos tipos desde la Task 1.
  const partesCloze = trozos(CLOZE.texto);
  afirmar(
    partesCloze.filter((p) => p.tipo === "hueco").map((p) => p.valor).join(",") === "19,20",
    "trozos saca los dos huecos del pasaje en orden",
  );
```

Los colores del bloque de corrección de la Task 3 —`bloque2`, `sol-400`, `sol-100`, `hp-50`— están todos definidos en `app/globals.css`. No inventes ninguno.

- [ ] **Step 2: Ejecutarlo para verlo fallar**

Run: `npx tsx scripts/verificar-recursos.ts`
Expected: falla en «un opcion con texto y marcas que cuadran es válido», porque `texto` todavía no existe en el esquema y zod lo descarta, así que `clozePublica.texto` es `undefined`. **Que falle aquí es el objetivo del paso.**

- [ ] **Step 3: Añadir el campo al esquema**

En `lib/ejercicios/opcion.ts`, dentro del `z.object` de `opcionSchema`, justo después de `presentacion`:

```ts
    /**
     * Pasaje con marcas {{id}} donde va cada hueco. Con él, el desplegable se
     * pinta dentro del texto y no en una lista debajo.
     *
     * Es lo que distingue un cloze de una batería de preguntas: en el cloze
     * la pregunta *es* el hueco, y sacarla del texto la deja sin contexto.
     *
     * Con `texto`, el control es siempre el desplegable y `presentacion` no
     * se mira: una fila de botones incrustada en mitad de un párrafo no es
     * algo que nadie vaya a querer. No se rechaza la combinación, se ignora
     * — el resultado de ignorarla es justo el que se buscaba.
     */
    texto: z.string().optional(),
```

Y añade `marcasCuadran` al import de `@/lib/ejercicios/tipos` de la cabecera.

- [ ] **Step 4: Añadir la regla**

En el mismo archivo, después de los dos `.refine(...)` que ya hay, encadena el tercero:

```ts
  .refine(
    (d) => d.texto === undefined || marcasCuadran(d.texto, d.preguntas.map((p) => p.id)),
    {
      // Solo cuando hay pasaje: sin él no hay marcas que cuadrar. El porqué
      // largo está en `marcasCuadran`.
      message:
        "Las marcas {{...}} del pasaje no coinciden con los ids de las preguntas.",
    },
  );
```

- [ ] **Step 5: Llevarlo a la versión pública**

En `lib/ejercicios/opcion.ts`, añade el campo al tipo `OpcionPublica`:

```ts
export type OpcionPublica = {
  consigna: string;
  multiple: boolean;
  presentacion: "botones" | "desplegable";
  escuchas: number;
  /** El pasaje, si lo hay. Sin él la cara no puede pintar el cloze. */
  texto?: string;
  preguntas: { id: string; enunciado: string; opciones: string[]; audio?: string }[];
};
```

Y dentro de `versionPublicaOpcion`, junto a los otros campos:

```ts
    texto: datos.texto,
```

- [ ] **Step 6: Ejecutar hasta que pase**

Run: `npx tsx scripts/verificar-recursos.ts`
Expected: todas en verde.

- [ ] **Step 7: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-ejercicios.ts && npx tsx scripts/sembrar-ejercicios-demo.ts`
Expected: sin errores. La siembra de demostración tiene que seguir funcionando: `texto` es opcional, así que los datos sembrados sin ese campo siguen validando.

```bash
git add lib/ejercicios/opcion.ts scripts/verificar-recursos.ts
git commit -m "opcion admite un pasaje con huecos, con sus marcas comprobadas"
```

---

### Task 3: La cara pinta el cloze dentro del texto

**Files:**
- Modify: `components/ejercicios/opcion.tsx`

**Interfaces:**
- Consumes: `OpcionPublica.texto` (Task 2), `trozos` de `@/lib/ejercicios/tipos` (Task 1).
- Produces: nada nuevo hacia fuera. `CaraOpcion` sigue exportándose igual y `progresoOpcion` no cambia.

- [ ] **Step 1: Extraer el desplegable a una función**

El `<select>` de hoy vive dentro del `map` de preguntas, en `components/ejercicios/opcion.tsx:62-82`. El cloze necesita el mismo control, así que se saca a una función del mismo archivo para no tener dos copias que se separen con el tiempo.

Añádela al final del archivo, después de `Veredicto`:

```tsx
/**
 * El desplegable de una pregunta. Lo usan la lista de siempre y el cloze:
 * dos copias del mismo control acabarían separándose, y la de dentro del
 * texto es la que menos se mira al cambiar algo.
 */
function Desplegable({
  pregunta,
  valor,
  alElegir,
  cerrado,
  className,
}: {
  pregunta: OpcionPublica["preguntas"][number];
  valor: string;
  alElegir: (v: string) => void;
  cerrado: boolean;
  className: string;
}) {
  return (
    <select
      value={valor}
      disabled={cerrado}
      onChange={(e) => alElegir(e.target.value)}
      // El ejercicio se responde una sola vez, así que Enter no puede
      // enviarlo: al elegir el último desplegable el botón se habilita, y un
      // Enter por reflejo quemaría el único intento.
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      aria-label={pregunta.enunciado}
      className={className}
    >
      <option value="">?</option>
      {pregunta.opciones.map((opcion, indice) => (
        <option key={indice} value={String(indice)}>
          {opcion}
        </option>
      ))}
    </select>
  );
}
```

Y en la lista de siempre, sustituye el `<select>…</select>` entero por:

```tsx
              <Desplegable
                pregunta={pregunta}
                valor={comoLista(valor[pregunta.id])[0] ?? ""}
                alElegir={(v) => alCambiar({ ...valor, [pregunta.id]: v })}
                cerrado={cerrado}
                className="mt-2 h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400 disabled:opacity-70"
              />
```

- [ ] **Step 2: Escribir la cara del cloze**

En el mismo archivo, después de `Desplegable`:

```tsx
/**
 * El pasaje con los desplegables en su hueco.
 *
 * Corregido, el desplegable se queda con lo que eligió el estudiante dentro
 * —ya se ve lo que contestó, sin repetirlo— y solo se colorea. La respuesta
 * buena aparece pegada al hueco cuando se falla: releyendo el texto se ve
 * todo, que es justo lo que una lista de veredictos al final no da.
 */
function CaraCloze({
  datos,
  valor,
  alCambiar,
  correccion,
  cerrado,
}: {
  datos: OpcionPublica;
  valor: Respuestas;
  alCambiar: (nuevo: Respuestas) => void;
  correccion: PropsCara["correccion"];
  cerrado: boolean;
}) {
  const porId = new Map(datos.preguntas.map((p) => [p.id, p]));

  return (
    <div>
      {/* Interlineado holgado: los desplegables son más altos que la línea. */}
      <p className="text-lg leading-loose text-tinta">
        {trozos(datos.texto ?? "").map((parte, i) => {
          if (parte.tipo === "texto") return <span key={i}>{parte.valor}</span>;

          const pregunta = porId.get(parte.valor);
          // El esquema ya impide que una marca no tenga pregunta, así que
          // esto solo salta con datos escritos a mano saltándose el parseo.
          if (!pregunta) return <span key={i}>{`{{${parte.valor}}}`}</span>;

          const item = correccion?.items.find((x) => x.id === pregunta.id);
          const borde = !item
            ? "border-hp-200 focus:border-hp-400"
            : item.acertado
              ? "border-bloque2 bg-bloque2/20"
              : "border-sol-400 bg-sol-100";

          return (
            <span key={i}>
              <Desplegable
                pregunta={pregunta}
                valor={comoLista(valor[pregunta.id])[0] ?? ""}
                alElegir={(v) => alCambiar({ ...valor, [pregunta.id]: v })}
                cerrado={cerrado}
                className={`mx-1 inline-block h-9 rounded-lg border-2 bg-white px-2 align-middle text-base text-tinta outline-none disabled:opacity-100 ${borde}`}
              />
              {item && !item.acertado && (
                <strong className="mx-1 font-extrabold text-tinta">{item.correcta}</strong>
              )}
            </span>
          );
        })}
      </p>

      {correccion && (
        <p className="mt-4 rounded-lg bg-hp-50 px-3 py-2 text-sm font-semibold text-tinta">
          Aciertos: {correccion.aciertos} de {correccion.total}
        </p>
      )}
    </div>
  );
}
```

**`disabled:opacity-100` y no la opacidad de siempre:** corregido, el desplegable está deshabilitado, y atenuarlo dejaría la respuesta del estudiante más pálida justo cuando es lo que hay que leer.

- [ ] **Step 3: Bifurcar `CaraOpcion`**

Al principio de `CaraOpcion`, justo después de `const datos = publica as OpcionPublica;`:

```tsx
  // Con pasaje es un cloze y se pinta dentro del texto. Sin él, la lista de
  // siempre. Las preguntas con audio nunca llevan pasaje —son tareas
  // distintas del examen—, así que el cloze no necesita reproductor.
  if (datos.texto) {
    return (
      <CaraCloze
        datos={datos}
        valor={valor}
        alCambiar={alCambiar}
        correccion={correccion}
        cerrado={cerrado}
      />
    );
  }
```

Y añade a los imports del archivo:

```tsx
import { comoLista, trozos, type Respuestas } from "@/lib/ejercicios/tipos";
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint && npx tsx scripts/verificar-recursos.ts`
Expected: limpio y en verde. `progresoOpcion` no se ha tocado: cuenta preguntas contestadas y le da igual dónde se pinten.

- [ ] **Step 5: Commit**

```bash
git add components/ejercicios/opcion.tsx
git commit -m "El cloze se pinta dentro del texto, con la corrección en el hueco"
```

---

### Task 4: La Tarea 4 del examen usa el pasaje

**Files:**
- Modify: `scripts/sembrar-dele-a2b1-lectura.ts`

**Interfaces:**
- Consumes: `opcionSchema` con `texto` (Task 2).

- [ ] **Step 1: Mover el pasaje del bloque al ejercicio**

En `scripts/sembrar-dele-a2b1-lectura.ts`, en la entrada de la Tarea 4:

1. Borra la propiedad `bloque` entera de esa tarea.
2. Dentro de `datos`, después de `presentacion: "desplegable"`, añade el pasaje con las marcas. Es el mismo texto, con `{{19}}`…`{{25}}` en lugar de `**(19)**`…`**(25)**`, y sin el título ni la línea de la fuente, que ya no son parte del texto que se lee con huecos:

```ts
      texto: `Nunca {{19}} sabe dónde puede estar el próximo Juan Antonio Bayona. O el próximo Norman Foster, o David Delfín o Banksy… Si te gusta escribir, si tu {{20}} libre lo dedicas a diseñar, a componer canciones o cualquier forma de creación artística, este puede ser tu momento. No importa de dónde eres: {{21}} interesa descubrir tu talento y compartir tus creaciones. Porque muchas veces, las formas de creatividad están escondidas y es lo que buscamos {{22}} en nuestro concurso «Se busca talento».

Queremos conocer a esos creadores, de cualquier disciplina, que tienen algo nuevo que {{23}} al mundo. Puede {{24}} un poema, una película corta, una canción, una fotografía… Cualquier muestra, de cualquier arte, será bienvenida. Buscamos creadores de literatura, cine, vídeos, música, arquitectura, pintura, moda, ilustración.

Esta es la segunda edición de un concurso que empezó {{25}} doce meses. Ahora tú también puedes ser uno de ellos. Solo tienes que enviarnos una breve biografía tuya y tu muestra de talento por correo electrónico (talentos@lavida.es). Nosotros la valoraremos y, durante el verano, escogeremos las más interesantes, que tendrán su reflejo en la edición digital de EL PAÍS. Porque, quién sabe, quizá tu talento es uno de los que estamos buscando.`,
```

3. Actualiza el comentario de encima de la Tarea 4: el párrafo que explica por qué se marcaban los huecos con `**(19)**` en vez de `__19__` ya no aplica, porque el pasaje deja de pintarse en Markdown. Sustitúyelo por:

```ts
  // Los huecos se marcan {{19}}…{{25}} y el pasaje va en el ejercicio, no en
  // un bloque: así el desplegable se pinta dentro del texto, en su sitio, y
  // el ejercicio es autónomo — se puede reutilizar en otra secuencia sin
  // arrastrar un bloque suelto que hay que acordarse de copiar.
```

- [ ] **Step 2: Dejar que una tarea no tenga bloque**

El bucle de `main` crea un bloque siempre. Ahora la Tarea 4 no tiene. Sustituye la creación del bloque por:

```ts
    // La Tarea 4 no lleva bloque: su texto vive dentro del ejercicio, con
    // los huecos marcados, porque los desplegables se pintan encima.
    if (t.bloque) {
      await prisma.bloque.create({
        data: { pasoId: paso.id, orden: 1, tipo: "TEXTO", texto: t.bloque },
      });
    }
```

Y declara `bloque` como opcional en la tarea: como la lista `TAREAS` no lleva anotación de tipo, basta con que la entrada de la Tarea 4 no tenga la propiedad para que TypeScript la infiera opcional en la unión. Si protestara, añade `bloque: undefined` a esa entrada.

- [ ] **Step 3: Sembrar y ver que la clave sigue dando 25/25**

Run: `npx tsx scripts/sembrar-dele-a2b1-lectura.ts`
Expected: las cuatro tareas, «La clave oficial puntúa 25/25» y el enlace. **Si la Tarea 4 sale con otro número, es que alguna marca no cuadra con su pregunta o que se perdió un hueco al copiar el pasaje.**

- [ ] **Step 4: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

```bash
git add scripts/sembrar-dele-a2b1-lectura.ts
git commit -m "El cloze del examen lleva su texto dentro, con los huecos marcados"
```

- [ ] **Step 5: Probarlo a mano**

Levanta `npm run dev`, abre la Tarea 4 con la cuenta del estudiante y comprueba tres cosas: que el texto se lee de corrido con los siete desplegables en su sitio; que al contestar y enviar los aciertos se colorean donde estaban; y que un fallo enseña la respuesta buena pegada al hueco.

---

### Task 5: El editor de recursos admite el pasaje

Lo que hace que la próxima tarea de este tipo no haya que sembrarla a mano.

**Files:**
- Modify: `components/recursos/editor-opcion.tsx`

**Interfaces:**
- Consumes: `marcasCuadran` de `@/lib/ejercicios/tipos` (Task 1).

- [ ] **Step 1: Añadir el campo al tipo y al valor inicial**

En `components/recursos/editor-opcion.tsx`, en el tipo de los datos (junto a `presentacion`, sobre la línea 26):

```tsx
  texto?: string;
```

El valor inicial (`OPCION_VACIO`, sobre la línea 35) **no lleva `texto`**: un `opcion` nuevo es una batería de preguntas, que es el caso de casi todos. El pasaje se añade cuando hace falta.

- [ ] **Step 2: Añadir el campo del pasaje con su aviso**

Después del bloque de «Cómo se enseña» y antes del `CampoEscuchas`:

```tsx
      {/*
        El pasaje va después de «Cómo se enseña» porque lo anula: con texto,
        el control es siempre el desplegable. No se esconde el selector para
        no hacer aparecer y desaparecer campos mientras se escribe.
      */}
      <label className="block text-sm font-semibold text-tinta">
        Pasaje con huecos (opcional)
        <textarea
          rows={6}
          value={d.texto ?? ""}
          // Vacío es no tener pasaje, no tener uno en blanco: una cadena
          // vacía pasaría el `.optional()` del esquema y la cara intentaría
          // pintar un cloze sin texto.
          onChange={(e) => cambiar({ texto: e.target.value || undefined })}
          className={area}
        />
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Escribe {"{{"}id{"}}"} donde vaya cada hueco, con el id de su pregunta. Con pasaje,
          las opciones se pintan dentro del texto y siempre en desplegable.
        </span>
      </label>

      {d.texto && !marcasCuadran(d.texto, d.preguntas.map((p) => p.id)) && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Las marcas del pasaje no coinciden con los ids de las preguntas. Así no se
          puede guardar: cada hueco necesita su pregunta y cada pregunta su hueco.
        </p>
      )}
```

Y añade el import:

```tsx
import { marcasCuadran } from "@/lib/ejercicios/tipos";
```

**Este aviso sí anticipa un rechazo**, a diferencia del de ítems, que solo compara con el examen. Por eso dice «así no se puede guardar»: el esquema lo va a rechazar de todas formas, y enterarse al escribir es mejor que al pulsar guardar.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores ni avisos.

- [ ] **Step 4: Probarlo a mano**

En `/profe/recursos/nuevo`, crea un `opcion` con dos preguntas de ids `a` y `b` y el pasaje `Uno {{a}} y otro {{b}}.`. Comprueba que no sale ningún aviso, que la previsualización de al lado enseña el texto con los dos desplegables dentro, y que al cambiar una marca a `{{c}}` aparece el aviso.

- [ ] **Step 5: Commit**

```bash
git add components/recursos/editor-opcion.tsx
git commit -m "El editor de opcion admite el pasaje con huecos"
```

---

## Autorrevisión

**Cobertura del spec**, sección a sección:

| Requisito del spec | Dónde |
|---|---|
| `texto` opcional en `opcionSchema` | Task 2, Step 3 |
| `presentacion` se ignora con `texto`, sin rechazar | Task 2, Step 3 (comentario) y Task 3, Step 2 (siempre `Desplegable`) |
| Las marcas tienen que cuadrar | Task 2, Step 4 |
| Sin `texto`, la regla no aplica | Task 2, Step 4 (`d.texto === undefined ||`) |
| `trozos` se muda a `tipos.ts` con `marcasCuadran` | Task 1 |
| `huecos` solo cambia sus imports y su `refine` | Task 1, Steps 2 y 3 |
| La cara pinta el pasaje con el desplegable en el hueco | Task 3, Step 2 |
| Corrección en el hueco, con la buena al lado | Task 3, Step 2 |
| Recuento debajo | Task 3, Step 2 |
| `progresoOpcion` no cambia | Task 3, Step 4 (se comprueba que sigue en verde) |
| El sembrador mueve el pasaje al ejercicio | Task 4 |
| El editor gana el campo y el aviso | Task 5 |
| Verificación: marca huérfana, pregunta sin marca, sin texto, versión pública, `trozos` compartida | Task 2, Step 1 |
| A mano: se lee de corrido, se colorea en su sitio | Task 4, Step 5 |

Sin huecos.

**Marcadores de posición:** ninguno. Todos los pasos llevan el código real.

**Consistencia de tipos:** `trozos` y `marcasCuadran` se declaran en Task 1 con las firmas que usan Tasks 2, 3 y 5. `OpcionPublica.texto` se declara en Task 2, Step 5 y se consume en Task 3. `Desplegable` se declara y se consume dentro de Task 3.

**Una nota sobre el orden:** Task 3 depende de Task 2 (el campo tiene que existir para poder pintarlo) y Task 4 depende de Task 3 (si no, el examen se siembra con un pasaje que nadie pinta). Task 5 solo depende de Task 1. No las reordenes.
