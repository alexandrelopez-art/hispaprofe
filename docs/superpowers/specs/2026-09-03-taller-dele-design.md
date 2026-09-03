# El taller del examen: un examen del DELE entra en el sitio desde el sitio

Fecha: 2026-09-03. Entrega 3 (puerta → carcasa → **taller** → biblioteca y
actividades → artículos). Decisión del profesor: «entonces vamos a construir el
taller». Nivel de esta entrega: **A2/B1 escolar**, el único que el mapa del DELE
(`lib/dele/mapa.ts`) tiene contrastado.

## El problema

El profesor tiene seis exámenes de un libro de preparación (páginas escaneadas
como imágenes, un MP3 por tarea, y un cuadernillo con las soluciones y las
transcripciones) y quiere que sus estudiantes los hagan en el sitio. Hoy meter
un examen es trabajo de programador: transcribirlo a un script de siembra,
sembrarlo en local y copiarlo a producción. La única ayuda desde el sitio,
«pegar por código», redacta un encargo para una IA externa tarea a tarea y el
profesor copia y pega ocho veces.

## Decisiones del profesor (3 sept 2026)

1. **Alcance**: lectura y auditiva en esta entrega; expresión escrita y oral en
   la siguiente, con su sitio previsto.
2. **Entrada**: imágenes de las páginas o PDF, los audios y el cuadernillo de
   claves. **Las imágenes que van dentro de una tarea no las adivina la IA**:
   el taller le pide al profesor una lista y él las sube.
3. **Quién lo ve**: publicado en el catálogo del nivel de la puerta DELE, y
   además asignable con fecha a un grupo o a un particular desde Mis clases.
4. **Revisión obligatoria tarea por tarea**: nada se publica hasta que las ocho
   tareas están revisadas por el profesor.
5. **Audio cortado por pregunta** donde la grabación tiene trozos, con la onda
   para marcar los cortes; entera donde no; el examen blanco encadena.

## Qué construimos

### 1. La ficha del examen

Modelo nuevo `Examen`: `id`, `titulo`, `nivel` (`Nivel`, hoy `A2_B1_ESCOLAR`),
`fuente` (texto libre: «DELE A2/B1 escolar, libro X, examen 2»), `estado`
(`EN_CONSTRUCCION | PUBLICADO | ARCHIVADO`), `bloque` (el bloque de la puerta
DELE donde se publica: 2 práctica o 3 examen blanco), `clavesTexto` (el texto
extraído del cuadernillo, opcional), `creadoPorId`, fechas. Relaciones:
`lecturaId` y `auditivaId` → dos `Recorrido` (`tipo PREPARACION_DELE`,
`destreza CE`/`CO`, `examen` = número), que son exactamente lo que el
estudiante abre hoy. **El modelo del estudiante no cambia**: `Recorrido`,
`Paso` «Tarea N», `Bloque`, `Ejercicio`, `PasoEjercicio`, `Asignacion`,
`PasoCompletado`, `Escucha` siguen iguales.

Modelo `PaginaDeExamen`: `examenId`, `orden`, `archivoId` (la imagen, un
`Archivo` no privado), `prueba?` y `tarea?` (a qué tarea se asignó). Modelo
`TareaDeExamen`: `examenId`, `prueba` (`CE|CO`), `numero` (1-4), `pasoId`,
`estado` (`VACIA | RELLENADA | REVISADA`), `dudas` (JSON: lista de
`{campo, texto}` que dejó la IA), `avisos` (JSON: lo que no cuadra con el
mapa), `imagenesPedidas` (JSON: lista de `{clave, para, archivoId?}`; `clave`
es el ítem u opción de `datos` que la recibe), `claveOficial?` (JSON: las
respuestas correctas tomadas del cuadernillo), `rellenadaEl?`, `revisadaEl?`.
Unicidad `(examenId, prueba, numero)`.

