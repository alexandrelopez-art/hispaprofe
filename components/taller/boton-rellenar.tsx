"use client";

import { useState, useTransition } from "react";
import { rellenarConIAAccion } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";

export default function BotonRellenar({ tareaId, hayClave, yaRellenada }: { tareaId: string; hayClave: boolean; yaRellenada: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  function pulsar() {
    if (yaRellenada && !window.confirm("Esta tarea ya está rellenada. ¿Sustituir lo que hay?")) return;
    empezar(async () => {
      const r = await rellenarConIAAccion(tareaId);
      setMensaje(r.error ? { tono: "error", texto: r.error } : { tono: "ok", texto: r.ok ?? "Rellenada." });
    });
  }
  return (
    <span className="flex flex-col gap-2">
      <Boton variante="primario" tamano="pequeno" onClick={pulsar} disabled={!hayClave || pendiente} title={hayClave ? undefined : "Falta la clave de la API"}>
        {pendiente ? "Leyendo la página…" : "Rellenar con IA"}
      </Boton>
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
    </span>
  );
}
