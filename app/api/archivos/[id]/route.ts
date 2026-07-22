import { prisma } from "@/lib/prisma";

/**
 * Sirve una imagen guardada. Sin comprobación de sesión a propósito: las
 * ve el estudiante dentro de su paso, y el identificador es un cuid
 * imposible de adivinar.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const archivo = await prisma.archivo.findUnique({
    where: { id },
    select: { datos: true, tipo: true, tamano: true },
  });

  if (!archivo) {
    return new Response("No encontrado", { status: 404 });
  }

  return new Response(new Uint8Array(archivo.datos), {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Length": String(archivo.tamano),
      // El contenido de un id nunca cambia, así que se puede cachear a tope.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
