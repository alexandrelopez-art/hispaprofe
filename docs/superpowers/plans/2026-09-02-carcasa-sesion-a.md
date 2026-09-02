# La carcasa, sesión A — plan de ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todo el sitio comparta la identidad de la portada: piezas comunes, una cabecera con las cinco puertas y la banda de herramientas del profesor, una página por puerta, e Inicio reorganizado.

**Architecture:** Los tokens viven en `app/globals.css`; las piezas en `components/ui/` (sin estado salvo `BotonEnviar`); las puertas como datos puros en `lib/carcasa/puertas.ts` que leen la cabecera (`components/carcasa/`) y las páginas. Nada existente cambia de dirección salvo `/preparacion` → `/dele` (con redirección permanente). Las pantallas viejas siguen intactas; la sesión B las muda a las piezas.

**Tech Stack:** Next.js 16.2.6 (App Router; `usePathname` de `next/navigation` en un componente cliente; `redirects()` en `next.config.ts`), React 19 (`useFormStatus` de `react-dom`), Tailwind 4 (`@theme` en CSS), Prisma 7.

**Spec:** `docs/superpowers/specs/2026-09-02-carcasa-design.md`

## Global Constraints

- Este Next.js no es el que conoces: para `redirects` leer `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`; para `usePathname`, `.../04-functions/use-pathname.md`.
- Rama `carcasa` en `/Users/FLE/Projects/hispaprofe-carcasa`. Antes de cada commit, `git branch --show-current` = `carcasa`. Nunca `git add -A`.
- Identidad (copiada de la spec, es la ley): fondo `bg-fondo`, texto `text-tinta`, secundario `text-tinta-suave`; tarjeta `rounded-tarjeta border border-hp-100 bg-white shadow-suave`; botón principal `rounded-full bg-hp-500 text-white font-bold h-10 px-5 hover:bg-hp-600`; secundario `rounded-full border-2 border-tinta text-tinta hover:bg-tinta hover:text-white`; sutil `rounded-full border border-hp-200 text-tinta-suave hover:text-hp-500 hover:border-hp-400`; peligro `rounded-full bg-error-500 text-white hover:bg-error-600`; título de página `text-3xl font-extrabold tracking-tight text-tinta`; rótulo `text-xs font-bold uppercase tracking-wider text-tinta-suave`; pill `rounded-full px-2.5 py-0.5 text-[11px] font-bold`; avisos info `bg-hp-50 text-hp-700`, ok `bg-verde-100 text-verde-600`, aviso `bg-sol-100 text-tinta`, error `bg-error-100 text-error-600` + `role="alert"`.
- Las piezas nunca aceptan `className` libre salvo para márgenes, y lo concatenan al final.
- Textos en español, sin jerga; los nombres de las puertas exactamente: «Inicio», «DELE», «Mis clases», «Actividades», «Artículos», «Biblioteca».
- Sin dependencias nuevas.
- Verificación: `npx tsx scripts/verificar-carcasa.ts` (puro), `npx tsc --noEmit`, `npm run lint`, y al final `npm run build`.

---

### Task 1: Tokens, niveles y las puertas como datos

**Files:**
- Modify: `app/globals.css` (bloque `@theme`)
- Create: `lib/niveles.ts`, `lib/carcasa/puertas.ts`, `scripts/verificar-carcasa.ts`

**Interfaces:**
- Produces: clases Tailwind `bg-error-100`, `text-error-500/600`, `bg-error-500/600`, `bg-lila-100`, `text-lila-500`; `NIVELES`, `nombreNivel(valor: string): string`; `type Puerta`, `PUERTAS`, `puertaActiva(pathname: string): Puerta`, `herramientasDe(puerta: Puerta, rol: string): Herramienta[]`, `type Herramienta = { nombre: string; ruta: string; pronto?: boolean }`, `herramientaActiva(herramientas, pathname): Herramienta | null`.

- [ ] **Step 1: Escribir el script de verificación**

`scripts/verificar-carcasa.ts`:

