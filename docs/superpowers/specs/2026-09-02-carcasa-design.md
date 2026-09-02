# La carcasa: una identidad, cinco puertas, y las piezas comunes

Fecha: 2026-09-02. Entrega 2 de cinco (puerta → **carcasa** → taller DELE →
biblioteca y actividades → artículos). Aprobada con el mapa del 2 sept
(artefacto «El mapa de HispaProfe»); las tres decisiones se dieron por las
recomendaciones: dos puertas (Actividades y Biblioteca), Actividades y
Artículos públicos, y este orden.

## El problema

1. **Dos sitios en uno.** La portada tiene identidad (la «ñ» azul, el rosa de
   «profe», Nunito, tarjetas redondeadas). Al entrar cambia todo: una «H»
   amarilla, botones azules planos, listas sin descanso.
2. **Cero piezas comunes.** 30 ficheros escriben su propio botón principal, 10
   su propia casilla (`const campo =`), 28 su propio título, 10 su propia
   tabla de nombres de nivel. No existe un color de error: los avisos van en
   amarillo (`bg-sol-100`, 31 ficheros).
3. **El menú describe la base de datos, no lo que hace el profesor:** Panel,
   Secuencias, Estudiantes, Clases, Recursos, Entregas, Orales, Administración.
   El estudiante ve Panel, Secuencias y Preparación.

## Qué construimos

- **Una identidad**, la de la portada, para todo el sitio.
- **Un juego de piezas** en `components/ui/`: botón (que se apaga al enviar),
  casilla, tarjeta, aviso (con color de error), etiqueta, encabezado de
  página, estado vacío.
- **Cinco puertas en el menú**, iguales para todos: Inicio, DELE, Mis clases,
  Actividades, Artículos, Biblioteca. Dentro de cada puerta, el profesor ve
  además **su banda de herramientas**.
- **Una página por puerta.** DELE y Mis clases con contenido real desde el
  primer día; Actividades, Artículos y Biblioteca con una página «En
  preparación» honesta.
- **Inicio** reorganizado: saludo y las cinco puertas como tarjetas con un dato
  vivo cada una.
- **Las pantallas de hoy pasan a las piezas**, una por una, sin cambiar lo que
  hacen ni sus direcciones.

## Qué no cambia

Las direcciones que ya existen (`/recorridos`, `/pasos/<id>`, `/profe/*`,
`/admin/*`, `/cuenta`, `/entrar`) siguen funcionando: nada se mueve de
fichero salvo Preparación (ver abajo). La portada pública, sus textos y su
pie. El audio, la corrección, los datos. Los roles y la puerta de la
Entrega 1.

---

## Dos sesiones

**Sesión A — la carcasa en sí** (este documento la cubre entera; el plan de
la sesión A construye hasta «Las puertas»): tokens, piezas, cabecera, banda,
las cinco páginas de puerta, Inicio, y `/entrar`, `/cuenta` sobre las piezas.

**Sesión B — la mudanza**: cada pantalla existente pasa a las piezas, por
zonas (estudiante, secuencias, estudiantes y grupos, clases, correcciones,
recursos, administración). Plan aparte, con el mismo diseño.

---

## La identidad

Todo sale de `app/globals.css`, que ya tiene los tokens de la portada. Se
añade lo que falta:

```css
  /* Error: lo único que la portada no necesitaba. Rojo de verdad, no coral. */
  --color-error-100: #fde8e8;
  --color-error-500: #d93a3a;
  --color-error-600: #b42b2b;
  /* Los dos colores fijos que la portada llevaba en hexadecimal. */
  --color-lila-100: #ece5ff;
  --color-lila-500: #6a5ad8;
```

Reglas de la identidad, para que cualquier pantalla nueva salga igual:

- Fondo `bg-fondo`, texto `text-tinta`, secundario `text-tinta-suave`.
- Tarjeta: `rounded-tarjeta border border-hp-100 bg-white shadow-suave`.
- Botón principal: `rounded-full bg-hp-500 text-white font-bold h-10 px-5
  hover:bg-hp-600`. Secundario: `rounded-full border-2 border-tinta text-tinta`.
  Sutil: `rounded-full border border-hp-200 text-tinta-suave hover:text-hp-500`.
  Peligro: `rounded-full bg-error-500 text-white`.
- Título de página: `text-3xl font-extrabold tracking-tight text-tinta`, con
  un párrafo `text-tinta-suave` debajo si hace falta explicar.
