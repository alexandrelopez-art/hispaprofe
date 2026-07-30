import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const tipoLabel: Record<string, string> = {
  OPCION_MULTIPLE: "Opción",
  HUECOS: "Huecos",
  RELACIONAR: "Relacionar",
  ORDENAR: "Ordenar",
  WIDGET: "Widget",
};

export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{ nivel?: string; tipo?: string; estado?: string; q?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { nivel, tipo, estado, q } = await searchParams;

  const where: Prisma.EjercicioWhereInput = {
    ...(nivel ? { nivel: nivel as Prisma.EnumNivelFilter["equals"] } : {}),
    ...(tipo ? { tipo: tipo as Prisma.EnumTipoEjercicioFilter["equals"] } : {}),
    ...(estado === "publicado" ? { publicado: true } : {}),
    ...(estado === "borrador" ? { publicado: false } : {}),
    ...(q ? { titulo: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const ejercicios = await prisma.ejercicio.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titulo: true,
      tipo: true,
      nivel: true,
      destreza: true,
      publicado: true,
      _count: { select: { pasos: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-tinta">Recursos</h1>
        <Link
          href="/profe/recursos/nuevo"
          className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold leading-[2.75rem] text-white hover:bg-hp-500"
        >
          Nuevo ejercicio
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por título"
          className="h-10 flex-1 rounded-full border border-hp-200 px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
        <select name="nivel" defaultValue={nivel ?? ""} className="h-10 rounded-full border border-hp-200 px-4 text-sm">
          <option value="">Todos los niveles</option>
          {["A1", "A2", "B1", "B2", "C1", "A2_B1_ESCOLAR"].map((n) => (
            <option key={n} value={n}>
              {n === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : n}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className="h-10 rounded-full border border-hp-200 px-4 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(tipoLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={estado ?? ""} className="h-10 rounded-full border border-hp-200 px-4 text-sm">
          <option value="">Todos</option>
          <option value="publicado">Publicados</option>
          <option value="borrador">Borradores</option>
        </select>
        <button type="submit" className="h-10 rounded-full border border-hp-200 px-5 text-sm font-bold text-tinta hover:border-hp-400">
          Filtrar
        </button>
      </form>

      {ejercicios.length === 0 ? (
        <p className="mt-8 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          No hay ningún ejercicio que encaje.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {ejercicios.map((e) => (
            <li key={e.id}>
              <Link
                href={`/profe/recursos/${e.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">{e.titulo}</p>
                  <p className="truncate text-xs text-tinta-suave">
                    {tipoLabel[e.tipo] ?? e.tipo} · {e.nivel}
                    {e.destreza ? ` · ${e.destreza}` : ""} ·{" "}
                    {e._count.pasos === 0
                      ? "sin usar"
                      : `en ${e._count.pasos} paso${e._count.pasos !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    e.publicado ? "bg-hp-100 text-hp-700" : "bg-sol-100 text-tinta"
                  }`}
                >
                  {e.publicado ? "Publicado" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
