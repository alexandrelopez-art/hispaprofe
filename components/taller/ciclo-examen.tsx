"use client";

import { useActionState } from "react";
import {
  archivarExamenAccion,
  asignarExamenAccion,
  publicarExamenAccion,
  retirarExamenAccion,
  type EstadoTaller,
} from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Tarjeta from "@/components/ui/tarjeta";

export type EstadoDeExamen = "EN_CONSTRUCCION" | "PUBLICADO" | "ARCHIVADO";

/**
 * Los botones del ciclo del examen: publicar (con sus motivos si no se
 * puede todavía), retirar del catálogo y archivar. Va en el `acciones` del
 * `Encabezado`; `AsignarExamen` (abajo, en este mismo fichero) es la otra
 * mitad del ciclo —asignar a un grupo o a un particular— y vive aparte
 * porque en la mesa del examen queda debajo del cuadernillo, lejos del
 * encabezado: un componente no se puede montar en dos sitios del árbol a
 * la vez. No comparten estado (cada uno trae su propio `useActionState`),
 * así que separarlos no cuesta nada.
 */
export default function CicloExamen({
  examenId,
  estado,
  motivos,
}: {
  examenId: string;
  estado: EstadoDeExamen;
  motivos: string[];
}) {
  const [estadoPublicar, publicar] = useActionState<EstadoTaller, FormData>(publicarExamenAccion, {});

  return (
    <span className="flex flex-col items-end gap-2">
      <span className="flex flex-wrap items-center gap-2">
        {estado === "EN_CONSTRUCCION" && (
          <form action={publicar}>
            <input type="hidden" name="examenId" value={examenId} />
            <BotonEnviar gerundio="Publicando…" variante="primario" deshabilitado={motivos.length > 0}>
              Publicar examen
            </BotonEnviar>
          </form>
        )}

        {estado === "PUBLICADO" && (
          <form action={retirarExamenAccion}>
            <input type="hidden" name="examenId" value={examenId} />
            <BotonEnviar
              gerundio="Retirando…"
              variante="secundario"
              onClick={(e) => {
                if (!window.confirm("Se retira del catálogo. Los estudiantes que ya lo tenían lo conservan. ¿Seguir?")) e.preventDefault();
              }}
            >
              Retirar del catálogo
            </BotonEnviar>
          </form>
        )}

        {estado !== "ARCHIVADO" && (
          <form action={archivarExamenAccion}>
            <input type="hidden" name="examenId" value={examenId} />
            <BotonEnviar
              gerundio="Archivando…"
              variante="sutil"
              tamano="pequeno"
              onClick={(e) => {
                if (!window.confirm("Se archiva y sale del catálogo. ¿Seguir?")) e.preventDefault();
              }}
            >
              Archivar
            </BotonEnviar>
          </form>
        )}
      </span>

      {estado === "EN_CONSTRUCCION" && motivos.length > 0 && (
        <Aviso tono="aviso" className="max-w-xs text-right">
          {motivos.join(" ")}
        </Aviso>
      )}
      {estadoPublicar.error && <Aviso tono="error" className="max-w-xs text-right">{estadoPublicar.error}</Aviso>}
      {estadoPublicar.ok && <Aviso tono="ok" className="max-w-xs text-right">{estadoPublicar.ok}</Aviso>}
    </span>
  );
}

/** La tarjeta de asignar el examen a un grupo o a un particular, con fecha límite. */
export function AsignarExamen({
  examenId,
  estado,
  destinos,
}: {
  examenId: string;
  estado: EstadoDeExamen;
  destinos: { valor: string; nombre: string }[];
}) {
  const [estadoAsignar, asignar] = useActionState<EstadoTaller, FormData>(asignarExamenAccion, {});
  const publicado = estado === "PUBLICADO";

  return (
    <Tarjeta titulo="Asignar a…" relleno="compacto" className="mt-6">
      <form action={asignar} className="space-y-3">
        <input type="hidden" name="examenId" value={examenId} />
        <Campo
          tipo="elegir"
          name="destino"
          etiqueta="Grupo o estudiante"
          opciones={[{ valor: "", nombre: "Elige…", deshabilitada: true }, ...destinos]}
          defaultValue=""
          disabled={!publicado}
        />
        <Campo tipo="fecha" name="venceEl" etiqueta="Fecha límite (opcional)" disabled={!publicado} />
        <BotonEnviar gerundio="Asignando…" variante="secundario" deshabilitado={!publicado}>
          Asignar las dos pruebas
        </BotonEnviar>
        {!publicado && <p className="text-xs text-tinta-suave">Publica el examen antes de asignarlo.</p>}
        {estadoAsignar.error && <Aviso tono="error">{estadoAsignar.error}</Aviso>}
        {estadoAsignar.ok && <Aviso tono="ok">{estadoAsignar.ok}</Aviso>}
      </form>
    </Tarjeta>
  );
}
