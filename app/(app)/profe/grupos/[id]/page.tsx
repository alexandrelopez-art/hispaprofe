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
import { nombreNivel } from "@/lib/niveles";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
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
      <Encabezado
        titulo={grupo.nombre}
        volver={{ href: "/profe/grupos", texto: "Grupos" }}
        acciones={grupo.nivel && <Etiqueta tono="hp">{nombreNivel(grupo.nivel)}</Etiqueta>}
      />

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
                  <Etiqueta tono="sol" className="shrink-0">
                    Sin contraseña
                  </Etiqueta>
                )}

                <form action={quitarDeGrupo}>
                  <input type="hidden" name="miembroId" value={miembro.id} />
                  <BotonEnviar
                    gerundio="Quitando…"
                    variante="peligro"
                    tamano="pequeno"
                    className="shrink-0"
                  >
                    Quitar
                  </BotonEnviar>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      {googleConfigurado() && (
        <Tarjeta titulo="Google Classroom" className="mt-10">
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
                  <BotonEnviar gerundio="Sincronizando…">
                    Sincronizar ahora
                  </BotonEnviar>
                </form>

                <form action={desvincularGrupo}>
                  <input type="hidden" name="grupoId" value={grupo.id} />
                  <BotonEnviar gerundio="Desvinculando…" variante="sutil">
                    Desvincular
                  </BotonEnviar>
                </form>
              </div>

              <p className="mt-3 text-xs text-tinta-suave">
                Sincronizar trae a los alumnos nuevos. A quien salga del curso
                no se le quita del grupo: conserva su progreso y sus puntos.
              </p>
            </div>
          ) : falloClassroom ? (
            <Aviso tono="error" className="mt-2">
              {falloClassroom}
            </Aviso>
          ) : cursos.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">
              No encontré cursos activos donde figures como profesor.
            </p>
          ) : (
            <form action={vincularGrupoConCurso} className="mt-3">
              <input type="hidden" name="grupoId" value={grupo.id} />

              <Campo
                etiqueta="Curso"
                name="cursoId"
                tipo="elegir"
                required
                defaultValue=""
                opciones={[
                  { valor: "", nombre: "Elige un curso", deshabilitada: true },
                  ...cursos.map((curso) => ({
                    valor: curso.id,
                    nombre: `${curso.name}${curso.section ? ` · ${curso.section}` : ""}`,
                  })),
                ]}
              />

              <BotonEnviar gerundio="Vinculando…" className="mt-4">
                Vincular y traer la lista
              </BotonEnviar>
            </form>
          )}
        </Tarjeta>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Añadir estudiantes</h2>
      <Tarjeta className="mt-3">
        <form action={anadirCorreosAGrupo}>
          <input type="hidden" name="grupoId" value={grupo.id} />
          {/* Antes solo tenía placeholder; la etiqueta «Correos» es nueva,
              para que un lector de pantalla tenga nombre, igual que «Nota». */}
          <Campo
            etiqueta="Correos"
            name="correos"
            tipo="area"
            rows={3}
            required
            placeholder="Pega más correos aquí"
          />
          <BotonEnviar gerundio="Añadiendo…" className="mt-3">
            Añadir al grupo
          </BotonEnviar>
        </form>
      </Tarjeta>

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Asignar una secuencia al grupo
      </h2>
      {grupo.miembros.length === 0 ? (
        <Vacio className="mt-3">Añade estudiantes antes de asignar.</Vacio>
      ) : (
        <Tarjeta className="mt-3">
          <form action={asignarSecuenciaAGrupo}>
            <input type="hidden" name="grupoId" value={grupo.id} />

            <Campo
              etiqueta="Secuencia"
              name="recorridoId"
              tipo="elegir"
              required
              defaultValue=""
              opciones={[
                { valor: "", nombre: "Elige una secuencia", deshabilitada: true },
                ...secuencias.map((secuencia) => ({
                  valor: secuencia.id,
                  nombre: `${servicioLabel[secuencia.tipo] ?? secuencia.tipo} · ${nombreNivel(secuencia.nivel)} · ${secuencia.titulo}`,
                })),
              ]}
            />

            <Campo
              etiqueta="Nota"
              name="nota"
              tipo="texto"
              placeholder="Nota para el grupo (opcional)"
              className="mt-4"
            />

            <BotonEnviar gerundio="Asignando…" className="mt-4">
              Asignar a los {grupo.miembros.length}
            </BotonEnviar>
          </form>
        </Tarjeta>
      )}
    </div>
  );
}
