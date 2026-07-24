import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { crearGrupo, desconectarGoogle } from "@/lib/acciones";
import { googleConfigurado } from "@/lib/google";
import { redirect } from "next/navigation";
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

const mensajes: Record<string, string> = {
  ok: "Cuenta de Google conectada.",
  cancelado: "Se canceló la conexión con Google.",
  fallo: "Google no aceptó la conexión. Prueba otra vez.",
  estado: "La vuelta de Google no cuadró. Prueba otra vez.",
  incompleto: "Google devolvió una respuesta incompleta.",
};

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { google } = await searchParams;

  const [grupos, cuenta] = await Promise.all([
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { miembros: true } } },
    }),
    prisma.cuentaGoogle.findUnique({
      where: { usuarioId: usuario.id },
      select: { email: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Grupos
      </h1>
      <p className="mt-2 text-tinta-suave">
        Un grupo permite asignar una secuencia a toda la clase de una vez.
      </p>

      {google && mensajes[google] && (
        <p
          className={`mt-4 rounded-xl px-4 py-2 text-sm ${
            google === "ok"
              ? "bg-bloque2/25 font-semibold text-tinta"
              : "bg-sol-100 text-tinta"
          }`}
        >
          {mensajes[google]}
        </p>
      )}

      {/* Conexión con Classroom: opcional, solo la usan los grupos vinculados. */}
      <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        <h2 className="text-lg font-bold text-tinta">Google Classroom</h2>

        {!googleConfigurado() ? (
          <p className="mt-2 text-sm text-tinta-suave">
            Sin configurar. Faltan las credenciales de Google en el archivo
            .env del proyecto.
          </p>
        ) : cuenta ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-tinta-suave">
              Conectado como{" "}
              <span className="font-semibold text-tinta">
                {cuenta.email ?? "tu cuenta de Google"}
              </span>
              . Ya puedes vincular un grupo con un curso desde su ficha.
            </p>
            <form action={desconectarGoogle} className="ml-auto">
              <button
                type="submit"
                className="h-9 rounded-full border border-hp-200 px-4 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
              >
                Desconectar
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-tinta-suave">
              Conecta tu cuenta para traer la lista de alumnos de un curso sin
              pegar correos a mano. Solo se lee: la plataforma nunca escribe
              nada en Classroom.
            </p>
            <a
              href="/api/google/conectar"
              className="mt-3 inline-block h-10 rounded-full bg-hp-400 px-5 text-sm font-bold leading-10 text-white transition-colors hover:bg-hp-500"
            >
              Conectar con Google Classroom
            </a>
          </div>
        )}
      </section>

      {grupos.length > 0 && (
        <ul className="mt-8 space-y-3">
          {grupos.map((grupo) => (
            <li key={grupo.id}>
              <Link
                href={`/profe/grupos/${grupo.id}`}
                className="flex items-center gap-4 rounded-tarjeta border border-hp-100 bg-white p-4 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-tinta">{grupo.nombre}</p>
                  <p className="text-sm text-tinta-suave">
                    {grupo._count.miembros} estudiante
                    {grupo._count.miembros !== 1 ? "s" : ""}
                    {grupo.classroomNombre && ` · ${grupo.classroomNombre}`}
                  </p>
                </div>
                {grupo.classroomCursoId && (
                  <span className="shrink-0 rounded-full bg-bloque2/25 px-2.5 py-0.5 text-[11px] font-bold text-tinta">
                    Classroom
                  </span>
                )}
                {grupo.nivel && (
                  <span className="shrink-0 rounded-full bg-hp-400 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {nivelLabel[grupo.nivel] ?? grupo.nivel}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Crear un grupo</h2>

      <form
        action={crearGrupo}
        className="mt-3 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
      >
        <div className="flex flex-wrap gap-3">
          <label className="min-w-56 flex-1 text-sm font-semibold text-tinta">
            Nombre
            <input
              type="text"
              name="nombre"
              required
              placeholder="DELE B2 · septiembre"
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            />
          </label>

          <label className="text-sm font-semibold text-tinta">
            Nivel
            <select
              name="nivel"
              defaultValue=""
              className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
            >
              <option value="">Sin nivel</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="A2_B1_ESCOLAR">A2/B1 escolar</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-tinta">
          Correos de los estudiantes
          <textarea
            name="correos"
            rows={5}
            placeholder="Pega aquí la lista. Separados por comas, espacios o saltos de línea."
            className="mt-1 w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 font-mono text-sm font-normal text-tinta outline-none focus:border-hp-400"
          />
        </label>
        <p className="mt-1 text-xs text-tinta-suave">
          Puedes dejarlo vacío y traer la lista desde Classroom después.
        </p>

        <button
          type="submit"
          className="mt-4 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Crear grupo
        </button>
      </form>
    </div>
  );
}
