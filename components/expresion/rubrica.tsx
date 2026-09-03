"use client";

import { useActionState, useState } from "react";
import { valorar, type EstadoExpresion } from "@/lib/acciones-expresion";
import Aviso from "@/components/ui/aviso";
import Campo from "@/components/ui/campo";
import { clasesDeBoton } from "@/components/ui/boton";
import Tarjeta from "@/components/ui/tarjeta";

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
    <form action={guardar}>
      <Tarjeta titulo="Rúbrica">
        <input type="hidden" name="asignacionId" value={asignacionId} />
        <input type="hidden" name="pasoId" value={pasoId} />
        {criterios.map((c) => (
          <input key={c.id} type="hidden" name={`nota-${c.id}`} value={notas[c.id] ?? ""} />
        ))}

        <ul className="space-y-3">
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

        <Campo
          etiqueta="Comentario para el alumno"
          name="comentario"
          tipo="area"
          rows={4}
          defaultValue={valoracion?.comentario ?? ""}
          className="mt-6"
        />

        {estado.error && (
          <Aviso tono="error" className="mt-4">{estado.error}</Aviso>
        )}
        {estado.ok && !estado.error && (
          <Aviso tono="ok" className="mt-4">{estado.ok}</Aviso>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Botón nativo: además de `pending`, se apaga si falta puntuar
              algún criterio (`!completa`), y `BotonEnviar` no admite una
              condición de apagado adicional a la del propio envío. */}
          <button
            type="submit"
            disabled={guardando || !completa}
            className={clasesDeBoton("primario", "normal", "disabled:cursor-not-allowed disabled:opacity-40")}
          >
            {guardando ? "Guardando…" : valoracion ? "Volver a corregir" : "Corregir"}
          </button>
          <span className="text-sm text-tinta-suave">
            {completa ? `${total} de ${maximo} puntos` : "Falta puntuar algún criterio"}
          </span>
        </div>
      </Tarjeta>
    </form>
  );
}
