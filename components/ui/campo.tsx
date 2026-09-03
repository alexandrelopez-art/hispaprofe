import { useId, type ComponentProps } from "react";

// Exportada: la reutiliza algún control que se queda nativo a propósito
// (por ejemplo un <select> con <optgroup>, que Campo no admite) para no
// copiar la cadena de clases a mano.
export const CONTROL =
  "mt-1 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400 disabled:bg-fondo";

type Base = { etiqueta: string; name?: string; ayuda?: string; error?: string; className?: string };
type Texto = Base & {
  tipo?: "texto" | "correo" | "contrasena" | "numero" | "fecha" | "fechahora" | "hora" | "url" | "busqueda";
} & Omit<ComponentProps<"input">, "type" | "name" | "className">;
type Area = Base & { tipo: "area" } & Omit<ComponentProps<"textarea">, "name" | "className">;
type Elegir = Base & {
  tipo: "elegir";
  opciones: { valor: string; nombre: string; deshabilitada?: boolean }[];
} & Omit<ComponentProps<"select">, "name" | "className">;

const TIPO_HTML = {
  texto: "text",
  correo: "email",
  contrasena: "password",
  numero: "number",
  fecha: "date",
  fechahora: "datetime-local",
  hora: "time",
  url: "url",
  busqueda: "search",
} as const;

/** Rótulo, control y, si hacen falta, ayuda o error. Una sola forma de pedir un dato. */
export default function Campo(props: Texto | Area | Elegir) {
  const { etiqueta, name, ayuda, error, className = "" } = props;
  // useId y no name: name es opcional (un campo controlado de una lista no lo
  // necesita) y dos campos con el mismo name en una página no deben compartir id.
  const base = useId();
  const idError = error ? `${base}-error` : undefined;
  const idAyuda = ayuda ? `${base}-ayuda` : undefined;
  // Con error, el error es lo que se anuncia (la ayuda se oculta); si no hay
  // error pero sí ayuda, se anuncia la ayuda. Mismo valor en los tres controles.
  const describePor = idError ?? idAyuda;
  const invalido = error ? true : undefined;
  let control: React.ReactNode;
  if (props.tipo === "area") {
    // Fuera antes de esparcir `resto` sobre <textarea>: no son atributos HTML.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo: _t, ...resto } = props;
    control = <textarea name={name} aria-invalid={invalido} aria-describedby={describePor} {...resto} className={`${CONTROL} min-h-28 rounded-2xl py-2`} />;
  } else if (props.tipo === "elegir") {
    // Mismo motivo, más `opciones`: no es un atributo HTML de <select>.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo: _t, opciones, ...resto } = props;
    control = (
      <select name={name} aria-invalid={invalido} aria-describedby={describePor} {...resto} className={`${CONTROL} h-10`}>
        {opciones.map((o) => <option key={o.valor} value={o.valor} disabled={o.deshabilitada}>{o.nombre}</option>)}
      </select>
    );
  } else {
    // Mismo motivo: fuera antes de esparcir `resto` sobre <input>.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo = "texto", ...resto } = props;
    control = <input type={TIPO_HTML[tipo]} name={name} aria-invalid={invalido} aria-describedby={describePor} {...resto} className={`${CONTROL} h-10`} />;
  }
  return (
    <label className={`block text-sm font-semibold text-tinta ${className}`}>
      {etiqueta}
      {control}
      {ayuda && !error && <span id={idAyuda} className="mt-1 block text-xs font-normal text-tinta-suave">{ayuda}</span>}
      {error && <span id={idError} role="alert" className="mt-1 block text-xs font-semibold text-error-600">{error}</span>}
    </label>
  );
}
