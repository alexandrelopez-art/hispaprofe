import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import {
  archivarAsignacion,
  asignarSecuencia,
  otorgarPuntos,
} from "@/lib/acciones";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const nivelLabel: Record<string, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  A2_B1_ESCOLAR: "A2/B1 escolar",
};

const servicioLabel: Record<string, string> = {
  RECORRIDO: "Clases particulares",
  PREPARACION: "Preparación DELE",
};

export default async function AlumnoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const estudiante = await prisma.user.findUnique({ where: { id } });
  if (!estudiante) notFound();

  const [asignaciones, secuencias] = await Promise.all([
    prisma.asignacion.findMany({
      where: { estudianteId: id, archivada: false },
      orderBy: { createdAt: "desc" },
      include: {
        recorrido: {
          select: {
            id: true,
            titulo: true,
            nivel: true,
            tipo: true,
            pasos: {
              orderBy: { orden: "asc" },
              select: { id: true, orden: true, titulo: true },
            },
          },
        },
        completados: {
          select: {
            pasoId: true,
            puntos: true,
            verificadoEl: true,
            completadoEl: true,
          },
        },
      },
    }),
    prisma.recorrido.findMany({
      orderBy: [{ tipo: "asc" }, { orden: "asc" }],
      select: { id: true, titulo: true, nivel: true, tipo: true },
    }),
  ]);

  const nombre =
    [estudiante.firstName, estudiante.lastName].filter(Boolean).join(" ") ||
    estudiante.email;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profe/alumnos"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Estudiantes
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
          {nombre}
        </h1>
        {estudiante.nivel && (
          <span className="rounded-full bg-hp-400 px-2.5 py-0.5 text-[11px] font-bold text-white">
            {nivelLabel[estudiante.nivel] ?? estudiante.nivel}
          </span>
        )}
      </div>
      <p className="mt-1 text-tinta-suave">{estudiante.email}</p>

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Secuencias asignadas
      </h2>

      {asignaciones.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-8 text-center text-tinta-suave">
          Sin secuencias asignadas todavía.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {asignaciones.map((asignacion) => {
            const total = asignacion.recorrido.pasos.length;
            const porPaso = new Map(
              asignacion.completados.map((c) => [c.pasoId, c]),
            );
            const hechos = asignacion.completados.filter(
              (c) => c.completadoEl,
            ).length;
            const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
            const puntosTotales = asignacion.completados.reduce(
              (suma, c) => suma + (c.puntos ?? 0),
              0,
            );

            return (
              <li
                key={asignacion.id}
                className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
                      {servicioLabel[asignacion.recorrido.tipo] ??
                        asignacion.recorrido.tipo}
                    </p>
                    <Link
                      href={`/recorridos/${asignacion.recorrido.id}`}
                      className="font-bold text-tinta hover:text-hp-500"
                    >
                      {asignacion.recorrido.titulo}
                    </Link>
                    {asignacion.nota && (
                      <p className="mt-1 text-sm text-tinta-suave">
                        {asignacion.nota}
                      </p>
                    )}
                  </div>

                  <form action={archivarAsignacion}>
                    <input
                      type="hidden"
                      name="asignacionId"
                      value={asignacion.id}
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full border border-hp-200 px-3 py-1 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                    >
                      Archivar
                    </button>
                  </form>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-hp-50">
                    <div
                      className="h-full rounded-full bg-bloque2"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-tinta-suave">
                    {hechos}/{total} pasos
                  </span>
                  {puntosTotales > 0 && (
                    <span className="shrink-0 rounded-full bg-sol-200 px-2.5 py-0.5 text-xs font-bold text-tinta">
                      {puntosTotales} pts
                    </span>
                  )}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
                    Ver pasos y otorgar puntos
                  </summary>
                  <ul className="mt-3 space-y-1.5">
                    {asignacion.recorrido.pasos.map((paso) => {
                      const registro = porPaso.get(paso.id);
                      return (
                        <li
                          key={paso.id}
                          className="flex items-center gap-2 rounded-lg bg-fondo px-3 py-1.5"
                        >
                          <span
                            className={`shrink-0 text-sm ${
                              registro ? "text-hp-500" : "text-hp-200"
                            }`}
                          >
                            {registro ? "✓" : "○"}
                          </span>
                          <Link
                            href={`/pasos/${paso.id}`}
                            className="min-w-0 flex-1 truncate text-sm text-tinta hover:text-hp-500"
                          >
                            {paso.orden}. {paso.titulo}
                          </Link>
                          {registro?.verificadoEl && (
                            <span
                              className="shrink-0 text-xs"
                              title="Puntos verificados por el profesor"
                            >
                              ★
                            </span>
                          )}
                          <form
                            action={otorgarPuntos}
                            className="flex shrink-0 items-center gap-1"
                          >
                            <input
                              type="hidden"
                              name="asignacionId"
                              value={asignacion.id}
                            />
                            <input
                              type="hidden"
                              name="pasoId"
                              value={paso.id}
                            />
                            <input
                              type="number"
                              name="puntos"
                              min={0}
                              defaultValue={registro?.puntos ?? ""}
                              placeholder="pts"
                              className="h-7 w-16 rounded-full border border-hp-200 bg-white px-2 text-center text-xs text-tinta outline-none focus:border-hp-400"
                            />
                            <button
                              type="submit"
                              className="h-7 rounded-full border border-hp-200 px-2 text-[11px] font-bold text-tinta-suave transition-colors hover:border-hp-400 hover:text-hp-600"
                            >
                              Guardar
                            </button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Asignar una secuencia</h2>

      <form
        action={asignarSecuencia}
        className="mt-3 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
      >
        <input type="hidden" name="estudianteId" value={estudiante.id} />

        <label className="block text-sm font-semibold text-tinta">
          Secuencia
          <select
            name="recorridoId"
            required
            defaultValue=""
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
          >
            <option value="" disabled>
              Elige una secuencia
            </option>
            {secuencias.map((secuencia) => (
              <option key={secuencia.id} value={secuencia.id}>
                {servicioLabel[secuencia.tipo] ?? secuencia.tipo} ·{" "}
                {nivelLabel[secuencia.nivel] ?? secuencia.nivel} ·{" "}
                {secuencia.titulo}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-semibold text-tinta">
          Nota para el estudiante (opcional)
          <input
            type="text"
            name="nota"
            placeholder="Por ejemplo: hazlo antes del jueves"
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <button
          type="submit"
          className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Asignar
        </button>
      </form>
    </div>
  );
}
