# El audio, en Vercel

Fecha: 2026-08-04

## El problema

La aplicación se despliega en `hispaprofe.vercel.app`, y ahí el audio no
funciona. Ninguna de las tres partes: ni subirlo, ni comprimirlo, ni oírlo.

Son tres límites distintos de la plataforma, y conviene no confundirlos porque
cada uno se arregla de otra manera:

1. **No hay compresor.** El runtime de Vercel no trae `afconvert` —es de
   macOS— ni `ffmpeg`. `lib/audio.ts` no encuentra ninguno de los dos, y toda
   subida de audio muere con el `CompresorAusenteError` que este mismo
   proyecto puso ahí para que fallara ruidosamente. Falla ruidosamente, sí:
   con un 500 en cada entrega de una oral grabada.
2. **4,5 MB de tope en el cuerpo de la petición.** Es un tope de plataforma, no
   nuestro: lo aplica Vercel antes de que corra el manejador de la ruta. Los
   `100 * 1024 * 1024` de `proxyClientMaxBodySize` en `next.config.ts` no
   significan nada allí, y el MP3 de 35,7 MB del Cervantes rebota con un 413
   que nuestro código no llega a ver.
3. **4,5 MB de tope también en la respuesta**, pero solo cuando el cuerpo se
   construye entero antes de mandarlo. `app/api/archivos/[id]/route.ts` lo
   construye entero —`new Response(new Uint8Array(...))`—, así que un m4a de
   6 MB no se puede oír aunque estuviera guardado.

## El principio que ordena el arreglo

**El tope de 4,5 MB solo existe en el tramo navegador → función.** Ni las
respuestas en streaming lo tienen, ni lo tienen las descargas que hace el
servidor por su cuenta.

De ahí sale todo lo demás: el arreglo consiste en **sacar los bytes grandes de
ese único tramo**, y no en cambiar dónde se guardan. Los archivos siguen dentro
de `Archivo.datos`, con sus mismos topes y su mismo `privado`. Ni Vercel Blob,
ni servicio nuevo, ni migración, ni tocar `puedeOirse`.

---

## 1. Servir: el cuerpo pasa a ser un flujo

`app/api/archivos/[id]/route.ts` devuelve el cuerpo como `ReadableStream` en
sus tres salidas —el archivo entero, el trozo del 206 y el 416— en vez de un
`Uint8Array` ya formado.

No se toca nada más de esa ruta: ni los permisos, ni `interpretarRango`, ni las
cabeceras de caché, ni el `Vary: Range`. Es solo la forma del cuerpo.

Los rangos se quedan, y no porque hagan falta para el tope: hacen falta porque
un `<audio>` de WebKit no arranca sin ellos, que es por lo que se escribieron.

---

## 2. La grabación del alumno: que quepa por debajo del tope

Aquí no hay rodeo posible. La grabación es una entrega evaluable: tiene que
entrar por la aplicación, con su `Archivo.privado`, su `puedeOirse` y su estado
de entregado. Sacarla a un formulario de Google sería perder las tres cosas, y
además son voces de menores. Así que lo que se cambia es el tamaño.

### El caudal de la grabadora

`components/expresion/grabadora.tsx` construye hoy el `MediaRecorder` sin
`audioBitsPerSecond`. Chrome graba entonces a unos 128 kbps, y **los quince
minutos que la propia grabadora permite son 14 MB**: un 413 seguro.

Se fija un caudal de **32 kbps**, y se le pide al micrófono un solo canal
(`channelCount: 1`), que es lo que un micro de portátil da casi siempre pero no
siempre. Es opus, y para una voz hablando 32 kbps es de sobra —el material del
Cervantes se comprime a 48 y ya se consideró calidad suficiente para un examen
de comprensión—.

La cuenta: quince minutos a 32 kbps son **3,6 MB**, contra los 4 MB del tope. El
margen es de 400 KB, y hay que decirlo en vez de fingir que sobra: es un caudal
medio, no un techo, y un opus con mucho ruido de fondo puede pasarse un poco.
Por eso el tope no desaparece —lo caza y lo explica— y por eso el compresor
sigue corriendo detrás: una grabación que llegue justa se guarda aún más
pequeña.

Es además el arreglo más barato de los tres: una opción en el constructor.

### Los topes dicen la verdad

`MAXIMO_AUDIO_RECIBIDO` (hoy 50 MB) en `lib/expresion.ts` y su copia a mano
`MAXIMO_ARCHIVO` en la grabadora bajan a **4 MB**.

No es prudencia: es que por encima de 4,5 MB Vercel corta antes de que nuestro
código llegue a opinar. Un tope de 50 MB que en realidad son 4,5 es un tope que
miente, y quien se choque con él verá un error mudo de la plataforma en vez del
mensaje que este proyecto se ha molestado en escribir. Cuatro megas, y el aviso
explica qué hacer.

