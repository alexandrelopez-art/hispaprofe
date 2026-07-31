import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { CRITERIOS } from "@/lib/orales/criterios";
import { calcularTotal, fmtNota, fmtTiempo, fmtTotal, hayNotaPuesta, notaDe } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export const dynamic = "force-dynamic";

/**
 * La ficha imprimible del examen oral. Página propia, sin cabecera ni
 * barra lateral de la aplicación, para poder guardarla en PDF o abrirla
 * en una pestaña aparte desde el panel.
 *
 * Vive en el grupo de rutas `(imprimible)` y no en `(app)` a propósito: la
 * URL es la misma (`/profe/orales/evaluacion/[id]/ficha`, los grupos no
 * la tocan), pero así no hereda `app/(app)/layout.tsx` — logo, menú y
 * `UserButton` incluidos —, que de otro modo saldría impreso encima de la
 * nota del alumno y podría tirar la ficha a una segunda página. Es el
 * problema simétrico del `display:none` que se comía la tira de tiempos
 * en el HTML original: aquí lo que sobra no debe imprimirse, y esconderlo
 * a base de CSS habría sido tan frágil como aquello.
 */
export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Mismo patrón que el resto de pantallas de profe: redirigir por el rol,
  // no lanzar. `exigirProfesor()` está pensado para acciones de servidor;
  // aquí no hay `error.tsx` que atrape el throw.
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

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

  // `null` y no `0`: un examen que no se cronometró no duró cero segundos,
  // y una evaluación recién creada (con el `sujetoId` ya guardado por el
  // autoguardado, pero sin ninguna nota) no tiene un «0,0 / 20» de verdad.
  const tiempo = (segundos: number | null) => (segundos === null ? "—" : fmtTiempo(segundos));

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
          {hayNotaPuesta(notas) ? fmtTotal(calcularTotal(notas)) : "—"}
          <span className="text-base font-semibold text-tinta-suave"> / 20</span>
        </span>
      </header>

      {/* La tira de tiempos. En el HTML original se perdía al imprimir:
          una regla `display:none` de pantalla ganaba a la de @media print. */}
      <div className="tiempos mt-3 flex gap-6 text-sm">
        <span>EOC <b className="font-mono">{tiempo(evaluacion.segundosEoc)}</b></span>
        <span>EOI <b className="font-mono">{tiempo(evaluacion.segundosEoi)}</b></span>
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
        {CRITERIOS.map((c) => {
          const valor = notaDe(notas, c.key);
          return (
            <div
              key={c.key}
              className="break-inside-avoid border-l-4 border-hp-100 pl-3"
              style={{ borderLeftColor: `var(--color-${c.color})` }}
            >
              <p className="text-sm font-bold">
                {c.romano} {c.titulo}{" "}
                <span className="tabular-nums">
                  {valor !== null ? fmtNota(valor) : "—"} / {fmtNota(c.maximo)}
                </span>
              </p>
              {comentarios[c.key] && (
                <p className="text-xs text-tinta-suave">{comentarios[c.key]}</p>
              )}
            </div>
          );
        })}
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
