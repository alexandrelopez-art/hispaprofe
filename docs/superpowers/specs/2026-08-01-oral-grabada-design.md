# La oral grabada: el alumno habla y te la manda

> Diseño D. Sigue a Recursos, al Creador DELE y a Expresión, los tres ya en `main`.

## El problema

La expresión oral que construimos en el diseño C da por hecho **una sola forma de
examinarse**: el alumno habla contigo delante. Por eso lo único que ofrece es
citarla en una clase ya agendada y corregirla ahí, con el alumno enfrente.

Pero de las dos orales del examen, una no necesita que estéis los dos a la vez.
Un monólogo preparado se graba, se manda y se corrige después. Hoy esa tarea no
tiene sitio en HispaProfe: o la citas en una clase que no hace falta, o se queda
fuera de la aplicación.

## Qué construimos

Una segunda forma de la tarea oral: **la graba dentro de la aplicación y te la
manda**. Se corrige con la misma rúbrica, en la misma bandeja y con el mismo
botón que la escrita. Lo único que cambia es que donde había un texto hay una
grabación.

Las dos formas conviven. Al crear la tarea eliges cuál es, y esa elección es lo
único que se añade al editor.

## El alcance

Dentro:

- Un interruptor en la tarea oral: **en clase** o **grabada**.
- Un grabador en la pantalla del alumno, con escucha previa y repetición.
- La grabación entra en la bandeja de entregas y se corrige con la rúbrica.
- Las grabaciones de los alumnos dejan de servirse a quien tenga el enlace.

Fuera, y a propósito:

- **Respuesta modelo en audio.** El modelo sigue siendo texto. Grabarlo sería otro
  grabador en el editor y trabajo del profesor por cada tarea.
- **Tiempo de preparación.** La consigna está en pantalla el rato que haga falta;
  un cronómetro antes de hablar no añade nada.
- **Borradores de audio.** Lo que no se entrega, no se guarda. Guardar una
  grabación a medias en el navegador es otra funcionalidad entera.
- **Transcripción o corrección automática del audio.** La corrige el profesor,
  igual que la escrita.
- **Citar una grabada.** No hay nada que agendar: se entrega cuando el alumno
  quiera, hasta que se corrija.

---

## Los datos

Una sola migración, con un cambio.

### `Archivo` gana `privado`

```prisma
  /// Una entrega de un alumno, no material del profesor. Se sirve solo a
  /// su autor, a su profesor y al administrador, y no se cachea en público.
  privado Boolean @default(false)
```

Nada más. **La grabación no necesita columna propia**: viaja donde ya viaja lo
que el alumno manda.

### `PasoCompletado.entrega` no cambia

Esa columna significa, desde el diseño C, «lo que el alumno mandó en este paso».
En una escrita es su texto; en una grabada es la dirección de su audio
(`/api/archivos/<id>`). Cómo se lee lo decide la tarea, que es quien sabe de qué
modalidad es.

Reutilizarla no es un atajo, es lo que hace que todo lo demás siga funcionando
sin enterarse: la bandeja ya filtra por `entrega: { not: null }`, la red que
impide desmarcar una entrega ya mira esa columna, y la corrección ya escribe
`puntos` y `verificadoEl` al lado.

**No se indexa `entrega`.** Es una columna de texto que en una escrita guarda
redacciones enteras, y un índice btree de Postgres revienta pasados unos 2.700
bytes: indexarla rompería la entrega de un texto largo el día que alguien
escriba de más.

---

## La forma de la tarea

`expresionSchema` gana un campo, opcional y con valor por defecto:

```ts
  /** Solo en las orales: si el alumno la graba en vez de hacerla en clase. */
  grabada: z.boolean().default(false),
```

Con dos reglas, las dos con mensaje en castellano:

- `grabada: true` **solo** con `modalidad: "oral"`. En una escrita no significa
  nada, y aceptarlo callando dejaría tareas que dicen dos cosas a la vez.
- El valor por defecto es `false`, así que **las orales que ya existen siguen
  siendo de clase**, que es lo que eran cuando se crearon. Ninguna fila guardada
  necesita tocarse.

