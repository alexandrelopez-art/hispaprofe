"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  borrarEjercicio,
  despublicarEjercicio,
  duplicarEjercicio,
  guardarEjercicio,
  publicarEjercicio,
  type EstadoRecurso,
} from "@/lib/acciones-recursos";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import Previsualizacion from "./previsualizacion";
import EditorOpcion, { OPCION_VACIA } from "./editor-opcion";
import { campo } from "./campos";

const NIVELES = ["A1", "A2", "B1", "B2", "C1", "A2_B1_ESCOLAR"] as const;
const DESTREZAS: Record<string, string> = {
  CE: "Comprensión escrita",
  CO: "Comprensión oral",
  EE: "Expresión escrita",
  EO: "Expresión oral",
  EEI: "Interacción escrita",
  EOI: "Interacción oral",
};

/**
 * El punto de partida de cada tipo. Parcial a propósito: un tipo entra aquí
 * cuando tiene editor, y `nuevo/page.tsx` solo ofrece los que están.
 */
export const VACIO: Partial<Record<MarcaEjercicio, unknown>> = {
  opcion: OPCION_VACIA,
};

export type FilaEjercicio = {
  id: string;
  titulo: string;
  nivel: string;
  destreza: string | null;
  etiquetas: string[];
  datos: unknown;
  publicado: boolean;
};

