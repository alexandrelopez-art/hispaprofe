"use client";

import { useRef, useState } from "react";
import { pedirEscucha } from "@/lib/acciones-escuchas";
import { reproducirYConfirmar } from "./reproductor";
import Boton from "@/components/ui/boton";

/** `1:24`, o `0:00` si `segundos` aún no es un número usable. */
function formatoTiempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const mins = Math.floor(segundos / 60);
  const secs = Math.floor(segundos % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * La tarea auditiva del examen blanco, encadenada como en el examen real:
 * todos los trozos suenan seguidos, la grabación entera se repite dos
 * veces, y las dos repeticiones juntas cuentan como UNA escucha — no un
 * `Reproductor` por pregunta, cada uno con su propio contador.
 *
 * Comparte con `Reproductor` la comprobación de que el audio suena de
 * verdad (`reproducirYConfirmar`) y la acción de servidor que apunta la
 * escucha (`pedirEscucha`), con la clave fija `"encadenado"`: el tope real
 * lo resuelve `maximoDeEscucha` mirando esa clave, igual que resuelve la de
 * cada pregunta suelta (`lib/escuchas.ts`).
 *
 * No hay pausa "por trozo": es un único `<audio>` cuyo `src` se reasigna en
 * `ended` para encadenar el siguiente. Pausar y reanudar actúan sobre ese
 * mismo elemento, así que no gastan otra escucha; no hay forma de saltar de
 * trozo ni de volver atrás —ni barra arrastrable ni control de pista—,
 * porque eso dejaría oír la tarea entera sin pagar la segunda vez.
 */
export default function ReproductorEncadenado({
  srcs,
  pasoId,
  maximo,
  usadas,
  cerrado,
}: {
  /** Los audios de la tarea, en orden y sin repetidos (los resuelve quien
   * llama: en la tarea 4, dos preguntas comparten un mismo trozo). */
  srcs: string[];
  pasoId: string;
  /** Ver el comentario de `Reproductor.maximo`: solo para el rótulo antes
   * de tocar nada, el servidor no se fía de este número. */
  maximo: number;
  /** Cuántas de esas escuchas ya están gastadas. */
  usadas: number;
  /** Ejercicio cerrado, o sin paso al que apuntar (previsualización del
   * profesor): el botón se apaga con el mismo mensaje que "sin escuchas",
   * porque el examen blanco no ofrece una repetición libre para repasar. */
  cerrado: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  // Cerrojo síncrono, igual que en `Reproductor`: evita que un doble clic
  // dispare `sonar()` dos veces antes del siguiente render.
  const pidiendoRef = useRef(false);
  // Posición dentro de la tira doblada (los `srcs`, dos veces seguidas).
  // En una `ref` porque `alTerminarTrozo` la lee y la actualiza dentro de
  // un manejador de eventos nativo, donde un `useState` de la iteración
  // anterior estaría obsoleto.
  const indiceRef = useRef(0);

  const secuencia = [...srcs, ...srcs];

  const inicial = Math.max(0, maximo - usadas);
  const [quedan, setQuedan] = useState(inicial);
  const [agotado, setAgotado] = useState(inicial <= 0);
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reproduciendo, setReproduciendo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [indice, setIndice] = useState(0);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(NaN);

  if (srcs.length === 0) return null;

  const deshabilitado = agotado || cerrado;

  async function sonar() {
    if (pidiendoRef.current || deshabilitado) return;
    const el = audio.current;
    if (!el) {
      setError("No ha sonado. Vuelve a intentarlo.");
      return;
    }
    pidiendoRef.current = true;
    setPidiendo(true);
    setError(null);

    // Una escucha siempre empieza por el primer trozo de la primera
    // repetición, nunca donde se cortó la anterior: mismo motivo que en
    // `Reproductor.sonar`.
    indiceRef.current = 0;
    setIndice(0);
    el.src = secuencia[0]!;
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

    setReproduciendo(true);

    let r: Awaited<ReturnType<typeof pedirEscucha>>;
    try {
      r = await pedirEscucha(pasoId, "encadenado");
    } catch {
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
    if (r.quedan === 0) setAgotado(true);
  }

  // El trozo en curso ha terminado: pasa al siguiente de la tira doblada,
  // o cierra la escucha si ya sonaron los dos pases completos.
  function alTerminarTrozo() {
    const el = audio.current;
    if (!el) return;
    const siguiente = indiceRef.current + 1;
    if (siguiente < secuencia.length) {
      indiceRef.current = siguiente;
      setIndice(siguiente);
      el.src = secuencia[siguiente]!;
      el.currentTime = 0;
      setTiempo(0);
      el.play().catch(() => {
        setReproduciendo(false);
        setError("El audio se ha detenido. Vuelve a intentarlo.");
      });
      return;
    }
    // Los dos pases completos ya sonaron: se acabó esta escucha.
    setReproduciendo(false);
    setPausado(false);
    indiceRef.current = 0;
    setIndice(0);
  }

  // Pausar y reanudar leen `el.paused` en el momento del clic, no un estado
  // que puede ir un render por detrás — igual que en `Reproductor`.
  function alternarPausa() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  const trozoActual = (indice % srcs.length) + 1;
  const audicionActual = Math.floor(indice / srcs.length) + 1;
  const progreso =
    Number.isFinite(duracion) && duracion > 0 ? Math.min(100, (tiempo / duracion) * 100) : 0;

  return (
    <div className="space-y-1">
      <audio
        ref={audio}
        preload="none"
        className="hidden"
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTiempo(e.currentTarget.currentTime)}
        onPlay={() => setPausado(false)}
        onPause={() => setPausado(true)}
        onEnded={alTerminarTrozo}
      >
        Tu navegador no puede reproducir este audio.
      </audio>

      {reproduciendo ? (
        <div className="flex items-center gap-3">
          <Boton onClick={alternarPausa} tamano="pequeno">
            {pausado ? "Reanudar" : "Pausa"}
          </Boton>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-tinta-suave">
            {formatoTiempo(tiempo)} / {Number.isFinite(duracion) ? formatoTiempo(duracion) : "--:--"}
          </span>
          {/* Decorativa a propósito, igual que en `Reproductor`: sin
              `onClick` ni control de rango, para que nadie pueda rebobinar
              ni saltar de trozo. */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hp-100">
            <div className="h-full rounded-full bg-hp-400" style={{ width: `${progreso}%` }} />
          </div>
          <span className="shrink-0 text-xs text-tinta-suave">
            Trozo {trozoActual} de {srcs.length} · audición {audicionActual} de 2
          </span>
        </div>
      ) : (
        <>
          <Boton onClick={sonar} disabled={pidiendo || deshabilitado}>
            {deshabilitado
              ? "Ya has oído la tarea las veces del examen"
              : pidiendo
                ? "…"
                : quedan === maximo
                  ? "Escuchar la tarea entera"
                  : "Escuchar otra vez"}
          </Boton>

          {!deshabilitado && (
            <p className="text-xs text-tinta-suave">
              {error
                ? error
                : quedan === maximo
                  ? `La grabación se repite dos veces seguidas, como en el examen. Puedes oírla ${maximo} ${maximo === 1 ? "vez" : "veces"}.`
                  : quedan === 0
                    ? "Era la última."
                    : `Te queda ${quedan} ${quedan === 1 ? "escucha" : "escuchas"}.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
