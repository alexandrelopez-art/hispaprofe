"use client";

import { area, botonSecundario, BotonQuitar, campo } from "./campos";

type Pareja = { id: string; izquierda: string; derecha: string };

type DatosRelacionar = {
  ejercicio: "relacionar";
  consigna: string;
  parejas: Pareja[];
};

export const RELACIONAR_VACIO: DatosRelacionar = {
  ejercicio: "relacionar",
  consigna: "",
  parejas: [
    { id: "r1", izquierda: "", derecha: "" },
    { id: "r2", izquierda: "", derecha: "" },
  ],
};

/**
 * El siguiente id de pareja, único dentro del ejercicio. Igual que
 * `siguienteIdPregunta` en editor-opcion.tsx: va por el máximo de los
 * sufijos que ya existen y no por `longitud + 1`, porque quitar una pareja
 * de en medio y añadir otra repetiría un id con `longitud + 1` (r1, r2, r3 →
 * quitar r2 → r1, r3, longitud 2 → "r3" otra vez), y ese id es la clave con
 * la que se guardan las respuestas del estudiante — dos parejas con el
 * mismo id comparten respuesta y `corregirRelacionar` puntúa las dos igual.
 *
 * Tampoco usa `Date.now()` ni `Math.random()`: el proyecto necesita que dos
 * ejercicios iguales produzcan los mismos datos.
 */
function siguienteIdPareja(parejas: Pareja[]): string {
  const maximo = parejas.reduce((max, p) => {
    const m = /^r(\d+)$/.exec(p.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `r${maximo + 1}`;
}

export default function EditorRelacionar({
  datos,
  alCambiar,
}: {
  datos: unknown;
  alCambiar: (nuevo: unknown) => void;
}) {
  const d = datos as DatosRelacionar;

  const cambiarPareja = (i: number, parcial: Partial<Pareja>) =>
    alCambiar({ ...d, parejas: d.parejas.map((p, j) => (j === i ? { ...p, ...parcial } : p)) });

  // El esquema rechaza dos derechas iguales: el estudiante vería dos celdas
  // idénticas y una de las dos filas quedaría mal contada pase lo que pase.
  // Se avisa aquí para no descubrirlo al guardar. `filter(Boolean)` deja
  // fuera las vacías: mientras el profesor está rellenando, tener dos
  // celdas todavía en blanco no es una repetición real.
  const derechas = d.parejas.map((p) => p.derecha.trim()).filter(Boolean);
  const repetida = derechas.find((v, i) => derechas.indexOf(v) !== i);

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

      {repetida && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          «{repetida}» está dos veces en la columna de la derecha. Repetir a la
          izquierda sí vale; a la derecha no, porque serían dos celdas iguales.
        </p>
      )}

      <div className="space-y-3">
        {d.parejas.map((p, i) => (
          <div key={p.id} className="flex flex-wrap items-end gap-3 rounded-tarjeta border border-hp-100 p-4">
            <label className="block flex-1 text-sm font-semibold text-tinta">
              Izquierda
              <input
                type="text"
                value={p.izquierda}
                onChange={(e) => cambiarPareja(i, { izquierda: e.target.value })}
                className={campo}
              />
            </label>
            <label className="block flex-1 text-sm font-semibold text-tinta">
              Derecha
              <input
                type="text"
                value={p.derecha}
                onChange={(e) => cambiarPareja(i, { derecha: e.target.value })}
                className={campo}
              />
            </label>
            {d.parejas.length > 2 && (
              <BotonQuitar onClick={() => alCambiar({ ...d, parejas: d.parejas.filter((_, j) => j !== i) })}>
                Quitar
              </BotonQuitar>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          alCambiar({
            ...d,
            parejas: [...d.parejas, { id: siguienteIdPareja(d.parejas), izquierda: "", derecha: "" }],
          })
        }
        className={botonSecundario}
      >
        Añadir pareja
      </button>
    </div>
  );
}
