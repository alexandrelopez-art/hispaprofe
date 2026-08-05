import { comprimirAudio, CompresorAusenteError, tipoBase, TIPOS_AUDIO } from "@/lib/audio";
import { EnlaceInvalidoError, traerAudio } from "@/lib/enlaces";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

/**
 * Comprimir quince minutos de audio tarda unos segundos, pero traerse un MP3
 * de 36 MB de una dirección ajena puede tardar bastante más. Cinco minutos es
 * el máximo del plan que hay, y de sobra para las dos cosas.
 */
export const maxDuration = 300;

// Tope tras redimensionar en el navegador. Una foto de 4000 px comprimida
// a WebP baja de 400 KB, así que 4 MB solo salta con algo muy raro.
const MAXIMO_IMAGEN = 4 * 1024 * 1024;

// Lo que aceptamos recibir **por el formulario**, o sea desde el navegador.
// Cuatro megas, y el número no es nuestro: en Vercel el cuerpo de una petición
// no puede pasar de 4,5 MB y lo corta la plataforma antes de que este
// manejador llegue a opinar. Prometer más sería mentir.
const MAXIMO_SUBIDA = 4 * 1024 * 1024;

// Lo que aceptamos recibir **por dirección**, que es otra cosa: aquí quien
// descarga es el servidor, y ese tramo no tiene tope de plataforma. Cien megas
// dejan pasar de sobra el peor caso conocido —los 35,7 MB de la tarea 1 del
// A2/B1 escolar— sin abrir la puerta a traerse una película.
const MAXIMO_TRAIDO = 100 * 1024 * 1024;

// Lo que aceptamos **guardar**, distinto de lo que aceptamos recibir. La
// regla es "guardar el más pequeño de los dos", pero si el compresor no logra
// encoger nada —un audio ya comprimido a tope, o mal identificado como
// audio— esa regla por sí sola dejaría pasar hasta el tope de recepción
// entero a la columna `Archivo.datos`. Veinte megas dejan pasar con holgura
// el resultado esperado (la tarea 1 del Cervantes comprime a unos 5-6 MB) sin
// abrir la puerta a que un caso raro cuele el original casi intacto.
const MAXIMO_AUDIO_GUARDADO = 20 * 1024 * 1024;

const IMAGENES = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];

/**
 * Comprimir, comprobar el tope de guardado y escribir la fila. Es el tramo
 * final común: da igual si los bytes llegaron por el formulario o si los trajo
 * el servidor de una dirección, a partir de aquí pasa lo mismo.
 *
 * Devuelve la respuesta ya montada, de acierto o de error, porque los tres
 * errores posibles se distinguen aquí dentro y no fuera.
 */
async function comprimirYGuardar(
  recibido: Buffer<ArrayBuffer>,
  nombreOriginal: string,
  tipoRecibido: string,
  usuarioId: string,
): Promise<Response> {
  // El recorte va antes de que `comprimirAudio` pueda añadirle `.m4a` al
  // nombre: recortar después se comía justo esa extensión con un nombre de más
  // de 200 caracteres. Se reserva sitio para la extensión más larga que puede
  // añadirse (".m4a", 4 caracteres).
  const nombreMaximo = 200;
  const margenExtension = 4;
  let nombre =
    nombreOriginal.length > nombreMaximo
      ? nombreOriginal.slice(0, nombreMaximo - margenExtension)
      : nombreOriginal;

  let datos = recibido;
  let tipo = tipoRecibido;
  try {
    ({ datos, tipo, nombre } = await comprimirAudio(recibido, nombre, tipoRecibido));
  } catch (e) {
    if (e instanceof CompresorAusenteError) {
      // Culpa del servidor, no del profesor ni de su archivo. Un 400 lo
      // disfrazaría de «tu archivo está mal» y nadie miraría el servidor.
      return Response.json({ error: e.message }, { status: 500 });
    }
    // Aquí sí es cosa del archivo: no es audio, o está dañado. Se rechaza en
    // vez de guardar el original de 36 MB callando.
    return Response.json(
      { error: e instanceof Error ? e.message : "No se pudo comprimir el audio." },
      { status: 400 },
    );
  }

  if (datos.length > MAXIMO_AUDIO_GUARDADO) {
    return Response.json(
      {
        error:
          "El audio comprimido sigue pesando demasiado. Prueba con un " +
          "archivo más corto o ya comprimido de otra forma.",
      },
      { status: 400 },
    );
  }

  const guardado = await prisma.archivo.create({
    data: { nombre, tipo, tamano: datos.length, datos, subidoPorId: usuarioId },
    select: { id: true },
  });

  return Response.json({ url: `/api/archivos/${guardado.id}` });
}

