# Que la aplicación recomprima el audio al subirlo

Fecha: 2026-08-01

## El problema

Los audios oficiales del DELE no entran. La ruta de subida rechaza cualquier
audio de más de 12 MB (`app/api/archivos/route.ts`), y los MP3 que publica el
Instituto Cervantes pesan 35,7 MB, 24,7, 18,1 y 9,6 — solo el último pasa.

El tope no está mal puesto. Los archivos se guardan **dentro de la base de
datos**, en la columna `Archivo.datos`, y esos cuatro audios son 88 MB para un
solo examen. El problema es que el tope traslada el trabajo al profesor: hoy la
única salida es recomprimir a mano cada archivo antes de subirlo, y eso es una
herramienta de línea de órdenes y un comando que hay que recordar.

Y no hace falta que sea así, porque **esos 88 MB son calidad tirada**. Vienen en
mono a 320 kbps, siete veces más de lo que necesita una voz hablando.
Recomprimidos a 48 kbps son 14 MB, sin diferencia audible.

## Qué construimos

Que la aplicación haga esa recompresión ella sola al recibir el archivo.

El profesor sube el original tal como lo descarga. El tamaño deja de ser algo en
lo que tenga que pensar.

---

## El cambio de significado del tope

Hoy `MAXIMO_AUDIO` significa «lo que guardamos». Pasa a significar **«lo que
aceptamos recibir»**, que es otra cosa: lo que se guarda es siempre el resultado
comprimido, y es mucho más pequeño.

Sube a **100 MB**, que deja pasar con holgura el peor caso conocido (35,7 MB) sin
abrir la puerta a subir una película por error.

El tope de las imágenes no se toca: una foto ya se reduce en el navegador antes
de salir, así que 4 MB solo salta con algo muy raro.

---

## Con qué se comprime: con lo que ya hay en la máquina

`lib/audio.ts` busca un compresor y usa el primero que encuentre:

1. **`afconvert`**, que viene con macOS y está en `/usr/bin/afconvert`.
2. **`ffmpeg`**, si está en el `PATH`.

Si no hay ninguno, la subida se rechaza diciendo qué falta.

### Por qué no un paquete de npm

Lo habitual para esto es `ffmpeg-static`, que trae su propio binario y evita
depender de la máquina. Se descarta por dos razones que suman:

- Son unos 80 MB más en `node_modules`.
- El binario es **GPL-3.0-or-later**. Invocarlo como proceso aparte no contamina
  el código que lo llama —es la lectura habitual, y no es un dictamen legal—,
  pero es una pregunta que no hay por qué cargar hoy.

Y sobre todo: **es una dependencia para una máquina de producción que todavía no
existe.** El proyecto corre en el portátil del profesor, donde `afconvert` ya
está. El día que se despliegue en Linux, instalar `ffmpeg` en ese servidor es una
línea de configuración, y `lib/audio.ts` lo encontrará sin cambiar nada.

### A qué se comprime

**AAC de 48 kbps en mono, en un contenedor `.m4a`** (`audio/mp4`).

Es lo que ya recomendaba el comentario que hay hoy en la ruta, lo reproducen
todos los navegadores, y es lo que baja la Tarea 1 de 35,7 MB a 5,8.

Mono y no estéreo porque el material es voz, y las grabaciones del Cervantes ya
vienen en mono.

---

## Las tres decisiones que evitan sorpresas

### Si el resultado sale más grande, se guarda el original

Pasa con un audio ya comprimido: recomprimirlo solo lo empeora. La regla es
«guardar el más pequeño de los dos», que además hace la operación segura de
repetir.

### Si no hay con qué comprimir, se rechaza

No se guarda callando un archivo de 36 MB. El mensaje dice qué falta y cómo se
arregla. **Fallar ruidosamente es lo único que evita descubrirlo cuando ya hay
cincuenta audios dentro de la base.**

### El profesor tiene que ver que está pasando algo

Comprimir quince minutos de audio tarda varios segundos. `subir-audio.tsx` ya
enseña un estado mientras sube; ese estado pasa a decir también que está
comprimiendo, o la pantalla parece colgada.

---

## Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `lib/audio.ts` | **Crear.** Encontrar el compresor y comprimir. **Fuera de las acciones.** |
| `app/api/archivos/route.ts` | **Modificar.** Subir el tope y comprimir antes de guardar. |
| `components/recursos/subir-audio.tsx` | **Modificar.** Decir que está comprimiendo. |
| `scripts/verificar-audio.ts` | **Crear.** El compresor contra archivos de verdad. |

`lib/audio.ts` va fuera de las acciones por el motivo ya establecido en el
proyecto: una acción de servidor necesita sesión y contexto de petición, así que
no se puede llamar desde un script. Lo que está fuera es lo único verificable.

**No importa `prisma` ni nada del navegador**: recibe unos bytes y devuelve otros.

---

## Verificación

`npx tsc --noEmit`, `npm run lint` y un script nuevo.

**`scripts/verificar-audio.ts`** fabrica su propio audio y comprueba contra él.

**El audio de prueba se genera escribiendo un WAV a mano**, con su cabecera y
unas muestras de una onda sencilla: son unas veinte líneas y no hace falta traer
ningún archivo al repositorio. No se genera con el compresor, que es lo primero
que uno piensa: `afconvert` **solo convierte, no sintetiza**, así que en la
máquina del profesor —que no tiene `ffmpeg`— esa vía no existe. Un WAV escrito a
mano funciona con cualquiera de los dos compresores, y además es el formato más
grande posible, que es justo lo que conviene para comprobar que comprimir reduce.

Comprueba:

- que comprimir devuelve algo más pequeño que la entrada;
- que lo devuelto es audio de verdad y no bytes cualesquiera: se vuelve a leer
  con el compresor y tiene la duración que debía;
- que un archivo que no es audio se rechaza con un error claro, en vez de
  guardarse;
- que un archivo ya pequeño y comprimido **no crece**: se conserva el original.

**A mano**, que es lo que un script no ve: subir el MP3 real de la Tarea 1 del
A2/B1 escolar desde el editor de Recursos, comprobar que la subida termina, que
lo guardado ronda los 6 MB y no los 36, y que el audio suena en la página del
estudiante.

---

## Fuera de alcance

- **Comprimir fuera de la petición.** Hoy se comprime mientras se sube. En una
  máquina con límite de tiempo por petición eso no sirve, y habría que hacerlo en
  segundo plano con un estado «procesando». No hay tal máquina todavía; queda
  anotado.
- **Servir por trozos (HTTP Range).** `/api/archivos/[id]` manda el archivo
  entero, así que el navegador no puede saltar a un minuto concreto sin
  descargarlo todo. Con audios de 6 MB es tolerable, y además encaja con que el
  examen no deja rebobinar. Con audios más largos habrá que revisarlo.
- **Sacar los archivos de la base de datos.** Es el arreglo de fondo del tamaño,
  y va contra una decisión ya tomada a propósito: viven dentro para que viajen
  con la copia de seguridad y no dependan de ningún servicio externo. Esta
  recompresión hace que esa decisión aguante bastante más.
- **Recomprimir lo ya guardado.** Solo afecta a lo que se suba a partir de ahora.
  En la base de desarrollo hay hoy siete audios que suman 2,5 MB —una media de
  350 KB cada uno—, así que no hay nada que apremie: son pequeños precisamente
  porque el tope de 12 MB obligaba a que lo fueran. Si algún día hiciera falta,
  un script que los pase por `lib/audio.ts` es media hora.
