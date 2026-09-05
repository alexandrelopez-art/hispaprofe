"use client";

import { useRef, useState } from "react";
import { pedirEscucha } from "@/lib/acciones-escuchas";

/** `1:24`, o `0:00` si `segundos` aún no es un número usable. */
function formatoTiempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const mins = Math.floor(segundos / 60);
  const secs = Math.floor(segundos % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Espera a que el audio suene de verdad, no solo a que el navegador acepte
 * reproducirlo. `play()` resuelve en cuanto el navegador *puede* arrancar,
 * no cuando ya suena; `playing` es la confirmación real, y `error` la
 * señal de que nunca va a sonar (`src` roto, red caída a media carga). Sin
 * esto se podía cobrar una escucha sobre un `play()` que resolvió pero
 * nunca llegó a sonar.
 *
 * Exportada para que `ReproductorEncadenado` (examen blanco, Tarea 5) la
 * reutilice tal cual: la misma comprobación hace falta en el primer trozo
 * de la tira encadenada, y duplicarla sería la forma segura de que un día
 * se corrija aquí y no allí.
 */
export function reproducirYConfirmar(el: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    function sonando() {
      limpiar();
      resolve();
    }
    function fallo() {
      limpiar();
      reject(new Error("El audio no ha podido reproducirse."));
    }
    function limpiar() {
      el.removeEventListener("playing", sonando);
      el.removeEventListener("error", fallo);
    }
    el.addEventListener("playing", sonando, { once: true });
    el.addEventListener("error", fallo, { once: true });
    el.play().catch(fallo);
  });
}

/**
 * Un audio que solo suena las veces que deja el examen.
 *
 * Solo se cobra una escucha si el audio de verdad empieza a sonar
 * (`reproducirYConfirmar`, más abajo): antes se pedía la escucha primero y
 * se reproducía después, así que un `play()` bloqueado por la política de
 * autoplay del navegador o un `src` que no cargaba se comían una de las dos
 * oportunidades del examen sin que sonara nada. En un examen una escucha
 * perdida no se recupera.
 *
 * Una vez concedida la escucha, pausar y reanudar no cuestan nada: es la
 * misma escucha, solo detenida a media reproducción — el examen real
 * tampoco penaliza que suenen unos segundos, se pare y se retome. Lo que no
 * se puede es rebobinar: la barra de progreso es decorativa (sin
 * `onClick` ni control de rango) porque una barra arrastrable dejaría
 * volver al principio y oír el audio entero gratis, y el contador de
 * escuchas dejaría de significar nada.
 *
 * El contador vive en el servidor porque uno en el navegador se devuelve
 * recargando la página, y entonces no cuenta nada. `usadas` llega ya
 * calculado desde el servidor (una lectura de `escuchasDelPaso` hecha en la
 * página) para que, tras recargar, el botón diga la verdad desde el primer
 * render y no solo después de un clic.
 */
