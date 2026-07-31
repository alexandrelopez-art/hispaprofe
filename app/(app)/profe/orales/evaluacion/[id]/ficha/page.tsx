import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { CRITERIOS } from "@/lib/orales/criterios";
import { calcularTotal, fmtNota, fmtTiempo, fmtTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export const dynamic = "force-dynamic";

/**
 * La ficha imprimible del examen oral. Página propia, sin cabecera ni
 * barra lateral de la aplicación, para poder guardarla en PDF o abrirla
 * en una pestaña aparte desde el panel.
 */
export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirProfesor();

  const evaluacion = await prisma.evaluacionOral.findUnique({
    where: { id },
    select: {
      notas: true,
      comentarios: true,
      segundosEoc: true,
      segundosEoi: true,
      sujeto: { select: { numero: true, titulo: true, eje: true, imagenId: true } },
      turno: {
        select: {
          dia: true, hora: true, sala: true,
          convocatoria: { select: { nombre: true, profesorId: true } },
          estudiante: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
  if (!evaluacion) notFound();
  // No basta con que exista la evaluación: la convocatoria de su turno
  // tiene que ser de quien pide la ficha, o de un administrador.
  if (
    evaluacion.turno.convocatoria.profesorId !== usuario.id &&
    usuario.role !== "ADMIN"
  ) {
    notFound();
  }

  const notas = (evaluacion.notas as Notas) ?? {};
  const comentarios = (evaluacion.comentarios as Record<string, string>) ?? {};
  const alumno = evaluacion.turno.estudiante;

  return (
    <main className="ficha mx-auto max-w-[210mm] bg-white p-8 text-tinta">
      <header className="flex items-end justify-between border-b border-hp-100 pb-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {[alumno?.lastName, alumno?.firstName].filter(Boolean).join(" ") ||
              alumno?.email}
          </h1>
          <p className="text-xs text-tinta-suave">
            {evaluacion.turno.convocatoria.nombre} · {evaluacion.turno.dia}{" "}
            {evaluacion.turno.hora} {evaluacion.turno.sala ?? ""}
          </p>
        </div>
        <span className="text-3xl font-extrabold tabular-nums">
          {fmtTotal(calcularTotal(notas))}
          <span className="text-base font-semibold text-tinta-suave"> / 20</span>
        </span>
      </header>

      {/* La tira de tiempos. En el HTML original se perdía al imprimir:
          una regla `display:none` de pantalla ganaba a la de @media print. */}
      <div className="tiempos mt-3 flex gap-6 text-sm">
        <span>EOC <b className="font-mono">{fmtTiempo(evaluacion.segundosEoc ?? 0)}</b></span>
        <span>EOI <b className="font-mono">{fmtTiempo(evaluacion.segundosEoi ?? 0)}</b></span>
      </div>

      {evaluacion.sujeto && (
        <section className="mt-4 flex gap-4">
          {evaluacion.sujeto.imagenId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/archivos/${evaluacion.sujeto.imagenId}`}
              alt=""
              className="w-28 rounded border border-hp-100"
            />
          )}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-tinta-suave">
              {evaluacion.sujeto.eje} · Doc. {evaluacion.sujeto.numero}
            </p>
            <p className="font-bold">{evaluacion.sujeto.titulo}</p>
          </div>
        </section>
      )}

      <section className="mt-4 space-y-2">
        {CRITERIOS.map((c) => (
          <div
            key={c.key}
            className="break-inside-avoid border-l-4 border-hp-100 pl-3"
            style={{ borderLeftColor: `var(--color-${c.color})` }}
          >
            <p className="text-sm font-bold">
              {c.romano} {c.titulo}{" "}
              <span className="tabular-nums">
                {notas[c.key] !== undefined ? fmtNota(notas[c.key] as number) : "—"} /{" "}
                {fmtNota(c.maximo)}
              </span>
            </p>
            {comentarios[c.key] && (
              <p className="text-xs text-tinta-suave">{comentarios[c.key]}</p>
            )}
          </div>
        ))}
      </section>

      {comentarios.general && (
        <section className="mt-4 break-inside-avoid border-l-4 pl-3" style={{ borderLeftColor: "var(--color-sol-300)" }}>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-tinta-suave">
            Comentario general
          </p>
          <p className="text-sm">{comentarios.general}</p>
        </section>
      )}
    </main>
  );
}
