# La carcasa, sesión B: la mudanza — plan de ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todas las pantallas que ya existían pasen a las piezas de `components/ui/` sin cambiar lo que hacen, sus textos ni sus direcciones, y que un script demuestre que no queda ningún botón, casilla, tarjeta ni título escrito a mano fuera de las piezas.

**Architecture:** Un script de verificación «por mutación» (`scripts/verificar-piezas.ts`) busca los patrones sueltos que las piezas sustituyen y falla mientras quede alguno fuera de una lista de excepciones explícita. Cada zona convierte sus ficheros y baja el contador; la última tarea lo deja en cero, hace el build y el barrido. La lógica, las consultas, las acciones y los textos no se tocan.

**Tech Stack:** Next.js 16.2.6, React 19 (`useFormStatus` vía `BotonEnviar`), Tailwind 4, las piezas de la sesión A (`components/ui/`), `lib/niveles.ts`.

**Spec:** `docs/superpowers/specs/2026-09-02-carcasa-design.md` (secciones «La identidad», «Las piezas» y «Dos sesiones»).

## Global Constraints

- Rama `carcasa-b` en `/Users/FLE/Projects/hispaprofe-carcasa-b`. Antes de cada commit, `git branch --show-current` = `carcasa-b`. Nunca `git add -A`.
- **Nada cambia de comportamiento.** Mismas consultas, mismas acciones, mismos `name` de formulario, mismos textos (letra por letra), mismas direcciones. Solo cambia el marcado. Si convertir algo exige tocar lógica, no se convierte y se anota en el informe.
- Las piezas y su contrato (de la sesión A, ver `components/ui/*.tsx` y `/muestrario`):
  - `Encabezado { titulo, lede?, volver?: {href, texto}, acciones? }` sustituye a cada `<h1 className="text-3xl font-extrabold …">` con su párrafo, su enlace «← Volver» y sus botones de arriba a la derecha.
  - `Tarjeta { titulo?, acento?, href?, className? }` sustituye a cada caja `rounded-tarjeta border border-hp-100 bg-white … shadow-suave`; su rótulo en mayúsculas pasa a `titulo`. `className` solo para márgenes/anchos (`mt-*`, `w-full`, `flex-1`).
  - `Boton { variante: primario|secundario|sutil|peligro, tamano: normal|pequeno, href? }` sustituye a cada enlace o botón con aspecto de botón. El principal de la pantalla es `primario`; los demás `sutil`; borrar/suprimir/quitar es `peligro`; «secundario» solo si ya tenía borde oscuro.
  - `BotonEnviar { gerundio }` sustituye a cada `<button type="submit">` de un `<form action=…>`. Gerundio en español que diga qué hace («Guardando…», «Asignando…», «Borrando…», «Enviando…»). Va DENTRO del `<form>`.
  - `Campo { etiqueta, name, tipo, opciones?, ayuda?, error? }` sustituye a cada `<label>` + `<input|select|textarea>` sencillo. Los controlados (`value`/`onChange`) valen igual: `Campo` reenvía las props. Los que llevan botones dentro, listas o comportamiento propio (arrastrar, grabar, subir ficheros) NO se convierten.
  - `Aviso { tono: info|ok|aviso|error }` sustituye a cada párrafo de estado. Los errores pasan de amarillo a **error** (rojo): es el cambio visual deliberado de esta sesión. Éxitos → `ok`; advertencias → `aviso`; explicaciones → `info`.
  - `Etiqueta { tono }` sustituye a cada pill. Niveles → `hp`; publicado → `verde`; borrador/pendiente → `neutro`; algo que avisa → `sol`; bloques DELE → `bloque1..4`; tipos de paso mantienen el color más cercano.
  - `Rotulo` sustituye a cada `text-xs font-bold uppercase tracking-wider`.
  - `Vacio { accion? }` sustituye a cada «no hay nada» con borde punteado o texto suelto.
  - `nombreNivel(valor)` y `NIVELES` (`lib/niveles.ts`) sustituyen a cada `nivelLabel` / `NOMBRE_NIVEL` / `nombreNivel` local.
