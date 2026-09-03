# Kit v2: las piezas cierran los huecos que la mudanza dejó al descubierto

Fecha: 2026-09-03. Entre la Entrega 2 (carcasa, sesiones A y B, en producción)
y la Entrega 3 (el taller del examen). Decisión del profesor: «vamos con Kit».

## El problema

La sesión B mudó 60 ficheros a las piezas y, al hacerlo, tuvo que inventar el
mismo apaño una y otra vez porque a las piezas les faltaba algo:

| Hueco | Apaños contados | Dónde |
|---|---|---|
| `Campo` no sabe de fechas, horas, URL ni búsqueda | 9 `<input>` nativos con la clase de `Campo` copiada | `profe/clases/page.tsx` (4), `profe/clases/[id]/page.tsx` (2), `profe/orales/[id]/sujets/page.tsx` (1), `admin/personas/page.tsx` (1), más `importar-cliente.tsx` |
| `BotonEnviar` no admite `onClick` ni un `disabled` propio | 13 `<button>` nativos montados con `clasesDeBoton(...)` | `recorridos/[id]/page.tsx` (5), `pegar-codigo.tsx` (2), `bloque-editable.tsx`, `editor.tsx` (3), `entrega.tsx`, `rubrica.tsx` |
| `opciones` de `Campo` no puede deshabilitar una | 8 placeholders «Elige…» que antes no se podían volver a elegir y ahora sí | selectores obligatorios de secuencia, ejercicio, curso, grupo, paso, nivel |
| `Campo` exige `name` aunque nada lo lea | ~20 nombres inventados (`name={etiqueta}`, `titulo-visible`…) y el editor de ejercicios manda cada campo dos veces | `components/recursos/*` |
| `Encabezado` no admite margen corto | 3 `-mt-6` a mano para pegar una fila de chips al título | `admin/layout.tsx`, `pasos/[pasoId]/page.tsx`, `recorridos/[id]/page.tsx` |
| `Tarjeta` no sabe enlazar fuera | el bloque ENLACE sigue siendo un `<a target="_blank">` con las clases copiadas | `pasos/[pasoId]/page.tsx` |
| `BotonEnviar` en un formulario GET no se apaga nunca | 2 filtros con un gerundio que nunca sale | `recorridos/page.tsx`, `profe/recursos/page.tsx` |

Y el script `verificar-piezas.ts` no ve ninguno de estos apaños: sus patrones
buscan las clases de la identidad, no `clasesDeBoton(` ni `type="date"`.

## Qué construimos

Las piezas ganan lo que faltaba, los apaños se retiran uno a uno, y el script
aprende a verlos. Nada cambia de comportamiento: mismos `name`, mismos valores
enviados, mismos textos, mismas rutas.

### Las piezas

- **`Campo`**
  - `tipo` admite además `fecha` (`date`), `fechahora` (`datetime-local`),
    `hora` (`time`), `url` (`url`) y `busqueda` (`search`).
  - `name` pasa a ser **opcional**. Los ids de ayuda y error salen de `useId()`
    (React 19 lo da también en componentes de servidor), no del `name`.
  - `opciones` admite `deshabilitada?: boolean` → `<option disabled>`.
- **`BotonEnviar`** admite `onClick?` (se ejecuta antes del envío, como en un
  `<button type="submit">` normal) y `deshabilitado?: boolean`
  (`disabled = pending || deshabilitado`).
- **`Encabezado`** admite `margen?: "normal" | "corto"` (`mb-8` / `mb-3`). Prop
  y no `className`: dos `mb-*` en la misma cadena los resuelve el orden del CSS,
  no el de la cadena (la trampa que la revisión final cazó en `Tarjeta`).
- **`Tarjeta`** admite `externo?: boolean`: con `href` y `externo`, pinta un
  `<a target="_blank" rel="noopener noreferrer">` en vez de `<Link>`.
- **`Boton`** no cambia: para un formulario GET de filtros, el botón es
  `<Boton type="submit">`, sin gerundio, porque `useFormStatus` solo sabe de
  formularios con `action`.
- El **muestrario** enseña lo nuevo: los cinco tipos de `Campo`, una opción
  deshabilitada, un `BotonEnviar deshabilitado`, un `Encabezado margen="corto"`,
  una `Tarjeta externo`.

### Los apaños, retirados

Cada fila de la tabla de arriba se convierte a su pieza. Las reglas:

- Un botón nativo que era `type="submit"` dentro de un `<form action>` pasa a
  `BotonEnviar` con el `onClick`/`deshabilitado` que tuviera; uno que era
  `type="button"` con `onClick` pasa a `Boton` (que ya lo admitía).
- Un placeholder recupera `deshabilitada: true` **solo si en `920840a` (antes
  de la mudanza) su `<option value="">` llevaba `disabled`**; los filtros
  («Todos los niveles», «Cualquier estado», «Ninguna») siguen elegibles.
- En `components/recursos/*`, ningún `Campo` lleva `name` salvo que una acción
  de `lib/acciones-recursos.ts` lo lea. Los `-visible` desaparecen; los ocultos
  que llevan el estado se quedan.
- `-mt-6` desaparece: `Encabezado margen="corto"`.
- Los dos filtros GET usan `Boton type="submit"`.

### El script aprende

Dos patrones nuevos en `verificar-piezas.ts`:

- «botón montado a mano» → `clasesDeBoton(` fuera de `components/ui/`.
- «casilla nativa» → `type="(date|datetime-local|time|url|search)"` fuera de
  `components/ui/`.

Y la lista de excepciones se reduce a lo estructural, los falsos positivos
nombrados, y los tres sitios que la sesión B declaró de «toque ligero»
(`importar-cliente.tsx`, `campos.tsx` por sus constantes `campo`/`area`,
`cronometro.tsx`). Las excepciones de `clases/*`, `sujets`, `admin/personas`,
`alumnos/[id]` y el bloque ENLACE **se borran**, porque su motivo deja de
existir. El script termina en «Todo en orden» con esa lista corta, y una
aserción nueva comprueba que no hay más de **14** excepciones: si alguien
vuelve a añadir una «por si acaso», el script lo dice.

## Verificación

`npx tsx scripts/verificar-piezas.ts` en verde con ≤ 14 excepciones;
`verificar-carcasa.ts`, `verificar-entrada.ts` en verde; `tsc`, `lint`, `build`;
curl con sesión de profesor a cada página tocada (200 y texto característico);
y una comprobación de que los formularios de fecha siguen enviando el mismo
valor: en `profe/clases/page.tsx`, el `name` y el `defaultValue` de «Desde» y
«Hasta» son los de antes (se comprueba con un `grep` del `name` en el HTML
servido).

## Fuera

Ampliar `Campo` con `optgroup` (un solo llamador). Mover los campos de lista de
los editores (`campo`/`area` de `campos.tsx`) a una pieza: es la Entrega 3 la
que rehará esos editores.
