import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { pegarHorario } from "@/lib/acciones-orales";
import type { Notas } from "@/lib/orales/formato";
import Horario from "@/components/orales/horario";
import Panel from "@/components/orales/panel";

export const dynamic = "force-dynamic";

export default async function ConvocatoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ turno?: string }>;
}) {
  const { id } = await params;
  const { turno: turnoActivo } = await searchParams;
  const usuario = await exigirProfesor();

  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id },
    select: { id: true, nombre: true, profesorId: true },
  });
  if (!convocatoria) notFound();
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    notFound();
  }

  const turnos = await prisma.turno.findMany({
    where: { convocatoriaId: id },
    orderBy: { orden: "asc" },
    select: {
      id: true,
      dia: true,
      preparacion: true,
      hora: true,
      sala: true,
      estudiante: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      evaluacion: { select: { sujetoId: true, notas: true } },
    },
  });

  const grupos = await prisma.grupo.findMany({
    where: usuario.role === "ADMIN" ? { archivado: false } : { profesorId: usuario.id, archivado: false },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  const activo = turnoActivo
    ? await prisma.turno.findFirst({
        where: { id: turnoActivo, convocatoriaId: id },
        select: {
          id: true,
          dia: true,
          preparacion: true,
          hora: true,
          sala: true,
          estudiante: { select: { firstName: true, lastName: true, email: true } },
          evaluacion: {
            select: {
              sujetoId: true,
              notas: true,
              comentarios: true,
              frases: true,
              preguntadas: true,
              segundosEoc: true,
              segundosEoi: true,
            },
          },
        },
      })
    : null;

  const sujetos = await prisma.sujeto.findMany({
    where: { convocatoriaId: id },
    orderBy: { numero: "asc" },
    select: {
      id: true,
      numero: true,
      eje: true,
      titulo: true,
      descripcion: true,
      fuente: true,
      url: true,
      preguntas: true,
      imagenId: true,
    },
  });

  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center gap-4 border-b border-hp-100 bg-white px-6 py-4">
        <h1 className="text-xl font-extrabold text-tinta">{convocatoria.nombre}</h1>
        <Link
          href={`/profe/orales/${id}/sujets`}
          className="ml-auto text-sm font-bold text-hp-400"
        >
          Sujets
        </Link>
        <a href={`/profe/orales/${id}/csv`} className="text-sm font-bold text-hp-400">
          Exportar CSV
        </a>
      </header>

      <div className="flex min-h-0 flex-1">
        <Horario turnos={turnos} activoId={turnoActivo} convocatoriaId={id} />
        <section className="flex-1 overflow-y-auto p-6">
          {activo && activo.estudiante ? (
            <Panel
              // La `key` es lo que resetea el panel al cambiar de
              // estudiante: al cambiar, React desmonta y vuelve a montar el
              // árbol entero, así que su estado interno solo parte de
              // `inicial` una vez por turno. Sin esta `key`, una repintada
              // de esta página por cualquier otro motivo (p. ej. borrar un
              // turno, que llama a `revalidatePath` sobre esta misma ruta)
              // pasaría un `inicial` con la misma pinta pero de referencia
              // nueva, y un panel que reaccionara a eso pisaría lo que el
              // profesor esté escribiendo en ese momento.
              key={activo.id}
              turnoId={activo.id}
              nombre={
                [activo.estudiante.lastName, activo.estudiante.firstName]
                  .filter(Boolean)
                  .join(" ") || activo.estudiante.email
              }
              meta={[
                activo.dia,
                activo.preparacion ? `Prép. ${activo.preparacion}` : "",
                `Pasaje ${activo.hora}`,
                activo.sala ?? "",
              ].filter(Boolean)}
              sujetos={sujetos}
              inicial={{
                sujetoId: activo.evaluacion?.sujetoId ?? null,
                notas: (activo.evaluacion?.notas as Notas) ?? {},
                comentarios: (activo.evaluacion?.comentarios as Record<string, string>) ?? {},
                frases: (activo.evaluacion?.frases as Record<string, string[]>) ?? {},
                preguntadas: activo.evaluacion?.preguntadas ?? [],
                segundosEoc: activo.evaluacion?.segundosEoc ?? 0,
                segundosEoi: activo.evaluacion?.segundosEoi ?? 0,
              }}
            />
          ) : turnos.length === 0 ? (
            <form
              action={pegarHorario}
              className="max-w-xl space-y-3 rounded-tarjeta bg-white p-5 shadow-suave"
            >
              <input type="hidden" name="convocatoriaId" value={id} />
              <h2 className="font-bold text-tinta">Pega el horario del liceo</h2>
              <p className="text-sm text-tinta-suave">
                Una línea por turno, separando con tabulador o punto y coma:
                <br />
                <code className="text-xs">
                  Mercredi 20/05 ; 08h00 ; 08h15 ; HERMITE ; Rose ; CDI
                </code>
                <br />
                Una línea con <code className="text-xs">---</code> es una pausa.
              </p>
              <select
                name="grupoId"
                required
                className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
              >
                <option value="">¿Qué grupo se examina?</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              <textarea
                name="horario"
                required
                rows={10}
                className="w-full rounded-lg border border-hp-100 p-3 font-mono text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-hp-400 px-4 py-2 text-sm font-bold text-white"
              >
                Montar el horario
              </button>
            </form>
          ) : (
            <p className="text-sm text-tinta-suave">
              Elige a alguien en la lista para empezar a evaluar.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
