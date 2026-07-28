"use client";

import { useState } from "react";
import { responderOpcionMultiple } from "@/lib/acciones";
import type { PreguntaPublica } from "@/lib/ejercicios/opcion-multiple";

/**
 * Ejercicio de opción múltiple. Solo recibe enunciados y opciones: las
 * respuestas correctas se quedan en el servidor, que es quien corrige.
 *
 * Se responde una vez. Cuando ya está respondido muestra la puntuación y
 * deja de ofrecer el formulario.
 */
export default function OpcionMultiple({
  pasoId,
  ejercicioId,
  consigna,
  preguntas,
  respondido,
  puntos,
}: {
  pasoId: string;
  ejercicioId: string;
  consigna: string;
  preguntas: PreguntaPublica[];
  respondido: boolean;
  puntos: number | null;
}) {
  const [elegidas, setElegidas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);

  const total = preguntas.length;
  const contestadas = Object.keys(elegidas).length;

  if (respondido) {
    return (
      <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
        <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
          Ejercicio corregido
        </p>
        <p className="mt-2 text-3xl font-extrabold text-tinta">
          {puntos ?? 0}
          <span className="ml-2 text-base font-bold text-tinta-suave">
            de {total} {total === 1 ? "punto" : "puntos"}
          </span>
        </p>
        <p className="mt-2 text-sm text-tinta-suave">
          Ya está sumado a tus puntos. Este ejercicio se responde una sola vez.
        </p>
      </section>
    );
  }

  return (
    <form
      action={async (formData) => {
        setEnviando(true);
        await responderOpcionMultiple(formData);
      }}
      className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave"
    >
      <input type="hidden" name="pasoId" value={pasoId} />
      <input type="hidden" name="ejercicioId" value={ejercicioId} />

      <p className="font-bold text-tinta">{consigna}</p>
      <p className="mt-1 text-sm text-tinta-suave">
        Un punto por acierto. Solo puedes enviarlo una vez.
      </p>

      <ol className="mt-6 space-y-6">
        {preguntas.map((pregunta, i) => (
          <li key={pregunta.id}>
            <p className="font-semibold text-tinta">
              {i + 1}. {pregunta.enunciado}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pregunta.opciones.map((opcion, indice) => {
                const elegida = elegidas[pregunta.id] === indice;
                return (
                  <label
                    key={indice}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition ${
                      elegida
                        ? "border-hp-400 bg-hp-50 font-bold text-tinta"
                        : "border-hp-100 bg-fondo text-tinta hover:border-hp-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`respuesta-${pregunta.id}`}
                      value={indice}
                      checked={elegida}
                      onChange={() =>
                        setElegidas((previas) => ({
                          ...previas,
                          [pregunta.id]: indice,
                        }))
                      }
                      className="h-4 w-4 shrink-0 accent-hp-400"
                    />
                    <span>{opcion}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando || contestadas < total}
          className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? "Corrigiendo…" : "Enviar respuestas"}
        </button>
        <span className="text-sm text-tinta-suave">
          {contestadas} de {total} contestadas
        </span>
      </div>
    </form>
  );
}
