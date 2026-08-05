import { tipoBase, TIPOS_AUDIO } from "@/lib/audio";

/**
 * Traerse un audio de una dirección que ha escrito el profesor.
 *
 * Existe por un límite de la plataforma: en Vercel el cuerpo de una petición
 * no puede pasar de 4,5 MB, así que los MP3 del Cervantes —35,7 MB el mayor—
 * no caben por el formulario. Pero ese tope solo está en el tramo navegador →
 * función: una función que **descarga** un archivo no tiene ninguno. Así que
 * el profesor sube el archivo a Drive, pega el enlace, y el servidor va a por
 * él.
 *
 * No importa `prisma` ni nada del navegador: entra un texto y salen bytes.
 *
 * La otra mitad del módulo es decir que no. Le estamos pidiendo al servidor
 * que haga una petición a una dirección escrita por una persona, y aunque esa
 * persona sea profesor —la ruta ya exige PROFESOR o ADMIN—, esa puerta se
 * cierra desde el primer día: que hoy no haya nada interesante detrás no es
 * motivo para dejarla abierta.
 */

/** Que la dirección no se puede pedir, con el motivo dicho en castellano. */
export class EnlaceInvalidoError extends Error {}

/**
 * Lo que esta puerta **no** cierra, dicho para que nadie la crea más fuerte de
 * lo que es: se mira el nombre de máquina que viene escrito, no la IP a la que
 * resuelve. Un dominio público que apunte a 127.0.0.1 pasa. Cerrar eso pide
 * resolver el nombre a mano y volver a comprobarlo al conectar, y no se hace
 * hoy porque quien puede pegar una dirección aquí ya es profesor o
 * administrador. Si algún día esta ruta se abre a más gente, esto es lo
 * primero que hay que arreglar.
 */

/**
 * Los nombres de máquina que no se piden nunca. `169.254.169.254` es el
 * servicio de metadatos de las nubes: quien consiga que un servidor lo pida
 * por él se lleva las credenciales de la máquina.
 */
const PROHIBIDOS = [/^localhost$/i, /^\[?::1\]?$/, /\.local$/i, /\.internal$/i];

/** Los rangos de IPv4 que no salen a la web pública. */
function esPrivada(maquina: string): boolean {
  const partes = maquina.split(".");
  if (partes.length !== 4) return false;
  const [a, b] = partes.map((p) => Number(p));
  if (partes.some((p) => !/^\d+$/.test(p)) || [a, b].some((n) => Number.isNaN(n))) return false;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 169.254.0.0/16: enlace local, y dentro está el servicio de metadatos.
  if (a === 169 && b === 254) return true;
  return false;
}

/** El id del archivo, si la dirección es una de las dos formas de Drive. */
function idDeDrive(direccion: URL): string | null {
  if (!/(^|\.)drive\.google\.com$/i.test(direccion.hostname)) return null;
  // https://drive.google.com/file/d/<id>/view?usp=sharing
  const enRuta = direccion.pathname.match(/^\/file\/d\/([^/]+)/);
  if (enRuta) return enRuta[1];
  // https://drive.google.com/open?id=<id>
  return direccion.searchParams.get("id");
}

/**
 * La dirección de la que hay que descargar de verdad.
 *
 * Para Drive no es la misma que la que te da al compartir: esa
 * (`/file/d/<id>/view`) es una página web, y descargarla se trae HTML. Para
 * todo lo demás, la que venga.
 *
 * Lanza `EnlaceInvalidoError` si la dirección no se puede pedir.
 */
export function direccionDeDescarga(enlace: string): string {
  let direccion: URL;
  try {
    direccion = new URL(enlace.trim());
  } catch {
    throw new EnlaceInvalidoError("Eso no parece una dirección de internet.");
  }

  if (direccion.protocol !== "http:" && direccion.protocol !== "https:") {
    throw new EnlaceInvalidoError("Solo se pueden traer direcciones http o https.");
  }

  const maquina = direccion.hostname;
  if (PROHIBIDOS.some((p) => p.test(maquina)) || esPrivada(maquina)) {
    throw new EnlaceInvalidoError("Esa dirección no es pública, así que no se puede traer.");
  }

  const id = idDeDrive(direccion);
  if (id) {
    // `drive.usercontent.google.com` con `confirm=t` es lo que hoy sirve el
    // archivo sin pasar por la pantalla de aviso de antivirus que Drive
    // interpone con los archivos grandes.
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  }

  return direccion.toString();
}

