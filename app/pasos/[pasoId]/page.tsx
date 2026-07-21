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

const tipoDescripcion: Record<string, string> = {
  ACTIVACION:
    "Actividad de activación: conecta conocimientos previos e introduce el tema del recorrido.",
  ACTIVIDAD:
    "Actividad de práctica centrada en una destreza (comprensión o expresión).",
  ANDAMIAJE:
    "Andamiaje: apoyo lingüístico (léxico y gramática) que prepara para las tareas. También nutre la biblioteca del Bloque 4.",
  MICRO_TAREA:
    "Micro tarea: producción breve que integra lo trabajado en el ciclo.",
  MACRO_TAREA:
    "Macro tarea: producción final que integra todo el recorrido.",
};

export default async function PasoPage({
  params,
}: {
  params: Promise<{ pasoId: string }>;
}) {
  const { pasoId } = await params;

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    include: { recorrido: true },
  });

  if (!paso) notFound();

  // Hermanos del mismo recorrido, ordenados, para calcular anterior/siguiente.
  const hermanos = await prisma.paso.findMany({
    where: { recorridoId: paso.recorridoId },
    orderBy: { orden: "asc" },
    select: { id: true, titulo: true },
  });

  const indice = hermanos.findIndex((p) => p.id === paso.id);
  const anterior = hermanos[indice - 1];
  const siguiente = hermanos[indice + 1];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/recorridos/${paso.recorridoId}`}
        className="text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        ← {paso.recorrido.titulo}
      </Link>

      <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-400">
        <span>
          Paso {paso.orden} de {hermanos.length}
        </span>
        <span>·</span>
        <span>Ciclo {paso.ciclo}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
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

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {paso.titulo}
      </h1>

      <p className="mt-2 text-sm text-slate-500">
        {tipoDescripcion[paso.tipo] ?? ""}
      </p>

      {/* Área de contenido — pendiente de añadir el campo al modelo Paso. */}
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm text-slate-400">
          El contenido de esta actividad aparecerá aquí.
        </p>
      </div>

      {/* Navegación anterior / siguiente dentro del recorrido. */}
      <nav className="mt-10 flex items-stretch justify-between gap-4 border-t border-slate-200 pt-6">
        {anterior ? (
          <Link
            href={`/pasos/${anterior.id}`}
            className="group flex max-w-[45%] flex-col text-left"
          >
            <span className="text-xs text-slate-400">← Anterior</span>
            <span className="truncate text-sm font-medium text-slate-700 group-hover:text-slate-900">
              {anterior.titulo}
            </span>
          </Link>
        ) : (
          <span />
        )}

        {siguiente ? (
          <Link
            href={`/pasos/${siguiente.id}`}
            className="group flex max-w-[45%] flex-col text-right"
          >
            <span className="text-xs text-slate-400">Siguiente →</span>
            <span className="truncate text-sm font-medium text-slate-700 group-hover:text-slate-900">
              {siguiente.titulo}
            </span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
