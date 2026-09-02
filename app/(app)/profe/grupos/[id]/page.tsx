import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import {
  anadirCorreosAGrupo,
  asignarSecuenciaAGrupo,
  desvincularGrupo,
  quitarDeGrupo,
  sincronizarGrupo,
  vincularGrupoConCurso,
} from "@/lib/acciones";
import { googleConfigurado, listarCursos } from "@/lib/google";
import type { CursoClassroom } from "@/lib/google";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { servicioLabel } from "@/lib/servicios";

export const dynamic = "force-dynamic";

const nivelLabel: Record<string, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  A2_B1_ESCOLAR: "A2/B1 escolar",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function GrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const grupo = await prisma.grupo.findUnique({
    where: { id },
    include: {
      miembros: {
        orderBy: { createdAt: "asc" },
        include: {
          estudiante: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              contrasenaHash: true,
            },
          },
        },
      },
    },
  });

  if (!grupo) notFound();

  const secuencias = await prisma.recorrido.findMany({
    orderBy: [{ tipo: "asc" }, { orden: "asc" }],
    select: { id: true, titulo: true, nivel: true, tipo: true },
  });

  // Cursos de Classroom, solo si hay cuenta conectada y el grupo aún no
  // está vinculado. Si Google falla, la página sigue funcionando igual.
  const cuenta = googleConfigurado()
    ? await prisma.cuentaGoogle.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      })
    : null;

  let cursos: CursoClassroom[] = [];
  let falloClassroom = "";

  if (cuenta && !grupo.classroomCursoId) {
    try {
      cursos = await listarCursos(usuario.id);
    } catch (e) {
      falloClassroom =
        e instanceof Error && e.message === "SIN_CUENTA"
          ? "La conexión con Google caducó. Vuelve a conectarla desde la lista de grupos."
          : "No pude leer tus cursos de Classroom ahora mismo.";
    }
  }

  const sinContrasena = grupo.miembros.filter((m) => !m.estudiante.contrasenaHash).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profe/grupos"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Grupos
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
          {grupo.nombre}
        </h1>
        {grupo.nivel && (
          <span className="rounded-full bg-hp-400 px-2.5 py-0.5 text-[11px] font-bold text-white">
            {nivelLabel[grupo.nivel] ?? grupo.nivel}
          </span>
        )}
      </div>
      <p className="mt-1 text-tinta-suave">
        {grupo.miembros.length} estudiante
        {grupo.miembros.length !== 1 ? "s" : ""}
        {sinContrasena > 0 && ` · ${sinContrasena} sin contraseña`}
      </p>

      {grupo.miembros.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold text-tinta">Miembros</h2>
          <ul className="mt-3 space-y-2">
            {grupo.miembros.map((miembro) => (
              <li
                key={miembro.id}
                className="flex items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profe/alumnos/${miembro.estudiante.id}`}
                    className="truncate font-semibold text-tinta hover:text-hp-500"
                  >
                    {nombreDe(miembro.estudiante)}
                  </Link>
                  <p className="truncate text-xs text-tinta-suave">
                    {miembro.estudiante.email}
                  </p>
                </div>

                {!miembro.estudiante.contrasenaHash && (
                  <span className="shrink-0 rounded-full bg-sol-200 px-2.5 py-0.5 text-[11px] font-bold text-tinta">
                    Sin contraseña
                  </span>
                )}

                <form action={quitarDeGrupo}>
                  <input type="hidden" name="miembroId" value={miembro.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full border border-hp-200 px-3 py-1 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                  >
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      {googleConfigurado() && (
        <section className="mt-10 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
          <h2 className="text-lg font-bold text-tinta">Google Classroom</h2>

          {!cuenta ? (
            <p className="mt-2 text-sm text-tinta-suave">
              Conecta tu cuenta desde{" "}
              <Link
                href="/profe/grupos"
                className="font-semibold text-hp-600 hover:text-hp-500"
              >
                la lista de grupos
              </Link>{" "}
              para traer la lista de alumnos de un curso.
            </p>
          ) : grupo.classroomCursoId ? (
            <div className="mt-2">
              <p className="text-sm text-tinta-suave">
                Vinculado con{" "}
                <span className="font-semibold text-tinta">
                  {grupo.classroomNombre ?? "un curso de Classroom"}
                </span>
                {grupo.sincronizadoEl && (
                  <>
                    {" "}
                    · última sincronización el{" "}
                    {grupo.sincronizadoEl.toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </>
                )}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <form action={sincronizarGrupo}>
                  <input type="hidden" name="grupoId" value={grupo.id} />
                  <button
                    type="submit"
                    className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
                  >
                    Sincronizar ahora
                  </button>
                </form>

                <form action={desvincularGrupo}>
                  <input type="hidden" name="grupoId" value={grupo.id} />
                  <button
                    type="submit"
                    className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                  >
                    Desvincular
                  </button>
                </form>
              </div>

              <p className="mt-3 text-xs text-tinta-suave">
                Sincronizar trae a los alumnos nuevos. A quien salga del curso
                no se le quita del grupo: conserva su progreso y sus puntos.
              </p>
            </div>
          ) : falloClassroom ? (
            <p className="mt-2 rounded-xl bg-sol-100 px-4 py-2 text-sm text-tinta">
              {falloClassroom}
            </p>
          ) : cursos.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">
              No encontré cursos activos donde figures como profesor.
            </p>
          ) : (
            <form action={vincularGrupoConCurso} className="mt-3">
              <input type="hidden" name="grupoId" value={grupo.id} />

              <label className="block text-sm font-semibold text-tinta">
                Curso
                <select
                  name="cursoId"
                  required
                  defaultValue=""
                  className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                >
                  <option value="" disabled>
                    Elige un curso
                  </option>
                  {cursos.map((curso) => (
                    <option key={curso.id} value={curso.id}>
                      {curso.name}
                      {curso.section ? ` · ${curso.section}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="mt-4 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
              >
                Vincular y traer la lista
              </button>
            </form>
          )}
        </section>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Añadir estudiantes</h2>
      <form
        action={anadirCorreosAGrupo}
        className="mt-3 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
      >
        <input type="hidden" name="grupoId" value={grupo.id} />
        <textarea
          name="correos"
          rows={3}
          required
          placeholder="Pega más correos aquí"
          className="w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 font-mono text-sm text-tinta outline-none focus:border-hp-400"
        />
        <button
          type="submit"
          className="mt-3 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Añadir al grupo
        </button>
      </form>

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Asignar una secuencia al grupo
      </h2>
      {grupo.miembros.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-8 text-center text-tinta-suave">
          Añade estudiantes antes de asignar.
        </p>
      ) : (
        <form
          action={asignarSecuenciaAGrupo}
          className="mt-3 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
        >
          <input type="hidden" name="grupoId" value={grupo.id} />

          <label className="block text-sm font-semibold text-tinta">
            Secuencia
            <select
              name="recorridoId"
              required
              defaultValue=""
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
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

          <input
            type="text"
            name="nota"
            placeholder="Nota para el grupo (opcional)"
            className="mt-4 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
          />

          <button
            type="submit"
            className="mt-4 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
          >
            Asignar a los {grupo.miembros.length}
          </button>
        </form>
      )}
    </div>
  );
}
