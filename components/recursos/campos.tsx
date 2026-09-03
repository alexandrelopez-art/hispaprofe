"use client";

import Campo from "@/components/ui/campo";

/**
 * `campo` y `area` siguen siendo cadenas de clases sueltas: las usan los
 * campos que viven dentro de una lista con sus propios botones de añadir y
 * quitar (preguntas, opciones, parejas, piezas, huecos, sobrantes…), que el
 * contrato de la sesión B deja fuera de `Campo` a propósito («los que llevan
 * botones dentro, listas o comportamiento propio no se convierten»).
 */
export const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export const area =
  "mt-1 w-full rounded-tarjeta border border-hp-200 bg-white p-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

/**
 * Un campo de texto con su rótulo, reescrito sobre `Campo` de la casa. Se
 * queda con el mismo nombre y las mismas props (`etiqueta`, `valor`,
 * `alCambiar`, `ancho`) para no tocar a quien lo llama: solo cambia lo que
 * hay dentro. Sin `name`: estos campos guardan su valor dentro del `datos`
 * de una lista, no como un campo suelto del formulario, y `Campo` ya no
 * exige uno.
 */
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
    <Campo
      etiqueta={etiqueta}
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      className={ancho ? "" : "w-40"}
    />
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
    <Campo
      etiqueta="Escuchas por audio"
      tipo="numero"
      min={1}
      // `step={1}`, y truncado además: el esquema exige un entero, y sin
      // esto se podía teclear 1,5 y no enterarse hasta que «Guardar»
      // devolvía un error, con el trabajo ya hecho. El paso del control y
      // el saneo dicen lo mismo, así que el decimal ni llega a existir.
      step={1}
      value={valor ?? 2}
      onChange={(e) => alCambiar(Math.max(1, Math.trunc(Number(e.target.value)) || 1))}
      ayuda="Dos es lo que da el examen. Sube el número para practicar."
      className="w-56"
    />
  );
}
