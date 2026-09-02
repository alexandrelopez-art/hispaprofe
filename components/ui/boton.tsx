import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type VarianteBoton = "primario" | "secundario" | "sutil" | "peligro";
export type TamanoBoton = "normal" | "pequeno";

export const CLASES_BOTON: Record<VarianteBoton, string> = {
  primario: "bg-hp-500 text-white hover:bg-hp-600",
  secundario: "border-2 border-tinta text-tinta hover:bg-tinta hover:text-white",
  sutil: "border border-hp-200 text-tinta-suave hover:border-hp-400 hover:text-hp-500",
  peligro: "bg-error-500 text-white hover:bg-error-600",
};

export const CLASES_TAMANO: Record<TamanoBoton, string> = {
  normal: "h-10 px-5 text-sm",
  pequeno: "h-8 px-3.5 text-xs",
};

export function clasesDeBoton(variante: VarianteBoton, tamano: TamanoBoton, extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${CLASES_BOTON[variante]} ${CLASES_TAMANO[tamano]} ${extra}`.trim();
}

type Comun = { variante?: VarianteBoton; tamano?: TamanoBoton; className?: string; children: ReactNode };
type ComoEnlace = Comun & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type ComoBoton = Comun & { href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

/** El botón de la casa. Con `href` es un enlace con aspecto de botón. */
export default function Boton(props: ComoEnlace | ComoBoton) {
  const { variante = "primario", tamano = "normal", className = "", children } = props;
  const clases = clasesDeBoton(variante, tamano, className);
  if (props.href !== undefined) {
    // Se destructuran para quitarlas antes de esparcir `resto` sobre <Link>: no son atributos HTML.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { variante: _v, tamano: _t, className: _c, children: _h, ...resto } = props;
    return <Link {...resto} className={clases}>{children}</Link>;
  }
  // Mismo motivo: fuera antes de esparcir `resto` sobre <button>.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variante: _v, tamano: _t, className: _c, children: _h, type = "button", ...resto } = props;
  return <button type={type} {...resto} className={clases}>{children}</button>;
}
