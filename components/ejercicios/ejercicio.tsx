"use client";

import { useState } from "react";
import { responderEjercicio } from "@/lib/acciones";
import type { Correccion, Respuestas } from "@/lib/ejercicios/tipos";
import CaraOpcion from "./opcion";
import CaraHuecos from "./huecos";
import CaraRelacionar from "./relacionar";
import CaraOrdenar from "./ordenar";

export type PropsEjercicio = {
  pasoId: string;
  ejercicioId: string;
  tipo: "opcion" | "huecos" | "relacionar" | "ordenar";
  /** La versión sin soluciones. Su forma la fija cada tipo. */
  publica: unknown;
  respondido: boolean;
  puntos: number | null;
  /** Solo llega cuando el ejercicio ya está cerrado. */
  correccion: Correccion | null;
};

export type PropsCara = {
  publica: unknown;
  valor: Respuestas;
  alCambiar: (nuevo: Respuestas) => void;
  correccion: Correccion | null;
};

export default function Ejercicio({
  pasoId,
  ejercicioId,
  tipo,
  publica,
  respondido,
  puntos,
  correccion,
}: PropsEjercicio) {
  const [valor, setValor] = useState<Respuestas>({});
  const [enviando, setEnviando] = useState(false);

  const consigna = (publica as { consigna?: string }).consigna ?? "";

  const cara = (() => {
    const props: PropsCara = { publica, valor, alCambiar: setValor, correccion };
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

  if (respondido) {
    return (
      <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
        <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
          Ejercicio corregido
        </p>
        <p className="mt-2 text-3xl font-extrabold text-tinta">
          {puntos ?? 0}
          <span className="ml-2 text-base font-bold text-tinta-suave">
            de {correccion?.total ?? puntos ?? 0} puntos
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

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? "Corrigiendo…" : "Enviar respuestas"}
      </button>
    </form>
  );
}
