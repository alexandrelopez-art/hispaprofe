import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import { nombreNivel } from "@/lib/niveles";
import Boton from "@/components/ui/boton";
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
      <Tarjeta href={`/profe/alumnos/${estudiante.id}`}>
        <div className="flex items-center gap-4">
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

          {!estudiante.contrasenaHash && (
            <Etiqueta tono="sol" className="shrink-0">
              Sin contraseña
            </Etiqueta>
          )}

          {estudiante.nivel && (
            <Etiqueta tono="hp" className="shrink-0">
              {nombreNivel(estudiante.nivel)}
            </Etiqueta>
          )}

          <span className="shrink-0 text-sm font-semibold text-tinta-suave">
            {estudiante.asignacionesRecibidas.length} secuencia
            {estudiante.asignacionesRecibidas.length !== 1 ? "s" : ""}
          </span>
        </div>
      </Tarjeta>
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
      <Encabezado
        titulo="Estudiantes"
        lede={
          <>
            {mios.length} tuyo{mios.length !== 1 ? "s" : ""}
            {otros.length > 0 && ` · ${otros.length} sin relación contigo`}
          </>
        }
        acciones={<Boton href="/profe/alumnos/nuevo">Nuevo estudiante</Boton>}
      />

      {mios.length === 0 ? (
        <Vacio className="mt-8">
          Todavía no tienes estudiantes. Crea un grupo con sus correos, o
          asígnale una secuencia a alguien de la lista de abajo.
        </Vacio>
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
