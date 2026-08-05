"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

/**
 * El tope duro de la grabadora, en minutos.
 *
 * Vive solo aquí, y no tiene gemelo en el servidor: **el servidor no comprueba
 * la duración de nada**. Lo tuvo, en forma de constante que no consumía nadie,
 * y eso era peor que no tenerlo —parecía un tope y no frenaba—. Esto es una
 * cortesía con el alumno, para que la grabadora no se quede corriendo dos
 * horas; el tope real de lo que entra en la base es el tamaño, y lo ponen
 * `MAXIMO_AUDIO_RECIBIDO` y `MAXIMO_GRABACION_GUARDADA` en `lib/expresion.ts`.
 * Cambiar este número no exige tocar el servidor.
 */
const MINUTOS_MAXIMOS = 15;

/** Los mismos minutos, en segundos, que es en lo que cuenta el reloj. */
const SEGUNDOS_MAXIMOS = MINUTOS_MAXIMOS * 60;

/**
 * Las entregas grabadas son siempre una dirección de `/api/archivos`.
 *
 * Copiado a mano por lo mismo que el tope de arriba: el canónico es
 * `PREFIJO_GRABACION` en `lib/expresion.ts`, que importa `prisma`. Las dos
 * copias tienen que moverse juntas.
 */
const PREFIJO_ARCHIVO = "/api/archivos/";

/**
 * La extensión que le toca a cada contenedor. Solo sirve para ponerle nombre
 * al Blob: sin nombre, `FormData` no lo manda como archivo y la puerta
 * contesta «No llegó ninguna grabación». El servidor lo renombra al guardarlo,
 * así que aquí basta con que sea coherente.
 */
const EXTENSIONES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

function tipoPelado(tipo: string): string {
  return tipo.split(";")[0].trim().toLowerCase();
}

function nombreDeGrabacion(tipo: string): string {
  return `grabacion.${EXTENSIONES[tipoPelado(tipo)] ?? "webm"}`;
}

/**
 * Lo que la puerta va a aceptar. Copia a mano de `TIPOS_AUDIO` en
 * `lib/audio.ts`, que es el canónico, por lo mismo que el resto de copias de
 * este archivo: ese módulo es de servidor. Las dos listas tienen que moverse
 * juntas; si esta se queda corta, el único daño es que el alumno se entere del
 * rechazo un segundo más tarde, porque quien decide sigue siendo el servidor.
 */
const TIPOS_ADMITIDOS = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
];

/**
 * Lo que el selector de archivos ofrece. `audio/*` dejaba elegir un `.flac`
 * —que la puerta rechaza— y el diálogo del sistema no daba ninguna pista de
 * cuáles valen.
 */
const FORMATOS_OFRECIDOS = [...TIPOS_ADMITIDOS, ".mp3", ".m4a", ".ogg", ".wav", ".webm"].join(",");

/**
 * El tope de lo que la puerta acepta recibir. Copia a mano de
 * `MAXIMO_AUDIO_RECIBIDO` en `lib/expresion.ts`, y las dos tienen que moverse
 * juntas. Comprobarlo aquí no es adornar: un archivo que se pasa no llega
 * siquiera a la puerta —lo corta Vercel, o el proxy en local— y el alumno
 * recibía «No se pudo leer la grabación enviada. Vuelve a intentarlo»,
 * después de la subida y sin que reintentar arreglara nada.
 */
const MAXIMO_ARCHIVO = 4 * 1024 * 1024;

