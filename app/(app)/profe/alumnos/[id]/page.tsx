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
import { analizarExpresion, esGrabada } from "@/lib/expresion";
import { clasesParaCitar } from "@/lib/citas";
import { fechaHora } from "@/lib/fechas";
import { nombreNivel } from "@/lib/niveles";
import Rubrica from "@/components/expresion/rubrica";
import CitarOral from "./citar-oral";
import NuevaContrasena from "@/components/nueva-contrasena";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

export const dynamic = "force-dynamic";

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
            // Solo para saber si hay algo que corregir: ni una escrita sin
            // texto ni una grabada sin audio se pueden puntuar con la rúbrica,
            // así que en esas filas va el campo de puntos a mano. La oral de
            // clase es la excepción: esa se puntúa sin entrega ninguna. Lo
            // entregado no sale de aquí —esto es un componente de servidor y
            // no se lo pasa a ninguno de cliente—; se lee entero en
            // `/profe/entregas/[id]`.
            entrega: true,
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
      <Encabezado
        titulo={nombre}
        volver={{ href: "/profe/alumnos", texto: "Estudiantes" }}
        acciones={
          estudiante.nivel && <Etiqueta tono="hp">{nombreNivel(estudiante.nivel)}</Etiqueta>
        }
      />

      {!suprimido && (
        <Tarjeta titulo="Acceso" className="mt-6">
          <p className="mt-2 text-sm text-tinta">
            {!estudiante.contrasenaHash
              ? "Todavía no tiene contraseña: no puede entrar."
              : estudiante.intentosBloqueadosHasta && estudiante.intentosBloqueadosHasta > new Date()
                ? `Bloqueado por intentos fallidos hasta las ${fechaHora(estudiante.intentosBloqueadosHasta)}.`
                : estudiante.debeCambiarContrasena
                  ? "Tiene una contraseña dada por ti; al entrar tendrá que cambiarla."
                  : "Tiene su propia contraseña."}
          </p>
          <div className="mt-3">
            <NuevaContrasena usuarioId={estudiante.id} />
          </div>
        </Tarjeta>
      )}

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
        <Vacio className="mt-3">Sin secuencias asignadas todavía.</Vacio>
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
              <li key={asignacion.id}>
                <Tarjeta>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Rotulo>
                        {servicioLabel[asignacion.recorrido.tipo] ??
                          asignacion.recorrido.tipo}
                      </Rotulo>
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
                      <BotonEnviar
                        gerundio="Archivando…"
                        variante="sutil"
                        tamano="pequeno"
                        className="shrink-0"
                      >
                        Archivar
                      </BotonEnviar>
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
                      <Etiqueta tono="sol" className="shrink-0">
                        {puntosTotales} pts
                      </Etiqueta>
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
                        // La oral de clase es la que se hace con el profesor
                        // delante: no deja entrega y se cita. La grabada llega
                        // entregada, así que en esta fila se comporta igual que
                        // una escrita.
                        const oralDeClase =
                          expresion?.modalidad === "oral" && !esGrabada(expresion);
                        /*
                          Qué control lleva la fila, y solo uno:

                          - la rúbrica cuando hay algo que puntuar con ella: un
                            oral de clase siempre, y una escrita —o una oral
                            grabada— solo si el alumno entregó; `valorar` rechaza
                            a propósito una escrita sin texto y una grabada sin
                            audio, así que el enlace llevaría a un callejón sin
                            salida;
                          - el campo de puntos a mano en todo lo demás, incluida
                            la escrita sin entrega: la redacción hecha en papel,
                            en clase, se sigue puntuando como cualquier paso del
                            proyecto.
                        */
                        const conRubrica = oralDeClase || Boolean(registro?.entrega);
                        // Un oral de clase sin registro no tiene fila a la que
                        // enlazar, pero sí se puede corregir: `valorar` hace
                        // `upsert`, así que la fila nace al guardar la rúbrica. Se
                        // monta aquí mismo, plegada, en vez de dejar el paso sin
                        // puerta. Una grabada nunca cae aquí: solo lleva rúbrica
                        // si entregó, y entonces ya tiene registro.
                        const rubricaEnLinea = conRubrica && !registro && mia;
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
                                Una asignación de otro profesor solo enseña el
                                estado: corregir la abriría en una pantalla que
                                contesta `notFound()`, y puntuarla a mano no es
                                suyo. El rótulo se queda porque el estado sí es
                                información.
                              */}
                              {!mia ? (
                                <span className="shrink-0 text-xs text-tinta-suave">
                                  {registro?.verificadoEl
                                    ? `${registro.puntos ?? 0} pts`
                                    : registro
                                      ? "Sin corregir"
                                      : oralDeClase
                                        ? "Sin evaluar"
                                        : expresion
                                          ? "Sin entregar"
                                          : "Pendiente"}
                                </span>
                              ) : conRubrica ? (
                                // Los puntos de una rúbrica no se escriben a
                                // mano: el enlace lleva a la pantalla que sabe
                                // puntuarla. Sin fila todavía no hay adónde
                                // enlazar, y ahí entra la rúbrica en línea de
                                // abajo, que no repite rótulo aquí.
                                registro ? (
                                  <Link
                                    href={`/profe/entregas/${registro.id}`}
                                    className="shrink-0 text-xs font-semibold text-tinta-suave underline hover:text-hp-500"
                                  >
                                    {registro.verificadoEl
                                      ? "Ver la corrección"
                                      : "Corregir"}
                                  </Link>
                                ) : null
                              ) : (
                                // Campo con botón dentro, en una fila muy
                                // estrecha y sin sitio para su etiqueta: se
                                // queda a mano, como permite el contrato.
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

                            {/*
                              Solo la de clase se cita: una grabada no ocupa
                              hueco en ninguna. El tope de verdad lo pone
                              `puedeCitarse` en el servidor, pero `clasesParaCitar`
                              no mira la modalidad y seguiría ofreciendo clases,
                              así que aquí quedaría un desplegable que solo sirve
                              para recibir un no.
                            */}
                            {oralDeClase && mia && (
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
                </Tarjeta>
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

          <Tarjeta className="mt-3">
            <form action={asignarSecuencia}>
              <input type="hidden" name="estudianteId" value={estudiante.id} />

              <Campo
                etiqueta="Secuencia"
                name="recorridoId"
                tipo="elegir"
                required
                defaultValue=""
                opciones={[
                  { valor: "", nombre: "Elige una secuencia" },
                  ...secuencias.map((secuencia) => ({
                    valor: secuencia.id,
                    nombre: `${servicioLabel[secuencia.tipo] ?? secuencia.tipo} · ${nombreNivel(secuencia.nivel)} · ${secuencia.titulo}`,
                  })),
                ]}
              />

              <Campo
                etiqueta="Nota para el estudiante (opcional)"
                name="nota"
                tipo="texto"
                placeholder="Por ejemplo: hazlo antes del jueves"
                className="mt-4"
              />

              <BotonEnviar gerundio="Asignando…" className="mt-5">
                Asignar
              </BotonEnviar>
            </form>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
