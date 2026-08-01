# Pegar por código: una tarea del examen entra escrita, no tecleada

Fecha: 2026-08-01

## El problema

Sembrar la prueba de comprensión de lectura del A2/B1 escolar costó un script de
563 líneas escrito a mano —`scripts/sembrar-dele-a2b1-lectura.ts`— y ejecutarlo
desde la terminal. Ese script no es reutilizable: el examen entero está dentro,
literal, entre las importaciones de Prisma y el borrado de la versión anterior.
El siguiente examen es otro script igual de largo.

Y el trabajo que de verdad cuesta —copiar los nueve anuncios del tablón, los seis
enunciados, la clave oficial— no es un trabajo de programador. Es leer un PDF y
transcribirlo. Hoy solo se puede hacer escribiendo TypeScript.

Este diseño abre una tercera puerta en la ficha del paso: **pegar la tarea ya
escrita**. Y, porque escribirla también cuesta, la aplicación entrega antes el
**encargo** que hay que darle a una IA para que la escriba.

## Qué construimos

Un viaje de ida y vuelta, dentro de la ficha del paso:

```
[paso] → «Pegar por código» → Descargar encargo ──→ se lo das a la IA
                                                     junto al PDF del examen
                                                          │
[paso] ← Guardar ← Comprobar ← pegas lo que devuelve ←────┘
```

**Una tarea por viaje.** Un examen de cuatro tareas son cuatro viajes. No se sube
el examen entero de una vez: cada tarea vive en su paso, y el paso es justo lo
que le da al encargo la información que lo hace útil.

---

## El principio: el archivo solo lleva lo que hay que leer del examen

Todo lo que la aplicación ya sabe, lo pone la aplicación. Pedírselo a la IA es
pedirle que acierte algo que está en la pantalla de al lado.

| Lo pone la IA | Lo pone la aplicación |
|---|---|
| El texto que se lee | `titulo` (= «A2/B1 escolar · CE · Tarea 1») |
| La consigna | `nivel`, `destreza` (del recorrido) |
| Los ítems y sus respuestas correctas | `tipo` (de la marca `ejercicio`, vía `TIPO_DE_EJERCICIO`) |
| Los sobrantes | `etiquetas`, `autorId`, `publicado` |
| | El orden del paso y el enganche |

De ahí sale el segundo principio: **el encargo no es genérico**. Estando dentro
del paso, la aplicación sabe que eso es «A2/B1 escolar · Comprensión de lectura ·
Tarea 1», y `lib/dele/mapa.ts` sabe que esa tarea es `relacionar` con 6 parejas,
9 opciones y 3 sobrantes. El encargo sale ya rellenado por su mitad.

Esto es lo que descarta las dos alternativas que se consideraron:

- **Siete documentos fijos, uno por formato.** Más simple, y los textos quedarían
  más cuidados. Pero el número de ítems y de sobrantes dejaría de venir del mapa,
  y serían siete sitios más donde el mapa y la realidad pueden discrepar — justo
  el error que `verificar-dele.ts` existe para cazar. Ya pasó una vez con los
  ítems de la auditiva del escolar.
- **Un solo encargo genérico** con los cinco motores explicados. Cero
  mantenimiento, pero le entrega a la IA un manual entero para que ella elija, y
  elegir mal entre `relacionar` y `opcion` es el error caro que señala el diseño
  del Creador DELE: usar `opcion` donde las opciones no se repiten deja al alumno
  marcar el mismo texto en dos enunciados, que el examen no permite.

---

## Las pantallas

**Ninguna nace.** `/pasos/[pasoId]` gana una tercera puerta al lado de las dos
que ya tiene —«elegir uno existente» y «crear uno nuevo»—, que se despliega en
dos mitades:

```
┌─ Pegar por código ──────────────────────────────────────┐
│                                                          │
│  A2/B1 escolar · Comprensión de lectura · Tarea 1        │
│  Relacionar seis enunciados con seis de los nueve        │
│  textos. Sobran tres.                                    │
│                                                          │
│  ① El encargo para la IA                                 │
│     [ Descargar encargo.md ]  [ Copiar ]                 │
│     Dáselo a la IA junto al PDF del examen.              │
│                                                          │
│  ② Lo que te devuelva, pégalo aquí                       │
│     ┌────────────────────────────────────────────┐       │
│     │                                            │       │
│     └────────────────────────────────────────────┘       │
│     [ Comprobar ]                                        │
└──────────────────────────────────────────────────────────┘
```

**Comprobar no toca la base.** Dice qué ha entendido —«relacionar · 6 parejas ·
3 sobrantes · la Tarea 1 lleva 6 ítems, cuadra»— y pinta la previsualización con
`components/recursos/previsualizacion.tsx`, que ya existe. Si algo falla, sale el
motivo en castellano que ya escribe zod («Un sobrante no puede repetir el texto
de una respuesta correcta…») y el cuadro sigue ahí para corregir sin salir de la
página. Solo entonces aparece **[Guardar en este paso]**.

