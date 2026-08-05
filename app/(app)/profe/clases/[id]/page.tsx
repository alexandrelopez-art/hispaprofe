import { prisma } from "@/lib/prisma";
import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
import { euros, horas, sePuedeBorrar } from "@/lib/clases";
import { fechaHora, paraInput } from "@/lib/fechas";
import {
  abrirDeberDeClase,
  borrarLaClase,
  cambiarEstadoClase,
  cerrarDeberDeClase,
  cerrarTodos,
  editarClase,
  guardarFicha,
} from "@/lib/acciones-clases";
import { estaSuprimido } from "@/lib/roles";
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
      importeAMano: true,
      estudiante: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          suprimidoEl: true,
        },
      },
      grupo: { select: { id: true, nombre: true } },
      asignados: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cerradoEl: true,
          estudiante: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              suprimidoEl: true,
            },
          },
        },
      },
    },
  });
  if (!clase) notFound();

  // Un profesor solo ve las suyas. Un administrador, todas.
  if (clase.profesorId !== usuario.id && usuario.role !== "ADMIN") notFound();

  const [estudiantes, grupos, citas] = await Promise.all([
    listarEstudiantesElegibles({
      // `suprimidoEl` viaja aunque la lista nunca traiga lápidas: abajo se le
      // añade el destinatario de esta clase, que sí puede serlo.
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        suprimidoEl: true,
      },
    }),
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    prisma.citaOral.findMany({
      where: { claseId: clase.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        pasoId: true,
        asignacion: {
          select: {
            estudianteId: true,
            estudiante: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                suprimidoEl: true,
              },
            },
          },
        },
      },
    }),
  ]);

  /*
   * `CitaOral` no tiene relación con `Paso`: guarda su id a secas, porque un
   * paso no es dueño de la cita y darle una relación obligaría a decidir qué
   * pasa al borrar un paso que tiene orales citados. Así que el título se lee
   * aparte, y por eso `tituloDe` puede no encontrar un paso ya borrado: la
   * cita huérfana se pinta igual, con el nombre del alumno.
   */
  const pasosCitados = citas.length
    ? await prisma.paso.findMany({
        where: { id: { in: citas.map((c) => c.pasoId) } },
        select: { id: true, titulo: true, recorrido: { select: { titulo: true } } },
      })
    : [];
  const tituloDe = new Map(pasosCitados.map((p) => [p.id, p]));

  const destinatarioActual = clase.estudiante
    ? `alumno:${clase.estudiante.id}`
    : clase.grupo
      ? `grupo:${clase.grupo.id}`
      : "";

  /**
   * El destinatario de esta clase entra en la lista aunque las consultas no
   * lo traigan: dejó de ser STUDENT, o es el grupo de otro profesor y lo está
   * mirando un admin. Sin una opción que coincida con `defaultValue`, el
   * navegador preselecciona la primera y guardar cualquier otro campo
   * reasignaría la clase a un desconocido.
   */
  const suEstudiante = clase.estudiante;
  const suGrupo = clase.grupo;
  const opcionesEstudiantes =
    suEstudiante && !estudiantes.some((e) => e.id === suEstudiante.id)
      ? [suEstudiante, ...estudiantes]
      : estudiantes;
  const opcionesGrupos =
    suGrupo && !grupos.some((g) => g.id === suGrupo.id)
      ? [suGrupo, ...grupos]
      : grupos;

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
          ? estaSuprimido(clase.estudiante)
            ? "Estudiante suprimido"
            : nombreDe(clase.estudiante)
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
          Esta clase no tiene importe: todavía no hay ningún sitio donde
          escribir una tarifa por hora. El precio se congela al marcarla dada,
          así que cuando haya tarifas podrás volver a agendarla y marcarla dada
          otra vez para ponerle el suyo.
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
          Deberes (los ve en su tablero quien está en la clase)
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
                  {sinCerrar === 1
                    ? "Cerrar el que queda"
                    : `Cerrar los ${sinCerrar} que quedan`}
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
                  {estaSuprimido(d.estudiante)
                    ? "Estudiante suprimido"
                    : nombreDe(d.estudiante)}
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

      {citas.length > 0 && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
            Orales citados en esta clase
          </p>
          <ul className="mt-3 space-y-2">
            {citas.map((c) => {
              const paso = tituloDe.get(c.pasoId);
              const alumno = c.asignacion.estudiante;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm text-tinta">
                    <strong>
                      {estaSuprimido(alumno)
                        ? "Estudiante suprimido"
                        : nombreDe(alumno)}
                    </strong>
                    {paso ? ` · ${paso.recorrido.titulo} · ${paso.titulo}` : ""}
                  </span>
                  <Link
                    href={`/profe/alumnos/${c.asignacion.estudianteId}`}
                    className="shrink-0 text-xs font-semibold text-tinta-suave underline hover:text-hp-500"
                  >
                    Evaluar
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
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
            {opcionesEstudiantes.length > 0 && (
              <optgroup label="Estudiantes">
                {opcionesEstudiantes.map((e) => (
                  <option key={e.id} value={`alumno:${e.id}`}>
                    {estaSuprimido(e) ? "Estudiante suprimido" : nombreDe(e)}
                  </option>
                ))}
              </optgroup>
            )}
            {opcionesGrupos.length > 0 && (
              <optgroup label="Grupos">
                {opcionesGrupos.map((g) => (
                  <option key={g.id} value={`grupo:${g.id}`}>
                    {g.nombre}
                  </option>
                ))}
              </optgroup>
            )}
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

        <label className="block text-sm font-semibold text-tinta">
          Precio
          {/* El navegador para el envío antes de que salga de aquí, y enseña
              el `title`. Sin esto, un precio mal escrito hacía que la acción
              volviera sin guardar **nada** —ni el sitio, ni el enlace, ni las
              notas— y sin decir por qué: el motivo que calcula
              `interpretarPrecio` no tiene por dónde llegar a la pantalla,
              porque este formulario llama a la acción directamente y no
              recoge nada de vuelta. La comprobación del servidor se queda
              igual: esta es comodidad, no la guarda de verdad. */}
          <input
            type="text"
            name="precio"
            inputMode="decimal"
            pattern="\s*\d+([.,]\d{1,2})?\s*€?\s*"
            title="Escribe el precio en euros, con dos decimales como mucho. Por ejemplo: 30,50"
            defaultValue={
              clase.importeAMano && clase.importeCentimos !== null
                ? (clase.importeCentimos / 100).toLocaleString("es-ES", {
                    minimumFractionDigits: 2,
                  })
                : ""
            }
            placeholder="Automático, según la tarifa"
            className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-fondo px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            Déjalo vacío para cobrar lo que diga la tarifa por hora.
          </span>
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

      {sePuedeBorrar(clase.estado) && (
        <details className="mt-10">
          <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
            Borrar esta clase
          </summary>
          <p className="mt-2 text-sm text-tinta-suave">
            Desaparece del todo, con sus deberes. Si lo que quieres es dejar
            constancia de que se cayó, anúlala en vez de borrarla.
          </p>
          <form action={borrarLaClase} className="mt-3">
            <input type="hidden" name="claseId" value={clase.id} />
            <button
              type="submit"
              className="h-9 rounded-full bg-bloque3 px-4 text-xs font-bold text-tinta transition-opacity hover:opacity-80"
            >
              Borrar la clase
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
