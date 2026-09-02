import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/lib/generated/prisma/client";
import { servicioLabel } from "@/lib/servicios";
import { getUsuarioActual } from "@/lib/usuario";

export const dynamic = "force-dynamic";

const nivelLabel: Record<string, string> = {
  A2_B1_ESCOLAR: "A2/B1 escolar",
  B2: "B2",
};

// Orden fijo para que la composición se lea siempre igual.
const TIPOS = [
  "ACTIVACION",
  "ACTIVIDAD",
  "ANDAMIAJE",
  "MICRO_TAREA",
  "MACRO_TAREA",
] as const;

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

const campoBase =
  "h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400";

export default async function RecorridosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nivel?: string; servicio?: string }>;
}) {
  const { q = "", nivel = "", servicio = "" } = await searchParams;

  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");
  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";

  const where: Prisma.RecorridoWhereInput = {};
  if (servicio) where.tipo = servicio as Prisma.RecorridoWhereInput["tipo"];
  if (nivel) where.nivel = nivel as Prisma.RecorridoWhereInput["nivel"];
  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
    ];
  }
  if (!esProfe) where.publicado = true;

  const recorridos = await prisma.recorrido.findMany({
    where,
    orderBy: [{ tipo: "asc" }, { orden: "asc" }],
    include: { pasos: { select: { tipo: true, ciclo: true } } },
  });

  const hayFiltro = Boolean(q || nivel || servicio);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Secuencias
      </h1>
      <p className="mt-2 text-tinta-suave">
        Busca una secuencia lista y ábrela para ver sus pasos.
      </p>

      <form className="mt-8 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por título o tema"
          className={`${campoBase} min-w-56 flex-1`}
        />
        <select name="servicio" defaultValue={servicio} className={campoBase}>
          <option value="">Todos los servicios</option>
          <option value="CLASES_PARTICULARES">
            {servicioLabel.CLASES_PARTICULARES}
          </option>
          <option value="PREPARACION_DELE">
            {servicioLabel.PREPARACION_DELE}
          </option>
        </select>
        <select name="nivel" defaultValue={nivel} className={campoBase}>
          <option value="">Todos los niveles</option>
          <option value="A2_B1_ESCOLAR">A2/B1 escolar</option>
          <option value="B2">B2</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Buscar
        </button>
        {hayFiltro && (
          <Link
            href="/recorridos"
            className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
          >
            Limpiar
          </Link>
        )}
      </form>

      <p className="mt-6 text-sm text-tinta-suave">
        {recorridos.length} secuencia{recorridos.length !== 1 ? "s" : ""}
        {hayFiltro ? " encontrada" : " disponible"}
        {recorridos.length !== 1 ? "s" : ""}.
      </p>

      {recorridos.length === 0 ? (
        <p className="mt-6 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          Ninguna secuencia coincide con la búsqueda.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {recorridos.map((recorrido) => {
            const total = recorrido.pasos.length;
            const ciclos = new Set(recorrido.pasos.map((p) => p.ciclo)).size;
            const composicion = TIPOS.map((tipo) => ({
              tipo,
              n: recorrido.pasos.filter((p) => p.tipo === tipo).length,
            })).filter((c) => c.n > 0);

            return (
              <Link
                key={recorrido.id}
                href={`/recorridos/${recorrido.id}`}
                className="flex flex-col rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
                    {servicioLabel[recorrido.tipo] ?? recorrido.tipo}
                  </span>
                  <span className="shrink-0 rounded-full bg-hp-400 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {nivelLabel[recorrido.nivel] ?? recorrido.nivel}
                  </span>
                </div>

                <h2 className="mt-2 line-clamp-2 text-lg font-bold text-tinta">
                  {recorrido.titulo}
                </h2>
                {recorrido.descripcion && (
                  <p className="mt-1 line-clamp-2 text-sm text-tinta-suave">
                    {recorrido.descripcion}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  <p className="text-xs font-semibold text-tinta-suave">
                    {total} paso{total !== 1 ? "s" : ""} · {ciclos} ciclo
                    {ciclos !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {composicion.map(({ tipo, n }) => (
                      <span
                        key={tipo}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          tipoStyle[tipo] ?? "bg-hp-50 text-tinta ring-hp-200"
                        }`}
                      >
                        {n} {tipoLabel[tipo]}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
