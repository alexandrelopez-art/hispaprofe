"use client";

import { useState } from "react";
import { crearBloque, obtenerMetadatos } from "@/lib/acciones";

type Tipo = "TEXTO" | "EMBED" | "AUDIO" | "IMAGEN" | "ENLACE";

const TIPOS: { id: Tipo; label: string; ayuda: string }[] = [
  {
    id: "TEXTO",
    label: "Texto",
    ayuda: "Consigna, explicación o transcripción.",
  },
  {
    id: "EMBED",
    label: "Genially, vídeo o actividad",
    ayuda:
      "Pega el código de inserción (<iframe...>) o la URL. Reconoce YouTube, Vimeo y Genially.",
  },
  {
    id: "ENLACE",
    label: "Enlace",
    ayuda:
      "Se muestra como tarjeta con título, descripción e imagen del sitio.",
  },
  {
    id: "IMAGEN",
    label: "Imagen",
    ayuda:
      "La dirección del archivo, terminada en .jpg, .png o .webp. No sirve el enlace de una página que contiene la imagen.",
  },
  {
    id: "AUDIO",
    label: "Audio",
    ayuda: "Dirección directa de un archivo mp3.",
  },
];

/** ID de YouTube, para sacar la miniatura sin pedirle nada a nadie. */
function idYoutube(t: string): string {
  return (
    t.match(
      /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/,
    )?.[1] ?? ""
  );
}

/**
 * Saca la URL insertable de lo que pegue el profesor: el código <iframe>
 * completo, o una URL suelta de YouTube o Vimeo.
 */
function extraerSrc(entrada: string): string {
  const t = entrada.trim();
  if (!t) return "";

  const iframe = t.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframe) return iframe[1];

  const yt = idYoutube(t);
  if (yt) return `https://www.youtube.com/embed/${yt}`;

  const vimeo = t.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return t;
}

/**
 * Convierte enlaces de Google Drive y Dropbox al archivo directo.
 * Son los dos casos que más se pegan por error creyendo que son imágenes.
 */
function urlDirectaImagen(entrada: string): string {
  const t = entrada.trim();
  if (!t) return "";

  const drive = t.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/uc?export=view&id=${drive[1]}`;

  const driveAbierto = t.match(/drive\.google\.com\/open\?id=([\w-]+)/);
  if (driveAbierto)
    return `https://drive.google.com/uc?export=view&id=${driveAbierto[1]}`;

  if (t.includes("dropbox.com")) {
    return t.replace(/[?&]dl=0/, "").replace("www.dropbox.com", "dl.dropboxusercontent.com");
  }

  return t;
}

function origenDe(src: string): string {
  if (src.includes("youtube.com/embed")) return "YouTube";
  if (src.includes("player.vimeo.com")) return "Vimeo";
  if (src.includes("genial")) return "Genially";
  if (src.includes("padlet")) return "Padlet";
  if (src.includes("wordwall")) return "Wordwall";
  if (src.includes("learningapps")) return "LearningApps";
  return "";
}

const campo =
  "w-full rounded-full border border-hp-200 bg-white px-4 py-2 text-sm text-tinta outline-none focus:border-hp-400";

