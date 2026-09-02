import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Boton from "@/components/ui/boton";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";
import { deberesPendientes, proximaClase } from "@/lib/clases";
import { fechaCorta, fechaHora } from "@/lib/fechas";
import { resumenEstudiante } from "@/lib/progreso";
import { servicioLabel } from "@/lib/servicios";

type Usuario = { id: string; firstName: string | null; email: string };

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

export default async function ClasesEstudiante({
  usuario,
}: {
  usuario: Usuario;
}) {
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

  // Las bandejas solo hablan de trabajo vivo: si todas las asignaciones
  // están archivadas no hay nada que enseñar aquí.
  const mostrarBandejas = asignaciones.length > 0;

  return (
    <>
      <Encabezado
        titulo="Mis clases"
        lede="Lo que toca, lo que hay que entregar y lo que ya has hecho."
      />

      {proxima ? (
        <Tarjeta titulo="Tu próxima clase" acento="hp" className="mb-4">
          <p className="text-lg font-bold text-tinta">
            {fechaHora(proxima.empiezaEl)}, con {proxima.profesor}
          </p>
          {proxima.donde && (
            <p className="mt-1 text-sm text-tinta-suave">{proxima.donde}</p>
          )}
          {proxima.enlace && (
            <Boton
              variante="sutil"
              tamano="pequeno"
              href={proxima.enlace}
              target="_blank"
              rel="noreferrer"
              className="mt-4"
            >
              Entrar a la clase
            </Boton>
          )}
        </Tarjeta>
      ) : (
        <Vacio>Sin clase programada</Vacio>
      )}

      {deberes.length > 0 && (
        <Tarjeta titulo="Deberes pendientes" acento="sol" className="mt-4">
          <ul className="space-y-3">
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
        </Tarjeta>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Tus secuencias</h2>

      {asignaciones.length === 0 ? (
        <div className="mt-3">
          <Vacio>Tu profe todavía no te ha asignado nada.</Vacio>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {asignaciones.map((asignacion) => {
            const total = asignacion.recorrido._count.pasos;
            const hechos = asignacion._count.completados;

            return (
              <li key={asignacion.id}>
                <Tarjeta href={`/recorridos/${asignacion.recorrido.id}`}>
                  <Etiqueta>
                    {servicioLabel[asignacion.recorrido.tipo] ??
                      asignacion.recorrido.tipo}
                  </Etiqueta>
                  <p className="mt-2 font-bold text-tinta">
                    {asignacion.recorrido.titulo}
                  </p>
                  {asignacion.nota && (
                    <p className="mt-1 text-sm text-tinta-suave">
                      {asignacion.nota}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-bold text-tinta-suave">
                    {hechos} de {total} pasos
                  </p>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {mostrarBandejas && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Tarjeta titulo="Entregado, esperando corrección">
            {resumen.esperandoRevision.length === 0 ? (
              <p className="text-sm text-tinta-suave">
                No tienes nada pendiente de revisión.
              </p>
            ) : (
              <ul className="space-y-2">
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
          </Tarjeta>

          <Tarjeta titulo="Revisado">
            {resumen.revisadosRecientes.length === 0 ? (
              <p className="text-sm text-tinta-suave">
                Todavía no hay nada revisado.
              </p>
            ) : (
              <ul className="space-y-2">
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
          </Tarjeta>
        </div>
      )}
    </>
  );
}
