import { revalidatePath } from "next/cache";
import {
  comprimirAudio,
  CompresorAusenteError,
  nombreDeGrabacion,
  TIPOS_AUDIO,
} from "@/lib/audio";
import {
  anotarEntrega,
  asignacionViva,
  MAXIMO_AUDIO_GUARDADO,
  MAXIMO_AUDIO_RECIBIDO,
  puedeEntregarAudio,
} from "@/lib/expresion";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

/**
 * El alumno manda su grabación.
 *
 * Ruta aparte de `/api/archivos` y no un parámetro más de aquella por tres
 * motivos que la separan entera: esta es de alumnos (el 403 a quien no es
 * profesor sería justo lo contrario de lo que hace falta), solo admite audio,
 * y subir y entregar son aquí el mismo acto. Eso último es lo importante: sin
 * un paso «subido pero sin entregar» no hay forma de dejar archivos huérfanos
 * en la base.
 *
 * Quién puede y hasta cuándo lo deciden `asignacionViva` y `puedeEntregarAudio`,
 * que viven en `lib/` para que el script los ejercite sin levantar un servidor.
 */
export async function POST(peticion: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario) return Response.json({ error: "No hay sesión." }, { status: 403 });

  let formulario;
  try {
    formulario = await peticion.formData();
  } catch {
    // Igual que en `/api/archivos`: pasa cuando el proxy recorta el cuerpo
    // antes de llegar aquí, y sin este `catch` salía como un 500 mudo.
    return Response.json(
      { error: "No se pudo leer la grabación enviada. Vuelve a intentarlo." },
      { status: 400 },
    );
  }

  const pasoId = String(formulario.get("pasoId") ?? "");
  const archivo = formulario.get("archivo");
  if (!pasoId) return Response.json({ error: "Falta el paso." }, { status: 400 });
  if (!(archivo instanceof File)) {
    return Response.json({ error: "No llegó ninguna grabación." }, { status: 400 });
  }

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    select: { recorridoId: true },
  });
  if (!paso) return Response.json({ error: "Ese paso no existe." }, { status: 404 });

  // De la sesión y del paso, nunca de un `asignacionId` del formulario: esto
  // es un endpoint público y ahí cabe escribir el de cualquiera.
  const asignacion = await asignacionViva(usuario.id, paso.recorridoId);
  if (!asignacion) {
    return Response.json({ error: "No tienes este recorrido asignado." }, { status: 403 });
  }

  const motivo = await puedeEntregarAudio(asignacion.id, pasoId);
  if (motivo) return Response.json({ error: motivo }, { status: 400 });

  if (!TIPOS_AUDIO.includes(archivo.type)) {
    return Response.json(
      { error: "Eso no es un audio: aquí solo se manda la grabación." },
      { status: 400 },
    );
  }

  // Antes de leerlo entero en memoria.
  if (archivo.size > MAXIMO_AUDIO_RECIBIDO) {
    return Response.json(
      {
        error: `La grabación pesa demasiado. El tope son ${Math.round(
          MAXIMO_AUDIO_RECIBIDO / (1024 * 1024),
        )} MB.`,
      },
      { status: 400 },
    );
  }

  const recibido = Buffer.from(await archivo.arrayBuffer());

  let datos = recibido;
  let tipo = archivo.type;
  let nombre;
  try {
    // Lo que graba el navegador llega sin nombre, y `comprimirAudio` nombra
    // con él el archivo temporal.
    ({ datos, tipo, nombre } = await comprimirAudio(
      recibido,
      nombreDeGrabacion(archivo.type),
      archivo.type,
    ));
  } catch (e) {
    if (e instanceof CompresorAusenteError) {
      // Culpa del servidor —no hay compresor en esta máquina—, no del alumno:
      // un 400 lo disfrazaría de «tu archivo está mal» y nadie miraría aquí.
      return Response.json({ error: e.message }, { status: 500 });
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "No se pudo comprimir la grabación." },
      { status: 400 },
    );
  }

  if (datos.length > MAXIMO_AUDIO_GUARDADO) {
    return Response.json(
      {
        error:
          "La grabación comprimida sigue pesando demasiado. Prueba con una " +
          "más corta.",
      },
      { status: 400 },
    );
  }

  const guardado = await prisma.archivo.create({
    data: {
      nombre,
      tipo,
      tamano: datos.length,
      datos,
      // La voz de un alumno no se sirve a quien tenga la dirección, y el
      // permiso de quien sí puede oírla cuelga de `subidoPorId`: `puedeOirse`
      // reconoce al profesor por tener asignado a quien grabó.
      privado: true,
      subidoPorId: usuario.id,
    },
    select: { id: true },
  });

  // La grabación anterior se queda donde estaba. Borrarla aquí es tentador y
  // está mal: si el borrado va antes de que la nueva esté escrita y algo falla
  // en medio, el alumno se queda sin ninguna de las dos.
  await anotarEntrega(asignacion.id, pasoId, `/api/archivos/${guardado.id}`);

  // Lo mismo que revalida `entregar`, incluida la ficha del alumno: es desde
  // donde corrige el profesor.
  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath("/profe/entregas");
  revalidatePath("/dashboard");
  revalidatePath(`/profe/alumnos/${usuario.id}`);

  return Response.json({ ok: true });
}
