import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const servicioLabel: Record<string, string> = {
  RECORRIDO: "Clases particulares",
  PREPARACION: "Preparación DELE",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

function Dato({ n, etiqueta }: { n: number | string; etiqueta: string }) {
  return (
    <div className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <p className="text-3xl font-extrabold text-tinta">{n}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-tinta-suave">
        {etiqueta}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/");

  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";
  const saludo = `Hola, ${usuario.firstName ?? usuario.email}`;

  // ─── Vista del estudiante ──────────────────────────────────────────────
  if (!esProfe) {
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
            Todavía no tienes secuencias asignadas. Tu profe te las asigna
            desde aquí.
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

  // ─── Vista del profesor ────────────────────────────────────────────────
  const [misSecuencias, totalSecuencias, estudiantes, grupos, asignaciones] =
    await Promise.all([
      prisma.recorrido.count({ where: { autorId: usuario.id } }),
      prisma.recorrido.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.grupo.count({ where: { profesorId: usuario.id, archivado: false } }),
      prisma.asignacion.findMany({
        where: { archivada: false },
        include: {
          estudiante: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          recorrido: {
            select: { titulo: true, _count: { select: { pasos: true } } },
          },
          _count: { select: { completados: true } },
        },
      }),
    ]);

  const pasosTotales = asignaciones.reduce(
    (suma, a) => suma + a.recorrido._count.pasos,
    0,
  );
  const pasosHechos = asignaciones.reduce(
    (suma, a) => suma + a._count.completados,
    0,
  );
  const progresoMedio =
    pasosTotales > 0 ? Math.round((pasosHechos / pasosTotales) * 100) : 0;

  const sinEmpezar = asignaciones.filter((a) => a._count.completados === 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        {saludo}
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Dato n={misSecuencias} etiqueta="Secuencias tuyas" />
        <Dato n={estudiantes} etiqueta="Estudiantes" />
        <Dato n={asignaciones.length} etiqueta="Asignaciones vivas" />
        <Dato n={`${progresoMedio}%`} etiqueta="Progreso medio" />
      </div>

      {misSecuencias === 0 && totalSecuencias > 0 && (
        <p className="mt-4 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          Hay {totalSecuencias} secuencias en la base, pero ninguna tiene autor
          asignado. Las sembradas antes de hoy se crearon sin ese campo.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/profe/secuencias/nueva"
          className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold leading-10 text-white transition-colors hover:bg-hp-500"
        >
          + Nueva secuencia
        </Link>
        <Link
          href="/profe/grupos"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold leading-9 text-hp-600 transition-colors hover:border-hp-400"
        >
          + Nuevo grupo ({grupos})
        </Link>
        <Link
          href="/profe/alumnos/nuevo"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold leading-9 text-hp-600 transition-colors hover:border-hp-400"
        >
          + Nuevo estudiante
        </Link>
      </div>

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Todavía no han empezado
      </h2>
      {sinEmpezar.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-8 text-center text-tinta-suave">
          {asignaciones.length === 0
            ? "No hay asignaciones vivas."
            : "Todos han empezado al menos una secuencia."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sinEmpezar.map((asignacion) => (
            <li
              key={asignacion.id}
              className="flex items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave"
            >
              <Link
                href={`/profe/alumnos/${asignacion.estudiante.id}`}
                className="truncate font-semibold text-tinta hover:text-hp-500"
              >
                {nombreDe(asignacion.estudiante)}
              </Link>
              <span className="ml-auto truncate text-sm text-tinta-suave">
                {asignacion.recorrido.titulo}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