/** «4,2 MB», para poder decirle al alumno cuánto pesa lo que ha elegido. */
function enMegas(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

/**
 * El caudal con el que graba, en bits por segundo.
 *
 * Sin esto Chrome graba a unos 128 kbps, y los quince minutos que la propia
 * grabadora permite salen a 14 MB: un rechazo seguro, porque el tope de lo que
 * se puede mandar son cuatro. A 32 kbps esos quince minutos rondan los 3,6 MB.
 *
 * El códec de verdad no lo decide este número, lo decide el navegador según lo
 * que acepte de `CONTENEDORES`: ese pide `audio/mp4;codecs=mp4a.40.2`
 * primero, y Chrome, Edge y Safari lo aceptan, así que en la mayoría de los
 * casos lo que se graba a 32 kbps es AAC-LC, no Opus —y AAC-LC a 32 kbps mono
 * es peor que Opus al mismo caudal—. El margen contra el tope es de todos
 * modos solo 400 KB: es un caudal medio y no un techo, así que una grabación
 * con mucho ruido de fondo puede pasarse un poco, y por eso el tope de
 * `entregarAudio` sigue ahí, para cazarla y explicarlo. Si al escuchar una
 * grabación de verdad la calidad no da la talla, la salida no es subir este
 * número —vuelve a acercarse al tope—, es preferir Opus en `CONTENEDORES`,
 * ahora que en producción sí hay un `ffmpeg` empaquetado que sabe abrirlo.
 */
const CAUDAL = 32000;

/**
 * Los contenedores que se le piden a `MediaRecorder`, en orden de preferencia.
 *
 * No es un capricho de formatos, aunque hoy importa en un solo sitio: en la
 * máquina del profesor, que no tiene `ffmpeg` instalado, el compresor que se
 * usa es `afconvert`, que es CoreAudio y **no sabe abrir WebM**. Ahí, dejar
 * que Chrome elija su contenedor por defecto (`audio/webm;codecs=opus`)
 * rebotaba en «No se pudo procesar la grabación» sin ninguna otra puerta. En
 * producción esto ya no hace falta para que la grabación pase: siempre viaja
 * un `ffmpeg` empaquetado (`ffmpeg-static`), y ese sí abre WebM. MP4 y Ogg se
 * piden primero de todos modos, porque el único sitio donde de verdad hace
 * falta es ese Mac.
 *
 * Y no basta con pedir el envase: hay que pedir también el contenido. Pedir
 * `audio/mp4` a secas le deja a Chrome elegir el códec, y elige Opus, que
 * CoreAudio tampoco sabe descodificar aunque el MP4 sí lo abra —el error que
 * dio en la máquina de Pablo el 01/08/2026 fue
 * `ExtAudioFileSetProperty ('cfmt') failed ('pck?')`, que es justo eso: envase
 * entendido, contenido no—. Por eso el primer candidato nombra el códec, AAC,
 * y el `audio/mp4` pelado se queda detrás para Safari, que con él da AAC.
 *
 * No sustituye al reintento del servidor: aquí no se puede saber qué acepta el
 * navegador de cada alumno, y `isTypeSupported` miente en algunos. Las dos
 * mitades tienen que estar.
 */
const CONTENEDORES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
];

/**
 * El primer contenedor de la lista que este navegador sepa producir, o `null`
 * si ninguno —o si el navegador no tiene `isTypeSupported`, que existe desde
 * el primer día pero no está de más comprobarlo—. Con `null` se construye el
 * `MediaRecorder` sin opciones: mejor grabar y arriesgarse al rechazo del
 * servidor que dejar al alumno sin botón.
 */
function contenedorPreferido(): string | null {
  if (typeof MediaRecorder.isTypeSupported !== "function") return null;
  return CONTENEDORES.find((tipo) => MediaRecorder.isTypeSupported(tipo)) ?? null;
}

/**
 * Si este navegador sabe grabar.
 *
 * Se lee con `useSyncExternalStore` y no en un efecto porque es un dato que en
 * el servidor no existe: la primera pintada tiene que coincidir con la del
 * navegador o la hidratación se queja. En el servidor damos por buena la
 * grabadora —el botón «Grabar»— y al hidratar, si resulta que no la hay, la
 * pantalla cambia al rodeo.
 */