**En un paso que no es tarea del mapa** —uno libre de una clase particular— el
encargo es el genérico y lleva un desplegable para elegir entre los cuatro
motores (`opcion`, `relacionar`, `huecos`, `ordenar`); elegido uno, el encargo se
compone igual que el de una tarea, pero sin número de ítems ni sobrantes, que
solo los sabe el mapa. El mapa aconseja y no manda: el mismo principio que ya
rige el resto de esta pantalla.

**La puerta es de profesor, no de administrador.** Todo lo que la rodea —el
selector, el editor de bloques, el «crear uno nuevo»— se abre con `esProfe`.
Meterla en `/admin` la dejaría lejos del paso del que saca su información.

---

## El sobre

Dos casillas y nada más:

```json
{
  "bloque": "## Tablón de anuncios\n\n**A. MUSICALDÍA.** Si sois un grupo…",
  "ejercicio": { "ejercicio": "relacionar", "…": "…" }
}
```

`bloque` es opcional: la Tarea 4 del escolar no lleva ninguno, porque su texto
vive dentro del ejercicio con los huecos marcados. Se guarda tal cual en un
`Bloque` de tipo `TEXTO`, que se pinta como markdown igual que hoy.

**Se llama `bloque` y no `texto` a propósito.** `ejercicio.texto` ya existe y
significa otra cosa: el pasaje con las marcas `{{1}}` del cloze, o el que se
pinta encima de las columnas al insertar fragmentos. El de fuera es el bloque de
lectura que va antes del ejercicio. Dos campos llamados igual con dos destinos
distintos es la errata que la IA cometería una de cada tres veces.

`ejercicio` es, **letra por letra, lo que ya valida el motor**. No se inventa
ningún formato: es lo mismo que hoy escribe a mano el script sembrador y lo mismo
que guarda el editor de Recursos. Las dos formas que usan las pruebas de
comprensión:

```json
{ "ejercicio": "relacionar",
  "consigna": "Relaciona a cada joven con el anuncio que le interesa.",
  "parejas": [ { "id": "1", "izquierda": "MARCOS…", "derecha": "F. AYUNTAMIENTO…" } ],
  "sobrantes": [ "C. CREA TU BLOG…" ] }
```

```json
{ "ejercicio": "opcion", "multiple": false,
  "consigna": "Lee el texto y elige la opción correcta.",
  "opcionesComunes": ["A. Ana", "B. Luis", "C. Sara"],
  "preguntas": [ { "id": "1", "enunciado": "¿Quién…?", "correctas": [2] } ] }
```

`relacionar` cubre `MATCH_TEXT`, `MATCH_TOPIC` y `GAP_INSERT`; `opcion` cubre
`MC`, `MATCH_PERSON`, `ATTRIB` y `CLOZE`. Cuál toca lo decide el mapa, no la IA.

---

## El encargo

Un texto en castellano, descargable como `.md` y copiable al portapapeles. **No
enseña los cinco motores: enseña el suyo**, ya elegido por el mapa, con sus
números puestos y la regla que en esa tarea concreta se puede romper.

Para la Tarea 1 de arriba, el encargo dice «seis parejas y tres sobrantes, nueve
en total» y dice que un sobrante no puede repetir el texto de una respuesta
buena. Para la Tarea 3, dice que se usa lista común **porque un mismo texto
contesta a varias preguntas**. Cierra con un ejemplo resuelto del mismo motor,
sacado del examen ya sembrado.

**El audio no aparece en el encargo, y el encargo lo dice.** Un examen oficial no
lleva el audio dentro del ejercicio: lleva un bloque `AUDIO` encima del paso, un
MP3 por tarea con las dos escuchas ya dentro, que se sube con el editor de
bloques que ya existe. Sin decírselo, la IA se inventaría rutas de archivos que
no existen.

---

## El guardado

**Una transacción y tres filas**: el `Ejercicio`, el `PasoEjercicio` que lo
engancha, y —si el sobre traía `bloque`— un `Bloque` de tipo `TEXTO` con `orden`
al final de los que ya haya. Todo o nada: un ejercicio creado y sin enganchar
sería un huérfano en la lista de Recursos que nadie sabría de dónde salió.

**Nace publicado.** `puedeEngancharse` exige hoy que el ejercicio no sea un
borrador, y con razón: colgar un borrador de un paso es enseñarle al alumno algo
a medias. Aquí esa regla no se salta, se cumple por adelantado — el ejercicio se
crea ya publicado porque acabas de verlo previsualizado y de darle a guardar, que
es exactamente lo que significa publicar. Efecto lateral bueno: queda en Recursos
y otro paso lo puede reutilizar.

