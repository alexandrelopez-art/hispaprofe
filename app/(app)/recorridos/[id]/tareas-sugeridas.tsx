import { crearPaso } from "@/lib/acciones";
import { numeroDeTarea, pruebaDe, type PasoSituable, type TareaDele } from "@/lib/dele";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";

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
  pasos,
}: {
  recorridoId: string;
  nivel: Nivel;
  destreza: Destreza;
  /** Los pasos que ya existen, para saber qué tareas están puestas. */
  pasos: PasoSituable[];
}) {
  const prueba = pruebaDe(nivel, destreza);
  if (!prueba) return null;

  // La ocupación se cuenta con `numeroDeTarea`, la misma regla con la que la
  // ficha del paso decide qué tarea enseñar: si aquí se contara de otra
  // manera, esta lista escondería tareas que no están y ofrecería otras que
  // sí, y pinchar dos veces crearía dos «Tarea 3».
  const ocupados = new Set(pasos.map(numeroDeTarea));
  const faltan = prueba.tareas.filter((t) => !ocupados.has(t.numero));
  if (faltan.length === 0) return null;

  return (
    <Tarjeta titulo="Tareas de esta prueba" className="mt-8">
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
                    <Etiqueta tono="sol" className="ml-2">
                      sin confirmar
                    </Etiqueta>
                  )}
                </p>
                <p className="text-sm text-tinta-suave">{tarea.pide}</p>
              </div>

              <BotonEnviar gerundio="Añadiendo…" variante="sutil" tamano="pequeno" className="shrink-0">
                Añadir
              </BotonEnviar>
            </form>
          </li>
        ))}
      </ul>

      {faltan.some((t: TareaDele) => !t.verificado) && (
        <Aviso tono="aviso" className="mt-4">
          Las tareas marcadas «sin confirmar» están deducidas, no verificadas
          contra las especificaciones oficiales. Puedes usarlas igual; si
          compruebas alguna, corrígela en <code>lib/dele/mapa.ts</code> y el
          aviso desaparece.
        </Aviso>
      )}
    </Tarjeta>
  );
}
