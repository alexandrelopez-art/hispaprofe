"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrada } from "@/lib/acciones-entrada";

const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export default function Formulario({ volver }: { volver: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrada, FormData>(entrar, {});

  return (
    <form
      action={accion}
      className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
    >
      <input type="hidden" name="volver" value={volver} />
      <label className="block text-sm font-semibold text-tinta">
        Correo
        <input type="email" name="email" required autoComplete="email" className={campo} />
      </label>
      <label className="mt-4 block text-sm font-semibold text-tinta">
        Contraseña
        <input
          type="password"
          name="contrasena"
          required
          autoComplete="current-password"
          className={campo}
        />
      </label>
      {estado.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-coral-100 px-4 py-2 text-sm font-semibold text-coral-600"
        >
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="mt-5 h-10 w-full rounded-full bg-hp-400 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
