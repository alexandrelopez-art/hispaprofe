"use client";

import { TOPE_SEGUNDOS } from "@/lib/orales/criterios";
import { fmtTiempo } from "@/lib/orales/formato";
import Boton from "@/components/ui/boton";

/**
 * El cronómetro es de presentación pura: recibe los segundos ya calculados
 * y solo avisa de las dos pulsaciones posibles.
 *
 * La primera versión llevaba el reloj de verdad aquí dentro (una marca de
 * arranque y un `setInterval` propios), pero eso lo dejaba fuera del
 * alcance de `Panel`: el tiempo transcurrido solo vivía en este componente,
 * así que el padre no podía guardarlo ni recuperarlo en una repintada. Con
 * dos cronómetros en la misma pantalla eso era un doble problema —arrancar
 * uno para el otro no guardaba el tiempo del que se paraba, y cualquier
 * `guardar()` del padre (una tecla en un comentario, un `+`) rehacía el
 * efecto de aquí y rebobinaba el reloj a partir del último valor
 * *guardado*, no del que de verdad llevaba corriendo. Ahora `Panel` lleva
 * la marca de arranque y el único `setInterval` que hace falta, y este
 * componente solo pinta lo que le llega.
 */
export default function Cronometro({
  etiqueta,
  sub,
  romano,
  segundos,
  corriendo,
  alPulsar,
  alReiniciar,
}: {
  etiqueta: string;
  sub: string;
  romano: string;
  segundos: number;
  corriendo: boolean;
  alPulsar: () => void;
  alReiniciar: () => void;
}) {
  const acabado = segundos >= TOPE_SEGUNDOS;

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
        {fmtTiempo(segundos)}
        <span className="ml-1 text-lg font-medium text-tinta-suave">/ 05:00</span>
      </span>
      <div className="mt-2 flex gap-2">
        {/* Botón nativo: tres aspectos posibles (acabado/corriendo/parado) y
            ninguna de las 4 variantes de `Boton` los representa sin perder
            la distinción de color entre ellos. */}
        <button
          type="button"
          onClick={alPulsar}
          // B-7: cada rama trae su propio color de texto completo. Antes
          // el texto-blanco de la cadena base convivía con el
          // `text-tinta` de la rama «Pausar», y en el CSS compilado ganaba
          // el blanco: el botón de pausar salía blanco sobre amarillo,
          // ilegible — justo el que hay que acertar para que el tiempo se
          // guarde.
          className={`flex-1 rounded-lg px-4 py-2.5 font-bold ${
            acabado
              ? "bg-coral-500 text-white"
              : corriendo
                ? "bg-sol-300 text-tinta"
                : "bg-tinta text-white"
          }`}
        >
          {acabado
            ? "Terminado · reiniciar"
            : corriendo
              ? "Pausar"
              : segundos > 0
                ? "Reanudar"
                : "Iniciar"}
        </button>
        <Boton onClick={alReiniciar} variante="sutil" tamano="pequeno" title="Reiniciar">
          ↺
        </Boton>
      </div>
    </div>
  );
}
