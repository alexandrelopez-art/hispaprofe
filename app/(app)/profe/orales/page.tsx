import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { archivarConvocatoria, crearConvocatoria } from "@/lib/acciones-orales";

export const dynamic = "force-dynamic";

export default async function OralesPage() {
  // Mismo patrón que el resto de pantallas de profe (ver clases/page.tsx):
  // `redirect`, no un `exigirProfesor()` que lanza. No hay `error.tsx` en la
  // app, así que un estudiante que teclee esta URL vería la pantalla de
  // error cruda de Next en vez de que lo mandaran al dashboard.
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }
  const convocatorias = await prisma.convocatoria.findMany({
    where: usuario.role === "ADMIN" ? {} : { profesorId: usuario.id },
    orderBy: [{ archivada: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nombre: true,
      archivada: true,
      createdAt: true,
      _count: { select: { turnos: true, sujetos: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-tinta">Evaluación oral</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Cada convocatoria es un examen con su horario, sus sujets y sus notas.
      </p>

      <form
        action={crearConvocatoria}
        className="mt-6 flex gap-2 rounded-tarjeta bg-white p-4 shadow-suave"
      >
        <input
          name="nombre"
          required
          maxLength={120}
          placeholder="Oral de Terminale · SJDP · mayo 2026"
          className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-hp-400 px-4 py-2 text-sm font-bold text-white"
        >
          Convocar
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {convocatorias.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-tarjeta bg-white p-4 shadow-suave"
          >
            <Link href={`/profe/orales/${c.id}`} className="flex-1">
              <span className="font-bold text-tinta">{c.nombre}</span>
              <span className="ml-2 text-xs text-tinta-suave">
                {c._count.turnos} turnos · {c._count.sujetos} sujets
              </span>
              {c.archivada && (
                <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-xs text-tinta-suave">
                  archivada
                </span>
              )}
            </Link>
            <form action={archivarConvocatoria}>
              <input type="hidden" name="convocatoriaId" value={c.id} />
              <button
                type="submit"
                className="text-xs font-bold text-tinta-suave hover:text-tinta"
              >
                {c.archivada ? "Desarchivar" : "Archivar"}
              </button>
            </form>
          </li>
        ))}
      </ul>

      {convocatorias.length === 0 && (
        <p className="mt-6 text-sm text-tinta-suave">
          Todavía no hay ninguna. Ponle nombre arriba y entra a montar el horario.
        </p>
      )}
    </main>
  );
}
