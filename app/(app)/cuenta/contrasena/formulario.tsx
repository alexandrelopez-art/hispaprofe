"use client";

import { useActionState } from "react";
import Link from "next/link";
import Campo from "@/components/ui/campo";
import BotonEnviar from "@/components/ui/boton-enviar";
import Aviso from "@/components/ui/aviso";
import Tarjeta from "@/components/ui/tarjeta";
import { cambiarMiContrasena, type EstadoContrasena } from "@/lib/acciones-entrada";

export default function Formulario({ obligado }: { obligado: boolean }) {
  const [estado, accion] = useActionState<EstadoContrasena, FormData>(
    cambiarMiContrasena,
    {},
  );

  if (estado.hecho) {
    return (
      <Tarjeta acento="verde" className="mt-8">
        <p className="font-bold text-verde-600">Contraseña guardada.</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm font-semibold text-hp-600 hover:text-hp-500">
          Ir a mi panel →
        </Link>
      </Tarjeta>
    );
  }

  return (
    <form action={accion} className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      {!obligado && (
        <Campo etiqueta="Contraseña actual" name="actual" tipo="contrasena" required autoComplete="current-password" />
      )}
      <Campo etiqueta="Contraseña nueva" name="nueva" tipo="contrasena" required minLength={8} autoComplete="new-password" className="mt-4" />
      <Campo etiqueta="Repítela" name="repetida" tipo="contrasena" required minLength={8} autoComplete="new-password" className="mt-4" />
      <p className="mt-2 text-xs text-tinta-suave">Al menos 8 caracteres.</p>
      {estado.error && (
        <Aviso tono="error" className="mt-4">{estado.error}</Aviso>
      )}
      <BotonEnviar gerundio="Guardando…" className="mt-5">
        Guardar
      </BotonEnviar>
    </form>
  );
}
