"use client";

import { area, botonSecundario, BotonQuitar, campo } from "./campos";

type Pareja = { id: string; izquierda: string; derecha: string; audio?: string };

type DatosRelacionar = {
  ejercicio: "relacionar";
  consigna: string;
  texto?: string;
  parejas: Pareja[];
  sobrantes: string[];
  escuchas: number;
};

export const RELACIONAR_VACIO: DatosRelacionar = {
  ejercicio: "relacionar",
  consigna: "",
  parejas: [
    { id: "r1", izquierda: "", derecha: "" },
    { id: "r2", izquierda: "", derecha: "" },
  ],
  sobrantes: [],
  escuchas: 2,
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

  // Mientras haya una pareja sin rellenar, el `refine` del esquema compara
  // igual sus derechas vacías entre sí y las cuenta como duplicado: al
  // pulsar "Guardar" con `RELACIONAR_VACIO` sin tocar (dos derechas ""),
  // saldría el mensaje de duplicados sin que aquí se haya avisado nunca de
  // nada, y ese mensaje no describe lo que pasa de verdad. Se avisa primero
  // de esto, con un mensaje propio, para que el profesor nunca llegue al de
  // duplicados por este camino.
  const incompleta =
    d.parejas.some((p) => !p.izquierda.trim() || !p.derecha.trim()) ||
    d.sobrantes.some((s) => !s.trim());

  // El esquema rechaza dos derechas iguales, y también un sobrante que
  // repita una respuesta buena o a otro sobrante: en los tres casos el
  // estudiante vería dos celdas idénticas. Se avisa aquí para no
  // descubrirlo al guardar.
  const todas = [
    ...d.parejas.map((p) => p.derecha.trim()),
    ...d.sobrantes.map((s) => s.trim()),
  ].filter(Boolean);
  const repetida = !incompleta && todas.find((v, i) => todas.indexOf(v) !== i);

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

      {incompleta && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          Hay parejas sin rellenar: complétalas antes de guardar.
        </p>
      )}

      {repetida && (
        <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
          «{repetida}» está dos veces entre las opciones de la derecha, contando
          los sobrantes. El estudiante vería dos celdas idénticas y una de las
          dos filas quedaría mal contada pase lo que pase.
        </p>
      )}

      <label className="block text-sm font-semibold text-tinta">
        Pasaje (opcional)
        <textarea
          rows={5}
          value={d.texto ?? ""}
          onChange={(e) => alCambiar({ ...d, texto: e.target.value || undefined })}
          placeholder="Para las tareas de insertar fragmentos: el texto con los huecos numerados."
          className={area}
        />
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Se pinta encima de las dos columnas. Numera los huecos en el texto y
          escribe «Hueco 1», «Hueco 2»… en la columna de la izquierda.
        </span>
      </label>

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
            <label className="block w-full text-sm font-semibold text-tinta">
              Audio de esta fila (opcional)
              <input
                type="text"
                value={p.audio ?? ""}
                onChange={(e) => cambiarPareja(i, { audio: e.target.value || undefined })}
                placeholder="Dirección del audio"
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

      <fieldset className="rounded-tarjeta border border-hp-100 p-4">
        <legend className="px-2 text-sm font-bold text-tinta">Sobrantes</legend>
        <p className="text-sm text-tinta-suave">
          Opciones que se mezclan con las buenas y no emparejan con nada. En el
          DELE son las que hacen que haya nueve textos para seis enunciados.
        </p>

        <div className="mt-3 space-y-2">
          {d.sobrantes.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="text"
                value={s}
                onChange={(e) => {
                  const sobrantes = [...d.sobrantes];
                  sobrantes[i] = e.target.value;
                  alCambiar({ ...d, sobrantes });
                }}
                className={`${campo} mt-0`}
              />
              <BotonQuitar
                onClick={() =>
                  alCambiar({ ...d, sobrantes: d.sobrantes.filter((_, j) => j !== i) })
                }
              >
                Quitar
              </BotonQuitar>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => alCambiar({ ...d, sobrantes: [...d.sobrantes, ""] })}
          className={`${botonSecundario} mt-3`}
        >
          Añadir sobrante
        </button>
      </fieldset>

      {d.parejas.some((p) => p.audio) && (
        <label className="block w-56 text-sm font-semibold text-tinta">
          Escuchas por audio
          <input
            type="number"
            min={1}
            value={d.escuchas}
            onChange={(e) =>
              alCambiar({ ...d, escuchas: Math.max(1, Number(e.target.value) || 1) })
            }
            className={campo}
          />
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            Dos es lo que da el examen. Sube el número para practicar.
          </span>
        </label>
      )}

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
