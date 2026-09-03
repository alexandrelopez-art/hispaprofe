import Link from "next/link";
import Rotulo from "./rotulo";

export type Acento = "bloque1" | "bloque2" | "bloque3" | "bloque4" | "hp" | "verde" | "sol" | "coral";
const BORDE: Record<Acento, string> = {
  bloque1: "border-l-4 border-l-bloque1", bloque2: "border-l-4 border-l-bloque2", bloque3: "border-l-4 border-l-bloque3", bloque4: "border-l-4 border-l-bloque4",
  hp: "border-l-4 border-l-hp-400", verde: "border-l-4 border-l-verde-500", sol: "border-l-4 border-l-sol-400", coral: "border-l-4 border-l-coral-500",
};

/** Cuánto respira el contenido dentro de la tarjeta. `normal` es el valor de siempre. */
export type Relleno = "normal" | "compacto" | "suelto" | "minimo";
const RELLENO: Record<Relleno, string> = { normal: "p-6", compacto: "p-4", suelto: "p-8", minimo: "p-3" };

/**
 * La caja de la identidad. Con `href`, toda la tarjeta es un enlace.
 * El relleno se elige con `relleno`, no con `className`: Tailwind emite las
 * clases `p-*` en el orden en que aparecen aquí abajo, así que un `p-N`
 * colado en `className` perdía siempre contra el `p-6` de base.
 */
export default function Tarjeta({ titulo, acento, href, relleno = "normal", className = "", children }: {
  titulo?: string; acento?: Acento; href?: string; relleno?: Relleno; className?: string; children: React.ReactNode;
}) {
  const clases = `block rounded-tarjeta border border-hp-100 bg-white ${RELLENO[relleno]} shadow-suave ${acento ? BORDE[acento] : ""} ${href ? "transition-colors hover:border-hp-300" : ""} ${className}`;
  const cuerpo = (<>{titulo && <Rotulo className="mb-3">{titulo}</Rotulo>}{children}</>);
  return href ? <Link href={href} className={clases}>{cuerpo}</Link> : <section className={clases}>{cuerpo}</section>;
}
