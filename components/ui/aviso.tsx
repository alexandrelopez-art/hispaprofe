export type TonoAviso = "info" | "ok" | "aviso" | "error";
const CLASES: Record<TonoAviso, string> = {
  info: "bg-hp-50 text-hp-700", ok: "bg-verde-100 text-verde-600", aviso: "bg-sol-100 text-tinta", error: "bg-error-100 text-error-600",
};
export default function Aviso({ tono, className = "", children }: { tono: TonoAviso; className?: string; children: React.ReactNode }) {
  return <p role={tono === "error" ? "alert" : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${CLASES[tono]} ${className}`}>{children}</p>;
}
