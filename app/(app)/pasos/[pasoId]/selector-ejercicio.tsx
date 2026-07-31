"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  desengancharEjercicio,
  engancharEjercicio,
  type EstadoRecurso,
} from "@/lib/acciones-recursos";

export type Candidato = { id: string; titulo: string; tipo: string; nivel: string };

/** El nombre del nivel tal y como se escribe en pantalla. */
function nombreNivel(nivel: string): string {
  return nivel === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : nivel;
}

export default function SelectorEjercicio({
  pasoId,
  actual,
  candidatos,
  nivel,
  todosLosNiveles,
  prueba,
  tarea,
}: {
  pasoId: string;
  actual: { id: string; titulo: string } | null;
  candidatos: Candidato[];
  /** El nivel del recorrido, que es por el que se acota la lista. */
  nivel: string;
  /** Si la lista viene ya sin acotar, por un `?todos=1` en la dirección. */
  todosLosNiveles: boolean;
  /** La prueba del recorrido, para crear el ejercicio ya por su tarea. */
  prueba: string | null;
  /** La tarea del mapa que le toca a este paso, si le toca alguna. */
  tarea: {
    numero: number;
    pide: string;
    verificado: boolean;
    /** Si la lista viene acotada al formato de la tarea. */
    filtrado: boolean;
  } | null;
}) {
  const [estadoEnganchar, enganchar, enganchando] = useActionState<EstadoRecurso, FormData>(
    engancharEjercicio,
    {},
  );
  const [estadoQuitar, quitar] = useActionState<EstadoRecurso, FormData>(
    desengancharEjercicio,
    {},
  );

  const error = estadoEnganchar.error ?? estadoQuitar.error;

  /**
   * De qué nivel es la lista, y la puerta para salirse. Acotarla al nivel del
   * recorrido acierta casi siempre, pero el editor de Recursos arranca en B1:
   * sin decir de qué nivel se está hablando, un ejercicio recién publicado en
   * otro parece no existir.
   */
  const alcance = todosLosNiveles ? (
    <>
      Se ofrecen los publicados de todos los niveles.{" "}
      <Link href={`/pasos/${pasoId}`} className="font-semibold underline hover:text-hp-500">
        Ver solo los de {nombreNivel(nivel)}
      </Link>
      .
    </>
  ) : (
    <>
      Se ofrecen solo los de nivel {nombreNivel(nivel)}, el del recorrido.{" "}
      <Link href={`/pasos/${pasoId}?todos=1`} className="font-semibold underline hover:text-hp-500">
        Ver los de todos los niveles
      </Link>
      .
    </>
  );

  /**
   * De dónde sale un ejercicio nuevo. Con tarea, el editor arranca ya en el
   * formato que esa tarea admite y con su estructura montada; sin ella, en la
   * pantalla de siempre para elegir tipo a mano.
   */
  const enlaceNuevo =
    tarea && prueba
      ? `/profe/recursos/nuevo?nivel=${nivel}&prueba=${prueba}&tarea=${tarea.numero}`
      : "/profe/recursos/nuevo";

  return (
    <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
        Ejercicio del paso
      </p>

      {error && (
        <p className="mt-3 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{error}</p>
      )}

      {/*
        La ficha de la tarea va fuera de las tres ramas de abajo, y no dentro
        del desplegable: con el filtro puesto lo normal es que todavía no
        haya ningún ejercicio de ese formato, y ahí es justo donde hace más
        falta que se vea la salida.
      */}
      {tarea && (
        <div className="mt-3 rounded-xl border border-hp-100 bg-fondo px-4 py-3">
          <p className="text-sm font-bold text-tinta">
            Tarea {tarea.numero}
            {!tarea.verificado && (
              <span className="ml-2 rounded-full bg-sol-100 px-2 py-0.5 text-xs font-bold">
                sin confirmar
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-tinta-suave">{tarea.pide}</p>
          {/* Con un ejercicio ya enganchado no se ofrece lista ninguna, así
              que hablar de lo que se ofrece solo confundiría. */}
          {tarea.filtrado && !actual && (
            <p className="mt-2 text-xs text-tinta-suave">
              Se ofrecen solo los del formato de esta tarea.{" "}
              <Link
                href={`/pasos/${pasoId}?formato=todos`}
                className="font-semibold underline hover:text-hp-500"
              >
                Ver todos los formatos
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {actual ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={`/profe/recursos/${actual.id}`}
            className="flex-1 font-semibold text-tinta underline hover:text-hp-500"
          >
            {actual.titulo}
          </Link>
          <form action={quitar}>
            <input type="hidden" name="pasoId" value={pasoId} />
            <button
              type="submit"
              className="h-9 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta hover:border-hp-400"
            >
              Quitar
            </button>
          </form>
        </div>
      ) : candidatos.length === 0 ? (
        <p className="mt-3 text-sm text-tinta-suave">
          {tarea?.filtrado
            ? // Del nivel ya habla `alcance`, aquí al lado: decir los dos
              // acotamientos en la misma frase la deja ilegible.
              "No hay ningún ejercicio publicado del formato de esta tarea que ofrecer. "
            : todosLosNiveles
              ? "No hay ningún ejercicio publicado que ofrecer. "
              : `No hay ningún ejercicio publicado de nivel ${nombreNivel(nivel)} que ofrecer. `}
          <Link href={enlaceNuevo} className="font-semibold underline hover:text-hp-500">
            Crear uno
          </Link>
          . {alcance}
        </p>
      ) : (
        <>
          <form action={enganchar} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="pasoId" value={pasoId} />
            <select
              name="ejercicioId"
              required
              defaultValue=""
              className="h-10 flex-1 rounded-full border border-hp-200 px-4 text-sm text-tinta outline-none focus:border-hp-400"
            >
              <option value="" disabled>
                Elige un ejercicio
              </option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo} · {nombreNivel(c.nivel)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={enganchando}
              className="h-10 rounded-full bg-hp-400 px-5 text-sm font-extrabold text-white hover:bg-hp-500 disabled:opacity-40"
            >
              Enganchar
            </button>
          </form>
          {/*
            «Crear uno» estaba solo en la rama de lista vacía: en cuanto
            había un candidato, la única forma de montar el ejercicio de
            esta tarea era ir a Recursos a mano y perder el punto de partida.
          */}
          <p className="mt-2 text-xs text-tinta-suave">
            {alcance}{" "}
            <Link href={enlaceNuevo} className="font-semibold underline hover:text-hp-500">
              Crear uno nuevo
            </Link>
            .
          </p>
        </>
      )}

      <p className="mt-3 text-xs text-tinta-suave">
        Un paso admite un solo ejercicio: la corrección escribe los puntos del
        paso entero, así que dos se pisarían.
      </p>
    </section>
  );
}
