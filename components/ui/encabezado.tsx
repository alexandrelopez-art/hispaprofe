import Link from "next/link";

// `margen` es prop, no `className`: Tailwind emite las clases `mb-*` en el
// orden en que aparecen aquí abajo, así que un `-mt-6` o `mb-N` colado desde
// fuera en className perdía siempre contra (o ganaba de forma imprevisible
// a) el `mb-8` de base — el mismo problema de orden de cascada que `Tarjeta`
// ya resolvió con `relleno`.
const MARGEN = { normal: "mb-8", corto: "mb-3" } as const;

export default function Encabezado({ titulo, lede, volver, acciones, margen = "normal" }: {
  titulo: string; lede?: React.ReactNode; volver?: { href: string; texto: string }; acciones?: React.ReactNode;
  margen?: "normal" | "corto";
}) {
  return (
    <div className={MARGEN[margen]}>
      {volver && (
        <Link href={volver.href} className="text-sm font-semibold text-tinta-suave hover:text-hp-500">← {volver.texto}</Link>
      )}
      <div className={`flex flex-wrap items-start justify-between gap-4 ${volver ? "mt-4" : ""}`}>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-tinta">{titulo}</h1>
          {lede && <p className="mt-2 max-w-2xl text-tinta-suave">{lede}</p>}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap gap-3">{acciones}</div>}
      </div>
    </div>
  );
}
