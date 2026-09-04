"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rellenarConIAAccion } from "@/lib/acciones-taller";
import Boton from "@/components/ui/boton";

type Resultado = { nombre: string; texto: string };

/**
 * Rellena las ocho tareas del examen en serie, una llamada tras otra: en
 * paralelo se dispararían ocho peticiones a la vez a la misma clave de la
 * API, y un fallo de una no debe cortar las demás. Por eso cada llamada va
 * en su propio `try/catch`: `rellenarConIAAccion` ya devuelve sus errores
 * como `{ error }`, pero un rechazo de verdad (la conexión se cae, Next
 * mata la petición) no está capturado ahí y sin este `catch` cortaría el
 * `for` entero, dejando las tareas siguientes sin intentar. `router.refresh()`
 * al final es inocuo, no imprescindible: cada `rellenarConIAAccion` ya
 * llama a `revalidatePath`, así que cada respuesta trae consigo el árbol
 * nuevo de esa tarea; se deja como red por si algún día una tarea no
 * revalida por su cuenta.
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
        let texto: string;
        try {
          const r = await rellenarConIAAccion(tarea.id);
          texto = r.error ? `error: ${r.error}` : (r.ok ?? "rellenada");
        } catch (e) {
          texto = `error: ${e instanceof Error ? e.message : "no se pudo rellenar."}`;
        }
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
