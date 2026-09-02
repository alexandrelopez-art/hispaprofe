"use client";

import { useActionState } from "react";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
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
  const [estado, accion] = useActionState<EstadoNuevaContrasena, FormData>(
    ponerContrasenaAEstudiante,
    {},
  );

  if (estado.contrasena) {
    return (
      <Aviso tono="aviso">
        Contraseña nueva: <code className="rounded bg-white px-2 py-0.5 text-base">{estado.contrasena}</code>
        <br />
        <span className="mt-1 block font-normal text-tinta-suave">
          Apúntala y dásela: no se vuelve a ver. Al entrar tendrá que cambiarla.
        </span>
      </Aviso>
    );
  }

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <BotonEnviar
        gerundio="Generando…"
        variante={compacto ? "sutil" : "secundario"}
        tamano={compacto ? "pequeno" : "normal"}
      >
        Nueva contraseña
      </BotonEnviar>
      {estado.error && (
        <span role="alert" className="ml-3 text-sm font-semibold text-coral-600">{estado.error}</span>
      )}
    </form>
  );
}
