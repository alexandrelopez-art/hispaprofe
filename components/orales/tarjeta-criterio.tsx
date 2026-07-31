"use client";

import type { Criterio } from "@/lib/orales/criterios";
import { fmtNota } from "@/lib/orales/formato";
import { ajustarNota } from "@/lib/orales/reglas";

export default function TarjetaCriterio({
  criterio,
  nota,
  comentario,
  frases,
  alPuntuar,
  alComentar,
  alPulsarFrase,
}: {
  criterio: Criterio;
  nota: number | null;
  comentario: string;
  frases: string[];
  alPuntuar: (valor: number) => void;
  alComentar: (texto: string) => void;
  alPulsarFrase: (frase: string) => void;
}) {
  const puesta = nota !== null && nota !== undefined;

  return (
    <div
      className="grid grid-cols-[1fr_auto] items-start gap-x-5 gap-y-2 rounded-tarjeta border border-hp-100 border-l-4 bg-white p-5"
      // `border-l-${criterio.color}` compuesta al vuelo no la ve Tailwind:
      // el compilador solo genera las clases que aparecen escritas enteras
      // en el código fuente. El color viene por estilo en línea, que gana
      // a `border-hp-100` solo en el lado izquierdo.
      style={{ borderLeftColor: `var(--color-${criterio.color})` }}
    >
      <div>
        <div className="flex items-center gap-2.5 text-lg font-extrabold text-tinta">
          <span className="rounded bg-fondo px-2 py-0.5 font-mono text-xs">
            {criterio.romano}
          </span>
          {criterio.titulo}
        </div>
        <p className="text-xs text-tinta-suave">{criterio.descripcion}</p>
      </div>

      <div className="flex items-center gap-1 rounded-full bg-fondo px-1 py-1">
        <button
          type="button"
          disabled={!puesta || nota <= 0}
          onClick={() => alPuntuar(ajustarNota(nota, -1, criterio.maximo))}
          className="h-7 w-7 rounded-full text-lg font-bold text-tinta-suave disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-9 text-center font-extrabold tabular-nums text-tinta">
          {puesta ? fmtNota(nota) : "—"}
        </span>
        <span className="pr-2 text-xs font-semibold text-tinta-suave">
          / {fmtNota(criterio.maximo)}
        </span>
        <button
          type="button"
          disabled={puesta && nota >= criterio.maximo}
          onClick={() => alPuntuar(ajustarNota(puesta ? nota : null, 1, criterio.maximo))}
          className="h-7 w-7 rounded-full text-lg font-bold text-tinta-suave disabled:opacity-30"
        >
          +
        </button>
      </div>

      <textarea
        value={comentario}
        onChange={(e) => alComentar(e.target.value)}
        placeholder={`Comentarios sobre ${criterio.titulo.toLowerCase()}…`}
        className="col-span-2 min-h-14 w-full rounded-lg border border-hp-100 bg-fondo p-3 text-sm"
      />

      <div className="col-span-2 flex flex-wrap gap-1.5">
        {criterio.frases.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => alPulsarFrase(f)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              frases.includes(f)
                ? "border-tinta bg-tinta text-white"
                : "border-hp-100 bg-white text-tinta-suave"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
