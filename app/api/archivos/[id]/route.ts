import { puedeOirse } from "@/lib/expresion";
import { prisma } from "@/lib/prisma";
import { interpretarRango } from "@/lib/rangos";
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
 *
 * Los dos «No encontrado» tardan distinto —el de un id inexistente contesta
 * sin pasar por Clerk— y se queda así a sabiendas: taparlo obligaría a pedir
 * la sesión en cada imagen pública, y para aprovecharlo hay que tener ya el
 * id, que es justo lo que antes bastaba para llevarse el archivo entero.
 *
 * Sirve por trozos si se los piden, que es lo que un `<audio>` de WebKit
 * necesita para arrancar. El permiso se resuelve antes que nada y no se mueve
 * de ahí: un 206 es un trozo del mismo archivo, así que de uno que `puedeOirse`
 * haya negado no puede salir ni un byte.
 */
export async function GET(
  peticion: Request,
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

  // La sesión solo se pide si hay algo que proteger. `puedeOirse` ya deja
  // pasar lo no privado sin mirar quién pregunta, pero para preguntárselo
  // habría que llamar antes a `getUsuarioActual`, y esa no solo lee: crea la
  // fila de `User` la primera vez y le engancha el clerkId. Pedir la foto de
  // un ejercicio no puede escribir en la base ni pagar una llamada a Clerk.
  if (archivo.privado) {
    const usuario = await getUsuarioActual();
    if (!(await puedeOirse(id, usuario))) {
      // El mismo 404 que si no existiera: decir «no puedes» confirma que existe.
      return new Response("No encontrado", { status: 404 });
    }
  }

  // El contenido de un id nunca cambia, así que se puede cachear a tope. Uno
  // privado no: cachearlo en público lo dejaría al alcance de quien comparta
  // caché con quien sí puede oírlo. La misma en las tres salidas.
  const cache = archivo.privado
    ? "private, no-store"
    : "public, max-age=31536000, immutable";

  // Las cuentas del trozo van sobre los bytes que hay de verdad y no sobre
  // `tamano`: si esa columna se desincronizara alguna vez, un `Content-Range`
  // calculado con ella prometería un final que el cuerpo no tiene.
  const total = archivo.datos.length;
  const rango = interpretarRango(peticion.headers.get("range"), total);

  if (rango.clase === "imposible") {
    return new Response("Ese trozo no existe", {
      status: 416,
      headers: {
        // Obligatorio en un 416: es como el cliente se entera del tamaño real
        // y puede volver a pedir bien.
        "Content-Range": `bytes */${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": cache,
      },
    });
  }

  if (rango.clase === "trozo") {
    return new Response(
      new Uint8Array(archivo.datos.subarray(rango.inicio, rango.fin + 1)),
      {
        status: 206,
        headers: {
          "Content-Type": archivo.tipo,
          // El largo del trozo, no el del archivo: anunciar el del archivo deja
          // al cliente esperando bytes que no van a llegar.
          "Content-Length": String(rango.fin - rango.inicio + 1),
          "Content-Range": `bytes ${rango.inicio}-${rango.fin}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": cache,
        },
      },
    );
  }

  return new Response(new Uint8Array(archivo.datos), {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Length": String(archivo.tamano),
      // Sin esto el cliente no sabe que puede pedir trozos, y WebKit ni lo
      // intenta.
      "Accept-Ranges": "bytes",
      "Cache-Control": cache,
    },
  });
}