Las dos constantes se mueven juntas, como ya avisa el comentario que las
enlaza.

---

## 3. El material del profesor: que lo traiga el servidor

Los MP3 del Cervantes no van a caber nunca por el navegador. Pero el servidor
sí puede ir a buscarlos: **una función que descarga un archivo de una dirección
no tiene tope ninguno.**

### La segunda entrada de `/api/archivos`

La ruta aprende a recibir `{ url }` en JSON, además del `multipart` de hoy. Con
ella se descarga el archivo, lo comprime y lo guarda exactamente igual que si
lo hubieran subido: mismo `comprimirAudio`, mismos topes de guardado, misma
fila en `Archivo`.

El alumno acaba oyendo el audio **desde hispaprofe**, no desde Drive. Eso no es
un detalle de implementación: significa que la clase sigue funcionando si el
archivo se mueve de carpeta, se descomparte o se borra.

### `lib/enlaces.ts`, que traduce y que dice que no

Un módulo nuevo, con dos responsabilidades y ninguna dependencia de Prisma ni
del navegador —el mismo criterio por el que `lib/audio.ts` vive fuera de las
acciones: lo que está fuera es lo único que un script puede verificar—.

**Traducir.** El enlace que Drive te da al compartir
(`https://drive.google.com/file/d/ID/view?usp=sharing`) es una página web, no
un audio: `<audio src>` no lo reproduce y una descarga directa se trae HTML. Se
convierte a su dirección directa de descarga. Para archivos grandes Drive
interpone además una pantalla de confirmación de antivirus, que hay que
atravesar en vez de guardar su HTML creyendo que es un MP3.

**Decir que no.** Le estamos pidiendo al servidor que haga una petición a una
dirección escrita por una persona. Aunque esa persona sea profesor —la ruta ya
exige `PROFESOR` o `ADMIN`—, esa puerta se cierra desde el primer día: solo
`http` y `https`, y nada de `localhost`, direcciones internas ni el servicio de
metadatos de la nube. Que hoy no haya nada interesante detrás de esa puerta no
es motivo para dejarla abierta.

**Y no fiarse de lo que llega.** El tipo declarado por un servidor ajeno no
manda: se comprueba contra `TIPOS_AUDIO` como cualquier subida, y se corta la
descarga si pasa del tope de recepción en vez de leer en memoria lo que el otro
lado quiera mandar.

### En la pantalla

`components/recursos/subir-audio.tsx` ya tiene el campo de «…o pegar una
dirección», que hoy guarda el enlace crudo. Gana un botón para traérselo, que
es lo que llama a la ruta nueva.

El botón de «Subir un archivo» se queda: para lo pequeño sigue siendo el camino
corto. Lo que gana es un mensaje honesto cuando el archivo no cabe, que diga
qué hacer —súbelo a Drive y pega el enlace— en vez de dejar caer un 413.

---

## 4. Comprimir: se revierte la decisión sobre `ffmpeg-static`

El diseño del 1 de agosto descartó `ffmpeg-static` a conciencia, y hay que
decir por qué se revierte.

Aquel documento daba dos razones y una condición. Las razones: 80 MB en
`node_modules`, y que el binario es GPL-3.0-or-later. La condición era la de
fondo: *«es una dependencia para una máquina de producción que todavía no
existe. El día que se despliegue en Linux, instalar `ffmpeg` en ese servidor es
una línea de configuración»*.

La máquina ya existe, y **la condición resultó ser falsa para esta máquina en
concreto**: en Vercel no hay servidor donde instalar nada. El runtime viene
dado. O el binario viaja dentro del despliegue o no hay compresor.

Sobre la licencia: el binario se ejecuta como proceso aparte —que es la lectura
habitual de por qué no contamina a quien lo invoca— y, sobre todo, **no se
distribuye**. Corre en nuestro servidor; a ningún alumno le llega una copia. La
GPLv3 no tiene cláusula de uso en red, que es justo lo que la distingue de la
AGPL. La obligación no se dispara.

Sobre los 80 MB: pasan de ser peso en el portátil a peso en el paquete de la
función, que tiene un tope de 250 MB. Cabe, pero es lo bastante justo como para
comprobarlo en vez de suponerlo.

### Cómo entra

- `ffmpeg-static` como dependencia, y un **tercer candidato** en la lista
  `COMPRESORES` de `lib/audio.ts`, cuyo `orden` es la ruta que el paquete
  exporta.
