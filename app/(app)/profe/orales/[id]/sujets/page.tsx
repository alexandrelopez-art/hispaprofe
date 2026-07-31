import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { borrarSujeto, crearSujeto } from "@/lib/acciones-orales";
import SubirDocumento from "@/components/orales/subir-documento";

export const dynamic = "force-dynamic";

export default async function SujetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirProfesor();
  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id },
    select: { id: true, nombre: true, profesorId: true },
  });
  if (!convocatoria) notFound();
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") notFound();

  const sujetos = await prisma.sujeto.findMany({
    where: { convocatoriaId: id },
    orderBy: { numero: "asc" },
    select: {
      id: true,
      numero: true,
      eje: true,
      titulo: true,
      imagenId: true,
      _count: { select: { evaluaciones: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-extrabold text-tinta">
        Sujets · {convocatoria.nombre}
      </h1>

      <form
        action={crearSujeto}
        className="mt-5 space-y-3 rounded-tarjeta bg-white p-5 shadow-suave"
      >
        <input type="hidden" name="convocatoriaId" value={id} />
        <div className="flex gap-3">
          <input
            name="numero"
            type="number"
            min={1}
            required
            placeholder="Nº"
            className="w-20 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
          <input
            name="eje"
            required
            placeholder="Eje (Arte y poder)"
            className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
        </div>
        <input
          name="titulo"
          required
          placeholder="Título del documento"
          className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <textarea
          name="descripcion"
          rows={2}
          placeholder="De qué es la imagen"
          className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <input
            name="fuente"
            placeholder="Fuente (BBC Mundo)"
            className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
          <input
            name="url"
            type="url"
            placeholder="https://…"
            className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          name="preguntas"
          rows={5}
          placeholder="Una pregunta de interacción por línea"
          className="w-full rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <SubirDocumento />
        <button
          type="submit"
          className="rounded-lg bg-hp-400 px-4 py-2 text-sm font-bold text-white"
        >
          Añadir el sujet
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {sujetos.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-tarjeta bg-white p-3 shadow-suave"
          >
            <span className="w-8 text-center font-extrabold text-tinta">{s.numero}</span>
            <span className="flex-1">
              <span className="block font-bold text-tinta">{s.titulo}</span>
              <span className="text-xs text-tinta-suave">{s.eje}</span>
            </span>
            {s._count.evaluaciones === 0 && (
              <form action={borrarSujeto}>
                <input type="hidden" name="sujetoId" value={s.id} />
                <button type="submit" className="text-xs font-bold text-coral-500">
                  Borrar
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