- **Toque ligero en los editores de cliente grandes** (`editor-bloques.tsx`, `bloque-editable.tsx`, `pegar-codigo.tsx`, `selector-ejercicio.tsx`, `importar-cliente.tsx`, `components/recursos/editor*.tsx`, `components/expresion/*`, `components/orales/*`): se convierten botones, avisos, etiquetas, rótulos y campos sencillos; NO se reestructura nada ni se tocan `components/ejercicios/*` (el motor que ve el estudiante al resolver) salvo lo que la lista de excepciones del script permita.
- Después de cada zona: `npx tsc --noEmit`, `npm run lint`, `npx tsx scripts/verificar-piezas.ts` (imprime lo que queda; solo la última tarea exige cero), y un `curl` con cookie a cada página de la zona (200, y una cadena de texto característica sigue estando).
- Commits con estas dos líneas al final del cuerpo:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_011MTFjk2FcQUCsqhsbMpp6C`.

---

### Task 0: El script que mide lo que falta

**Files:**
- Create: `scripts/verificar-piezas.ts`

- [ ] **Step 1: Escribirlo**

```ts
/**
 * Verifica «por mutación» que nadie escribe a mano lo que las piezas de
 * components/ui ya dan: si un botón, una casilla, una tarjeta o un título
 * aparecen sueltos fuera de las piezas, aquí se ve. Falla si queda alguno
 * fuera de la lista de excepciones. Ejecutar con: npx tsx scripts/verificar-piezas.ts
 * Con --listar, solo imprime lo que queda, sin fallar (para ir bajando el contador).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();

/** Cada patrón dice qué pieza lo sustituye. */
const PATRONES: { nombre: string; pieza: string; regex: RegExp }[] = [
  { nombre: "título a mano", pieza: "Encabezado", regex: /text-3xl font-extrabold/ },
  { nombre: "tarjeta a mano", pieza: "Tarjeta", regex: /rounded-tarjeta border border-hp-100 bg-white/ },
  { nombre: "botón a mano", pieza: "Boton / BotonEnviar", regex: /rounded-full (bg-hp-[45]00|border(-2)? border-(hp-2|tinta))/ },
  { nombre: "casilla a mano", pieza: "Campo", regex: /const campo =|rounded-full border border-hp-200 bg-white px-4/ },
  { nombre: "nombres de nivel duplicados", pieza: "lib/niveles", regex: /nivelLabel|NOMBRE_NIVEL|const nombreNivel/ },
  { nombre: "rótulo a mano", pieza: "Rotulo", regex: /text-xs font-bold uppercase tracking-wider/ },
  { nombre: "aviso amarillo como error", pieza: "Aviso tono=\"error\"", regex: /bg-sol-100[^"]*text-(coral|tinta)[^"]*"[^>]*>\s*\{?\s*(error|estado\.error|mensaje)/ },
];

/**
 * Lo que se queda como está, con su razón. Cada entrada es un prefijo de ruta.
 * Quitar una entrada de aquí es la forma de «reclamar» ese fichero para las piezas.
 */
const EXCEPCIONES: { prefijo: string; razon: string }[] = [
  { prefijo: "components/ui/", razon: "son las piezas" },
  { prefijo: "components/carcasa/", razon: "la cabecera usa las clases de la identidad directamente" },
  { prefijo: "app/(publico)/", razon: "la portada tiene su propio diseño, aprobado" },
  { prefijo: "app/(imprimible)/", razon: "es la ficha A4 para imprimir" },
  { prefijo: "components/ejercicios/", razon: "el motor de ejercicios que resuelve el estudiante; no se toca en la sesión B" },
  { prefijo: "components/expresion/grabadora.tsx", razon: "la grabadora tiene su propia interfaz de estados" },
];

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith(".tsx")) salida.push(ruta);
  }
  return salida;
}

const soloListar = process.argv.includes("--listar");
const hallazgos: { fichero: string; patron: string; pieza: string; veces: number }[] = [];

for (const raiz of ["app", "components"]) {
  for (const ruta of ficheros(join(RAIZ, raiz))) {
    const rel = relative(RAIZ, ruta);
    if (EXCEPCIONES.some((e) => rel.startsWith(e.prefijo))) continue;
    const texto = readFileSync(ruta, "utf8");
    for (const p of PATRONES) {
      const veces = (texto.match(new RegExp(p.regex.source, "g")) ?? []).length;
      if (veces > 0) hallazgos.push({ fichero: rel, patron: p.nombre, pieza: p.pieza, veces });
    }
  }
}

if (hallazgos.length === 0) {
  console.log("OK: ninguna pieza escrita a mano fuera de las excepciones.\n\nTodo en orden.");
  process.exit(0);
}

