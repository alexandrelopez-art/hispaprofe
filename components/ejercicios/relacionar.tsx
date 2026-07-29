"use client";

import { useState } from "react";
import type { RelacionarPublica } from "@/lib/ejercicios/relacionar";
import { comoLista, type Respuestas } from "@/lib/ejercicios/tipos";
import type { Progreso, PropsCara } from "./ejercicio";
import { Veredicto } from "./opcion";

export default function CaraRelacionar({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as RelacionarPublica;
  const [cogida, setCogida] = useState<string | null>(null);
  const cerrado = Boolean(correccion);

  function unir(izquierdaId: string, clave: string) {
    if (cerrado) return;
    // Una pieza de la derecha solo puede estar en un sitio: si ya estaba
    // usada en otra fila, se suelta de allí.
    const limpio: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(valor)) {
      if (comoLista(v)[0] !== clave) limpio[k] = v;
    }
    alCambiar({ ...limpio, [izquierdaId]: clave });
    setCogida(null);
  }

  const textoDe = (clave: string) =>
    datos.derechas.find((d) => d.clave === clave)?.texto ?? "";
  const usadas = new Set(Object.values(valor).map((v) => comoLista(v)[0]));

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        <ul className="space-y-2">
          {datos.izquierdas.map((izq) => {
            const elegida = comoLista(valor[izq.id])[0];
            const item = correccion?.items.find((x) => x.id === izq.id);
            return (
              <li key={izq.id}>
                <div
                  onDragOver={(e) => !cerrado && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) unir(izq.id, id);
                  }}
                  onClick={() => cogida && unir(izq.id, cogida)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                    cogida && !cerrado ? "border-hp-400 bg-hp-50" : "border-hp-100 bg-fondo"
                  }`}
                >
                  <span className="text-sm font-semibold text-tinta">{izq.texto}</span>
                  <span className="ml-auto text-sm text-tinta-suave">
                    {elegida ? textoDe(elegida) : "—"}
                  </span>
                </div>
                {item && <Veredicto acertado={item.acertado} correcta={item.correcta} />}
              </li>
            );
          })}
        </ul>

        <ul className="space-y-2">
          {datos.derechas.map((der) => (
            <li key={der.clave}>
              <button
                type="button"
                draggable={!cerrado}
                disabled={cerrado}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", der.clave)}
                onClick={() => setCogida(der.clave === cogida ? null : der.clave)}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                  cogida === der.clave
                    ? "border-hp-400 bg-hp-50 font-bold"
                    : usadas.has(der.clave)
                      ? "border-hp-100 bg-white text-tinta-suave"
                      : "border-hp-100 bg-fondo text-tinta hover:border-hp-200"
                }`}
              >
                {der.texto}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!cerrado && (
        <p className="mt-4 text-xs text-tinta-suave">
          Arrastra cada pieza de la derecha a su fila, o toca una y luego la otra.
        </p>
      )}
    </div>
  );
}

/**
 * Contestada = la izquierda tiene una derecha asignada.
 *
 * Filtra cadenas vacías, no solo cuenta longitud: si la Tarea 7 dibuja esto
 * con un `<select>` con placeholder "?" (como ya hace la cara de opción),
 * volver a "" al reconsiderar deja un valor presente pero en blanco, y
 * `comoLista` lo envuelve igual que cualquier otro string.
 */
export function progresoRelacionar(publica: unknown, valor: Respuestas): Progreso {
  const datos = publica as RelacionarPublica;
  const total = datos.izquierdas.length;
  const contestadas = datos.izquierdas.filter((i) =>
    comoLista(valor[i.id]).some((v) => v !== ""),
  ).length;
  return { total, contestadas };
}
