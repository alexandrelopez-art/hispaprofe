"use client";

import type { ReactNode } from "react";
import { asignarPaginasAccion } from "@/lib/acciones-taller";
import type { TareaDele } from "@/lib/dele/mapa";
import { NOMBRE_ESTADO_TAREA, TONO_ESTADO_TAREA } from "@/lib/taller/estados";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";

export type TareaParaTarjeta = {
  id: string; numero: number; prueba: "CE" | "CO"; estado: "VACIA" | "RELLENADA" | "REVISADA";
  pasoId: string; paginaIds: string[]; avisos: string[]; dudas: number; imagenesPendientes: number;
};

export default function TarjetaTarea({ tarea, delMapa, paginas, examenId, children }: {
  tarea: TareaParaTarjeta; delMapa: TareaDele; paginas: { id: string; orden: number }[]; examenId: string; children?: ReactNode;
}) {
  return (
    <Tarjeta titulo={`Tarea ${tarea.numero}`} relleno="compacto">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-tinta-suave">{delMapa.pide}</p>
        <Etiqueta tono={TONO_ESTADO_TAREA[tarea.estado] ?? "neutro"}>{NOMBRE_ESTADO_TAREA[tarea.estado] ?? tarea.estado}</Etiqueta>
      </div>
      {tarea.avisos.length > 0 && <p className="mt-2 text-xs font-bold text-error-600">{tarea.avisos.length} aviso(s)</p>}
      {tarea.dudas > 0 && <p className="mt-1 text-xs font-bold text-tinta">{tarea.dudas} duda(s) de lectura</p>}
      {tarea.imagenesPendientes > 0 && <p className="mt-1 text-xs text-tinta-suave">{tarea.imagenesPendientes} imagen(es) por subir</p>}
      <form action={asignarPaginasAccion} className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <input type="hidden" name="examenId" value={examenId} />
        <input type="hidden" name="tareaId" value={tarea.id} />
        <span className="text-tinta-suave">Está en las páginas</span>
        {paginas.map((p) => (
          <label key={p.id} className="flex items-center gap-1">
            <input type="checkbox" name="paginaId" value={p.id} defaultChecked={tarea.paginaIds.includes(p.id)} />
            {p.orden}
          </label>
        ))}
        <BotonEnviar gerundio="Guardando…" variante="sutil" tamano="pequeno">Guardar</BotonEnviar>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {children}
        <Boton href={`/pasos/${tarea.pasoId}`} variante="sutil" tamano="pequeno">Abrir</Boton>
      </div>
    </Tarjeta>
  );
}
