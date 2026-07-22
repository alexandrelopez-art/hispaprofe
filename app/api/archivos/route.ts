import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

// Tope tras redimensionar en el navegador. Una foto de 4000 px comprimida
// a WebP baja de 400 KB, asi que 4 MB solo salta con algo muy raro.
const MAXIMO = 4 * 1024 * 1024;

const PERMITIDOS = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
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
  if (!PERMITIDOS.includes(archivo.type)) {
    return Response.json(
      { error: "Solo se admiten imágenes." },
      { status: 400 },
    );
  }
  if (archivo.size > MAXIMO) {
    return Response.json(
      { error: "La imagen pesa demasiado incluso después de reducirla." },
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
