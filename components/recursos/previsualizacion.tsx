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
  /**
   * El `datosJson` que de verdad produjo `publica`, no el que hay ahora en
   * la prop. Como el reinicio de `valor`/`correccion` vive dentro del
   * `.then()` (ver comentario del efecto), mientras esa petición está en
   * vuelo `publica` sigue siendo la del ejercicio anterior con su
   * `contestadas` ya completo — así que el botón "Corregir" no puede fiarse
   * de comparar contra `datosJson` en directo, o se habilitaría sobre un
   * ejercicio nuevo con respuestas pensadas para el viejo.
   */
  const [datosJsonPublica, setDatosJsonPublica] = useState<string | null>(null);

  // Cada vez que el editor cambia el ejercicio, la previsualización vuelve a
  // empezar: las respuestas de antes se refieren a preguntas que puede que
  // ya no existan. El reinicio va dentro del `.then()` y no suelto en el
  // cuerpo del efecto (react-hooks/set-state-in-effect lo prohíbe): así,
  // mientras llega la nueva versión, se sigue viendo el ejercicio anterior
  // con sus respuestas intactas en vez de un hueco en blanco a medio camino.
  useEffect(() => {
    let vigente = true;

    // El efecto depende de `datosJson`, que cambia con cada tecla, y cada
    // disparo es una ida y vuelta al servidor con su `auth()` de Clerk y su
    // consulta a la base: un texto de 200 caracteres eran 200 peticiones. Se
    // espera a que el profesor deje de escribir; medio segundo largo no se
    // nota en una previsualización y quita casi todas.
    const espera = setTimeout(() => {
      versionParaPrevisualizar(datosJson).then((r) => {
        if (!vigente) return;
        setValor({});
        setCorreccion(null);
        if ("error" in r) {
          setError(r.error);
          setPublica(null);
          setTipo(null);
          setDatosJsonPublica(null);
        } else {
          setError(null);
          setPublica(r.publica);
          setTipo(r.tipo);
          setDatosJsonPublica(datosJson);
        }
      });
    }, 400);

    return () => {
      vigente = false;
      clearTimeout(espera);
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

  // Misma extracción que hace `components/ejercicios/ejercicio.tsx`: el
  // profesor tiene que ver el mismo enunciado que verá el estudiante, no
  // solo el widget de respuesta.
  const consigna = (publica as { consigna?: string }).consigna ?? "";

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

      {consigna && <p className="mt-4 font-bold text-tinta">{consigna}</p>}

      <div className="mt-6">{cara}</div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            // Se manda el `datosJson` que produjo `publica`, no el de la
            // prop en directo: son el mismo mientras el botón está
            // habilitado, pero solo uno de los dos es garantía.
            const r = await previsualizar(datosJsonPublica ?? datosJson, valor);
            if ("error" in r) setError(r.error);
            else setCorreccion(r.correccion);
          }}
          disabled={correccion !== null || contestadas < total || datosJsonPublica !== datosJson}
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
