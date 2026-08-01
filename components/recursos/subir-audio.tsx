"use client";

import { useRef, useState } from "react";
import { campo } from "./campos";

/**
 * Elige el audio de un ejercicio: subiendo un archivo o pegando una
 * dirección. Las dos vías acaban siendo lo mismo —una dirección en el campo
 * `audio`—, así que subir solo añade una forma de generarla.
 *
 * No reduce nada en el navegador, a diferencia de `subir-imagen.tsx`:
 * recomprimir audio en el navegador estropea la voz. Lo hace el servidor al
 * recibirlo, que es la parte lenta de la espera y por eso el botón lo dice.
 */
export default function SubirAudio({
  valor,
  alCambiar,
}: {
  valor?: string;
  alCambiar: (url: string | undefined) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.set("archivo", archivo);
      const respuesta = await fetch("/api/archivos", { method: "POST", body: cuerpo });
      const json = await respuesta.json();
      if (!respuesta.ok) {
        setError(json.error ?? "No se pudo subir el audio.");
        return;
      }
      alCambiar(json.url);
    } catch {
      setError("No se pudo subir el audio.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-2">
      {valor && (
        <audio controls preload="none" src={valor} className="w-full max-w-sm">
          Tu navegador no puede reproducir este audio.
        </audio>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entrada}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) subir(archivo);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={subiendo}
          onClick={() => entrada.current?.click()}
          className="h-9 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400 disabled:opacity-40"
        >
          {subiendo ? "Subiendo y comprimiendo…" : "Subir un archivo"}
        </button>

        <input
          type="text"
          value={valor ?? ""}
          onChange={(e) => alCambiar(e.target.value || undefined)}
          placeholder="…o pegar una dirección"
          className={`${campo} mt-0 flex-1`}
        />

        {valor && (
          <button
            type="button"
            onClick={() => alCambiar(undefined)}
            className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
          >
            Quitar
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-2 text-sm text-tinta">{error}</p>
      )}
    </div>
  );
}