const porFichero = new Map<string, typeof hallazgos>();
for (const h of hallazgos) porFichero.set(h.fichero, [...(porFichero.get(h.fichero) ?? []), h]);
for (const [fichero, lista] of [...porFichero.entries()].sort()) {
  console.log(fichero);
  for (const h of lista) console.log(`  ${h.veces} × ${h.patron} → ${h.pieza}`);
}
console.log(`\n${porFichero.size} ficheros, ${hallazgos.reduce((s, h) => s + h.veces, 0)} hallazgos.`);
if (!soloListar) {
  console.error("\nFALLO: quedan piezas escritas a mano fuera de las excepciones.");
  process.exit(1);
}
```

- [ ] **Step 2: Correrlo** con `--listar` y guardar la salida en el informe: es la foto de partida (deben salir unos 50 ficheros). Sin `--listar` debe fallar con salida 1.
- [ ] **Step 3: Commit** — `git add scripts/verificar-piezas.ts` — «El script que mide lo que aún se escribe a mano fuera de las piezas».

---

### Task 1: Zona 1 — Secuencias y pasos

**Files (Modify):** `app/(app)/recorridos/page.tsx`, `app/(app)/recorridos/[id]/page.tsx`, `app/(app)/recorridos/[id]/tareas-sugeridas.tsx`, `app/(app)/pasos/[pasoId]/page.tsx`, `app/(app)/pasos/[pasoId]/editor-bloques.tsx`, `app/(app)/pasos/[pasoId]/bloque-editable.tsx`, `app/(app)/pasos/[pasoId]/pegar-codigo.tsx`, `app/(app)/pasos/[pasoId]/selector-ejercicio.tsx`, `app/(app)/profe/secuencias/nueva/page.tsx`, `app/(app)/profe/secuencias/nueva/eleccion-dele.tsx`

- [ ] **Step 1:** Leer cada fichero entero antes de tocarlo. Convertir según el contrato. Particularidades:
  - `recorridos/page.tsx`: el buscador (input + dos selects + botón Buscar) pasa a `Campo` (los selects con `opciones`; el de nivel con `NIVELES` precedido de `{ valor: "", nombre: "Todos los niveles" }`) y `BotonEnviar gerundio="Buscando…"` (es un `<form>` GET; `useFormStatus` funciona igual). Las tarjetas de secuencia → `Tarjeta href`. Las pills de tipo de paso → `Etiqueta`.
  - `recorridos/[id]/page.tsx`: `Encabezado` con `volver` («Secuencias»), `acciones` = Publicar/Despublicar (`BotonEnviar` en su form) y «Borrar la secuencia» (`Boton variante="peligro" tamano="pequeno"` o el `BotonConfirmar` existente con las clases de peligro). La caja «Asignar esta secuencia» → `Tarjeta titulo="Asignar esta secuencia"`; su nota → `Campo tipo="texto"`; «Asignar a los seleccionados» → `BotonEnviar gerundio="Asignando…"`. La lista de pasos: cada paso → `Tarjeta href` con sus `Etiqueta`; los botones ↑ ↓ Borrar → `Boton variante="sutil" tamano="pequeno"` (los de form → `BotonEnviar` con gerundio «Moviendo…» / «Borrando…»). «Añadir un paso» → `Tarjeta titulo="Añadir un paso"` con `Campo`s y `BotonEnviar gerundio="Añadiendo…"`.
  - `tareas-sugeridas.tsx`: cada sugerencia → `Boton`/`BotonEnviar tamano="pequeno"` («Añadir» → gerundio «Añadiendo…»); el aviso «sin confirmar» → `Etiqueta tono="sol"`.
  - `pasos/[pasoId]/page.tsx`: `Encabezado` con `volver` (la secuencia), `Etiqueta`s de tipo/destreza; «Editar este paso» → `Tarjeta` + `Campo` + `BotonEnviar gerundio="Renombrando…"`; el bloque «Ejercicio autocorregible» → `Tarjeta titulo=…`; los avisos de estado del estudiante → `Aviso`; el pie «← Anterior / Siguiente →» se queda como enlaces de texto.
  - Editores de cliente (`editor-bloques`, `bloque-editable`, `pegar-codigo`, `selector-ejercicio`): toque ligero. `pegar-codigo.tsx` tiene el comentario «no hay ningún rojo en el sistema de color»: ahora sí, sus errores pasan a `Aviso tono="error"` y el comentario se quita. `selector-ejercicio.tsx` usa `NOMBRE_NIVEL`: → `nombreNivel`.
  - `secuencias/nueva`: `Encabezado`, `Tarjeta`, `Campo` (título, servicio, nivel, prueba, bloque, examen, descripción como `tipo="area"`), `BotonEnviar gerundio="Creando…"`; `eleccion-dele.tsx` es cliente y controlado: `Campo` reenvía `value`/`onChange`; `NOMBRE_NIVEL` local → `nombreNivel`.
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`, `npx tsx scripts/verificar-piezas.ts --listar` (la zona 1 ya no aparece salvo lo anotado). Curl con cookie de profesor: `/recorridos` (contiene «secuencias disponibles»), `/recorridos/<id de una publicada>` (contiene «Asignar esta secuencia»), `/pasos/<id>` (contiene «Editar este paso»), `/profe/secuencias/nueva` (contiene «Crear y añadir pasos» o el texto real del botón).
- [ ] **Step 3: Commit** — «Zona 1 sobre las piezas: secuencias, pasos y la nueva secuencia».

