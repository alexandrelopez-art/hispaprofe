# Pegar el examen entero

Fecha: 2026-08-11

## El problema

Montar una prueba del DELE en la aplicación son ocho pasos a mano, y solo uno
tiene que ver con el contenido del examen.

Una secuencia de preparación con prueba elegida **nace sin pasos**: la casilla
de la plantilla se desmarca sola al elegir prueba (`eleccion-dele.tsx`) porque
la plantilla de nueve pasos es la pedagógica, no la del examen
(`lib/acciones.ts:415`). Así que el profesor tiene que crear la secuencia, crear
cuatro o cinco pasos, titularlos «Tarea N», escribir en cada uno el bloque con
el texto del estímulo, ir a Recursos entrando por el mapa
(`/profe/recursos/nuevo?nivel=…&prueba=…&tarea=N`), teclear los ítems uno a uno,
publicar y enganchar. Por cada tarea.

El editor de Recursos ya ayuda con lo que puede: entrando por el mapa monta la
estructura vacía con el número exacto de ítems y opciones que pide esa tarea
(`estructuraDe`, `app/(app)/profe/recursos/nuevo/page.tsx:43`) y avisa si lo
escrito no cuadra (`avisoDeItems`, `lib/dele/index.ts:83`). Pero ahorra el
andamiaje, no el tecleo.

Hoy la única carga masiva que existe es un script:
`scripts/sembrar-dele-a2b1-lectura.ts` lleva el examen de mayo de 2015 escrito
en el código. Corre en el portátil contra la base de desarrollo, así que para
que llegue al sitio publicado hay que pasar además por
`scripts/copiar-a-produccion.ts`.

## Qué construimos

Una caja de pegado en la página de la secuencia. Se le da el JSON de una prueba
entera —generado con un LLM a partir del PDF del Cervantes— y monta las tareas:
paso, bloques, ejercicio publicado y enganche.

**Lo que no construimos:** no crea la secuencia (eso ya se hace bien en
`/profe/secuencias/nueva`, con el mapa del DELE delante), y no hay forma de
pegar un examen «a la biblioteca» sin secuencia. Un ejercicio de una prueba sin
su paso ni su texto de estímulo no sirve para nada.

---

## La forma del JSON

Un sobre con el nivel, la prueba y las tareas. Dentro de cada tarea, **el
`datos` del ejercicio tal cual**:

```json
{
  "nivel": "A2_B1_ESCOLAR",
  "prueba": "CO",
  "titulo": "A2/B1 escolar · Comprensión auditiva (mayo 2015)",
  "duracion": 30,
  "convocatoria": "mayo 2015",
  "tareas": [
    {
      "numero": 1,
      "audio": "https://drive.google.com/file/d/…",
      "texto": "## Tablón de anuncios\n\nVas a leer…",
      "ejercicio": { "ejercicio": "relacionar", "consigna": "…", "parejas": [] }
    }
  ]
}
```

### `tareas[].ejercicio` es la columna `datos`, sin intermediarios

Lo que el LLM genera es literalmente lo que `revisarDatos` (`lib/recursos.ts:94`)
valida y lo que se escribe en la columna. No hay formato intermedio que
traducir: un ejercicio pegado y uno hecho a mano quedan indistinguibles en la
base, y cuando mañana cambie un esquema no hay un segundo formato que se quede
atrás.

### `audio` cuelga de la tarea, no del ejercicio

Esto no es una preferencia de estilo: es lo que impide un fallo silencioso.

Las escuchas se cuentan **por `clave`**, y `clave` es el id de la pregunta o de
la pareja, no el archivo (`maximoDeEscucha`, `lib/escuchas.ts:106`). Los MP3
oficiales del Cervantes son **uno por tarea** —28,1 · 17,6 · 10,2 · 19,8 MB en
el examen que hay a mano—, así que apuntar las seis preguntas de una tarea al
mismo archivo le daría a cada una su propia cuota de dos: doce escuchas del
mismo audio, y el racionamiento del examen dejaría de significar nada.

