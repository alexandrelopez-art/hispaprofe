"use client";

import { area, botonSecundario, BotonQuitar, campo } from "./campos";

type Pieza = { id: string; texto: string };

type DatosOrdenar = {
  ejercicio: "ordenar";
  consigna: string;
  piezas: Pieza[];
};

export const ORDENAR_VACIO: DatosOrdenar = {
  ejercicio: "ordenar",
  consigna: "",
  piezas: [
    { id: "o1", texto: "" },
    { id: "o2", texto: "" },
  ],
};

/**
 * El siguiente id de pieza, único dentro del ejercicio. Igual que
 * `siguienteIdPregunta` en editor-opcion.tsx: va por el máximo de los
 * sufijos que ya existen y no por `longitud + 1`, porque quitar una pieza de
 * en medio y añadir otra repetiría un id con `longitud + 1` (o1, o2, o3 →
 * quitar o2 → o1, o3, longitud 2 → "o3" otra vez), y ese id es la clave con
 * la que se guardan las respuestas del estudiante — dos piezas con el mismo
 * id se confunden en `corregirOrdenar`.
 *
 * Tampoco usa `Date.now()` ni `Math.random()`: el proyecto necesita que dos
 * ejercicios iguales produzcan los mismos datos.
 */
function siguienteIdPieza(piezas: Pieza[]): string {
  const maximo = piezas.reduce((max, p) => {
    const m = /^o(\d+)$/.exec(p.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `o${maximo + 1}`;
}

export default function EditorOrdenar({
  datos,
  alCambiar,
}: {
  datos: unknown;
  alCambiar: (nuevo: unknown) => void;
}) {
  const d = datos as DatosOrdenar;

  const mover = (i: number, salto: number) => {
    const j = i + salto;
    if (j < 0 || j >= d.piezas.length) return;
    const piezas = [...d.piezas];
    [piezas[i], piezas[j]] = [piezas[j], piezas[i]];
    alCambiar({ ...d, piezas });
  };

  return (
    <div className="space-y-6">
      <label className="block text-sm font-semibold text-tinta">
        Consigna
        <textarea
          rows={2}
          value={d.consigna}
          onChange={(e) => alCambiar({ ...d, consigna: e.target.value })}
          className={area}
        />
      </label>

      <p className="text-sm text-tinta-suave">
        Escríbelas <strong>en su orden correcto</strong>. Al estudiante le
        llegan barajadas. Puntúa por parejas consecutivas, así que N piezas
        valen N−1 puntos.
      </p>

      <div className="space-y-2">
        {d.piezas.map((p, i) => (
          <div key={p.id} className="flex items-end gap-3">
            <span className="pb-2 text-sm font-bold text-tinta-suave">{i + 1}</span>
            <input
              type="text"
              value={p.texto}
              onChange={(e) =>
                alCambiar({
                  ...d,
                  piezas: d.piezas.map((q, j) => (j === i ? { ...q, texto: e.target.value } : q)),
                })
              }
              className={`${campo} flex-1`}
            />
            <button
              type="button"
              onClick={() => mover(i, -1)}
              disabled={i === 0}
              className={`${botonSecundario} disabled:opacity-40`}
              aria-label="Subir"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => mover(i, 1)}
              disabled={i === d.piezas.length - 1}
              className={`${botonSecundario} disabled:opacity-40`}
              aria-label="Bajar"
            >
              ↓
            </button>
            {d.piezas.length > 2 && (
              <BotonQuitar onClick={() => alCambiar({ ...d, piezas: d.piezas.filter((_, j) => j !== i) })}>
                Quitar
              </BotonQuitar>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          alCambiar({ ...d, piezas: [...d.piezas, { id: siguienteIdPieza(d.piezas), texto: "" }] })
        }
        className={botonSecundario}
      >
        Añadir pieza
      </button>
    </div>
  );
}
