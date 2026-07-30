"use client";

import { area, botonSecundario, BotonQuitar, campo, CampoTexto } from "./campos";

type Pregunta = {
  id: string;
  enunciado: string;
  opciones?: string[];
  correctas: number[];
};

type DatosOpcion = {
  ejercicio: "opcion";
  consigna: string;
  multiple: boolean;
  opcionesComunes?: string[];
  presentacion: "botones" | "desplegable";
  preguntas: Pregunta[];
};

export const OPCION_VACIA: DatosOpcion = {
  ejercicio: "opcion",
  consigna: "",
  multiple: false,
  presentacion: "botones",
  preguntas: [{ id: "p1", enunciado: "", opciones: ["", ""], correctas: [] }],
};

export default function EditorOpcion({
  datos,
  alCambiar,
}: {
  datos: unknown;
  alCambiar: (nuevo: unknown) => void;
}) {
  const d = datos as DatosOpcion;
  const usaComunes = d.opcionesComunes !== undefined;

  const cambiar = (parcial: Partial<DatosOpcion>) => alCambiar({ ...d, ...parcial });

  const cambiarPregunta = (i: number, parcial: Partial<Pregunta>) => {
    const preguntas = d.preguntas.map((p, j) => (j === i ? { ...p, ...parcial } : p));
    cambiar({ preguntas });
  };

  // Las opciones que le tocan a una pregunta: las suyas, o las comunes. Es
  // la misma regla que `opcionesDe` en lib/ejercicios/opcion.ts.
  const opcionesDe = (p: Pregunta) => p.opciones ?? d.opcionesComunes ?? [];

  return (
    <div className="space-y-6">
      <label className="block text-sm font-semibold text-tinta">
        Consigna
        <textarea
          rows={2}
          value={d.consigna}
          onChange={(e) => cambiar({ consigna: e.target.value })}
          className={area}
        />
      </label>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-tinta">
          <input
            type="checkbox"
            checked={d.multiple}
            onChange={(e) => cambiar({ multiple: e.target.checked })}
          />
          Se puede marcar más de una
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-tinta">
          <input
            type="checkbox"
            checked={usaComunes}
            onChange={(e) =>
              e.target.checked
                ? cambiar({
                    opcionesComunes: ["", ""],
                    preguntas: d.preguntas.map(({ opciones: _, ...resto }) => resto),
                  })
                : cambiar({
                    opcionesComunes: undefined,
                    preguntas: d.preguntas.map((p) => ({ ...p, opciones: ["", ""] })),
                  })
            }
          />
          Las mismas opciones para todas las preguntas
        </label>
      </div>

      {usaComunes && (
        <fieldset className="rounded-tarjeta border border-hp-100 p-4">
          <legend className="px-2 text-sm font-bold text-tinta">Lista común</legend>
          <p className="text-sm text-tinta-suave">
            La misma opción puede valer en varias preguntas. Con muchas
            opciones, elige «desplegable» para no dejar un muro de botones.
          </p>

          <label className="mt-3 block text-sm font-semibold text-tinta">
            Cómo se enseña
            <select
              value={d.presentacion}
              onChange={(e) =>
                cambiar({ presentacion: e.target.value as "botones" | "desplegable" })
              }
              className={campo}
            >
              <option value="botones">Botones</option>
              <option value="desplegable">Desplegable</option>
            </select>
          </label>

          <div className="mt-4 space-y-2">
            {(d.opcionesComunes ?? []).map((o, i) => (
              <div key={i} className="flex items-end gap-3">
                <div className="flex-1">
                  <CampoTexto
                    etiqueta={`Opción ${i + 1}`}
                    valor={o}
                    alCambiar={(v) => {
                      const opcionesComunes = [...(d.opcionesComunes ?? [])];
                      opcionesComunes[i] = v;
                      cambiar({ opcionesComunes });
                    }}
                  />
                </div>
                <BotonQuitar
                  onClick={() =>
                    cambiar({
                      opcionesComunes: (d.opcionesComunes ?? []).filter((_, j) => j !== i),
                    })
                  }
                >
                  Quitar
                </BotonQuitar>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => cambiar({ opcionesComunes: [...(d.opcionesComunes ?? []), ""] })}
            className={`${botonSecundario} mt-3`}
          >
            Añadir opción
          </button>
        </fieldset>
      )}

      {d.preguntas.map((p, i) => (
        <fieldset key={p.id} className="rounded-tarjeta border border-hp-100 p-4">
          <legend className="px-2 text-sm font-bold text-tinta">Pregunta {i + 1}</legend>

          <label className="block text-sm font-semibold text-tinta">
            Enunciado
            <textarea
              rows={2}
              value={p.enunciado}
              onChange={(e) => cambiarPregunta(i, { enunciado: e.target.value })}
              className={area}
            />
          </label>

          <div className="mt-4 space-y-2">
            {opcionesDe(p).map((o, j) => (
              <div key={j} className="flex items-center gap-3">
                <input
                  type={d.multiple ? "checkbox" : "radio"}
                  name={`correcta-${p.id}`}
                  checked={p.correctas.includes(j)}
                  onChange={() =>
                    cambiarPregunta(i, {
                      correctas: d.multiple
                        ? p.correctas.includes(j)
                          ? p.correctas.filter((c) => c !== j)
                          : [...p.correctas, j]
                        : [j],
                    })
                  }
                />
                {usaComunes ? (
                  <span className="text-sm text-tinta">{o || `Opción ${j + 1}`}</span>
                ) : (
                  <input
                    type="text"
                    value={o}
                    onChange={(e) => {
                      const opciones = [...(p.opciones ?? [])];
                      opciones[j] = e.target.value;
                      cambiarPregunta(i, { opciones });
                    }}
                    className={`${campo} mt-0`}
                  />
                )}
                {!usaComunes && (
                  <BotonQuitar
                    onClick={() =>
                      cambiarPregunta(i, {
                        opciones: (p.opciones ?? []).filter((_, k) => k !== j),
                        correctas: p.correctas.filter((c) => c !== j).map((c) => (c > j ? c - 1 : c)),
                      })
                    }
                  >
                    Quitar
                  </BotonQuitar>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {!usaComunes && (
              <button
                type="button"
                onClick={() => cambiarPregunta(i, { opciones: [...(p.opciones ?? []), ""] })}
                className={botonSecundario}
              >
                Añadir opción
              </button>
            )}
            {d.preguntas.length > 1 && (
              <BotonQuitar
                onClick={() => cambiar({ preguntas: d.preguntas.filter((_, j) => j !== i) })}
              >
                Quitar la pregunta
              </BotonQuitar>
            )}
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() =>
          cambiar({
            preguntas: [
              ...d.preguntas,
              {
                // El id tiene que ser único dentro del ejercicio: es la clave
                // con la que se guardan las respuestas del estudiante. El
                // contador va por longitud + 1 y no por Date.now() para que
                // dos ejercicios iguales salgan iguales.
                id: `p${d.preguntas.length + 1}`,
                enunciado: "",
                ...(usaComunes ? {} : { opciones: ["", ""] }),
                correctas: [],
              },
            ],
          })
        }
        className={botonSecundario}
      >
        Añadir pregunta
      </button>
    </div>
  );
}
