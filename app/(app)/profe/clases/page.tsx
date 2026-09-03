import { prisma } from "@/lib/prisma";
import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
import { euros, horas, listarClases, totalesDeClases } from "@/lib/clases";
import type { FiltroClases } from "@/lib/clases";
import { estaSuprimido } from "@/lib/roles";
import { deInput, fechaHora } from "@/lib/fechas";
import { crearClase } from "@/lib/acciones-clases";
import type { EstadoClase } from "@/lib/generated/prisma/enums";
import { redirect } from "next/navigation";
import Link from "next/link";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import type { TonoEtiqueta } from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

export const dynamic = "force-dynamic";

const estadoLabel: Record<string, string> = {
  AGENDADA: "Agendada",
  DADA: "Dada",
  ANULADA: "Anulada",
};

const estadoTono: Record<string, TonoEtiqueta> = {
  AGENDADA: "hp",
  DADA: "bloque2",
  ANULADA: "neutro",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

/**
 * Una fecha del filtro. Vacía o ilegible es «sin filtro», no un error.
 *
 * `finDeDia` es imprescindible en «hasta»: un `Campo tipo="fecha"` da
 * «2026-08-05», y tomarlo como medianoche dejaría fuera la clase de ese
 * mismo día a las seis de la tarde. «Hasta el 5» significa el 5 incluido.
 *
 * Los dos extremos se leen como horas de Madrid con `deInput`: en un servidor
 * en UTC, «hasta el 5» a medianoche del host colaría las clases de madrugada
 * del día siguiente.
 */
function fechaDeTexto(bruto?: string, finDeDia = false): Date | undefined {
  if (!bruto) return undefined;
  return deInput(`${bruto}T${finDeDia ? "23:59" : "00:00"}`) ?? undefined;
}

/**
 * El estado del filtro, acotado a los tres que existen. Un `?estado=FOO`
 * escrito a mano llegaría a Prisma y reventaría la página con un 500.
 */
function estadoDeTexto(bruto?: string): EstadoClase | undefined {
  return bruto === "AGENDADA" || bruto === "DADA" || bruto === "ANULADA"
    ? bruto
    : undefined;
}

function Total({ n, etiqueta }: { n: string; etiqueta: string }) {
  return (
    <Tarjeta>
      <p className="text-2xl font-extrabold text-tinta">{n}</p>
      <Rotulo className="mt-1">{etiqueta}</Rotulo>
    </Tarjeta>
  );
}

export default async function ClasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    quien?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    cobrada?: string;
  }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const q = await searchParams;

  const [tipo, id] = (q.quien ?? "").split(":");
  const filtro: FiltroClases = {
    profesorId: usuario.id,
    estudianteId: tipo === "alumno" ? id : undefined,
    grupoId: tipo === "grupo" ? id : undefined,
    desde: fechaDeTexto(q.desde),
    hasta: fechaDeTexto(q.hasta, true),
    estado: estadoDeTexto(q.estado),
    cobrada: q.cobrada === "si" ? true : q.cobrada === "no" ? false : undefined,
  };

  const [clases, totales, estudiantes, grupos] = await Promise.all([
    listarClases(filtro),
    totalesDeClases(filtro),
    listarEstudiantesElegibles({
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const opcionesQuien = [
    { valor: "", nombre: "Todo el mundo" },
    ...estudiantes.map((e) => ({ valor: `alumno:${e.id}`, nombre: nombreDe(e) })),
    ...grupos.map((g) => ({ valor: `grupo:${g.id}`, nombre: `Grupo · ${g.nombre}` })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Encabezado titulo="Clases" />

      <Tarjeta className="mt-6">
        <details>
          <summary className="cursor-pointer text-lg font-bold text-tinta">
            Registrar una clase
          </summary>

          <form action={crearClase} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Día y hora"
              name="empiezaEl"
              tipo="fechahora"
              required
            />

            <Campo
              etiqueta="Duración (minutos)"
              name="minutos"
              tipo="numero"
              min={1}
              defaultValue={60}
              required
            />

            <Campo
              etiqueta="Con quién"
              name="destinatario"
              tipo="elegir"
              required
              defaultValue=""
              opciones={[
                { valor: "", nombre: "Elige un estudiante o un grupo", deshabilitada: true },
                ...estudiantes.map((e) => ({ valor: `alumno:${e.id}`, nombre: nombreDe(e) })),
                ...grupos.map((g) => ({ valor: `grupo:${g.id}`, nombre: `Grupo · ${g.nombre}` })),
              ]}
            />

            <Campo
              etiqueta="Dónde (opcional)"
              name="donde"
              tipo="texto"
              placeholder="en su casa, aula 2..."
            />

            <Campo
              etiqueta="Enlace de conexión (opcional)"
              name="enlace"
              tipo="url"
              placeholder="https://meet.google.com/..."
              className="sm:col-span-2"
            />

            <BotonEnviar gerundio="Registrando…" className="sm:col-span-2 sm:justify-self-start">
              Registrar
            </BotonEnviar>
          </form>
        </details>
      </Tarjeta>

      {/* El buscador no tenía ninguna etiqueta visible antes (inputs y
          selects sueltos con solo `placeholder`/orden como pista); `Campo`
          exige una, así que «Con quién», «Desde», «Hasta» y «Estado» son
          texto nuevo — mismo criterio que ya usó la zona 1 en el buscador de
          `/recorridos`. */}
      <form className="mt-8 grid gap-3 sm:grid-cols-5">
        <Campo
          etiqueta="Con quién"
          name="quien"
          tipo="elegir"
          defaultValue={q.quien ?? ""}
          opciones={opcionesQuien}
        />

        <Campo etiqueta="Desde" name="desde" tipo="fecha" defaultValue={q.desde ?? ""} />
        <Campo etiqueta="Hasta" name="hasta" tipo="fecha" defaultValue={q.hasta ?? ""} />

        <Campo
          etiqueta="Estado"
          name="estado"
          tipo="elegir"
          defaultValue={q.estado ?? ""}
          opciones={[
            { valor: "", nombre: "Cualquier estado" },
            { valor: "AGENDADA", nombre: "Agendadas" },
            { valor: "DADA", nombre: "Dadas" },
            { valor: "ANULADA", nombre: "Anuladas" },
          ]}
        />

        <BotonEnviar gerundio="Filtrando…" variante="sutil" className="self-end">
          Filtrar
        </BotonEnviar>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Total n={horas(totales.minutos)} etiqueta="Horas dadas" />
        <Total n={String(totales.cuantas)} etiqueta="Clases dadas" />
        <Total n={euros(totales.totalCentimos)} etiqueta="Total" />
        <Total n={euros(totales.pendienteCentimos)} etiqueta="Pendiente" />
      </div>

      {totales.sinTarifa > 0 && (
        <Aviso tono="aviso" className="mt-4">
          {totales.sinTarifa} clase{totales.sinTarifa !== 1 ? "s" : ""} dada
          {totales.sinTarifa !== 1 ? "s" : ""} sin importe. Le falta la tarifa
          por hora a quien {totales.sinTarifa !== 1 ? "las" : "la"} recibió.
        </Aviso>
      )}

      {clases.length === 0 ? (
        <Vacio className="mt-6">No hay clases con esos filtros.</Vacio>
      ) : (
        <ul className="mt-6 space-y-2">
          {clases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/profe/clases/${c.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">
                    {c.estudiante
                      ? estaSuprimido(c.estudiante)
                        ? "Estudiante suprimido"
                        : nombreDe(c.estudiante)
                      : `Grupo · ${c.grupo?.nombre ?? "sin grupo"}`}
                  </p>
                  <p className="truncate text-xs text-tinta-suave">
                    {fechaHora(c.empiezaEl)} · {horas(c.minutos)}
                    {c.donde && ` · ${c.donde}`}
                  </p>
                </div>

                {c._count.asignados > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-tinta-suave">
                    {c._count.asignados} deber
                    {c._count.asignados !== 1 ? "es" : ""}
                  </span>
                )}

                <Etiqueta tono={estadoTono[c.estado] ?? "neutro"} className="shrink-0">
                  {estadoLabel[c.estado] ?? c.estado}
                </Etiqueta>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${
                    c.estado === "DADA" && c.importeCentimos === null
                      ? "bg-sol-200 text-tinta"
                      : "text-tinta-suave"
                  }`}
                >
                  {euros(c.importeCentimos)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
