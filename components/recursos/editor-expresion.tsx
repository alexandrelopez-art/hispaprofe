"use client";

import { area, botonSecundario, BotonQuitar, campo, CampoTexto } from "./campos";
import SubirAudio from "./subir-audio";

type Criterio = { id: string; nombre: string; maximo: number };

type DatosExpresion = {
  ejercicio: "expresion";
  modalidad: "escrita" | "oral";
  consigna: string;
  estimulo: { texto?: string; imagen?: string; audio?: string };
  palabras?: { minimo: number; maximo: number };
  minutos?: number;
  criterios: Criterio[];
  modelo?: string;
};

/** Los cuatro del Instituto Cervantes, para no escribirlos cada vez. */
const CRITERIOS_CERVANTES: Criterio[] = [
  { id: "c1", nombre: "Adecuación al género y cumplimiento", maximo: 3 },
  { id: "c2", nombre: "Coherencia", maximo: 3 },
  { id: "c3", nombre: "Corrección", maximo: 3 },
  { id: "c4", nombre: "Alcance", maximo: 3 },
];

export const EXPRESION_VACIA: DatosExpresion = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "",
  estimulo: {},
  palabras: { minimo: 100, maximo: 120 },
  criterios: CRITERIOS_CERVANTES,
};

/**
 * El siguiente id de criterio, único dentro de la tarea. Por el máximo de
 * los sufijos que ya existen y no por `longitud + 1`: quitar el criterio de
 * en medio y añadir otro repetiría un id, y ese id es la clave con la que se
 * guardan las notas del alumno.
 */