/** El profesor pega un enlace y el servidor va a por el archivo. */
async function porDireccion(peticion: Request, usuarioId: string): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return Response.json({ error: "No se pudo leer la petición." }, { status: 400 });
  }

  const url =
    typeof cuerpo === "object" && cuerpo !== null && "url" in cuerpo
      ? String((cuerpo as { url: unknown }).url ?? "")
      : "";
  if (!url.trim()) {
    return Response.json({ error: "No llegó ninguna dirección." }, { status: 400 });
  }

  let traido;
  try {
    traido = await traerAudio(url, MAXIMO_TRAIDO);
  } catch (e) {
    if (e instanceof EnlaceInvalidoError) {
      // El mensaje ya está escrito en castellano y dice qué hacer: sale tal
      // cual. Es culpa de lo que se pegó, no del servidor.
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("No se pudo traer un audio de una dirección:", e);
    return Response.json(
      { error: "No se pudo traer el archivo de esa dirección." },
      { status: 400 },
    );
  }

  // Solo por dirección se admite un tipo vacío, y con motivo: Drive manda
  // `application/octet-stream`, así que exigir aquí uno de `TIPOS_AUDIO`
  // rechazaría un MP3 sano. Quien decide entonces es el compresor, que es el
  // único que abre el archivo de verdad y ya sabe rechazar lo que no es audio.
  if (traido.tipo && !TIPOS_AUDIO.includes(traido.tipo)) {
    return Response.json(
      { error: "Lo que hay en esa dirección no es un audio de los que admitimos." },
      { status: 400 },
    );
  }

  return await comprimirYGuardar(traido.datos, traido.nombre, traido.tipo, usuarioId);
}

/** La subida de siempre, para lo que cabe por el navegador. */
async function porFormulario(peticion: Request, usuarioId: string): Promise<Response> {
  let formulario;
  try {
    formulario = await peticion.formData();
  } catch {
    // Pasa cuando el cuerpo se recorta antes de llegar aquí: en Vercel, porque
    // pasa de 4,5 MB; en local, por el tope del proxy en `next.config.ts`.
    // `formData()` no consigue reconstruir el `multipart` y lanza.
    return Response.json(
      {
        error:
          "No se pudo leer el archivo enviado: puede que sea demasiado grande. " +
          "Si es un audio, súbelo a Drive y pega aquí su enlace.",
      },
      { status: 400 },
    );
  }
  const archivo = formulario.get("archivo");

  if (!(archivo instanceof File)) {
    return Response.json({ error: "No llegó ningún archivo." }, { status: 400 });
  }
  // Sin los parámetros que puede traer detrás (`;codecs=…`, `;charset=…`):
  // comparar el tipo crudo rechaza archivos perfectamente válidos.
  const recibidoTipo = tipoBase(archivo.type);
  const esImagen = IMAGENES.includes(recibidoTipo);
  const esAudio = TIPOS_AUDIO.includes(recibidoTipo);

  if (!esImagen && !esAudio) {
    return Response.json({ error: "Solo se admiten imágenes y audios." }, { status: 400 });
  }

  const maximo = esImagen ? MAXIMO_IMAGEN : MAXIMO_SUBIDA;
  if (archivo.size > maximo) {
    return Response.json(
      {
        error: esImagen
          ? "La imagen pesa demasiado incluso después de reducirla."
          : "El audio pesa demasiado para subirlo desde el navegador. Súbelo a " +
            "Drive y pega aquí su enlace.",
      },
      { status: 400 },
    );
  }

  const recibido = Buffer.from(await archivo.arrayBuffer());

  // Una imagen no se comprime aquí —ya viene reducida del navegador—, así que
  // no pasa por el tramo del audio.
  if (esImagen) {
    const nombre = archivo.name.slice(0, 200);
    const guardado = await prisma.archivo.create({
      data: {
        nombre,
        tipo: recibidoTipo,
        tamano: recibido.length,
        datos: recibido,
        subidoPorId: usuarioId,
      },
      select: { id: true },
    });
    return Response.json({ url: `/api/archivos/${guardado.id}` });
  }

  return await comprimirYGuardar(recibido, archivo.name, recibidoTipo, usuarioId);
}

export async function POST(peticion: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    return Response.json({ error: "Sin permiso." }, { status: 403 });
  }

  // Dos entradas para lo mismo. El formulario es el camino corto de lo
  // pequeño; la dirección es el único por el que puede entrar un MP3 de 36 MB,
  // porque el tope de 4,5 MB del cuerpo de una petición solo existe en el
  // tramo navegador → función: cuando quien descarga es el servidor, no hay.
  if (tipoBase(peticion.headers.get("content-type") ?? "") === "application/json") {
    return await porDireccion(peticion, usuario.id);
  }
  return await porFormulario(peticion, usuario.id);
}
