/**
 * Verifica el campo `grabada` de una tarea de expresión y las reglas que
 * cambia: el esquema, `esGrabada`, `puedeValorarse`, `puedeEntregar`,
 * `puedeEntregarAudio`, `puedeCitarse`, `puedeOirse`, `esGrabacionEntregada` y
 * lo que hacen las dos rutas: la de la entrega (`asignacionViva` y
 * `anotarEntrega`) y la que sirve el archivo por trozos (`interpretarRango`).
 * Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-oral-grabada.ts
 */
import "dotenv/config";
import { nombreDeGrabacion, tipoBase, TIPOS_AUDIO } from "@/lib/audio";
import { puedeCitarse } from "@/lib/citas";
import {
  analizarExpresion,
  anotarEntrega,
  asignacionViva,
  esGrabacionEntregada,
  esGrabada,
  expresionSchema,
  guardarGrabacion,
  MAXIMO_AUDIO_GUARDADO,
  PREFIJO_GRABACION,
  puedeEntregar,
  puedeEntregarAudio,
  puedeOirse,
  puedeValorarse,
} from "@/lib/expresion";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { interpretarRango, type Rango } from "@/lib/rangos";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-oral-grabada-${process.pid}`;

let recorridoId: string | null = null;
const asignacionIds: string[] = [];
const usuarioIds: string[] = [];
const claseIds: string[] = [];
const pasoIds: string[] = [];
const ejercicioIds: string[] = [];
const archivoIds: string[] = [];

const ESCRITA = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "Escribe un correo a un amigo contándole tus vacaciones.",
  palabras: { minimo: 100, maximo: 120 },
  criterios: [{ id: "c1", nombre: "Coherencia", maximo: 3 }],
};

const ORAL_CLASE = {
  ejercicio: "expresion",
  modalidad: "oral",
  consigna: "Describe la foto y contesta a las preguntas.",
  minutos: 3,
  criterios: [{ id: "c1", nombre: "Fluidez", maximo: 3 }],
};

const ORAL_GRABADA = { ...ORAL_CLASE, grabada: true };

async function main() {
  // ─── El esquema ─────────────────────────────────────────────────────
  afirmar(expresionSchema.safeParse(ORAL_GRABADA).success, "una oral con `grabada: true` es válida");

  const sinGrabada = expresionSchema.safeParse(ORAL_CLASE);
  afirmar(
    sinGrabada.success && sinGrabada.data.grabada === false,
    "una oral sin `grabada` es válida y sale `false`: el valor por defecto",
  );

  const escritaGrabada = expresionSchema.safeParse({ ...ESCRITA, grabada: true });
  afirmar(!escritaGrabada.success, "una escrita con `grabada: true` se rechaza");
  afirmar(
    !escritaGrabada.success &&
      escritaGrabada.error.issues.some((i) => i.message.includes("Solo una tarea oral se puede grabar")),
    "y el mensaje lo dice",
  );

  // ─── esGrabada ──────────────────────────────────────────────────────
  const datosGrabada = analizarExpresion(ORAL_GRABADA)!;
  const datosClase = analizarExpresion(ORAL_CLASE)!;
  afirmar(esGrabada(datosGrabada) === true, "esGrabada es cierto en una oral grabada");
  afirmar(esGrabada(datosClase) === false, "y falso en una oral de clase");

  // ─── puedeValorarse ─────────────────────────────────────────────────
  afirmar(
    puedeValorarse(datosGrabada, { c1: 3 }, null) !== null,
    "puedeValorarse rechaza una grabada sin entrega",
  );
  afirmar(
    puedeValorarse(datosClase, { c1: 3 }, null) === null,
    "puedeValorarse acepta una oral de clase sin entrega",
  );

  // ─── Contra filas reales ────────────────────────────────────────────
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(estudiante.id);
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  usuarioIds.push(profesor.id);

  // Los tres de más son para `puedeOirse`: sin un segundo alumno y un segundo
  // profesor no hay forma de comprobar a quién se le niega.
  const otroAlumno = await prisma.user.create({
    data: { email: `alumno2-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(otroAlumno.id);
  const otroProfesor = await prisma.user.create({
    data: { email: `profe2-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  usuarioIds.push(otroProfesor.id);
  const administrador = await prisma.user.create({
    data: { email: `admin-${marca}@ejemplo.test`, role: "ADMIN" },
  });
  usuarioIds.push(administrador.id);

  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Recorrido ${marca}`, nivel: "B1", orden: 1 },
  });
  recorridoId = recorrido.id;
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionIds.push(asignacion.id);

  // La otra pareja, sin nada que ver con la primera: es la que sostiene las
  // negativas de `puedeOirse`.
  const otraAsignacion = await prisma.asignacion.create({
    data: { estudianteId: otroAlumno.id, profesorId: otroProfesor.id, recorridoId: recorrido.id },
  });
  asignacionIds.push(otraAsignacion.id);

  async function pasoConEjercicio(titulo: string, orden: number, datos: Prisma.InputJsonValue) {
    const ejercicio = await prisma.ejercicio.create({
      data: { tipo: "EXPRESION", titulo: `${titulo} ${marca}`, nivel: "B1", datos },
    });
    ejercicioIds.push(ejercicio.id);
    const paso = await prisma.paso.create({
      data: { recorridoId: recorrido.id, titulo, tipo: "MACRO_TAREA", ciclo: 1, orden },
    });
    pasoIds.push(paso.id);
    await prisma.pasoEjercicio.create({ data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 } });
    return paso;
  }

  const pasoGrabada = await pasoConEjercicio("Oral grabada", 1, ORAL_GRABADA);
  const pasoClase = await pasoConEjercicio("Oral de clase", 2, ORAL_CLASE);
  const pasoEscrita = await pasoConEjercicio("Escrita", 3, ESCRITA);
  const pasoSinEjercicio = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Sin ejercicio", tipo: "MACRO_TAREA", ciclo: 1, orden: 4 },
  });
  pasoIds.push(pasoSinEjercicio.id);

  // ─── puedeEntregar (texto) ──────────────────────────────────────────
  const motivoTexto = await puedeEntregar(asignacion.id, pasoGrabada.id, "Un texto normal.");
  afirmar(motivoTexto !== null, "puedeEntregar (texto) rechaza el paso de una grabada");
  afirmar(
    motivoTexto === "Esta tarea se entrega grabada, no escrita.",
    "y lo hace con el motivo propio, no el genérico de «no pide ninguna redacción»",
  );

  // ─── puedeEntregarAudio ─────────────────────────────────────────────
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoGrabada.id)) === null,
    "puedeEntregarAudio acepta el paso de una grabada",
  );
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoClase.id)) !== null,
    "puedeEntregarAudio rechaza el paso de una oral de clase",
  );
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoEscrita.id)) !== null,
    "puedeEntregarAudio rechaza el paso de una escrita",
  );
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoSinEjercicio.id)) !== null,
    "puedeEntregarAudio rechaza un paso sin ejercicio",
  );

  // ─── puedeOirse ─────────────────────────────────────────────────────
  async function archivo(nombre: string, privado: boolean, autorId: string | null) {
    const fila = await prisma.archivo.create({
      data: {
        nombre: `${nombre} ${marca}`,
        tipo: "audio/webm",
        tamano: 3,
        datos: new Uint8Array([1, 2, 3]),
        privado,
        subidoPorId: autorId,
      },
    });
    archivoIds.push(fila.id);
    return fila;
  }

  const material = await archivo("material", false, profesor.id);
  const grabacion = await archivo("grabacion", true, estudiante.id);
  // Suprimir una ficha pone `subidoPorId` a null en todos sus archivos
  // (lib/admin.ts). Esa grabación deja de tener dueño, y sin dueño no hay a
  // quién reconocerle el permiso.
  const huerfana = await archivo("grabacion sin dueño", true, null);

  await prisma.pasoCompletado.create({
    data: {
      asignacionId: asignacion.id,
      pasoId: pasoGrabada.id,
      // Lo que ve el alumno en su paso; el permiso para oírla no sale de aquí,
      // sino de quién subió el archivo.
      entrega: `/api/archivos/${grabacion.id}`,
      valoracion: { notas: { c1: 3 }, comentario: "Bien." },
      puntos: 3,
      verificadoEl: new Date(),
    },
  });
  afirmar(
    (await puedeEntregarAudio(asignacion.id, pasoGrabada.id)) !== null,
    "puedeEntregarAudio rechaza después de corregir",
  );

  afirmar(
    (await puedeOirse(material.id, null)) === true,
    "un archivo NO privado se sirve sin sesión",
  );
  afirmar(
    (await puedeOirse(grabacion.id, null)) === false,
    "un archivo privado no se sirve sin sesión",
  );
  afirmar(
    (await puedeOirse(grabacion.id, estudiante)) === true,
    "un archivo privado se le sirve a quien lo grabó",
  );
  afirmar(
    (await puedeOirse(grabacion.id, otroAlumno)) === false,
    "un archivo privado NO se le sirve a otro alumno",
  );
  afirmar(
    (await puedeOirse(grabacion.id, profesor)) === true,
    "un archivo privado se le sirve al profesor que tiene asignado a quien lo grabó",
  );
  afirmar(
    (await puedeOirse(grabacion.id, otroProfesor)) === false,
    "un archivo privado NO se le sirve a otro profesor",
  );
  afirmar(
    (await puedeOirse(grabacion.id, administrador)) === true,
    "un archivo privado se le sirve a un administrador",
  );
  afirmar(
    (await puedeOirse("noexiste", administrador)) === false,
    "un archivo que no existe da falso, sin reventar",
  );

  // Sin dueño no hay permiso que reconocer, ni siquiera a los dos que lo
  // tenían antes de que se suprimiera la ficha.
  afirmar(
    (await puedeOirse(huerfana.id, estudiante)) === false,
    "una grabación privada sin autor no se le sirve a un alumno",
  );
  afirmar(
    (await puedeOirse(huerfana.id, profesor)) === false,
    "ni a un profesor",
  );
  afirmar(
    (await puedeOirse(huerfana.id, administrador)) === true,
    "pero sí al administrador",
  );

  // La trampa. `otraGrabacion` es de `estudiante` y no está entregada en
  // ninguna parte; la única fila que la nombra es la que se planta ahora, en
  // la que `otroAlumno` pasa su dirección por redacción propia. Así la única
  // pista que ofrece `entrega` apunta al profesor equivocado: si el permiso
  // colgara de esa columna, las dos afirmaciones saldrían del revés.
  const otraGrabacion = await archivo("otra grabacion", true, estudiante.id);
  await prisma.pasoCompletado.create({
    data: {
      asignacionId: otraAsignacion.id,
      pasoId: pasoEscrita.id,
      entrega: `/api/archivos/${otraGrabacion.id}`,
    },
  });
  afirmar(
    (await puedeOirse(otraGrabacion.id, otroProfesor)) === false,
    "un alumno no se abre la grabación ajena entregando su dirección como texto",
  );
  afirmar(
    (await puedeOirse(otraGrabacion.id, profesor)) === true,
    "y el profesor de quien la grabó la oye aunque no esté entregada en su recorrido",
  );

  // ─── puedeCitarse ───────────────────────────────────────────────────
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const suya = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: estudiante.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(suya.id);

  const motivoCita = await puedeCitarse(asignacion.id, pasoGrabada.id, "noexiste", profesor.id);
  afirmar(motivoCita !== null, "puedeCitarse rechaza una grabada");
  afirmar(
    motivoCita === "Esa tarea se entrega grabada: no hay nada que citar.",
    "con el motivo propio, antes de mirar siquiera si la clase existe",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, pasoClase.id, suya.id, profesor.id)) === null,
    "puedeCitarse acepta una oral de clase en una clase suya",
  );

  // ─── La puerta de la entrega ────────────────────────────────────────
  // La ruta no se puede llamar sin levantar un servidor, así que se afirma lo
  // que la ruta usa, que por eso vive en `lib/`.

  afirmar(
    TIPOS_AUDIO.includes("audio/webm") && TIPOS_AUDIO.includes("audio/mp4"),
    "la lista de tipos admite lo que graba el navegador: webm y mp4",
  );

  // `MediaRecorder` nunca entrega un tipo pelado: sin normalizar, la puerta
  // rechazaría todas las grabaciones del navegador con «eso no es un audio».
  const admitido = (tipo: string) => TIPOS_AUDIO.includes(tipoBase(tipo));
  afirmar(admitido("audio/webm;codecs=opus"), "se admite lo que graba Chrome, con su códec detrás");
  afirmar(admitido("audio/ogg; codecs=opus"), "y lo que graba Firefox, con su espacio y todo");
  afirmar(!admitido("video/mp4"), "un vídeo no cuela por parecerse");
  afirmar(!admitido("text/plain"), "ni un texto");
  afirmar(
    nombreDeGrabacion(tipoBase("audio/webm;codecs=opus")) === "grabacion.webm",
    "una grabación sin nombre sale de aquí con uno legible, y con su extensión",
  );

  // La asignación se deriva de la sesión y del paso: si viniera del
  // formulario, un alumno entregaría en la de otro.
  const derivadaSuya = await asignacionViva(estudiante.id, recorrido.id);
  afirmar(derivadaSuya?.id === asignacion.id, "de la sesión y el recorrido sale la asignación propia");
  const derivadaAjena = await asignacionViva(otroAlumno.id, recorrido.id);
  afirmar(
    derivadaAjena !== null && derivadaAjena.id !== asignacion.id,
    "y a otro alumno le sale la suya, nunca la del primero",
  );
  afirmar(
    (await asignacionViva(administrador.id, recorrido.id)) === null,
    "a quien no tiene el recorrido asignado no le sale ninguna: no puede entregar",
  );

  // El freno de «ya está corregida» es por asignación, no por paso: el paso
  // grabado sigue abierto para el otro alumno aunque el primero ya esté
  // corregido. Por eso la asignación con la que se pregunta tiene que salir
  // del servidor y no del formulario.
  afirmar(
    (await puedeEntregarAudio(otraAsignacion.id, pasoGrabada.id)) === null,
    "puedeEntregarAudio mira solo la asignación por la que se pregunta",
  );

  const pasoOtraGrabada = await pasoConEjercicio("Otra oral grabada", 5, ORAL_GRABADA);
  await anotarEntrega(asignacion.id, pasoOtraGrabada.id, `/api/archivos/${grabacion.id}`);
  const primera = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId: pasoOtraGrabada.id } },
    select: { entrega: true },
  });
  // La página del paso lee `hecho = Boolean(registro)`: entregar la grabación
  // crea la fila, y con ella el paso queda hecho.
  afirmar(Boolean(primera), "una grabación entregada deja el paso hecho");
  afirmar(primera?.entrega === `/api/archivos/${grabacion.id}`, "y la entrega apunta a la grabación");

  // Corregida en medio, para comprobar lo que la segunda entrega NO pisa.
  await prisma.pasoCompletado.update({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId: pasoOtraGrabada.id } },
    data: { valoracion: { notas: { c1: 2 }, comentario: "Vale." } },
  });

  await anotarEntrega(asignacion.id, pasoOtraGrabada.id, `/api/archivos/${otraGrabacion.id}`);
  afirmar(
    (await prisma.pasoCompletado.count({
      where: { asignacionId: asignacion.id, pasoId: pasoOtraGrabada.id },
    })) === 1,
    "una segunda entrega cae en la misma fila, no crea otra",
  );
  const segunda = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId: pasoOtraGrabada.id } },
    select: { entrega: true, valoracion: true },
  });
  afirmar(segunda?.entrega === `/api/archivos/${otraGrabacion.id}`, "y se queda la última grabación");
  afirmar(segunda?.valoracion !== null, "sin borrar la valoración que ya hubiera");

  // ─── guardarGrabacion ───────────────────────────────────────────────
  // Lo que sostiene la barrera de la privacidad: si `privado` sale apagado, la
  // grabación se sirve a cualquiera con la dirección; si `subidoPorId` no es
  // el del alumno, su profesor no puede oírla.
  const tope = await guardarGrabacion(estudiante.id, asignacion.id, pasoOtraGrabada.id, {
    datos: Buffer.alloc(MAXIMO_AUDIO_GUARDADO + 1),
    tipo: "audio/mp4",
    nombre: "grabacion.m4a",
  });
  afirmar(tope !== null, "una grabación que pasa del tope ya comprimida se rechaza");
  const trasElTope = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId: pasoOtraGrabada.id } },
    select: { entrega: true },
  });
  afirmar(
    trasElTope?.entrega === `/api/archivos/${otraGrabacion.id}`,
    "y la rechazada no toca la entrega que ya había",
  );

  afirmar(
    (await guardarGrabacion(estudiante.id, asignacion.id, pasoOtraGrabada.id, {
      datos: Buffer.from([1, 2, 3]),
      tipo: "audio/mp4",
      nombre: "grabacion.m4a",
    })) === null,
    "una grabación dentro del tope se guarda",
  );
  const tercera = await prisma.pasoCompletado.findUnique({
    where: { asignacionId_pasoId: { asignacionId: asignacion.id, pasoId: pasoOtraGrabada.id } },
    select: { entrega: true, valoracion: true },
  });
  const guardadaId = tercera!.entrega!.replace("/api/archivos/", "");
  archivoIds.push(guardadaId);
  const guardada = await prisma.archivo.findUnique({
    where: { id: guardadaId },
    select: { privado: true, subidoPorId: true },
  });
  afirmar(guardada?.privado === true, "lo guardado es privado: no se sirve a quien tenga la dirección");
  afirmar(guardada?.subidoPorId === estudiante.id, "y firmado por el alumno que grabó");
  afirmar(
    (await puedeOirse(guardadaId, profesor)) === true,
    "por eso su profesor la oye, que es de lo que depende que pueda corregirla",
  );
  afirmar(tercera?.valoracion !== null, "y guardarla tampoco borró la valoración");

  // Un recorrido archivado se cierra también por este lado.
  await prisma.asignacion.update({ where: { id: otraAsignacion.id }, data: { archivada: true } });
  afirmar(
    (await asignacionViva(otroAlumno.id, recorrido.id)) === null,
    "una asignación archivada ya no sirve para entregar",
  );

  // ─── Lo entregado manda sobre la modalidad de hoy ───────────────────
  // La modalidad de un ejercicio se cambia con dos clics, también después de
  // que alguien haya entregado. Quien decida por la tarea le dará un texto por
  // `src` a un reproductor y dejará la redacción sin enseñar en ninguna parte.
  afirmar(
    esGrabacionEntregada(`${PREFIJO_GRABACION}${guardadaId}`),
    "una entrega que apunta a un archivo es una grabación",
  );
  afirmar(
    !esGrabacionEntregada("Ayer fui al mercado y compré fruta."),
    "y la redacción de una escrita no lo es, aunque la tarea ya sea grabada",
  );
  afirmar(!esGrabacionEntregada(null), "sin entrega no hay grabación que pintar");
  afirmar(
    !esGrabacionEntregada("https://otrositio.example/api/archivos/x"),
    "ni una dirección de fuera que acabe pareciéndose",
  );

  // ─── Los trozos, que es lo que hace sonar el audio en Safari ────────
  // La ruta no se puede llamar sin levantar un servidor, así que se afirma lo
  // que la ruta usa, que por eso vive en `lib/`. Se trocea de verdad: cada
  // trozo se corta del mismo Buffer y se comprueba lo que sale.
  const bytes = Buffer.from("0123456789");
  const trozo = (cabecera: string | null) => interpretarRango(cabecera, bytes.length);
  const cortar = (r: Rango) =>
    r.clase === "trozo" ? bytes.subarray(r.inicio, r.fin + 1).toString() : null;

  afirmar(trozo(null).clase === "entero", "sin cabecera se manda el archivo entero");
  afirmar(cortar(trozo("bytes=0-3")) === "0123", "un trozo del principio sale entero y sin pasarse");
  afirmar(cortar(trozo("bytes=4-6")) === "456", "y uno de en medio empieza y acaba donde se pidió");
  afirmar(cortar(trozo("bytes=0-0")) === "0", "un solo byte es un byte: el final va incluido");
  afirmar(cortar(trozo("bytes=7-")) === "789", "sin final se manda de ahí hasta el último byte");
  afirmar(cortar(trozo("bytes=-3")) === "789", "y con solo final se mandan los últimos");
  afirmar(
    cortar(trozo("bytes=-99")) === "0123456789",
    "pedir más cola de la que hay devuelve el archivo, no un error",
  );
  afirmar(
    cortar(trozo("bytes=8-99")) === "89",
    "un final pasado se recorta: el cliente aún no sabe lo que pesa",
  );
  // Lo que de verdad dispara un 416: un cliente que cree que el archivo es más
  // grande de lo que es y empieza a leer donde ya no hay nada.
  afirmar(trozo("bytes=10-").clase === "imposible", "empezar en el byte que sigue al último es un 416");
  afirmar(trozo("bytes=99-100").clase === "imposible", "y empezar más allá, también");
  afirmar(trozo("bytes=5-2").clase === "imposible", "un rango del revés no se sirve");
  afirmar(trozo("bytes=-0").clase === "imposible", "ni los últimos cero bytes, que no son nada");
  afirmar(trozo("bytes=abc").clase === "imposible", "ni una cabecera que no se entiende");
  afirmar(trozo("bytes=-").clase === "imposible", "ni una sin ningún número");
  afirmar(
    interpretarRango("bytes=0-", 0).clase === "imposible",
    "de un archivo vacío no sale ningún trozo",
  );
  // La norma manda ignorar una unidad que no se entiende, no rechazarla: el
  // archivo entero es una contestación válida a cualquier `Range`.
  afirmar(trozo("elefantes=0-3").clase === "entero", "una unidad rara se ignora y se manda entero");
  afirmar(
    trozo("bytes=0-1,5-6").clase === "entero",
    "y varios trozos de una vez también: no sabemos escribir multipart",
  );

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` mataría el proceso antes del `finally` y la limpieza no
    // correría: en TDD el paso que falla lo hace a propósito, así que eso
    // dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    async function intentar(que: string, fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (e) {
        fallos++;
        console.error(`FALLO AL LIMPIAR (${que}): ${e instanceof Error ? e.message : e}`);
      }
    }
    // El orden importa: los vínculos antes que sus extremos.
    if (asignacionIds.length) {
      await intentar("citas", () => prisma.citaOral.deleteMany({ where: { asignacionId: { in: asignacionIds } } }));
      await intentar("pasos completados", () =>
        prisma.pasoCompletado.deleteMany({ where: { asignacionId: { in: asignacionIds } } }),
      );
      await intentar("asignaciones", () => prisma.asignacion.deleteMany({ where: { id: { in: asignacionIds } } }));
    }
    if (pasoIds.length) {
      // Antes que sus ejercicios: borrar el paso arrastra en cascada su
      // `PasoEjercicio`, así que el ejercicio queda libre justo después.
      await intentar("pasos", () => prisma.paso.deleteMany({ where: { id: { in: pasoIds } } }));
    }
    if (ejercicioIds.length) {
      await intentar("ejercicios", () => prisma.ejercicio.deleteMany({ where: { id: { in: ejercicioIds } } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    if (claseIds.length) {
      // Antes que los usuarios: Clase.profesorId es RESTRICT.
      await intentar("clases", () => prisma.clase.deleteMany({ where: { id: { in: claseIds } } }));
    }
    if (archivoIds.length) {
      // Aquí y no confiando en el borrado del usuario: la relación es
      // opcional, así que borrarlo dejaría el archivo huérfano, no borrado.
      await intentar("archivos", () => prisma.archivo.deleteMany({ where: { id: { in: archivoIds } } }));
    }
    if (usuarioIds.length) {
      await intentar("usuarios", () => prisma.user.deleteMany({ where: { id: { in: usuarioIds } } }));
    }
    await intentar("desconectar", () => prisma.$disconnect());
    if (fallos > 0) {
      console.error(`\n${fallos} paso(s) de limpieza fallaron: puede quedar basura en la base.`);
      process.exitCode = 1;
    }
  });
