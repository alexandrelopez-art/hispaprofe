"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  desengancharEjercicio,
  engancharEjercicio,
  type EstadoRecurso,
} from "@/lib/acciones-recursos";
import { nombreNivel } from "@/lib/niveles";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";

export type Candidato = { id: string; titulo: string; tipo: string; nivel: string };

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
  const [estadoEnganchar, enganchar] = useActionState<EstadoRecurso, FormData>(
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
    <Tarjeta titulo="Ejercicio del paso" className="mt-8">
      {error && (
        <Aviso tono="error" className="mt-3">{error}</Aviso>
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
              <Etiqueta tono="sol" className="ml-2">
                sin confirmar
              </Etiqueta>
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
            <BotonEnviar gerundio="Quitando…" variante="sutil">
              Quitar
            </BotonEnviar>
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
            <Campo
              etiqueta="Ejercicio"
              name="ejercicioId"
              tipo="elegir"
              required
              defaultValue=""
              className="flex-1"
              opciones={[
                { valor: "", nombre: "Elige un ejercicio", deshabilitada: true },
                ...candidatos.map((c) => ({
                  valor: c.id,
                  nombre: `${c.titulo} · ${nombreNivel(c.nivel)}`,
                })),
              ]}
            />
            <BotonEnviar gerundio="Enganchando…">Enganchar</BotonEnviar>
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
    </Tarjeta>
  );
}
