import { crearPaso } from "@/lib/acciones";
import { pruebaDe, type TareaDele } from "@/lib/dele";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";

/**
 * Las tareas que le faltan a esta prueba, con un botón que crea el paso ya
 * nombrado.
 *
 * Sugiere y no obliga: el «añadir paso» libre sigue al lado, y nada impide
 * saltarse una tarea, repetirla ni cambiarles el orden.
 */
export default function TareasSugeridas({
  recorridoId,
  nivel,
  destreza,
  ordenesOcupados,
}: {
  recorridoId: string;
  nivel: Nivel;
  destreza: Destreza;
  /** Los `orden` de los pasos que ya existen: esas tareas ya están puestas. */
  ordenesOcupados: number[];
}) {
  const prueba = pruebaDe(nivel, destreza);
  if (!prueba) return null;

  const ocupados = new Set(ordenesOcupados);
  const faltan = prueba.tareas.filter((t) => !ocupados.has(t.numero));
  if (faltan.length === 0) return null;

  return (
    <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
        Tareas de esta prueba
      </p>
      <p className="mt-1 text-sm text-tinta-suave">
        {prueba.duracionMinutos} minutos · {prueba.tareas.length} tareas. Faltan{" "}
        {faltan.length}.
      </p>

      <ul className="mt-4 space-y-2">
        {faltan.map((tarea) => (
          <li key={tarea.numero}>
            <form action={crearPaso} className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 px-4 py-3">
              <input type="hidden" name="recorridoId" value={recorridoId} />
              <input type="hidden" name="titulo" value={`Tarea ${tarea.numero}`} />
              <input type="hidden" name="tipo" value="ACTIVIDAD" />
              <input type="hidden" name="ciclo" value="1" />
              <input type="hidden" name="destreza" value={destreza} />

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-tinta">
                  Tarea {tarea.numero}
                  {!tarea.verificado && (
                    <span className="ml-2 rounded-full bg-sol-100 px-2 py-0.5 text-xs font-bold text-tinta">
                      sin confirmar
                    </span>
                  )}
                </p>
                <p className="text-sm text-tinta-suave">{tarea.pide}</p>
              </div>

              <button
                type="submit"
                className="h-9 shrink-0 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400"
              >
                Añadir
              </button>
            </form>
          </li>
        ))}
      </ul>

      {faltan.some((t: TareaDele) => !t.verificado) && (
        <p className="mt-4 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Las tareas marcadas «sin confirmar» están deducidas, no verificadas
          contra las especificaciones oficiales. Puedes usarlas igual; si
          compruebas alguna, corrígela en <code>lib/dele/mapa.ts</code> y el
          aviso desaparece.
        </p>
      )}
    </section>
  );
}
