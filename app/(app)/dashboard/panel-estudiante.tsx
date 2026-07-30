import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { resumenEstudiante } from "@/lib/progreso";
import { deberesPendientes, proximaClase } from "@/lib/clases";
import { fechaCorta, fechaHora } from "@/lib/fechas";

type Usuario = { id: string; firstName: string | null; email: string };

const servicioLabel: Record<string, string> = {
  RECORRIDO: "Clases particulares",
  PREPARACION: "Preparación DELE",
};

/** Distancia en palabras, sin librerías. Solo días completos. */
function haceCuanto(fecha: Date): string {
  const dias = Math.floor((Date.now() - fecha.getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  const semanas = Math.floor(dias / 7);
  if (semanas === 1) return "hace una semana";
  if (semanas < 5) return `hace ${semanas} semanas`;
  const meses = Math.max(1, Math.floor(dias / 30));
  return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
}

export default async function PanelEstudiante({
  usuario,
}: {
  usuario: Usuario;
}) {
  const saludo = `Hola, ${usuario.firstName ?? usuario.email}`;

  const [resumen, asignaciones, proxima, deberes] = await Promise.all([
    resumenEstudiante(usuario.id),
    prisma.asignacion.findMany({
      where: { estudianteId: usuario.id, archivada: false },
      orderBy: { createdAt: "desc" },
      include: {
        recorrido: {
          select: {
            id: true,
            titulo: true,
            tipo: true,
            _count: { select: { pasos: true } },
          },
        },
        _count: { select: { completados: true } },
      },
    }),
    proximaClase(usuario.id),
    deberesPendientes(usuario.id),
  ]);

  // Sin secuencias y sin puntos no hay nada que contar: se salta la hucha
  // para no recibir a alguien nuevo con un cero.
  const mostrarHucha = asignaciones.length > 0 || resumen.pasosRevisados > 0;
  // Las bandejas solo hablan de trabajo vivo. Si todas las asignaciones
  // están archivadas, la hucha puede tener puntos y aun así no hay nada
  // que enseñar aquí sin contradecirla con un "no hay nada" a su lado.
  const mostrarBandejas = asignaciones.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        {saludo}
      </h1>

      {proxima && (
        <section className="mt-8 rounded-tarjeta border border-hp-200 bg-hp-50 p-6 shadow-suave">
          <h2 className="text-xs font-bold uppercase tracking-wider text-hp-700">
            Tu próxima clase
          </h2>
          <p className="mt-2 text-lg font-bold text-tinta">
            {fechaHora(proxima.empiezaEl)}, con {proxima.profesor}
          </p>
          {proxima.donde && (
            <p className="mt-1 text-sm text-tinta-suave">{proxima.donde}</p>
          )}
          {proxima.enlace && (
            <a
              href={proxima.enlace}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block h-10 rounded-full bg-hp-400 px-5 text-sm font-bold leading-10 text-white transition-colors hover:bg-hp-500"
            >
              Entrar a la clase
            </a>
          )}
        </section>
      )}

      {deberes.length > 0 && (
        <section className="mt-4 rounded-tarjeta border border-sol-300 bg-sol-100 p-5 shadow-suave">
          <h2 className="text-xs font-bold uppercase tracking-wider text-tinta">
            Deberes de tu profe
          </h2>
          <ul className="mt-3 space-y-3">
            {deberes.map((d) => (
              <li key={d.id}>
                {/* break-words: una URL pegada sin espacios desborda la tarjeta. */}
                <p className="whitespace-pre-line break-words text-sm text-tinta">
                  {d.texto}
                </p>
                <p className="mt-1 text-xs text-tinta-suave">
                  de la clase del {fechaCorta(d.claseEl)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-tinta-suave">
            Los quita tu profe cuando los da por hechos.
          </p>
        </section>
      )}

      {mostrarHucha && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          {resumen.pasosRevisados === 0 ? (
            <>
              <p className="text-lg font-bold text-tinta">
                Aún no tienes puntos.
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                Se ganan cuando tu profe revisa un paso.
              </p>
            </>
          ) : (
            <>
              <p className="text-5xl font-extrabold leading-none text-tinta">
                {resumen.puntosTotales}
                <span className="ml-2 text-lg font-bold text-tinta-suave">
                  puntos
                </span>
              </p>
              <p className="mt-2 text-sm text-tinta-suave">
                {resumen.pasosRevisados} paso
                {resumen.pasosRevisados !== 1 ? "s" : ""} revisado
                {resumen.pasosRevisados !== 1 ? "s" : ""} por tu profe
              </p>
            </>
          )}
        </section>
      )}

      {mostrarBandejas && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
              Esperando revisión
            </h2>
            {resumen.esperandoRevision.length === 0 ? (
              <p className="mt-3 text-sm text-tinta-suave">
                No tienes nada pendiente de revisión.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {resumen.esperandoRevision.map((paso) => (
                  <li key={paso.pasoId}>
                    <Link
                      href={`/pasos/${paso.pasoId}`}
                      className="block rounded-xl bg-fondo px-3 py-2 transition hover:bg-hp-50"
                    >
                      <p className="truncate text-sm font-semibold text-tinta">
                        {paso.pasoTitulo}
                      </p>
                      <p className="truncate text-xs text-tinta-suave">
                        {paso.recorridoTitulo} · entregado{" "}
                        {haceCuanto(paso.fecha)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
            <h2 className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
              Tu profe ha revisado
            </h2>
            {resumen.revisadosRecientes.length === 0 ? (
              <p className="mt-3 text-sm text-tinta-suave">
                Todavía no hay nada revisado.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {resumen.revisadosRecientes.map((paso) => (
                  <li key={paso.pasoId}>
                    <Link
                      href={`/pasos/${paso.pasoId}`}
                      className="flex items-center gap-3 rounded-xl bg-fondo px-3 py-2 transition hover:bg-hp-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-tinta">
                          {paso.pasoTitulo}
                        </span>
                        <span className="block truncate text-xs text-tinta-suave">
                          {paso.recorridoTitulo} · {haceCuanto(paso.fecha)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-sol-300 px-2.5 py-0.5 text-xs font-extrabold text-tinta">
                        {paso.puntos ?? 0} pts
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Tus secuencias</h2>

      {asignaciones.length === 0 ? (
        <p className="mt-3 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          Todavía no tienes secuencias asignadas. Tu profe te las asigna desde
          aquí.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {asignaciones.map((asignacion) => {
            const total = asignacion.recorrido._count.pasos;
            const hechos = asignacion._count.completados;
            const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;

            return (
              <li key={asignacion.id}>
                <Link
                  href={`/recorridos/${asignacion.recorrido.id}`}
                  className="block rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave">
                    {servicioLabel[asignacion.recorrido.tipo] ??
                      asignacion.recorrido.tipo}
                  </p>
                  <p className="mt-1 font-bold text-tinta">
                    {asignacion.recorrido.titulo}
                  </p>
                  {asignacion.nota && (
                    <p className="mt-1 text-sm text-tinta-suave">
                      {asignacion.nota}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-hp-50">
                      <div
                        className="h-full rounded-full bg-bloque2"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-bold text-tinta-suave">
                      {hechos}/{total}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
