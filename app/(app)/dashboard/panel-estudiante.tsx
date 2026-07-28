import { prisma } from "@/lib/prisma";
import Link from "next/link";

type Usuario = { id: string; firstName: string | null; email: string };

const servicioLabel: Record<string, string> = {
  RECORRIDO: "Clases particulares",
  PREPARACION: "Preparación DELE",
};

export default async function PanelEstudiante({
  usuario,
}: {
  usuario: Usuario;
}) {
  const saludo = `Hola, ${usuario.firstName ?? usuario.email}`;

  const asignaciones = await prisma.asignacion.findMany({
    where: { estudianteId: usuario.id, archivada: false },
    orderBy: { createdAt: "desc" },
    include: {
      recorrido: {
        select: {
          id: true,
          titulo: true,
          tipo: true,
          _count: { select: { pasos: true } },
        },
      },
      _count: { select: { completados: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        {saludo}
      </h1>

      <h2 className="mt-10 text-lg font-bold text-tinta">Tus secuencias</h2>

      {asignaciones.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          Todavía no tienes secuencias asignadas. Tu profe te las asigna desde
          aquí.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {asignaciones.map((asignacion) => {
            const total = asignacion.recorrido._count.pasos;
            const hechos = asignacion._count.completados;
            const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;

            return (
              <li key={asignacion.id}>
                <Link
                  href={`/recorridos/${asignacion.recorrido.id}`}
                  className="block rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
                    {servicioLabel[asignacion.recorrido.tipo] ??
                      asignacion.recorrido.tipo}
                  </p>
                  <p className="mt-1 font-bold text-tinta">
                    {asignacion.recorrido.titulo}
                  </p>
                  {asignacion.nota && (
                    <p className="mt-1 text-sm text-tinta-suave">
                      {asignacion.nota}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-hp-50">
                      <div
                        className="h-full rounded-full bg-bloque2"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-bold text-tinta-suave">
                      {hechos}/{total}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