---

### Task 2: Zona 2 — Estudiantes, grupos e importar

**Files (Modify):** `app/(app)/profe/alumnos/page.tsx`, `app/(app)/profe/alumnos/[id]/page.tsx`, `app/(app)/profe/alumnos/[id]/citar-oral.tsx`, `app/(app)/profe/grupos/page.tsx`, `app/(app)/profe/grupos/[id]/page.tsx`, `app/(app)/profe/importar/page.tsx`, `app/(app)/profe/importar/importar-cliente.tsx`

- [ ] **Step 1:** Convertir según el contrato. Particularidades:
  - `alumnos/page.tsx`: `Encabezado` con `acciones` = «Nuevo estudiante» (`Boton href`); la lista → `Tarjeta href` por estudiante con `Etiqueta` de nivel (`nombreNivel`) y la de «sin contraseña» → `Etiqueta tono="sol"`.
  - `alumnos/[id]/page.tsx`: `Encabezado` (`volver` «Estudiantes», título el nombre, la `Etiqueta` de nivel a su lado dentro de `acciones` o tras el título); cada sección (Acceso, Asignar, Asignaciones, Clases, Puntos…) → `Tarjeta titulo`; formularios → `Campo` + `BotonEnviar` (gerundios: «Asignando…», «Guardando…», «Archivando…»); los avisos → `Aviso`. NO tocar `NuevaContrasena` ni `Rubrica`.
  - `citar-oral.tsx` (cliente): select → `Campo tipo="elegir"`, botón → `BotonEnviar gerundio="Citando…"`, mensajes → `Aviso`.
  - `grupos/page.tsx` y `grupos/[id]/page.tsx`: `Encabezado`, `Tarjeta`s, `Campo`s (la lista de correos es `tipo="area"`), `BotonEnviar` («Creando…», «Añadiendo…», «Sincronizando…», «Archivando…»), `Etiqueta`s, `nombreNivel`, `Vacio` para «sin miembros».
  - `importar/page.tsx` + `importar-cliente.tsx`: `Encabezado`; en el cliente, toque ligero: botones → `Boton`/`BotonEnviar`, avisos → `Aviso`, rótulos → `Rotulo`; el `<input type="file">` se queda como está.
- [ ] **Step 2:** tsc, lint, `--listar`; curl: `/profe/alumnos`, `/profe/alumnos/<id>`, `/profe/grupos`, `/profe/grupos/<id>` (si hay alguno; si no, anotar), `/profe/importar` → 200 con un texto característico cada uno.
- [ ] **Step 3: Commit** — «Zona 2 sobre las piezas: estudiantes, grupos e importar».

---

### Task 3: Zona 3 — Clases, correcciones y orales

**Files (Modify):** `app/(app)/profe/clases/page.tsx`, `app/(app)/profe/clases/[id]/page.tsx`, `app/(app)/profe/entregas/page.tsx`, `app/(app)/profe/entregas/[id]/page.tsx`, `app/(app)/profe/orales/page.tsx`, `app/(app)/profe/orales/[id]/page.tsx`, `app/(app)/profe/orales/[id]/sujets/page.tsx`, `components/expresion/entrega.tsx`, `components/expresion/rubrica.tsx`, `components/orales/panel.tsx`, `components/orales/tarjeta-criterio.tsx`, `components/orales/parrilla-sujets.tsx`, `components/orales/cronometro.tsx`, `components/orales/subir-documento.tsx`

