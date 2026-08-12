# El audio de una prueba, racionado de verdad

Fecha: 2026-08-12

## El problema

El racionamiento del audio de una prueba del DELE se escapa por la única vía
práctica de subir el audio.

`maximoDeEscucha` (`lib/escuchas.ts:106`) solo raciona los bloques de
`tipo: "AUDIO"`, y les da un tope de **una** escucha «porque el archivo oficial
ya trae la repetición dentro». Pero el editor de bloques convierte a `EMBED`
cualquier audio que llegue como enlace de Drive:

```ts
// app/(app)/pasos/[pasoId]/editor-bloques.tsx
const tipoFinal: Tipo = audioDeDrive ? "EMBED" : tipo;
```

Y tiene su porqué escrito, que es bueno: Drive no sirve audio para reproducción
directa, solo su reproductor incrustable. Sin esa conversión, el audio no
sonaría.

El resultado es que las dos features nunca se cruzaron. El MP3 de una tarea de
comprensión auditiva —28,1 MB el mayor del examen que hay a mano— subido como se
puede subir de verdad, queda como un reproductor de Drive **sin tope de
escuchas**, dentro de una prueba cuyo diseño entero se apoya en que ese tope
existe. Y el encargo que «pegar por código» le entrega a la IA se lo promete por
escrito: «*es un MP3 por tarea que se sube aparte, con las dos escuchas ya
grabadas dentro*».

**Racionar un `EMBED` no es posible.** El reproductor de Drive vive en un iframe
de otro dominio: no hay forma de contar cuándo suena ni de impedir que vuelva a
sonar. Si el audio tiene que racionarse, los bytes tienen que estar dentro.

### La segunda puerta

`bloque-editable.tsx` deja cambiarle la `url` a un bloque ya creado, y
`editarBloque` no toca el `tipo`. Así que hay dos puertas con dos fallos
distintos:

| Puerta | Qué pasa hoy |
|---|---|
| Crear con enlace de Drive | se vuelve `EMBED` → **suena bien, no se raciona** |
| Editar la `url` de un `AUDIO` y poner Drive | sigue `AUDIO` → **se raciona, pero no suena** |

### Nada que migrar

En la base de desarrollo hay **0 bloques `AUDIO`** y 6 `EMBED`, ninguno de Drive.
El camino del audio racionado no se ha ejercitado nunca con datos reales: el
agujero está abierto pero todavía no se ha pisado.

## Qué construimos

Que un enlace de Drive en un bloque de audio lo **traiga el servidor**, igual
que ya hace el audio de un ejercicio. El bloque nace `AUDIO` con
`/api/archivos/<id>`, y el `Reproductor` lo raciona sin tocar `maximoDeEscucha`.

**No construimos nada nuevo: recableamos.** La pieza existe.

---

## Recablear, no construir

`components/recursos/subir-audio.tsx` ya tiene las dos vías del audio —archivo
del ordenador y enlace del que lo trae el servidor— y devuelve por `alCambiar`
una dirección `/api/archivos/<id>`. Solo está cableada al editor de Recursos.

En la rama `AUDIO` del editor de bloques va `<SubirAudio>` con
`alCambiar={(url) => setEntrada(url ?? "")}`. Es exactamente el patrón que ese
mismo archivo ya usa para las imágenes:
`<SubirImagen alSubir={(url) => setEntrada(url)} />`.

Y **se quita la conversión automática a `EMBED`** para audio. Deja de hacer
falta: al `crearBloque` ya no le llega un enlace de Drive, le llega una
dirección nuestra. Esa línea era el agujero.

### Tres consecuencias, dichas antes de que sorprendan

**El botón es explícito, y mejor así.** `SubirAudio` no trae el archivo al
escribir la dirección: hay un botón que va a buscarlo. Con 28 MB eso son varios
segundos, y un botón que dice qué está pasando explica la espera mejor que un
campo que se queda pensando.

