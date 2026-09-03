import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { archivarConvocatoria, crearConvocatoria } from "@/lib/acciones-orales";
import BotonEnviar from "@/components/ui/boton-enviar";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

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
      <Encabezado
        titulo="Evaluación oral"
        lede="Cada convocatoria es un examen con su horario, sus sujets y sus notas."
      />

      <form action={crearConvocatoria}>
        <Tarjeta className="flex gap-2 p-4">
          <input
            name="nombre"
            required
            maxLength={120}
            placeholder="Oral de Terminale · SJDP · mayo 2026"
            className="flex-1 rounded-lg border border-hp-100 px-3 py-2 text-sm"
          />
          <BotonEnviar gerundio="Convocando…">Convocar</BotonEnviar>
        </Tarjeta>
      </form>

      <ul className="mt-6 space-y-2">
        {convocatorias.map((c) => (
          <li key={c.id}>
            <Tarjeta className="flex items-center gap-3 p-4">
              <Link href={`/profe/orales/${c.id}`} className="flex-1">
                <span className="font-bold text-tinta">{c.nombre}</span>
                <span className="ml-2 text-xs text-tinta-suave">
                  {c._count.turnos} turnos · {c._count.sujetos} sujets
                </span>
                {c.archivada && (
                  <Etiqueta tono="neutro" className="ml-2">
                    archivada
                  </Etiqueta>
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
            </Tarjeta>
          </li>
        ))}
      </ul>

      {convocatorias.length === 0 && (
        <Vacio className="mt-6">
          Todavía no hay ninguna. Ponle nombre arriba y entra a montar el horario.
        </Vacio>
      )}
    </main>
  );
}
