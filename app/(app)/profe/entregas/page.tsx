import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { analizarExpresion, seOyeLaEntrega } from "@/lib/expresion";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

function nombreDe(u: { firstName: string | null; lastName: string | null; email: string }) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function EntregasPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  // Entregado y sin corregir. Producen entrega las escritas y las orales que
  // el alumno graba, así que filtrar por `entrega` deja fuera justo lo que no
  // se corrige aquí —la oral de clase— sin tener que mirar el tipo.
  // La partición por profesor es la misma que en `orales/page.tsx` y
  // `clases/page.tsx`: un profesor solo ve lo suyo, un administrador lo ve
  // todo. Sin esto, un segundo profesor vería las entregas del primero.
  const pendientes = await prisma.pasoCompletado.findMany({
    where: {
      entrega: { not: null },
      verificadoEl: null,
      ...(usuario.role === "ADMIN" ? {} : { asignacion: { profesorId: usuario.id } }),
    },
    orderBy: { completadoEl: "asc" },
    select: {
      id: true,
      completadoEl: true,
      // Para saber cuáles piden auriculares antes de sentarse a corregir. La
      // regla es la misma que decide el reproductor en la pantalla de
      // corrección: la tarea tiene que ser grabada **y** lo entregado tiene
      // que ser una grabación, porque `entrega` es texto que escribe el
      // alumno y podría empezar por lo que sea.
      entrega: true,
      paso: {
        select: {
          id: true,
          titulo: true,
          recorrido: { select: { titulo: true } },
          ejercicios: {
            orderBy: { orden: "asc" },
            take: 1,
            select: { ejercicio: { select: { datos: true } } },
          },
        },
      },
      asignacion: {
        select: {
          estudiante: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">Entregas</h1>
      <p className="mt-2 text-tinta-suave">
        Lo que está esperando corrección. Las orales que el alumno graba y
        manda salen aquí; las de clase no, porque no hay entrega y se corrigen
        desde la ficha del alumno o desde la clase.
      </p>

      {pendientes.length === 0 ? (
        <p className="mt-8 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          No hay nada esperando.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {pendientes.map((p) => {
            const datos = p.paso.ejercicios[0]
              ? analizarExpresion(p.paso.ejercicios[0].ejercicio.datos)
              : null;
            const suena = datos ? seOyeLaEntrega(datos, p.entrega) : false;
            return (
            <li key={p.id}>
              <Link
                href={`/profe/entregas/${p.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">
                    {nombreDe(p.asignacion.estudiante)}
                  </p>
                  <p className="truncate text-xs text-tinta-suave">
                    {p.paso.recorrido.titulo} · {p.paso.titulo}
                  </p>
                </div>
                {suena && (
                  <span className="shrink-0 rounded-full bg-sol-100 px-2.5 py-0.5 text-[11px] font-bold text-tinta">
                    Audio
                  </span>
                )}
                <span className="shrink-0 text-xs text-tinta-suave">
                  {formatoFecha.format(p.completadoEl)}
                </span>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