El sitio correcto ya existe en la arquitectura: un **bloque `AUDIO`**, cuyo tope
es siempre 1 «porque el archivo oficial ya trae la repetición dentro»
(`lib/escuchas.ts:97`). Que es exactamente lo que son esos MP3: la locución
repite cada audio por dentro.

Consecuencia: **si un `ejercicio` pegado trae `audio` dentro de una pregunta o
de una pareja, se rechaza.** Y hace falta rechazarlo a mano, porque
`audio: z.string().optional()` acepta cualquier cadena: Zod no puede ser el
portero de esto.

### `texto` es markdown y se vuelve el bloque `TEXTO`

Opcional. Un cloze no lo lleva: su pasaje vive dentro del ejercicio con los
huecos marcados, y los desplegables se pintan encima. Es el caso de la Tarea 4
del script de siembra, que por eso no crea bloque.

### `nivel` y `prueba` son la comprobación

Se cotejan con el `nivel` y la `destreza` de la secuencia elegida, y con el mapa
(`tareaDe`) para saber el motor, los ítems y las opciones que el examen pide en
cada tarea. Si el sobre dice `CO` y la secuencia es de `CE`, se rechaza entero
antes de mirar ninguna tarea: es un error del sobre, no de una tarea suelta.

### `titulo` y `duracion` son informativos

Se enseñan en el panel, para que el profesor vea que no se ha equivocado de
sitio, y ahí acaban. No se cotejan contra el mapa —que ya sabe la duración de
cada prueba en `duracionMinutos`— ni se escriben en la secuencia, que ya existe
con el título y la descripción que su autor escribió.

`convocatoria` es lo único del sobre que llega a la base: alimenta las
etiquetas del ejercicio. También opcional.

---

## Dónde vive

En `/recorridos/[id]`, junto a `TareasSugeridas`. **Sin desplegable de
secuencias.**

`TareasSugeridas` (`app/(app)/recorridos/[id]/tareas-sugeridas.tsx`) ya calcula
qué tareas faltan, con la regla canónica `numeroDeTarea`, y ya tiene un botón
por tarea que crea el paso nombrado. Tres razones para vivir ahí:

1. La secuencia ya está en contexto: su `id`, su `nivel` y su `destreza` los
   tiene la página.
2. Un desplegable tendría que listar solo secuencias de preparación con prueba,
   y explicar por qué las demás no salen. Aquí no hay nada que explicar: si esta
   secuencia no es una prueba, `pruebaDe` devuelve null y la sección no existe.
3. **El estado «ya está, se salta» es el `ocupados` que ese componente ya
   calcula.** Al volver a pegar después de arreglar una tarea, las demás salen
   como puestas sin que ninguna pantalla recuerde nada — y con la misma regla
   que usa la ficha del paso, que es la advertencia que ese archivo ya lleva
   escrita: contarlo de otra manera en otro sitio hace que la lista ofrezca
   tareas que sí están.

---

## Las tres fases

### Fase 1 · Revisar

`revisarPrueba(recorridoId, json)`, una acción de servidor que **no escribe
nada**:

1. `exigirProfesor()` y `JSON.parse` con su captura.
2. Lee la secuencia. Si no es `PREPARACION_DELE` con `destreza`, se niega.
3. El sobre: `nivel` y `prueba` contra el `nivel` y la `destreza` de la
   secuencia. Si discrepan, se rechaza entero.
4. Por cada tarea, cinco preguntas:
   - ¿Existe ese número en el mapa? Una tarea 6 en una prueba de cinco, no.
   - ¿Ya hay un paso «Tarea N»? → *ya está, se salta*.
   - ¿La acepta `revisarDatos`? → si no, su motivo, que ya viene redactado en
     castellano y con la ruta del campo («*Alguna respuesta correcta apunta a
     una opción que no existe*» `(preguntas → 3 → correctas)`).
   - ¿El motor coincide con el que el mapa pide para esa tarea?
   - ¿Alguna pregunta o pareja trae `audio` dentro? → error.