```ts
/**
 * Verifica las reglas puras de la carcasa: qué puerta está activa en cada
 * ruta, qué herramientas ve cada rol, y los nombres de nivel.
 * Ejecutar con:  npx tsx scripts/verificar-carcasa.ts   (no toca la base)
 */
import { PUERTAS, puertaActiva, herramientasDe, herramientaActiva } from "@/lib/carcasa/puertas";
import { NIVELES, nombreNivel } from "@/lib/niveles";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const casos: [string, string][] = [
  ["/dashboard", "inicio"], ["/cuenta", "inicio"], ["/cuenta/contrasena", "inicio"], ["/", "inicio"], ["/loquesea", "inicio"],
  ["/dele", "dele"], ["/dele/practica", "dele"], ["/preparacion", "dele"], ["/preparacion/examen-blanco", "dele"],
  ["/clases", "clases"], ["/profe/alumnos", "clases"], ["/profe/alumnos/abc", "clases"], ["/profe/grupos", "clases"],
  ["/profe/clases/x", "clases"], ["/profe/importar", "clases"], ["/profe/entregas/x", "clases"], ["/profe/orales", "clases"],
  ["/recorridos", "clases"], ["/recorridos/abc", "clases"], ["/pasos/abc", "clases"],
  ["/actividades", "actividades"], ["/articulos", "articulos"],
  ["/biblioteca", "biblioteca"], ["/profe/recursos", "biblioteca"], ["/profe/recursos/nuevo", "biblioteca"],
];
for (const [ruta, clave] of casos) {
  afirmar(puertaActiva(ruta).clave === clave, `${ruta} está en la puerta «${clave}»`);
}
afirmar(puertaActiva("/profesor").clave === "inicio", "un prefijo parcial (/profesor) no cuenta como /profe/*");

const dele = PUERTAS.find((p) => p.clave === "dele")!;
const clases = PUERTAS.find((p) => p.clave === "clases")!;
const inicio = PUERTAS.find((p) => p.clave === "inicio")!;
afirmar(herramientasDe(dele, "STUDENT").length === 0, "el estudiante no ve herramientas");
afirmar(herramientasDe(dele, "PROFESOR").length === 4, "el profesor ve cuatro herramientas en DELE");
afirmar(herramientasDe(clases, "ADMIN").length === 6, "el administrador ve seis herramientas en Mis clases");
afirmar(herramientasDe(inicio, "PROFESOR").length === 0, "Inicio no tiene banda");
afirmar(herramientasDe(dele, "PROFESOR").some((h) => h.pronto && h.nombre === "Taller"), "el taller está marcado como pronto");
afirmar(PUERTAS.map((p) => p.nombre).join("·") === "Inicio·DELE·Mis clases·Actividades·Artículos·Biblioteca", "las puertas, en su orden y con su nombre");

const hs = herramientasDe(clases, "PROFESOR");
afirmar(herramientaActiva(hs, "/profe/alumnos/abc")?.nombre === "Estudiantes", "la herramienta activa se marca por prefijo");
afirmar(herramientaActiva(hs, "/recorridos?servicio=CLASES_PARTICULARES")?.nombre === "Secuencias", "la herramienta activa ignora la query al comparar");
afirmar(herramientaActiva(hs, "/clases") === null, "en la página de la puerta ninguna herramienta está activa");

afirmar(NIVELES.length === 6, "seis niveles");
afirmar(nombreNivel("A2_B1_ESCOLAR") === "A2/B1 escolar", "el escolar tiene su nombre");
afirmar(nombreNivel("B1") === "B1", "los demás se llaman como su valor");
afirmar(nombreNivel("Z9") === "Z9", "un valor desconocido vuelve tal cual, no revienta");

console.log("\nTodo en orden.");
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `npx tsx scripts/verificar-carcasa.ts` → módulo `@/lib/carcasa/puertas` no encontrado.

- [ ] **Step 3: Los tokens**

En `app/globals.css`, dentro del bloque `@theme { … }`, después de `--color-bloque4`:

```css
  /* Error: lo único que la portada no necesitaba. Rojo de verdad, no coral. */
  --color-error-100: #fde8e8;
  --color-error-500: #d93a3a;
  --color-error-600: #b42b2b;

  /* Los dos colores que la portada llevaba fijos en hexadecimal. */
  --color-lila-100: #ece5ff;
  --color-lila-500: #6a5ad8;
```

- [ ] **Step 4: `lib/niveles.ts`**

```ts
/** Los seis niveles y cómo se escriben en pantalla. Sustituye a las copias
 *  de `nivelLabel` repartidas por las páginas (la sesión B las quita). */
export const NIVELES = [
  { valor: "A1", nombre: "A1" },
  { valor: "A2", nombre: "A2" },
  { valor: "B1", nombre: "B1" },
  { valor: "B2", nombre: "B2" },
  { valor: "C1", nombre: "C1" },
  { valor: "A2_B1_ESCOLAR", nombre: "A2/B1 escolar" },
] as const;

export function nombreNivel(valor: string | null | undefined): string {
  if (!valor) return "";
  return NIVELES.find((n) => n.valor === valor)?.nombre ?? valor;
}
```

- [ ] **Step 5: `lib/carcasa/puertas.ts`**

```ts
/**
 * Las cinco puertas del sitio (más Inicio), como datos. La cabecera, la banda
 * del profesor y las páginas de puerta leen de aquí; nadie escribe rutas de
 * puertas a mano en otro sitio.
 */
export type Herramienta = { nombre: string; ruta: string; pronto?: boolean };

export type Puerta = {
  clave: "inicio" | "dele" | "clases" | "actividades" | "articulos" | "biblioteca";
  nombre: string;
  ruta: string;
  /** Rutas que cuentan como «estar dentro» de la puerta, por prefijo de segmento. */
  prefijos: string[];
  /** Lo que ve el profesor bajo la cabecera cuando está en esta puerta. */
  herramientas: Herramienta[];
};

export const PUERTAS: Puerta[] = [
  { clave: "inicio", nombre: "Inicio", ruta: "/dashboard", prefijos: ["/dashboard", "/cuenta"], herramientas: [] },
  {
    clave: "dele", nombre: "DELE", ruta: "/dele", prefijos: ["/dele", "/preparacion"],
    herramientas: [
      { nombre: "Exámenes", ruta: "/recorridos?servicio=PREPARACION_DELE" },
      { nombre: "Nuevo examen", ruta: "/profe/secuencias/nueva?servicio=PREPARACION_DELE" },
      { nombre: "Taller", ruta: "/dele/taller", pronto: true },
      { nombre: "Recursos", ruta: "/profe/recursos" },
    ],
  },
  {
    clave: "clases", nombre: "Mis clases", ruta: "/clases",
    prefijos: ["/clases", "/profe/alumnos", "/profe/grupos", "/profe/clases", "/profe/importar", "/profe/entregas", "/profe/orales", "/recorridos", "/pasos", "/profe/secuencias"],
    herramientas: [
      { nombre: "Estudiantes", ruta: "/profe/alumnos" },
      { nombre: "Grupos", ruta: "/profe/grupos" },
      { nombre: "Diario y deberes", ruta: "/profe/clases" },
      { nombre: "Secuencias", ruta: "/recorridos?servicio=CLASES_PARTICULARES" },
      { nombre: "Correcciones", ruta: "/profe/entregas" },
      { nombre: "Orales", ruta: "/profe/orales" },
    ],
  },
  { clave: "actividades", nombre: "Actividades", ruta: "/actividades", prefijos: ["/actividades"], herramientas: [{ nombre: "Publicar", ruta: "/actividades/nueva", pronto: true }] },
  { clave: "articulos", nombre: "Artículos", ruta: "/articulos", prefijos: ["/articulos"], herramientas: [{ nombre: "Escribir", ruta: "/articulos/nuevo", pronto: true }] },
  {
    clave: "biblioteca", nombre: "Biblioteca", ruta: "/biblioteca", prefijos: ["/biblioteca", "/profe/recursos"],
    herramientas: [
      { nombre: "Ejercicios", ruta: "/profe/recursos" },
      { nombre: "Nuevo ejercicio", ruta: "/profe/recursos/nuevo" },
    ],
  },
];

