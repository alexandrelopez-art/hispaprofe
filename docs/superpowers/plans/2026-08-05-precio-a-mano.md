# El precio a mano — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor pueda escribir el precio de una clase concreta, y que ese precio no lo pise ni la tarifa ni una corrección de la duración.

**Architecture:** Una columna nueva, `Clase.importeAMano`, es lo único que separa «este importe lo calculó la tarifa» de «lo escribió el profesor». Sobre esa distinción, dos funciones puras en `lib/clases.ts` —una que interpreta lo tecleado y otra que decide si un importe caduca al editar— y un campo en el formulario que ya edita la clase.

**Tech Stack:** Next.js 16.2.6 (App Router, acciones de servidor), React 19, Prisma 7 sobre PostgreSQL, TypeScript, Tailwind 4, scripts de verificación con `tsx`.

## Global Constraints

- **Castellano en todo**: nombres de símbolos, comentarios, textos de pantalla y mensajes de commit. Los commits son una frase que dice qué cambia de comportamiento, sin prefijos tipo `feat:`.
- **`AGENTS.md`**: esta versión de Next tiene cambios de ruptura. Antes de escribir código de Next, leer la guía correspondiente en `node_modules/next/dist/docs/`.
- **Lo verificable vive en `lib/`**, fuera de las acciones de servidor: una acción necesita sesión y contexto de petición, así que un script no puede llamarla.
- **Cómo se verifica aquí**: el proyecto **no tiene framework de tests**. Se comprueba con scripts `scripts/verificar-*.ts` ejecutados con `npx tsx`. Las páginas se comprueban a mano.
- **Los comentarios explican el porqué**, no el qué.
- **`npx tsc --noEmit` y `npm run lint` limpios** antes de cada commit.
- **El dinero se guarda en céntimos**, siempre enteros. `Clase.importeCentimos` no cambia de tipo ni de unidad.
- **Cero no es nulo.** Un importe de cero es una clase gratis a propósito; el nulo es un olvido que hay que enseñar. Lo dice ya `importeDeClase` en `lib/clases.ts:9`.

---

### Task 1: La columna y las dos funciones puras

**Files:**
- Modify: `prisma/schema.prisma` (el modelo `Clase`)
- Create: `prisma/migrations/<marca>_importe_a_mano/migration.sql` (la genera Prisma)
- Modify: `lib/clases.ts` (dos funciones nuevas)
- Modify: `scripts/verificar-clases.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces, para las Tasks 2 y 3:
  - `type Precio = { clase: "automatico" } | { clase: "importe"; centimos: number } | { clase: "invalido"; motivo: string }`
  - `interpretarPrecio(bruto: string): Precio`
  - `type CambioDePrecio = { clase: "escribir"; centimos: number } | { clase: "borrar" } | { clase: "sin cambio" } | { clase: "invalido"; motivo: string }`
  - `cambioDePrecio(bruto: string, teniaAMano: boolean): CambioDePrecio`
  - `importeCaduca(estado: string, minutosNuevos: number, minutosViejos: number, importeAMano: boolean): boolean`
  - La columna `Clase.importeAMano: Boolean @default(false)`

`cambioDePrecio` es la que evita una regresión que no se ve a simple vista. El
campo sale **vacío** cuando el precio lo calculó la tarifa —enseñar esa cifra
haría creer que está escrita a mano—, así que si «vacío» significara siempre
«ponlo en automático», guardar la ficha de una clase ya dada le borraría su
importe calculado **cada vez**, sin que nadie tocara el precio. Vacío tiene que
significar dos cosas distintas según lo que hubiera antes: borrar, si el precio
era a mano; no tocar nada, si lo calculó la tarifa.

- [ ] **Step 1: Añade la columna al esquema**

En `prisma/schema.prisma`, en el modelo `Clase`, justo debajo de `importeCentimos` y `cobradaEl`:

```prisma
  /// Si el importe lo escribió el profesor en vez de calcularlo la tarifa.
  /// Es lo único que distingue las dos cosas, y de eso depende que corregir
  /// la duración de una clase ya dada le borre el precio o se lo respete.
  importeAMano Boolean @default(false)
