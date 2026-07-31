import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

// Tope tras redimensionar en el navegador. Una foto de 4000 px comprimida
// a WebP baja de 400 KB, asi que 4 MB solo salta con algo muy raro.
const MAXIMO_IMAGEN = 4 * 1024 * 1024;

// El audio no se puede reducir en el navegador como una imagen, asi que este
// tope no se salta solo: hay que recomprimir antes de subir.
//
// Los MP3 del Cervantes vienen en mono a 320 kbps, siete veces mas calidad de
// la que necesita una voz: la tarea 1 del A2/B1 escolar dura casi quince
// minutos y pesa 35,7 MB. A 48 kbps baja a 5,8 MB sin diferencia audible
// (`afconvert -f mp4f -d aac -b 48000 -s 3 entrada.mp3 salida.m4a`, que ya
// viene en macOS). Doce megas dejan pasar eso y rechazan el original, que es
// justo lo que se busca: el mensaje de error tiene que ensenar a recomprimir.
const MAXIMO_AUDIO = 12 * 1024 * 1024;

const IMAGENES = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
];

const AUDIOS = ["audio/mpeg", "audio/mp4", "audio/m4a", "audio/ogg", "audio/wav", "audio/webm"];

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
