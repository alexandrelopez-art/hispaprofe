"use client";

import { useActionState } from "react";
import {
  ponerContrasenaAEstudiante,
  type EstadoNuevaContrasena,
} from "@/lib/acciones-entrada";

/**
 * Botón que pone una contraseña nueva y la enseña UNA vez. No redirige: una
 * redirección la perdería, y no hay otra forma de volver a verla.
 */
export default function NuevaContrasena({
  usuarioId,
  compacto = false,
}: {
  usuarioId: string;
  compacto?: boolean;
}) {
  const [estado, accion, enviando] = useActionState<EstadoNuevaContrasena, FormData>(
    ponerContrasenaAEstudiante,
    {},
  );

  if (estado.contrasena) {
    return (
      <div className="rounded-xl bg-sol-100 px-4 py-3 text-sm">
        <p className="font-bold text-tinta">
          Contraseña nueva: <code className="rounded bg-white px-2 py-0.5 text-base">{estado.contrasena}</code>
        </p>
        <p className="mt-1 text-tinta-suave">
          Apúntala y dásela: no se vuelve a ver. Al entrar tendrá que cambiarla.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <button
        type="submit"
        disabled={enviando}
        className={
          compacto
            ? "rounded-full border border-hp-200 px-3 py-1 text-xs font-semibold text-tinta-suave hover:border-hp-400 hover:text-hp-500 disabled:opacity-60"
            : "h-9 rounded-full border border-hp-300 px-4 text-sm font-bold text-hp-600 hover:border-hp-400 disabled:opacity-60"
        }
      >
        {enviando ? "Generando…" : "Nueva contraseña"}
      </button>
      {estado.error && (
        <span role="alert" className="ml-3 text-sm font-semibold text-coral-600">{estado.error}</span>
      )}
    </form>
  );
}
