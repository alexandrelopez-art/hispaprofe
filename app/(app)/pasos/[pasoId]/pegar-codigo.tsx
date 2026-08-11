"use client";

import { useActionState, useState } from "react";
import {
  comprobarPegado,
  pegarEjercicio,
  type EstadoPegado,
} from "@/lib/acciones-recursos";
import type { Encargo } from "@/lib/pegado/encargo";
import Previsualizacion from "@/components/recursos/previsualizacion";

/**
 * La tercera puerta para poner el ejercicio de un paso: pegarlo ya escrito.
 *
 * Dos mitades y en este orden: primero el encargo que se le da a una IA, y
 * luego el cuadro donde se pega lo que devuelva. El orden importa porque es
 * el del viaje: sin el encargo, lo que se pegue no tiene por qué encajar.
 */
export default function PegarCodigo({
  pasoId,
  titulo,
  encargos,
}: {
  pasoId: string;
  titulo: string;
  encargos: Encargo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cual, setCual] = useState(0);
  const [copiado, setCopiado] = useState(false);

  const [comprobado, comprobar, comprobando] = useActionState<EstadoPegado, FormData>(
    comprobarPegado,
    {},
  );
  const [guardado, guardar, guardando] = useActionState<EstadoPegado, FormData>(
    pegarEjercicio,
    {},
  );

  const encargo = encargos[cual] ?? encargos[0];
  const error = guardado.error ?? comprobado.error;
  const entendido = guardado.ok ? undefined : comprobado.entendido;

  function descargar() {
    // Un Blob y un enlace de usar y tirar: no hace falta ninguna ruta nueva,
    // porque el encargo ya viaja entero en las props.
    const url = URL.createObjectURL(new Blob([encargo.texto], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `encargo-${titulo.replace(/[^\wáéíóúñü]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiar() {
    await navigator.clipboard.writeText(encargo.texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-4 rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
      >
        Pegar por código
      </button>
    );
  }

  return (
    <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-extrabold text-tinta">Pegar por código</h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
        >
          Cerrar
        </button>
      </div>

      {/* ① El encargo */}
      <p className="mt-4 text-sm font-bold text-tinta">1. El encargo para la IA</p>
      {encargos.length > 1 && (
        <label className="mt-2 block text-sm text-tinta-suave">
          Este paso no es una tarea del examen, así que elige el tipo:{" "}
          <select
            value={cual}
            onChange={(e) => setCual(Number(e.target.value))}
            className="mt-1 block rounded-xl border-2 border-hp-200 px-3 py-1.5 text-sm font-semibold text-tinta"
          >
            {encargos.map((e, i) => (
              <option key={e.motor} value={i}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={descargar}
          className="rounded-full bg-hp-500 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-hp-600"
        >
          Descargar encargo.md
        </button>
        <button
          type="button"
          onClick={copiar}
          className="rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        Dáselo a la IA junto al PDF del examen. El audio no va aquí: va en un
        bloque aparte.
      </p>

      {/* ② El cuadro */}
      <p className="mt-6 text-sm font-bold text-tinta">
        2. Lo que te devuelva, pégalo aquí
      </p>
      <form action={comprobar} className="mt-2">
        <input type="hidden" name="pasoId" value={pasoId} />
        <textarea
          name="pegado"
          rows={10}
          spellCheck={false}
          placeholder='{ "bloque": "…", "ejercicio": { … } }'
          className="w-full rounded-xl border-2 border-hp-200 p-3 font-mono text-xs text-tinta"
        />
        <button
          type="submit"
          disabled={comprobando}
          className="mt-2 rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400 disabled:opacity-50"
        >
          {comprobando ? "Comprobando…" : "Comprobar"}
        </button>
      </form>

      {/* `bg-sol-100` y no un rojo: es el color que el editor de Recursos ya
          usa tanto para el aviso como para el motivo del rechazo, y aquí no
          se inventa una convención nueva. No hay ningún `rojo-*` en el
          sistema de color del proyecto. */}
      {error && (
        <p className="mt-3 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{error}</p>
      )}

      {guardado.ok && (
        <p className="mt-3 rounded-tarjeta bg-hp-100 px-4 py-3 text-sm font-semibold text-tinta">
          {guardado.ok}
        </p>
      )}

      {entendido && (
        <div className="mt-4 border-t border-hp-100 pt-4">
          <p className="text-sm font-bold text-tinta">{entendido.resumen}</p>
          {entendido.aviso && (
            <p className="mt-2 rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
              {entendido.aviso}
            </p>
          )}
          {entendido.bloque && (
            <p className="mt-2 text-xs text-tinta-suave">
              Trae también un texto de {entendido.bloque.length} caracteres, que
              se guardará como bloque encima del ejercicio.
            </p>
          )}

          <Previsualizacion datos={entendido.datos} />

          {/*
            El texto se manda otra vez en un campo oculto en vez de fiarse de lo
            que haya en el textarea al pulsar: si se toca después de comprobar,
            lo que se guardaría no sería lo que se ha previsualizado.
          */}
          <form action={guardar} className="mt-4">
            <input type="hidden" name="pasoId" value={pasoId} />
            <input
              type="hidden"
              name="pegado"
              value={JSON.stringify({
                bloque: entendido.bloque ?? undefined,
                ejercicio: entendido.datos,
              })}
            />
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-hp-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-hp-600 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar en este paso"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
