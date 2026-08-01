import { puedeOirse } from "@/lib/expresion";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

/**
 * Sirve un archivo guardado.
 *
 * El material del profesor —imágenes y audios de los ejercicios— se sirve sin
 * sesión, como siempre: lo ve el estudiante dentro de su paso y el
 * identificador es un cuid imposible de adivinar. Lo que marca `privado` es
 * otra cosa: la voz de un alumno, a menudo menor de edad, y ahí una dirección
 * difícil de adivinar no es protección suficiente. Quién puede oírla lo decide
 * `puedeOirse`.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const archivo = await prisma.archivo.findUnique({
    where: { id },
    select: { datos: true, tipo: true, tamano: true, privado: true },
  });

  if (!archivo) {
    return new Response("No encontrado", { status: 404 });
  }

  const usuario = await getUsuarioActual();
  if (!(await puedeOirse(id, usuario))) {
    // El mismo 404 que si no existiera: decir «no puedes» confirma que existe.
    return new Response("No encontrado", { status: 404 });
  }

  return new Response(new Uint8Array(archivo.datos), {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Length": String(archivo.tamano),
      // El contenido de un id nunca cambia, así que se puede cachear a tope.
      // Uno privado no: cachearlo en público lo dejaría al alcance de quien
      // comparta caché con quien sí puede oírlo.
      "Cache-Control": archivo.privado
        ? "private, no-store"
        : "public, max-age=31536000, immutable",
    },
  });
}
