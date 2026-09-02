import type { ComponentProps } from "react";

const CONTROL =
  "mt-1 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400 disabled:bg-fondo";

type Base = { etiqueta: string; name: string; ayuda?: string; error?: string; className?: string };
type Texto = Base & { tipo?: "texto" | "correo" | "contrasena" | "numero" } & Omit<ComponentProps<"input">, "type" | "name" | "className">;
type Area = Base & { tipo: "area" } & Omit<ComponentProps<"textarea">, "name" | "className">;
type Elegir = Base & { tipo: "elegir"; opciones: { valor: string; nombre: string }[] } & Omit<ComponentProps<"select">, "name" | "className">;

const TIPO_HTML = { texto: "text", correo: "email", contrasena: "password", numero: "number" } as const;

/** Rótulo, control y, si hacen falta, ayuda o error. Una sola forma de pedir un dato. */
export default function Campo(props: Texto | Area | Elegir) {
  const { etiqueta, name, ayuda, error, className = "" } = props;
  const idError = error ? `${name}-error` : undefined;
  let control: React.ReactNode;
  if (props.tipo === "area") {
    // Fuera antes de esparcir `resto` sobre <textarea>: no son atributos HTML.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo: _t, ...resto } = props;
    control = <textarea name={name} aria-describedby={idError} {...resto} className={`${CONTROL} min-h-28 rounded-2xl py-2`} />;
  } else if (props.tipo === "elegir") {
    // Mismo motivo, más `opciones`: no es un atributo HTML de <select>.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo: _t, opciones, ...resto } = props;
    control = (
      <select name={name} aria-describedby={idError} {...resto} className={`${CONTROL} h-10`}>
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.nombre}</option>)}
      </select>
    );
  } else {
    // Mismo motivo: fuera antes de esparcir `resto` sobre <input>.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { etiqueta: _e, name: _n, ayuda: _a, error: _r, className: _c, tipo = "texto", ...resto } = props;
    control = <input type={TIPO_HTML[tipo]} name={name} aria-invalid={error ? true : undefined} aria-describedby={idError} {...resto} className={`${CONTROL} h-10`} />;
  }
  return (
    <label className={`block text-sm font-semibold text-tinta ${className}`}>
      {etiqueta}
      {control}
      {ayuda && !error && <span className="mt-1 block text-xs font-normal text-tinta-suave">{ayuda}</span>}
      {error && <span id={idError} role="alert" className="mt-1 block text-xs font-semibold text-error-600">{error}</span>}
    </label>
  );
}