5. El número de ítems, con `avisoDeItems`, **como aviso y no como error**. Dos
   motivos, y el segundo es concreto: el mapa tiene tareas marcadas
   `verificado: false`, y un dato deducido no puede vetar un examen real; y hay
   tareas que el motor no sabe construir enteras. La Tarea 1 de A2/B1 escolar CO
   responde con dibujos en sus cuatro primeros ítems —«*hoy el motor solo sabe
   construir las tres últimas*», `lib/dele/mapa.ts`— porque las opciones de
   `opcion` son `z.array(z.string())` y una imagen no cabe ahí. Esa tarea se
   monta legítimamente con 3 de sus 7 ítems, y el aviso lo dice sin impedirlo.

Devuelve una fila por tarea —`monta`, `ya está` o `error`— y la lista de audios
que hay que traer.

### Fase 2 · Traer los audios

El navegador, **un audio por petición**, a `POST /api/archivos` con `{url}`.

Ese route ya es el descargador entero (`app/api/archivos/route.ts:128`): trae de
la dirección, comprime, guarda el `Archivo` y devuelve `/api/archivos/<id>`. Con
`maxDuration = 300`, techo de 100 MB para lo traído y los mensajes de error ya
escritos. Para los audios no hay código nuevo que escribir.

Cada respuesta se sustituye en el JSON que la pantalla tiene en memoria.
Secuencial y con progreso visible, por tres motivos: son decenas de megas y cada
descarga merece sus 300 s enteros; se ve qué está pasando; y un fallo en el
tercero no pierde los dos primeros, que siguen sustituidos en memoria.

Los enlaces que ya sean `/api/archivos/<id>` se dejan como están.

**Solo se traen los audios de las tareas que van a montarse.** Una tarea en
estado `error` o `ya está` no descarga nada: bajar 28 MB para una tarea que la
fase 3 va a rechazar, o que ya tiene su bloque puesto, es tiempo del profesor y
una fila `Archivo` que nadie va a usar. Al arreglar el JSON y volver a revisar,
esa tarea pasa a `monta` y entonces sí se trae el suyo.

### Fase 3 · Montar

`montarPrueba(recorridoId, json)`, que **no toca la red**: solo escribe.

**Repite entera la fase 1** antes de escribir, sin fiarse de lo que el cliente
diga que estaba bien: un `"use server"` exportado es un endpoint público, que es
el razonamiento que `maximoDeEscucha` ya lleva escrito. Si a estas alturas queda
un `audio` que no sea `/api/archivos/<id>`, se niega.

---

## Qué se escribe

Por cada tarea que se monta, con las convenciones de
`sembrar-dele-a2b1-lectura.ts`:

| Fila | Qué lleva |
|---|---|
| `Paso` | `titulo: "Tarea N"`, `tipo: ACTIVIDAD`, `ciclo: 1`, `destreza` de la secuencia, `orden: N` |
| `Bloque` AUDIO | solo si la tarea trae audio · `url: /api/archivos/<id>`, `etiqueta: "Audio de la tarea N"`, `orden: 1` |
| `Bloque` TEXTO | solo si trae `texto` · el markdown tal cual, `orden: 2` (o 1 si no hay audio) |
| `Ejercicio` | `tipo` vía `TIPO_DE_EJERCICIO`, `titulo: "<secuencia> · Tarea N"`, `nivel`, `destreza`, `etiquetas: ["DELE", "<nivel>", "<convocatoria>"]`, `datos`, `publicado: true` |
| `PasoEjercicio` | `orden: 1` |

### Una `$transaction` por tarea, no una para todo

Es lo que hace posible «montar las que valen». Una transacción única haría que
un fallo en la tarea 3 deshiciera la 1, la 2 y la 4 —todo o nada—. Por tarea,
cada una es atómica (no queda un paso a medio montar, sin ejercicio) y las
buenas sobreviven.

