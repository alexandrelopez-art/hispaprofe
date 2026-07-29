import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { hacerProfesor, invitarProfesor, quitarProfesor } from "@/lib/acciones";
import type { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const rolLabel: Record<string, string> = {
  ADMIN: "Administrador",
  PROFESOR: "Profesor",
  STUDENT: "Estudiante",
};

const rolStyle: Record<string, string> = {
  ADMIN: "bg-bloque3/25 text-tinta ring-bloque3/50",
  PROFESOR: "bg-hp-100 text-hp-700 ring-hp-200",
  STUDENT: "bg-fondo text-tinta-suave ring-hp-100",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const yo = await getUsuarioActual();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const personas = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      nivel: true,
      clerkId: true,
    },
  });

  const administradores = personas.filter((p) => p.role === "ADMIN").length;

  return (
    <>
      <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        <h2 className="text-lg font-bold text-tinta">Invitar a un profesor</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Si ya tiene cuenta, se le sube el rol. Si no, se le crea la ficha y se
          la encontrará hecha al entrar por primera vez. No se envía ningún
          correo: avisarle sigue siendo cosa tuya.
        </p>
        <form action={invitarProfesor} className="mt-4 flex flex-wrap gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="correo@ejemplo.com"
            className="h-10 min-w-64 flex-1 rounded-full border border-hp-200 bg-fondo px-4 text-sm text-tinta outline-none focus:border-hp-400"
          />
          <button
            type="submit"
            className="h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
          >
            Invitar
          </button>
        </form>
      </section>

      <form className="mt-8 flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o correo"
          className="h-10 min-w-56 flex-1 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
        <button
          type="submit"
          className="h-10 rounded-full border-2 border-hp-200 px-5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
        >
          Buscar
        </button>
      </form>

      <p className="mt-4 text-sm text-tinta-suave">
        {personas.length} cuenta{personas.length !== 1 ? "s" : ""}.
      </p>

      <ul className="mt-3 space-y-2">
        {personas.map((p) => {
          const soyYo = p.id === yo?.id;
          // No se puede dejar la plataforma sin administradores, y nadie se
          // quita el rol a sí mismo.
          const puedeBajar =
            !soyYo &&
            p.role !== "STUDENT" &&
            !(p.role === "ADMIN" && administradores <= 1);

          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-tinta">
                  {nombreDe(p)}
                  {soyYo && (
                    <span className="ml-2 text-xs font-bold text-tinta-suave">
                      (tú)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-tinta-suave">
                  {p.email}
                  {p.nivel && ` · ${p.nivel}`}
                  {!p.clerkId && " · ficha sin reclamar"}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                  rolStyle[p.role] ?? "bg-fondo text-tinta ring-hp-100"
                }`}
              >
                {rolLabel[p.role] ?? p.role}
              </span>

              <div className="flex shrink-0 gap-2">
                {p.role === "STUDENT" && (
                  <form action={hacerProfesor}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full bg-hp-400 px-4 text-xs font-bold text-white transition-colors hover:bg-hp-500"
                    >
                      Hacer profesor
                    </button>
                  </form>
                )}
                {puedeBajar && (
                  <form action={quitarProfesor}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
                    >
                      Quitar rol
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-tinta-suave">
        Recuerda: quitar el rol no sirve de nada si ese correo sigue en la
        variable ADMIN_EMAILS. Volverá a ser administrador al entrar.
      </p>
    </>
  );
}
