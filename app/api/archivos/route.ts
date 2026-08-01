import { comprimirAudio } from "@/lib/audio";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

// Tope tras redimensionar en el navegador. Una foto de 4000 px comprimida
// a WebP baja de 400 KB, así que 4 MB solo salta con algo muy raro.
const MAXIMO_IMAGEN = 4 * 1024 * 1024;

// Lo que aceptamos **recibir**, no lo que guardamos: el audio se comprime
// antes de entrar en la base, así que lo guardado es mucho más pequeño.
// Cien megas dejan pasar de sobra el peor caso conocido —los 35,7 MB de la
// tarea 1 del A2/B1 escolar— sin abrir la puerta a subir una película.
const MAXIMO_AUDIO = 100 * 1024 * 1024;

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
          : "El audio pesa demasiado. El tope son 100 MB.",
      },
      { status: 400 },
    );
  }

  const recibido = Buffer.from(await archivo.arrayBuffer());

  // El audio se comprime aquí, durante la subida: quince minutos tardan unos
  // segundos. Si algún día esto corre en una máquina con límite de tiempo por
  // petición, habrá que sacarlo fuera y enseñar un estado «procesando».
  let datos = recibido;
  let tipo = archivo.type;
  let nombre = archivo.name;
  if (esAudio) {
    try {
      // Devuelve los tres campos ya resueltos, comprima o no: aquí no hay
      // nada que interpretar.
      //
      // El `as` es solo de tipos: `comprimirAudio` declara `datos: Buffer`
      // a secas, que con este `@types/node` significa "podría venir de un
      // `SharedArrayBuffer`". Nunca es así —sale de `readFile` o es el mismo
      // buffer que entró—, pero hace falta decírselo a TypeScript para que
      // encaje con lo que `prisma.archivo.create` exige guardar.
      ({ datos, tipo, nombre } = (await comprimirAudio(recibido, archivo.name, archivo.type)) as {
        datos: Buffer<ArrayBuffer>;
        tipo: string;
        nombre: string;
      });
    } catch (e) {
      // Se rechaza en vez de guardar el original de 36 MB callando: si esto
      // pasara en silencio, se descubriría con cincuenta audios ya dentro.
      return Response.json(
        { error: e instanceof Error ? e.message : "No se pudo comprimir el audio." },
        { status: 400 },
      );
    }
  }

  const guardado = await prisma.archivo.create({
    data: {
      nombre: nombre.slice(0, 200),
      tipo,
      tamano: datos.length,
      datos,
      subidoPorId: usuario.id,
    },
    select: { id: true },
  });

  return Response.json({ url: `/api/archivos/${guardado.id}` });
}
