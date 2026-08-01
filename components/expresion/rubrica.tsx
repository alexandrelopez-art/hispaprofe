"use client";

import { useActionState, useState } from "react";
import { valorar, type EstadoExpresion } from "@/lib/acciones-expresion";

export default function Rubrica({
  asignacionId,
  pasoId,
  criterios,
  valoracion,
}: {
  asignacionId: string;
  pasoId: string;
  criterios: { id: string; nombre: string; maximo: number }[];
  valoracion: { notas: Record<string, number>; comentario: string } | null;
}) {
  const [notas, setNotas] = useState<Record<string, number>>(valoracion?.notas ?? {});
  const [estado, guardar, guardando] = useActionState<EstadoExpresion, FormData>(valorar, {});

  const total = criterios.reduce((s, c) => s + (notas[c.id] ?? 0), 0);
  const maximo = criterios.reduce((s, c) => s + c.maximo, 0);
  const completa = criterios.every((c) => notas[c.id] !== undefined);

  return (
    <form action={guardar} className="rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
      <input type="hidden" name="asignacionId" value={asignacionId} />
      <input type="hidden" name="pasoId" value={pasoId} />
      {criterios.map((c) => (
        <input key={c.id} type="hidden" name={`nota-${c.id}`} value={notas[c.id] ?? ""} />
      ))}

      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Rúbrica</p>

      <ul className="mt-4 space-y-3">
        {criterios.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 text-sm font-semibold text-tinta">{c.nombre}</span>
            <div className="flex gap-1">
              {Array.from({ length: c.maximo + 1 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNotas({ ...notas, [c.id]: n })}
                  className={`h-9 w-9 rounded-full text-sm font-bold transition-colors ${
                    notas[c.id] === n
                      ? "bg-hp-400 text-white"
                      : "border border-hp-200 text-tinta hover:border-hp-400"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <label className="mt-6 block text-sm font-semibold text-tinta">
        Comentario para el alumno
        <textarea
          name="comentario"
          rows={4}
          defaultValue={valoracion?.comentario ?? ""}
          className="mt-1 w-full rounded-tarjeta border border-hp-200 bg-white p-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
      </label>

      {estado.error && (
        <p className="mt-4 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{estado.error}</p>
      )}
      {estado.ok && !estado.error && (
        <p className="mt-4 rounded-tarjeta bg-hp-100 px-4 py-3 text-sm text-hp-700">{estado.ok}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={guardando || !completa}
          className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {guardando ? "Guardando…" : valoracion ? "Volver a corregir" : "Corregir"}
        </button>
        <span className="text-sm text-tinta-suave">
          {completa ? `${total} de ${maximo} puntos` : "Falta puntuar algún criterio"}
        </span>
      </div>
    </form>
  );
}
