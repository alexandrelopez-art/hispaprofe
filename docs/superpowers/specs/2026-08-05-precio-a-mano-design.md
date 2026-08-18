# El precio de una clase, escrito a mano

Fecha: 2026-08-05

## El problema

El precio de una clase solo puede salir de la tarifa. Cada alumno y cada grupo
tienen la suya por hora (`User.tarifaCentimos`, `Grupo.tarifaCentimos`), y al
marcar una clase como dada, `congelarImporte` (`lib/clases.ts:97`) multiplica
esa tarifa por los minutos y **congela** el resultado en
`Clase.importeCentimos`. Congelarlo es acertado: subir la tarifa mañana no debe
reescribir lo que se cobró ayer.

Lo que no hay es forma de decir «esta clase la cobro a otro precio». Una clase
suelta, una recuperación a mitad de precio, un alumno al que todavía no se le
ha puesto tarifa: todos esos casos acaban con la clase marcada como dada y el
importe en nulo, que la lista ya pinta en rojo — pero sin ninguna manera de
arreglarlo desde la ficha.

## Qué construimos

Un campo de precio en la ficha de la clase. Vacío significa automático, que es
lo de hoy; con un número dentro significa **este precio y no otro**.

---

## La columna nueva

`Clase.importeAMano`, booleano, `false` por defecto, con su migración.

Es lo único que la base no sabe hoy: si el número que hay en `importeCentimos`
lo calculó la tarifa o lo escribió el profesor. Sin esa distinción no se puede
decidir a quién hay que respetar cuando las dos cosas se contradicen, y esa
contradicción llega enseguida — el apartado siguiente es justo eso.

`importeCentimos` no cambia: sigue guardando céntimos, y `euros()` sigue
pintándolos.

---

## Las tres reglas que cambian

### Al marcar la clase como dada

`congelarImporte` ya se salta cualquier importe que encuentre puesto
(`if (clase.importeCentimos !== null) return clase.importeCentimos;`), así que
un precio escrito a mano antes de marcarla sobrevive sin tocar nada. Se queda
como está.

### Al editar la clase

Aquí sí cambia, y es el motivo de la columna. Hoy:

```ts
const importeCaduco = clase.estado === "DADA" && datos.minutos !== clase.minutos;
```

El razonamiento de esa línea es correcto **para un importe calculado**: 90
minutos cobrados a precio de 60 es un número que miente, así que se borra y la
ficha vuelve a pedirlo. Pero un precio escrito a mano no se derivó de los
minutos: son los treinta euros que se cobran por esa clase, y corregir su
duración no los cambia. Pasa a ser:

```ts
const importeCaduco =
  clase.estado === "DADA" && datos.minutos !== clase.minutos && !clase.importeAMano;
```

### Al vaciar el campo

Devuelve la clase a automático: `importeAMano` a falso e `importeCentimos` a
nulo, para que la tarifa vuelva a calcularlo la próxima vez que se marque como
dada. Es la única forma de deshacer un precio escrito, y tiene que existir: sin
ella, teclear un número una vez dejaría esa clase fuera de la tarifa para
siempre.

---

## Lo que se teclea

Un campo de texto en euros, junto a la duración y el sitio, en el formulario
que ya edita la clase. Euros y no céntimos porque nadie escribe céntimos.

Admite `30`, `30,50` y `30.50` —la coma es lo que sale del teclado en español,
el punto es lo que sale de copiar y pegar— y también `30 €` y los espacios de
sobra, que es lo que pasa cuando se pega de otro sitio.

Rechaza lo que no es un precio: texto, negativos, y más de dos decimales. Un
importe de cero **se acepta**: es una clase gratis a propósito, y el proyecto ya
distingue eso del nulo en `importeDeClase` («*Cero es una clase gratis a
propósito; null es un olvido que hay que enseñar*»).

Un rechazo no guarda nada y lo dice; no se queda con la mitad del número ni
guarda un cero por defecto.

### Lo que devuelve

Son tres respuestas distintas y ninguna se puede confundir con otra, así que
`interpretarPrecio` devuelve cuál es en vez de un número que haya que
interpretar después:

```ts
type Precio =
  | { clase: "automatico" }                    // el campo estaba vacío
  | { clase: "importe"; centimos: number }     // hay un precio, y cero cuenta
  | { clase: "invalido"; motivo: string };     // no se guarda nada, y se dice
```

Un `number | null` no valdría: el nulo tendría que significar a la vez «vacío,
ponlo en automático» y «esto no es un precio», que son cosas opuestas —una
guarda, la otra rechaza—. El `motivo` va en castellano y se le enseña al
profesor tal cual.

`importeCaduca(estado: string, minutosNuevos: number, minutosViejos: number,
importeAMano: boolean): boolean` es la otra, y solo dice sí o no.

---

## Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` + migración | **Modificar.** La columna `importeAMano`. |
| `lib/clases.ts` | **Modificar.** `interpretarPrecio` y `importeCaduca`, las dos puras. |
| `lib/acciones-clases.ts` | **Modificar.** Leer el campo, aplicar las dos funciones. |
| `app/(app)/profe/clases/[id]/page.tsx` | **Modificar.** El campo en el formulario. |
| `scripts/verificar-clases.ts` | **Modificar.** Las dos funciones nuevas. |

Las dos funciones van a `lib/clases.ts` y no a la acción por el criterio ya
establecido: una acción de servidor necesita sesión y contexto de petición, así
que no se puede llamar desde un script, y ahí ya viven `importeDeClase`,
`validarClase` y `euros`, que son sus hermanas.

---

## Verificación

`npx tsc --noEmit`, `npm run lint` y `scripts/verificar-clases.ts`, que ya
existe y ya cubre `importeDeClase`, `validarClase` y `euros`.

**`interpretarPrecio`**: que `«30»`, `«30,50»`, `«30.50»`, `«30 €»` y
`« 30,50 »` dan lo que deben en céntimos; que `«0»` da cero y no nulo; que
`«»` da «automático» y no cero; y que `«abc»`, `«-5»` y `«30,555»` se rechazan.

**`importeCaduca`**: que un importe calculado caduca al cambiar los minutos de
una clase dada; que uno escrito a mano **no**; que ninguno caduca si los
minutos no cambian; y que ninguno caduca si la clase todavía no está dada.

**A mano**: escribir 30 € en una clase, cambiarle la duración, y comprobar que
los 30 € siguen ahí; vaciar el campo y comprobar que vuelve a calcularse solo.

---

## Fuera de alcance

- **Cambiar la tarifa por hora del alumno o del grupo.** Se sigue tocando donde
  se toca hoy.
- **Un precio por defecto distinto por tipo de clase.** Si hiciera falta, es
  otra tarifa, no un precio a mano.
- **Tocar `cobradaEl`, las sumas de la lista o el filtro de cobradas.** Todo eso
  lee `importeCentimos` y sigue leyendo lo mismo.
- **Un historial de cambios de precio.** No hay, y esto no lo añade.