```

- [ ] **Step 2: Genera la migración**

Run: `npx prisma migrate dev --name importe_a_mano`
Expected: crea `prisma/migrations/<marca>_importe_a_mano/migration.sql` con un `ALTER TABLE "Clase" ADD COLUMN "importeAMano" BOOLEAN NOT NULL DEFAULT false;` y regenera el cliente.

Comprueba que el SQL generado **solo añade**. Si trae algún `DROP`, para y dilo: significa que el esquema y la base local se habían desincronizado antes de empezar, y eso no lo arregla esta tarea.

- [ ] **Step 3: Escribe la verificación que falla**

En `scripts/verificar-clases.ts`, amplía el import de `@/lib/clases` con `importeCaduca` e `interpretarPrecio`, y añade este bloque antes del final de `main()`:

```ts
  // ─── interpretarPrecio ──────────────────────────────────────────────
  const importe = (bruto: string) => interpretarPrecio(bruto);

  const treinta = importe("30");
  afirmar(
    treinta.clase === "importe" && treinta.centimos === 3000,
    "«30» son treinta euros en céntimos",
  );

  const conComa = importe("30,50");
  afirmar(
    conComa.clase === "importe" && conComa.centimos === 3050,
    "la coma es un separador decimal, que es lo que sale del teclado español",
  );

  const conPunto = importe("30.50");
  afirmar(
    conPunto.clase === "importe" && conPunto.centimos === 3050,
    "y el punto también, que es lo que sale de copiar y pegar",
  );

  const conSimbolo = importe(" 30,50 € ");
  afirmar(
    conSimbolo.clase === "importe" && conSimbolo.centimos === 3050,
    "el símbolo y los espacios de sobra no estorban",
  );

  const cero = importe("0");
  afirmar(
    cero.clase === "importe" && cero.centimos === 0,
    "cero es un precio: una clase gratis a propósito",
  );

  afirmar(importe("").clase === "automatico", "vacío significa automático, no cero");
  afirmar(importe("   ").clase === "automatico", "y solo espacios, también");

  afirmar(importe("abc").clase === "invalido", "un texto se rechaza");
  afirmar(importe("-5").clase === "invalido", "un negativo se rechaza");
  afirmar(importe("30,555").clase === "invalido", "más de dos decimales se rechaza");

  const malo = importe("abc");
  afirmar(
    malo.clase === "invalido" && malo.motivo.length > 0,
    "y el rechazo trae un motivo que enseñarle al profesor",
  );

  // ─── cambioDePrecio ─────────────────────────────────────────────────
  // Lo que de verdad decide qué se escribe en la base, y donde está la trampa:
  // el campo sale vacío tanto cuando el profesor borra un precio suyo como
  // cuando el importe lo calculó la tarifa y no se enseña.
  const escribe = cambioDePrecio("30", false);
  afirmar(
    escribe.clase === "escribir" && escribe.centimos === 3000,
    "escribir un número es escribir un precio",
  );
  afirmar(
    cambioDePrecio("", true).clase === "borrar",
    "vaciar el campo de un precio escrito a mano lo borra: vuelve a automático",
  );
  afirmar(
    cambioDePrecio("", false).clase === "sin cambio",
    "pero el campo vacío de una clase con precio calculado NO toca nada: si no, guardar la ficha le borraría el importe cada vez",
  );
  afirmar(
    cambioDePrecio("abc", true).clase === "invalido",
    "y lo que no es un precio se rechaza, hubiera lo que hubiera antes",
  );

  // ─── importeCaduca ──────────────────────────────────────────────────
  afirmar(
    importeCaduca("DADA", 90, 60, false) === true,
    "un importe calculado caduca al cambiar los minutos de una clase dada",
  );
  afirmar(
    importeCaduca("DADA", 90, 60, true) === false,
    "pero uno escrito a mano no: no salió de los minutos",
  );
  afirmar(
    importeCaduca("DADA", 60, 60, false) === false,
    "sin cambio de minutos no caduca nada",
  );
  afirmar(
    importeCaduca("AGENDADA", 90, 60, false) === false,
    "y en una clase que todavía no se ha dado tampoco: no hay nada congelado",
  );
