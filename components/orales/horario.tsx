import Link from "next/link";
import { calcularTotal, esPausa, estadoDe, fmtTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export type TurnoDeLista = {
  id: string;
  dia: string;
  preparacion: string | null;
  hora: string;
  sala: string | null;
  estudiante: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  evaluacion: { sujetoId: string | null; notas: unknown } | null;
};

const semaforo: Record<string, string> = {
  vacio: "bg-fondo text-tinta-suave",
  medias: "bg-sol-300/40 text-tinta",
  hecho: "bg-verde-500 text-white",
};

export default function Horario({
  turnos,
  activoId,
  convocatoriaId,
}: {
  turnos: TurnoDeLista[];
  activoId?: string;
  convocatoriaId: string;
}) {
  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-hp-100 bg-white">
      {turnos.map((t, i) => {
        // Cabecera solo en el primer turno de cada día: sin variable mutable,
        // que el linter del proyecto rechaza reasignar dentro del render.
        const cabecera = i === 0 || t.dia !== turnos[i - 1].dia ? t.dia : null;
        // Una pausa y un turno que no se emparejó llegan los dos con
        // `estudiante: null`; solo la hora los distingue (ver esPausa).
        const pausa = esPausa({ estudianteId: t.estudiante?.id ?? null, hora: t.hora });
        // Sin emparejar pero no es una pausa: sigue siendo una fila que hay
        // que arreglar, y por eso no puede desaparecer del horario.
        const sinAsignar = !pausa && t.estudiante === null;
        const estado = estadoDe(
          t.evaluacion
            ? { sujetoId: t.evaluacion.sujetoId, notas: t.evaluacion.notas as Notas | null }
            : null,
        );
        const nota =
          estado === "hecho"
            ? fmtTotal(calcularTotal(t.evaluacion?.notas as Notas))
            : estado === "medias"
              ? "…"
              : "—";

        return (
          <div key={t.id}>
            {cabecera && (
              <div className="sticky top-0 border-b border-hp-100 bg-white px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-tinta-suave">
                {cabecera}
              </div>
            )}
            {pausa ? (
              <div className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-tinta-suave">
                · · · pausa · · ·
              </div>
            ) : (
              <Link
                href={`/profe/orales/${convocatoriaId}?turno=${t.id}`}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border-l-4 px-5 py-3 text-sm ${
                  t.id === activoId
                    ? "border-l-verde-500 bg-verde-500/10"
                    : "border-l-transparent hover:bg-fondo"
                }`}
              >
                <span className="tabular-nums text-xs font-semibold text-tinta-suave">
                  {t.hora}
                </span>
                <span className="min-w-0">
                  {sinAsignar ? (
                    <>
                      <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-tinta-suave">
                        Sin emparejar
                      </span>
                      <span className="block truncate text-xs text-tinta-suave">
                        {t.sala ?? "sin sala"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-tinta-suave">
                        {t.estudiante?.lastName ?? t.estudiante?.email}
                      </span>
                      <span className="block truncate font-bold text-tinta">
                        {t.estudiante?.firstName ?? ""}
                      </span>
                    </>
                  )}
                </span>
                {sinAsignar ? (
                  // No hay a quién ponerle semáforo: el aviso es que hace
                  // falta arreglar el emparejamiento antes del examen.
                  <span className="min-w-[28px] rounded-full bg-sol-300/40 px-2 py-0.5 text-center text-[10px] font-bold uppercase text-tinta">
                    sin asignar
                  </span>
                ) : (
                  <span
                    className={`min-w-[28px] rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums ${semaforo[estado]}`}
                  >
                    {nota}
                  </span>
                )}
              </Link>
            )}
          </div>
        );
      })}
    </aside>
  );
}
