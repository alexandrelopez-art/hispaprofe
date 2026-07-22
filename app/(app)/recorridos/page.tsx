import { prisma } from "@/lib/prisma";
import Link from "next/link";

// Fuerza render dinámico: la página lee de la base en cada visita.
export const dynamic = "force-dynamic";

const nivelLabel: Record<string, string> = {
  A2_B1_ESCOLAR: "A2/B1 escolar",
  B2: "B2",
};

const tipoLabel: Record<string, string> = {
  ACTIVACION: "Activación",
  ACTIVIDAD: "Actividad",
  ANDAMIAJE: "Andamiaje",
  MICRO_TAREA: "Micro tarea",
  MACRO_TAREA: "Macro tarea",
};

const tipoStyle: Record<string, string> = {
  ACTIVACION: "bg-bloque2/25 text-tinta ring-bloque2/50",
  ACTIVIDAD: "bg-hp-100 text-hp-700 ring-hp-200",
  ANDAMIAJE: "bg-bloque1/25 text-tinta ring-bloque1/50",
  MICRO_TAREA: "bg-sol-200/70 text-tinta ring-sol-400/60",
  MACRO_TAREA: "bg-bloque3/25 text-tinta ring-bloque3/50",
};

export default async function RecorridosPage() {
  const recorridos = await prisma.recorrido.findMany({
    where: { tipo: "RECORRIDO" },
    orderBy: { orden: "asc" },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Recorridos
      </h1>
      <p className="mt-2 text-tinta-suave">
        {recorridos.length} recorrido{recorridos.length !== 1 ? "s" : ""}{" "}
        disponible{recorridos.length !== 1 ? "s" : ""}.
      </p>

      {recorridos.length === 0 && (
        <p className="mt-10 rounded-tarjeta border border-dashed border-hp-200 p-8 text-center text-tinta-suave">
          No hay recorridos todavía. Ejecuta el seed para crear uno.
        </p>
      )}

      <div className="mt-10 space-y-8">
        {recorridos.map((recorrido) => (
          <Link
            key={recorrido.id}
            href={`/recorridos/${recorrido.id}`}
            className="block rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-tinta">
                  {recorrido.titulo}
                </h2>
                {recorrido.descripcion && (
                  <p className="mt-1 text-sm text-tinta-suave">
                    {recorrido.descripcion}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-hp-400 px-3 py-1 text-xs font-bold text-white">
                {nivelLabel[recorrido.nivel] ?? recorrido.nivel}
              </span>
            </div>

            {[1, 2].map((ciclo) => {
              const pasos = recorrido.pasos.filter((p) => p.ciclo === ciclo);
              if (pasos.length === 0) return null;
              return (
                <section key={ciclo} className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
                    Ciclo {ciclo}
                  </h3>
                  <ol className="mt-3 space-y-2">
                    {pasos.map((paso) => (
                      <li
                        key={paso.id}
                        className="flex items-center gap-3 rounded-xl border border-hp-50 bg-fondo px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta text-xs font-bold text-white">
                          {paso.orden}
                        </span>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            tipoStyle[paso.tipo] ??
                            "bg-hp-50 text-tinta ring-hp-200"
                          }`}
                        >
                          {tipoLabel[paso.tipo] ?? paso.tipo}
                        </span>
                        <span className="flex-1 text-sm text-tinta">
                          {paso.titulo}
                        </span>
                        {paso.destreza && (
                          <span className="shrink-0 rounded bg-hp-100 px-1.5 py-0.5 text-[10px] font-bold text-hp-700">
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
    </div>
  );
}
