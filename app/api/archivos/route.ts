import { comprimirAudio, CompresorAusenteError, tipoBase, TIPOS_AUDIO } from "@/lib/audio";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";

// Tope tras redimensionar en el navegador. Una foto de 4000 px comprimida
// a WebP baja de 400 KB, así que 4 MB solo salta con algo muy raro.
const MAXIMO_IMAGEN = 4 * 1024 * 1024;

// Lo que aceptamos **recibir**, no lo que guardamos: el audio se comprime
// antes de entrar en la base, así que lo guardado es mucho más pequeño.
// Cien megas dejan pasar de sobra el peor caso conocido —los 35,7 MB de la
// tarea 1 del A2/B1 escolar— sin abrir la puerta a subir una película.
//
// Ojo al coste: `proxy.ts` hace que Next bufferice el cuerpo entero en
// memoria *antes* de que este manejador corra —hay que subir su tope en
// `next.config.ts` para que este número signifique algo—, y eso incluye a
// quien no tiene sesión: el 403 de más abajo llega después de reservar esta
// memoria, no antes. En un portátil no se nota; el día del despliegue sí.
const MAXIMO_AUDIO = 100 * 1024 * 1024;

// Lo que aceptamos **guardar**, distinto de `MAXIMO_AUDIO` (lo que aceptamos
// recibir). La regla es "guardar el más pequeño de los dos", pero si el
// compresor no logra encoger nada —un audio ya comprimido a tope, o mal
// identificado como audio— esa regla por sí sola dejaría pasar hasta 100 MB
// enteros a la columna `Archivo.datos`, ocho veces el tope viejo. Veinte
// megas dejan pasar con holgura el resultado esperado (la tarea 1 del
// Cervantes comprime a unos 5-6 MB) sin abrir la puerta a que un caso raro
// cuele el original casi intacto.
const MAXIMO_AUDIO_GUARDADO = 20 * 1024 * 1024;

const IMAGENES = [
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

  let formulario;
  try {
    formulario = await peticion.formData();
  } catch {
    // Pasa cuando el proxy recorta el cuerpo antes de que llegue aquí (el
    // tope de `next.config.ts` mal puesto, o un cliente que manda menos de
    // lo que promete): `formData()` no consigue reconstruir el `multipart` y
    // lanza. Sin este `catch` eso salía como un 500 mudo; con él, al menos
    // se sabe qué pasó.
    return Response.json(
      { error: "No se pudo leer el archivo enviado. Vuelve a intentarlo." },
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
  let tipo = recibidoTipo;
  // El recorte va aquí, antes de que `comprimirAudio` pueda añadirle `.m4a`
  // al nombre: recortar después (como se hacía antes, ya con la extensión
  // puesta) se comía justo esa extensión con un nombre de más de 200
  // caracteres, que es lo que `conExtensionM4a` quería evitar. Se reserva
  // sitio para la extensión más larga que puede añadirse (".m4a", 4
  // caracteres) para que el resultado final no vuelva a pasarse de 200.
  const nombreMaximo = 200;
  const margenExtension = 4;
  let nombre =
    archivo.name.length > nombreMaximo
      ? archivo.name.slice(0, nombreMaximo - margenExtension)
      : archivo.name;
  if (esAudio) {
    try {
      // Devuelve los tres campos ya resueltos, comprima o no: aquí no hay
      // nada que interpretar. El tipo de `datos` ya es `Buffer<ArrayBuffer>`
      // porque así lo declara `AudioComprimido` en `lib/audio.ts`, así que
      // no hace falta ninguna aserción de tipos en este lado.
      ({ datos, tipo, nombre } = await comprimirAudio(recibido, nombre, recibidoTipo));
    } catch (e) {
      if (e instanceof CompresorAusenteError) {
        // Esto es culpa del servidor, no del profesor ni de su archivo: no
        // hay compresor instalado en esta máquina. Un 400 lo disfrazaría de
        // "tu archivo está mal" y nadie miraría el servidor; un 500 hace
        // ruido donde tiene que hacerlo.
        return Response.json({ error: e.message }, { status: 500 });
      }
      // Aquí sí es cosa del archivo: no es audio, o está dañado. Se rechaza
      // en vez de guardar el original de 36 MB callando: si esto pasara en
      // silencio, se descubriría con cincuenta audios ya dentro.
      return Response.json(
        { error: e instanceof Error ? e.message : "No se pudo comprimir el audio." },
        { status: 400 },
      );
    }

    if (datos.length > MAXIMO_AUDIO_GUARDADO) {
      // La regla "guardar el más pequeño de los dos" no basta por sí sola:
      // con el tope de recepción en 100 MB, un audio que el compresor no
      // logre encoger entraría entero en la base. Esto es lo que de verdad
      // garantiza que lo guardado sea siempre pequeño.
      return Response.json(
        {
          error:
            "El audio comprimido sigue pesando demasiado. Prueba con un " +
            "archivo más corto o ya comprimido de otra forma.",
        },
        { status: 400 },
      );
    }
  }

  const guardado = await prisma.archivo.create({
    data: {
      nombre,
      tipo,
      tamano: datos.length,
      datos,
      subidoPorId: usuario.id,
    },
    select: { id: true },
  });

  return Response.json({ url: `/api/archivos/${guardado.id}` });
}
