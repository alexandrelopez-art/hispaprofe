import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import {
  archivarAsignacion,
  asignarSecuencia,
  otorgarPuntos,
} from "@/lib/acciones";
import { estaSuprimido } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { horas, totalesDeClases } from "@/lib/clases";
import { servicioLabel } from "@/lib/servicios";
import { analizarExpresion } from "@/lib/expresion";
import { clasesParaCitar } from "@/lib/citas";
import Rubrica from "@/components/expresion/rubrica";
import CitarOral from "./citar-oral";

export const dynamic = "force-dynamic";

const nivelLabel: Record<string, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  A2_B1_ESCOLAR: "A2/B1 escolar",
};

export default async function AlumnoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const estudiante = await prisma.user.findUnique({ where: { id } });
  if (!estudiante) notFound();

  const [asignaciones, secuencias, totalesClases] = await Promise.all([
    prisma.asignacion.findMany({
      where: { estudianteId: id, archivada: false },
      orderBy: { createdAt: "desc" },
      include: {
        recorrido: {
          select: {
            id: true,
            titulo: true,
            nivel: true,
            tipo: true,
            pasos: {
              orderBy: { orden: "asc" },
              select: {
                id: true,
                orden: true,
                titulo: true,
                // Para saber si el paso es una tarea de expresión y de qué
                // modalidad. El primero por orden, igual que hace la página
                // del paso: un paso solo enseña un ejercicio.
                ejercicios: {
                  orderBy: { orden: "asc" },
                  take: 1,
                  select: { ejercicio: { select: { datos: true } } },
                },
              },
            },
          },
        },
        completados: {
          select: {
            // El id es a lo que enlaza la pantalla de corrección.
            id: true,
            pasoId: true,
            puntos: true,
            verificadoEl: true,
            completadoEl: true,
          },
        },
      },
    }),
    prisma.recorrido.findMany({
      orderBy: [{ tipo: "asc" }, { orden: "asc" }],
      select: { id: true, titulo: true, nivel: true, tipo: true },
    }),
    totalesDeClases({ profesorId: usuario.id, estudianteId: id }),
  ]);

  // Fuera del bucle de pasos: dos consultas para toda la página y no una por
  // paso, que en una secuencia de nueve serían nueve. Las clases citables se
  // piden una sola vez porque todas las asignaciones de esta ficha son del
  // mismo alumno, y `clasesParaCitar` mira justamente eso: de qué alumno es
  // la asignación. Solo las de este profesor; un administrador las ve todas.
  const soloDeEsteProfesor = usuario.role === "ADMIN" ? null : usuario.id;
  const [clasesCitables, citas] = await Promise.all([
    asignaciones.length > 0
      ? clasesParaCitar(asignaciones[0].id, soloDeEsteProfesor)
      : [],
    prisma.citaOral.findMany({
      where: { asignacionId: { in: asignaciones.map((a) => a.id) } },
      select: {
        asignacionId: true,
        pasoId: true,
        clase: { select: { id: true, empiezaEl: true } },
      },
    }),
  ]);
  // La clave lleva la asignación además del paso: dos asignaciones distintas
  // no comparten pasos hoy, pero la cita es de las dos cosas y la unicidad de
  // la tabla también.
  const citaDe = new Map(citas.map((c) => [`${c.asignacionId}:${c.pasoId}`, c.clase]));

  // La ficha se sigue enseñando aunque esté suprimida —las horas y el
  // historial son del profesor y no se esconden—, pero sin nada que hacerle
  // encima: el botón de atrás justo después de suprimir lleva aquí.
  const suprimido = estaSuprimido(estudiante);

  const nombre = suprimido
    ? "Ficha suprimida"
    : [estudiante.firstName, estudiante.lastName].filter(Boolean).join(" ") ||
      estudiante.email;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profe/alumnos"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Estudiantes
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
          {nombre}
        </h1>
        {estudiante.nivel && (
          <span className="rounded-full bg-hp-400 px-2.5 py-0.5 text-[11px] font-bold text-white">
            {nivelLabel[estudiante.nivel] ?? estudiante.nivel}
          </span>
        )}
      </div>
      <p className="mt-1 text-tinta-suave">
        {suprimido ? "sin datos" : estudiante.email}
      </p>

      {totalesClases.cuantas > 0 && (
        <p className="mt-3 text-sm text-tinta-suave">
          {horas(totalesClases.minutos)} contigo en {totalesClases.cuantas}{" "}
          clase{totalesClases.cuantas !== 1 ? "s" : ""} ·{" "}
          <Link
            href={`/profe/clases?quien=alumno:${estudiante.id}`}
            className="font-semibold text-hp-600 hover:text-hp-500"
          >
            ver sus clases
          </Link>
        </p>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">
        Secuencias asignadas
      </h2>

      {asignaciones.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-8 text-center text-tinta-suave">
          Sin secuencias asignadas todavía.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {asignaciones.map((asignacion) => {
            const total = asignacion.recorrido.pasos.length;
            const porPaso = new Map(
              asignacion.completados.map((c) => [c.pasoId, c]),
            );
            const hechos = asignacion.completados.filter(
              (c) => c.completadoEl,
            ).length;
            const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
            const puntosTotales = asignacion.completados.reduce(
              (suma, c) => suma + (c.puntos ?? 0),
              0,
            );
            // Esta ficha lista las asignaciones de todos los profesores, pero
            // citar y corregir solo valen sobre las propias: un control que
            // siempre iba a contestar «esa asignación no es tuya» no se pinta.
            const mia =
              usuario.role === "ADMIN" || asignacion.profesorId === usuario.id;

            return (
              <li
                key={asignacion.id}
                className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
                      {servicioLabel[asignacion.recorrido.tipo] ??
                        asignacion.recorrido.tipo}
                    </p>
                    <Link
                      href={`/recorridos/${asignacion.recorrido.id}`}
                      className="font-bold text-tinta hover:text-hp-500"
                    >
                      {asignacion.recorrido.titulo}
                    </Link>
                    {asignacion.nota && (
                      <p className="mt-1 text-sm text-tinta-suave">
                        {asignacion.nota}
                      </p>
                    )}
                  </div>

                  <form action={archivarAsignacion}>
                    <input
                      type="hidden"
                      name="asignacionId"
                      value={asignacion.id}
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full border border-hp-200 px-3 py-1 text-xs font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                    >
                      Archivar
                    </button>
                  </form>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-hp-50">
                    <div
                      className="h-full rounded-full bg-bloque2"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-bold text-tinta-suave">
                    {hechos}/{total} pasos
                  </span>
                  {puntosTotales > 0 && (
                    <span className="shrink-0 rounded-full bg-sol-200 px-2.5 py-0.5 text-xs font-bold text-tinta">
                      {puntosTotales} pts
                    </span>
                  )}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
                    Ver pasos, otorgar puntos y citar orales
                  </summary>
                  <ul className="mt-3 space-y-1.5">
                    {asignacion.recorrido.pasos.map((paso) => {
                      const registro = porPaso.get(paso.id);
                      const expresion = paso.ejercicios[0]
                        ? analizarExpresion(paso.ejercicios[0].ejercicio.datos)
                        : null;
                      // Un oral sin registro no tiene fila a la que enlazar,
                      // pero sí se puede corregir: `valorar` hace `upsert`, así
                      // que la fila nace al guardar la rúbrica. Se monta aquí
                      // mismo, plegada, en vez de dejar el paso sin puerta.
                      const rubricaEnLinea =
                        expresion?.modalidad === "oral" && !registro && mia;
                      return (
                        <li
                          key={paso.id}
                          className="rounded-lg bg-fondo px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`shrink-0 text-sm ${
                                registro ? "text-hp-500" : "text-hp-200"
                              }`}
                            >
                              {registro ? "✓" : "○"}
                            </span>
                            <Link
                              href={`/pasos/${paso.id}`}
                              className="min-w-0 flex-1 truncate text-sm text-tinta hover:text-hp-500"
                            >
                              {paso.orden}. {paso.titulo}
                            </Link>
                            {registro?.verificadoEl && (
                              <span
                                className="shrink-0 text-xs"
                                title="Puntos verificados por el profesor"
                              >
                                ★
                              </span>
                            )}
                            {/*
                              Los puntos de una tarea de expresión salen de la
                              rúbrica, no de un número escrito a mano: el campo
                              suelto se sustituye por un enlace a la pantalla
                              que sí sabe puntuarla. Sin fila que corregir no
                              hay adónde enlazar: el oral se corrige en el
                              desplegable de abajo y no repite rótulo aquí; la
                              escrita sin entrega solo dice en qué estado está,
                              porque `valorar` la rechaza a propósito.
                            */}
                            {expresion ? (
                              registro ? (
                                <Link
                                  href={`/profe/entregas/${registro.id}`}
                                  className="shrink-0 text-xs font-semibold text-tinta-suave underline hover:text-hp-500"
                                >
                                  {registro.verificadoEl
                                    ? "Ver la corrección"
                                    : "Corregir"}
                                </Link>
                              ) : rubricaEnLinea ? null : (
                                <span className="shrink-0 text-xs text-tinta-suave">
                                  {expresion.modalidad === "oral"
                                    ? "Sin evaluar"
                                    : "Sin entregar"}
                                </span>
                              )
                            ) : (
                              <form
                                action={otorgarPuntos}
                                className="flex shrink-0 items-center gap-1"
                              >
                                <input
                                  type="hidden"
                                  name="asignacionId"
                                  value={asignacion.id}
                                />
                                <input
                                  type="hidden"
                                  name="pasoId"
                                  value={paso.id}
                                />
                                <input
                                  type="number"
                                  name="puntos"
                                  min={0}
                                  defaultValue={registro?.puntos ?? ""}
                                  placeholder="pts"
                                  className="h-7 w-16 rounded-full border border-hp-200 bg-white px-2 text-center text-xs text-tinta outline-none focus:border-hp-400"
                                />
                                <button
                                  type="submit"
                                  className="h-7 rounded-full border border-hp-200 px-2 text-[11px] font-bold text-tinta-suave transition-colors hover:border-hp-400 hover:text-hp-600"
                                >
                                  Guardar
                                </button>
                              </form>
                            )}
                          </div>

                          {expresion?.modalidad === "oral" && mia && (
                            <CitarOral
                              asignacionId={asignacion.id}
                              pasoId={paso.id}
                              citada={
                                citaDe.get(`${asignacion.id}:${paso.id}`) ?? null
                              }
                              clases={clasesCitables}
                            />
                          )}

                          {expresion && rubricaEnLinea && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
                                Corregir el oral
                              </summary>
                              {/*
                                Plegada por defecto: la fila del paso no puede
                                crecer con una rúbrica abierta por cada oral de
                                la secuencia.
                              */}
                              <div className="mt-2">
                                <Rubrica
                                  asignacionId={asignacion.id}
                                  pasoId={paso.id}
                                  criterios={expresion.criterios}
                                  valoracion={null}
                                />
                              </div>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {!suprimido && (
        <>
          <h2 className="mt-10 text-lg font-bold text-tinta">
            Asignar una secuencia
          </h2>

          <form
            action={asignarSecuencia}
            className="mt-3 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
          >
            <input type="hidden" name="estudianteId" value={estudiante.id} />

            <label className="block text-sm font-semibold text-tinta">
              Secuencia
              <select
                name="recorridoId"
                required
                defaultValue=""
                className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
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

            <label className="mt-4 block text-sm font-semibold text-tinta">
              Nota para el estudiante (opcional)
              <input
                type="text"
                name="nota"
                placeholder="Por ejemplo: hazlo antes del jueves"
                className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
              />
            </label>

            <button
              type="submit"
              className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
            >
              Asignar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
