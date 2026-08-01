"use client";

import { useActionState } from "react";
import Link from "next/link";
import { citarOral, descitarOral, type EstadoExpresion } from "@/lib/acciones-expresion";

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export default function CitarOral({
  asignacionId,
  pasoId,
  citada,
  clases,
}: {
  asignacionId: string;
  pasoId: string;
  /** La clase en la que ya está citado, si lo está. */
  citada: { id: string; empiezaEl: Date } | null;
  /** Las clases del alumno en las que se puede citar. */
  clases: { id: string; empiezaEl: Date; donde: string | null }[];
}) {
  const [estadoCitar, citar] = useActionState<EstadoExpresion, FormData>(citarOral, {});
  const [estadoQuitar, quitar] = useActionState<EstadoExpresion, FormData>(descitarOral, {});
  const error = estadoCitar.error ?? estadoQuitar.error;

  return (
    <div className="mt-2">
      {error && (
        <p className="mb-2 rounded-tarjeta bg-sol-100 px-3 py-2 text-xs text-tinta">{error}</p>
      )}

      {citada ? (
        <form action={quitar} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="asignacionId" value={asignacionId} />
          <input type="hidden" name="pasoId" value={pasoId} />
          <span className="text-xs text-tinta-suave">
            Citado para el {formatoFecha.format(citada.empiezaEl)}
          </span>
          <button
            type="submit"
            className="text-xs font-semibold text-tinta-suave underline hover:text-hp-500"
          >
            Quitar la cita
          </button>
        </form>
      ) : clases.length === 0 ? (
        <p className="text-xs text-tinta-suave">
          Este alumno no tiene clases agendadas.{" "}
          <Link href="/profe/clases" className="font-semibold underline hover:text-hp-500">
            Agenda una
          </Link>{" "}
          y podrás citarle el oral.
        </p>
      ) : (
        <form action={citar} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="asignacionId" value={asignacionId} />
          <input type="hidden" name="pasoId" value={pasoId} />
          <select
            name="claseId"
            required
            defaultValue=""
            className="h-8 rounded-full border border-hp-200 px-3 text-xs text-tinta outline-none focus:border-hp-400"
          >
            <option value="" disabled>
              Citar el oral en…
            </option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {formatoFecha.format(c.empiezaEl)}
                {c.donde ? ` · ${c.donde}` : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 rounded-full border border-hp-200 px-3 text-xs font-bold text-tinta hover:border-hp-400"
          >
            Citar
          </button>
        </form>
      )}
    </div>
  );
}
