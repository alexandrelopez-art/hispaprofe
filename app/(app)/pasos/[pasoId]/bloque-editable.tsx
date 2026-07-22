"use client";

import { useState } from "react";
import {
  borrarBloque,
  editarBloque,
  moverBloque,
} from "@/lib/acciones";
import BotonConfirmar from "@/components/boton-confirmar";
import EditorTexto from "@/components/editor-texto";
import SubirImagen from "@/components/subir-imagen";

const etiquetaTipo: Record<string, string> = {
  TEXTO: "Texto",
  IMAGEN: "Imagen",
  AUDIO: "Audio",
  EMBED: "Incrustado",
  ENLACE: "Enlace",
};

const botonChico =
  "rounded-lg border border-hp-200 px-2 py-0.5 text-xs font-bold text-tinta-suave transition-colors hover:border-hp-400 hover:text-hp-600 disabled:opacity-30";

const campo =
  "w-full rounded-full border border-hp-200 bg-white px-4 py-2 text-sm text-tinta outline-none focus:border-hp-400";

type Bloque = {
  id: string;
  tipo: string;
  texto: string | null;
  url: string | null;
  etiqueta: string | null;
  imagen: string | null;
};

/**
 * Envuelve un bloque ya guardado: barra de controles arriba y, al pulsar
 * «Editar», el formulario en lugar del contenido. Cuando no se edita,
 * muestra tal cual lo que renderiza el servidor.
 */
export default function BloqueEditable({
  bloque,
  indice,
  total,
  children,
}: {
  bloque: Bloque;
  indice: number;
  total: number;
  children: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(bloque.texto ?? "");
  const [url, setUrl] = useState(bloque.url ?? "");
  const [etiqueta, setEtiqueta] = useState(bloque.etiqueta ?? "");
  const [imagen, setImagen] = useState(bloque.imagen ?? "");
  const [guardando, setGuardando] = useState(false);

  const esTexto = bloque.tipo === "TEXTO";
  const listo = esTexto ? texto.trim() !== "" : url.trim() !== "";

  function cancelar() {
    setTexto(bloque.texto ?? "");
    setUrl(bloque.url ?? "");
    setEtiqueta(bloque.etiqueta ?? "");
    setImagen(bloque.imagen ?? "");
    setEditando(false);
  }

  async function guardar() {
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      const fd = new FormData();
      fd.set("bloqueId", bloque.id);
      fd.set("texto", texto);
      fd.set("url", url);
      fd.set("etiqueta", etiqueta);
      fd.set("imagen", imagen);
      await editarBloque(fd);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
          {etiquetaTipo[bloque.tipo] ?? bloque.tipo}
        </span>

        <button
          type="button"
          onClick={() => (editando ? cancelar() : setEditando(true))}
          className={`${botonChico} ml-auto`}
        >
          {editando ? "Cancelar" : "Editar"}
        </button>

        <form action={moverBloque}>
          <input type="hidden" name="bloqueId" value={bloque.id} />
          <input type="hidden" name="direccion" value="arriba" />
          <button
            type="submit"
            disabled={indice === 0}
            title="Subir"
            className={botonChico}
          >
            ↑
          </button>
        </form>

        <form action={moverBloque}>
          <input type="hidden" name="bloqueId" value={bloque.id} />
          <input type="hidden" name="direccion" value="abajo" />
          <button
            type="submit"
            disabled={indice === total - 1}
            title="Bajar"
            className={botonChico}
          >
            ↓
          </button>
        </form>

        <form action={borrarBloque}>
          <input type="hidden" name="bloqueId" value={bloque.id} />
          <BotonConfirmar
            aviso="¿Borrar este bloque de contenido?"
            title="Borrar"
            className="rounded-lg border border-hp-200 px-2 py-0.5 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
          >
            Borrar
          </BotonConfirmar>
        </form>
      </div>

      {editando ? (
        <div className="rounded-tarjeta border border-hp-200 bg-white p-4">
          {esTexto ? (
            <EditorTexto valor={texto} alCambiar={setTexto} filas={10} />
          ) : (
            <>
              <label className="block text-sm font-semibold text-tinta">
                Dirección
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={`mt-1 ${campo} font-mono text-xs`}
                />
              </label>

              {bloque.tipo === "IMAGEN" && (
                <div className="mt-2">
                  <SubirImagen alSubir={setUrl} etiqueta="Cambiar la imagen" />
                </div>
              )}

              <label className="mt-3 block text-sm font-semibold text-tinta">
                {bloque.tipo === "ENLACE" ? "Título" : "Etiqueta"}
                <input
                  type="text"
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                  className={`mt-1 ${campo}`}
                />
              </label>

              {bloque.tipo === "ENLACE" && (
                <>
                  <label className="mt-3 block text-sm font-semibold text-tinta">
                    Descripción
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 text-sm text-tinta outline-none focus:border-hp-400"
                    />
                  </label>
                  <label className="mt-3 block text-sm font-semibold text-tinta">
                    Imagen de la tarjeta
                    <input
                      type="text"
                      value={imagen}
                      onChange={(e) => setImagen(e.target.value)}
                      className={`mt-1 ${campo} font-mono text-xs`}
                    />
                  </label>
                  <div className="mt-2">
                    <SubirImagen alSubir={setImagen} etiqueta="Usar otra imagen" />
                  </div>
                </>
              )}
            </>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={!listo || guardando}
              className="h-9 rounded-full bg-hp-400 px-4 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="h-9 rounded-full border-2 border-hp-200 px-4 text-sm font-bold text-tinta-suave transition-colors hover:border-hp-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
