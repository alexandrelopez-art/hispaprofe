export type TonoEtiqueta = "neutro" | "hp" | "verde" | "sol" | "coral" | "error" | "bloque1" | "bloque2" | "bloque3" | "bloque4";
const CLASES: Record<TonoEtiqueta, string> = {
  neutro: "bg-fondo text-tinta-suave", hp: "bg-hp-100 text-hp-700", verde: "bg-verde-100 text-verde-600", sol: "bg-sol-100 text-tinta",
  coral: "bg-coral-100 text-coral-600", error: "bg-error-100 text-error-600",
  bloque1: "bg-bloque1/40 text-tinta", bloque2: "bg-bloque2/40 text-tinta", bloque3: "bg-bloque3/40 text-tinta", bloque4: "bg-bloque4/40 text-tinta",
};
export default function Etiqueta({ tono = "neutro", className = "", children }: { tono?: TonoEtiqueta; className?: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CLASES[tono]} ${className}`}>{children}</span>;
}