**Viene gratis la subida de archivo desde el ordenador.** No se quita: para un
audio corto de una clase particular es la vía cómoda, y el componente ya explica
en pantalla que lo grande entra por dirección, porque por el navegador solo caben
4 MB —el tope del cuerpo de una petición en Vercel—. Por dirección no hay tope de
plataforma: descarga el servidor. `MAXIMO_TRAIDO` son 100 MB y
`MAXIMO_AUDIO_GUARDADO` 20; los 28,1 MB del peor caso conocido comprimen a unos
5-6.

**Hay que reescribir la ayuda del tipo `AUDIO`**, que hoy dice «*Si es de Google
Drive, se convierte solo en reproductor incrustado*» — justo lo que deja de ser
verdad.

---

## La escotilla

Cuando la traída falla —archivo privado, no es audio, demasiado grande—,
`SubirAudio` ya enseña el motivo que devuelve `/api/archivos`, redactado y
diciendo qué arreglar. Debajo, el editor de bloques ofrece **«Ponerlo como
reproductor de Drive»**, que crea el bloque `EMBED` con la dirección `/preview`:
el comportamiento de hoy, pero pedido a mano y no aplicado en silencio.

Está disponible **también dentro de una prueba**. Es una decisión: el profesor a
veces necesita desatascarse más de lo que necesita la regla. Lo que no puede
pasar es que se olvide de que lo hizo — de ahí la marca.

### `SubirAudio` no puede saber qué es un bloque

El fallo ocurre dentro de `SubirAudio` y la escotilla vive en el editor de
bloques. Se resuelve con una prop opcional:

```ts
alFallar?: (direccion: string) => void
```

que avisa con la dirección que no se pudo traer. El editor de bloques la guarda y
pinta su escotilla. Así `SubirAudio` no sabe nada de bloques ni de `EMBED`
—conceptos que en el mundo de los ejercicios no existen— y el editor de Recursos
no se entera del cambio, porque la prop es opcional.

---

## La marca

En `BloqueEditable`, cuando el recorrido está racionado y el bloque es un `EMBED`
de Drive:

> este audio va incrustado de Drive: la aplicación no puede contar cuántas veces
> se abre

**Solo la ve el profesor, por construcción.** La página envuelve cada bloque en
`<BloqueEditable>` únicamente cuando `esProfe`
(`app/(app)/pasos/[pasoId]/page.tsx:446`), y le pasa el contenido como hijo. No
hay que enhebrar ninguna prop hasta `BloqueContenido` ni arriesgarse a
enseñárselo a un alumno. `BloqueEditable` necesita una prop nueva, `racionado`.

**Solo dentro de una prueba.** Fuera no se raciona nada y el aviso sería ruido.

### Sin columna nueva

`esAudioDeDrive(url)` ya existe —«de Drive y acaba en `/preview`»— y la página ya
la usa para darle al iframe 24 de alto en vez de formato vídeo. La marca deriva
de la `url`, así que ningún bloque existente necesita migración.

**Pero hay que moverla.** Vive dentro de `page.tsx:68` y ahora la necesitan dos
archivos, uno de servidor y otro de cliente. Copiarla sería crear la segunda
fuente de la misma regla, que es el error que `numeroDeTarea` se llevó a
`lib/dele` para no repetir, con el porqué escrito allí. Va a un módulo pequeño y
compartido, sin dependencias de servidor para que el cliente pueda importarla.

### Una imprecisión que se hereda a propósito

`esAudioDeDrive` acepta cualquier `/preview` de Drive, así que **un vídeo de
Drive incrustado también encaja**. Por eso el aviso dice «este audio va
incrustado» y no «no cuenta escuchas»: la frase es cierta para los dos casos.
Afinarlo pediría una columna, y no está pagada.

---

## El portero, y por qué va en el servidor

Cerrar la segunda puerta tiene dos mitades, y solo una sujeta.

**La comodidad:** el mismo `<SubirAudio>` en el formulario de edición cuando el
bloque es `AUDIO`, para que la forma correcta esté a mano.