function haySoporte(): boolean {
  return typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices);
}

/** Nada a lo que suscribirse: el soporte del navegador no cambia en marcha. */
function sinSuscripcion(): () => void {
  return () => {};
}

/** El reloj que ve el alumno: `m:ss`. */
function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Lo que el alumno tiene grabado y todavía no ha entregado. Los tres van
 * juntos porque se crean y se tiran juntos: el `url` es un `createObjectURL`
 * del `blob` y hay que revocarlo antes de soltarlo.
 */
type Pendiente = { blob: Blob; nombre: string; url: string };

/**
 * `"entregado"` no es un paso más del ciclo de grabar: es la pantalla que
 * sostiene el «ya está mandado» mientras el servidor vuelve. Sin él, entre el
 * clic y el refresco la pantalla volvía a su estado inicial —el botón
 * «Grabar», sin ninguna señal de haber entregado— y con la conexión lenta eso
 * se lee como «no ha entrado»: el alumno graba otra vez y manda dos.
 */
type Estado = "inicio" | "grabando" | "grabado" | "enviando" | "entregado";

/**
 * El alumno graba su tarea oral, se escucha, repite si quiere y la entrega.
 *
 * Todo lo que decide de verdad —quién puede, hasta cuándo, y qué se guarda—
 * vive en el servidor: aquí solo se produce el audio y se manda a
 * `/api/entregas/audio`. Lo que esta pantalla enseñe o esconda no autoriza
 * nada.
 */