- Rótulo de sección: `text-xs font-bold uppercase tracking-wider text-tinta-suave`.
- Etiqueta (pill): `rounded-full px-2.5 py-0.5 text-[11px] font-bold`.
- Avisos: info `bg-hp-50 text-hp-700`, ok `bg-verde-100 text-verde-600`, aviso
  `bg-sol-100 text-tinta`, error `bg-error-100 text-error-600` con `role="alert"`.
- Los colores de los cuatro bloques (`bloque1..4`) siguen siendo de la
  preparación DELE y de nada más.

---

## Las piezas (`components/ui/`)

Cada una es un fichero, sin estado salvo donde se dice, con sus variantes como
props y las clases dentro. Nunca `className` libre desde fuera salvo para
márgenes (`className` se concatena al final, para eso).

| Pieza | Fichero | Qué es |
|---|---|---|
| `Boton` | `boton.tsx` | `variante`: `primario` (por defecto) · `secundario` · `sutil` · `peligro`; `tamano`: `normal` · `pequeno`; `href` lo convierte en `<Link>`; si no, `<button>`. |
| `BotonEnviar` | `boton-enviar.tsx` | **Cliente.** Mismo aspecto que `Boton`, pero dentro de un `<form>` usa `useFormStatus` y mientras envía se apaga y enseña una rueda con el `gerundio` («Guardando…»). Es la pieza que faltaba en todo el sitio. |
| `Campo` | `campo.tsx` | Rótulo + control + ayuda + error. `tipo`: `texto` · `correo` · `contrasena` · `numero` · `area` · `elegir` (con `opciones`). Pasa `name`, `required`, `defaultValue`, `placeholder`, `autoComplete`, `minLength`. |
| `Tarjeta` | `tarjeta.tsx` | La caja de la identidad. `titulo?` (rótulo de sección), `acento?` (borde izquierdo de un color de bloque), `href?` (toda la tarjeta enlaza). |
| `Aviso` | `aviso.tsx` | `tono`: `info` · `ok` · `aviso` · `error`. Error lleva `role="alert"`. |
| `Etiqueta` | `etiqueta.tsx` | Pill. `tono`: `neutro` · `hp` · `verde` · `sol` · `coral` · `error` · `bloque1..4`. |
| `Encabezado` | `encabezado.tsx` | `titulo`, `lede?`, `volver?` (`{ href, texto }` → «← Estudiantes»), `acciones?` (nodo a la derecha). |
| `Vacio` | `vacio.tsx` | Estado vacío: caja punteada con un texto y, opcional, un `Boton`. Sustituye a los «Todos han empezado…» sueltos. |
| `Rotulo` | `rotulo.tsx` | El rótulo de sección en mayúsculas. |

`lib/niveles.ts` reúne las diez copias de `nivelLabel`: `NIVELES` (lista con
`valor`, `nombre`) y `nombreNivel(valor)`. En la sesión A solo lo usan las
piezas nuevas; en la B se quitan las copias.

---

## La cabecera y las puertas

### `lib/carcasa/puertas.ts` (datos puros, sin React)

```ts
export type Puerta = {
  clave: "inicio" | "dele" | "clases" | "actividades" | "articulos" | "biblioteca";
  nombre: string;         // «Inicio», «DELE», «Mis clases», …
  ruta: string;           // "/dashboard", "/dele", "/clases", …
  /// Qué rutas cuentan como «estar dentro» de esta puerta, por prefijo.
  prefijos: string[];
  /// Herramientas del profesor dentro de esta puerta, en orden.
  herramientas: { nombre: string; ruta: string; pronto?: boolean }[];
};
export const PUERTAS: Puerta[];
export function puertaActiva(pathname: string): Puerta;   // por prefijo más largo; Inicio si ninguna
export function herramientasDe(puerta: Puerta, rol: string): Puerta["herramientas"]; // [] para STUDENT
```

Los prefijos que hacen que una pantalla existente «viva» en una puerta:

