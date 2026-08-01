import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { analizarExpresion, esGrabada } from "@/lib/expresion";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Rubrica from "@/components/expresion/rubrica";

export const dynamic = "force-dynamic";

export default async function CorregirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const registro = await prisma.pasoCompletado.findUnique({
    where: { id },
    select: {
      entrega: true,
      valoracion: true,
      asignacionId: true,
      paso: {
        select: {
          id: true,
          titulo: true,
          ejercicios: {
            orderBy: { orden: "asc" },
            take: 1,
            select: { ejercicio: { select: { datos: true } } },
          },
        },
      },
      asignacion: {
        select: {
          profesorId: true,
          estudiante: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
  if (!registro) notFound();

  // Un profesor solo ve las suyas. Un administrador, todas. Mismo patrón
  // que `clases/[id]/page.tsx` y `orales/[id]/page.tsx`.
  if (registro.asignacion.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    notFound();
  }

  const datos = registro.paso.ejercicios[0]
    ? analizarExpresion(registro.paso.ejercicios[0].ejercicio.datos)
    : null;
  if (!datos) notFound();

  const alumno = registro.asignacion.estudiante;
  const nombre =
    [alumno.firstName, alumno.lastName].filter(Boolean).join(" ") || alumno.email;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/profe/entregas" className="text-sm font-semibold text-tinta-suave hover:text-hp-500">
        ← Entregas
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">{nombre}</h1>
      <p className="mt-1 text-tinta-suave">{registro.paso.titulo}</p>

      <p className="mt-6 rounded-tarjeta bg-fondo p-4 text-sm text-tinta">{datos.consigna}</p>

      {/*
        Lo entregado es un texto o la dirección de una grabación, y quien lo
        dice es la tarea, no lo guardado: decidir mirando la cadena sería
        adivinar. El audio es privado y la ruta que lo sirve mira la sesión,
        así que el `src` viaja con la cookie del profesor y no hace falta nada
        más aquí. `preload="none"` para no bajar los megas de todas las
        entregas al abrir la pantalla.
      */}
      {registro.entrega && (
        <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
            {esGrabada(datos) ? "Lo que grabó" : "Lo que escribió"}
          </p>
          {esGrabada(datos) ? (
            <audio controls preload="none" src={registro.entrega} className="mt-3 w-full max-w-md">
              Tu navegador no puede reproducir este audio.
            </audio>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-tinta">
              {registro.entrega}
            </p>
          )}
        </section>
      )}

      <div className="mt-6">
        <Rubrica
          asignacionId={registro.asignacionId}
          pasoId={registro.paso.id}
          criterios={datos.criterios}
          valoracion={
            (registro.valoracion as { notas: Record<string, number>; comentario: string } | null) ??
            null
          }
        />
      </div>

      {datos.modelo && (
        <section className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Texto modelo</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-tinta">{datos.modelo}</p>
        </section>
      )}
    </div>
  );
}
