import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Boton from "@/components/ui/boton";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";
import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { nombreNivel } from "@/lib/niveles";

type Usuario = { id: string; firstName: string | null; email: string };

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function ClasesProfesor({ usuario }: { usuario: Usuario }) {
  const [misSecuencias, asignaciones, grupos, estudiantes] = await Promise.all([
    prisma.recorrido.count({ where: { autorId: usuario.id } }),
    prisma.asignacion.findMany({
      where: { archivada: false },
      include: {
        estudiante: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        recorrido: {
          select: { titulo: true, _count: { select: { pasos: true } } },
        },
        _count: { select: { completados: true } },
      },
    }),
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, _count: { select: { miembros: true } } },
    }),
    listarEstudiantesElegibles({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        nivel: true,
        // Un grupo archivado no cuenta: quien solo estaba en uno, vuelve a ser particular.
        membresias: { where: { grupo: { archivado: false } }, select: { grupoId: true } },
      },
    }),
  ]);

  const pasosTotales = asignaciones.reduce(
    (suma, a) => suma + a.recorrido._count.pasos,
    0,
  );
  const pasosHechos = asignaciones.reduce(
    (suma, a) => suma + a._count.completados,
    0,
  );
  const progresoMedio =
    pasosTotales > 0 ? Math.round((pasosHechos / pasosTotales) * 100) : 0;

  const sinEmpezar = asignaciones.filter((a) => a._count.completados === 0);

  // Particular = estudiante que no está en ningún grupo. Es la definición que
  // dio el profesor el 2 sept: secundaria va por grupos; los particulares, sueltos.
  const particulares = estudiantes.filter((e) => e.membresias.length === 0);

  return (
    <>
      <Encabezado
        titulo="Mis clases"
        lede="Tus grupos de secundaria, tus estudiantes particulares y cómo van."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Tarjeta>
          <p className="text-3xl font-extrabold text-tinta">{misSecuencias}</p>
          <Rotulo className="mt-1">Secuencias tuyas</Rotulo>
        </Tarjeta>
        <Tarjeta>
          <p className="text-3xl font-extrabold text-tinta">{estudiantes.length}</p>
          <Rotulo className="mt-1">Estudiantes</Rotulo>
        </Tarjeta>
        <Tarjeta>
          <p className="text-3xl font-extrabold text-tinta">{asignaciones.length}</p>
          <Rotulo className="mt-1">Asignaciones vivas</Rotulo>
        </Tarjeta>
        <Tarjeta>
          <p className="text-3xl font-extrabold text-tinta">{progresoMedio}%</p>
          <Rotulo className="mt-1">Progreso medio</Rotulo>
        </Tarjeta>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Tarjeta titulo="Grupos">
          {grupos.length === 0 ? (
            <Vacio accion={<Boton tamano="pequeno" href="/profe/grupos">Crear un grupo</Boton>}>
              Todavía no hay grupos.
            </Vacio>
          ) : (
            <ul className="space-y-2">
              {grupos.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/profe/grupos/${g.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-tinta transition hover:bg-fondo"
                  >
                    <span className="truncate">{g.nombre}</span>
                    <span className="shrink-0 text-xs font-bold text-tinta-suave">
                      {g._count.miembros} estudiantes
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Particulares">
          {particulares.length === 0 ? (
            <Vacio accion={<Boton tamano="pequeno" href="/profe/alumnos/nuevo">Nuevo estudiante</Boton>}>
              Ningún estudiante particular todavía.
            </Vacio>
          ) : (
            <ul className="space-y-2">
              {particulares.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/profe/alumnos/${e.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-tinta transition hover:bg-fondo"
                  >
                    <span className="truncate">{nombreDe(e)}</span>
                    {e.nivel && <Etiqueta>{nombreNivel(e.nivel)}</Etiqueta>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="mt-4">
        <Tarjeta titulo="Todavía no han empezado">
          {sinEmpezar.length === 0 ? (
            <Vacio>Todos han empezado al menos una secuencia.</Vacio>
          ) : (
            <ul className="space-y-2">
              {sinEmpezar.map((asignacion) => (
                <li
                  key={asignacion.id}
                  className="flex items-center gap-3 rounded-xl bg-fondo px-3 py-2"
                >
                  <Link
                    href={`/profe/alumnos/${asignacion.estudiante.id}`}
                    className="truncate font-semibold text-tinta hover:text-hp-500"
                  >
                    {nombreDe(asignacion.estudiante)}
                  </Link>
                  <span className="ml-auto truncate text-sm text-tinta-suave">
                    {asignacion.recorrido.titulo}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
