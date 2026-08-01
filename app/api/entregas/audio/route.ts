import { revalidatePath } from "next/cache";
import {
  comprimirAudio,
  CompresorAusenteError,
  nombreDeGrabacion,
  tipoBase,
  TIPOS_AUDIO,
} from "@/lib/audio";
import {
  asignacionViva,
  guardarGrabacion,
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
 * en la base. La otra mitad de esa promesa la cumple `guardarGrabacion`, que
 * borra la grabación anterior al escribir la nueva: reentregar no acumula.
 *
 * Quién puede y hasta cuándo lo deciden `asignacionViva` y `puedeEntregarAudio`,
 * que viven en `lib/` para que el script los ejercite sin levantar un servidor.
 *
 * Un matiz sobre el que conviene no engañarse: aquí no se comprueba `Origin`.
 * No es «lo mismo que hace el resto del proyecto»: las acciones de servidor de
 * Next llevan esa red puesta de oficio, y una ruta de `/api` no. Lo que un
 * sitio ajeno podría conseguir con la cookie del alumno es que este entregue
 * un audio suyo sin querer —no leer nada, no oír nada—, así que se queda; pero
 * el día que esta ruta haga algo más, hay que ponerla.
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

  // El tipo, sin los parámetros que trae la grabadora: `MediaRecorder` nunca
  // entrega uno pelado —Chrome dice `audio/webm;codecs=opus`—, y compararlo
  // crudo rechazaría todas las grabaciones del navegador.
  const tipoRecibido = tipoBase(archivo.type);
  if (!TIPOS_AUDIO.includes(tipoRecibido)) {
    // Dice qué hacer, no solo que no. El que llega por el rodeo puede traer un
    // `.flac` perfectamente sano, y «eso no es un audio» era falso y no le
    // servía de nada.
    return Response.json(
      { error: "Ese formato no lo admitimos. Manda un MP3, un M4A, un OGG o un WAV." },
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

  let comprimido;
  try {
    // Lo que graba el navegador llega sin nombre, y `comprimirAudio` nombra
    // con él el archivo temporal.
    comprimido = await comprimirAudio(recibido, nombreDeGrabacion(tipoRecibido), tipoRecibido);
  } catch (e) {
    if (e instanceof CompresorAusenteError) {
      // Culpa del servidor —no hay compresor en esta máquina—, no del alumno:
      // un 400 lo disfrazaría de «tu archivo está mal» y nadie miraría aquí.
      return Response.json({ error: e.message }, { status: 500 });
    }
    // El detalle va al registro y no al alumno: lo que trae dentro es la
    // primera línea del `stderr` de `ffmpeg`, que a él no le dice nada y a
    // nosotros nos hace falta entera.
    console.error("No se pudo comprimir una grabación:", e);
    return Response.json(
      {
        error:
          "No se pudo procesar la grabación. Vuelve a grabarla y prueba otra vez.",
      },
      { status: 400 },
    );
  }

  // Guardar el archivo, dejarlo entregado y borrar la grabación anterior van
  // juntos, en una transacción y fuera de aquí: es lo que enciende `privado`,
  // firma con el id del alumno y deja una sola grabación viva por entrega.
  const problema = await guardarGrabacion(usuario.id, asignacion.id, pasoId, comprimido);
  if (problema) return Response.json({ error: problema }, { status: 400 });

  // Lo mismo que revalida `entregar`, incluida la ficha del alumno: es desde
  // donde corrige el profesor.
  revalidatePath(`/pasos/${pasoId}`);
  revalidatePath("/profe/entregas");
  revalidatePath("/dashboard");
  revalidatePath(`/profe/alumnos/${usuario.id}`);

  return Response.json({ ok: true });
}
