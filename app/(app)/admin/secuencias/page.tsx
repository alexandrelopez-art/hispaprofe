import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { servicioLabel } from "@/lib/servicios";

export const dynamic = "force-dynamic";

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function AdminSecuenciasPage() {
  const secuencias = await prisma.recorrido.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      titulo: true,
      nivel: true,
      tipo: true,
      publicado: true,
      autor: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { pasos: true, asignaciones: true } },
    },
  });

  const huerfanas = secuencias.filter((s) => !s.autor).length;

  return (
    <>
      <p className="mt-8 text-sm text-tinta-suave">
        {secuencias.length} secuencia{secuencias.length !== 1 ? "s" : ""} en toda
        la plataforma.
      </p>

      {huerfanas > 0 && (
        <p className="mt-3 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          {huerfanas} sin autor. Son las sembradas antes de que existiera ese
          campo; no es un error, pero nadie figura como su dueño.
        </p>
      )}

      {secuencias.length === 0 ? (
        <p className="mt-4 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          Todavía no hay ninguna secuencia.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {secuencias.map((s) => (
            <li key={s.id}>
              <Link
                href={`/recorridos/${s.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">{s.titulo}</p>
                  <p className="truncate text-xs text-tinta-suave">
                    {servicioLabel[s.tipo] ?? s.tipo} · {s.nivel} ·{" "}
                    {s.autor ? nombreDe(s.autor) : "sin autor"}
                  </p>
                </div>

                <span className="shrink-0 text-xs font-semibold text-tinta-suave">
                  {s._count.pasos} paso{s._count.pasos !== 1 ? "s" : ""} ·{" "}
                  {s._count.asignaciones} asignada
                  {s._count.asignaciones !== 1 ? "s" : ""}
                </span>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                    s.publicado
                      ? "bg-bloque2/25 text-tinta ring-bloque2/50"
                      : "bg-fondo text-tinta-suave ring-hp-100"
                  }`}
                >
                  {s.publicado ? "Publicada" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