`grabada` viaja a la versión pública: no es un secreto, y el alumno necesita
saberlo para que su paso le enseñe un grabador y no una línea de texto.

---

## La entrega

### Una sola puerta: `POST /api/entregas/audio`

El audio no se sube por un lado y se entrega por otro: **subir y entregar son el
mismo acto**, y por eso son la misma petición. Recibe el `pasoId` y el archivo, y
por ese orden:

1. Comprueba la sesión y que ese alumno tiene ese recorrido asignado.
2. Comprueba, con las reglas que ya existen en `lib/expresion.ts`, que ese paso
   pide una **oral grabada** y que todavía no está corregida.
3. Comprueba el tipo y el tamaño de lo recibido.
4. Comprime con `comprimirAudio`, que es el mismo compresor de siempre.
5. Guarda el `Archivo` con `privado: true`.
6. Escribe la dirección en `PasoCompletado.entrega`.

Una puerta, una comprobación, y **ningún archivo huérfano**: no existe el estado
«subido pero sin entregar».

No es una acción de servidor porque el cuerpo de una acción viene limitado a un
megabyte por defecto, y una grabación de tres minutos lo pasa. La ruta de `/api`
ya tiene resuelto ese camino en `next.config.ts`.

### Los topes

| Qué | Cuánto | Por qué |
|---|---|---|
| Duración recomendada | los `minutos` de la tarea | Avisa y deja entregar, como el contador de palabras |
| Duración máxima | 15 minutos | La corta el grabador. Un alumno normal no la ve nunca |
| Recibido | 50 MB | Deja pasar un archivo del móvil sin abrir la puerta a una película |
| Guardado | 10 MB | Quince minutos comprimidos rondan los 5 MB |

El tope duro lo pone el grabador, que se para solo, y el servidor lo respalda por
tamaño: medir la duración exacta en el servidor obligaría a interrogar al archivo
antes de comprimirlo, y el tamaño ya acota lo que importa.

Los formatos que genera un navegador al grabar —`audio/webm` en Chrome y Firefox,
`audio/mp4` en Safari— ya están en la lista que `/api/archivos` acepta, y el
compresor los convierte a `.m4a` como a todo lo demás.

---

## Quién puede oír una grabación

Hoy `GET /api/archivos/<id>` **no comprueba la sesión**: sirve el archivo a
cualquiera que tenga la dirección, con el argumento de que el identificador es un
cuid imposible de adivinar y de que lo que hay dentro es material del profesor.

Para la voz de un alumno eso no vale. Un archivo con `privado: true` se sirve
solo a tres:

- **su autor**, que es quien lo grabó;
- **el profesor de la asignación** en la que está entregado;
- **un administrador**, como en todas las pantallas de `profe/`.

Al profesor se le reconoce por donde está la entrega: la fila de `PasoCompletado`
cuya `entrega` es esa dirección cuelga de una asignación, y esa asignación tiene
profesor. Es la misma comprobación que `esDeEsteProfesor` hace en el resto del
diseño C.

La decisión vive en `lib/expresion.ts`, en una función `puedeOirse(archivoId,
usuario)`, y no dentro de la ruta: fuera es donde el script de verificación puede
ejercitarla con un alumno, otro alumno, su profesor, otro profesor y un
administrador. La ruta solo pregunta y sirve o niega.

Y la cabecera de caché deja de ser `public`: un archivo privado se marca
`private, no-store`, para que no se quede guardado en ninguna caché intermedia.
Los archivos que no son privados —imágenes y audios de los ejercicios— se
comportan exactamente como hoy.

---

## Las pantallas

### El editor, en Recursos

En la tarea oral, una elección: **«En clase, contigo delante»** o **«La graba y
te la manda»**. Nada más. Consigna, estímulo, minutos, criterios y texto modelo
son idénticos en las dos.

### El alumno, en su paso

Donde la escrita tiene un recuadro de texto, la grabada tiene:

