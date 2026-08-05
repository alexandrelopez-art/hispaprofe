/**
 * Verifica la traducción de direcciones y, sobre todo, las que hay que
 * rechazar: le estamos pidiendo al servidor que vaya a una dirección escrita
 * por una persona.
 *
 * No sale a la red: `traerAudio` recibe un `pedir` de mentira.
 *
 * Ejecutar con:  npx tsx scripts/verificar-enlaces.ts
 */
import { direccionDeDescarga, EnlaceInvalidoError, traerAudio } from "@/lib/enlaces";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

/** Que `accion` lance un `EnlaceInvalidoError`, y no otra cosa cualquiera. */
async function rechaza(accion: () => unknown, mensaje: string) {
  try {
    await accion();
  } catch (e) {
    afirmar(e instanceof EnlaceInvalidoError, `${mensaje} (${(e as Error).message})`);
    return;
  }
  throw new Error(`FALLO: ${mensaje} — no lanzó nada`);
}

/** Una respuesta de mentira, con los bytes y las cabeceras que se le digan. */
function respuesta(cuerpo: Uint8Array<ArrayBuffer>, cabeceras: Record<string, string>): Response {
  return new Response(cuerpo, { status: 200, headers: cabeceras });
}

/** Una redirección de mentira, hacia donde se le diga. */
function redireccion(ubicacion: string): Response {
  return new Response(null, { status: 302, headers: { location: ubicacion } });
}