/** `/profe/alumnos` cubre `/profe/alumnos` y `/profe/alumnos/…`, pero no `/profe/alumnosx`. */
function cubre(prefijo: string, ruta: string): boolean {
  return ruta === prefijo || ruta.startsWith(prefijo + "/");
}

function sinQuery(ruta: string): string {
  return ruta.split("?")[0];
}

/** La puerta cuyo prefijo más largo cubre la ruta; Inicio si ninguno. */
export function puertaActiva(pathname: string): Puerta {
  const ruta = sinQuery(pathname);
  let mejor: { puerta: Puerta; largo: number } | null = null;
  for (const puerta of PUERTAS) {
    for (const prefijo of puerta.prefijos) {
      if (cubre(prefijo, ruta) && (!mejor || prefijo.length > mejor.largo)) {
        mejor = { puerta, largo: prefijo.length };
      }
    }
  }
  return mejor?.puerta ?? PUERTAS[0];
}

/** Solo el profesor y el administrador tienen banda. */
export function herramientasDe(puerta: Puerta, rol: string): Herramienta[] {
  return rol === "PROFESOR" || rol === "ADMIN" ? puerta.herramientas : [];
}

/** La herramienta cuya ruta (sin query) cubre la actual; la más larga gana. */
export function herramientaActiva(herramientas: Herramienta[], pathname: string): Herramienta | null {
  const ruta = sinQuery(pathname);
  let mejor: Herramienta | null = null;
  for (const h of herramientas) {
    const base = sinQuery(h.ruta);
    if (!h.pronto && cubre(base, ruta) && (!mejor || base.length > sinQuery(mejor.ruta).length)) mejor = h;
  }
  return mejor;
}
```

- [ ] **Step 6: Correr el script y compilar**

Run: `npx tsx scripts/verificar-carcasa.ts` → todo `OK:`. `npx tsc --noEmit` → limpio.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css lib/niveles.ts lib/carcasa/puertas.ts scripts/verificar-carcasa.ts
git commit -m "Los tokens que faltaban, los niveles en un sitio, y las cinco puertas como datos"
```

---

### Task 2: Las piezas (`components/ui/`)

**Files:**
- Create: `components/ui/boton.tsx`, `boton-enviar.tsx`, `campo.tsx`, `tarjeta.tsx`, `aviso.tsx`, `etiqueta.tsx`, `encabezado.tsx`, `vacio.tsx`, `rotulo.tsx`
- Create: `app/(app)/muestrario/page.tsx` (una página que las enseña todas; solo para PROFESOR/ADMIN; se queda: es el catálogo vivo de la identidad)

**Interfaces (Produces):**
- `Boton({ variante?, tamano?, href?, type?, disabled?, className?, children, ...resto })`
- `BotonEnviar({ gerundio, variante?, tamano?, className?, children })` — cliente
- `Campo({ etiqueta, name, tipo?, opciones?, ayuda?, error?, ...atributos del control })`
- `Tarjeta({ titulo?, acento?, href?, className?, children })`
- `Aviso({ tono, className?, children })`
- `Etiqueta({ tono?, className?, children })`
- `Encabezado({ titulo, lede?, volver?, acciones? })`
- `Vacio({ children, accion? })`
- `Rotulo({ children, className? })`

- [ ] **Step 1: `components/ui/boton.tsx`**

```tsx
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type VarianteBoton = "primario" | "secundario" | "sutil" | "peligro";
export type TamanoBoton = "normal" | "pequeno";

export const CLASES_BOTON: Record<VarianteBoton, string> = {
  primario: "bg-hp-500 text-white hover:bg-hp-600",
  secundario: "border-2 border-tinta text-tinta hover:bg-tinta hover:text-white",
  sutil: "border border-hp-200 text-tinta-suave hover:border-hp-400 hover:text-hp-500",
  peligro: "bg-error-500 text-white hover:bg-error-600",
};

export const CLASES_TAMANO: Record<TamanoBoton, string> = {
  normal: "h-10 px-5 text-sm",
  pequeno: "h-8 px-3.5 text-xs",
};

export function clasesDeBoton(variante: VarianteBoton, tamano: TamanoBoton, extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${CLASES_BOTON[variante]} ${CLASES_TAMANO[tamano]} ${extra}`.trim();
}

