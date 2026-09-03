import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/lib/generated/prisma/client";
import { servicioLabel } from "@/lib/servicios";
import { getUsuarioActual } from "@/lib/usuario";
import { NIVELES, nombreNivel } from "@/lib/niveles";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";
import { tipoLabel, tipoTono } from "@/lib/tipos-de-paso";

export const dynamic = "force-dynamic";

// Orden fijo para que la composición se lea siempre igual.
const TIPOS = [
  "ACTIVACION",
  "ACTIVIDAD",
  "ANDAMIAJE",
  "MICRO_TAREA",
  "MACRO_TAREA",
] as const;

export default async function RecorridosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nivel?: string; servicio?: string }>;
}) {
  const { q = "", nivel = "", servicio = "" } = await searchParams;

  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");
  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";

  const where: Prisma.RecorridoWhereInput = {};
  if (servicio) where.tipo = servicio as Prisma.RecorridoWhereInput["tipo"];
  if (nivel) where.nivel = nivel as Prisma.RecorridoWhereInput["nivel"];
  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
    ];
  }
  if (!esProfe) where.publicado = true;

  const recorridos = await prisma.recorrido.findMany({
    where,
    orderBy: [{ tipo: "asc" }, { orden: "asc" }],
    include: { pasos: { select: { tipo: true, ciclo: true } } },
  });

  const hayFiltro = Boolean(q || nivel || servicio);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Encabezado
        titulo="Secuencias"
        lede="Busca una secuencia lista y ábrela para ver sus pasos."
      />

      <form className="mt-8 flex flex-wrap items-end gap-4">
        <Campo
          etiqueta="Buscar"
          name="q"
          defaultValue={q}
          placeholder="Buscar por título o tema"
          className="min-w-56 flex-1"
        />
        <Campo
          etiqueta="Servicio"
          name="servicio"
          tipo="elegir"
          defaultValue={servicio}
          opciones={[
            { valor: "", nombre: "Todos los servicios" },
            { valor: "CLASES_PARTICULARES", nombre: servicioLabel.CLASES_PARTICULARES },
            { valor: "PREPARACION_DELE", nombre: servicioLabel.PREPARACION_DELE },
          ]}
        />
        <Campo
          etiqueta="Nivel"
          name="nivel"
          tipo="elegir"
          defaultValue={nivel}
          opciones={[{ valor: "", nombre: "Todos los niveles" }, ...NIVELES]}
        />
        <BotonEnviar gerundio="Buscando…">Buscar</BotonEnviar>
        {hayFiltro && (
          <Link
            href="/recorridos"
            className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
          >
            Limpiar
          </Link>
        )}
      </form>

      <p className="mt-6 text-sm text-tinta-suave">
        {recorridos.length} secuencia{recorridos.length !== 1 ? "s" : ""}
        {hayFiltro ? " encontrada" : " disponible"}
        {recorridos.length !== 1 ? "s" : ""}.
      </p>

      {recorridos.length === 0 ? (
        <Vacio>Ninguna secuencia coincide con la búsqueda.</Vacio>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {recorridos.map((recorrido) => {
            const total = recorrido.pasos.length;
            const ciclos = new Set(recorrido.pasos.map((p) => p.ciclo)).size;
            const composicion = TIPOS.map((tipo) => ({
              tipo,
              n: recorrido.pasos.filter((p) => p.tipo === tipo).length,
            })).filter((c) => c.n > 0);

            return (
              <Tarjeta
                key={recorrido.id}
                href={`/recorridos/${recorrido.id}`}
                className="flex flex-col"
              >
                <div className="flex items-center justify-between gap-3">
                  <Rotulo>{servicioLabel[recorrido.tipo] ?? recorrido.tipo}</Rotulo>
                  <Etiqueta tono="hp" className="shrink-0">
                    {nombreNivel(recorrido.nivel) || recorrido.nivel}
                  </Etiqueta>
                </div>

                <h2 className="mt-2 line-clamp-2 text-lg font-bold text-tinta">
                  {recorrido.titulo}
                </h2>
                {recorrido.descripcion && (
                  <p className="mt-1 line-clamp-2 text-sm text-tinta-suave">
                    {recorrido.descripcion}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  <p className="text-xs font-semibold text-tinta-suave">
                    {total} paso{total !== 1 ? "s" : ""} · {ciclos} ciclo
                    {ciclos !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {composicion.map(({ tipo, n }) => (
                      <Etiqueta key={tipo} tono={tipoTono[tipo] ?? "hp"}>
                        {n} {tipoLabel[tipo]}
                      </Etiqueta>
                    ))}
                  </div>
                </div>
              </Tarjeta>
            );
          })}
        </div>
      )}
    </div>
  );
}
