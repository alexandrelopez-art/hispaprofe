"use client";

import { useRef, useState } from "react";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";

/**
 * Reduce la imagen en el navegador antes de subirla. Una foto de móvil de
 * 8 MP baja a unos 200 KB sin diferencia visible en pantalla, y así la base
 * de datos no se llena de fotos a tamaño original.
 */
async function reducir(archivo: File): Promise<Blob> {
  // Los SVG y los GIF animados se rompen al pasarlos por el lienzo.
  if (archivo.type === "image/svg+xml" || archivo.type === "image/gif") {
    return archivo;
  }

  const mapa = await createImageBitmap(archivo);
  const maximo = 1600;
  const escala = Math.min(1, maximo / Math.max(mapa.width, mapa.height));
  const ancho = Math.round(mapa.width * escala);
  const alto = Math.round(mapa.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext("2d")?.drawImage(mapa, 0, 0, ancho, alto);
  mapa.close();

  return new Promise((resolver) =>
    lienzo.toBlob(
      (b) => resolver(b ?? archivo),
      "image/webp",
      0.85,
    ),
  );
}

function comoKb(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SubirImagen({
  alSubir,
  etiqueta = "Subir una imagen",
}: {
  alSubir: (url: string) => void;
  etiqueta?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");

  async function manejar(archivo: File) {
    setError("");
    setNota("");
    setSubiendo(true);
    try {
      const reducida = await reducir(archivo);
      const cuerpo = new FormData();
      cuerpo.append(
        "archivo",
        new File([reducida], archivo.name.replace(/\.\w+$/, ".webp"), {
          type: reducida.type || archivo.type,
        }),
      );

      const respuesta = await fetch("/api/archivos", {
        method: "POST",
        body: cuerpo,
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setError(datos.error ?? "No se pudo subir.");
        return;
      }

      alSubir(datos.url);
      setNota(
        `Subida: ${comoKb(archivo.size)} → ${comoKb(reducida.size)}`,
      );
    } catch {
      setError("No se pudo procesar esa imagen.");
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div>
      <Boton variante="sutil" onClick={() => entrada.current?.click()} disabled={subiendo}>
        {subiendo ? "Subiendo…" : etiqueta}
      </Boton>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void manejar(archivo);
        }}
      />

      {nota && (
        <Aviso tono="ok" className="mt-2">
          {nota}
        </Aviso>
      )}
      {/* Error amarillo → rojo: el cambio visual deliberado de esta sesión. */}
      {error && (
        <Aviso tono="error" className="mt-2">
          {error}
        </Aviso>
      )}
    </div>
  );
}