**Crear un examen** (`/dele/taller/nuevo`: título, fuente, número, bloque)
monta el esqueleto entero en una transacción: dos `Recorrido` sin publicar,
ocho `Paso` «Tarea N» del `TipoPaso` que el mapa dicta, ocho `Ejercicio` sin
publicar con el `datos` vacío del tipo y tamaño que el mapa dicta (lo que hoy
hace `estructuraDe` en `profe/recursos/nuevo`, ocho veces), ocho
`PasoEjercicio`, ocho `TareaDeExamen` en `VACIA`.

**Dónde**: la herramienta «Taller (pronto)» de la banda de la puerta DELE pasa a
«Taller» → `/dele/taller` (lista: en construcción, publicados, archivados),
`/dele/taller/nuevo`, `/dele/taller/[id]` (la mesa de trabajo),
`/dele/taller/[id]/tarea/[prueba]/[n]` (la revisión de una tarea). Solo
`PROFESOR`/`ADMIN`; un estudiante que llegue por la URL recibe 404 como el resto
de pantallas del profesor.

**La mesa de trabajo** (`/dele/taller/[id]`): encabezado con título, fuente,
estado y los botones Publicar/Retirar/Asignar; zona «Páginas del examen»; zona
«Cuadernillo de claves»; panel «Imágenes que faltan»; y dos columnas, Lectura y
Auditiva, con cuatro tarjetas de tarea cada una: número, qué pide según el
mapa, estado (vacía / rellenada / revisada, con los avisos rojos y las dudas
amarillas contadas), páginas asignadas, «Rellenar con IA» y «Abrir». Arriba,
«Rellenar las ocho».

### 2. Páginas, cuadernillo y lectura con IA

**Páginas.** El profesor arrastra imágenes o un PDF. Un PDF se convierte en el
navegador a una imagen por página (pdf.js, render a JPEG de ancho 1600 px,
calidad 0,85) y cada página se sube por separado por `/api/archivos` (el mismo
camino que las imágenes de hoy, tope 4 MB por petición). Cada página es un
`Archivo` + `PaginaDeExamen`. Se pueden reordenar y borrar.

**Asignar páginas a tareas.** Cada tarjeta de tarea tiene «Está en las
páginas…» con las miniaturas para marcar una o dos. «Repartir en orden» asigna
por el orden del libro: las páginas se reparten en el orden lectura 1-4 y
auditiva 1-4, dos por tarea salvo la última de cada prueba, y el profesor
corrige.

**Cuadernillo.** Un PDF cuyo texto se extrae en el servidor (`pdf-parse` o
`pdfjs-dist` en Node, sin binarios) y se guarda en `Examen.clavesTexto`. Si el
PDF no tiene texto, se avisa y el examen sigue sin claves. El taller recorta,
por tarea, el trozo que le toca buscando los rótulos del cuadernillo («EXAMEN 2
– PRUEBA DE COMPRENSIÓN AUDITIVA – TAREA 1» y el bloque «SOLUCIONES» de esa
prueba); si no los encuentra, manda el cuadernillo entero y lo dice.

**Rellenar con IA** (acción de servidor por tarea, `lib/taller/rellenar.ts`):

- Cliente Anthropic con el SDK oficial (`@anthropic-ai/sdk`), modelo
  `claude-opus-5`, `thinking: { type: "adaptive" }`, sin streaming (la
  respuesta es pequeña). Clave en `ANTHROPIC_API_KEY` (Vercel). Sin clave, el
  botón se deshabilita con «Falta la clave de la API» y la ruta responde con
  ese mismo error.
- Entrada: el `TareaDele` del mapa (formato, motor, ítems, opciones,
  `listaComun`, `pide`), las páginas asignadas como bloques de imagen, el trozo
  del cuadernillo, y el **esquema JSON** del `datos` del motor
  (`opcionSchema`/`relacionarSchema` convertidos con `zod-to-json-schema`) como
  herramienta de salida forzada (`tool_choice`), de modo que la respuesta es
  siempre un objeto con: `bloque` (markdown del estímulo, o `null` cuando el
  texto vive dentro del ejercicio, como en el cloze), `ejercicio` (el `datos`),
  `imagenesPedidas` (`{clave, para}`), `dudas` (`{campo, texto}`),
  `claveOficial` (las correctas leídas del cuadernillo, o `null`).
