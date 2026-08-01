"use client";

import {
  area,
  botonSecundario,
  BotonQuitar,
  campo,
  CampoEscuchas,
  CampoTexto,
} from "./campos";
import SubirAudio from "./subir-audio";
import { marcasCuadran } from "@/lib/ejercicios/tipos";

type Pregunta = {
  id: string;
  enunciado: string;
  opciones?: string[];
  correctas: number[];
  audio?: string;
};

type DatosOpcion = {
  ejercicio: "opcion";
  consigna: string;
  multiple: boolean;
  opcionesComunes?: string[];
  presentacion: "botones" | "desplegable";
  texto?: string;
  preguntas: Pregunta[];
  /** Opcional, igual que en `relacionar`: una fila guardada antes de que el
   *  campo existiera no lo trae. Ver `CampoEscuchas`. */
  escuchas?: number;
};

export const OPCION_VACIA: DatosOpcion = {
  ejercicio: "opcion",
  consigna: "",
  multiple: false,
  presentacion: "botones",
  // Igual que `RELACIONAR_VACIO`: el punto de partida trae las dos escuchas
  // del examen aunque todavía no haya ningún audio, para que los dos tipos
  // empiecen diciendo lo mismo.
  escuchas: 2,
  preguntas: [{ id: "p1", enunciado: "", opciones: ["", ""], correctas: [] }],
};

/**
 * El siguiente id de pregunta, único dentro del ejercicio. Va por el máximo
 * de los sufijos que ya existen y no por `longitud + 1`: quitar una pregunta
 * de en medio y añadir otra repetiría un id con `longitud + 1` (p1, p2, p3 →
 * quitar p2 → p1, p3, longitud 2 → "p3" otra vez), y ese id es la clave con
 * la que se guardan las respuestas del estudiante — dos preguntas con el
 * mismo id comparten radios y `corregirOpcion` puntúa las dos igual.
 *
 * Tampoco usa `Date.now()` ni `Math.random()`: el proyecto necesita que dos
 * ejercicios iguales produzcan los mismos datos.
 */
