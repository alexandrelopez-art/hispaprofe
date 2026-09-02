"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cambiarMiContrasena, type EstadoContrasena } from "@/lib/acciones-entrada";

const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export default function Formulario({ obligado }: { obligado: boolean }) {
  const [estado, accion, enviando] = useActionState<EstadoContrasena, FormData>(
    cambiarMiContrasena,
    {},
  );

  if (estado.hecho) {
    return (
      <div className="mt-8 rounded-tarjeta border border-verde-500/40 bg-verde-100 p-5">
        <p className="font-bold text-verde-600">Contraseña guardada.</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm font-semibold text-hp-600 hover:text-hp-500">
          Ir a mi panel →
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      {!obligado && (
        <label className="block text-sm font-semibold text-tinta">
          Contraseña actual
          <input type="password" name="actual" required autoComplete="current-password" className={campo} />
        </label>
      )}
      <label className="mt-4 block text-sm font-semibold text-tinta">
        Contraseña nueva
        <input type="password" name="nueva" required minLength={8} autoComplete="new-password" className={campo} />
      </label>
      <label className="mt-4 block text-sm font-semibold text-tinta">
        Repítela
        <input type="password" name="repetida" required minLength={8} autoComplete="new-password" className={campo} />
      </label>
      <p className="mt-2 text-xs text-tinta-suave">Al menos 8 caracteres.</p>
      {estado.error && (
        <p role="alert" className="mt-4 rounded-xl bg-coral-100 px-4 py-2 text-sm font-semibold text-coral-600">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-60"
      >
        {enviando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
