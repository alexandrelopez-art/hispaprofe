import Link from "next/link";

export default function Encabezado({ titulo, lede, volver, acciones }: {
  titulo: string; lede?: React.ReactNode; volver?: { href: string; texto: string }; acciones?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
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
