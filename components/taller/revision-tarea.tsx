"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { descartarClaveOficialAccion, guardarTareaAccion, marcarRevisadaAccion, rellenarConIAAccion, type EstadoGuardado } from "@/lib/acciones-taller";
import Previsualizacion from "@/components/recursos/previsualizacion";
import EditorTareaOpcion from "./editor-tarea-opcion";
import EditorTareaRelacionar from "./editor-tarea-relacionar";
import { dudaDe, type Duda } from "./dudas";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";

export default function RevisionTarea({ tareaId, motor, datosIniciales, bloqueInicial, dudas, estado, motivos, hayClave, tieneClave, anterior, siguiente }: {
  tareaId: string; motor: "opcion" | "relacionar"; datosIniciales: unknown; bloqueInicial: string | null; dudas: Duda[];
  estado: "VACIA" | "RELLENADA" | "REVISADA"; motivos: string[]; hayClave: boolean; tieneClave: boolean; anterior: string | null; siguiente: string | null;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState<unknown>(datosIniciales);
  const [bloque, setBloque] = useState(bloqueInicial ?? "");
  const [sucio, setSucio] = useState(false);
  const [mensaje, setMensaje] = useState<EstadoGuardado | null>(null);
  const [comoEstudiante, setComoEstudiante] = useState(false);
  const [pendiente, empezar] = useTransition();

  const cambiar = (nuevo: unknown) => { setDatos(nuevo); setSucio(true); };

  function guardar(despues?: () => void) {
    empezar(async () => {
      const r = await guardarTareaAccion(tareaId, JSON.stringify(datos), bloque || null);
      setMensaje(r);
      if (!r.error) { setSucio(false); router.refresh(); despues?.(); }
    });
  }

  function revisar() {
    if (sucio) { setMensaje({ error: "Guarda antes de marcarla revisada." }); return; }
    empezar(async () => {
      const r = await marcarRevisadaAccion(tareaId);
      setMensaje(r);
      if (!r.error) router.refresh();
    });
  }

  function volverARellenar() {
    if (!window.confirm("Se sustituye todo lo que hay en esta tarea por una lectura nueva de la IA. ¿Seguir?")) return;
    empezar(async () => {
      const r = await rellenarConIAAccion(tareaId);
      setMensaje(r);
      if (!r.error) router.refresh();
    });
  }

  function descartarClave() {
    if (!window.confirm("Se deja de comprobar esta tarea contra el cuadernillo. ¿Seguir?")) return;
    empezar(async () => {
      const r = await descartarClaveOficialAccion(tareaId);
      setMensaje(r);
      if (!r.error) router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Rotulo>La tarea, como la verá el estudiante</Rotulo>
        <Boton variante="sutil" tamano="pequeno" onClick={() => setComoEstudiante((v) => !v)}>{comoEstudiante ? "Volver a editar" : "Ver como estudiante"}</Boton>
      </div>
      {comoEstudiante ? (
        <div className="mt-3"><Previsualizacion datos={datos} /></div>
      ) : (
        <div className="mt-3 space-y-6">
          {motor === "opcion" && (datos as { texto?: string }).texto === undefined && (
            <Campo etiqueta="Estímulo (lo que se lee antes de contestar)" tipo="area" rows={8} value={bloque} onChange={(e) => { setBloque(e.target.value); setSucio(true); }}
              ayuda="En markdown. En la auditiva se deja vacío." duda={dudaDe(dudas, "bloque") ?? undefined} />
          )}
          {motor === "relacionar" && (
            <Campo etiqueta="Estímulo (los textos, si van aparte)" tipo="area" rows={8} value={bloque} onChange={(e) => { setBloque(e.target.value); setSucio(true); }}
              ayuda="En markdown. Vacío si cada texto va en su pareja." duda={dudaDe(dudas, "bloque") ?? undefined} />
          )}
          {motor === "opcion" ? <EditorTareaOpcion datos={datos} alCambiar={cambiar} dudas={dudas} /> : <EditorTareaRelacionar datos={datos} alCambiar={cambiar} dudas={dudas} />}
        </div>
      )}
      <Tarjeta className="mt-6" relleno="compacto">
        {mensaje?.error && <Aviso tono="error" className="mb-3">{mensaje.error}</Aviso>}
        {mensaje?.ok && <Aviso tono="ok" className="mb-3">{mensaje.ok}{mensaje.avisos?.length ? ` Quedan ${mensaje.avisos.length} aviso(s).` : ""}</Aviso>}
        {estado !== "REVISADA" && motivos.length > 0 && !sucio && (
          <Aviso tono="aviso" className="mb-3"><ul className="list-disc pl-5">{motivos.map((m) => <li key={m}>{m}</li>)}</ul></Aviso>
        )}
        <div className="flex flex-wrap gap-2">
          <Boton variante="primario" onClick={() => guardar()} disabled={pendiente || !sucio}>{pendiente ? "Guardando…" : "Guardar"}</Boton>
          <Boton variante="secundario" onClick={revisar} disabled={pendiente || estado === "REVISADA" || sucio || motivos.length > 0}>Marcar revisada</Boton>
          <Boton variante="sutil" onClick={volverARellenar} disabled={pendiente || !hayClave} title={hayClave ? undefined : "Falta la clave de la API"}>Volver a rellenar con IA</Boton>
          {tieneClave && (
            <Boton variante="sutil" onClick={descartarClave} disabled={pendiente}>La clave del cuadernillo está mal</Boton>
          )}
        </div>
        <div className="mt-4 flex justify-between text-sm">
          {anterior ? <Boton href={anterior} variante="sutil" tamano="pequeno">← Tarea anterior</Boton> : <span />}
          {siguiente ? <Boton href={siguiente} variante="sutil" tamano="pequeno">Tarea siguiente →</Boton> : <span />}
        </div>
      </Tarjeta>
    </div>
  );
}
