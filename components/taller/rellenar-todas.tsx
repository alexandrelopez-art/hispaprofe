"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rellenarConIAAccion } from "@/lib/acciones-taller";
import Boton from "@/components/ui/boton";

type Resultado = { nombre: string; texto: string };

/**
 * Rellena las ocho tareas del examen en serie, una llamada tras otra: en
 * paralelo se dispararían ocho peticiones a la vez a la misma clave de la
 * API, y un fallo de una no debe cortar las demás. `router.refresh()` al
 * final, para que las ocho tarjetas se pinten con su estado nuevo de una
 * vez en lugar de una por una.
 */
export default function RellenarTodas({ tareas, hayClave }: { tareas: { id: string; nombre: string }[]; hayClave: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [resultados, setResultados] = useState<Resultado[]>([]);

  function pulsar() {
    if (!window.confirm("Va a rellenar las ocho tareas, sustituyendo lo que ya esté rellenado. ¿Seguir?")) return;
    empezar(async () => {
      setResultados([]);
      for (const tarea of tareas) {
        const r = await rellenarConIAAccion(tarea.id);
        const texto = r.error ? `error: ${r.error}` : (r.ok ?? "rellenada");
        setResultados((antes) => [...antes, { nombre: tarea.nombre, texto }]);
      }
      router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-end gap-2">
      <Boton variante="secundario" tamano="pequeno" onClick={pulsar} disabled={!hayClave || pendiente} title={hayClave ? undefined : "Falta la clave de la API"}>
        {pendiente ? `Rellenando… (${resultados.length}/${tareas.length})` : "Rellenar las ocho"}
      </Boton>
      {resultados.length > 0 && (
        <ul className="text-right text-xs text-tinta-suave">
          {resultados.map((r) => (
            <li key={r.nombre}>
              {r.nombre}: {r.texto}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
