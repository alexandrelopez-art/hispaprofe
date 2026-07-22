"use client";

import { useRef, useState } from "react";
import TextoRico from "@/components/texto-rico";

/**
 * Botones de formato. `envuelve` rodea lo seleccionado; `prefijo` se pone
 * al principio de la linea; `plantilla` inserta un bloque entero.
 */
const FORMATO: {
  label: string;
  titulo: string;
  envuelve?: string;
  prefijo?: string;
  plantilla?: string;
  ejemplo?: string;
}[] = [
  { label: "N", titulo: "Negrita", envuelve: "**", ejemplo: "negrita" },
  { label: "C", titulo: "Cursiva", envuelve: "*", ejemplo: "cursiva" },
  { label: "Título", titulo: "Título de sección", prefijo: "## " },
  { label: "Lista", titulo: "Lista con viñetas", prefijo: "- " },
  { label: "Numerada", titulo: "Lista numerada", prefijo: "1. " },
  {
    label: "Enlace",
    titulo: "Enlace",
    plantilla: "[texto del enlace](https://…)",
  },
  {
    label: "Tabla",
    titulo: "Tabla",
    plantilla:
      "\n| Columna 1 | Columna 2 |\n| --- | --- |\n| dato | dato |\n| dato | dato |\n",
  },
  { label: "Cita", titulo: "Cita", prefijo: "> " },
];

export default function EditorTexto({
  valor,
  alCambiar,
  filas = 8,
  marcador = "Escribe aquí. Selecciona una palabra y pulsa N para ponerla en negrita.",
}: {
  valor: string;
  alCambiar: (v: string) => void;
  filas?: number;
  marcador?: string;
}) {
  const [verFormato, setVerFormato] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  function aplicar(f: (typeof FORMATO)[number]) {
    const el = area.current;
    if (!el) return;

    const inicio = el.selectionStart;
    const fin = el.selectionEnd;
    const seleccion = valor.slice(inicio, fin);
    let nuevo = valor;
    let cursor = fin;

    if (f.envuelve) {
      const contenido = seleccion || f.ejemplo || "texto";
      nuevo =
        valor.slice(0, inicio) +
        f.envuelve +
        contenido +
        f.envuelve +
        valor.slice(fin);
      cursor = inicio + f.envuelve.length + contenido.length + f.envuelve.length;
    } else if (f.prefijo) {
      const inicioLinea = valor.lastIndexOf("\n", inicio - 1) + 1;
      nuevo = valor.slice(0, inicioLinea) + f.prefijo + valor.slice(inicioLinea);
      cursor = fin + f.prefijo.length;
    } else if (f.plantilla) {
      nuevo = valor.slice(0, inicio) + f.plantilla + valor.slice(fin);
      cursor = inicio + f.plantilla.length;
    }

    alCambiar(nuevo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FORMATO.map((f) => (
          <button
            key={f.label}
            type="button"
            title={f.titulo}
            onClick={() => aplicar(f)}
            className={`rounded-lg border border-hp-200 px-2.5 py-1 text-xs text-tinta-suave transition-colors hover:border-hp-400 hover:text-hp-600 ${
              f.label === "N"
                ? "font-extrabold"
                : f.label === "C"
                  ? "italic"
                  : "font-semibold"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setVerFormato((v) => !v)}
          className="ml-auto rounded-lg px-2.5 py-1 text-xs font-semibold text-tinta-suave hover:text-hp-600"
        >
          {verFormato ? "Seguir escribiendo" : "Ver cómo queda"}
        </button>
      </div>

      {verFormato ? (
        <div className="mt-2 min-h-32 rounded-2xl border border-dashed border-hp-200 bg-fondo p-4">
          {valor.trim() ? (
            <TextoRico>{valor}</TextoRico>
          ) : (
            <p className="text-sm text-tinta-suave">Nada escrito todavía.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={area}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          rows={filas}
          placeholder={marcador}
          className="mt-2 w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 text-sm text-tinta outline-none focus:border-hp-400"
        />
      )}
    </div>
  );
}
