"use client";

import { useRef, useState } from "react";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";

/**
 * Lo que cabe por el navegador. Copia a mano de `MAXIMO_SUBIDA` en
 * `app/api/archivos/route.ts`, y las dos tienen que moverse juntas.
 *
 * Comprobarlo aquí no es adornar: por encima de 4,5 MB el cuerpo lo corta
 * Vercel antes de que la ruta llegue a contestar, así que el mensaje que
 * explica qué hacer —súbelo a Drive— solo puede darlo el navegador.
 */
const MAXIMO_SUBIDA = 4 * 1024 * 1024;

/** «35,7 MB», para poder decir cuánto pesa lo que se ha elegido. */
function enMegas(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Elige el audio de un ejercicio: subiendo un archivo o pegando una dirección
 * de la que lo traiga el servidor. Las dos vías acaban en lo mismo —una
 * dirección de `/api/archivos/<id>` en el campo `audio`—, porque las dos
 * guardan el archivo dentro.
 *
 * Que la segunda vía exista no es comodidad: por el navegador solo caben 4 MB
 * —el tope del cuerpo de una petición en Vercel— y los MP3 del Cervantes pesan
 * hasta 35,7. Pegando la dirección, quien descarga es el servidor, y ahí no
 * hay tope.
 *
 * No reduce nada en el navegador, a diferencia de `subir-imagen.tsx`:
 * recomprimir audio en el navegador estropea la voz. Lo hace el servidor al
 * recibirlo, que es la parte lenta de la espera y por eso los botones lo dicen.
 */
export default function SubirAudio({
  valor,
  alCambiar,
  alFallar,
}: {
  valor?: string;
  alCambiar: (url: string | undefined) => void;
  /**
   * Avisa con la dirección que no se pudo traer, para que quien pinta este
   * componente pueda ofrecer otra salida.
   *
   * Opcional porque el editor de Recursos no tiene ninguna que ofrecer: allí,
   * un audio que no se puede traer es un audio que no entra. El editor de
   * bloques sí, porque un audio de Drive todavía se puede incrustar —sin
   * racionar—, y esa decisión es del profesor y no de este componente.
   *
   * `SubirAudio` no sabe qué es un bloque ni qué es un `EMBED`: solo dice qué
   * dirección falló.
   */
  alFallar?: (direccion: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trayendo, setTrayendo] = useState(false);
  // Lo que hay escrito en el campo de la dirección, que ya no se guarda solo
  // por escribirlo: ahora hay un botón que va a buscarlo.
  const [direccion, setDireccion] = useState("");
  // Subir, traer y quitar escriben todos sobre el mismo `valor` y el mismo
  // `error`: dos a la vez dejan la pantalla diciendo una cosa y el ejercicio
  // guardando otra. Por eso las tres se deshabilitan juntas, no cada una por
  // su cuenta.
  const ocupado = subiendo || trayendo;

  async function subir(archivo: File) {
    if (archivo.size > MAXIMO_SUBIDA) {
      setError(
        `Ese archivo pesa ${enMegas(archivo.size)} y por el navegador solo caben ` +
          `${enMegas(MAXIMO_SUBIDA)}. Súbelo a Drive, compártelo con enlace y pega ` +
          `aquí abajo la dirección: el servidor irá a buscarlo él.`,
      );
      return;
    }
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

  async function traer() {
    const enlace = direccion.trim();
    if (!enlace) return;
    setTrayendo(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/archivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: enlace }),
      });
      const json = await respuesta.json();
      if (!respuesta.ok) {
        setError(json.error ?? "No se pudo traer el audio de esa dirección.");
        alFallar?.(enlace);
        return;
      }
      // Lo que se guarda es la dirección **nuestra**, no la de Drive: el
      // archivo ya está dentro, y así la clase sigue funcionando aunque el de
      // Drive se mueva, se descomparta o se borre.
      alCambiar(json.url);
      setDireccion("");
    } catch {
      setError("No se pudo traer el audio de esa dirección.");
      alFallar?.(enlace);
    } finally {
      setTrayendo(false);
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
        <Boton variante="sutil" disabled={ocupado} onClick={() => entrada.current?.click()}>
          {subiendo ? "Subiendo y comprimiendo…" : "Subir un archivo"}
        </Boton>

        {/* Sin etiqueta visible antes (solo `placeholder`); `Campo` exige
            una, así que «Dirección de Drive» es texto nuevo. */}
        <Campo
          etiqueta="Dirección de Drive"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="…o pegar la dirección de Drive"
          className="flex-1"
        />
        <Boton variante="sutil" disabled={ocupado || !direccion.trim()} onClick={traer}>
          {trayendo ? "Trayendo y comprimiendo…" : "Traer de esa dirección"}
        </Boton>

        {/* Enlace de texto, sin aspecto de botón: se queda nativo. */}
        {valor && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => alCambiar(undefined)}
            className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500 disabled:opacity-40"
          >
            Quitar
          </button>
        )}
      </div>

      {/* Error amarillo → rojo: el cambio visual deliberado de esta sesión. */}
      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}