- Salida: el `datos` pasa por `revisarDatos` (el mismo validador del editor y de
  los scripts); lo que no cuadre con el mapa (`avisoDeItems`, número de
  opciones, sobrantes) se guarda en `avisos`. Se guarda siempre que el JSON sea
  válido, en `RELLENADA`, sustituyendo el `datos` anterior; el `Bloque TEXTO`
  del paso se crea o se sustituye. Si el JSON no valida, no se guarda nada y la
  tarjeta enseña el error.
- Cuando hay `claveOficial`, el taller la reproduce por `corregir()` del motor
  sobre el `datos` recién guardado: si no da el máximo, aviso rojo «La clave
  oficial no cuadra con lo leído» con los ítems que fallan.
- La llamada dura segundos; `maxDuration = 120` en la ruta. Sin colas.

**Rellenar las ocho**: el navegador lanza las ocho acciones en serie, con una
barra de progreso por tarea; una que falla no detiene a las demás.

**El encargo de texto** de `lib/pegado/encargo.ts` sigue existiendo para quien
prefiera pegar por código; el taller construye su prompt aparte
(`lib/taller/encargo-ia.ts`) reutilizando las mismas reglas por campo.

### 3. La revisión de una tarea

`/dele/taller/[id]/tarea/[prueba]/[n]`, a dos columnas: **la página original**
(las páginas asignadas, ampliables con zoom) y **la tarea editable**: enunciado,
estímulo (el `Bloque TEXTO`, markdown), y los ítems uno a uno con sus opciones
y la correcta marcada (o las parejas y los sobrantes en `relacionar`). Es el
editor de ejercicios rehecho sobre las piezas de la carcasa, ítem a ítem: los
campos de lista que el kit v2 dejó fuera (`campo`/`area` de
`components/recursos/campos.tsx`) se sustituyen aquí por piezas (`ListaDeItems`,
`Item`, con añadir/quitar/mover). Las dudas de la IA se pintan en amarillo sobre
el campo que tocan; los avisos del mapa, en rojo arriba.

Acciones: **Guardar** (no cambia el estado; si la tarea estaba `REVISADA`,
vuelve a `RELLENADA` y lo dice), **Volver a rellenar con IA** (con
confirmación; sustituye), **Marcar revisada** (exige: cero avisos rojos, todas
las preguntas con correcta, cero imágenes pendientes de esta tarea, y en la
auditiva, audio presente), **Ver como estudiante** (abre `/pasos/[pasoId]` con
una asignación de prueba del propio profesor, marcada `dePrueba`, que no cuenta
en ningún listado ni nota).

Los tres botones del editor viejo (Guardar/Publicar/Borrar en un mismo `form`)
no se repiten: aquí cada acción es su propio formulario.

### 4. Imágenes y audio

**Imágenes que faltan.** Panel en la mesa de trabajo con todas las
`imagenesPedidas` de las ocho tareas sin `archivoId`: «Auditiva · tarea 1 ·
pregunta 3 · opción B» con su hueco de subida (una a una, o varias de golpe
repartidas arrastrando). Se reducen en el navegador a WebP como hoy, se suben
por `/api/archivos`, y el `archivoId` se escribe en el sitio de `datos` que dice
`clave`. **El motor de opción admite opciones con imagen**: en `opcionSchema`,
cada opción pasa de `string` a `string | { texto?: string; imagen: string }`
(la ruta `/api/archivos/<id>`); `components/ejercicios/opcion.tsx` las pinta en
fila con su letra debajo, tanto en escritorio como en móvil; `corregir` no
cambia (sigue por índice). Es el hueco que el mapa señala para la tarea 1 de la
auditiva.