export default function Editor({
  inicial,
  marca,
  bloqueado,
}: {
  inicial: FilaEjercicio | null;
  marca: MarcaEjercicio;
  /** El motivo por el que no se puede editar, si lo hay. */
  bloqueado: string | null;
}) {
  const router = useRouter();

  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [nivel, setNivel] = useState(inicial?.nivel ?? "B1");
  const [destreza, setDestreza] = useState(inicial?.destreza ?? "");
  const [etiquetas, setEtiquetas] = useState((inicial?.etiquetas ?? []).join(", "));
  const [datos, setDatos] = useState<unknown>(inicial?.datos ?? VACIO[marca]);

  const [estado, guardar, guardando] = useActionState<EstadoRecurso, FormData>(
    guardarEjercicio,
    {},
  );
  const [estadoPublicar, publicar] = useActionState<EstadoRecurso, FormData>(
    inicial?.publicado ? despublicarEjercicio : publicarEjercicio,
    {},
  );
  const [estadoDuplicar, duplicarAccion] = useActionState<EstadoRecurso, FormData>(
    duplicarEjercicio,
    {},
  );
  const [estadoBorrar, borrar] = useActionState<EstadoRecurso, FormData>(
    borrarEjercicio,
    {},
  );

  /**
   * Guardar uno nuevo devuelve el id de la fila recién creada y duplicar el
   * de la copia; en los dos casos hay que irse a su página, o el siguiente
   * «Guardar» crearía otra fila más. Borrar devuelve a la lista.
   *
   * Va en un efecto y no suelto en el cuerpo: navegar durante el render es
   * un efecto secundario, y React lo castiga con avisos y con navegaciones
   * repetidas en cada repintado.
   */
  const idNuevo = !inicial && estado.id ? estado.id : null;
  useEffect(() => {
    if (idNuevo) router.replace(`/profe/recursos/${idNuevo}`);
  }, [idNuevo, router]);
  useEffect(() => {
    if (estadoDuplicar.id) router.replace(`/profe/recursos/${estadoDuplicar.id}`);
  }, [estadoDuplicar.id, router]);
  useEffect(() => {
    if (estadoBorrar.ok) router.replace("/profe/recursos");
  }, [estadoBorrar.ok, router]);

  /**
   * Un solo mensaje para las cuatro acciones, no cuatro bloques copiados:
   * al segundo guardado de un ejercicio ya existente no hay ningún sitio a
   * donde navegar, así que sin esto el "Guardado." no se veía nunca, y
   * duplicar fallaba en silencio porque a su bloque de error le tocó
   * quedarse fuera cuando había cuatro copiados a mano. El error manda sobre
   * la confirmación: si algo falló, no tiene sentido enseñar un "ok" de otra
   * acción a la vez.
   */
  const mensajeError =
    estado.error ?? estadoPublicar.error ?? estadoDuplicar.error ?? estadoBorrar.error ?? null;
  const mensajeOk = mensajeError
    ? null
    : (estado.ok ?? estadoPublicar.ok ?? estadoDuplicar.ok ?? null);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form action={guardar} className="space-y-6">
        <input type="hidden" name="id" value={inicial?.id ?? ""} />
        <input type="hidden" name="datos" value={JSON.stringify(datos)} />
        <input type="hidden" name="titulo" value={titulo} />
        <input type="hidden" name="nivel" value={nivel} />
        <input type="hidden" name="destreza" value={destreza} />
        <input type="hidden" name="etiquetas" value={etiquetas} />

        {bloqueado && (
          <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
            {bloqueado}{" "}
            <button formAction={duplicarAccion} name="id" value={inicial?.id ?? ""} className="font-bold underline">
              Duplicar y editar la copia
            </button>
          </p>
        )}

        <div className="flex flex-wrap gap-4">
          <label className="block flex-1 text-sm font-semibold text-tinta">
            Título
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={campo}
              disabled={Boolean(bloqueado)}
            />
          </label>

          <label className="block w-44 text-sm font-semibold text-tinta">
            Nivel
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className={campo}
              disabled={Boolean(bloqueado)}
            >
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : n}
                </option>
              ))}
            </select>
          </label>

          <label className="block w-56 text-sm font-semibold text-tinta">
            Destreza
            <select
              value={destreza}
              onChange={(e) => setDestreza(e.target.value)}
              className={campo}
              disabled={Boolean(bloqueado)}
            >
              <option value="">Ninguna</option>
              {Object.entries(DESTREZAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold text-tinta">
          Etiquetas, separadas por comas
          <input
            type="text"
            value={etiquetas}
            onChange={(e) => setEtiquetas(e.target.value)}
            placeholder="la casa, ser y estar"
            className={campo}
            disabled={Boolean(bloqueado)}
          />
        </label>

        <fieldset disabled={Boolean(bloqueado)}>
          {marca === "opcion" ? (
            <EditorOpcion datos={datos} alCambiar={setDatos} />
          ) : (
            <p className="rounded-tarjeta border border-dashed border-hp-200 p-6 text-center text-sm text-tinta-suave">
              Este tipo de ejercicio todavía no tiene editor. Puedes cambiar
              el título, el nivel, la destreza y las etiquetas, pero no su
              contenido.
            </p>
          )}
        </fieldset>

        {mensajeError && (
          <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{mensajeError}</p>
        )}
        {mensajeOk && (
          <p className="rounded-tarjeta bg-hp-100 px-4 py-3 text-sm text-tinta">{mensajeOk}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={guardando || Boolean(bloqueado)}
            className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>

          {inicial && (
            <button
              formAction={publicar}
              name="id"
              value={inicial.id}
              className="h-11 rounded-full border border-hp-200 px-6 text-sm font-bold text-tinta hover:border-hp-400"
            >
              {inicial.publicado ? "Volver a borrador" : "Publicar"}
            </button>
          )}

          <span className="flex-1 text-sm text-tinta-suave">
            {inicial?.publicado ? "Publicado" : "Borrador"}
          </span>

          {/*
            Borrar solo tiene sentido para limpiar los borradores que uno
            deja por el camino. Si cuelga de algún paso, `puedeBorrarse` lo
            niega y el motivo sale arriba.
          */}
          {inicial && (
            <button
              formAction={borrar}
              name="id"
              value={inicial.id}
              className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
            >
              Borrar
            </button>
          )}
        </div>
      </form>

      <Previsualizacion datos={datos} />
    </div>
  );
}