- [ ] **Step 1:** Convertir. Particularidades:
  - `clases/page.tsx` y `clases/[id]/page.tsx` son las más densas en formularios (18 y 10 campos): `Campo` para cada uno (fecha/hora como `tipo="texto"` con el `type` real reenviado si `Campo` no lo cubre: si un campo es `datetime-local` o `date`, DEJARLO como `<input>` con las clases de `Campo` copiadas, y anotarlo; no ampliar `Campo` en esta tarea). `BotonEnviar` con gerundios («Guardando…», «Cerrando…», «Abriendo…», «Borrando…» en `peligro`). Los importes/totales en `Tarjeta`s con `Rotulo`.
  - `entregas/page.tsx`: la bandeja → `Tarjeta href` por entrega, `Etiqueta` de estado, `Vacio` si no hay. `entregas/[id]/page.tsx`: `Encabezado` con `volver`, la entrega en `Tarjeta`; la rúbrica (`rubrica.tsx`) toque ligero: sus botones → `BotonEnviar gerundio="Guardando…"`, avisos → `Aviso`; la puntuación a mano → `Campo tipo="numero"`.
  - `orales/*`: `Encabezado`s, `Tarjeta`s, `Etiqueta`s, `Vacio`s; `panel.tsx` (541 líneas, cliente) toque ligero; `cronometro.tsx` se deja salvo botones; `subir-documento.tsx` botón → `Boton`, el `<input type="file">` se queda.
  - `components/expresion/entrega.tsx` (cliente): nueve tarjetas a mano → `Tarjeta`; botones → `Boton`/`BotonEnviar`; avisos → `Aviso`. La `grabadora.tsx` NO se toca (excepción del script).
- [ ] **Step 2:** tsc, lint, `--listar`; curl: `/profe/clases`, `/profe/clases/<id>` (si hay), `/profe/entregas`, `/profe/orales` → 200 con texto característico.
- [ ] **Step 3: Commit** — «Zona 3 sobre las piezas: clases, correcciones y orales».

---

### Task 4: Zona 4 — Recursos

**Files (Modify):** `app/(app)/profe/recursos/page.tsx`, `app/(app)/profe/recursos/[id]/page.tsx`, `app/(app)/profe/recursos/nuevo/page.tsx`, `components/recursos/campos.tsx`, `components/recursos/editor.tsx`, `components/recursos/editor-opcion.tsx`, `components/recursos/editor-huecos.tsx`, `components/recursos/editor-relacionar.tsx`, `components/recursos/editor-ordenar.tsx`, `components/recursos/editor-expresion.tsx`, `components/recursos/previsualizacion.tsx`, `components/recursos/subir-audio.tsx`, `components/subir-imagen.tsx`, `components/editor-texto.tsx`

- [ ] **Step 1:** Convertir. Particularidades:
  - `recursos/page.tsx`: `Encabezado` con `acciones` = «Nuevo ejercicio» (`Boton href`); los filtros → `Campo` (`elegir` con las opciones reales de los enums; nivel con `NIVELES`); «Filtrar» → `BotonEnviar gerundio="Filtrando…"`; la lista → `Tarjeta href` por ejercicio con `Etiqueta` publicado/borrador.
  - `recursos/nuevo/page.tsx` y `[id]/page.tsx`: `Encabezado` con `volver`; `NOMBRE_NIVEL` local → `nombreNivel`.
  - `components/recursos/campos.tsx` es el «Campo» de antes de la casa: sus exportaciones (`campo`, `CampoTexto`, etc. — leerlo) se reescriben como envoltorios finos sobre `Campo`/`Rotulo`, conservando su API para no tocar a sus llamadores; si un llamador es trivial de pasar a `Campo` directo, se pasa y se retira el envoltorio cuando ya nadie lo use.
  - Editores (`editor*.tsx`, cliente, controlados): toque ligero: campos sencillos → `Campo` (reenvía `value`/`onChange`), botones «Añadir pregunta / Quitar / Guardar / Publicar» → `Boton`/`BotonEnviar` (`peligro` para quitar), avisos → `Aviso`, rótulos → `Rotulo`, tarjetas por pregunta → `Tarjeta`. Las listas arrastrables y las previsualizaciones (`previsualizacion.tsx`) se dejan salvo botones/etiquetas.
  - `subir-audio.tsx`, `subir-imagen.tsx`: botones → `Boton`, avisos → `Aviso`; el `<input type="file">` y el de URL se quedan (el de URL puede ser `Campo tipo="texto"`).
  - `editor-texto.tsx`: solo su barra de botones si son botones de aspecto de botón; la textarea se queda.
