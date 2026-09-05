"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cortarGrabacionAccion, guardarGrabacionAccion, type EstadoGuardado } from "@/lib/acciones-taller";
import SubirAudio from "@/components/recursos/subir-audio";
import Onda from "./onda";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import Tarjeta from "@/components/ui/tarjeta";

/**
 * La grabación de una tarea auditiva: subirla (archivo o enlace de Drive,
 * igual que en el editor de recursos), oírla entera y, si el mapa espera más
 * de un trozo, cortarla con `Onda` y repartirla en el servidor (Task 3).
 *
 * `bloqueado` es «hay cambios sin guardar en el editor de la tarea»: subir
 * o cortar la grabación reescribe `Ejercicio.datos` (el `audio` de cada
 * ítem), así que hacerlo con una edición a medio guardar mezclaría dos
 * guardados distintos, igual que ya pasa con `ImagenesPedidas`.
 */
export default function Grabacion({
  tareaId,
  grabacionUrl,
  cortesGuardados,
  trozosEsperados,
  bloqueado,
}: {
  tareaId: string;
  grabacionUrl: string | null;
  cortesGuardados: number[];
  trozosEsperados: number | null;
  bloqueado: boolean;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<EstadoGuardado | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [, empezar] = useTransition();

  const titulo = bloqueado ? "Guarda o descarta tus cambios antes" : undefined;

  function subir(url: string | undefined) {
    if (!url) return;
    empezar(async () => {
      const r = await guardarGrabacionAccion(tareaId, url);
      setMensaje(r);
      if (!r.error) { setCambiando(false); router.refresh(); }
    });
  }

  function cortar(cortes: number[]) {
    empezar(async () => {
      const r = await cortarGrabacionAccion(tareaId, cortes);
      setMensaje(r);
      if (!r.error) router.refresh();
    });
  }

  return (
    <Tarjeta className="mb-6" titulo="Grabación de la tarea" relleno="compacto">
      {mensaje?.error && <Aviso tono="error" className="mb-3">{mensaje.error}</Aviso>}
      {mensaje?.ok && (
        <Aviso tono="ok" className="mb-3">
          {mensaje.ok}{mensaje.avisos?.length ? ` Quedan ${mensaje.avisos.length} aviso(s).` : ""}
        </Aviso>
      )}

      {!grabacionUrl || cambiando ? (
        <fieldset disabled={bloqueado} title={titulo}>
          <SubirAudio valor={undefined} alCambiar={subir} />
        </fieldset>
      ) : (
        <div className="space-y-3">
          <audio controls preload="none" src={grabacionUrl} className="w-full max-w-sm">
            Tu navegador no puede reproducir este audio.
          </audio>
          <div>
            <Boton variante="sutil" tamano="pequeno" onClick={() => setCambiando(true)} disabled={bloqueado} title={titulo}>
              Cambiar la grabación
            </Boton>
          </div>
          {trozosEsperados !== null ? (
            <Onda src={grabacionUrl} cortesIniciales={cortesGuardados} esperados={trozosEsperados} alCortar={cortar} bloqueado={bloqueado} />
          ) : (
            <p className="text-sm text-tinta-suave">Esta tarea se oye entera: no se corta.</p>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
