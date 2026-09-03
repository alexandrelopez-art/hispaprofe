"use client";

import { useActionState } from "react";
import Link from "next/link";
import { citarOral, descitarOral, type EstadoExpresion } from "@/lib/acciones-expresion";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";

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
      {error && <Aviso tono="error" className="mb-2">{error}</Aviso>}

      {citada ? (
        <form action={quitar} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="asignacionId" value={asignacionId} />
          <input type="hidden" name="pasoId" value={pasoId} />
          <span className="text-xs text-tinta-suave">
            Citado para el {formatoFecha.format(citada.empiezaEl)}
          </span>
          {/* Se queda nativo: es un enlace subrayado, no tiene el aspecto de
              botón que BotonEnviar siempre pinta. */}
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
          <Campo
            etiqueta="Citar el oral en"
            name="claseId"
            tipo="elegir"
            required
            defaultValue=""
            className="min-w-40 flex-1"
            opciones={[
              { valor: "", nombre: "Citar el oral en…", deshabilitada: true },
              ...clases.map((c) => ({
                valor: c.id,
                nombre: `${formatoFecha.format(c.empiezaEl)}${c.donde ? ` · ${c.donde}` : ""}`,
              })),
            ]}
          />
          <BotonEnviar gerundio="Citando…" variante="sutil" tamano="pequeno">
            Citar
          </BotonEnviar>
        </form>
      )}
    </div>
  );
}