```

- [ ] **Step 4: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: FAIL — `interpretarPrecio` e `importeCaduca` no existen en `@/lib/clases`.

- [ ] **Step 5: Escribe las dos funciones**

En `lib/clases.ts`, junto a `importeDeClase` y `euros`:

```ts
/**
 * Lo que sale de leer el campo de precio de la ficha.
 *
 * Tres respuestas y no un `number | null`, porque el nulo tendría que
 * significar a la vez «el campo estaba vacío, ponlo en automático» y «esto no
 * es un precio», que son cosas opuestas: una guarda y la otra rechaza.
 */
export type Precio =
  | { clase: "automatico" }
  | { clase: "importe"; centimos: number }
  | { clase: "invalido"; motivo: string };

/**
 * Interpreta lo que el profesor teclea en el campo de precio.
 *
 * Admite coma y punto porque las dos llegan: la coma es lo que da el teclado
 * en español y el punto lo que sale de copiar y pegar de una hoja de cálculo.
 * Y admite el símbolo del euro y los espacios de sobra por lo mismo.
 *
 * Cero se acepta: es una clase gratis a propósito, que este proyecto ya
 * distingue del nulo —el olvido— en `importeDeClase`.
 */
export function interpretarPrecio(bruto: string): Precio {
  const limpio = bruto.replace(/[€\s]/g, "").replace(",", ".");
  if (limpio === "") return { clase: "automatico" };

  // Se comprueba con una expresión regular y no con `Number`: `Number("")` es
  // cero, `Number("30abc")` es NaN pero `parseFloat("30abc")` es 30, y ninguno
  // de los dos sabe decir que «30,555» tiene un decimal de más.
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) {
    return {
      clase: "invalido",
      motivo: "Escribe el precio en euros, con dos decimales como mucho. Por ejemplo: 30,50",
    };
  }

  // Por el texto y no multiplicando por cien: `30.10 * 100` es 3009.999… en
  // coma flotante, y `Math.round` lo taparía casi siempre, que es peor que no
  // taparlo nunca.
  const [enteros, decimales = ""] = limpio.split(".");
  return { clase: "importe", centimos: Number(enteros) * 100 + Number(decimales.padEnd(2, "0")) };
}

/**
 * Qué hay que hacer con el precio guardado, dado lo que hay en el campo y lo
 * que había antes.
 *
 * Existe por una trampa que no se ve mirando el campo: la ficha lo enseña
 * **vacío** cuando el importe lo calculó la tarifa, porque enseñar esa cifra
 * haría creer que está escrita a mano y guardar el formulario la convertiría en
 * escrita a mano sin que nadie lo pidiera. Y entonces «vacío» ya no puede
 * significar siempre «ponlo en automático»: si lo significara, guardar la ficha
 * de una clase ya dada le borraría su importe **cada vez**, sin que nadie
 * tocara el precio.
 *
 * Así que vacío significa dos cosas según lo que hubiera: borrar si el precio
 * era a mano, y no tocar nada si lo calculó la tarifa.
 */
export type CambioDePrecio =
  | { clase: "escribir"; centimos: number }
  | { clase: "borrar" }
  | { clase: "sin cambio" }
  | { clase: "invalido"; motivo: string };

export function cambioDePrecio(bruto: string, teniaAMano: boolean): CambioDePrecio {
  const precio = interpretarPrecio(bruto);
  if (precio.clase === "invalido") return { clase: "invalido", motivo: precio.motivo };
  if (precio.clase === "importe") return { clase: "escribir", centimos: precio.centimos };
  return teniaAMano ? { clase: "borrar" } : { clase: "sin cambio" };
}

/**
 * Si al editar una clase hay que tirar su importe.
 *
 * Un importe **calculado** sí: noventa minutos cobrados a precio de sesenta es
 * un número que miente, así que se borra y la ficha vuelve a pedirlo. Uno
 * **escrito a mano** no: son los euros que se cobran por esa clase, y no
 * salieron de multiplicar nada, así que corregir la duración no los cambia.
 */
