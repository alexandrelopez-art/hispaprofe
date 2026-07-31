"use client";

import { useState } from "react";
import { responderEjercicio } from "@/lib/acciones";
import type { Correccion, MarcaEjercicio, Respuestas } from "@/lib/ejercicios/tipos";
import CaraOpcion, { progresoOpcion } from "./opcion";
import CaraHuecos, { progresoHuecos } from "./huecos";
import CaraRelacionar, { progresoRelacionar } from "./relacionar";
import CaraOrdenar, { progresoOrdenar } from "./ordenar";

export type PropsEjercicio = {
  pasoId: string;
  ejercicioId: string;
  tipo: MarcaEjercicio;
  /** La versión sin soluciones. Su forma la fija cada tipo. */
  publica: unknown;
  respondido: boolean;
  puntos: number | null;
  /** Solo llega cuando el ejercicio ya está cerrado. */
  correccion: Correccion | null;
  /**
   * Lo que el estudiante ya envió, si lo envió. Al recargar la página el
   * componente vuelve a montarse desde cero: sin esto, `useState` siempre
   * arrancaría en `{}` y el estudiante vería su opción sin marcar, sus
   * huecos vacíos y —el caso grave— `ordenar` repintado en el orden barajado
   * de siempre con cada Veredicto colgado de una fila que ya no es la que
   * juzgó. Puede llegar `null` (ejercicio sin responder, o puntuado a mano
   * por el profesor sin pasar por aquí).
   */
  respuestas: Respuestas | null;
  /**
   * Escuchas ya gastadas en este paso, por clave (id de pregunta o pareja).
   * Leído en el servidor (`escuchasDelPaso`) para que el reproductor de
   * cada audio arranque ya informado, sin esperar a un primer clic: si no,
   * recargar la página después de agotar las escuchas volvía a decir
   * "Puedes oírlo 2 veces" hasta el siguiente intento.
   */
  escuchas: Record<string, number>;
};

export type PropsCara = {
  publica: unknown;
  valor: Respuestas;
  alCambiar: (nuevo: Respuestas) => void;
  correccion: Correccion | null;
  /**
   * Si el ejercicio está cerrado: ya no se puede tocar nada. No se deduce
   * de `correccion`, porque un paso puntuado a mano por el profesor
   * (`otorgarPuntos`) deja `correccion` en `null` y aun así el ejercicio
   * debe quedar bloqueado, no seguir editable sobre una nota que ya no va
   * a cambiar.
   */
  cerrado: boolean;
  /**
   * El paso al que pertenece este ejercicio. Lo necesitan los audios para
   * contar escuchas; el resto de las caras lo ignoran. Vacío en la
   * previsualización del profesor, donde no se cuenta nada.
   */
  pasoId: string;
  /** Ver el comentario de `PropsEjercicio.escuchas`. Vacío en la previsualización. */
  escuchasUsadas: Record<string, number>;
};

/**
 * Cuántos elementos tiene el ejercicio y cuántos ya tienen respuesta. Cada
 * cara sabe lo que cuenta como "respondido" para su propia forma (una
 * opción marcada, un hueco no vacío, una pareja unida...); el repartidor
 * solo compara `contestadas` con `total` para decidir si puede enviar, sin
 * aprender ninguna de esas reglas.
 */
export type Progreso = { total: number; contestadas: number };

export default function Ejercicio({
  pasoId,
  ejercicioId,
  tipo,
  publica,
  respondido,
  puntos,
  correccion,
  respuestas,
  escuchas,
}: PropsEjercicio) {
  const [valor, setValor] = useState<Respuestas>(respuestas ?? {});
  const [enviando, setEnviando] = useState(false);

  const consigna = (publica as { consigna?: string }).consigna ?? "";

  const cara = (() => {
    const props: PropsCara = {
      publica,
      valor,
      alCambiar: setValor,
      correccion,
      // Cerrado en cuanto está respondido, tenga o no corrección calculada:
      // ver el comentario de `PropsCara.cerrado`.
      cerrado: respondido,
      pasoId,
      escuchasUsadas: escuchas,
    };
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

  // Cada tipo decide qué cuenta como "contestada"; aquí solo se compara
  // con el total para bloquear el envío mientras falte algo.
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
  const completo = contestadas >= total;

  if (respondido) {
    return (
      <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
        <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
          Ejercicio corregido
        </p>
        <p className="mt-2 text-3xl font-extrabold text-tinta">
          {puntos ?? 0}
          <span className="ml-2 text-base font-bold text-tinta-suave">
            {/*
              "de N puntos" solo tiene sentido cuando hay una corrección que
              fije ese N. Un paso puntuado a mano por el profesor no tiene
              total con el que comparar, así que no se inventa uno.
            */}
            {correccion ? `de ${correccion.total} puntos` : "puntos"}
          </span>
        </p>
        <p className="mt-1 text-sm text-tinta-suave">
          Ya está sumado a tus puntos. Este ejercicio se responde una sola vez.
        </p>
        <div className="mt-6">{cara}</div>
      </section>
    );
  }

  return (
    <form
      action={async (formData) => {
        setEnviando(true);
        formData.set("respuestas", JSON.stringify(valor));
        await responderEjercicio(formData);
      }}
      className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave"
    >
      <input type="hidden" name="pasoId" value={pasoId} />
      <input type="hidden" name="ejercicioId" value={ejercicioId} />

      <p className="font-bold text-tinta">{consigna}</p>
      <p className="mt-1 text-sm text-tinta-suave">
        Un punto por acierto. Solo puedes enviarlo una vez.
      </p>

      <div className="mt-6">{cara}</div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando || !completo}
          className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? "Corrigiendo…" : "Enviar respuestas"}
        </button>
        <span className="text-sm text-tinta-suave">
          {contestadas} de {total} contestadas
        </span>
      </div>
    </form>
  );
}