export default function EditorBloques({ pasoId }: { pasoId: string }) {
  const [tipo, setTipo] = useState<Tipo>("TEXTO");
  const [entrada, setEntrada] = useState("");
  const [texto, setTexto] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [imagen, setImagen] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [falloImagen, setFalloImagen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const src =
    tipo === "TEXTO"
      ? ""
      : tipo === "IMAGEN"
        ? urlDirectaImagen(entrada)
        : extraerSrc(entrada);

  const origen = origenDe(src);
  const listo = tipo === "TEXTO" ? texto.trim() !== "" : src !== "";
  const ayuda = TIPOS.find((t) => t.id === tipo)!.ayuda;

  function reiniciar() {
    setEntrada("");
    setTexto("");
    setEtiqueta("");
    setImagen("");
    setAviso("");
    setFalloImagen(false);
  }

  function cambiarTipo(nuevo: Tipo) {
    setTipo(nuevo);
    reiniciar();
  }

  /** Al salir del campo, va a buscar título, descripción e imagen. */
  async function buscarMetadatos() {
    if (tipo === "ENLACE" && src) {
      setBuscando(true);
      setAviso("");
      try {
        const meta = await obtenerMetadatos(src);
        if (meta.error) {
          setAviso(meta.error);
        } else {
          if (meta.titulo && !etiqueta) setEtiqueta(meta.titulo);
          if (meta.descripcion && !texto) setTexto(meta.descripcion);
          if (meta.imagen) setImagen(meta.imagen);
          if (!meta.titulo && !meta.imagen) {
            setAviso("Ese sitio no da vista previa. Escribe tú el título.");
          }
        }
      } finally {
        setBuscando(false);
      }
    }

    // Los vídeos de YouTube traen miniatura sin necesidad de pedir nada.
    if (tipo === "EMBED") {
      const id = idYoutube(entrada);
      setImagen(id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "");
    }
  }

  async function enviar() {
    if (!listo || enviando) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("pasoId", pasoId);
      fd.set("tipo", tipo);
      fd.set("texto", texto);
      fd.set("url", src);
      fd.set("etiqueta", etiqueta);
      fd.set("imagen", imagen);
      await crearBloque(fd);
      reiniciar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <h2 className="text-lg font-bold text-tinta">Añadir contenido</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => cambiarTipo(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              tipo === t.id
                ? "bg-hp-400 text-white"
                : "border border-hp-200 text-tinta-suave hover:border-hp-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-tinta-suave">{ayuda}</p>

      {tipo === "TEXTO" ? (
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="Escribe aquí…"
          className="mt-3 w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 text-sm text-tinta outline-none focus:border-hp-400"
        />
      ) : (
        <textarea
          value={entrada}
          onChange={(e) => {
            setEntrada(e.target.value);
            setFalloImagen(false);
          }}
          onBlur={() => void buscarMetadatos()}
          rows={tipo === "EMBED" ? 3 : 1}
          placeholder={
            tipo === "EMBED"
              ? "Pega aquí el código de inserción o la URL…"
              : "https://…"
          }
          className="mt-3 w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 font-mono text-xs text-tinta outline-none focus:border-hp-400"
        />
      )}

      {buscando && (
        <p className="mt-2 text-xs font-semibold text-tinta-suave">
          Leyendo la página…
        </p>
      )}

      {aviso && (
        <p className="mt-2 rounded-xl bg-sol-100 px-3 py-2 text-xs text-tinta">
          {aviso}
        </p>
      )}

      {tipo !== "TEXTO" && (
        <input
          type="text"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          placeholder={
            tipo === "ENLACE"
              ? "Título del enlace"
              : "Etiqueta o descripción (opcional)"
          }
          className={`mt-3 ${campo}`}
        />
      )}

      {tipo === "ENLACE" && (
        <>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Descripción (opcional)"
            className="mt-3 w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 text-sm text-tinta outline-none focus:border-hp-400"
          />
          <input
            type="text"
            value={imagen}
            onChange={(e) => setImagen(e.target.value)}
            placeholder="Imagen de la tarjeta (se rellena sola)"
            className={`mt-3 ${campo} font-mono text-xs`}
          />
        </>
      )}

      {src && (
        <div className="mt-4 rounded-2xl border border-dashed border-hp-200 bg-fondo p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-tinta-suave">
            Vista previa{origen && ` · ${origen}`}
          </p>

          {tipo === "EMBED" && (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-hp-100 bg-white">
              <iframe
                src={src}
                title="Vista previa"
                className="h-full w-full"
                allowFullScreen
              />
            </div>
          )}

          {tipo === "IMAGEN" &&
            (falloImagen ? (
              <p className="rounded-xl bg-bloque3/20 px-3 py-2 text-xs text-tinta">
                Esa dirección no muestra ninguna imagen. Suele pasar cuando el
                enlace es el de una página, no el del archivo: abre la imagen
                sola, haz clic derecho y elige «Copiar dirección de la imagen».
              </p>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src}
                alt={etiqueta}
                onError={() => setFalloImagen(true)}
                className="w-full rounded-xl border border-hp-100"
              />
            ))}

          {tipo === "AUDIO" && <audio controls className="w-full" src={src} />}

          {tipo === "ENLACE" && (
            <div className="overflow-hidden rounded-xl border border-hp-100 bg-white">
              {imagen && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imagen}
                  alt=""
                  className="h-40 w-full object-cover"
                  onError={() => setImagen("")}
                />
              )}
              <div className="p-3">
                <p className="font-bold text-tinta">
                  {etiqueta || "Sin título"}
                </p>
                {texto && (
                  <p className="mt-1 line-clamp-2 text-sm text-tinta-suave">
                    {texto}
                  </p>
                )}
                <p className="mt-1 truncate text-xs text-hp-600">{src}</p>
              </div>
            </div>
          )}

          {tipo === "EMBED" && imagen && (
            <p className="mt-2 text-xs text-tinta-suave">
              Miniatura guardada para anunciar el vídeo.
            </p>
          )}

          {tipo === "EMBED" && src !== entrada.trim() && (
            <p className="mt-2 break-all font-mono text-[11px] text-tinta-suave">
              {src}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => void enviar()}
        disabled={!listo || enviando}
        className="mt-4 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-50"
      >
        {enviando ? "Añadiendo…" : "Añadir bloque"}
      </button>

      {tipo === "EMBED" && (
        <p className="mt-3 text-xs text-tinta-suave">
          Si la vista previa sale en blanco, ese sitio no permite incrustarse.
          Ponlo entonces como enlace.
        </p>
      )}
    </section>
  );
}
