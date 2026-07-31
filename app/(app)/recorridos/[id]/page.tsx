import { prisma } from "@/lib/prisma";
import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
import {
  asignarSecuenciaAVarios,
  borrarPaso,
  crearPaso,
  moverPaso,
} from "@/lib/acciones";
import { estadoDePasos, type EstadoPaso } from "@/lib/progreso";
import BotonConfirmar from "@/components/boton-confirmar";
import { notFound } from "next/navigation";
import Link from "next/link";
import { servicioLabel } from "@/lib/servicios";
import TareasSugeridas from "./tareas-sugeridas";

export const dynamic = "force-dynamic";

const nivelLabel: Record<string, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  A2_B1_ESCOLAR: "A2/B1 escolar",
};

const tipoLabel: Record<string, string> = {
  ACTIVACION: "Activación",
  ACTIVIDAD: "Actividad",
  ANDAMIAJE: "Andamiaje",
  MICRO_TAREA: "Micro tarea",
  MACRO_TAREA: "Macro tarea",
};

const tipoStyle: Record<string, string> = {
  ACTIVACION: "bg-bloque2/25 text-tinta ring-bloque2/50",
  ACTIVIDAD: "bg-hp-100 text-hp-700 ring-hp-200",
  ANDAMIAJE: "bg-bloque1/25 text-tinta ring-bloque1/50",
  MICRO_TAREA: "bg-sol-200/70 text-tinta ring-sol-400/60",
  MACRO_TAREA: "bg-bloque3/25 text-tinta ring-bloque3/50",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function RecorridoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const recorrido = await prisma.recorrido.findUnique({
    where: { id },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });

  if (!recorrido) notFound();

  const usuario = await getUsuarioActual();
  const esProfe =
    usuario?.role === "PROFESOR" || usuario?.role === "ADMIN";

  const [estudiantes, asignaciones] = esProfe
    ? await Promise.all([
        listarEstudiantesElegibles({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            nivel: true,
          },
        }),
        prisma.asignacion.findMany({
          where: { recorridoId: id, archivada: false },
          include: {
            estudiante: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: { select: { completados: true } },
          },
        }),
      ])
    : [[], []];

  const yaAsignados = new Set(asignaciones.map((a) => a.estudianteId));
  const pendientes = estudiantes.filter((e) => !yaAsignados.has(e.id));
  const totalPasos = recorrido.pasos.length;

  // Los ciclos salen de los datos, no de una lista fija: una secuencia
  // de tres ciclos ya no se queda a medias.
  const ciclos = [...new Set(recorrido.pasos.map((p) => p.ciclo))].sort(
    (a, b) => a - b,
  );

  // La página ya carga datos cuando quien mira es profesor. Aquí se
  // atiende el otro caso: un estudiante con asignación viva ve marcado
  // su propio recorrido por la secuencia.
  const asignacionPropia =
    usuario && !esProfe
      ? await prisma.asignacion.findUnique({
          where: {
            estudianteId_recorridoId: {
              estudianteId: usuario.id,
              recorridoId: recorrido.id,
            },
          },
          select: { id: true, archivada: true },
        })
      : null;

  // Archivar es cosa del profesor para quitar la secuencia de en medio,
  // no una forma de borrar lo que el estudiante ya hizo: la marca se
  // mantiene aunque la asignación esté archivada. La página del paso
  // sigue sin ofrecer botón, así que nada se vuelve editable.
  const estados = asignacionPropia
    ? await estadoDePasos(asignacionPropia.id)
    : new Map<string, { estado: EstadoPaso; puntos: number | null }>();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/recorridos"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Secuencias
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
            {servicioLabel[recorrido.tipo] ?? recorrido.tipo}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-tinta">
            {recorrido.titulo}
          </h1>
          {recorrido.descripcion && (
            <p className="mt-2 text-tinta-suave">{recorrido.descripcion}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-hp-400 px-3 py-1 text-xs font-bold text-white">
          {nivelLabel[recorrido.nivel] ?? recorrido.nivel}
        </span>
      </div>

      {esProfe && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
          <h2 className="text-lg font-bold text-tinta">Asignar esta secuencia</h2>

          {asignaciones.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
                Ya asignada a {asignaciones.length}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {asignaciones.map((asignacion) => (
                  <li key={asignacion.id}>
                    <Link
                      href={`/profe/alumnos/${asignacion.estudiante.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-fondo px-3 py-1 text-xs font-semibold text-tinta hover:bg-hp-50"
                    >
                      {nombreDe(asignacion.estudiante)}
                      <span className="text-tinta-suave">
                        {asignacion._count.completados}/{totalPasos}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pendientes.length === 0 ? (
            <p className="mt-4 text-sm text-tinta-suave">
              {estudiantes.length === 0
                ? "Todavía no hay estudiantes registrados."
                : "Todos los estudiantes ya la tienen asignada."}
            </p>
          ) : (
            <form action={asignarSecuenciaAVarios} className="mt-4">
              <input type="hidden" name="recorridoId" value={recorrido.id} />

              <fieldset>
                <legend className="text-sm font-semibold text-tinta">
                  Elige a quién
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {pendientes.map((estudiante) => (
                    <label
                      key={estudiante.id}
                      className="flex items-center gap-2 rounded-xl border border-hp-100 bg-fondo px-3 py-2 text-sm text-tinta"
                    >
                      <input
                        type="checkbox"
                        name="estudianteIds"
                        value={estudiante.id}
                        className="h-4 w-4 accent-hp-400"
                      />
                      <span className="truncate">{nombreDe(estudiante)}</span>
                      {estudiante.nivel && (
                        <span className="ml-auto shrink-0 text-[11px] font-bold text-tinta-suave">
                          {nivelLabel[estudiante.nivel] ?? estudiante.nivel}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>

              <input
                type="text"
                name="nota"
                placeholder="Nota para el estudiante (opcional)"
                className="mt-4 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
              />

              <button
                type="submit"
                className="mt-4 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
              >
                Asignar a los seleccionados
              </button>
            </form>
          )}
        </section>
      )}

      <div className="mt-10">
        {ciclos.map((ciclo) => {
          const pasos = recorrido.pasos.filter((p) => p.ciclo === ciclo);
          return (
            <section key={ciclo} className="mb-8">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-tinta-suave">
                Ciclo {ciclo}
              </h2>
              <ol className="relative border-l-2 border-hp-100 pl-8">
                {pasos.map((paso) => {
                  const marca = estados.get(paso.id);
                  return (
                  <li key={paso.id} className="relative mb-5 last:mb-0">
                    <span
                      className={`absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-4 ring-fondo ${
                        marca ? "bg-bloque2 text-tinta" : "bg-tinta text-white"
                      }`}
                      title={
                        marca?.estado === "REVISADO"
                          ? "Revisado por tu profe"
                          : marca
                            ? "Entregado, esperando revisión"
                            : undefined
                      }
                    >
                      {marca ? "✓" : paso.orden}
                    </span>
                    <Link
                      href={`/pasos/${paso.id}`}
                      className="block rounded-xl border border-hp-100 bg-white p-4 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            tipoStyle[paso.tipo] ??
                            "bg-hp-50 text-tinta ring-hp-200"
                          }`}
                        >
                          {tipoLabel[paso.tipo] ?? paso.tipo}
                        </span>
                        {paso.destreza && (
                          <span className="rounded bg-hp-100 px-1.5 py-0.5 text-[10px] font-bold text-hp-700">
                            {paso.destreza}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold text-tinta">
                          {paso.titulo}
                        </p>
                        {marca?.estado === "REVISADO" && (
                          <span className="shrink-0 rounded-full bg-sol-300 px-2 py-0.5 text-[11px] font-extrabold text-tinta">
                            {marca.puntos ?? 0} pts
                          </span>
                        )}
                      </div>
                    </Link>

                    {esProfe && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <form action={moverPaso}>
                          <input type="hidden" name="pasoId" value={paso.id} />
                          <input
                            type="hidden"
                            name="direccion"
                            value="arriba"
                          />
                          <button
                            type="submit"
                            disabled={paso.orden === 1}
                            title="Subir"
                            className="rounded-lg border border-hp-200 px-2 py-0.5 text-xs font-bold text-tinta-suave transition-colors hover:border-hp-400 hover:text-hp-600 disabled:opacity-30"
                          >
                            ↑
                          </button>
                        </form>

                        <form action={moverPaso}>
                          <input type="hidden" name="pasoId" value={paso.id} />
                          <input
                            type="hidden"
                            name="direccion"
                            value="abajo"
                          />
                          <button
                            type="submit"
                            disabled={paso.orden === recorrido.pasos.length}
                            title="Bajar"
                            className="rounded-lg border border-hp-200 px-2 py-0.5 text-xs font-bold text-tinta-suave transition-colors hover:border-hp-400 hover:text-hp-600 disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </form>

                        <form action={borrarPaso}>
                          <input type="hidden" name="pasoId" value={paso.id} />
                          <BotonConfirmar
                            aviso={`¿Borrar el paso "${paso.titulo}"? Se borra también su contenido y el registro de quién lo había completado.`}
                            title="Borrar paso"
                            className="rounded-lg border border-hp-200 px-2 py-0.5 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                          >
                            Borrar
                          </BotonConfirmar>
                        </form>
                      </div>
                    )}
                  </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        {esProfe && recorrido.tipo === "PREPARACION_DELE" && recorrido.destreza && (
          <TareasSugeridas
            recorridoId={recorrido.id}
            nivel={recorrido.nivel}
            destreza={recorrido.destreza}
            ordenesOcupados={recorrido.pasos.map((p) => p.orden)}
          />
        )}

        {esProfe && (
          <section className="mt-4 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
            <h2 className="text-lg font-bold text-tinta">Añadir un paso</h2>
            <p className="mt-1 text-sm text-tinta-suave">
              Aquí se define el esqueleto. El contenido (texto, vídeo, audio,
              Genially, enlaces) se añade dentro de cada paso: pulsa uno de la
              lista de arriba y busca «Añadir contenido» al final.
            </p>
            <form action={crearPaso} className="mt-3">
              <input type="hidden" name="recorridoId" value={recorrido.id} />

              <label className="block text-sm font-semibold text-tinta">
                Título
                <input
                  type="text"
                  name="titulo"
                  required
                  placeholder="Vocabulario del barrio"
                  className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-3">
                <label className="flex-1 text-sm font-semibold text-tinta">
                  Tipo
                  <select
                    name="tipo"
                    required
                    defaultValue=""
                    className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                  >
                    <option value="" disabled>
                      Elige
                    </option>
                    <option value="ACTIVACION">Activación</option>
                    <option value="ACTIVIDAD">Actividad</option>
                    <option value="ANDAMIAJE">Andamiaje</option>
                    <option value="MICRO_TAREA">Micro tarea</option>
                    <option value="MACRO_TAREA">Macro tarea</option>
                  </select>
                </label>

                <label className="w-24 text-sm font-semibold text-tinta">
                  Ciclo
                  <input
                    type="number"
                    name="ciclo"
                    min={1}
                    defaultValue={1}
                    className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                  />
                </label>

                <label className="flex-1 text-sm font-semibold text-tinta">
                  Destreza
                  <select
                    name="destreza"
                    defaultValue=""
                    className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                  >
                    <option value="">Ninguna</option>
                    <option value="CO">CO · comprensión oral</option>
                    <option value="CE">CE · comprensión escrita</option>
                    <option value="EO">EO · expresión oral</option>
                    <option value="EE">EE · expresión escrita</option>
                    <option value="EOI">EOI · interacción oral</option>
                    <option value="EEI">EEI · interacción escrita</option>
                  </select>
                </label>
              </div>

              <button
                type="submit"
                className="mt-4 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
              >
                Añadir paso
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