export default function Grabadora({
  pasoId,
  minutos,
  entrega,
  cerrada,
}: {
  pasoId: string;
  /** Los minutos que pide la tarea. Avisan, no cortan: 0 si no se dijeron. */
  minutos: number;
  /** La dirección de lo ya entregado, si ya entregó. */
  entrega: string | null;
  /** No se puede tocar: ya está corregida, o la asignación está archivada. */
  cerrada: boolean;
}) {
  const router = useRouter();
  /** El refresco de la página, para poder decir que aún está en camino. */
  const [refrescando, empezarTransicion] = useTransition();

  const [estado, setEstado] = useState<Estado>("inicio");
  const [segundos, setSegundos] = useState(0);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /**
   * Se ha pedido «Volver a grabar» sobre una entrega que ya existe: hasta que
   * entre la nueva, hay que enseñar la grabadora y no el reproductor de la
   * vieja.
   */
  const [regrabando, setRegrabando] = useState(false);
  /**
   * Qué entrega había en la prop cuando se mandó la última grabación. Es lo
   * que permite saber que el refresco ya aterrizó —la prop ya es otra— y que
   * hay una grabación del servidor que enseñar. En estado y no en un `useRef`
   * porque se lee al pintar, y un `ref` leído al pintar no repinta nada.
   */
  const [entregaAlMandar, setEntregaAlMandar] = useState<string | null>(null);
  /**
   * El micrófono no se ha dejado usar: permiso denegado, o ninguno conectado.
   * Es la otra mitad del rodeo, y una vez encendida se queda: el permiso
   * denegado no se vuelve a pedir en la misma visita.
   */
  const [sinMicrofono, setSinMicrofono] = useState(false);
  /**
   * El rodeo: `<input type="file">`, la única puerta de repuesto de quien no
   * puede grabar aquí dentro.
   */
  const rodeo = !useSyncExternalStore(sinSuscripcion, haySoporte, () => true) || sinMicrofono;

  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const pistaRef = useRef<MediaStream | null>(null);
  /** Cuándo se empezó a grabar, para que el reloj no dependa del intervalo. */
  const inicioRef = useRef(0);
  // El `url` del pendiente, aparte, para poder revocarlo al desmontar sin
  // colgar el efecto de limpieza de un estado que cambia.
  const urlRef = useRef<string | null>(null);
  /**
   * Ya se está pidiendo el micrófono. `getUserMedia` es una espera, y hasta
   * que vuelve el botón sigue pintado: sin esta guarda, un segundo clic
   * —normal en un móvil, y con el permiso ya concedido la espera es de dos
   * décimas— abría una segunda pista que pisaba a la primera en `pistaRef`, y
   * la primera se quedaba encendida hasta recargar la página.
   */
  const arrancandoRef = useRef(false);
  /**
   * El componente ya no está en pantalla. `onstop` puede llegar después de la
   * limpieza, y entonces no debe crear un `objectURL` que ya nadie va a
   * revocar: la navegación de Next es de cliente, así que el documento no se
   * recrea y ese Blob se queda anclado en memoria.
   */
  const desmontadoRef = useRef(false);

  /**
   * Suelta el micrófono. Sin esto el punto rojo del navegador se queda
   * encendido y el aparato ocupado aunque la grabación haya terminado.
   */
  const soltarPista = useCallback(() => {
    pistaRef.current?.getTracks().forEach((t) => t.stop());
    pistaRef.current = null;
  }, []);

  const detener = useCallback(() => {
    // La pista se suelta dentro de `onstop`, cuando ya está armado el Blob:
    // cortarle el sonido a un `MediaRecorder` que todavía no ha terminado de
    // volcar es la forma de perder el último trozo.
    if (grabadoraRef.current?.state === "recording") grabadoraRef.current.stop();
    else soltarPista();
  }, [soltarPista]);

  // Al desmontar: el micrófono se suelta y el objeto se revoca. Si no, cambiar
  // de paso a media grabación deja el micrófono abierto. No depende de que
  // `onstop` llegue: para las pistas él mismo.
  //
  // La bandera se apaga al montar y no solo al desmontar: en desarrollo React
  // monta, desmonta y vuelve a montar, y una bandera que solo se encendiera
  // dejaría el segundo montaje creyéndose muerto —ninguna grabación se
  // guardaría—.
  useEffect(() => {
    desmontadoRef.current = false;
    return () => {
      desmontadoRef.current = true;
      if (grabadoraRef.current?.state === "recording") grabadoraRef.current.stop();
      pistaRef.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  // El reloj, y con él el corte duro. Se limpia en el `return`: sin eso queda
  // un intervalo por cada grabación empezada.
  //
  // Los segundos se calculan restando la hora de inicio y no sumando uno por
  // tic: un navegador en segundo plano frena los intervalos, y un reloj que
  // suma tics diría que van cinco minutos cuando van doce —y el corte duro
  // llegaría tardísimo—.
  useEffect(() => {
    if (estado !== "grabando") return;
    const id = setInterval(() => {
      const van = Math.floor((Date.now() - inicioRef.current) / 1000);
      setSegundos(van);
      // Los minutos de la tarea solo avisan; esto es lo que impide una
      // grabación de dos horas. Y se dice: una grabadora que se para sola sin
      // explicarlo parece rota.
      if (van >= SEGUNDOS_MAXIMOS) {
        setAviso(`Se ha parado sola: el máximo son ${MINUTOS_MAXIMOS} minutos.`);
        detener();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [estado, detener]);

  function guardarPendiente(blob: Blob, nombre: string) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setPendiente({ blob, nombre, url });
    setEstado("grabado");
  }

  async function empezar() {
    // Guarda de reentrada: hasta que `getUserMedia` vuelva, el botón sigue en
    // pantalla y un segundo clic abriría una segunda pista que la primera no
    // sobreviviría. Ver `arrancandoRef`.
    if (arrancandoRef.current) return;
    arrancandoRef.current = true;
    setError(null);
    setAviso(null);

    try {
      let pista: MediaStream;
      try {
        // Un canal, no dos: es voz, y el estéreo dobla el tamaño para no
        // aportar nada. `ideal` y no un número pelado a propósito: como
        // restricción exacta, un micrófono que solo sepa dar estéreo haría
        // que `getUserMedia` fallara y el alumno se quedaría sin botón.
        pista = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: { ideal: 1 } },
        });
      } catch {
        // Permiso denegado o sin micrófono. No hay segundo intento que valga
        // la pena: se le ofrece el rodeo, que es lo que sí puede hacer.
        setSinMicrofono(true);
        setError(
          "No hemos podido usar tu micrófono. Puedes grabarte con otra aplicación y subir el archivo aquí.",
        );
        return;
      }

      // Nos han sacado de la pantalla mientras el navegador preguntaba por el
      // permiso. La limpieza del efecto ya corrió, y corrió con `pistaRef`
      // todavía en `null`: si seguimos, esta pista no la para nadie nunca y el
      // punto rojo se queda encendido hasta recargar la página.
      if (desmontadoRef.current) {
        pista.getTracks().forEach((t) => t.stop());
        return;
      }

      let grabadora: MediaRecorder;
      try {
        // El contenedor se pide, no se acepta el que salga: ver `CONTENEDORES`.
        const contenedor = contenedorPreferido();
        grabadora = contenedor
          ? new MediaRecorder(pista, { mimeType: contenedor, audioBitsPerSecond: CAUDAL })
          : new MediaRecorder(pista, { audioBitsPerSecond: CAUDAL });

        const trozos: Blob[] = [];
        grabadora.ondataavailable = (e) => {
          if (e.data.size > 0) trozos.push(e.data);
        };
        grabadora.onstop = () => {
          soltarPista();
          // Puede llegar cuando ya nos han sacado de la pantalla: entonces no
          // hay nada que guardar, y crear el `objectURL` sería dejarlo suelto.
          if (desmontadoRef.current) return;
          // El tipo, el que diga el navegador —el que se le pidió, si lo
          // aceptó—: llega con su códec detrás (`audio/mp4;codecs=opus`,
          // `audio/ogg; codecs=opus`) y pasa la puerta tal cual, que lo
          // normaliza el servidor. Inventarle uno aquí sería mentir sobre lo
          // que hay dentro del archivo.
          const tipo = grabadora.mimeType || trozos[0]?.type || "";
          const blob = new Blob(trozos, { type: tipo });
          if (blob.size === 0) {
            // Parar antes de que llegue el primer trozo, o un micrófono mudo.
            // Se dice aquí: mandarlo vacío solo consigue que el compresor del
            // servidor conteste «no se pudo procesar», que no explica nada.
            setError("No se ha grabado nada. Comprueba tu micrófono y vuelve a intentarlo.");
            setEstado("inicio");
            return;
          }
          guardarPendiente(blob, nombreDeGrabacion(tipo));
        };

        // Dentro del mismo `try` que el constructor: `start()` también lanza
        // —un contenedor que el navegador no sabe producir—, y fuera de aquí
        // se iba sin mensaje y dejando la pista encendida.
        inicioRef.current = Date.now();
        grabadora.start();
      } catch {
        pista.getTracks().forEach((t) => t.stop());
        setSinMicrofono(true);
        setError(
          "Este navegador no ha podido empezar a grabar. Puedes grabarte con otra aplicación y subir el archivo aquí.",
        );
        return;
      }

      // Solo cuando ya está grabando de verdad: guardar las referencias antes
      // dejaría apuntando a una grabadora que no llegó a arrancar.
      pistaRef.current = pista;
      grabadoraRef.current = grabadora;
      setPendiente(null);
      setSegundos(0);
      setEstado("grabando");
    } finally {
      arrancandoRef.current = false;
    }
  }

  function repetir() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPendiente(null);
    setSegundos(0);
    setError(null);
    setAviso(null);
    setEstado("inicio");
    // Y se deshace el «Volver a grabar»: repetir es arrepentirse de esta toma,
    // así que vuelve al punto de partida, que con una entrega hecha es el
    // reproductor de lo que ya entregó. Sin esto no había forma de volver a
    // oírlo sin recargar la página.
    setRegrabando(false);
  }

  async function entregarAudio() {
    if (!pendiente) return;
    setError(null);

    // `MAXIMO_ARCHIVO` también se comprueba en `elegirArchivo`, pero esa es
    // la vía del archivo subido por el rodeo. Esta es la vía de grabar aquí
    // dentro, y `CAUDAL` es una indicación para `MediaRecorder` y no un
    // techo: Firefox graba Ogg/Opus en VBR, así que una grabación larga con
    // ruido de fondo puede pasarse de los 4,5 MB que corta Vercel igual que
    // puede pasarse un archivo del rodeo. Sin esta comprobación la respuesta
    // no es JSON, el `catch` de más abajo la convierte en «No se pudo
    // entregar la grabación. Vuelve a intentarlo», y el alumno reintenta la
    // misma grabación para siempre.
    if (pendiente.blob.size > MAXIMO_ARCHIVO) {
      setError(
        `Esta grabación pesa ${enMegas(pendiente.blob.size)} y el tope son ` +
          `${enMegas(MAXIMO_ARCHIVO)}. Repite la toma, más corta.`,
      );
      return;
    }

    setEstado("enviando");

    const cuerpo = new FormData();
    cuerpo.set("pasoId", pasoId);
    // Con nombre: sin él, `FormData` manda el Blob como un campo de texto y la
    // puerta contesta «No llegó ninguna grabación».
    cuerpo.set("archivo", pendiente.blob, pendiente.nombre);

    let respuesta: Response;
    try {
      respuesta = await fetch("/api/entregas/audio", { method: "POST", body: cuerpo });
    } catch {
      // Lo grabado sigue en pantalla, con su reproductor y su botón: perderlo
      // porque se cayó la red sería lo peor que puede hacer esta pantalla.
      setError("No se pudo enviar la grabación. Comprueba tu conexión y vuelve a intentarlo.");
      setEstado("grabado");
      return;
    }

    // El cuerpo se lee venga con el código que venga: la puerta contesta con
    // el mismo `{ error }` en un 400, en un 403 y en un 500. El `catch` es
    // para cuando lo que llega no es JSON —un error del proxy, por ejemplo—.
    const json = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      setError(json?.error ?? "No se pudo entregar la grabación. Vuelve a intentarlo.");
      setEstado("grabado");
      return;
    }

    // Nada se limpia aquí: lo grabado se queda en pantalla, ya como entregado,
    // con su reproductor. Es lo que impide que entre el clic y el refresco
    // haya un instante en el que parezca que no se ha entregado nada.
    setEntregaAlMandar(grabacionEntregada);
    setAviso(null);
    setEstado("entregado");
    // Para que la página vuelva del servidor con la entrega ya guardada: de
    // ahí salen el reproductor de arriba y el estado del paso. Dentro de una
    // transición para poder decir que todavía está en camino; el refresco no
    // se lleva por delante el estado del cliente.
    empezarTransicion(() => router.refresh());
  }

  /**
   * Vuelve a la grabadora desde una entrega hecha —la que trae la prop o la
   * que se acaba de mandar—. `regrabando` es lo que impide que la pantalla
   * salte otra vez al reproductor de lo entregado.
   */
  function volverAGrabar() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPendiente(null);
    setSegundos(0);
    setError(null);
    setAviso(null);
    setEstado("inicio");
    setRegrabando(true);
  }

  function elegirArchivo(archivo: File) {
    setError(null);
    setAviso(null);
    setSegundos(0);

    // Los dos rechazos, aquí y no en el servidor, porque aquí se puede decir
    // qué hacer. El de la puerta llega después de subir 20 MB y no orienta.
    if (archivo.size > MAXIMO_ARCHIVO) {
      // Quien llega aquí solo puede hacerlo por el rodeo —el input de archivo
      // solo se pinta con `rodeo`, y el botón «Grabar» solo sin él, así que
      // son excluyentes—: no tiene micrófono o le denegaron el permiso, y no
      // hay ningún botón «arriba» que lo saque de este apuro.
      setError(
        `Ese archivo pesa ${enMegas(archivo.size)} y el tope son ${enMegas(MAXIMO_ARCHIVO)}. ` +
          `Manda un archivo más corto, o guárdalo en un formato comprimido (MP3 o M4A) antes de mandarlo.`,
      );
      return;
    }
    // Un tipo vacío no se rechaza: algunos sistemas no saben decir qué es un
    // archivo, y quien decide de verdad es el servidor. Solo se para lo que se
    // sabe que va a rebotar.
    const tipo = tipoPelado(archivo.type);
    if (tipo && !TIPOS_ADMITIDOS.includes(tipo)) {
      setError(
        `Ese formato no lo admitimos (${tipo}). Manda un MP3, un M4A, un OGG o un WAV.`,
      );
      return;
    }

    // Se queda a la espera con su reproductor, igual que una grabación hecha
    // aquí: así el alumno oye lo que va a mandar antes de mandarlo, y el envío
    // tiene un solo camino.
    guardarPendiente(archivo, archivo.name);
  }

  const enviando = estado === "enviando";
  // Solo se reproduce lo que es una grabación. `entrega` es la misma columna
  // donde vive la redacción de una escrita, así que una tarea que ayer era
  // escrita y hoy es grabada tiene ahí un texto: pintarlo como `src` de un
  // reproductor daría un audio roto.
  const grabacionEntregada =
    entrega && entrega.startsWith(PREFIJO_ARCHIVO) ? entrega : null;
  const pasado = minutos > 0 && segundos > minutos * 60;
  /**
   * La grabación que ya ha guardado el servidor, cuando el refresco de la
   * última entrega ha aterrizado de verdad (la prop ya no es la que había al
   * mandarla).
   *
   * Se prefiere al Blob local en cuanto existe, y no por pulcritud: la ruta
   * comprime con ffmpeg, así que lo que va a oír el profesor **no es** el Blob
   * que grabó el navegador. Si el alumno solo oyera el suyo, una compresión
   * que saliera muda pasaría inadvertida para los dos.
   */
  const entregadaDelServidor =
    estado === "entregado" &&
    grabacionEntregada &&
    grabacionEntregada !== entregaAlMandar
      ? grabacionEntregada
      : null;

  if (cerrada) {
    return (
      <div className="mt-6">
        {grabacionEntregada ? (
          <>
            <p className="text-sm text-tinta-suave">Esto es lo que entregaste:</p>
            <audio controls preload="none" src={grabacionEntregada} className="mt-2 w-full max-w-sm">
              Tu navegador no puede reproducir este audio.
            </audio>
          </>
        ) : (
          <p className="text-sm text-tinta-suave">Esta tarea ya no admite grabaciones.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-tinta-suave">
        Grábate aquí mismo y entrega la grabación
        {minutos > 0 ? `: la tarea dura unos ${minutos} minutos` : ""}.
      </p>

      {/*
        Recién entregado: se enseña lo que acaba de mandar, y no lo que traiga
        la prop `entrega`, que hasta que aterrice el refresco es todavía la
        entrega anterior —o nada, en la primera—. Esta pantalla no se va sola:
        se queda hasta que él pida grabar otra vez.
      */}
      {estado === "entregado" ? (
        <div className="mt-3">
          <p className="text-sm font-bold text-tinta">Entregado ✓ Ya lo tiene tu profe.</p>
          {/*
            Primero suena el Blob local, para que la confirmación no espere a
            nadie; en cuanto el servidor devuelve la suya, se cambia por ella,
            que es la que va a oír el profesor. El cambio no parpadea: las dos
            son un reproductor en el mismo sitio.
          */}
          {entregadaDelServidor ? (
            <audio
              controls
              preload="none"
              src={entregadaDelServidor}
              className="mt-2 w-full max-w-sm"
            >
              Tu navegador no puede reproducir este audio.
            </audio>
          ) : pendiente ? (
            <audio controls preload="none" src={pendiente.url} className="mt-2 w-full max-w-sm">
              Tu navegador no puede reproducir este audio.
            </audio>
          ) : null}
          {refrescando && (
            <p className="mt-2 text-sm text-tinta-suave">Actualizando la página…</p>
          )}
          <button
            type="button"
            onClick={volverAGrabar}
            className="mt-3 h-11 rounded-full border-2 border-hp-200 px-6 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
          >
            Volver a grabar
          </button>
        </div>
      ) : /* Con una entrega hecha, lo primero que se ve es esa grabación. La
             grabadora solo vuelve si él la pide. */
      grabacionEntregada && !regrabando ? (
        <div className="mt-3">
          <audio controls preload="none" src={grabacionEntregada} className="w-full max-w-sm">
            Tu navegador no puede reproducir este audio.
          </audio>
          <button
            type="button"
            onClick={volverAGrabar}
            className="mt-3 h-11 rounded-full border-2 border-hp-200 px-6 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
          >
            Volver a grabar
          </button>
        </div>
      ) : (
        <div className="mt-3">
          {pendiente && (
            <audio controls preload="none" src={pendiente.url} className="w-full max-w-sm">
              Tu navegador no puede reproducir este audio.
            </audio>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {estado === "inicio" && !rodeo && (
              <button
                type="button"
                onClick={empezar}
                className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500"
              >
                Grabar
              </button>
            )}

            {estado === "grabando" && (
              <button
                type="button"
                onClick={detener}
                className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500"
              >
                Parar
              </button>
            )}

            {(estado === "grabado" || enviando) && pendiente && (
              <>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={entregarAudio}
                  className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:opacity-40"
                >
                  {enviando ? "Entregando…" : grabacionEntregada ? "Volver a entregar" : "Entregar"}
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={repetir}
                  className="h-11 rounded-full border-2 border-hp-200 px-6 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400 disabled:opacity-40"
                >
                  Repetir
                </button>
              </>
            )}

            {(estado === "grabando" || segundos > 0) && (
              <span className={`text-sm ${pasado ? "font-bold text-tinta" : "text-tinta-suave"}`}>
                {minutos > 0 ? `${reloj(segundos)} de ${reloj(minutos * 60)}` : reloj(segundos)}
              </span>
            )}
          </div>

          {/*
            El rodeo. Se pinta cuando no hay `MediaRecorder` o el micrófono no
            se deja usar: sin él, ese alumno no tiene ninguna forma de entregar.
          */}
          {rodeo && estado !== "grabando" && (
            <div className="mt-3">
              <label className="text-sm text-tinta-suave">
                Sube tu grabación:{" "}
                <input
                  type="file"
                  accept={FORMATOS_OFRECIDOS}
                  disabled={enviando}
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo) elegirArchivo(archivo);
                    e.target.value = "";
                  }}
                  className="mt-2 block text-sm text-tinta"
                />
              </label>
            </div>
          )}

          {/*
            El aviso de los minutos no bloquea, igual que el contador de
            palabras de la escrita: pasarse es un error del alumno que el
            profesor puntúa, no algo que la aplicación deba impedirle.
          */}
          {pasado && (
            <p className="mt-2 text-sm text-tinta-suave">
              Te has pasado del tiempo que pide la tarea. Puedes entregarlo
              igual, pero cuenta para la nota.
            </p>
          )}
        </div>
      )}

      {aviso && (
        <p className="mt-3 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{aviso}</p>
      )}
      {error && (
        <p className="mt-3 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{error}</p>
      )}
    </div>
  );
}
