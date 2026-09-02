"use client";

import { useActionState } from "react";
import Campo from "@/components/ui/campo";
import BotonEnviar from "@/components/ui/boton-enviar";
import Aviso from "@/components/ui/aviso";
import { entrar, type EstadoEntrada } from "@/lib/acciones-entrada";

export default function Formulario({ volver }: { volver: string }) {
  const [estado, accion] = useActionState<EstadoEntrada, FormData>(entrar, {});

  return (
    <form
      action={accion}
      className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
    >
      <input type="hidden" name="volver" value={volver} />
      <Campo etiqueta="Correo" name="email" tipo="correo" required autoComplete="email" />
      <Campo
        etiqueta="Contraseña"
        name="contrasena"
        tipo="contrasena"
        required
        autoComplete="current-password"
        className="mt-4"
      />
      {estado.error && (
        <Aviso tono="error" className="mt-4">{estado.error}</Aviso>
      )}
      <BotonEnviar gerundio="Entrando…" className="mt-5 w-full">
        Entrar
      </BotonEnviar>
    </form>
  );
}