export default function Reproductor({
  src,
  pasoId,
  clave,
  maximo,
  usadas,
  cerrado,
}: {
  src: string;
  pasoId: string;
  clave: string;
  /**
   * Solo para el rótulo antes de tocar nada. El servidor no se fía de este
   * número: `pedirEscucha` no lo recibe, y resuelve el tope por su cuenta
   * mirando a qué corresponde `clave` (`maximoDeEscucha`, en
   * `lib/escuchas.ts`). Mandarlo aquí con un valor distinto no cambia
   * cuántas veces se puede oír de verdad.
   */
  maximo: number;
  /** Cuántas de esas ya están gastadas, sabido de antemano por el servidor. */
  usadas: number;
  /**
   * El ejercicio ya está respondido, o no hay paso al que apuntar
   * (previsualización del profesor): no tiene sentido seguir contando, así
   * que se cae en un `<audio controls>` normal con la barra arrastrable de
   * siempre — aquí no hay ninguna escucha que proteger.
   */
  cerrado: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  // Cerrojo síncrono: el estado `pidiendo` no cambia hasta el siguiente
  // render, así que un doble clic disparado antes de ese render vería en su
  // closure el mismo `pidiendo` de siempre y llamaría a `sonar()` dos
  // veces. La `ref` sí cambia al instante.
  const pidiendoRef = useRef(false);

  const inicial = Math.max(0, maximo - usadas);
  const [quedan, setQuedan] = useState(inicial);
  const [agotado, setAgotado] = useState(inicial <= 0);
  const [pidiendo, setPidiendo] = useState(false);
  // Distinto de `agotado`: esto es "algo ha ido mal, prueba otra vez", no
  // "ya no te quedan". Antes los dos casos enseñaban el mismo cartel
  // («Sin escuchas»), que es falso en este —aquí sí se puede reintentar—.
  const [error, setError] = useState<string | null>(null);

  // Mientras es `true` se pintan los controles propios (pausa/reanudar,
  // tiempo, barra) en vez del botón «Escuchar». No es lo mismo que
  // `pausado`: se sigue "reproduciendo" mientras está en pausa, solo que
  // detenido a media escucha.
  const [reproduciendo, setReproduciendo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(NaN);

  // Ya respondido, o previsualización del profesor: se puede oír sin
  // contar y con los controles nativos completos, que es lo que hace falta
  // para repasar la corrección o probar el ejercicio a gusto.
  if (cerrado) {
    return (
      <audio controls preload="none" src={src} className="w-full max-w-sm">
        Tu navegador no puede reproducir este audio.
      </audio>
    );
  }

  async function sonar() {
    if (pidiendoRef.current || agotado) return;
    const el = audio.current;
    if (!el) {
      setError("No ha sonado. Vuelve a intentarlo.");
      return;
    }
    pidiendoRef.current = true;
    setPidiendo(true);
    setError(null);

    // Una escucha empieza siempre por el principio —igual que en el
    // examen—, nunca donde se cortó la anterior: sin este reinicio, una
    // escucha abortada a mitad (un error reintentable, o la negativa del
    // servidor) dejaba que la siguiente reanudara desde ese punto — o se
    // pagaba una escucha entera por oír solo la cola del audio, o, en el
    // caso reintentable, se avanzaba el audio a trozos sin pagar ninguna.
    // `setTiempo(0)` es solo para que la etiqueta no arrastre el valor
    // final de la escucha anterior hasta que llegue el primer
    // `timeupdate`.
    el.currentTime = 0;
    setTiempo(0);

    try {
      await reproducirYConfirmar(el);
    } catch {
      pidiendoRef.current = false;
      setPidiendo(false);
      setError("No ha sonado. Vuelve a intentarlo.");
      return;
    }

    // A partir de aquí el audio ya suena de verdad: se enseñan los
    // controles de reproducción mientras se confirma la escucha con el
    // servidor.
    setReproduciendo(true);

    let r: Awaited<ReturnType<typeof pedirEscucha>>;
    try {
      r = await pedirEscucha(pasoId, clave);
    } catch {
      // Ya sonaba cuando la red falló: nada lo autorizó en el servidor, así
      // que no se deja sonando gratis.
      el.pause();
      pidiendoRef.current = false;
      setPidiendo(false);
      setReproduciendo(false);
      setError("No se ha podido comprobar la escucha. Vuelve a intentarlo.");
      return;
    }
    pidiendoRef.current = false;
    setPidiendo(false);

    if ("error" in r) {
      // El servidor niega el permiso pese a que ya sonaba —agotado de
      // verdad, sesión caída a mitad, o una carrera entre dos pestañas—: se
      // corta, porque no se debe dejar sonando algo que no se autorizó.
      el.pause();
      setReproduciendo(false);
      if (r.agotado) {
        setAgotado(true);
        setQuedan(0);
      } else {
        setError(r.error);
      }
      return;
    }
    setQuedan(r.quedan);
    // "Era la última" no basta: si no se cierra aquí, un alumno que gasta
    // su última escucha sin recargar la página ve un botón habilitado que
    // invita a «Escuchar otra vez», y al pulsarlo el audio llega a arrancar
    // —por el orden de `sonar()`— y se corta solo cuando el servidor lo
    // niega. Con esto, el botón pasa a «Sin escuchas» en el mismo render
    // que confirma que ya no quedaba ninguna, sin esperar a un clic más.
    if (r.quedan === 0) setAgotado(true);
  }

  // Pausar y reanudar no llaman al servidor ni pasan por `sonar()`: es la
  // misma escucha ya concedida, solo detenida a media reproducción. Se lee
  // `el.paused` en el momento del clic, no el estado `pausado` (que puede
  // ir un render por detrás), para no reanudar algo que ya suena o al
  // revés.
  function alternarPausa() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  const progreso =
    Number.isFinite(duracion) && duracion > 0 ? Math.min(100, (tiempo / duracion) * 100) : 0;

  return (
    <div className="space-y-1">
      <audio
        ref={audio}
        preload="none"
        src={src}
        className="hidden"
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTiempo(e.currentTarget.currentTime)}
        onPlay={() => setPausado(false)}
        onPause={() => setPausado(true)}
        onEnded={() => {
          setReproduciendo(false);
          setPausado(false);
        }}
      >
        Tu navegador no puede reproducir este audio.
      </audio>

      {reproduciendo ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={alternarPausa}
            className="h-9 shrink-0 rounded-full bg-hp-400 px-5 text-sm font-extrabold text-white transition-colors hover:bg-hp-500"
          >
            {pausado ? "Reanudar" : "Pausa"}
          </button>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-tinta-suave">
            {formatoTiempo(tiempo)} / {Number.isFinite(duracion) ? formatoTiempo(duracion) : "--:--"}
          </span>
          {/* Decorativa a propósito: sin `onClick` ni `input type="range"`,
              para que nadie pueda arrastrarla al principio y oír el audio
              entero sin gastar la escucha que ya se concedió. */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hp-100">
            <div className="h-full rounded-full bg-hp-400" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={sonar}
            disabled={pidiendo || agotado}
            className="h-9 rounded-full bg-hp-400 px-5 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {agotado
              ? "Sin escuchas"
              : pidiendo
                ? "…"
                : quedan === maximo
                  ? "Escuchar"
                  : "Escuchar otra vez"}
          </button>

          <p className="text-xs text-tinta-suave">
            {agotado
              ? "Ya lo has oído todas las veces."
              : error
                ? error
                : quedan === maximo
                  ? `Puedes oírlo ${maximo} ${maximo === 1 ? "vez" : "veces"}.`
                  : quedan === 0
                    ? "Era la última."
                    : `Te queda ${quedan} ${quedan === 1 ? "escucha" : "escuchas"}.`}
          </p>
        </>
      )}
    </div>
  );
}
