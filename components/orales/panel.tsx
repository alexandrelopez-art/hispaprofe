"use client";

import { useRef, useState } from "react";
import { CRITERIOS } from "@/lib/orales/criterios";
import { calcularTotal, fmtTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";
import { guardarEvaluacion } from "@/lib/acciones-orales";
import Cronometro from "@/components/orales/cronometro";
import TarjetaCriterio from "@/components/orales/tarjeta-criterio";
import ParrillaSujets from "@/components/orales/parrilla-sujets";
import type { SujetoDeParrilla } from "@/components/orales/parrilla-sujets";

type Estado = {
  sujetoId: string | null;
  notas: Notas;
  comentarios: Record<string, string>;
  frases: Record<string, string[]>;
  preguntadas: number[];
  segundosEoc: number;
  segundosEoi: number;
};

export default function Panel({
  turnoId,
  nombre,
  meta,
  sujetos,
  inicial,
}: {
  turnoId: string;
  nombre: string;
  meta: string[];
  sujetos: SujetoDeParrilla[];
  inicial: Estado;
}) {
  // Ojo: no hay aquí un `useEffect` que resincronice `estado` cuando cambia
  // `turnoId` o `inicial`. El brief lo pedía, pero un `useEffect` con
  // `inicial` en las dependencias reacciona a que el objeto sea una
  // referencia nueva, no a que el turno haya cambiado de verdad: si el
  // profesor está escribiendo un comentario y en ese momento cualquier
  // acción del servidor (borrar un turno, pegar sujets…) llama a
  // `revalidatePath` sobre esta misma ruta, Next vuelve a ejecutar el
  // Server Component de la página, que pasa un `inicial` nuevo pero con el
  // mismo contenido — y el efecto lo tomaría por «cambio de estudiante» y
  // pisaría lo que se acaba de teclear, sin vuelta atrás a mitad de examen.
  //
  // La forma correcta de resetear estado al cambiar de turno es la que ya
  // recomienda React: que el padre monte este componente con
  // `key={turnoId}` (ver `app/(app)/profe/orales/[id]/page.tsx`). Un cambio
  // de `key` desmonta y vuelve a montar el árbol entero, así que
  // `useState(inicial)` solo se evalúa una vez por estudiante; una
  // repintada del padre con un `inicial` equivalente no toca este
  // componente si su `key` no cambió.
  const [estado, setEstado] = useState<Estado>(inicial);
  const [corriendo, setCorriendo] = useState<"eoc" | "eoi" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Guarda medio segundo después del último cambio, como el original. */
  function guardar(siguiente: Estado) {
    setEstado(siguiente);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      const fallo = await guardarEvaluacion({ turnoId, ...siguiente });
      setError(fallo?.error ?? null);
    }, 500);
  }

  const total = calcularTotal(estado.notas);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-4 border-b border-hp-100 pb-4">
        <h2 className="text-2xl font-extrabold text-tinta">{nombre}</h2>
        <div className="flex flex-wrap gap-1.5">
          {meta.map((m) => (
            <span
              key={m}
              className="rounded-full border border-hp-100 bg-fondo px-2.5 py-1 text-xs font-semibold text-tinta-suave"
            >
              {m}
            </span>
          ))}
        </div>
        <div className="ml-auto text-right">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-tinta-suave">
            Nota /20
          </span>
          <span className="text-3xl font-extrabold tabular-nums text-tinta">
            {fmtTotal(total)}
            <span className="text-base font-semibold text-tinta-suave"> / 20</span>
          </span>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-coral-100 px-4 py-2 text-sm font-semibold text-coral-600">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Cronometro
          romano="I"
          etiqueta="Expresión oral en continuo"
          sub="EOC · 5 min · el alumno habla solo"
          segundos={estado.segundosEoc}
          corriendo={corriendo === "eoc"}
          alArrancar={() => setCorriendo("eoc")}
          alCambiar={(s, sigue) => {
            setCorriendo(sigue ? "eoc" : null);
            guardar({ ...estado, segundosEoc: s });
          }}
        />
        <Cronometro
          romano="II"
          etiqueta="Expresión oral en interacción"
          sub="EOI · 5 min · diálogo con el examinador"
          segundos={estado.segundosEoi}
          corriendo={corriendo === "eoi"}
          alArrancar={() => setCorriendo("eoi")}
          alCambiar={(s, sigue) => {
            setCorriendo(sigue ? "eoi" : null);
            guardar({ ...estado, segundosEoi: s });
          }}
        />
      </div>

      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
        Documento elegido
      </h3>
      <ParrillaSujets
        sujetos={sujetos}
        elegidoId={estado.sujetoId}
        preguntadas={estado.preguntadas}
        alElegir={(id) => {
          // Regla 4: cambiar de sujet también para los cronómetros.
          setCorriendo(null);
          // `preguntadas` es una lista de índices sin más: no dice de qué
          // sujet son. Si no se vacía aquí, marcar la pregunta 2 de un
          // documento deja la pregunta 2 marcada en el siguiente, aunque no
          // tenga nada que ver. Solo se vacía si de verdad cambia el sujet:
          // pulsar otra vez el ya elegido no debe borrar el progreso.
          guardar({
            ...estado,
            sujetoId: id,
            preguntadas: id === estado.sujetoId ? estado.preguntadas : [],
          });
        }}
        alPreguntar={(i) =>
          guardar({
            ...estado,
            preguntadas: estado.preguntadas.includes(i)
              ? estado.preguntadas.filter((x) => x !== i)
              : [...estado.preguntadas, i],
          })
        }
      />

      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
        Baremo · 5 criterios / 20 puntos
      </h3>
      <div className="space-y-3.5">
        {CRITERIOS.map((c) => (
          <TarjetaCriterio
            key={c.key}
            criterio={c}
            nota={estado.notas[c.key] ?? null}
            comentario={estado.comentarios[c.key] ?? ""}
            frases={estado.frases[c.key] ?? []}
            alPuntuar={(v) =>
              guardar({ ...estado, notas: { ...estado.notas, [c.key]: v } })
            }
            alComentar={(t) =>
              guardar({ ...estado, comentarios: { ...estado.comentarios, [c.key]: t } })
            }
            alPulsarFrase={(f) => {
              const activas = estado.frases[c.key] ?? [];
              const encendida = activas.includes(f);
              const texto = estado.comentarios[c.key] ?? "";
              // Encender una frase la escribe en el comentario; apagarla no
              // borra el texto, que a esas alturas el profesor ya lo tocó.
              const nuevoTexto =
                !encendida && !texto.includes(f)
                  ? texto
                    ? `${texto.replace(/\s+$/, "")} · ${f}`
                    : f
                  : texto;
              guardar({
                ...estado,
                frases: {
                  ...estado.frases,
                  [c.key]: encendida ? activas.filter((x) => x !== f) : [...activas, f],
                },
                comentarios: { ...estado.comentarios, [c.key]: nuevoTexto },
              });
            }}
          />
        ))}
      </div>

      <div className="rounded-tarjeta border border-hp-100 bg-white p-5">
        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
          Comentario general
        </h3>
        <textarea
          value={estado.comentarios.general ?? ""}
          onChange={(e) =>
            guardar({
              ...estado,
              comentarios: { ...estado.comentarios, general: e.target.value },
            })
          }
          placeholder="Apreciación global, consejos, puntos a trabajar…"
          className="mt-2 min-h-24 w-full rounded-lg border border-hp-100 bg-fondo p-3 text-sm"
        />
      </div>
    </div>
  );
}
