import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

// Fuerza render dinámico: lee de la base en cada visita.
export const dynamic = "force-dynamic";

const tipoLabel: Record<string, string> = {
  ACTIVACION: "Activación",
  ACTIVIDAD: "Actividad",
  ANDAMIAJE: "Andamiaje",
  MICRO_TAREA: "Micro tarea",
  MACRO_TAREA: "Macro tarea",
};

const tipoStyle: Record<string, string> = {
  ACTIVACION: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  ACTIVIDAD: "bg-teal-100 text-teal-800 ring-teal-200",
  ANDAMIAJE: "bg-slate-100 text-slate-700 ring-slate-200",
  MICRO_TAREA: "bg-amber-100 text-amber-800 ring-amber-200",
  MACRO_TAREA: "bg-rose-100 text-rose-800 ring-rose-200",
};

export default async function RecorridoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const recorrido = await prisma.recorrido.findUnique({
    where: { id },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });

  if (!recorrido) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/recorridos"
        className="text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        ← Recorridos
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {recorrido.titulo}
          </h1>
          {recorrido.descripcion && (
            <p className="mt-2 text-slate-500">{recorrido.descripcion}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
          {recorrido.nivel.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-10">
        {[1, 2].map((ciclo) => {
          const pasos = recorrido.pasos.filter((p) => p.ciclo === ciclo);
          if (pasos.length === 0) return null;
          return (
            <section key={ciclo} className="mb-8">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                Ciclo {ciclo}
              </h2>
              <ol className="relative border-l-2 border-slate-200 pl-8">
                {pasos.map((paso) => (
                  <li key={paso.id} className="relative mb-5 last:mb-0">
                    <span className="absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white ring-4 ring-white">
                      {paso.orden}
                    </span>
                    <Link
                      href={`/pasos/${paso.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            tipoStyle[paso.tipo] ??
                            "bg-slate-100 text-slate-700 ring-slate-200"
                          }`}
                        >
                          {tipoLabel[paso.tipo] ?? paso.tipo}
                        </span>
                        {paso.destreza && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {paso.destreza}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        {paso.titulo}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </main>
  );
}