/** De la extensión del nombre al tipo, para cuando el servidor no lo dice. */
const POR_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

/** El nombre que anuncia el otro lado, si anuncia alguno. */
function nombreDeCabecera(disposicion: string | null): string | null {
  if (!disposicion) return null;
  const entrecomillado = disposicion.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return entrecomillado ? decodeURIComponent(entrecomillado[1].trim()) : null;
}

function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase();
}

/**
 * Descarga el audio, cortando en cuanto se pasa del tope.
 *
 * `pedir` existe para poder verificar esto sin salir a la red, que es lo único
 * que hace comprobable un módulo que por definición habla con fuera.
 *
 * El tipo se resuelve en cascada y con motivo: **Drive no manda el tipo real**,
 * manda `application/octet-stream`. Comprobar contra `TIPOS_AUDIO` a secas
 * —lo primero que uno escribe— rechazaría un MP3 perfectamente sano. Así que:
 * el que declara el servidor si es de los nuestros; si no, el que diga la
 * extensión del nombre; y si tampoco, vacío, y que decida el compresor, que es
 * el único que abre el archivo de verdad.
 */
export async function traerAudio(
  enlace: string,
  maximo: number,
  pedir: typeof fetch = fetch,
): Promise<{ datos: Buffer<ArrayBuffer>; tipo: string; nombre: string }> {
  const direccion = direccionDeDescarga(enlace);

  let respuesta: Response;
  try {
    respuesta = await pedir(direccion, { redirect: "follow" });
  } catch {
    throw new EnlaceInvalidoError(
      "No se pudo conectar con esa dirección. Comprueba que el enlace es correcto.",
    );
  }

  if (!respuesta.ok) {
    throw new EnlaceInvalidoError(
      `Esa dirección contestó con un error (${respuesta.status}). Si es de Drive, ` +
        `comprueba que el archivo está compartido con enlace.`,
    );
  }

  const declarado = tipoBase(respuesta.headers.get("content-type") ?? "");

  // Una página web no es un audio. Es el caso de un archivo de Drive que no
  // está compartido: contesta 200 con el HTML de «pide acceso», y sin esto se
  // guardaría ese HTML creyendo que es un MP3.
  if (declarado.startsWith("text/")) {
    throw new EnlaceInvalidoError(
      "Esa dirección devuelve una página web, no un archivo de audio. Si es de " +
        "Drive, comprueba que está compartido con «cualquier persona con el enlace».",
    );
  }

  const anunciado = Number(respuesta.headers.get("content-length") ?? "");
  if (Number.isFinite(anunciado) && anunciado > maximo) {
    throw new EnlaceInvalidoError(
      `Ese archivo pesa ${Math.round(anunciado / (1024 * 1024))} MB y el tope son ` +
        `${Math.round(maximo / (1024 * 1024))} MB.`,
    );
  }

  // Y aun así se cuenta al leer: el `Content-Length` es una promesa del otro
  // lado, no un hecho, y puede no venir.
  const trozos: Uint8Array[] = [];
  let leidos = 0;
  const lector = respuesta.body?.getReader();
  if (!lector) throw new EnlaceInvalidoError("Esa dirección no devolvió ningún contenido.");
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    leidos += value.length;
    if (leidos > maximo) {
      await lector.cancel();
      throw new EnlaceInvalidoError(
        `Ese archivo pesa más de ${Math.round(maximo / (1024 * 1024))} MB, que es el tope.`,
      );
    }
    trozos.push(value);
  }

  const nombre =
    nombreDeCabecera(respuesta.headers.get("content-disposition")) ??
    decodeURIComponent(new URL(direccion).pathname.split("/").pop() || "");

  const tipo = TIPOS_AUDIO.includes(declarado)
    ? declarado
    : (POR_EXTENSION[extensionDe(nombre)] ?? "");

  return {
    datos: Buffer.concat(trozos) as Buffer<ArrayBuffer>,
    tipo,
    nombre: nombre || "audio",
  };
}