- [ ] **Step 2:** tsc, lint, `--listar`; curl: `/profe/recursos`, `/profe/recursos/nuevo`, `/profe/recursos/<id>` → 200 con texto característico. Además, con el navegador o curl, que `/profe/recursos/nuevo?tipo=opcion` siga mostrando el editor (contiene «Guardar» o el texto real).
- [ ] **Step 3: Commit** — «Zona 4 sobre las piezas: recursos y sus editores».

---

### Task 5: Zona 5 — Administración

**Files (Modify):** `app/(app)/admin/layout.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/admin/personas/page.tsx`, `app/(app)/admin/secuencias/page.tsx`

- [ ] **Step 1:** `Encabezado`s (el layout de admin tiene su propio subtítulo/nav: convertir su título y sus enlaces de pestaña a `Boton variante="sutil" tamano="pequeno"` o dejarlos como enlaces de texto con la clase activa), `Tarjeta`s, el buscador de personas → `Campo` + `BotonEnviar gerundio="Buscando…"`, las filas de persona con sus botones (bloquear/desbloquear/suprimir/hacer profesor/quitar) → `BotonEnviar tamano="pequeno"` con `variante="peligro"` para suprimir y bloquear, gerundios («Bloqueando…», «Desbloqueando…», «Suprimiendo…», «Cambiando…»); `Etiqueta` para el rol (`ADMIN` → `bloque3`, `PROFESOR` → `hp`, `STUDENT` → `neutro`); los avisos → `Aviso`. NO tocar `NuevaContrasena`.
- [ ] **Step 2:** tsc, lint, `--listar`; curl con cookie de ADMIN: `/admin`, `/admin/personas`, `/admin/secuencias` → 200.
- [ ] **Step 3: Commit** — «Zona 5 sobre las piezas: administración».

---

### Task 6: El barrido final, el script en cero y el build

**Files:**
- Create: `components/ui/logo.tsx`; Modify: `components/carcasa/cabecera.tsx`, `app/(publico)/layout.tsx`, `app/(publico)/page.tsx` (solo el logo del pie)
- Modify: `lib/preparacion.ts` (quitar `acento` y `borde` si nadie los usa: `grep -rn "\.acento\b\|\.borde\b" app lib components scripts`), `lib/sesion.ts` (`usuarioPorToken`: `include: { usuario: true }` → `select` explícito de las columnas que la aplicación usa, sin `contrasenaHash`; comprobar que `dejarEntrar` y `getUsuarioActual` siguen compilando — si algún llamador necesita el hash, dejar `include` y anotar), `lib/orales/reglas-servidor.ts:20` y `lib/orales/horario.ts:6` (comentarios «sesión de Clerk» → «sesión»), `lib/acciones*.ts` (donde haya `revalidatePath("/dashboard")` por datos que ahora viven en `/clases`, añadir `revalidatePath("/clases")`).
- Modify: `scripts/verificar-piezas.ts` si un fichero legítimo necesita entrar en `EXCEPCIONES` (con razón escrita) — solo los que la Global Constraint «toque ligero» permite dejar.

- [ ] **Step 1: El logo en una pieza.** `components/ui/logo.tsx` con `Logo({ enlaza = true, href = "/" , tamano = "normal" })` que pinta la `ñ` en cuadrado azul y «Hispa**profe**»; la cabecera (`enlaza` según reducida, `href="/dashboard"`), el layout público (`href="/"`) y el pie de la portada lo usan. Sin cambiar el aspecto.
- [ ] **Step 2: Los restos** listados arriba, uno por uno, con `grep` antes y después.
- [ ] **Step 3: El script en cero.** `npx tsx scripts/verificar-piezas.ts` (sin `--listar`) debe terminar en «Todo en orden». Si quedan hallazgos, o se convierten o entran en `EXCEPCIONES` con razón; ninguna razón puede ser «no dio tiempo».
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint`, `rm -rf .next && npm run build` (con `DATABASE_URL` exportada si el script de build la necesita), `npx tsx scripts/verificar-carcasa.ts`, `npx tsx scripts/verificar-entrada.ts`, `npx tsx scripts/verificar-personas.ts`.
- [ ] **Step 5: Barrido por curl** con cookie de profesor y de estudiante por TODAS las páginas de `app/(app)` (`find app/\(app\) -name page.tsx`), sustituyendo `[id]` por ids reales de la base local; anotar código y una cadena característica de cada una; ninguna puede dar 500.
- [ ] **Step 6: Commit** — «El barrido: el logo en una pieza, los restos de Clerk, y el script en cero».
