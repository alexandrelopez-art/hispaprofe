import { prisma } from "@/lib/prisma";
import Link from "next/link";

// Fuerza render dinámico: la página lee de la base en cada visita.
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

export default async function RecorridosPage() {
  const recorridos = await prisma.recorrido.findMany({
    orderBy: { orden: "asc" },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Recorridos DELE
      </h1>
      <p className="mt-2 text-slate-500">
        {recorridos.length} recorrido{recorridos.length !== 1 ? "s" : ""} en la
        base de datos.
      </p>

      {recorridos.length === 0 && (
        <p className="mt-10 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400">
          No hay recorridos todavía. Ejecuta el seed para crear uno.
        </p>
      )}

      <div className="mt-10 space-y-10">
        {recorridos.map((recorrido) => (
          <Link
            key={recorrido.id}
            href={`/recorridos/${recorrido.id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {recorrido.titulo}
                </h2>
                {recorrido.descripcion && (
                  <p className="mt-1 text-sm text-slate-500">
                    {recorrido.descripcion}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                {recorrido.nivel.replace(/_/g, " ")}
              </span>
            </div>

            {[1, 2].map((ciclo) => {
              const pasos = recorrido.pasos.filter((p) => p.ciclo === ciclo);
              if (pasos.length === 0) return null;
              return (
                <section key={ciclo} className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ciclo {ciclo}
                  </h3>
                  <ol className="mt-3 space-y-2">
                    {pasos.map((paso) => (
                      <li
                        key={paso.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                          {paso.orden}
                        </span>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            tipoStyle[paso.tipo] ??
                            "bg-slate-100 text-slate-700 ring-slate-200"
                          }`}
                        >
                          {tipoLabel[paso.tipo] ?? paso.tipo}
                        </span>
                        <span className="flex-1 text-sm text-slate-700">
                          {paso.titulo}
                        </span>
                        {paso.destreza && (
                          <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {paso.destreza}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </Link>
        ))}
      </div>
    </main>
  );
}