**Audio de una tarea.** En cada tarea auditiva, zona «Grabación»: subir el MP3
o pegar un enlace de Drive (los dos caminos de hoy; se comprime como hoy). El
resultado se guarda como `Bloque AUDIO` del paso con etiqueta «Grabación
completa». Debajo, **la onda**: el navegador decodifica el audio guardado
(Web Audio), lo dibuja en un canvas, y propone marcadores en los silencios
largos (> 1,5 s por debajo de un umbral); el profesor añade con un clic, arrastra
o borra, y escucha cinco segundos desde cada marcador. **Cortar** manda los
tiempos al servidor, que produce un trozo por tramo con el ffmpeg empaquetado
(`ffmpeg-static`, ya en producción para comprimir), guarda cada trozo como
`Archivo` y los asigna en orden: en la tarea 1, uno por pregunta; en la 2, uno
por pareja; en la 4, uno por noticia (dos preguntas comparten trozo); la tarea
3 no se corta: el audio entero va con las seis preguntas. `escuchas` queda en 2
por trozo (la grabación del libro no lleva la repetición dentro; si la lleva, el
profesor lo baja a 1 en la revisión). El número de tramos que el mapa espera se
enseña al lado («7 diálogos») y un número distinto es aviso rojo.

**Examen blanco.** En el bloque 3 de la puerta DELE, el reproductor encadena los
trozos de la tarea: suena seguido, dos audiciones, sin pausa; en los bloques de
práctica, cada pregunta con su trozo. Mismo material, dos reproductores
(`components/ejercicios/reproductor.tsx` gana el modo «encadenado»).

### 5. Publicar y asignar

**Publicar** solo se enciende con las ocho `REVISADA`, cero imágenes pendientes
y audio en las cuatro auditivas; pone `publicado` en las dos secuencias, los
ocho ejercicios en `publicado`, y `Examen.estado = PUBLICADO`. El catálogo del
nivel (`lib/catalogo-preparacion.ts`) lo agrupa por número de examen como hoy.
**Retirar** vuelve a `EN_CONSTRUCCION` y despublica sin borrar; las
asignaciones vivas se conservan. **Archivar** lo esconde del taller.

**Asignar a…** desde la ficha: grupo o particular y fecha; crea las
asignaciones de las dos secuencias con lo que ya existe (`asignarA` de
`lib/acciones.ts`), y aparece en Mis clases como tarea con fecha y en la ficha
del alumno con la nota por prueba.

### 6. Fuera de esta entrega

Expresión escrita y oral del examen (siguiente entrega: dos `TareaDeExamen`
más por examen, sin IA, con la entrega y la rúbrica que ya existen). Otros
niveles. Cortar audio sin marca del profesor. Cola de trabajos. Editar desde el
taller un examen sembrado por script (mayo 2015): se queda como está.

## Verificación

- `scripts/verificar-taller.ts` contra la base local: crea un examen, comprueba
  el esqueleto (2 recorridos, 8 pasos, 8 ejercicios con el tamaño del mapa),
  rellena una tarea con una **respuesta de IA grabada en un fixture** (sin
  llamar a la API), comprueba `revisarDatos`, los avisos y la clave oficial por
  `corregir()`, sube un audio de prueba y corta en tres tiempos comprobando que
  salen tres `Archivo` asignados, exige que «Marcar revisada» se niegue con un
  aviso rojo y que «Publicar» se niegue con siete revisadas, y que la
  asignación de prueba no cuente en el listado del profesor. Mutación: quitar la
  guarda de «ocho revisadas» tiene que ponerlo en rojo.
- `verificar-piezas.ts`, `verificar-carcasa.ts` (la herramienta «Taller» con
  ruta real), `verificar-dele.ts`, `verificar-preparacion.ts`, `tsc`, `lint`,
  `build`.
- Una llamada real a Opus 5, a mano, con el examen 2 del libro, tarea por
  tarea, antes de fusionar; se enseña al profesor.
- Barrido por curl con sesión de profesor de las pantallas nuevas, y con sesión
  de estudiante que `/dele/taller` da 404.

## Lo que necesita el profesor

`ANTHROPIC_API_KEY` en Vercel (creada en console.anthropic.com), y las carpetas
de exámenes tal como están.
