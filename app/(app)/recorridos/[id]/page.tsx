import { prisma } from "@/lib/prisma";
import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
import {
  asignarSecuenciaAVarios,
  borrarPaso,
  borrarRecorrido,
  crearPaso,
  moverPaso,
  publicarRecorrido,
} from "@/lib/acciones";
import {
  avisoDeBorrado,
  puedeBorrarRecorrido,
  puedePublicarse,
  resumenDeBorrado,
} from "@/lib/recorridos";
import {
  estadoDePasos,
  sobreCuantosPorPaso,
  type EstadoPaso,
} from "@/lib/progreso";
import { notFound } from "next/navigation";
import Link from "next/link";
import { servicioLabel } from "@/lib/servicios";
import { nombreNivel } from "@/lib/niveles";
import BotonConfirmar from "@/components/ui/boton-confirmar";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Aviso from "@/components/ui/aviso";
import TareasSugeridas from "./tareas-sugeridas";
import { tipoLabel, tipoTono } from "@/lib/tipos-de-paso";

export const dynamic = "force-dynamic";

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

  // Solo se calculan si se va a pintar: `resumenDeBorrado` hace cinco viajes
  // (todo `count`, ninguno trae filas enteras), y no hay por qué pagarlos
  // para no enseñar nada.
  const sePuedeBorrar = puedeBorrarRecorrido(usuario, recorrido);
  const aviso = sePuedeBorrar
    ? avisoDeBorrado(recorrido.titulo, await resumenDeBorrado(recorrido.id))
    : null;

  // Quien puede borrarla puede publicarla: es la misma responsabilidad sobre
  // la misma secuencia. El motivo solo se pide si está en borrador, que es
  // cuando puede impedir algo.
  const motivoDePublicar =
    sePuedeBorrar && !recorrido.publicado ? await puedePublicarse(recorrido.id) : null;

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

  // Solo para quien tiene la secuencia asignada: traer los datos de cada
  // ejercicio cuesta —en una tarea del DELE llevan el texto de lectura
  // entero—, y sin asignación no hay ninguna nota que enseñar.
  const sobre = asignacionPropia
    ? await sobreCuantosPorPaso(recorrido.pasos.map((p) => p.id))
    : new Map<string, number | null>();

  // El total suma solo lo que tiene máximo: mezclar los puntos que el profe
  // pone a mano, que no van sobre nada, daría una fracción que miente.
  const conNota = recorrido.pasos.filter(
    (p) => (estados.get(p.id)?.puntos ?? null) !== null && sobre.get(p.id),
  );
  const totalSacado = conNota.reduce(
    (suma, p) => suma + (estados.get(p.id)?.puntos ?? 0),
    0,
  );
  const totalSobre = conNota.reduce((suma, p) => suma + (sobre.get(p.id) ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado
        titulo={recorrido.titulo}
        lede={recorrido.descripcion}
        volver={{ href: "/recorridos", texto: "Secuencias" }}
        margen="corto"
        acciones={
          sePuedeBorrar && (
            <>
              <Etiqueta tono={recorrido.publicado ? "verde" : "neutro"}>
                {recorrido.publicado ? "Publicada" : "Borrador"}
              </Etiqueta>

              {recorrido.publicado ? (
                <form action={publicarRecorrido}>
                  <input type="hidden" name="recorridoId" value={recorrido.id} />
                  <input type="hidden" name="publicar" value="no" />
                  <BotonConfirmar
                    aviso={`«${recorrido.titulo}» dejará de aparecer en la preparación del alumno. Quien ya la tenga asignada la sigue teniendo, pero nadie nuevo podrá empezarla.`}
                    title="Retirarla del catálogo del alumno"
                    variante="sutil"
                    tamano="pequeno"
                  >
                    Despublicar
                  </BotonConfirmar>
                </form>
              ) : motivoDePublicar ? (
                <Aviso tono="info">{motivoDePublicar}</Aviso>
              ) : (
                <form action={publicarRecorrido}>
                  <input type="hidden" name="recorridoId" value={recorrido.id} />
                  <input type="hidden" name="publicar" value="si" />
                  <BotonEnviar gerundio="Publicando…" tamano="pequeno">
                    Publicar
                  </BotonEnviar>
                </form>
              )}

              {aviso && (
                <form action={borrarRecorrido}>
                  <input type="hidden" name="recorridoId" value={recorrido.id} />
                  <BotonConfirmar
                    aviso={aviso}
                    title="Borrar la secuencia entera"
                    variante="peligro"
                    tamano="pequeno"
                  >
                    Borrar la secuencia
                  </BotonConfirmar>
                </form>
              )}
            </>
          )
        }
      />

      <div className="mb-6 flex items-center gap-2">
        <Rotulo>{servicioLabel[recorrido.tipo] ?? recorrido.tipo}</Rotulo>
        <Etiqueta tono="hp">{nombreNivel(recorrido.nivel) || recorrido.nivel}</Etiqueta>
      </div>

      {esProfe && (
        <Tarjeta titulo="Asignar esta secuencia" className="mt-8">
          {asignaciones.length > 0 && (
            <div className="mt-3">
              <Rotulo>Ya asignada a {asignaciones.length}</Rotulo>
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
                          {nombreNivel(estudiante.nivel)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Campo
                etiqueta="Nota"
                name="nota"
                tipo="texto"
                placeholder="Nota para el estudiante (opcional)"
                className="mt-4"
              />

              <BotonEnviar gerundio="Asignando…" className="mt-4">
                Asignar a los seleccionados
              </BotonEnviar>
            </form>
          )}
        </Tarjeta>
      )}

      <div className="mt-10">
        {ciclos.map((ciclo) => {
          const pasos = recorrido.pasos.filter((p) => p.ciclo === ciclo);
          return (
            <section key={ciclo} className="mb-8">
              <Rotulo className="mb-4">Ciclo {ciclo}</Rotulo>
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
                    <Tarjeta href={`/pasos/${paso.id}`}>
                      <div className="flex items-center gap-2">
                        <Etiqueta tono={tipoTono[paso.tipo] ?? "hp"}>
                          {tipoLabel[paso.tipo] ?? paso.tipo}
                        </Etiqueta>
                        {paso.destreza && (
                          <Etiqueta tono="hp">{paso.destreza}</Etiqueta>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold text-tinta">
                          {paso.titulo}
                        </p>
                        {marca?.estado === "REVISADO" && (
                          // Con denominador cuando se puede deducir del
                          // ejercicio: un «12» suelto no dice si es sobre doce
                          // o sobre veinticinco. Los pasos que corrige el profe
                          // a mano no tienen máximo, y esos se quedan en «pts».
                          <Etiqueta tono="sol" className="shrink-0">
                            {sobre.get(paso.id)
                              ? `${marca.puntos ?? 0}/${sobre.get(paso.id)}`
                              : `${marca.puntos ?? 0} pts`}
                          </Etiqueta>
                        )}
                      </div>
                    </Tarjeta>

                    {esProfe && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <form action={moverPaso}>
                          <input type="hidden" name="pasoId" value={paso.id} />
                          <input
                            type="hidden"
                            name="direccion"
                            value="arriba"
                          />
                          <BotonEnviar
                            gerundio="Moviendo…"
                            variante="sutil"
                            tamano="pequeno"
                            deshabilitado={paso.orden === 1}
                            title="Subir"
                          >
                            ↑
                          </BotonEnviar>
                        </form>

                        <form action={moverPaso}>
                          <input type="hidden" name="pasoId" value={paso.id} />
                          <input
                            type="hidden"
                            name="direccion"
                            value="abajo"
                          />
                          <BotonEnviar
                            gerundio="Moviendo…"
                            variante="sutil"
                            tamano="pequeno"
                            deshabilitado={paso.orden === recorrido.pasos.length}
                            title="Bajar"
                          >
                            ↓
                          </BotonEnviar>
                        </form>

                        <form action={borrarPaso}>
                          <input type="hidden" name="pasoId" value={paso.id} />
                          <BotonConfirmar
                            aviso={`¿Borrar el paso "${paso.titulo}"? Se borra también su contenido, el registro de quién lo había completado y las grabaciones que hayan entregado los alumnos, sin vuelta atrás.`}
                            title="Borrar paso"
                            variante="peligro"
                            tamano="pequeno"
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

        {totalSobre > 0 && (
          <Tarjeta className="mb-8">
            <p className="text-sm font-bold text-tinta">
              Llevas {totalSacado} de {totalSobre} en {conNota.length}{" "}
              {conNota.length === 1 ? "tarea corregida" : "tareas corregidas"}.
            </p>
          </Tarjeta>
        )}

        {esProfe && recorrido.tipo === "PREPARACION_DELE" && recorrido.destreza && (
          <TareasSugeridas
            recorridoId={recorrido.id}
            nivel={recorrido.nivel}
            destreza={recorrido.destreza}
            pasos={recorrido.pasos.map((p) => ({ titulo: p.titulo, orden: p.orden }))}
          />
        )}

        {esProfe && (
          <Tarjeta titulo="Añadir un paso" className="mt-4">
            <p className="text-sm text-tinta-suave">
              Aquí se define el esqueleto. El contenido (texto, vídeo, audio,
              Genially, enlaces) se añade dentro de cada paso: pulsa uno de la
              lista de arriba y busca «Añadir contenido» al final.
            </p>
            <form action={crearPaso} className="mt-3">
              <input type="hidden" name="recorridoId" value={recorrido.id} />

              <Campo
                etiqueta="Título"
                name="titulo"
                required
                placeholder="Vocabulario del barrio"
              />

              <div className="mt-3 flex flex-wrap gap-3">
                <Campo
                  etiqueta="Tipo"
                  name="tipo"
                  tipo="elegir"
                  required
                  defaultValue=""
                  className="flex-1"
                  opciones={[
                    { valor: "", nombre: "Elige", deshabilitada: true },
                    { valor: "ACTIVACION", nombre: "Activación" },
                    { valor: "ACTIVIDAD", nombre: "Actividad" },
                    { valor: "ANDAMIAJE", nombre: "Andamiaje" },
                    { valor: "MICRO_TAREA", nombre: "Micro tarea" },
                    { valor: "MACRO_TAREA", nombre: "Macro tarea" },
                  ]}
                />

                <Campo
                  etiqueta="Ciclo"
                  name="ciclo"
                  tipo="numero"
                  min={1}
                  defaultValue={1}
                  className="w-24"
                />

                <Campo
                  etiqueta="Destreza"
                  name="destreza"
                  tipo="elegir"
                  defaultValue=""
                  className="flex-1"
                  opciones={[
                    { valor: "", nombre: "Ninguna" },
                    { valor: "CO", nombre: "CO · comprensión oral" },
                    { valor: "CE", nombre: "CE · comprensión escrita" },
                    { valor: "EO", nombre: "EO · expresión oral" },
                    { valor: "EE", nombre: "EE · expresión escrita" },
                    { valor: "EOI", nombre: "EOI · interacción oral" },
                    { valor: "EEI", nombre: "EEI · interacción escrita" },
                  ]}
                />
              </div>

              <BotonEnviar gerundio="Añadiendo…" className="mt-4">
                Añadir paso
              </BotonEnviar>
            </form>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