**Las dos negativas son las de `puedeEngancharse`, menos la del borrador.** No se
puede llamar a esa función tal cual: espera un `ejercicioId` y aquí el ejercicio
todavía no existe. Así que se saca de ella una `pasoLibre(pasoId)` que devuelve
las dos que no miran al ejercicio, y `puedeEngancharse` pasa a llamarla en vez de
repetirlas. Una sola copia de cada regla, que es lo que evita que dentro de un
mes una de las dos puertas empiece a dejar pasar lo que la otra rechaza:

- «Ese paso ya tiene un ejercicio. Quita el que hay antes de poner otro.» — la
  página del paso pinta uno solo y la corrección escribe los puntos del paso
  entero; dos se pisarían.
- «Alguien ya trabajó en ese paso.» — `tieneTrabajo`, que mira respuestas,
  entregas y rúbricas.

Se comprueban **al pulsar Comprobar**, no al guardar. Dejar pegar y validar un
examen entero para decir al final que el paso estaba ocupado es hacer trabajar
para nada.

---

## Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `lib/pegado/encargo.ts` | Compone el encargo desde el mapa. Puro, **fuera de las acciones**. |
| `lib/pegado/sobre.ts` | Abre el sobre: JSON, sus dos casillas, y `revisarDatos` para lo de dentro. Puro. |
| `lib/pegado/ejemplos.ts` | Un ejemplo resuelto por motor, sacado del examen ya sembrado. |
| `lib/recursos.ts` | **Modificar.** `pasoLibre`, extraída de `puedeEngancharse`. |
| `lib/acciones-recursos.ts` | **Modificar.** La acción `pegarEjercicio`, en transacción. |
| `app/(app)/pasos/[pasoId]/pegar-codigo.tsx` | La puerta: encargo, cuadro, comprobar, previsualizar. |
| `app/(app)/pasos/[pasoId]/page.tsx` | **Modificar.** Pinta la puerta al lado del selector. |
| `scripts/verificar-pegado.ts` | La verificación. |

`lib/pegado/*` va fuera de `"use server"` por el motivo ya establecido en el
proyecto: una acción de servidor necesita sesión de Clerk y contexto de petición,
así que no se puede llamar desde un script. Lo que está fuera es lo único
verificable.

---

## Verificación

`npx tsc --noEmit`, `npm run lint` y un script.

**`scripts/verificar-pegado.ts`** recorre **las 52 tareas del mapa** —doce
pruebas, contadas con `PRUEBAS.reduce`—, compone el
encargo de cada una, y comprueba que **su ejemplo resuelto pasa el esquema del
motor que ese mismo encargo dice usar**.

Esa es la que sujeta el diseño entero. Un ejemplo roto dentro del encargo no
falla en ninguna pantalla: falla en silencio enseñándole a la IA a devolver
basura, y el fallo aparece tres semanas después con un examen mal montado y sin
saber de dónde viene.

También comprueba:

- Que el encargo de una tarea `relacionar` con sobrantes diga el número correcto
  —`opciones` menos `items`, vía `sobrantesDe`— y que el de una `opcion` con
  lista común no hable de sobrantes, porque ahí esa resta no significa nada.
- Que un texto que no es JSON no reviente, sino que diga dónde falla.
- Que un sobre sin `ejercicio` lo diga, y que un `ejercicio` de tipo desconocido
  dé el motivo de zod.
- La ida y la vuelta: coger los datos de la Tarea 1 ya sembrada, meterlos en un
  sobre y sacarlos idénticos.

**A mano**, que es lo que un script no ve: coger el encargo de la Tarea 2 del
A2/B1 escolar, dárselo de verdad a una IA con el PDF del examen, pegar lo que
devuelva y ver si sale a la primera. Ese es el examen de este diseño, no el
`tsc`. Y comprobar que las dos negativas salen cuando tienen que salir: pegar en
un paso que ya tiene ejercicio, y en uno donde un alumno ya respondió.

---

## Fuera de alcance

- **El audio.** Va en su bloque `AUDIO`, con el editor que ya existe. El encargo
  lo dice para que la IA no se invente rutas.
- **Las pruebas de expresión.** `WRITE` y `SPEAK` no tienen formato
  autocorregible; su corrección es la del diseño C.
- **Subir el examen entero de una vez.** Esto es tarea a tarea, por decisión
  explícita: cada tarea vive en su paso, y el paso es lo que hace útil al
  encargo.
- **Que la aplicación hable con la IA.** El viaje lo haces tú: descargas el
  encargo, lo llevas fuera y traes la respuesta. Que la aplicación llame sola a
  un modelo decidiría de paso proveedor, claves y coste, y eso merece su propia
  conversación — la misma que ya quedó anotada en el diseño del Creador DELE.
- **Editar lo pegado desde ahí.** Guardado, se edita en el editor de Recursos
  como cualquier otro ejercicio.