### `publicado: true` en el ejercicio

`puedeEngancharse` (`lib/recursos.ts:153`) se niega a colgar un borrador de un
paso, y con razón. El script de siembra lo esquiva porque escribe con Prisma
directo; esta pantalla no debe esquivarlo. Y no expone nada al alumno: lo que él
ve depende de su asignación y del `publicado` del **recorrido**, que sigue en
`false`.

### `orden: N` y no `max+1`

`crearPaso` usa `max+1` (`lib/acciones.ts:501`). Con esa regla, montar la Tarea 3
cuando ya están la 1, la 2 y la 4 la dejaría con `orden` 4: última en la
pantalla, detrás de la Tarea 4. No rompería nada —`numeroDeTarea` mira el título
primero, y esa regla existe justo por este tipo de desajuste— pero se vería mal.
`orden: N` la deja en su sitio, y no hay restricción de unicidad en
`(recorridoId, orden)` que pueda reventar.

### El bloque `AUDIO` va antes del `TEXTO`

Cuando la tarea trae los dos. En la auditiva se escucha antes de leer.

---

## Lo que queda suelto

Los audios se crean **antes** de montar, así que abandonar la pantalla a mitad
deja `Archivo` sueltos en la biblioteca. No rompen nada —son material del
profesor, reutilizable, y `copiar-a-produccion.ts` ya sabe llevárselos— pero
están. Es el precio de que cada descarga tenga su propia petición, y se acepta a
cambio de eso.

Recargar la página también pierde las sustituciones que la fase 2 tenía en
memoria: los audios ya están en la biblioteca, pero un segundo pegado los
volvería a descargar y crearía filas duplicadas. Mientras la pantalla no se
recargue, reintentar el montaje no descarga nada.

---

## Verificación

`scripts/verificar-pegado-dele.ts`, con el idioma de la casa: `afirmar`, datos
propios, limpieza en el `finally`, `npx tsx scripts/verificar-pegado-dele.ts`.

1. Un sobre cuyo `nivel`/`prueba` no cuadran con la secuencia **no escribe
   nada**.
2. Una tarea con `audio` dentro de una pregunta **se rechaza**, y no se monta.
   Es la afirmación que protege el racionamiento del audio.
3. Un JSON con la tarea 3 mala monta la 1, la 2 y la 4; **volver a pegarlo con
   la 3 arreglada monta solo la 3**, y da las otras por «ya está». Las dos
   pasadas, que es donde vive la idempotencia.
4. Lo montado queda coherente: paso, bloques en su orden, ejercicio con el
   `tipo` que le toca y enganchado, y `analizar()` acepta sus `datos`.
5. En una prueba de CO, `maximoDeEscucha(pasoId, bloqueId)` devuelve **1** sobre
   el bloque `AUDIO` montado. El racionamiento funcionando, no solo la fila
   creada.
6. Una tarea que falla a mitad de escribirse no deja un paso sin ejercicio.

La fase 2 no lleva afirmaciones: depende de la red y de Drive, y el tramo que
descarga ya está en producción con su propio `scripts/verificar-enlaces.ts`.

## Cómo se prueba de verdad

Con el examen que hay a mano: los cuatro MP3 de `CO_EXAMEN 1_TAREA 1..4` (28,1 ·
17,6 · 10,2 · 19,8 MB) subidos a Drive, y el JSON generado del PDF del Cervantes.
Es A2/B1 escolar CO: cuatro tareas, 30 minutos, un audio por tarea. Se espera que
la Tarea 1 salga con 3 ítems de 7 y su aviso, por lo de los dibujos.

Y recordando que en Vercel no hay vistas previas —`DATABASE_URL` y `DIRECT_URL`
solo están definidas para Production—, así que la prueba en local va contra
`hispaprofe_dev` y lo que se monte ahí no llega solo al sitio publicado:
`scripts/copiar-a-produccion.ts` es el que lo lleva.