export function importeCaduca(
  estado: string,
  minutosNuevos: number,
  minutosViejos: number,
  importeAMano: boolean,
): boolean {
  if (estado !== "DADA") return false;
  if (minutosNuevos === minutosViejos) return false;
  return !importeAMano;
}
```

- [ ] **Step 6: Ejecútala para verla pasar**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: PASS, con las afirmaciones nuevas y las que ya había.

- [ ] **Step 7: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/clases.ts scripts/verificar-clases.ts
git commit -m "Distinguir el precio que escribe el profesor del que calcula la tarifa"
```

---

### Task 2: Que la acción lo lea y lo respete

**Files:**
- Modify: `lib/acciones-clases.ts` (`datosDeClase` en la línea 108, `crearClase`, y `editarClase` en la línea 155)

**Interfaces:**
- Consumes: `interpretarPrecio`, `importeCaduca` y el tipo `Precio` de `@/lib/clases` (Task 1).
- Produces, para la Task 3: el formulario de la clase acepta un campo `precio` con el texto en euros. Vacío deja la clase en automático.

- [ ] **Step 1: Que `datosDeClase` lea el precio**

El precio no entra en el objeto que devuelve `datosDeClase`, porque ese objeto se escribe tal cual en la base y el precio necesita decidir **dos** columnas —`importeCentimos` e `importeAMano`— y además puede rechazar. Se lee aparte, en una función hermana, justo debajo de `datosDeClase`:

```ts
/**
 * Lo que hay que escribir en las columnas del precio, o el motivo del rechazo.
 *
 * Aparte de `datosDeClase` porque no es un campo más: decide dos columnas a la
 * vez, puede no tocar ninguna, y puede negarse. Meter eso en el objeto que se
 * escribe tal cual en la base habría obligado a que `datosDeClase` supiera de
 * rechazos.
 *
 * Devuelve un objeto vacío cuando no hay nada que cambiar, para poder
 * esparcirlo en el `data` sin condicionales por el medio.
 */
function precioDeClase(
  formData: FormData,
  teniaAMano: boolean,
): { importeCentimos?: number | null; importeAMano?: boolean; motivo?: string } {
  const cambio = cambioDePrecio(String(formData.get("precio") ?? ""), teniaAMano);
  if (cambio.clase === "invalido") return { motivo: cambio.motivo };
  if (cambio.clase === "escribir") {
    return { importeCentimos: cambio.centimos, importeAMano: true };
  }
  if (cambio.clase === "borrar") {
    // Vuelve a automático: el importe se borra para que la tarifa lo recalcule
    // al marcarla dada. Es la única forma de deshacer un precio escrito, y sin
    // ella teclear un número una vez dejaría esa clase fuera de la tarifa para
    // siempre.
    return { importeCentimos: null, importeAMano: false };
  }
  return {};
}
```

Añade a los imports de `@/lib/clases` en ese archivo: `cambioDePrecio` e `importeCaduca`.

- [ ] **Step 2: Que `editarClase` lo use**

Sustituye el cálculo de `importeCaduco` y el `update`:

```ts
  const precio = precioDeClase(formData, clase.importeAMano);
  if (precio.motivo) return;

  // El importe viejo solo caduca si el profesor no ha escrito ni borrado nada:
  // si tocó el campo, lo que él dice manda y `precio` ya trae las dos columnas.
  const noTocoElPrecio = precio.importeCentimos === undefined;
  const caduca =
    noTocoElPrecio &&
    importeCaduca(clase.estado, datos.minutos, clase.minutos, clase.importeAMano);

  await prisma.clase.update({
    where: { id: claseId },
    data: {
      ...datos,
      ...precio,
      ...(caduca ? { importeCentimos: null, importeAMano: false } : {}),
    },
  });
```

Ojo con el `motivo`: el objeto que devuelve `precioDeClase` lo lleva opcional, así que se comprueba con `precio.motivo` y no con `"motivo" in precio`.

