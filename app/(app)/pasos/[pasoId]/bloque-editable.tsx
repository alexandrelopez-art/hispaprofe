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
import SubirAudio from "@/components/recursos/subir-audio";
import { esAudioDeDrive } from "@/lib/bloques";
import Aviso from "@/components/ui/aviso";
import Boton, { clasesDeBoton } from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Rotulo from "@/components/ui/rotulo";

const etiquetaTipo: Record<string, string> = {
  TEXTO: "Texto",
  IMAGEN: "Imagen",
  AUDIO: "Audio",
  EMBED: "Incrustado",
  ENLACE: "Enlace",
};

// ↑ y ↓ se quedan con su propia clase: necesitan `disabled` según la
// posición del bloque, y BotonEnviar solo sabe apagarse en vuelo.
const botonChico =
  "rounded-lg border border-hp-200 px-2 py-0.5 text-xs font-bold text-tinta-suave transition-colors hover:border-hp-400 hover:text-hp-600 disabled:opacity-30";

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
  racionado,
  children,
}: {
  bloque: Bloque;
  indice: number;
  total: number;
  racionado: boolean;
  children: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(bloque.texto ?? "");
  const [url, setUrl] = useState(bloque.url ?? "");
  const [etiqueta, setEtiqueta] = useState(bloque.etiqueta ?? "");
  const [imagen, setImagen] = useState(bloque.imagen ?? "");
  const [guardando, setGuardando] = useState(false);
  // Lo que el servidor contesta cuando se niega. Es la única forma de saberlo:
  // `editarBloque` es una acción, y aquí se llama a mano y se espera.
  const [motivo, setMotivo] = useState<string | null>(null);

  const esTexto = bloque.tipo === "TEXTO";
  const listo = esTexto ? texto.trim() !== "" : url.trim() !== "";

  function cancelar() {
    setTexto(bloque.texto ?? "");
    setUrl(bloque.url ?? "");
    setEtiqueta(bloque.etiqueta ?? "");
    setImagen(bloque.imagen ?? "");
    setMotivo(null);
    setEditando(false);
  }

  async function guardar() {
    if (!listo || guardando) return;
    setGuardando(true);
    setMotivo(null);
    try {
      const fd = new FormData();
      fd.set("bloqueId", bloque.id);
      fd.set("texto", texto);
      fd.set("url", url);
      fd.set("etiqueta", etiqueta);
      fd.set("imagen", imagen);
      const resultado = await editarBloque(fd);
      if (resultado?.error) {
        setMotivo(resultado.error);
        return;
      }
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Rotulo>{etiquetaTipo[bloque.tipo] ?? bloque.tipo}</Rotulo>

        <Boton
          variante="sutil"
          tamano="pequeno"
          onClick={() => (editando ? cancelar() : setEditando(true))}
          className="ml-auto"
        >
          {editando ? "Cancelar" : "Editar"}
        </Boton>

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
            className={clasesDeBoton("peligro", "pequeno")}
          >
            Borrar
          </BotonConfirmar>
        </form>
      </div>

      {/* Solo la ve el profesor, y no por una condición de aquí: esta marca vive
          dentro de `BloqueEditable`, y la página solo envuelve el bloque en
          `BloqueEditable` cuando `esProfe` (ver page.tsx). Si algún día se
          mueve a `BloqueContenido` —que sí lo ve el estudiante— la marca
          empieza a delatar al examen que el audio no cuenta las escuchas. */}
      {racionado && esAudioDeDrive(bloque.url) && (
        <Aviso tono="aviso" className="mt-2">
          Este contenido va incrustado de Drive: la aplicación no puede contar
          cuántas veces se abre. En una prueba, el estudiante puede oírlo sin
          límite.
        </Aviso>
      )}

      {editando ? (
        <div className="rounded-tarjeta border border-hp-200 bg-white p-4">
          {esTexto ? (
            <EditorTexto valor={texto} alCambiar={setTexto} filas={10} />
          ) : (
            <>
              <Campo
                etiqueta="Dirección"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1"
              />

              {bloque.tipo === "IMAGEN" && (
                <div className="mt-2">
                  <SubirImagen alSubir={setUrl} etiqueta="Cambiar la imagen" />
                </div>
              )}

              {bloque.tipo === "AUDIO" && (
                <div className="mt-2">
                  <SubirAudio
                    valor={url.startsWith("/api/archivos/") ? url : undefined}
                    alCambiar={(nueva) => setUrl(nueva ?? "")}
                  />
                </div>
              )}

              <Campo
                etiqueta={bloque.tipo === "ENLACE" ? "Título" : "Etiqueta"}
                name="etiqueta"
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
                className="mt-3"
              />

              {bloque.tipo === "ENLACE" && (
                <>
                  <Campo
                    etiqueta="Descripción"
                    name="texto"
                    tipo="area"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={2}
                    className="mt-3"
                  />
                  <Campo
                    etiqueta="Imagen de la tarjeta"
                    name="imagen"
                    value={imagen}
                    onChange={(e) => setImagen(e.target.value)}
                    className="mt-3"
                  />
                  <div className="mt-2">
                    <SubirImagen alSubir={setImagen} etiqueta="Usar otra imagen" />
                  </div>
                </>
              )}
            </>
          )}

          {motivo && (
            <Aviso tono="error" className="mt-3">
              {motivo}
            </Aviso>
          )}

          <div className="mt-4 flex gap-2">
            <Boton
              tamano="pequeno"
              onClick={() => void guardar()}
              disabled={!listo || guardando}
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
            <Boton variante="sutil" tamano="pequeno" onClick={cancelar}>
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