function siguienteIdPregunta(preguntas: Pregunta[]): string {
  const maximo = preguntas.reduce((max, p) => {
    const m = /^p(\d+)$/.exec(p.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `p${maximo + 1}`;
}

/**
 * Los índices de `correctas` que siguen dentro de rango, y como mucho uno si
 * el ejercicio no admite varias. Cualquier cambio que pueda dejar un índice
 * apuntando a una opción que ya no existe —cambiar la bifurcación, pasar de
 * varias a una— pasa por aquí: sin saneo, `opcionSchema` rechaza el guardado
 * en silencio y no queda nada marcado en pantalla que el profesor pueda
 * arreglar.
 */
function sanearCorrectas(correctas: number[], totalOpciones: number, multiple: boolean): number[] {
  const enRango = correctas.filter((i) => i >= 0 && i < totalOpciones);
  return multiple ? enRango : enRango.slice(0, 1);
}

/**
 * Quita un índice de en medio y desplaza los que venían después. Es la
 * regla que ya usaba «Quitar» en las opciones propias, generalizada para
 * poder aplicarla también a la lista común, donde una opción le afecta a
 * las `correctas` de todas las preguntas a la vez.
 */
function quitarIndice(correctas: number[], indice: number): number[] {
  return correctas.filter((c) => c !== indice).map((c) => (c > indice ? c - 1 : c));
}

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
            onChange={(e) => {
              const multiple = e.target.checked;
              // Pasar de "varias" a "una" puede dejar más de un índice
              // marcado: el control real es un botón redondo que solo deja
              // elegir uno, así que se recorta a la primera.
              cambiar({
                multiple,
                preguntas: d.preguntas.map((p) => ({
                  ...p,
                  correctas: sanearCorrectas(p.correctas, opcionesDe(p).length, multiple),
                })),
              });
            }}
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
                    // Las opciones propias desaparecen y la lista común
                    // arranca con dos vacías: cualquier `correctas` que
                    // apuntara más allá de la posición 1 queda huérfana.
                    // `opciones: undefined` la quita del objeto igual que
                    // desestructurarla, y sin dejar una variable sin usar:
                    // `JSON.stringify` no serializa las claves indefinidas.
                    preguntas: d.preguntas.map((p) => ({
                      ...p,
                      opciones: undefined,
                      correctas: sanearCorrectas(p.correctas, 2, d.multiple),
                    })),
                  })
                : cambiar({
                    opcionesComunes: undefined,
                    // Sin reiniciar «Cómo se enseña»: ese control ya no vive
                    // dentro de la lista común, así que un "desplegable"
                    // elegido antes de desmarcar sigue a la vista y se puede
                    // cambiar. Reiniciarlo aquí sería tirar una decisión del
                    // profesor sin decírselo.
                    preguntas: d.preguntas.map((p) => ({
                      ...p,
                      opciones: ["", ""],
                      correctas: sanearCorrectas(p.correctas, 2, d.multiple),
                    })),
                  })
            }
          />
          Las mismas opciones para todas las preguntas
        </label>
      </div>

      {/*
        Fuera del bloque de lista común, que es donde estaba: `CLOZE` no usa
        lista común y es justo el formato que más lo necesita —catorce huecos
        de tres opciones son catorce filas de botones—, así que ahí dentro el
        control no existía para quien más lo necesitaba.
      */}
      <label className="block w-56 text-sm font-semibold text-tinta">
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
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Con muchas preguntas, «desplegable» evita un muro de botones.
        </span>
      </label>

      {/*
        El pasaje va después de «Cómo se enseña» porque lo anula: con texto,
        el control es siempre el desplegable. No se esconde el selector para
        no hacer aparecer y desaparecer campos mientras se escribe.
      */}
      <label className="block text-sm font-semibold text-tinta">
        Pasaje con huecos (opcional)
        <textarea
          rows={6}
          value={d.texto ?? ""}
          // Vacío es no tener pasaje, no tener uno en blanco: una cadena
          // vacía pasaría el `.optional()` del esquema y la cara intentaría
          // pintar un cloze sin texto.
          onChange={(e) => cambiar({ texto: e.target.value || undefined })}
          className={area}
        />
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Escribe {"{{"}id{"}}"} donde vaya cada hueco, con el id de su pregunta. Con pasaje,
          las opciones se pintan dentro del texto y siempre en desplegable.
        </span>
      </label>

      {d.texto && !marcasCuadran(d.texto, d.preguntas.map((p) => p.id)) && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Las marcas del pasaje no coinciden con los ids de las preguntas. Así no se
          puede guardar: cada hueco necesita su pregunta y cada pregunta su hueco.
        </p>
      )}

      {d.preguntas.some((p) => p.audio) && (
        <CampoEscuchas
          valor={d.escuchas}
          alCambiar={(escuchas) => cambiar({ escuchas })}
        />
      )}

      {usaComunes && (
        <fieldset className="rounded-tarjeta border border-hp-100 p-4">
          <legend className="px-2 text-sm font-bold text-tinta">Lista común</legend>
          <p className="text-sm text-tinta-suave">
            La misma opción puede valer en varias preguntas.
          </p>

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
                {(d.opcionesComunes ?? []).length > 2 && (
                  <BotonQuitar
                    onClick={() =>
                      cambiar({
                        opcionesComunes: (d.opcionesComunes ?? []).filter((_, j) => j !== i),
                        // La lista común es de todas las preguntas: quitar
                        // una opción de en medio desplaza el índice de la
                        // respuesta correcta en cada una de ellas, no solo
                        // en la que se estuviera editando.
                        preguntas: d.preguntas.map((p) => ({
                          ...p,
                          correctas: quitarIndice(p.correctas, i),
                        })),
                      })
                    }
                  >
                    Quitar
                  </BotonQuitar>
                )}
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

          <div className="mt-4">
            <span className="block text-sm font-semibold text-tinta">
              Audio de esta pregunta (opcional)
            </span>
            <div className="mt-1">
              <SubirAudio
                valor={p.audio}
                alCambiar={(url) => cambiarPregunta(i, { audio: url })}
              />
            </div>
          </div>

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
                {!usaComunes && (p.opciones ?? []).length > 2 && (
                  <BotonQuitar
                    onClick={() =>
                      cambiarPregunta(i, {
                        opciones: (p.opciones ?? []).filter((_, k) => k !== j),
                        correctas: quitarIndice(p.correctas, j),
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
                id: siguienteIdPregunta(d.preguntas),
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
