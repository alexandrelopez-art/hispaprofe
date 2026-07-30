"use client";

import { useEffect, useState } from "react";
import {
  previsualizar,
  versionParaPrevisualizar,
} from "@/lib/acciones-previsualizacion";
import type { Correccion, MarcaEjercicio, Respuestas } from "@/lib/ejercicios/tipos";
import type { PropsCara } from "@/components/ejercicios/ejercicio";
import CaraOpcion, { progresoOpcion } from "@/components/ejercicios/opcion";
import CaraHuecos, { progresoHuecos } from "@/components/ejercicios/huecos";
import CaraRelacionar, { progresoRelacionar } from "@/components/ejercicios/relacionar";
import CaraOrdenar, { progresoOrdenar } from "@/components/ejercicios/ordenar";

/**
 * Responde y corrige un ejercicio sin guardarlo.
 *
 * Las caras son las mismas cuatro que ve el estudiante y la corrección es la
 * misma función. Lo único propio es el botón: el del estudiante llama a
 * `responderEjercicio`, que comprueba asignación, vínculo con el paso y que
 * no haya respondido ya. Aquí no hay nada de eso que comprobar.
 */
export default function Previsualizacion({ datos }: { datos: unknown }) {
  const datosJson = JSON.stringify(datos);

  const [publica, setPublica] = useState<unknown>(null);
  const [tipo, setTipo] = useState<MarcaEjercicio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [valor, setValor] = useState<Respuestas>({});
  const [correccion, setCorreccion] = useState<Correccion | null>(null);

  // Cada vez que el editor cambia el ejercicio, la previsualización vuelve a
  // empezar: las respuestas de antes se refieren a preguntas que puede que
  // ya no existan. El reinicio va dentro del `.then()` y no suelto en el
  // cuerpo del efecto (react-hooks/set-state-in-effect lo prohíbe): así,
  // mientras llega la nueva versión, se sigue viendo el ejercicio anterior
  // con sus respuestas intactas en vez de un hueco en blanco a medio camino.
  useEffect(() => {
    let vigente = true;

    versionParaPrevisualizar(datosJson).then((r) => {
      if (!vigente) return;
      setValor({});
      setCorreccion(null);
      if ("error" in r) {
        setError(r.error);
        setPublica(null);
        setTipo(null);
      } else {
        setError(null);
        setPublica(r.publica);
        setTipo(r.tipo);
      }
    });

    return () => {
      vigente = false;
    };
  }, [datosJson]);

  if (error) {
    return (
      <p className="rounded-tarjeta border border-dashed border-hp-200 p-6 text-center text-sm text-tinta-suave">
        {error}
      </p>
    );
  }
  if (!publica || !tipo) {
    return (
      <p className="rounded-tarjeta border border-dashed border-hp-200 p-6 text-center text-sm text-tinta-suave">
        Cargando la previsualización…
      </p>
    );
  }

  const props: PropsCara = {
    publica,
    valor,
    alCambiar: setValor,
    correccion,
    cerrado: correccion !== null,
  };

  const cara = (() => {
    switch (tipo) {
      case "opcion":
        return <CaraOpcion {...props} />;
      case "huecos":
        return <CaraHuecos {...props} />;
      case "relacionar":
        return <CaraRelacionar {...props} />;
      case "ordenar":
        return <CaraOrdenar {...props} />;
    }
  })();

  const { total, contestadas } = (() => {
    switch (tipo) {
      case "opcion":
        return progresoOpcion(publica, valor);
      case "huecos":
        return progresoHuecos(publica, valor);
      case "relacionar":
        return progresoRelacionar(publica, valor);
      case "ordenar":
        return progresoOrdenar(publica);
    }
  })();

  return (
    <section className="rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
        Previsualización
      </p>
      <p className="mt-1 text-sm text-tinta-suave">
        Se corrige con el mismo motor que corrige a tus estudiantes. Nada de lo
        que hagas aquí se guarda.
      </p>

      <div className="mt-6">{cara}</div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            const r = await previsualizar(datosJson, valor);
            if ("error" in r) setError(r.error);
            else setCorreccion(r.correccion);
          }}
          disabled={correccion !== null || contestadas < total}
          className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Corregir
        </button>

        {correccion ? (
          <>
            <span className="text-sm font-bold text-tinta">
              {correccion.aciertos} de {correccion.total} puntos
            </span>
            <button
              type="button"
              onClick={() => {
                setValor({});
                setCorreccion(null);
              }}
              className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
            >
              Volver a probar
            </button>
          </>
        ) : (
          <span className="text-sm text-tinta-suave">
            {contestadas} de {total} contestadas
          </span>
        )}
      </div>
    </section>
  );
}
