"use client";

export const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export const area =
  "mt-1 w-full rounded-tarjeta border border-hp-200 bg-white p-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export const botonSecundario =
  "h-9 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400";

export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  ancho = true,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  ancho?: boolean;
}) {
  return (
    <label className={`block text-sm font-semibold text-tinta ${ancho ? "" : "w-40"}`}>
      {etiqueta}
      <input
        type="text"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className={campo}
      />
    </label>
  );
}

/**
 * Cuántas veces se puede oír cada audio del ejercicio.
 *
 * Uno solo para los dos editores: el bloque estaba copiado palabra por
 * palabra en `editor-opcion` y en `editor-relacionar`, con el mismo saneo
 * escrito dos veces. Quien lo pinta decide cuándo tiene sentido — hoy, los
 * dos lo enseñan solo si algún ítem lleva audio.
 */
export function CampoEscuchas({
  valor,
  alCambiar,
}: {
  /**
   * Puede faltar: el campo es más nuevo que la tabla, así que una fila
   * guardada antes de que existiera no lo trae. El esquema lo resuelve con
   * `.default(2)`; aquí se hace lo mismo para no dejar el input sin valor.
   */
  valor: number | undefined;
  alCambiar: (n: number) => void;
}) {
  return (
    <label className="block w-56 text-sm font-semibold text-tinta">
      Escuchas por audio
      <input
        type="number"
        min={1}
        // `step={1}`, y truncado además: el esquema exige un entero, y sin
        // esto se podía teclear 1,5 y no enterarse hasta que «Guardar»
        // devolvía un error, con el trabajo ya hecho. El paso del control y
        // el saneo dicen lo mismo, así que el decimal ni llega a existir.
        step={1}
        value={valor ?? 2}
        onChange={(e) => alCambiar(Math.max(1, Math.trunc(Number(e.target.value)) || 1))}
        className={campo}
      />
      <span className="mt-1 block text-xs font-normal text-tinta-suave">
        Dos es lo que da el examen. Sube el número para practicar.
      </span>
    </label>
  );
}

export function BotonQuitar({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
    >
      {children}
    </button>
  );
}