function siguienteIdCriterio(criterios: Criterio[]): string {
  const maximo = criterios.reduce((max, c) => {
    const m = /^c(\d+)$/.exec(c.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `c${maximo + 1}`;
}

export default function EditorExpresion({
  datos,
  alCambiar,
}: {
  datos: unknown;
  alCambiar: (nuevo: unknown) => void;
}) {
  const d = datos as DatosExpresion;
  const esEscrita = d.modalidad === "escrita";

  const cambiar = (parcial: Partial<DatosExpresion>) => alCambiar({ ...d, ...parcial });

  const cambiarCriterio = (i: number, parcial: Partial<Criterio>) =>
    cambiar({ criterios: d.criterios.map((c, j) => (j === i ? { ...c, ...parcial } : c)) });

  // El esquema rechaza una tarea con un criterio sin nombre y con dos
  // criterios del mismo id. Se avisa aquí para no descubrirlo al guardar.
  const sinNombre = d.criterios.some((c) => !c.nombre.trim());
  const nombres = d.criterios.map((c) => c.nombre.trim()).filter(Boolean);
  const repetido = !sinNombre && nombres.find((v, i) => nombres.indexOf(v) !== i);
  const palabrasAlReves =
    esEscrita && d.palabras !== undefined && d.palabras.minimo > d.palabras.maximo;

  return (
    <div className="space-y-6">
      <label className="block w-56 text-sm font-semibold text-tinta">
        Modalidad
        <select
          value={d.modalidad}
          onChange={(e) => {
            const modalidad = e.target.value as "escrita" | "oral";
            // Los campos son excluyentes: el esquema rechaza una escrita con
            // minutos y una oral con palabras, así que se cambian juntos.
            cambiar(
              modalidad === "escrita"
                ? { modalidad, palabras: { minimo: 100, maximo: 120 }, minutos: undefined }
                : { modalidad, minutos: 3, palabras: undefined },
            );
          }}
          className={campo}
        >
          <option value="escrita">Expresión escrita</option>
          <option value="oral">Expresión oral</option>
        </select>
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          {esEscrita
            ? "El alumno escribe en la aplicación y te llega para corregir."
            : "No hay entrega: la evalúas con el alumno delante, en clase."}
        </span>
      </label>

      <label className="block text-sm font-semibold text-tinta">
        Consigna
        <textarea
          rows={3}
          value={d.consigna}
          onChange={(e) => cambiar({ consigna: e.target.value })}
          placeholder="Escribe un correo a un amigo contándole tus vacaciones."
          className={area}
        />
      </label>

      <fieldset className="rounded-tarjeta border border-hp-100 p-4">
        <legend className="px-2 text-sm font-bold text-tinta">Estímulo</legend>
        <p className="text-sm text-tinta-suave">
          Lo que el alumno tiene delante: el texto al que responde, la lámina,
          el gráfico o el audio. Viaja con la tarea, así que sirve con otro
          alumno sin volver a montarlo.
        </p>

        <label className="mt-3 block text-sm font-semibold text-tinta">
          Texto
          <textarea
            rows={4}
            value={d.estimulo.texto ?? ""}
            onChange={(e) =>
              cambiar({ estimulo: { ...d.estimulo, texto: e.target.value || undefined } })
            }
            className={area}
          />
        </label>

        <div className="mt-3">
          <span className="block text-sm font-semibold text-tinta">Imagen (opcional)</span>
          <input
            type="text"
            value={d.estimulo.imagen ?? ""}
            onChange={(e) =>
              cambiar({ estimulo: { ...d.estimulo, imagen: e.target.value || undefined } })
            }
            placeholder="Dirección de la imagen"
            className={campo}
          />
        </div>

        <div className="mt-3">
          <span className="block text-sm font-semibold text-tinta">Audio (opcional)</span>
          <div className="mt-1">
            <SubirAudio
              valor={d.estimulo.audio}
              alCambiar={(url) => cambiar({ estimulo: { ...d.estimulo, audio: url } })}
            />
          </div>
        </div>
      </fieldset>

      {esEscrita ? (
        <div className="flex flex-wrap gap-4">
          <label className="block w-40 text-sm font-semibold text-tinta">
            Palabras, mínimo
            <input
              type="number"
              min={1}
              step={1}
              value={d.palabras?.minimo ?? 100}
              onChange={(e) =>
                cambiar({
                  palabras: {
                    minimo: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                    maximo: d.palabras?.maximo ?? 120,
                  },
                })
              }
              className={campo}
            />
          </label>
          <label className="block w-40 text-sm font-semibold text-tinta">
            Palabras, máximo
            <input
              type="number"
              min={1}
              step={1}
              value={d.palabras?.maximo ?? 120}
              onChange={(e) =>
                cambiar({
                  palabras: {
                    minimo: d.palabras?.minimo ?? 100,
                    maximo: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                  },
                })
              }
              className={campo}
            />
          </label>
        </div>
      ) : (
        <label className="block w-40 text-sm font-semibold text-tinta">
          Minutos
          <input
            type="number"
            min={1}
            step={1}
            value={d.minutos ?? 3}
            onChange={(e) =>
              cambiar({ minutos: Math.max(1, Math.trunc(Number(e.target.value)) || 1) })
            }
            className={campo}
          />
        </label>
      )}

      {palabrasAlReves && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          El mínimo de palabras es mayor que el máximo.
        </p>
      )}
      {sinNombre && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Hay un criterio sin nombre.
        </p>
      )}
      {repetido && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Hay dos criterios llamados «{repetido}»: al corregir no sabrás cuál es cuál.
        </p>
      )}

      <fieldset className="rounded-tarjeta border border-hp-100 p-4">
        <legend className="px-2 text-sm font-bold text-tinta">Criterios</legend>
        <p className="text-sm text-tinta-suave">
          Con lo que vas a puntuar. Vienen los cuatro del Instituto Cervantes;
          quita, añade o cambia lo que quieras. La suma de sus máximos es lo
          que puede sacar el alumno.
        </p>

        <div className="mt-3 space-y-2">
          {d.criterios.map((c, i) => (
            <div key={c.id} className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <CampoTexto
                  etiqueta={`Criterio ${i + 1}`}
                  valor={c.nombre}
                  alCambiar={(v) => cambiarCriterio(i, { nombre: v })}
                />
              </div>
              <label className="block w-28 text-sm font-semibold text-tinta">
                Máximo
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={c.maximo}
                  onChange={(e) =>
                    cambiarCriterio(i, {
                      maximo: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                    })
                  }
                  className={campo}
                />
              </label>
              {d.criterios.length > 1 && (
                <BotonQuitar
                  onClick={() => cambiar({ criterios: d.criterios.filter((_, j) => j !== i) })}
                >
                  Quitar
                </BotonQuitar>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            cambiar({
              criterios: [
                ...d.criterios,
                { id: siguienteIdCriterio(d.criterios), nombre: "", maximo: 3 },
              ],
            })
          }
          className={`${botonSecundario} mt-3`}
        >
          Añadir criterio
        </button>
      </fieldset>

      <label className="block text-sm font-semibold text-tinta">
        Texto modelo (opcional)
        <textarea
          rows={6}
          value={d.modelo ?? ""}
          onChange={(e) => cambiar({ modelo: e.target.value || undefined })}
          className={area}
        />
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Al alumno se le enseña <strong>después</strong> de que lo corrijas, nunca antes.
        </span>
      </label>
    </div>
  );
}