async function main() {
  // 1. El enlace que Drive da al compartir se traduce a uno de descarga. El de
  //    compartir es una página web: descargarlo se trae HTML, no un MP3.
  const compartido = "https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing";
  const traducido = direccionDeDescarga(compartido);
  afirmar(
    traducido.includes("1AbC_dEf-123") && !traducido.includes("/view"),
    `el enlace de compartir de Drive lleva el id a una descarga (${traducido})`,
  );

  // 2. La otra forma que da Drive, la de `open?id=`.
  const abierto = direccionDeDescarga("https://drive.google.com/open?id=1AbC_dEf-123");
  afirmar(abierto === traducido, "y `open?id=` acaba en la misma dirección que `/file/d/`");

  // 3. Lo que ya es una dirección directa se deja en paz. Drive no es el único
  //    sitio del mundo donde se puede tener un audio.
  const directa = "https://ejemplo.org/audios/tarea1.mp3";
  afirmar(direccionDeDescarga(directa) === directa, "una dirección directa no se toca");

  // 4. Los rechazos. Esto es la razón de ser del módulo: el servidor va a
  //    pedir lo que ponga aquí, así que lo que no sea la web pública se para.
  await rechaza(() => direccionDeDescarga("file:///etc/passwd"), "un `file:` se rechaza");
  await rechaza(() => direccionDeDescarga("data:audio/mp3;base64,AAAA"), "un `data:` se rechaza");
  await rechaza(() => direccionDeDescarga("http://localhost:3000/api/archivos"), "localhost se rechaza");
  await rechaza(() => direccionDeDescarga("http://127.0.0.1/"), "127.0.0.1 se rechaza");
  await rechaza(() => direccionDeDescarga("http://192.168.1.10/audio.mp3"), "una IP de red local se rechaza");
  await rechaza(() => direccionDeDescarga("http://10.0.0.5/audio.mp3"), "una IP de red privada se rechaza");
  await rechaza(
    () => direccionDeDescarga("http://169.254.169.254/latest/meta-data/"),
    "el servicio de metadatos de la nube se rechaza",
  );
  await rechaza(() => direccionDeDescarga("no es una dirección"), "un texto que no es una dirección se rechaza");

  // 5. `traerAudio` corta cuando se pasa del tope, en vez de leer en memoria
  //    lo que el otro lado quiera mandar.
  const grande = new Uint8Array(5000);
  await rechaza(
    () => traerAudio(directa, 1000, async () => respuesta(grande, { "content-type": "audio/mpeg" })),
    "un archivo que se pasa del tope se corta",
  );

  // 6. El tipo, en cascada. Drive manda `application/octet-stream`, así que
  //    comprobar contra `TIPOS_AUDIO` a secas rechazaría un MP3 sano.
  const bytes = new Uint8Array(100);
  const porCabecera = await traerAudio(directa, 10_000, async () =>
    respuesta(bytes, { "content-type": "audio/mpeg" }),
  );
  afirmar(porCabecera.tipo === "audio/mpeg", "si el servidor declara un tipo de los nuestros, se usa");
  afirmar(porCabecera.nombre === "tarea1.mp3", `y el nombre sale de la dirección (${porCabecera.nombre})`);

  const porNombre = await traerAudio(directa, 10_000, async () =>
    respuesta(bytes, {
      "content-type": "application/octet-stream",
      "content-disposition": 'attachment; filename="Tarea 1.mp3"',
    }),
  );
  afirmar(
    porNombre.tipo === "audio/mpeg",
    `con octet-stream, el tipo lo dice la extensión del nombre (${porNombre.tipo})`,
  );
  afirmar(porNombre.nombre === "Tarea 1.mp3", "y el nombre sale del Content-Disposition");

  const sinPista = await traerAudio("https://ejemplo.org/descarga", 10_000, async () =>
    respuesta(bytes, { "content-type": "application/octet-stream" }),
  );
  afirmar(
    sinPista.tipo === "",
    "y si no hay ninguna pista, el tipo se deja vacío para que decida el compresor",
  );

  // 7. Una página web no es un audio: Drive contesta HTML cuando el archivo no
  //    está compartido, y guardar ese HTML creyendo que es un MP3 es el fallo
  //    que este caso evita.
  await rechaza(
    () =>
      traerAudio(directa, 10_000, async () =>
        respuesta(new TextEncoder().encode("<html>No tienes acceso</html>"), {
          "content-type": "text/html; charset=utf-8",
        }),
      ),
    "una página web en vez de un audio se rechaza",
  );

  // 8. Un 404 del otro lado no se guarda como si fuera el archivo.
  await rechaza(
    () => traerAudio(directa, 10_000, async () => new Response("No existe", { status: 404 })),
    "una respuesta con error se rechaza",
  );

  // 9. Las redirecciones se vuelven a pasar por la misma puerta. Un servidor
  //    público de hoy puede redirigir a la red interna mañana, y `fetch`
  //    seguiría ese salto sin rechistar si no se comprobara aquí.
  await rechaza(
    () => traerAudio(directa, 10_000, async () => redireccion("http://169.254.169.254/")),
    "una redirección a la IP de metadatos de la nube se rechaza",
  );
  await rechaza(
    () => traerAudio(directa, 10_000, async () => redireccion("file:///etc/passwd")),
    "una redirección a `file:` se rechaza",
  );
  await rechaza(
    () => traerAudio(directa, 10_000, async () => redireccion(directa)),
    "una cadena de redirecciones que nunca termina se corta por el tope de saltos",
  );

  // Pero una redirección legítima —a otra dirección pública— sí se sigue:
  // es el camino que hace falta que funcione, porque Drive redirige.
  let llamada = 0;
  const destinoFinal = "https://ejemplo.org/audios/definitivo.mp3";
  const porRedireccion = await traerAudio(directa, 10_000, async () => {
    llamada++;
    return llamada === 1 ? redireccion(destinoFinal) : respuesta(bytes, { "content-type": "audio/mpeg" });
  });
  afirmar(porRedireccion.tipo === "audio/mpeg", "una redirección legítima se sigue y trae el destino");
  afirmar(
    porRedireccion.nombre === "definitivo.mp3",
    `y el nombre sale de la dirección de destino (${porRedireccion.nombre})`,
  );

  // 10. Los mismos rangos privados, pero en IPv6: `URL` deja el literal con
  //     corchetes en `hostname` (`[::1]`), y hay que reconocerlo igual.
  await rechaza(() => direccionDeDescarga("http://[::1]/"), "IPv6 loopback `[::1]` se rechaza");
  await rechaza(
    () => direccionDeDescarga("http://[::ffff:127.0.0.1]/"),
    "IPv4 embebida en IPv6 `[::ffff:127.0.0.1]` se rechaza",
  );
  await rechaza(
    () => direccionDeDescarga("http://[fd00::1]/"),
    "IPv6 unique-local `[fd00::1]` se rechaza",
  );
  await rechaza(
    () => direccionDeDescarga("http://[fe80::1]/"),
    "IPv6 link-local `[fe80::1]` se rechaza",
  );

  // 11. Las mismas cinco formas de decir «localhost» o «el servicio de
  //     metadatos» en IPv6 que se colaban comparando prefijos de texto: se
  //     comprueban una a una porque son justo la prueba de que decidir sobre
  //     los bytes, y no sobre cómo esté escrito, cierra la clase entera.
  await rechaza(
    () => direccionDeDescarga("http://[::127.0.0.1]/"),
    "loopback como IPv4-compatible antigua `[::127.0.0.1]` se rechaza",
  );
  await rechaza(
    () => direccionDeDescarga("http://[0:0:0:0:0:0:127.0.0.1]/"),
    "loopback escrita sin comprimir `[0:0:0:0:0:0:127.0.0.1]` se rechaza",
  );
  await rechaza(
    () => direccionDeDescarga("http://[::ffff:0:127.0.0.1]/"),
    "loopback mapeada con un grupo cero de más `[::ffff:0:127.0.0.1]` se rechaza",
  );
  await rechaza(
    () => direccionDeDescarga("http://[64:ff9b::a9fe:a9fe]/"),
    "metadatos de la nube vía NAT64 `[64:ff9b::a9fe:a9fe]` se rechaza",
  );
  await rechaza(
    () => direccionDeDescarga("http://[64:ff9b::7f00:1]/"),
    "loopback vía NAT64 `[64:ff9b::7f00:1]` se rechaza",
  );

  // Y lo que no hay que bloquear: una IPv4 pública embebida en IPv6 sigue
  // siendo pública. Lo que decide es la IPv4 de dentro, no el hecho de venir
  // embebida. Se compara contra lo que la propia `URL` normaliza —Node la
  // deja en hexadecimal, `[::ffff:808:808]`— y no contra el texto de
  // entrada, que es justo lo que este módulo ha dejado de mirar.
  const publicaEmbebida = "http://[::ffff:8.8.8.8]/";
  const resultadoEmbebida = direccionDeDescarga(publicaEmbebida);
  afirmar(
    resultadoEmbebida === new URL(publicaEmbebida).toString(),
    `una IPv4 pública embebida en IPv6, [::ffff:8.8.8.8], no se rechaza (${resultadoEmbebida})`,
  );

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
