/**
 * Lo que se sabe de un bloque sin preguntarle a la base.
 *
 * **Sin nada de servidor a propósito**: lo importan `page.tsx` (servidor),
 * `editor-bloques.tsx` y `bloque-editable.tsx` (cliente). Nada de `prisma`, ni
 * de `node:crypto`, ni de `lib/audio.ts` o `lib/enlaces.ts`, que arrastran
 * `ffmpeg-static`.
 */

/**
 * El id del archivo de Drive que hay en lo que se ha pegado, o cadena vacía.
 *
 * Reconoce las tres formas que se pegan de verdad, y la primera es la que se
 * copia de la barra del navegador. Vivía dentro de `editor-bloques.tsx`; se
 * mueve aquí porque ahora también la necesita el portero, que es de servidor.
 *
 * La tercera forma —`?id=` suelto— es la que produce `urlDirectaMedia` al
 * reescribir lo que se pega en el editor, así que es la que de verdad llega
 * a `crearBloque`. Por eso exige que la dirección sea de `drive.google.com`:
 * sin esa condición, cualquier CDN ajeno con un `id=` largo en la query se
 * confundiría con Drive y el portero lo rechazaría por un motivo falso.
 */
export function idDrive(entrada: string): string {
  const deLaVista = entrada.match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1];
  if (deLaVista) return deLaVista;

  const deAbrir = entrada.match(/drive\.google\.com\/open\?id=([\w-]+)/)?.[1];
  if (deAbrir) return deAbrir;

  const suelta = entrada.includes("drive.google.com")
    ? entrada.match(/[?&]id=([\w-]{20,})/)?.[1]
    : undefined;
  return suelta ?? "";
}

/**
 * Si esa dirección es un audio de Drive **ya convertido** en reproductor
 * incrustable.
 *
 * Vivía dentro de `page.tsx`, que la usa para darle al iframe la altura de un
 * reproductor en vez de la de un vídeo. Ahora también la necesita
 * `bloque-editable.tsx` para marcar el bloque que no cuenta escuchas.
 *
 * **No sirve de portero, y confundirla con `idDrive` es el error que hay que
 * evitar**: solo reconoce la forma ya convertida, así que un portero montado
 * sobre esto dejaría pasar justo lo que llega del navegador.
 *
 * Hereda una imprecisión a propósito: un **vídeo** de Drive incrustado también
 * acaba en `/preview` y también encaja. Por eso el aviso que cuelga de ella
 * habla de «contenido incrustado» y no de escuchas. Afinarlo pediría una
 * columna, y no está pagada.
 */
export function esAudioDeDrive(url: string | null): boolean {
  return Boolean(url && url.includes("drive.google.com") && url.endsWith("/preview"));
}

/**
 * El motivo por el que este bloque no se puede guardar, o null.
 *
 * Un audio de Drive no se puede racionar: su reproductor vive en un iframe de
 * otro dominio, así que no hay forma de contar cuándo suena ni de impedir que
 * vuelva a sonar. Y `maximoDeEscucha` solo raciona los bloques `AUDIO`. Si el
 * audio de una prueba entra por ahí, el tope de una escucha que el examen exige
 * deja de existir sin que nada avise.
 *
 * La salida es traerlo: `SubirAudio` lo descarga y devuelve una dirección
 * `/api/archivos/<id>`, con los bytes dentro, que sí se raciona.
 *
 * **Estrecho a propósito.** Un `EMBED` de Drive puede ser un vídeo y tiene que
 * seguir entrando; una dirección directa que no sea de Drive en un `AUDIO`
 * también, porque esa suena y se raciona.
 *
 * Vive aquí y no dentro de las acciones por lo de siempre en este proyecto:
 * `lib/acciones.ts` es `"use server"`, así que todo lo que exporta es un
 * endpoint público y un script no puede ejercitarlo sin sesión.
 */
export function motivoSiAudioDeDrive(tipo: string, url: string | null): string | null {
  if (tipo !== "AUDIO" || !url) return null;
  if (idDrive(url) === "" && !esAudioDeDrive(url)) return null;
  return (
    "Un audio de Drive no se puede racionar: su reproductor va incrustado y la " +
    "aplicación no puede contar las escuchas. Pega la dirección en «Audio» y " +
    "pulsa el botón de traerlo: el servidor lo descarga y lo guarda dentro."
  );
}
