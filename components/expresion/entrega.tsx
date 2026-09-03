"use client";

import { useActionState, useState } from "react";
import { entregar, type EstadoExpresion } from "@/lib/acciones-expresion";
// `import type` y no un import normal: `lib/expresion.ts` importa `prisma`, y
// esto es un componente de cliente. TypeScript borra los imports de tipo al
// compilar, así que nada de eso llega al navegador — pero si alguien lo
// convierte algún día en un import de valor, se lleva media base de datos
// al bundle. Que se quede en `import type`.
import type { ExpresionPublica } from "@/lib/expresion";
import Grabadora from "./grabadora";
import Aviso from "@/components/ui/aviso";
import { clasesDeBoton } from "@/components/ui/boton";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";

/** Palabras de verdad: separadas por espacios, sin contar los de sobra. */
function contarPalabras(texto: string): number {
  const limpio = texto.trim();
  return limpio === "" ? 0 : limpio.split(/\s+/).length;
}

// El mismo formato con el que el profesor ve la cita en la ficha del alumno:
// una fecha citada tiene que leerse igual en las dos pantallas.
const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export default function Entrega({
  pasoId,
  publica,
  entrega,
  valoracion,
  cerrada,
  citada,
}: {
  pasoId: string;
  publica: ExpresionPublica;
  /** Lo que ya escribió, si escribió. */
  entrega: string | null;
  /** La rúbrica rellenada, si ya está corregida. */
  valoracion: { notas: Record<string, number>; comentario: string } | null;
  /** No se puede tocar: ya está corregida, o la asignación está archivada. */
  cerrada: boolean;
  /** Cuándo es la clase en la que le han citado el oral, si le han citado. */
  citada: Date | null;
}) {
  const [texto, setTexto] = useState(entrega ?? "");
  const [estado, enviar, enviando] = useActionState<EstadoExpresion, FormData>(entregar, {});

  const palabras = contarPalabras(texto);
  const limites = publica.palabras;
  const fuera = limites && (palabras < limites.minimo || palabras > limites.maximo);

  return (
    <Tarjeta className="mt-8">
      <p className="font-bold text-tinta">{publica.consigna}</p>

      {publica.estimulo.texto && (
        <p className="mt-4 whitespace-pre-wrap rounded-tarjeta bg-fondo p-4 text-sm leading-relaxed text-tinta">
          {publica.estimulo.texto}
        </p>
      )}
      {publica.estimulo.imagen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={publica.estimulo.imagen}
          alt="Material de la tarea"
          className="mt-4 max-h-96 rounded-tarjeta"
        />
      )}
      {publica.estimulo.audio && (
        <audio controls preload="none" src={publica.estimulo.audio} className="mt-4 w-full max-w-sm">
          Tu navegador no puede reproducir este audio.
        </audio>
      )}

      {publica.modalidad === "oral" && !publica.grabada ? (
        <Aviso tono="aviso" className="mt-6 block">
          <span className="block">
            Esta tarea se hace en clase, con tu profesor. Aquí tienes el
            material para prepararla
            {publica.minutos ? `: dura unos ${publica.minutos} minutos` : ""}.
          </span>
          {citada && (
            // Un <p> dentro de otro (el que ya pone Aviso) no es válido HTML:
            // se queda en <span> con el mismo aspecto de línea aparte.
            <span className="mt-2 block font-bold">
              Tu profe te ha citado para el {formatoFecha.format(citada)}.
            </span>
          )}
        </Aviso>
      ) : publica.modalidad === "oral" ? (
        // La oral grabada: se entrega dentro de la aplicación, así que no hay
        // ni cita ni línea de «esto se hace en clase».
        <Grabadora
          pasoId={pasoId}
          minutos={publica.minutos ?? 0}
          entrega={entrega}
          cerrada={cerrada}
        />
      ) : (
        <form action={enviar} className="mt-6">
          <input type="hidden" name="pasoId" value={pasoId} />
          <input type="hidden" name="texto" value={texto} />

          {/* Textarea sin `name`: el campo de verdad que viaja con el
              formulario es el <input type="hidden"> de arriba. `Campo`
              pondría su propio `name` en el control visible y duplicaría el
              valor, así que se queda nativo. */}
          <textarea
            rows={12}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={cerrada}
            className="w-full rounded-tarjeta border border-hp-200 bg-white p-4 text-sm leading-relaxed text-tinta outline-none focus:border-hp-400 disabled:bg-fondo"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!cerrada && (
              // Botón nativo: además de `pending` (`enviando`), se apaga sin
              // palabras escritas, y `BotonEnviar` no admite una condición de
              // apagado adicional a la del propio envío.
              <button
                type="submit"
                disabled={enviando || palabras === 0}
                className={clasesDeBoton("primario", "normal", "h-11 px-6 text-sm font-extrabold disabled:opacity-40")}
              >
                {enviando ? "Entregando…" : entrega ? "Volver a entregar" : "Entregar"}
              </button>
            )}
            <span className={`text-sm ${fuera ? "font-bold text-tinta" : "text-tinta-suave"}`}>
              {limites
                ? `${palabras} de ${limites.minimo}-${limites.maximo} palabras`
                : `${palabras} palabras`}
            </span>
          </div>

          {/*
            El contador avisa y deja entregar. Escribir noventa palabras
            cuando se piden cien es un error del alumno que el profesor va a
            puntuar, no algo que la aplicación deba impedirle.
          */}
          {/* Cerrada y sin nada escrito: el recuadro gris no dice por qué. */}
          {cerrada && !entrega && (
            <p className="mt-2 text-sm text-tinta-suave">
              Esta tarea ya no admite entregas.
            </p>
          )}

          {fuera && !cerrada && (
            <p className="mt-2 text-sm text-tinta-suave">
              Estás fuera del número de palabras que pide la tarea. Puedes
              entregarlo igual, pero cuenta para la nota.
            </p>
          )}
        </form>
      )}

      {estado.error && (
        <Aviso tono="error" className="mt-3">{estado.error}</Aviso>
      )}
      {estado.ok && !estado.error && (
        <Aviso tono="ok" className="mt-3">{estado.ok}</Aviso>
      )}

      {valoracion && (
        <div className="mt-8 border-t border-hp-100 pt-6">
          <Rotulo>Tu corrección</Rotulo>
          <ul className="mt-3 space-y-1">
            {publica.criterios.map((c) => (
              <li key={c.id} className="flex justify-between text-sm text-tinta">
                <span>{c.nombre}</span>
                <span className="font-bold">
                  {valoracion.notas[c.id] ?? 0} / {c.maximo}
                </span>
              </li>
            ))}
          </ul>
          {valoracion.comentario && (
            <p className="mt-4 whitespace-pre-wrap rounded-tarjeta bg-fondo p-4 text-sm text-tinta">
              {valoracion.comentario}
            </p>
          )}
        </div>
      )}

      {publica.modelo && (
        <div className="mt-8 border-t border-hp-100 pt-6">
          <Rotulo>Texto modelo</Rotulo>
          <p className="mt-3 whitespace-pre-wrap rounded-tarjeta bg-fondo p-4 text-sm leading-relaxed text-tinta">
            {publica.modelo}
          </p>
        </div>
      )}
    </Tarjeta>
  );
}