type Comun = { variante?: VarianteBoton; tamano?: TamanoBoton; className?: string; children: ReactNode };
type ComoEnlace = Comun & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type ComoBoton = Comun & { href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

/** El botón de la casa. Con `href` es un enlace con aspecto de botón. */
export default function Boton(props: ComoEnlace | ComoBoton) {
  const { variante = "primario", tamano = "normal", className = "", children } = props;
  const clases = clasesDeBoton(variante, tamano, className);
  if (props.href !== undefined) {
    const { variante: _v, tamano: _t, className: _c, children: _h, ...resto } = props;
    return <Link {...resto} className={clases}>{children}</Link>;
  }
  const { variante: _v, tamano: _t, className: _c, children: _h, type = "button", ...resto } = props;
  return <button type={type} {...resto} className={clases}>{children}</button>;
}
```

- [ ] **Step 2: `components/ui/boton-enviar.tsx`**

```tsx
"use client";

import { useFormStatus } from "react-dom";
import { clasesDeBoton, type TamanoBoton, type VarianteBoton } from "./boton";

/**
 * El botón de enviar de cualquier formulario. Mientras el formulario está
 * en vuelo se apaga y dice qué está haciendo («Guardando…»), para que nadie
 * pulse dos veces ni se quede mirando un botón que parece muerto.
 */
export default function BotonEnviar({
  gerundio,
  variante = "primario",
  tamano = "normal",
  className = "",
  children,
}: {
  gerundio: string;
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={clasesDeBoton(variante, tamano, className)}>
      {pending && (
        <span aria-hidden className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {pending ? gerundio : children}
    </button>
  );
}
```

- [ ] **Step 3: `components/ui/campo.tsx`**

```tsx
import type { ComponentProps } from "react";

const CONTROL =
  "mt-1 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400 disabled:bg-fondo";

type Base = { etiqueta: string; name: string; ayuda?: string; error?: string; className?: string };
type Texto = Base & { tipo?: "texto" | "correo" | "contrasena" | "numero" } & Omit<ComponentProps<"input">, "type" | "name" | "className">;
type Area = Base & { tipo: "area" } & Omit<ComponentProps<"textarea">, "name" | "className">;
type Elegir = Base & { tipo: "elegir"; opciones: { valor: string; nombre: string }[] } & Omit<ComponentProps<"select">, "name" | "className">;

const TIPO_HTML = { texto: "text", correo: "email", contrasena: "password", numero: "number" } as const;

/** Rótulo, control y, si hacen falta, ayuda o error. Una sola forma de pedir un dato. */
export default function Campo(props: Texto | Area | Elegir) {
  const { etiqueta, name, ayuda, error, className = "" } = props;
  const idError = error ? `${name}-error` : undefined;
  let control: React.ReactNode;
  if (props.tipo === "area") {
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo: _t, ...resto } = props;
    control = <textarea name={name} aria-describedby={idError} {...resto} className={`${CONTROL} min-h-28 rounded-2xl py-2`} />;
  } else if (props.tipo === "elegir") {
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo: _t, opciones, ...resto } = props;
    control = (
      <select name={name} aria-describedby={idError} {...resto} className={`${CONTROL} h-10`}>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.nombre}</option>)}
      </select>
    );
  } else {
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo = "texto", ...resto } = props;
    control = <input type={TIPO_HTML[tipo]} name={name} aria-invalid={error ? true : undefined} aria-describedby={idError} {...resto} className={`${CONTROL} h-10`} />;
  }
  return (
    <label className={`block text-sm font-semibold text-tinta ${className}`}>
      {etiqueta}
      {control}
      {ayuda && !error && <span className="mt-1 block text-xs font-normal text-tinta-suave">{ayuda}</span>}
      {error && <span id={idError} role="alert" className="mt-1 block text-xs font-semibold text-error-600">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 4: `tarjeta.tsx`, `aviso.tsx`, `etiqueta.tsx`, `rotulo.tsx`, `vacio.tsx`, `encabezado.tsx`**

`components/ui/rotulo.tsx`:
```tsx
export default function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs font-bold uppercase tracking-wider text-tinta-suave ${className}`}>{children}</p>;
}
```

`components/ui/tarjeta.tsx`:
```tsx
import Link from "next/link";
import Rotulo from "./rotulo";

export type Acento = "bloque1" | "bloque2" | "bloque3" | "bloque4" | "hp" | "verde" | "sol" | "coral";
const BORDE: Record<Acento, string> = {
  bloque1: "border-l-4 border-l-bloque1", bloque2: "border-l-4 border-l-bloque2", bloque3: "border-l-4 border-l-bloque3", bloque4: "border-l-4 border-l-bloque4",
  hp: "border-l-4 border-l-hp-400", verde: "border-l-4 border-l-verde-500", sol: "border-l-4 border-l-sol-400", coral: "border-l-4 border-l-coral-500",
};

