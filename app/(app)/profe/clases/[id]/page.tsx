import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { euros, horas } from "@/lib/clases";
import { fechaHora, paraInput } from "@/lib/fechas";
import {
  abrirDeberDeClase,
  cambiarEstadoClase,
  cerrarDeberDeClase,
  cerrarTodos,
  editarClase,
  guardarFicha,
} from "@/lib/acciones-clases";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const estadoLabel: Record<string, string> = {
  AGENDADA: "Agendada",
  DADA: "Dada",
  ANULADA: "Anulada",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function ClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const clase = await prisma.clase.findUnique({
    where: { id },
    select: {
      id: true,
      profesorId: true,
      empiezaEl: true,
      minutos: true,
      estado: true,
      donde: true,
      enlace: true,
      notas: true,
      deberes: true,
      importeCentimos: true,
      estudiante: { select: { id: true, firstName: true, lastName: true, email: true } },
      grupo: { select: { id: true, nombre: true } },
      asignados: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cerradoEl: true,
          estudiante: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });
  if (!clase) notFound();

  // Un profesor solo ve las suyas. Un administrador, todas.
  if (clase.profesorId !== usuario.id && usuario.role !== "ADMIN") notFound();

  const [estudiantes, grupos] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: [{ firstName: "asc" }, { email: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const destinatarioActual = clase.estudiante
    ? `alumno:${clase.estudiante.id}`
    : clase.grupo
      ? `grupo:${clase.grupo.id}`
      : "";

  const sinCerrar = clase.asignados.filter((d) => !d.cerradoEl).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profe/clases"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Clases
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        {clase.estudiante
          ? nombreDe(clase.estudiante)
          : `Grupo · ${clase.grupo?.nombre ?? "sin grupo"}`}
      </h1>
      <p className="mt-1 text-tinta-suave">
        {fechaHora(clase.empiezaEl)} · {horas(clase.minutos)} ·{" "}
        {estadoLabel[clase.estado] ?? clase.estado}
        {clase.estado === "DADA" && ` · ${euros(clase.importeCentimos)}`}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["AGENDADA", "DADA", "ANULADA"] as const)
          .filter((e) => e !== clase.estado)
          .map((estado) => (
            <form action={cambiarEstadoClase} key={estado}>
              <input type="hidden" name="claseId" value={clase.id} />
              <input type="hidden" name="estado" value={estado} />
              <button
                type="submit"
                className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
              >
                {estado === "DADA"
                  ? "Marcar como dada"
                  : estado === "ANULADA"
                    ? "Anular"
                    : "Volver a agendar"}
              </button>
            </form>
          ))}
      </div>

      {clase.estado === "DADA" && clase.importeCentimos === null && (
        <p className="mt-4 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
          Esta clase no tiene importe: a quien la recibió le falta la tarifa por
          hora. Ponla en su ficha y vuelve a marcar la clase como dada.
        </p>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Registro y deberes
      </h2>

      <form
        action={guardarFicha}
        className="mt-3 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
      >
        <input type="hidden" name="claseId" value={clase.id} />

        <label className="block text-sm font-semibold text-tinta">
          Registro académico (solo lo ves tú)
          <textarea
            name="notas"
            rows={5}
            defaultValue={clase.notas ?? ""}
            placeholder="Qué se trabajó, qué le cuesta, por dónde seguir..."
            className="mt-1 w-full rounded-xl border border-hp-200 bg-fondo px-4 py-3 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-tinta">
          Deberes (los ve el estudiante en su tablero)
          <textarea
            name="deberes"
            rows={3}
            defaultValue={clase.deberes ?? ""}
            placeholder="Ejercicios 3 y 4 de la página 12."
            className="mt-1 w-full rounded-xl border border-hp-200 bg-fondo px-4 py-3 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <button
          type="submit"
          className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Guardar
        </button>
      </form>

      {clase.asignados.length > 0 && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-tinta">
              Quién los tiene pendientes
            </h2>
            {sinCerrar > 0 && (
              <form action={cerrarTodos}>
                <input type="hidden" name="claseId" value={clase.id} />
                <button
                  type="submit"
                  className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
                >
                  Cerrar los {sinCerrar} que quedan
                </button>
              </form>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {clase.asignados.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">
                  {nombreDe(d.estudiante)}
                </span>

                {d.cerradoEl ? (
                  <>
                    <span className="shrink-0 text-xs font-semibold text-tinta-suave">
                      hecho
                    </span>
                    <form action={abrirDeberDeClase}>
                      <input type="hidden" name="claseId" value={clase.id} />
                      <input type="hidden" name="deberId" value={d.id} />
                      <button
                        type="submit"
                        className="h-8 rounded-full border border-hp-200 px-3 text-[11px] font-bold text-tinta-suave transition-colors hover:border-hp-400"
                      >
                        Reabrir
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={cerrarDeberDeClase}>
                    <input type="hidden" name="claseId" value={clase.id} />
                    <input type="hidden" name="deberId" value={d.id} />
                    <button
                      type="submit"
                      className="h-8 rounded-full bg-hp-400 px-4 text-[11px] font-bold text-white transition-colors hover:bg-hp-500"
                    >
                      Dar por hecho
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Cambiar los datos</h2>

      <form
        action={editarClase}
        className="mt-3 grid gap-4 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave sm:grid-cols-2"
      >
        <input type="hidden" name="claseId" value={clase.id} />

        <label className="block text-sm font-semibold text-tinta">
          Día y hora
          <input
            type="datetime-local"
            name="empiezaEl"
            required
            defaultValue={paraInput(clase.empiezaEl)}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="block text-sm font-semibold text-tinta">
          Duración (minutos)
          <input
            type="number"
            name="minutos"
            min={1}
            required
            defaultValue={clase.minutos}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="block text-sm font-semibold text-tinta">
          Con quién
          <select
            name="destinatario"
            required
            defaultValue={destinatarioActual}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          >
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
          Dónde
          <input
            type="text"
            name="donde"
            defaultValue={clase.donde ?? ""}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <label className="block text-sm font-semibold text-tinta sm:col-span-2">
          Enlace de conexión
          <input
            type="url"
            name="enlace"
            defaultValue={clase.enlace ?? ""}
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>

        <button
          type="submit"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400 sm:col-span-2 sm:justify-self-start"
        >
          Guardar los cambios
        </button>
      </form>

      <p className="mt-6 text-xs text-tinta-suave">
        Cambiar con quién es la clase rehace sus deberes: se crean los de quien
        entra y se borran los de quien sale. Los que ya diste por hechos de
        quien sigue se quedan hechos.
      </p>
    </div>
  );
}
