"use client";

import type { OpcionPublica } from "@/lib/ejercicios/opcion";
import { comoLista } from "@/lib/ejercicios/tipos";
import type { PropsCara } from "./ejercicio";

export default function CaraOpcion({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as OpcionPublica;

  function alternar(preguntaId: string, indice: number) {
    if (!datos.multiple) {
      alCambiar({ ...valor, [preguntaId]: String(indice) });
      return;
    }
    const actuales = new Set(comoLista(valor[preguntaId]));
    const clave = String(indice);
    if (actuales.has(clave)) actuales.delete(clave);
    else actuales.add(clave);
    alCambiar({ ...valor, [preguntaId]: [...actuales] });
  }

  return (
    <ol className="space-y-6">
      {datos.preguntas.map((pregunta, i) => {
        const marcadas = new Set(comoLista(valor[pregunta.id]));
        const item = correccion?.items.find((x) => x.id === pregunta.id);
        return (
          <li key={pregunta.id}>
            <p className="font-semibold text-tinta">
              {i + 1}. {pregunta.enunciado}
            </p>
            {pregunta.audio && (
              <audio controls preload="none" src={pregunta.audio} className="mt-3 w-full max-w-sm">
                Tu navegador no puede reproducir este audio.
              </audio>
            )}

            {/*
              Con lista compartida y muchas preguntas, una fila de botones
              por pregunta sería un muro. El desplegable cabe.
            */}
            {datos.presentacion === "desplegable" ? (
              <select
                value={comoLista(valor[pregunta.id])[0] ?? ""}
                disabled={Boolean(correccion)}
                onChange={(e) => alCambiar({ ...valor, [pregunta.id]: e.target.value })}
                aria-label={pregunta.enunciado}
                className="mt-2 h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400 disabled:opacity-70"
              >
                <option value="">?</option>
                {pregunta.opciones.map((opcion, indice) => (
                  <option key={indice} value={String(indice)}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pregunta.opciones.map((opcion, indice) => {
                const elegida = marcadas.has(String(indice));
                return (
                  <label
                    key={indice}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition ${
                      correccion ? "cursor-default" : "cursor-pointer"
                    } ${
                      elegida
                        ? "border-hp-400 bg-hp-50 font-bold text-tinta"
                        : "border-hp-100 bg-fondo text-tinta hover:border-hp-200"
                    }`}
                  >
                    <input
                      type={datos.multiple ? "checkbox" : "radio"}
                      name={`p-${pregunta.id}`}
                      checked={elegida}
                      disabled={Boolean(correccion)}
                      onChange={() => alternar(pregunta.id, indice)}
                      className="h-4 w-4 shrink-0 accent-hp-400"
                    />
                    <span>{opcion}</span>
                  </label>
                );
              })}
            </div>
            )}
            {item && <Veredicto acertado={item.acertado} correcta={item.correcta} />}
          </li>
        );
      })}
    </ol>
  );
}

/** La marca de acierto o fallo, con la respuesta buena cuando toca. */
export function Veredicto({ acertado, correcta }: { acertado: boolean; correcta: string }) {
  return (
    <p
      className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
        acertado ? "bg-bloque2/25 text-tinta" : "bg-sol-200 text-tinta"
      }`}
    >
      {acertado ? "Bien ✓" : `No. La respuesta era: ${correcta}`}
    </p>
  );
}
