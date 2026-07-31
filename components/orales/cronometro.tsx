"use client";

import { useEffect, useRef, useState } from "react";
import { TOPE_SEGUNDOS } from "@/lib/orales/criterios";
import { fmtTiempo } from "@/lib/orales/formato";

/**
 * Un cronómetro que cuenta hacia arriba hasta cinco minutos y se para solo.
 *
 * El tiempo se calcula desde una marca de inicio y no sumando ticks: un
 * `setInterval` pierde milisegundos en cada vuelta y en cinco minutos eso
 * se nota. El intervalo solo repinta.
 */
export default function Cronometro({
  etiqueta,
  sub,
  romano,
  segundos,
  corriendo,
  alCambiar,
  alArrancar,
}: {
  etiqueta: string;
  sub: string;
  romano: string;
  segundos: number;
  corriendo: boolean;
  alCambiar: (segundos: number, corriendo: boolean) => void;
  alArrancar: () => void;
}) {
  const [mostrado, setMostrado] = useState(segundos);
  const desde = useRef<number | null>(null);

  useEffect(() => {
    if (!corriendo) {
      desde.current = null;
      return;
    }
    desde.current = Date.now() - segundos * 1000;
    const id = setInterval(() => {
      const va = (Date.now() - (desde.current ?? Date.now())) / 1000;
      if (va >= TOPE_SEGUNDOS) {
        setMostrado(TOPE_SEGUNDOS);
        alCambiar(TOPE_SEGUNDOS, false);
        return;
      }
      setMostrado(va);
    }, 250);
    return () => clearInterval(id);
  }, [corriendo, segundos, alCambiar]);

  // Parado, el reloj enseña `segundos` directamente en vez de sincronizarlo
  // en un `mostrado` con un `setState` síncrono dentro del efecto (lo que el
  // lint del proyecto rechaza como cascada de renders evitable). Corriendo,
  // `mostrado` es quien manda: lo va empujando el intervalo de arriba.
  const valor = corriendo ? mostrado : segundos;
  const acabado = valor >= TOPE_SEGUNDOS;

  return (
    <div className="flex flex-col gap-1.5 rounded-tarjeta border border-hp-100 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="rounded bg-fondo px-2 py-1 font-mono text-xs font-bold text-tinta">
          {romano}
        </span>
        <span className="flex flex-col">
          <span className="font-bold text-tinta">{etiqueta}</span>
          <span className="text-xs text-tinta-suave">{sub}</span>
        </span>
      </div>
      <span
        className={`font-mono text-5xl font-bold tabular-nums ${
          acabado ? "text-coral-500" : "text-tinta"
        }`}
      >
        {fmtTiempo(valor)}
        <span className="ml-1 text-lg font-medium text-tinta-suave">/ 05:00</span>
      </span>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (acabado) {
              alCambiar(0, false);
              return;
            }
            if (corriendo) {
              alCambiar(valor, false);
              return;
            }
            // Regla 4: arrancar uno para el otro. Lo hace el panel, que es
            // quien ve los dos.
            alArrancar();
          }}
          className={`flex-1 rounded-lg px-4 py-2.5 font-bold text-white ${
            acabado ? "bg-coral-500" : corriendo ? "bg-sol-300 text-tinta" : "bg-tinta"
          }`}
        >
          {acabado ? "Terminado · reiniciar" : corriendo ? "Pausar" : valor > 0 ? "Reanudar" : "Iniciar"}
        </button>
        <button
          type="button"
          onClick={() => alCambiar(0, false)}
          className="rounded-lg border border-hp-100 px-3.5 py-2.5 text-tinta-suave"
          title="Reiniciar"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