- **Grabar** / **Parar**, con el tiempo corriendo a la vista.
- Un reproductor para escucharse antes de mandar nada.
- **Repetir**, que tira lo grabado y vuelve a empezar.
- **Entregar**.

Si se pasa de los minutos de la tarea, un aviso que no bloquea, con las mismas
palabras que el contador de palabras de la escrita: puedes entregarlo igual, pero
cuenta para la nota.

Después de entregar: su grabación con el reproductor, la fecha, y la posibilidad
de **volver a grabar** hasta que la corrijas. Después de eso, no.

Y como en la escrita, **el paso no enseña el botón de marcar hecho**: entregar es
lo que lo marca.

### `/profe/entregas`

La grabada entra en la misma lista. La fila dice que es una grabación en vez de
enseñar el principio de un texto; el resto —alumno, tarea, fecha— igual.

### La pantalla de corrección

Donde la escrita enseña «Lo que escribió», la grabada enseña un reproductor.
Debajo, la misma rúbrica, el mismo comentario y el mismo botón.

### La ficha del alumno

La regla de qué se pinta en la fila de cada paso se amplía sin cambiar de forma:

- **Oral en clase** → la rúbrica: en línea si no hay registro, el enlace si lo hay.
- **Oral grabada** → exactamente como la escrita: el enlace si hay entrega, y el
  campo de puntos a mano si no la hay.
- **Escrita** → como está.

Y **el bloque de citar solo sale en las orales de clase**. Una grabada no se
agenda.

---

## Las reglas

Todas viven en `lib/expresion.ts`, fuera de las acciones, para que el script las
pueda ejercitar:

1. **Se entrega audio solo donde se pide audio.** Un `pasoId` de otra cosa no
   consigue guardar una grabación, igual que ya pasa con el texto.
2. **Se entrega texto solo donde se pide texto.** Una oral grabada no admite una
   entrega escrita.
3. **Puede regrabar hasta que se corrija, y ni una vez más.** La misma regla, la
   misma frase y el mismo sitio que la escrita.
4. **Una grabada no se puede valorar sin entrega.** Como la escrita, y por lo
   mismo: no se puntúa lo que no se ha oído.
5. **Una oral de clase sigue sin admitir entrega**, y sigue pudiéndose valorar sin
   ella: se corrige con el alumno delante.
6. **Una grabada no se cita.** `puedeCitarse` la rechaza con su motivo, y el
   desplegable de clases no se pinta.

---

## Los bordes

- **Permiso de micrófono denegado, o micrófono ausente.** Una línea que explica
  qué pasa y **el rodeo**: subir un archivo de audio grabado por fuera. Es la
  única puerta de repuesto, y es barata porque la tubería ya existe.
- **Navegador que no sabe grabar.** Mismo rodeo, decidido preguntando por
  `MediaRecorder` antes de pintar el botón.
- **Se corta la conexión al entregar.** Lo grabado sigue en la página, con su
  reproductor y su botón, hasta que se entregue bien. No se guarda nada a medias
  en el servidor: media grabación en la bandeja es peor que ninguna.
- **Se recarga la página sin entregar.** Se pierde, y la pantalla lo dice antes de
  que pase.
- **El compresor no está instalado.** Es culpa del servidor, no del alumno: el
  mensaje lo dice y el error sale como 500, igual que ya hace `/api/archivos`.

---

## Verificación

Sin framework de tests, como el resto del proyecto.

`scripts/verificar-oral-grabada.ts`, con afirmaciones que **discriminen en los dos
extremos**:

- Se entrega donde se pide audio; no se entrega donde se pide texto ni donde no
  hay ejercicio.
- Se puede volver a grabar antes de corregir; no después.
- Una grabada sin entrega no se valora; una de clase sin entrega sí.
- Una grabada no se cita; una de clase sí.
- Un archivo privado se le sirve a su autor y a su profesor, y **no** a otro
  alumno ni a otro profesor.

Más `npx tsc --noEmit` y `npm run lint`.

Lo que ningún script puede comprobar es el grabador: el permiso del micrófono, la
escucha previa y la repetición se prueban a mano, con un micrófono de verdad.
