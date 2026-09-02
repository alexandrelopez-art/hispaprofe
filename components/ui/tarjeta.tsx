import Link from "next/link";
import Rotulo from "./rotulo";

export type Acento = "bloque1" | "bloque2" | "bloque3" | "bloque4" | "hp" | "verde" | "sol" | "coral";
const BORDE: Record<Acento, string> = {
  bloque1: "border-l-4 border-l-bloque1", bloque2: "border-l-4 border-l-bloque2", bloque3: "border-l-4 border-l-bloque3", bloque4: "border-l-4 border-l-bloque4",
  hp: "border-l-4 border-l-hp-400", verde: "border-l-4 border-l-verde-500", sol: "border-l-4 border-l-sol-400", coral: "border-l-4 border-l-coral-500",
};

/** La caja de la identidad. Con `href`, toda la tarjeta es un enlace. */
export default function Tarjeta({ titulo, acento, href, className = "", children }: {
  titulo?: string; acento?: Acento; href?: string; className?: string; children: React.ReactNode;
}) {
  const clases = `block rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave ${acento ? BORDE[acento] : ""} ${href ? "transition-colors hover:border-hp-300" : ""} ${className}`;
  const cuerpo = (<>{titulo && <Rotulo className="mb-3">{titulo}</Rotulo>}{children}</>);
  return href ? <Link href={href} className={clases}>{cuerpo}</Link> : <section className={clases}>{cuerpo}</section>;
}
