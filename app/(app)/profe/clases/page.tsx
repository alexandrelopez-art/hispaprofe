import { prisma } from "@/lib/prisma";
import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
import { euros, horas, listarClases, totalesDeClases } from "@/lib/clases";
import type { FiltroClases } from "@/lib/clases";
import { estaSuprimido } from "@/lib/roles";
import { deInput, fechaHora } from "@/lib/fechas";
import { crearClase } from "@/lib/acciones-clases";
import type { EstadoClase } from "@/lib/generated/prisma/enums";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const estadoLabel: Record<string, string> = {
  AGENDADA: "Agendada",
  DADA: "Dada",
  ANULADA: "Anulada",
};

const estadoStyle: Record<string, string> = {
  AGENDADA: "bg-hp-100 text-hp-700 ring-hp-200",
  DADA: "bg-bloque2/25 text-tinta ring-bloque2/50",
  ANULADA: "bg-fondo text-tinta-suave ring-hp-100",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

/**
 * Una fecha del filtro. Vacía o ilegible es «sin filtro», no un error.
 *
 * `finDeDia` es imprescindible en «hasta»: un <input type="date"> da
 * «2026-08-05», y tomarlo como medianoche dejaría fuera la clase de ese
 * mismo día a las seis de la tarde. «Hasta el 5» significa el 5 incluido.
 *
 * Los dos extremos se leen como horas de Madrid con `deInput`: en un servidor
 * en UTC, «hasta el 5» a medianoche del host colaría las clases de madrugada
 * del día siguiente.
 */
function fechaDeTexto(bruto?: string, finDeDia = false): Date | undefined {
  if (!bruto) return undefined;
  return deInput(`${bruto}T${finDeDia ? "23:59" : "00:00"}`) ?? undefined;
}

/**
 * El estado del filtro, acotado a los tres que existen. Un `?estado=FOO`
 * escrito a mano llegaría a Prisma y reventaría la página con un 500.
 */
function estadoDeTexto(bruto?: string): EstadoClase | undefined {
  return bruto === "AGENDADA" || bruto === "DADA" || bruto === "ANULADA"
    ? bruto
    : undefined;
}

function Total({ n, etiqueta }: { n: string; etiqueta: string }) {
  return (
    <div className="rounded-tarjeta border border-hp-100 bg-white p-4 shadow-suave">
      <p className="text-2xl font-extrabold text-tinta">{n}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-tinta-suave">
        {etiqueta}
      </p>
    </div>
  );
}

export default async function ClasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    quien?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    cobrada?: string;
  }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const q = await searchParams;

  const [tipo, id] = (q.quien ?? "").split(":");
  const filtro: FiltroClases = {
    profesorId: usuario.id,
    estudianteId: tipo === "alumno" ? id : undefined,
    grupoId: tipo === "grupo" ? id : undefined,
    desde: fechaDeTexto(q.desde),
    hasta: fechaDeTexto(q.hasta, true),
    estado: estadoDeTexto(q.estado),
    cobrada: q.cobrada === "si" ? true : q.cobrada === "no" ? false : undefined,
  };

  const [clases, totales, estudiantes, grupos] = await Promise.all([
    listarClases(filtro),
    totalesDeClases(filtro),
    listarEstudiantesElegibles({
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Clases
      </h1>

      <details className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        <summary className="cursor-pointer text-lg font-bold text-tinta">
          Registrar una clase
        </summary>

        <form action={crearClase} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-tinta">
            Día y hora
            <input
              type="datetime-local"
              name="empiezaEl"
              required
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <label className="block text-sm font-semibold text-tinta">
            Duración (minutos)
            <input
              type="number"
              name="minutos"
              min={1}
              defaultValue={60}
              required
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <label className="block text-sm font-semibold text-tinta">
            Con quién
            <select
              name="destinatario"
              required
              defaultValue=""
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            >
              <option value="" disabled>
                Elige un estudiante o un grupo
              </option>
              {estudiantes.map((e) => (
                <option key={e.id} value={`alumno:${e.id}`}>
                  {nombreDe(e)}
                </option>
              ))}
              {grupos.map((g) => (
                <option key={g.id} value={`grupo:${g.id}`}>
                  Grupo · {g.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-tinta">
            Dónde (opcional)
            <input
              type="text"
              name="donde"
              placeholder="en su casa, aula 2..."
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <label className="block text-sm font-semibold text-tinta sm:col-span-2">
            Enlace de conexión (opcional)
            <input
              type="url"
              name="enlace"
              placeholder="https://meet.google.com/..."
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <button
            type="submit"
            className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500 sm:col-span-2 sm:justify-self-start"
          >
            Registrar
          </button>
        </form>
      </details>

      <form className="mt-8 grid gap-3 sm:grid-cols-5">
        <select
          name="quien"
          defaultValue={q.quien ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        >
          <option value="">Todo el mundo</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={`alumno:${e.id}`}>
              {nombreDe(e)}
            </option>
          ))}
          {grupos.map((g) => (
            <option key={g.id} value={`grupo:${g.id}`}>
              Grupo · {g.nombre}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="desde"
          defaultValue={q.desde ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={q.hasta ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />

        <select
          name="estado"
          defaultValue={q.estado ?? ""}
          className="h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        >
          <option value="">Cualquier estado</option>
          <option value="AGENDADA">Agendadas</option>
          <option value="DADA">Dadas</option>
          <option value="ANULADA">Anuladas</option>
        </select>

        <button
          type="submit"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
        >
          Filtrar
        </button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Total n={horas(totales.minutos)} etiqueta="Horas dadas" />
        <Total n={String(totales.cuantas)} etiqueta="Clases dadas" />
        <Total n={euros(totales.totalCentimos)} etiqueta="Total" />
        <Total n={euros(totales.pendienteCentimos)} etiqueta="Pendiente" />
      </div>

      {totales.sinTarifa > 0 && (
        <p className="mt-4 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          {totales.sinTarifa} clase{totales.sinTarifa !== 1 ? "s" : ""} dada
          {totales.sinTarifa !== 1 ? "s" : ""} sin importe. Le falta la tarifa
          por hora a quien {totales.sinTarifa !== 1 ? "las" : "la"} recibió.
        </p>
      )}

      {clases.length === 0 ? (
        <p className="mt-6 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          No hay clases con esos filtros.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {clases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/profe/clases/${c.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">
                    {c.estudiante
                      ? estaSuprimido(c.estudiante)
                        ? "Estudiante suprimido"
                        : nombreDe(c.estudiante)
                      : `Grupo · ${c.grupo?.nombre ?? "sin grupo"}`}
                  </p>
                  <p className="truncate text-xs text-tinta-suave">
                    {fechaHora(c.empiezaEl)} · {horas(c.minutos)}
                    {c.donde && ` · ${c.donde}`}
                  </p>
                </div>

                {c._count.asignados > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-tinta-suave">
                    {c._count.asignados} deber
                    {c._count.asignados !== 1 ? "es" : ""}
                  </span>
                )}

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                    estadoStyle[c.estado] ?? "bg-fondo text-tinta ring-hp-100"
                  }`}
                >
                  {estadoLabel[c.estado] ?? c.estado}
                </span>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${
                    c.estado === "DADA" && c.importeCentimos === null
                      ? "bg-sol-200 text-tinta"
                      : "text-tinta-suave"
                  }`}
                >
                  {euros(c.importeCentimos)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
