"use client";

import type { OpcionPublica } from "@/lib/ejercicios/opcion";
import { comoLista, type Respuestas } from "@/lib/ejercicios/tipos";
import type { Progreso, PropsCara } from "./ejercicio";
import Reproductor from "./reproductor";

export default function CaraOpcion({
  publica,
  valor,
  alCambiar,
  correccion,
  cerrado,
  pasoId,
  escuchasUsadas,
  puedeContar,
}: PropsCara) {
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
              <div className="mt-3">
                <Reproductor
                  src={pregunta.audio}
                  pasoId={pasoId}
                  clave={pregunta.id}
                  maximo={datos.escuchas}
                  usadas={escuchasUsadas[pregunta.id] ?? 0}
                  // `!puedeContar` también: sin asignación viva el servidor
                  // no concede ninguna escucha, así que contar aquí solo
                  // serviría para decir «Sin escuchas» sin haber sonado.
                  cerrado={cerrado || pasoId === "" || !puedeContar}
                />
              </div>
            )}

            {/*
              Con lista compartida y muchas preguntas, una fila de botones
              por pregunta sería un muro. El desplegable cabe.
            */}
            {datos.presentacion === "desplegable" ? (
              <select
                value={comoLista(valor[pregunta.id])[0] ?? ""}
                disabled={cerrado}
                onChange={(e) => alCambiar({ ...valor, [pregunta.id]: e.target.value })}
                // El ejercicio se responde una sola vez, así que Enter no
                // puede enviarlo: al elegir el último desplegable el botón se
                // habilita, y un Enter por reflejo quemaría el único intento.
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
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
                      cerrado ? "cursor-default" : "cursor-pointer"
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
                      disabled={cerrado}
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

/**
 * Contestada = al menos una opción marcada, sea única o múltiple.
 *
 * El desplegable manda `""` cuando se reselecciona el placeholder "?": ese
 * valor está presente (no es `undefined`), así que `comoLista` lo envuelve
 * en una lista de longitud 1. Contar longitud, sin más, la daría por
 * contestada estando en blanco. Se filtran las cadenas vacías antes de
 * contar, no solo su longitud.
 */
export function progresoOpcion(publica: unknown, valor: Respuestas): Progreso {
  const datos = publica as OpcionPublica;
  const total = datos.preguntas.length;
  const contestadas = datos.preguntas.filter((p) =>
    comoLista(valor[p.id]).some((v) => v !== ""),
  ).length;
  return { total, contestadas };
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