/** La caja de la identidad. Con `href`, toda la tarjeta es un enlace. */
export default function Tarjeta({ titulo, acento, href, className = "", children }: {
  titulo?: string; acento?: Acento; href?: string; className?: string; children: React.ReactNode;
}) {
  const clases = `block rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave ${acento ? BORDE[acento] : ""} ${href ? "transition-colors hover:border-hp-300" : ""} ${className}`;
  const cuerpo = (<>{titulo && <Rotulo className="mb-3">{titulo}</Rotulo>}{children}</>);
  return href ? <Link href={href} className={clases}>{cuerpo}</Link> : <section className={clases}>{cuerpo}</section>;
}
```

`components/ui/aviso.tsx`:
```tsx
export type TonoAviso = "info" | "ok" | "aviso" | "error";
const CLASES: Record<TonoAviso, string> = {
  info: "bg-hp-50 text-hp-700", ok: "bg-verde-100 text-verde-600", aviso: "bg-sol-100 text-tinta", error: "bg-error-100 text-error-600",
};
export default function Aviso({ tono, className = "", children }: { tono: TonoAviso; className?: string; children: React.ReactNode }) {
  return <p role={tono === "error" ? "alert" : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${CLASES[tono]} ${className}`}>{children}</p>;
}
```

`components/ui/etiqueta.tsx`:
```tsx
export type TonoEtiqueta = "neutro" | "hp" | "verde" | "sol" | "coral" | "error" | "bloque1" | "bloque2" | "bloque3" | "bloque4";
const CLASES: Record<TonoEtiqueta, string> = {
  neutro: "bg-fondo text-tinta-suave", hp: "bg-hp-100 text-hp-700", verde: "bg-verde-100 text-verde-600", sol: "bg-sol-100 text-tinta",
  coral: "bg-coral-100 text-coral-600", error: "bg-error-100 text-error-600",
  bloque1: "bg-bloque1/40 text-tinta", bloque2: "bg-bloque2/40 text-tinta", bloque3: "bg-bloque3/40 text-tinta", bloque4: "bg-bloque4/40 text-tinta",
};
export default function Etiqueta({ tono = "neutro", className = "", children }: { tono?: TonoEtiqueta; className?: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CLASES[tono]} ${className}`}>{children}</span>;
}
```

`components/ui/vacio.tsx`:
```tsx
export default function Vacio({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="rounded-tarjeta border border-dashed border-hp-200 px-6 py-8 text-center text-sm text-tinta-suave">
      <p>{children}</p>
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}
```

`components/ui/encabezado.tsx`:
```tsx
import Link from "next/link";

export default function Encabezado({ titulo, lede, volver, acciones }: {
  titulo: string; lede?: string; volver?: { href: string; texto: string }; acciones?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {volver && (
        <Link href={volver.href} className="text-sm font-semibold text-tinta-suave hover:text-hp-500">← {volver.texto}</Link>
      )}
      <div className={`flex flex-wrap items-start justify-between gap-4 ${volver ? "mt-4" : ""}`}>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-tinta">{titulo}</h1>
          {lede && <p className="mt-2 max-w-2xl text-tinta-suave">{lede}</p>}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap gap-3">{acciones}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: El muestrario**

`app/(app)/muestrario/page.tsx` — servidor; `getUsuarioActual()`; si no es PROFESOR/ADMIN → `redirect("/dashboard")`. Renderiza, dentro de `<div className="mx-auto max-w-3xl px-6 py-12">`, un `Encabezado` («Las piezas de la casa», lede «Todo lo que se ve en el sitio sale de aquí. Si algo no está, no se inventa: se añade aquí primero.»), y luego una `Tarjeta` por pieza con un ejemplo de cada variante: los cuatro `Boton` + uno `pequeno` + uno con `href="/dashboard"`; un `<form action={async () => { "use server"; await new Promise((r) => setTimeout(r, 1500)); }}>` con `BotonEnviar gerundio="Guardando…"` (para verlo apagarse); `Campo` de cada tipo (incluido `elegir` con `NIVELES` y uno con `error="Ejemplo de error"`); los cuatro `Aviso`; todas las `Etiqueta`; un `Vacio` con acción; `Tarjeta` con `acento="bloque2"` y otra con `href`.

- [ ] **Step 6: Compilar y mirar**

`npx tsc --noEmit` y `npm run lint` limpios. Con `npm run dev`, abrir `http://localhost:3000/muestrario` con una sesión de profesor (curl con cookie vale para el 200; el aspecto se mira en el navegador al final).

- [ ] **Step 7: Commit**

```bash
git add components/ui "app/(app)/muestrario"
git commit -m "Las piezas de la casa: botón que se apaga, casilla, tarjeta, aviso con error, etiqueta, encabezado, vacío; y su muestrario"
```

---

### Task 3: La cabecera, la banda y el layout

**Files:**
- Create: `components/carcasa/cabecera.tsx`, `components/carcasa/nav-puertas.tsx`, `components/carcasa/banda.tsx`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `PUERTAS`, `puertaActiva`, `herramientasDe`, `herramientaActiva` (Task 1); `salir` de `@/lib/acciones-entrada`; `esAdmin` de `@/lib/roles`.
- Produces: `<Cabecera usuario={{ firstName, email, role }} reducida? />`, `<Banda rol={…} />`.

- [ ] **Step 1: `components/carcasa/nav-puertas.tsx` (cliente)**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUERTAS, puertaActiva } from "@/lib/carcasa/puertas";

/** Cliente solo para saber en qué puerta estamos; no tiene estado propio. */
export default function NavPuertas() {
  const activa = puertaActiva(usePathname() ?? "/");
  return (
    <nav aria-label="Puertas" className="-mb-px flex gap-1 overflow-x-auto text-sm font-bold">
      {PUERTAS.map((p) => {
        const esActiva = p.clave === activa.clave;
        return (
          <Link
            key={p.clave}
            href={p.ruta}
            aria-current={esActiva ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 transition-colors ${
              esActiva ? "border-hp-500 text-hp-500" : "border-transparent text-tinta-suave hover:text-hp-500"
            }`}
          >
            {p.nombre}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: `components/carcasa/cabecera.tsx` (servidor)**

```tsx
import Link from "next/link";
import { salir } from "@/lib/acciones-entrada";
import { esAdmin } from "@/lib/roles";
import Etiqueta from "@/components/ui/etiqueta";
import NavPuertas from "./nav-puertas";

type Usuario = { firstName: string | null; email: string; role: string };

function Logo({ enlaza }: { enlaza: boolean }) {
  const cuerpo = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-hp-500 text-xl font-extrabold text-white">ñ</span>
      <span className="text-lg font-extrabold text-tinta">Hispa<span className="text-coral-500">profe</span></span>
    </>
  );
  return enlaza
    ? <Link href="/dashboard" className="flex shrink-0 items-center gap-2">{cuerpo}</Link>
    : <span className="flex shrink-0 items-center gap-2">{cuerpo}</span>;
}

/**
 * La cabecera de dentro: el mismo logo que la portada, las puertas, y a la
 * derecha quién eres. `reducida` es la de «debes cambiar la contraseña»: sin
 * puertas ni enlaces, para que no haya por dónde saltarse el cambio.
 */
export default function Cabecera({ usuario, reducida = false }: { usuario: Usuario; reducida?: boolean }) {
  const nombre = usuario.firstName ?? usuario.email;
  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";
  return (
    <header className="sticky top-0 z-10 border-b border-hp-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-6 pt-3">
        <Logo enlaza={!reducida} />
        <div className="ml-auto flex items-center gap-3 text-sm font-semibold text-tinta-suave">
          {!reducida && <span className="hidden sm:inline">{nombre}</span>}
          {!reducida && esProfe && <Etiqueta tono="sol">Profesor</Etiqueta>}
          {!reducida && esAdmin(usuario) && (
            <Link href="/admin" className="hover:text-hp-500">Administración</Link>
          )}
          <form action={salir}>
            <button type="submit" className="h-9 rounded-full border border-hp-200 px-4 transition-colors hover:border-hp-400 hover:text-hp-500">Salir</button>
          </form>
        </div>
        {!reducida && <div className="w-full sm:w-auto sm:basis-full"><NavPuertas /></div>}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `components/carcasa/banda.tsx` (servidor)**

```tsx
import Link from "next/link";
import { headers } from "next/headers";
import { herramientaActiva, herramientasDe, puertaActiva } from "@/lib/carcasa/puertas";
import Rotulo from "@/components/ui/rotulo";

/**
 * La franja de herramientas del profesor bajo la cabecera. Lee la ruta de
 * `x-ruta-actual`, que pone el proxy (la Entrega 1 la dejó para esto).
 */
export default async function Banda({ rol }: { rol: string }) {
  const ruta = (await headers()).get("x-ruta-actual") ?? "/";
  const puerta = puertaActiva(ruta);
  const herramientas = herramientasDe(puerta, rol);
  if (herramientas.length === 0) return null;
  const activa = herramientaActiva(herramientas, ruta);
  return (
    <div className="border-b border-hp-100 bg-white/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-6 py-2 text-sm font-semibold">
        <Rotulo>Tus herramientas</Rotulo>
        {herramientas.map((h) =>
          h.pronto ? (
            <span key={h.nombre} className="text-tinta-suave/60">{h.nombre} <span className="text-[11px]">· pronto</span></span>
          ) : (
            <Link key={h.nombre} href={h.ruta} className={activa?.nombre === h.nombre ? "text-hp-500" : "text-tinta-suave hover:text-hp-500"}>{h.nombre}</Link>
          ),
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `app/(app)/layout.tsx`**

Conservar intacta la parte de sesión (bloqueo, `redirect("/entrar")`, el forzado de `/cuenta/contrasena`). Sustituir TODO el JSX de cabecera (los dos `<header>`: el normal y el reducido) por:

```tsx
  return (
    <>
      <Cabecera usuario={usuario} reducida={usuario.debeCambiarContrasena} />
      {!usuario.debeCambiarContrasena && <Banda rol={usuario.role} />}
      <main className="flex-1">{children}</main>
    </>
  );
```

con `import Cabecera from "@/components/carcasa/cabecera"; import Banda from "@/components/carcasa/banda";`. Quitar los imports que queden sin uso (`Link`, `salir`, `esAdmin` si ya no se usan aquí). Comprobar que en el caso reducido no hay `<Link>` en el HTML (la Entrega 1 lo exige): el `Logo` con `enlaza={false}` y sin `NavPuertas` lo garantiza.

- [ ] **Step 5: Compilar y probar con curl**

`npx tsc --noEmit`, `npm run lint`. Con `npm run dev` y una sesión de profesor (obtener un token: `npx tsx -e` no vale por el top-level await; usar un fichero temporal `_sesion.ts` en la raíz que importe `crearSesion` de `@/lib/sesion` con `import "dotenv/config"` y lo imprima; borrarlo después):
- `GET /dashboard` con cookie → 200 y el HTML contiene `>Inicio<`, `>DELE<`, `>Mis clases<`, `>Actividades<`, `>Artículos<`, `>Biblioteca<`, y «Tus herramientas» NO (Inicio no tiene banda).
- `GET /profe/alumnos` con cookie de profesor → contiene «Tus herramientas» y `>Estudiantes<`.
- Con un token de STUDENT: `GET /profe/alumnos` redirige (como hoy) y `GET /recorridos` no contiene «Tus herramientas».
- Poner `debeCambiarContrasena=true` a un usuario local por script, `GET /cuenta/contrasena` → cero `<a href` en el HTML.

- [ ] **Step 6: Commit**

```bash
git add components/carcasa "app/(app)/layout.tsx"
git commit -m "La cabecera de la casa: el logo de la portada, las cinco puertas, y la banda de herramientas del profesor"
```

---

### Task 4: DELE — mover Preparación a su puerta, sobre las piezas

**Files:**
- Move: `app/(app)/preparacion/page.tsx` → `app/(app)/dele/page.tsx`; `app/(app)/preparacion/[bloque]/page.tsx` → `app/(app)/dele/[bloque]/page.tsx`; `app/(app)/preparacion/[bloque]/tarjeta-examen.tsx` → `app/(app)/dele/[bloque]/tarjeta-examen.tsx`
- Modify: `next.config.ts` (redirects), `lib/acciones-preparacion.ts` y cualquier fichero con `"/preparacion` (grep), `app/(app)/dashboard/panel-estudiante.tsx` (la tarjeta de la Entrega 1 apunta a `/dele`)

- [ ] **Step 1: Mover con `git mv`** las tres rutas. Luego `grep -rn '"/preparacion\|/preparacion/' app lib components` y cambiar cada enlace a `/dele`. (`lib/carcasa/puertas.ts` conserva `/preparacion` en `prefijos` a propósito, para las redirecciones.)

- [ ] **Step 2: Redirecciones** en `next.config.ts`:

```ts
  // Preparación vivió en /preparacion hasta la carcasa (sept 2026). Los
  // enlaces viejos siguen valiendo.
  async redirects() {
    return [
      { source: "/preparacion", destination: "/dele", permanent: true },
      { source: "/preparacion/:bloque", destination: "/dele/:bloque", permanent: true },
    ];
  },
```

- [ ] **Step 3: `app/(app)/dele/page.tsx` sobre las piezas**

Reescribir con `Encabezado` (título «DELE», lede «Cuatro bloques, en orden. El primero es la llave: sin saber cómo está hecho el examen, practicar sirve de poco.»), y cada bloque como `Tarjeta` con `acento` = `bloque1..4` según `bloque.orden`, conservando el círculo numerado, el título «Bloque N · …», la descripción, y el botón: `Boton tamano="pequeno" href={`/dele/${bloque.nombre}`}` («Ver los N») o `Etiqueta` («En preparación» / «Te lo abre tu profe»). La lógica (`cuantosPorBloque`, `activo`, `autoservicio`) no cambia.

- [ ] **Step 4: `app/(app)/dele/[bloque]/page.tsx` y `tarjeta-examen.tsx`**

`Encabezado` con `volver={{ href: "/dele", texto: "DELE" }}`, título «Bloque N · <titulo>», lede = descripción del bloque. Cada examen: `Tarjeta`, el estado como `Etiqueta` (tonos: sin empezar `neutro`, a medias `sol`, entregado `hp`, revisado `verde`, archivado `neutro`), el botón de empezar como `BotonEnviar gerundio="Abriendo…"` dentro del `<form action={empezarPractica}>` que ya existe, y el enlace como `Boton variante="sutil" tamano="pequeno" href`. Los textos de estado no cambian.

- [ ] **Step 5: Verificar**

`npx tsc --noEmit`, `npm run lint`. Dev server + cookie: `GET /preparacion` → 308 a `/dele`; `GET /preparacion/practica` → 308 a `/dele/practica`; `GET /dele` → 200 con «Bloque 1»; `GET /dele/practica` → 200. `grep -rn "/preparacion" app lib components` → solo `lib/carcasa/puertas.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A "app/(app)/dele" "app/(app)/preparacion" next.config.ts lib "app/(app)/dashboard/panel-estudiante.tsx"
git commit -m "Preparación se muda a su puerta, /dele, sobre las piezas; los enlaces viejos redirigen"
```
(`git add -A` SOLO con esas rutas concretas, para que registre el `git mv`.)

---

### Task 5: Las páginas de puerta: Mis clases, Actividades, Artículos, Biblioteca

**Files:**
- Create: `app/(app)/clases/page.tsx`, `app/(app)/clases/estudiante.tsx`, `app/(app)/clases/profesor.tsx`, `app/(app)/actividades/page.tsx`, `app/(app)/articulos/page.tsx`, `app/(app)/biblioteca/page.tsx`

**Interfaces:**
- Consumes: `proximaClase(usuarioId)`, `deberesPendientes(usuarioId)` (`@/lib/clases`), `resumenEstudiante`, `estadoDePasos` (`@/lib/progreso`), `contarEstudiantesElegibles`, `listarEstudiantesElegibles` (`@/lib/estudiantes`), `fechaHora`, `fechaCorta` (`@/lib/fechas`), `servicioLabel` (`@/lib/servicios`), `nombreNivel` (Task 1), las piezas (Task 2).

- [ ] **Step 1: `app/(app)/clases/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";
import ClasesEstudiante from "./estudiante";
import ClasesProfesor from "./profesor";

export const dynamic = "force-dynamic";

export default async function ClasesPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");
  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {esProfe ? <ClasesProfesor usuario={usuario} /> : <ClasesEstudiante usuario={usuario} />}
    </div>
  );
}
```

- [ ] **Step 2: `app/(app)/clases/estudiante.tsx`**

Leer `app/(app)/dashboard/panel-estudiante.tsx` entero primero: sus tres bloques (próxima clase, deberes pendientes, y las dos bandejas de pasos entregados/revisados con las asignaciones) se **trasladan** aquí tal cual en lógica, sobre las piezas:

- `Encabezado titulo="Mis clases" lede="Lo que toca, lo que hay que entregar y lo que ya has hecho."`
- «Tu próxima clase» → `Tarjeta titulo="Tu próxima clase" acento="hp"` con la fecha (`fechaHora`), el profesor, dónde, y el enlace como `Boton variante="sutil" tamano="pequeno" href` si hay enlace. Si no hay próxima: `Vacio` «Sin clase programada».
- «Deberes pendientes» → `Tarjeta titulo="Deberes pendientes" acento="sol"` con la lista; si no hay, nada (no un vacío: ya lo dice la tarjeta de arriba).
- «Tus secuencias» → las asignaciones **no archivadas** (misma consulta que el panel), cada una como `Tarjeta` con `href={`/recorridos/${recorrido.id}`}`, su `Etiqueta` de servicio (`servicioLabel`) y «N de M pasos». Y debajo, las dos bandejas de hoy (entregados / revisados) como `Tarjeta titulo="Entregado, esperando corrección"` y `Tarjeta titulo="Revisado"`, con los enlaces a `/pasos/<id>`. Sin asignaciones: `Vacio` «Tu profe todavía no te ha asignado nada.»

- [ ] **Step 3: `app/(app)/clases/profesor.tsx`**

Leer `app/(app)/dashboard/panel-profesor.tsx` entero primero. Aquí van: los cuatro números como cuatro `Tarjeta` pequeñas en rejilla (`grid gap-4 sm:grid-cols-4`), y después **dos estantes**:

```tsx
const [grupos, estudiantes] = await Promise.all([
  prisma.grupo.findMany({
    where: { profesorId: usuario.id, archivado: false },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, _count: { select: { miembros: true } } },
  }),
  listarEstudiantesElegibles({
    select: { id: true, firstName: true, lastName: true, email: true, nivel: true, membresias: { select: { grupoId: true } } },
  }),
]);
// Particular = estudiante que no está en ningún grupo. Es la definición que
// dio el profesor el 2 sept: secundaria va por grupos; los particulares, sueltos.
const particulares = estudiantes.filter((e) => e.membresias.length === 0);
```

(Comprobar la forma real de `listarEstudiantesElegibles` en `lib/estudiantes.ts` y adaptar el `select`/`include` a lo que acepte.)

- `Encabezado titulo="Mis clases" lede="Tus grupos de secundaria, tus estudiantes particulares y cómo van."`
- Rejilla de cuatro `Tarjeta` con el número grande (`text-3xl font-extrabold`) y su `Rotulo`.
- `Tarjeta titulo="Grupos"`: lista de grupos, cada uno `<Link href={`/profe/grupos/${g.id}`}>` con nombre y «N estudiantes». Vacío: `Vacio` «Todavía no hay grupos.» con `accion={<Boton tamano="pequeno" href="/profe/grupos">Crear un grupo</Boton>}`.
- `Tarjeta titulo="Particulares"`: cada uno enlaza a `/profe/alumnos/<id>`, con nombre (o correo) y `Etiqueta` con `nombreNivel(nivel)` si tiene. Vacío: `Vacio` «Ningún estudiante particular todavía.» con acción «Nuevo estudiante» → `/profe/alumnos/nuevo`.
- `Tarjeta titulo="Todavía no han empezado"`: la lista de hoy del panel; vacía → `Vacio` «Todos han empezado al menos una secuencia.»

- [ ] **Step 4: Las tres puertas en preparación**

`app/(app)/actividades/page.tsx`:
```tsx
import Encabezado from "@/components/ui/encabezado";
import Vacio from "@/components/ui/vacio";

export default function ActividadesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado titulo="Actividades" lede="Propuestas para hacer en clase o en casa, con su material." />
      <Vacio>Todavía no hay ninguna publicada. Las primeras llegarán después del taller del DELE.</Vacio>
    </div>
  );
}
```
`articulos/page.tsx`: título «Artículos», lede «Textos con imágenes: lo que el profe quiera contar, enseñar o recomendar.», vacío «El primero está por escribir.»
`biblioteca/page.tsx`: título «Biblioteca», lede «Ejercicios que se corrigen solos y juegos, por nivel, para practicar por tu cuenta.», vacío «Se abre después del taller del DELE.»

- [ ] **Step 5: Verificar**

`npx tsc --noEmit`, `npm run lint`. Dev + cookies: como estudiante `GET /clases` → 200 con «Mis clases» y sin «Tus herramientas»; como profesor `GET /clases` → 200 con «Grupos», «Particulares» y la banda con `>Estudiantes<`; `/actividades`, `/articulos`, `/biblioteca` → 200.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/clases" "app/(app)/actividades" "app/(app)/articulos" "app/(app)/biblioteca"
git commit -m "Las páginas de puerta: Mis clases con grupos y particulares, y las tres puertas en preparación"
```

---

### Task 6: Inicio

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`, `app/(app)/dashboard/panel-estudiante.tsx`, `app/(app)/dashboard/panel-profesor.tsx`

- [ ] **Step 1: Un componente común de puertas**

En `app/(app)/dashboard/puertas.tsx` (servidor):

```tsx
import Tarjeta from "@/components/ui/tarjeta";
import Rotulo from "@/components/ui/rotulo";
import { PUERTAS } from "@/lib/carcasa/puertas";

export type DatoDePuerta = { dele: string; clases: string };

/** Las cinco puertas como tarjetas, con un dato vivo en las dos que ya tienen contenido. */
export default function Puertas({ datos }: { datos: DatoDePuerta }) {
  const acento = { dele: "bloque1", clases: "bloque2", actividades: "bloque3", articulos: "bloque4", biblioteca: "hp" } as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PUERTAS.filter((p) => p.clave !== "inicio").map((p) => (
        <Tarjeta key={p.clave} href={p.ruta} acento={acento[p.clave as keyof typeof acento]}>
          <Rotulo>{p.nombre}</Rotulo>
          <p className="mt-2 text-lg font-bold text-tinta">
            {p.clave === "dele" ? datos.dele : p.clave === "clases" ? datos.clases : "Pronto"}
          </p>
        </Tarjeta>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Panel del estudiante**

`panel-estudiante.tsx` se queda con: el saludo (como `Encabezado titulo={saludo}`), `<Puertas datos={…} />`, y la hucha (`mostrarHucha`). Se quitan de aquí la próxima clase, los deberes y las bandejas (viven en Mis clases desde la Task 5) y la tarjeta «Preparación DELE» de la Entrega 1 (la sustituye la puerta). Los datos: `dele` = con `cuantosPorBloque(BLOQUES, usuario.id)` sumar los bloques → «N exámenes disponibles» (o «Todavía sin exámenes»); `clases` = `proximaClase` → «Próxima clase: <fechaHora>» o «Sin clase programada», y si `deberesPendientes` > 0, añadir « · N deberes».

- [ ] **Step 3: Panel del profesor**

`panel-profesor.tsx` se queda con: `Encabezado titulo={saludo}` y `<Puertas datos={…} />`; los cuatro números y «Todavía no han empezado» ya están en Mis clases (Task 5) y se quitan de aquí; los botones de acción también (están en la banda). Datos: `dele` = `prisma.recorrido.count({ where: { tipo: "PREPARACION_DELE", publicado: true } })` → «N exámenes publicados»; `clases` = `contarEstudiantesElegibles()` → «N estudiantes».

- [ ] **Step 4: Verificar**

`npx tsc --noEmit`, `npm run lint`. Dev + cookies: `/dashboard` como estudiante → 200 con `>DELE<` en tarjetas y «Pronto» tres veces; como profesor → «exámenes publicados». `grep -n "Preparación DELE" app/(app)/dashboard/*` → nada.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/dashboard"
git commit -m "Inicio: el saludo y las cinco puertas con su dato vivo"
```

---

### Task 7: Entrar y Mi cuenta sobre las piezas

**Files:**
- Modify: `app/(publico)/entrar/page.tsx`, `app/(publico)/entrar/formulario.tsx`, `app/(app)/cuenta/page.tsx`, `app/(app)/cuenta/contrasena/page.tsx`, `app/(app)/cuenta/contrasena/formulario.tsx`, `components/nueva-contrasena.tsx`, `app/(app)/profe/alumnos/nuevo/formulario.tsx`

- [ ] **Step 1:** En cada fichero, sustituir: el `<h1>`+`<p>` por `Encabezado`; cada `<label>…<input>` por `Campo` (tipo `correo`/`contrasena`/`texto`/`elegir` con `NIVELES` para el nivel); el `<button type="submit" disabled={enviando}>` por `BotonEnviar gerundio="Entrando…"` (o «Guardando…», «Creando…», «Generando…»); los `<p role="alert" className="… bg-coral-100 …">` por `Aviso tono="error"`; las cajas de éxito por `Aviso tono="ok"` o `Tarjeta`; los enlaces con aspecto de botón por `Boton href`. Quitar las constantes `campo` locales y el `enviando` de `useActionState` que ya no se use (el `BotonEnviar` se apaga solo; mantener `useActionState` para el estado de error).
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`. Dev: `POST /entrar` con el formulario real (mismo método que la Entrega 1: extraer los campos `$ACTION_*` del HTML y hacer el POST multipart con curl) con contraseña mala → la respuesta contiene «Correo o contraseña incorrectos.» dentro de un elemento con `role="alert"`; con la buena → 303.
- [ ] **Step 3: Commit**

```bash
git add "app/(publico)/entrar" "app/(app)/cuenta" components/nueva-contrasena.tsx "app/(app)/profe/alumnos/nuevo/formulario.tsx"
git commit -m "Entrar, Mi cuenta y el alta del estudiante estrenan las piezas"
```

---

### Task 8: El build y la comprobación final

- [ ] **Step 1:** `npm run build` en verde (con `rm -rf .next` antes si se queja de tipos viejos).
- [ ] **Step 2:** `npx tsx scripts/verificar-carcasa.ts`, `npx tsx scripts/verificar-entrada.ts` en verde.
- [ ] **Step 3:** Recorrido por curl con cookie de profesor y de estudiante por: `/dashboard`, `/dele`, `/dele/practica`, `/clases`, `/actividades`, `/articulos`, `/biblioteca`, `/recorridos`, `/profe/alumnos`, `/cuenta`, `/muestrario` (profesor 200, estudiante 307 a `/dashboard`), `/preparacion` (308). Anotar los códigos en el informe.
- [ ] **Step 4:** `git status --short` vacío; `git log --oneline main..HEAD`.
