"use client";

import { useActionState } from "react";
import { subirCuadernilloAccion, type EstadoTaller } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Rotulo from "@/components/ui/rotulo";

export default function Cuadernillo({ examenId, caracteres }: { examenId: string; caracteres: number | null }) {
  const [estado, accion] = useActionState<EstadoTaller, FormData>(subirCuadernilloAccion, {});
  return (
    <form action={accion}>
      <Rotulo>Cuadernillo de claves</Rotulo>
      <p className="mt-1 text-sm text-tinta-suave">
        {caracteres ? `Guardado: ${caracteres.toLocaleString("es")} caracteres de texto.` : "Sin cuadernillo: la IA rellenará sin marcar las respuestas correctas."}
      </p>
      <input type="hidden" name="examenId" value={examenId} />
      <input type="file" name="cuadernillo" accept="application/pdf" className="mt-2 block text-sm" required />
      <BotonEnviar gerundio="Leyendo el PDF…" variante="secundario" tamano="pequeno" className="mt-2">Guardar cuadernillo</BotonEnviar>
      {estado.error && <Aviso tono="error" className="mt-2">{estado.error}</Aviso>}
      {estado.ok && <Aviso tono="ok" className="mt-2">{estado.ok}</Aviso>}
    </form>
  );
}
