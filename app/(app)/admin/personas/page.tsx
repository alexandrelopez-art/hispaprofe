import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import {
  bloquearPersona,
  desbloquearPersona,
  hacerProfesor,
  invitarProfesor,
  quitarProfesor,
  suprimirPersona,
} from "@/lib/acciones-admin";
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
      bloqueadoEl: true,
      suprimidoEl: true,
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
          const bloqueado = p.bloqueadoEl !== null;
          const suprimido = p.suprimidoEl !== null;

          return (
            <li
              key={p.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave ${
                bloqueado ? "opacity-60" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-tinta">
                  {suprimido ? "Ficha suprimida" : nombreDe(p)}
                  {soyYo && (
                    <span className="ml-2 text-xs font-bold text-tinta-suave">
                      (tú)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-tinta-suave">
                  {suprimido ? "sin datos" : p.email}
                  {p.nivel && ` · ${p.nivel}`}
                  {!p.clerkId && " · ficha sin reclamar"}
                </p>
              </div>

              {bloqueado && (
                <span className="shrink-0 rounded-md bg-fondo px-2 py-0.5 text-xs font-semibold text-tinta-suave ring-1 ring-inset ring-hp-100">
                  {suprimido ? "Suprimido" : "Bloqueado"}
                </span>
              )}

              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                  rolStyle[p.role] ?? "bg-fondo text-tinta ring-hp-100"
                }`}
              >
                {rolLabel[p.role] ?? p.role}
              </span>

              <div className="flex shrink-0 gap-2">
                {/*
                  Toda lápida se queda como STUDENT a propósito, así que sin
                  el `!suprimido` este botón se le pinta encima a todas.
                */}
                {p.role === "STUDENT" && !suprimido && (
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
                {!soyYo && !suprimido && !bloqueado && (
                  <form action={bloquearPersona}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                    >
                      Bloquear
                    </button>
                  </form>
                )}
                {bloqueado && !suprimido && (
                  <form action={desbloquearPersona}>
                    <input type="hidden" name="usuarioId" value={p.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-full border-2 border-hp-200 px-4 text-xs font-bold text-hp-600 transition-colors hover:border-hp-400"
                    >
                      Desbloquear
                    </button>
                  </form>
                )}
              </div>

              {bloqueado && !suprimido && (
                <details className="w-full">
                  <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
                    Suprimir esta ficha
                  </summary>
                  <p className="mt-2 text-xs text-tinta-suave">
                    Se van su nombre, su correo, su cuenta, sus grupos, sus
                    deberes y todo su progreso. Sus clases se quedan, con sus
                    horas y su importe, como «Estudiante suprimido».{" "}
                    <strong className="text-tinta">Esto no se puede deshacer.</strong>
                  </p>
                  <form action={suprimirPersona} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="usuarioId" value={p.id} />
                    {/*
                      El único freno de la única acción irreversible no puede
                      ser, para un lector de pantalla, una caja sin nombre: el
                      placeholder no nombra el campo.
                    */}
                    <input
                      type="text"
                      name="confirmacion"
                      required
                      aria-label={`Escribe ${p.email} para confirmar la supresión`}
                      placeholder={`Escribe ${p.email} para confirmar`}
                      className="h-9 min-w-72 flex-1 rounded-full border border-hp-200 bg-fondo px-4 text-xs text-tinta outline-none focus:border-hp-400"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded-full bg-bloque3 px-4 text-xs font-bold text-tinta transition-opacity hover:opacity-80"
                    >
                      Suprimir
                    </button>
                  </form>
                </details>
              )}
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