| Puerta | Ruta | Prefijos | Herramientas del profesor |
|---|---|---|---|
| Inicio | `/dashboard` | `/dashboard`, `/cuenta` | — |
| DELE | `/dele` | `/dele`, `/preparacion` | Exámenes → `/recorridos?servicio=PREPARACION_DELE` · Nuevo examen → `/profe/secuencias/nueva?servicio=PREPARACION_DELE` · Taller (pronto) · Recursos → `/profe/recursos` |
| Mis clases | `/clases` | `/clases`, `/profe/alumnos`, `/profe/grupos`, `/profe/clases`, `/profe/importar`, `/profe/entregas`, `/profe/orales`, `/profe/secuencias`, `/recorridos`, `/pasos` | Estudiantes → `/profe/alumnos` · Grupos → `/profe/grupos` · Diario y deberes → `/profe/clases` · Secuencias → `/recorridos?servicio=CLASES_PARTICULARES` · Nueva secuencia → `/profe/secuencias/nueva?servicio=CLASES_PARTICULARES` · Correcciones → `/profe/entregas` · Orales → `/profe/orales` · Importar → `/profe/importar` |
| Actividades | `/actividades` | `/actividades` | Publicar (pronto) |
| Artículos | `/articulos` | `/articulos` | Escribir (pronto) |
| Biblioteca | `/biblioteca` | `/biblioteca`, `/profe/recursos` | Ejercicios → `/profe/recursos` · Nuevo ejercicio → `/profe/recursos/nuevo` |

`/recorridos` y `/pasos` cuentan como Mis clases porque hoy son la forma de
ver una secuencia; una secuencia DELE abierta desde DELE marcará DELE cuando
en la sesión B la ficha del recorrido sepa su tipo (queda anotado, no se hace
en la A). Administración no es una puerta: es un enlace a la derecha, solo
para ADMIN.

### `components/carcasa/cabecera.tsx` (servidor) + `nav-puertas.tsx` (cliente)

Barra pegajosa blanca translúcida como la de la portada. Izquierda, el logo
de la portada (`ñ` en cuadrado azul + «Hispa**profe**» con «profe» en coral)
enlazando a `/dashboard`. Centro, las seis puertas; la activa en `text-hp-500`
con una línea debajo. Derecha: el nombre de pila (o el correo) **enlazando a `/cuenta`** (en
móvil, un «Mi cuenta»), la etiqueta «Profesor» si lo es, «Piezas» (el
muestrario) si es profesor o administrador, «Administración» si es ADMIN, y el
botón «Salir».

`nav-puertas.tsx` es cliente solo para `usePathname()` y marcar la activa; no
tiene estado. En pantallas estrechas las puertas pasan a una segunda fila
con desplazamiento horizontal (`overflow-x-auto`, sin menú hamburguesa).

Con `debeCambiarContrasena` la cabecera sigue reducida (solo logo de texto y
«Salir»), como dejó la Entrega 1.

### `components/carcasa/banda.tsx` (servidor)

Solo para PROFESOR/ADMIN y solo si la puerta activa tiene herramientas.
**Es un componente cliente** (como `NavPuertas`) que lee `usePathname()`: un
layout no se vuelve a ejecutar en una navegación de cliente, así que una
banda de servidor se quedaría clavada en la primera puerta cargada (lo cazó la
revisión final). Una franja bajo la cabecera, `bg-white/70` con borde inferior, «Tus herramientas»
en rótulo y los enlaces; la activa (por prefijo) en `text-hp-500`; las
`pronto` en gris con «· pronto» y sin enlace.

### `app/(app)/layout.tsx`

Sustituye el `<header>` de hoy por `<Cabecera usuario={…} />` y
`<Banda usuario={…} />`. La lógica de sesión, bloqueo y cambio forzado no
cambia.

---

## Las puertas

### Inicio · `/dashboard`

Un saludo («Hola, Gaspard») y las cinco puertas como `Tarjeta` con `href`,
en rejilla de dos columnas, cada una con su dato vivo:

| Puerta | Estudiante | Profesor |
|---|---|---|
| DELE | «N exámenes disponibles» o «Todavía sin exámenes» (de `cuantosPorBloque`) | «N exámenes publicados» |
| Mis clases | «Próxima clase: jueves 16:00» o «Sin clase programada», y « · N deberes» si hay | «N estudiantes» |
| Actividades / Artículos / Biblioteca | «Pronto» | «Pronto» |

Debajo, para el estudiante, la hucha de puntos que ya existe
(`resumenEstudiante`), solo si tiene algo. Para el profesor, nada más: la
lista de «Todavía no han empezado» vive solo en Mis clases (una vez, no dos).
Las dos bandejas de pasos (entregados, revisados) del estudiante se mudan a
Mis clases.