- El orden de la lista no cambia de espíritu: `afconvert` sigue primero porque
  en el Mac del profesor gana y en Vercel simplemente no está; `ffmpeg` del
  `PATH` después; el empaquetado el último, que es el que solo hace falta
  cuando no hay ninguno de los otros dos. La lista ya era «intentos sobre el
  mismo archivo» y no «repuestos para máquinas distintas», así que el que
  sobra no estorba: cuesta un `spawn` la primera vez y se recuerda.
- `next.config.ts` gana `outputFileTracingIncludes` para que el binario viaje
  dentro de la función, y `serverExternalPackages` para que el empaquetador no
  intente meterlo en el `bundle` como si fuera código.
- Las dos rutas de audio declaran `maxDuration`, para que comprimir tenga
  tiempo antes de que la función se corte.
- El `proxyClientMaxBodySize` de 100 MB se queda: en local es real, y en Vercel
  es inofensivo. Lo que se corrige es el comentario, que hoy promete algo que
  en producción no se cumple.

---

## Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `lib/enlaces.ts` | **Crear.** Traducir un enlace a su dirección directa y rechazar las que no se pueden pedir. |
| `lib/audio.ts` | **Modificar.** El tercer compresor, el empaquetado. |
| `app/api/archivos/[id]/route.ts` | **Modificar.** El cuerpo, en flujo. |
| `app/api/archivos/route.ts` | **Modificar.** La entrada por dirección, y `maxDuration`. |
| `app/api/entregas/audio/route.ts` | **Modificar.** `maxDuration` y el tope nuevo. |
| `lib/expresion.ts` | **Modificar.** `MAXIMO_AUDIO_RECIBIDO` a 4 MB. |
| `components/expresion/grabadora.tsx` | **Modificar.** El caudal de la grabadora y su copia del tope. |
| `components/recursos/subir-audio.tsx` | **Modificar.** Traer de una dirección, y el aviso del archivo grande. |
| `next.config.ts` | **Modificar.** El binario dentro de la función. |
| `scripts/verificar-enlaces.ts` | **Crear.** El módulo de enlaces, contra casos de verdad. |
| `scripts/verificar-audio.ts` | **Modificar.** Que el compresor empaquetado cuenta. |

---

## Verificación

`npx tsc --noEmit`, `npm run lint` y los scripts.

**`scripts/verificar-enlaces.ts`** comprueba, sin salir a la red:

- que un enlace de Drive de compartir se traduce a su dirección de descarga;
- que una dirección que ya es directa se deja como está;
- que `localhost`, `127.0.0.1`, una IP privada y el servicio de metadatos de la
  nube se rechazan, y que se rechazan por lo que son y no por el texto del
  mensaje;
- que un esquema que no es `http` ni `https` —`file:`, `data:`— se rechaza.

**`scripts/verificar-audio.ts`** ya existe y ya comprueba lo suyo. Se le añade
que la lista de compresores instalados incluya el empaquetado, que es lo que
distingue «hay ffmpeg en esta máquina por casualidad» de «lo llevamos puesto».

**A mano**, que es lo que ningún script ve, y que en este cambio es la mitad del
trabajo porque el fallo está en la plataforma y no en el código:

1. Sobre el despliegue de vista previa, pegar el enlace de Drive del MP3 real
   de la Tarea 1 del A2/B1 escolar, y comprobar que se trae, se comprime a unos
   6 MB y suena en la página del estudiante.
2. Oír ese mismo audio de 6 MB desde un iPhone, que es quien pide rangos.
3. Grabar una oral de más de diez minutos desde el navegador y entregarla;
   comprobar que pesa lo que debe y que la oye el profesor y no otro alumno.
4. Comprobar en el registro de Vercel que el compresor que se usó es el
   empaquetado, y que el paquete de la función no se pasó de 250 MB.

---

## Fuera de alcance

- **Vercel Blob y sacar los archivos de la base.** Es el arreglo de fondo si
  algún día hay que subir por el navegador algo que no quepa en 4,5 MB. Hoy no
  hace falta: lo grande entra por dirección y lo pequeño por el formulario.
  Sigue en pie la decisión de que los archivos vivan dentro de la base para que
  viajen con la copia de seguridad.
- **Comprimir fuera de la petición.** Lo anotó el diseño anterior como
  pendiente para «una máquina con límite de tiempo por petición», y esta lo es.
  El límite resultó ser de 300 segundos y comprimir quince minutos tarda unos
  segundos, así que cabe de sobra. Queda anotado otra vez, no resuelto.
- **Usar el OAuth de Google que ya hay.** El proyecto tiene tokens de Classroom
  cifrados, y con un permiso más podría leer archivos privados de Drive sin que
  el profesor los comparta. Es una pantalla de permisos nueva y un ámbito más
  para resolver algo que hoy resuelve compartir el archivo con enlace.
- **Recomprimir lo ya guardado**, y **la rama `pegar-por-codigo`**, que está a
  medias y no entra en este despliegue.
