"use client";

import { useEffect, useState } from "react";
import type { OrdenarPublica } from "@/lib/ejercicios/ordenar";
import { comoLista } from "@/lib/ejercicios/tipos";
import type { Progreso, PropsCara } from "./ejercicio";
import { Veredicto } from "./opcion";

export default function CaraOrdenar({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as OrdenarPublica;
  const cerrado = Boolean(correccion);

  const guardado = comoLista(valor.orden);
  const [orden, setOrden] = useState<string[]>(
    guardado.length ? guardado : datos.piezas.map((p) => p.id),
  );
  const [cogida, setCogida] = useState<string | null>(null);

  // El repartidor guarda el estado; aquí solo se le avisa del orden actual.
  useEffect(() => {
    alCambiar({ ...valor, orden });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  function mover(desde: string, hasta: string) {
    if (cerrado || desde === hasta) return;
    const copia = orden.filter((id) => id !== desde);
    copia.splice(copia.indexOf(hasta), 0, desde);
    setOrden(copia);
    setCogida(null);
  }

  const textoDe = (id: string) => datos.piezas.find((p) => p.id === id)?.texto ?? "";

  return (
    <div>
      <ol className="space-y-2">
        {orden.map((id, i) => {
          const item = correccion?.items.find((x) => x.id === id);
          return (
            <li key={id}>
              <div
                draggable={!cerrado}
                onDragStart={() => setCogida(id)}
                onDragOver={(e) => !cerrado && e.preventDefault()}
                onDrop={() => cogida && mover(cogida, id)}
                onClick={() => (cogida ? mover(cogida, id) : setCogida(id))}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                  cogida === id
                    ? "border-hp-400 bg-hp-50"
                    : "border-hp-100 bg-fondo hover:border-hp-200"
                } ${cerrado ? "cursor-default" : "cursor-grab"}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tinta text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm text-tinta">{textoDe(id)}</span>
              </div>
              {item && <Veredicto acertado={item.acertado} correcta={item.correcta} />}
            </li>
          );
        })}
      </ol>

      {!cerrado && (
        <p className="mt-4 text-xs text-tinta-suave">
          Arrastra las frases para ordenarlas, o toca una y luego el sitio donde va.
        </p>
      )}
    </div>
  );
}

/**
 * Las piezas siempre están en algún orden — barajadas de entrada, si el
 * estudiante no toca nada — así que este tipo nunca bloquea el envío. No
 * necesita `valor` para decidirlo, a diferencia de los demás tipos.
 */
export function progresoOrdenar(publica: unknown): Progreso {
  const datos = publica as OrdenarPublica;
  return { total: datos.piezas.length, contestadas: datos.piezas.length };
}