### DELE · `/dele` y `/dele/<bloque>`

`app/(app)/preparacion/` se **mueve** a `app/(app)/dele/` (`git mv`), y
`next.config.ts` añade redirecciones permanentes `/preparacion → /dele` y
`/preparacion/:bloque → /dele/:bloque`. Los enlaces internos se actualizan
(`grep -rn '"/preparacion'`). El contenido es el de hoy sobre las piezas: la
lista de bloques como `Tarjeta` con `acento` de su color, y el catálogo de un
bloque con sus tarjetas de examen. El profesor ve lo mismo más la banda.

### Mis clases · `/clases`

Estudiante: tres bloques en este orden: **Tu próxima clase** (la tarjeta azul
de hoy), **Deberes pendientes** (la amarilla), y **Tus secuencias** (todas
sus asignaciones vivas, con su etiqueta de servicio: una prueba DELE asignada
también sale aquí, porque es trabajo pendiente; nada se oculta) y los pasos
entregados y revisados que hoy están en el panel. Sin nada asignado, un `Vacio`: «Tu
profe todavía no te ha asignado nada».

Profesor: el resumen de hoy (los cuatro números: secuencias, estudiantes,
asignaciones vivas, progreso medio) como cuatro `Tarjeta` pequeñas, y debajo
**dos estantes**, porque el profesor tiene dos tipos de estudiante (decisión
del 2 sept): **Grupos** (secundaria: cada grupo con su nombre, cuántos
miembros y enlace a `/profe/grupos/<id>`) y **Particulares** (los estudiantes
que no pertenecen a ningún grupo, con su nivel y enlace a su ficha). Cada
estante con su `Vacio` si está vacío. Debajo, «Todavía no han empezado» como
hoy. Los botones de acción de hoy («Nueva secuencia», «Nuevo grupo», …)
desaparecen del cuerpo: están en la banda.

### Actividades, Artículos, Biblioteca · `/actividades`, `/articulos`, `/biblioteca`

Una página cada una, sobre `Encabezado` + `Vacio`, con el texto que dice qué
será y cuándo, sin fingir contenido:

- Actividades: «Aquí irán propuestas para hacer en clase o en casa, con su
  material. Todavía no hay ninguna publicada.»
- Artículos: «Aquí irán los artículos, con sus imágenes. El primero está por
  escribir.»
- Biblioteca: «Aquí irán los ejercicios que se corrigen solos y los juegos,
  por nivel. Se abre después del taller del DELE.»

El profesor ve además la banda (con lo que hay y lo que es «pronto»).

### Entrar y Mi cuenta

`/entrar`, `/cuenta` y `/cuenta/contrasena` pasan a las piezas (`Encabezado`,
`Campo`, `BotonEnviar`, `Aviso`). Son las tres pantallas que hizo la Entrega 1
y las primeras en estrenar el juego: si algo de las piezas no encaja, se ve
aquí antes que en la mudanza.

---

## La portada pública

No cambia de diseño. La cabecera pública ya enlaza a «Entrar» / «Mi panel».
Su menú deja de llevar «Actividades» (se quitó el 2 sept con las tarjetas
muertas) y **no** se añaden las puertas: son de dentro.

---

## Verificación

- `scripts/verificar-carcasa.ts` (puro, sin base): `puertaActiva` con una
  ruta de cada prefijo de la tabla y con `/`, `/loquesea` (→ Inicio);
  `herramientasDe` vacío para STUDENT y con las de la tabla para PROFESOR y
  ADMIN; `nombreNivel` para los seis niveles y para un valor desconocido.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` en verde.
- Con el servidor local y una sesión por curl: `/dashboard`, `/dele`,
  `/clases`, `/actividades`, `/articulos`, `/biblioteca` → 200 con las seis
  puertas en la cabecera; `/preparacion` → 308 a `/dele`; como estudiante, la
  banda no aparece; como profesor, aparece en DELE y Mis clases con sus
  enlaces.
- A mano en el navegador (el profesor): que la puerta activa se marque al
  navegar, que la banda cambie de puerta a puerta, y que un botón de
  formulario se apague al enviar.

## Fuera de esta entrega

La mudanza de las pantallas existentes (sesión B). El taller (Entrega 3). El
contenido de Actividades, Artículos y Biblioteca (Entregas 4 y 5). Quitar la
columna `clerkId`. Un menú hamburguesa.
