"use client";

import { useRef, useState } from "react";
import { pedirEscucha } from "@/lib/acciones-escuchas";

/**
 * Un audio que solo suena las veces que deja el examen.
 *
 * Se cuenta al dar al play y no al terminar: es lo que hace el examen, donde
 * el audio suena una vez y no se rebobina. Y como `/api/archivos/[id]` sirve
 * con caché permanente, una vez empieza a sonar el archivo ya está en el
 * navegador: que se caiga la conexión a mitad no corta la reproducción.
 *
 * El contador vive en el servidor porque uno en el navegador se devuelve
 * recargando la página, y entonces no cuenta nada. `quedan` empieza en null
 * —no lo sabemos hasta preguntar— y por eso el botón no dice un número hasta
 * la primera escucha.
 */
export default function Reproductor({
  src,
  pasoId,
  clave,
  maximo,
  cerrado,
}: {
  src: string;
  pasoId: string;
  clave: string;
  maximo: number;
  /** El ejercicio ya está respondido: no tiene sentido seguir contando. */
  cerrado: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [quedan, setQuedan] = useState<number | null>(null);
  const [agotado, setAgotado] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  // Ya respondido: se puede volver a oír sin contar, que es lo que hace
  // falta para repasar la corrección.
  if (cerrado) {
    return (
      <audio controls preload="none" src={src} className="w-full max-w-sm">
        Tu navegador no puede reproducir este audio.
      </audio>
    );
  }

  async function sonar() {
    if (pidiendo || agotado) return;
    setPidiendo(true);
    const r = await pedirEscucha(pasoId, clave, maximo);
    setPidiendo(false);

    if ("error" in r) {
      setAgotado(true);
      return;
    }
    setQuedan(r.quedan);
    await audio.current?.play();
  }

  return (
    <div className="space-y-1">
      <audio ref={audio} preload="none" src={src} className="hidden">
        Tu navegador no puede reproducir este audio.
      </audio>

      <button
        type="button"
        onClick={sonar}
        disabled={pidiendo || agotado}
        className="h-9 rounded-full bg-hp-400 px-5 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {agotado ? "Sin escuchas" : pidiendo ? "…" : "Escuchar"}
      </button>

      <p className="text-xs text-tinta-suave">
        {agotado
          ? "Ya lo has oído todas las veces."
          : quedan === null
            ? `Puedes oírlo ${maximo} ${maximo === 1 ? "vez" : "veces"}.`
            : quedan === 0
              ? "Era la última."
              : `Te queda ${quedan} ${quedan === 1 ? "escucha" : "escuchas"}.`}
      </p>
    </div>
  );
}
