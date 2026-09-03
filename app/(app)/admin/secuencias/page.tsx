import { prisma } from "@/lib/prisma";
import { servicioLabel } from "@/lib/servicios";
import Aviso from "@/components/ui/aviso";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

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
        <Aviso tono="aviso" className="mt-3">
          {huerfanas} sin autor. Son las sembradas antes de que existiera ese
          campo; no es un error, pero nadie figura como su dueño.
        </Aviso>
      )}

      {secuencias.length === 0 ? (
        <Vacio className="mt-4">Todavía no hay ninguna secuencia.</Vacio>
      ) : (
        <ul className="mt-4 space-y-2">
          {secuencias.map((s) => (
            <li key={s.id}>
              <Tarjeta href={`/recorridos/${s.id}`}>
                <div className="flex flex-wrap items-center gap-3">
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

                  <Etiqueta tono={s.publicado ? "verde" : "neutro"} className="shrink-0">
                    {s.publicado ? "Publicada" : "Borrador"}
                  </Etiqueta>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