`exigirClaseSuya` (`lib/acciones-clases.ts:37`) trae hoy `id`, `profesorId`, `minutos`, `estado`, `estudianteId`, `grupoId`, `deberes` e `importeCentimos`. **Añádele `importeAMano: true`**, que es el que falta.

- [ ] **Step 3: Que `crearClase` también lo acepte**

Una clase se puede crear ya con su precio puesto. En `crearClase`, después de `datosDeClase`:

```ts
  // `false` porque una clase que todavía no existe no tenía ningún precio a
  // mano, así que un campo vacío aquí solo puede significar «sin cambio», y el
  // objeto vacío que devuelve deja los valores por defecto de la columna.
  const precio = precioDeClase(formData, false);
  if (precio.motivo) return;
```

y en el `data` del `create`, extiende con `...precio`.

- [ ] **Step 4: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Ejecuta la verificación de clases**

Run: `npx tsx scripts/verificar-clases.ts`
Expected: «Todo bien.»

- [ ] **Step 6: Commit**

```bash
git add lib/acciones-clases.ts
git commit -m "Guardar el precio que se escribe, y no pisarlo al corregir la clase"
```

---

### Task 3: El campo en la ficha

**Files:**
- Modify: `app/(app)/profe/clases/[id]/page.tsx` (el formulario que edita la clase, alrededor de la línea 425)

**Interfaces:**
- Consumes: el campo `precio` que la acción de la Task 2 lee del formulario; `euros` de `@/lib/clases`, que la página ya usa.
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Añade el campo que falta a la consulta**

El `select` de la clase (`app/(app)/profe/clases/[id]/page.tsx:50`) ya trae `importeCentimos`. **Añádele `importeAMano: true`**, que es el que decide si el campo sale con la cifra dentro o vacío.

- [ ] **Step 2: Pinta el campo**

Junto a «Dónde», dentro del mismo formulario y con las mismas clases que los campos que ya hay:

```tsx
        <label className="block text-sm font-semibold text-tinta">
          Precio
          <input
            type="text"
            name="precio"
            inputMode="decimal"
            defaultValue={
              clase.importeAMano && clase.importeCentimos !== null
                ? (clase.importeCentimos / 100).toLocaleString("es-ES", {
                    minimumFractionDigits: 2,
                  })
                : ""
            }
            placeholder="Automático, según la tarifa"
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            Déjalo vacío para cobrar lo que diga la tarifa por hora.
          </span>
        </label>
```

El campo sale vacío cuando el importe lo calculó la tarifa, y no con esa cifra dentro: enseñarla haría creer que está escrita a mano, y guardar el formulario la convertiría en escrita a mano sin que nadie lo pidiera.

- [ ] **Step 3: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Comprueba a mano**

Run: `npm run dev`, entra en una clase desde `/profe/clases`.
Expected:
1. Escribir `30,50`, guardar, y ver el importe en la ficha y en la lista.
2. Cambiar la duración de esa clase y guardar: los 30,50 € siguen ahí.
3. Vaciar el campo y guardar: vuelve a automático, y al marcarla dada la tarifa lo recalcula.
4. Escribir `abc` y guardar: no se guarda nada.
5. **El caso de la regresión**: coge una clase ya marcada como dada cuyo importe salió de la tarifa —el campo se ve vacío—, cambia solo el sitio y guarda. El importe **tiene que seguir ahí**. Si desaparece, `cambioDePrecio` no está distinguiendo «no tocar» de «borrar».

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/profe/clases/[id]/page.tsx"
git commit -m "El campo del precio en la ficha de la clase"
```

---

## Verificación final

```bash
npx tsc --noEmit
npm run lint
npx tsx scripts/verificar-clases.ts
npx tsx scripts/verificar-personas.ts
```

`verificar-personas.ts` no cambia en este plan, pero toca las tarifas: si afirmaba algo sobre el importe de una clase, tiene que seguir saliendo.

## Fuera de alcance

- Cambiar la tarifa por hora del alumno o del grupo.
- Un precio por defecto distinto por tipo de clase.
- Tocar `cobradaEl`, las sumas de la lista o el filtro de cobradas.
- Un historial de cambios de precio.
