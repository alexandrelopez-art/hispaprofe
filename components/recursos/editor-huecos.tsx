"use client";

import { area, BotonQuitar, campo } from "./campos";

type Hueco = { id: string; acepta: string[] };

type DatosHuecos = {
  ejercicio: "huecos";
  consigna: string;
  texto: string;
  huecos: Hueco[];
};

export const HUECOS_VACIO: DatosHuecos = {
  ejercicio: "huecos",
  consigna: "",
  texto: "",
  huecos: [],
};

/** Las marcas {{...}} que hay en el texto, en orden y sin repetir. */
function marcasDe(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of texto.matchAll(/\{\{([^}]+)\}\}/g)) {
    vistas.add(m[1]);
  }
  return [...vistas];
}

export default function EditorHuecos({
  datos,
  alCambiar,
}: {
  datos: unknown;
  alCambiar: (nuevo: unknown) => void;
}) {
  const d = datos as DatosHuecos;
  const marcas = marcasDe(d.texto);

  /**
   * Cada vez que cambia el texto, la lista de huecos se rehace a partir de
   * sus marcas: se conservan las soluciones de las marcas que siguen ahí y
   * se tiran las de las que desaparecieron.
   *
   * Derivarlos así, y no dejar que el profesor mantenga dos listas a mano,
   * es lo que evita el rechazo del esquema («Las marcas {{...}} del texto no
   * coinciden con los ids de `huecos`»), que si no aparecería al guardar sin
   * decir cuál falta.
   */
  const cambiarTexto = (texto: string) => {
    const anteriores = new Map(d.huecos.map((h) => [h.id, h]));
    const huecos = marcasDe(texto).map(
      (id) => anteriores.get(id) ?? { id, acepta: [""] },
    );
    alCambiar({ ...d, texto, huecos });
  };

  const cambiarHueco = (id: string, acepta: string[]) =>
    alCambiar({ ...d, huecos: d.huecos.map((h) => (h.id === id ? { ...h, acepta } : h)) });

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

      <label className="block text-sm font-semibold text-tinta">
        Texto
        <textarea
          rows={6}
          value={d.texto}
          onChange={(e) => cambiarTexto(e.target.value)}
          placeholder="Ayer {{a}} al cine y {{b}} una película preciosa."
          className={area}
        />
        <span className="mt-1 block text-xs font-normal text-tinta-suave">
          Escribe <code>{"{{algo}}"}</code> donde falte una palabra. Los huecos
          de abajo se crean solos con lo que escribas aquí.
        </span>
      </label>

      {marcas.length === 0 ? (
        <p className="rounded-tarjeta border border-dashed border-hp-200 p-6 text-center text-sm text-tinta-suave">
          Todavía no hay ningún hueco en el texto.
        </p>
      ) : (
        <div className="space-y-3">
          {d.huecos.map((h) => (
            <fieldset key={h.id} className="rounded-tarjeta border border-hp-100 p-4">
              <legend className="px-2 text-sm font-bold text-tinta">
                Hueco <code>{`{{${h.id}}}`}</code>
              </legend>
              <p className="text-sm text-tinta-suave">
                Todas las formas que das por buenas. Se perdona la mayúscula y
                los espacios de sobra; la tilde no.
              </p>

              <div className="mt-3 space-y-2">
                {h.acepta.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={a}
                      onChange={(e) => {
                        const acepta = [...h.acepta];
                        acepta[i] = e.target.value;
                        cambiarHueco(h.id, acepta);
                      }}
                      className={`${campo} mt-0`}
                    />
                    {h.acepta.length > 1 && (
                      <BotonQuitar onClick={() => cambiarHueco(h.id, h.acepta.filter((_, j) => j !== i))}>
                        Quitar
                      </BotonQuitar>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => cambiarHueco(h.id, [...h.acepta, ""])}
                className="mt-3 text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
              >
                Añadir otra forma válida
              </button>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
