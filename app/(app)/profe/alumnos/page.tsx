import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
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

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

type Estudiante = Awaited<ReturnType<typeof cargarEstudiantes>>[number];

async function cargarEstudiantes() {
  return listarEstudiantesElegibles({
    include: {
      asignacionesRecibidas: {
        where: { archivada: false },
        select: { id: true, profesorId: true },
      },
      membresias: {
        select: {
          grupo: { select: { id: true, nombre: true, profesorId: true } },
        },
      },
    },
  });
}

function Ficha({ estudiante }: { estudiante: Estudiante }) {
  const grupos = estudiante.membresias.map((m) => m.grupo);

  return (
    <li>
      <Link
        href={`/profe/alumnos/${estudiante.id}`}
        className="flex items-center gap-4 rounded-tarjeta border border-hp-100 bg-white p-4 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hp-100 text-sm font-extrabold text-hp-700">
          {nombreDe(estudiante).slice(0, 1).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-tinta">
            {nombreDe(estudiante)}
          </p>
          <p className="truncate text-sm text-tinta-suave">
            {estudiante.email}
          </p>
          {grupos.length > 0 && (
            <p className="mt-1 truncate text-xs font-semibold text-tinta-suave">
              {grupos.map((g) => g.nombre).join(" · ")}
            </p>
          )}
        </div>

        {!estudiante.clerkId && (
          <span className="shrink-0 rounded-full bg-sol-200 px-2.5 py-0.5 text-[11px] font-bold text-tinta">
            Sin cuenta
          </span>
        )}

        {estudiante.nivel && (
          <span className="shrink-0 rounded-full bg-hp-400 px-2.5 py-0.5 text-[11px] font-bold text-white">
            {nivelLabel[estudiante.nivel] ?? estudiante.nivel}
          </span>
        )}

        <span className="shrink-0 text-sm font-semibold text-tinta-suave">
          {estudiante.asignacionesRecibidas.length} secuencia
          {estudiante.asignacionesRecibidas.length !== 1 ? "s" : ""}
        </span>
      </Link>
    </li>
  );
}

export default async function AlumnosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const estudiantes = await cargarEstudiantes();

  // Un estudiante es tuyo si está en uno de tus grupos o si le has
  // asignado algo. No hace falta declararlo en ningún sitio más.
  const esMio = (e: Estudiante) =>
    e.membresias.some((m) => m.grupo.profesorId === usuario.id) ||
    e.asignacionesRecibidas.some((a) => a.profesorId === usuario.id);

  const mios = estudiantes.filter(esMio);
  const otros = estudiantes.filter((e) => !esMio(e));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Estudiantes
      </h1>
      <p className="mt-2 text-tinta-suave">
        {mios.length} tuyo{mios.length !== 1 ? "s" : ""}
        {otros.length > 0 && ` · ${otros.length} sin relación contigo`}
      </p>

      {mios.length === 0 ? (
        <p className="mt-8 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          Todavía no tienes estudiantes. Crea un grupo con sus correos, o
          asígnale una secuencia a alguien de la lista de abajo.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {mios.map((estudiante) => (
            <Ficha key={estudiante.id} estudiante={estudiante} />
          ))}
        </ul>
      )}

      {otros.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-bold text-tinta">
            Otros estudiantes
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Registrados en la plataforma, pero sin grupo ni secuencia tuya. Se
            vuelven tuyos en cuanto les asignas algo.
          </p>
          <ul className="mt-4 space-y-3 opacity-75">
            {otros.map((estudiante) => (
              <Ficha key={estudiante.id} estudiante={estudiante} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