**El portero:** una comprobación en el servidor, **compartida por `crearBloque` y
`editarBloque`**: si el tipo es `AUDIO` y la dirección es de Drive, se rechaza con
el motivo. Esta es la mitad que importa, por lo que este proyecto ya tiene escrito
en `lib/recursos.ts:90` y en `maximoDeEscucha`: **lo que exporta un `"use server"`
es un endpoint público**. Un arreglo que viviera solo en el componente lo esquiva
cualquiera que reenvíe el formulario y, más probable, lo esquiva el próximo
formulario que alguien escriba sin acordarse.

Va en una función pequeña en `lib/`, no copiada en las dos acciones — la misma
forma que `pasoLibre`: la regla en `lib/`, las acciones finas.

**Es estrecho a propósito:** solo `AUDIO` + Drive. Un `EMBED` de un vídeo de Drive
tiene que seguir entrando, y una dirección directa que no sea de Drive en un
`AUDIO` también, porque esa sí suena y sí se raciona.

### Qué cuenta como «de Drive»: dos detectores, dos trabajos

Esto no es un detalle: con el detector equivocado, el portero no caza la forma más
común de pegar un enlace.

- **El portero usa `idDrive`** (hoy en `editor-bloques.tsx:72`), que reconoce
  `drive.google.com/file/d/XXX`, `open?id=XXX` y `?id=XXX` — entre ellas la que se
  copia de la barra del navegador, `…/file/d/XXX/view`.
- **La marca usa `esAudioDeDrive`** (hoy en `page.tsx:68`), que es «de Drive **y
  acaba en** `/preview`» — la forma ya convertida a reproductor incrustable, que es
  lo único que la escotilla llega a guardar.

Usar `esAudioDeDrive` en el portero lo dejaría pasar todo salvo lo que ya está
convertido, o sea justo al revés de lo que hace falta.

Las dos van al módulo compartido. `idDrive` se mueve, no se copia: `urlDirectaMedia`
(`editor-bloques.tsx:86`) la sigue necesitando.

---

## Verificación

`scripts/verificar-bloques-audio.ts`, con el idioma de la casa: `afirmar`, datos
propios, limpieza en el `finally`, `npx tsx`.

1. `crearBloque` con `tipo: "AUDIO"` y una dirección de Drive **se rechaza**, y el
   motivo lo dice.
2. `editarBloque` sobre un `AUDIO` que ya existe, con Drive, **se rechaza** igual.
   La segunda puerta, comprobada aparte de la primera.
3. Un `EMBED` con dirección de Drive **sí entra**: el portero es estrecho y no se
   ha llevado por delante los vídeos.
4. Un `AUDIO` con `/api/archivos/<id>` entra, y `maximoDeEscucha(pasoId, bloqueId)`
   sobre él devuelve **1** en un recorrido de preparación con prueba. El
   racionamiento funcionando, no solo la fila creada.
5. Los dos detectores desde su módulo nuevo, cada uno con su trabajo:
   `esAudioDeDrive` cierto para `…/preview` y falso para `/api/archivos/x` y para
   una dirección directa cualquiera; `idDrive` **no vacío** para
   `drive.google.com/file/d/XXX/view`, que es la forma que se copia del navegador y
   la que el portero tiene que cazar. Confundirlos es el fallo que esta afirmación
   existe para impedir.

La traída de Drive en sí no lleva afirmaciones: depende de la red, y
`POST /api/archivos` ya está en producción con su propio
`scripts/verificar-enlaces.ts`.

## Lo que este diseño no hace

- **No migra nada.** No hay bloques `AUDIO` ni `EMBED` de Drive en desarrollo. Si
  producción tuviera alguno, la marca lo señala en cuanto se abre su paso; no se
  convierte solo.
- **No toca `maximoDeEscucha`.** No hace falta: el arreglo consiste en que el
  bloque sea del tipo que esa función ya raciona.
- **No afina `esAudioDeDrive`** para distinguir audio de vídeo. Ver arriba.
- **No añade la subida de archivo como objetivo**: viene incluida por reutilizar
  `SubirAudio`, y con el tope de 4 MB que le impone la plataforma.
