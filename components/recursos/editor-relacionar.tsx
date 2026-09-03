"use client";

import { campo, CampoEscuchas } from "./campos";
import SubirAudio from "./subir-audio";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";

type Pareja = { id: string; izquierda: string; derecha: string; audio?: string };

type DatosRelacionar = {
  ejercicio: "relacionar";
  consigna: string;
  texto?: string;
  parejas: Pareja[];
  sobrantes: string[];
  /** Opcional, igual que en `opcion`: una fila guardada antes de que el
   *  campo existiera no lo trae. Ver `CampoEscuchas`. */
  escuchas?: number;
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
  //
  // Se separan las dos causas porque el aviso saltaba también por un
  // sobrante en blanco diciendo «Hay parejas sin rellenar»: el profesor
  // repasaba las parejas, las veía completas y no encontraba de qué se
  // quejaba la pantalla.
  const parejasIncompletas = d.parejas.some(
    (p) => !p.izquierda.trim() || !p.derecha.trim(),
  );
  const sobrantesEnBlanco = d.sobrantes.some((s) => !s.trim());
  const incompleta = parejasIncompletas || sobrantesEnBlanco;

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
      <Campo
        etiqueta="Consigna"
        tipo="area"
        rows={2}
        value={d.consigna}
        onChange={(e) => alCambiar({ ...d, consigna: e.target.value })}
      />

      {incompleta && (
        <Aviso tono="aviso">
          {parejasIncompletas && sobrantesEnBlanco
            ? "Hay parejas sin rellenar y sobrantes en blanco: complétalos antes de guardar."
            : parejasIncompletas
              ? "Hay parejas sin rellenar: complétalas antes de guardar."
              : "Hay sobrantes en blanco: rellénalos o quítalos antes de guardar."}
        </Aviso>
      )}

      {repetida && (
        <Aviso tono="aviso">
          «{repetida}» está dos veces entre las opciones de la derecha, contando
          los sobrantes. El estudiante vería dos celdas idénticas y una de las
          dos filas quedaría mal contada pase lo que pase.
        </Aviso>
      )}

      <Campo
        etiqueta="Pasaje (opcional)"
        tipo="area"
        rows={5}
        value={d.texto ?? ""}
        onChange={(e) => alCambiar({ ...d, texto: e.target.value || undefined })}
        placeholder="Para las tareas de insertar fragmentos: el texto con los huecos numerados."
        ayuda="Se pinta encima de las dos columnas. Numera los huecos en el texto y escribe «Hueco 1», «Hueco 2»… en la columna de la izquierda."
      />

      <div className="space-y-3">
        {d.parejas.map((p, i) => (
          // Grupo de formulario, no tarjeta: fieldset/legend a propósito, sin sombra.
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
            <div className="w-full">
              <span className="block text-sm font-semibold text-tinta">
                Audio de esta fila (opcional)
              </span>
              <div className="mt-1">
                <SubirAudio
                  valor={p.audio}
                  alCambiar={(url) => cambiarPareja(i, { audio: url })}
                />
              </div>
            </div>
            {d.parejas.length > 2 && (
              <Boton
                variante="peligro"
                tamano="pequeno"
                onClick={() => alCambiar({ ...d, parejas: d.parejas.filter((_, j) => j !== i) })}
              >
                Quitar
              </Boton>
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
              <Boton
                variante="peligro"
                tamano="pequeno"
                onClick={() =>
                  alCambiar({ ...d, sobrantes: d.sobrantes.filter((_, j) => j !== i) })
                }
              >
                Quitar
              </Boton>
            </div>
          ))}
        </div>

        <Boton
          variante="sutil"
          onClick={() => alCambiar({ ...d, sobrantes: [...d.sobrantes, ""] })}
          className="mt-3"
        >
          Añadir sobrante
        </Boton>
      </fieldset>

      {d.parejas.some((p) => p.audio) && (
        <CampoEscuchas
          valor={d.escuchas}
          alCambiar={(escuchas) => alCambiar({ ...d, escuchas })}
        />
      )}

      <Boton
        variante="sutil"
        onClick={() =>
          alCambiar({
            ...d,
            parejas: [...d.parejas, { id: siguienteIdPareja(d.parejas), izquierda: "", derecha: "" }],
          })
        }
      >
        Añadir pareja
      </Boton>
    </div>
  );
}
