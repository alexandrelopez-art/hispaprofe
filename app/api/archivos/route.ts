import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

// Tope tras redimensionar en el navegador. Una foto de 4000 px comprimida
// a WebP baja de 400 KB, así que 4 MB solo salta con algo muy raro.
const MAXIMO_IMAGEN = 4 * 1024 * 1024;

// El audio no se puede reducir en el navegador como una imagen, así que este
// tope no se salta solo: hay que recomprimir antes de subir.
//
// Los MP3 del Cervantes vienen en mono a 320 kbps, siete veces más calidad de
// la que necesita una voz: la tarea 1 del A2/B1 escolar dura casi quince
// minutos y pesa 35,7 MB. A 48 kbps baja a 5,8 MB sin diferencia audible
// (`afconvert -f mp4f -d aac -b 48000 -s 3 entrada.mp3 salida.m4a`, que ya
// viene en macOS). Doce megas dejan pasar eso y rechazan el original, que es
// justo lo que se busca: el mensaje de error tiene que enseñar a recomprimir.
const MAXIMO_AUDIO = 12 * 1024 * 1024;

const IMAGENES = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];

// Un mismo formato llega con nombres distintos según el navegador, y la lista
// tiene que aceptarlos todos o el profesor se choca con «Solo se admiten
// imágenes y audios» subiendo un archivo perfectamente válido:
//
// - `audio/x-m4a` es lo que dice Safari de un `.m4a` — justo el formato que
//   este archivo le recomienda generar con `afconvert`, y él trabaja en macOS.
// - `audio/wave` y `audio/x-wav` son los nombres viejos del WAV, todavía en
//   uso; `audio/mp3` lo dicen algunos navegadores en vez de `audio/mpeg`.
const AUDIOS = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
];

export async function POST(peticion: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    return Response.json({ error: "Sin permiso." }, { status: 403 });
  }

  const formulario = await peticion.formData();
  const archivo = formulario.get("archivo");

  if (!(archivo instanceof File)) {
    return Response.json({ error: "No llegó ningún archivo." }, { status: 400 });
  }
  const esImagen = IMAGENES.includes(archivo.type);
  const esAudio = AUDIOS.includes(archivo.type);

  if (!esImagen && !esAudio) {
    return Response.json(
      { error: "Solo se admiten imágenes y audios." },
      { status: 400 },
    );
  }

  const maximo = esImagen ? MAXIMO_IMAGEN : MAXIMO_AUDIO;
  if (archivo.size > maximo) {
    return Response.json(
      {
        error: esImagen
          ? "La imagen pesa demasiado incluso después de reducirla."
          : "El audio pesa demasiado. El tope son 12 MB: recomprímelo a 48 kbps en mono, que para voz suena igual y ocupa una séptima parte.",
      },
      { status: 400 },
    );
  }

  const datos = Buffer.from(await archivo.arrayBuffer());

  const guardado = await prisma.archivo.create({
    data: {
      nombre: archivo.name.slice(0, 200),
      tipo: archivo.type,
      tamano: datos.length,
      datos,
      subidoPorId: usuario.id,
    },
    select: { id: true },
  });

  return Response.json({ url: `/api/archivos/${guardado.id}` });
}
