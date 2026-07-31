import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Destreza, Nivel } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

// WIDGET no está: Recursos no lo gestiona (no tiene `datos.ejercicio` ni
// editor propio, y su página da 404). Esta tabla también hace de lista de
// tipos válidos para el filtro de la URL, así que basta con no ponerlo aquí
// para que desaparezca del desplegable y de la consulta a la vez.
const tipoLabel: Record<string, string> = {
  OPCION_MULTIPLE: "Opción",
  HUECOS: "Huecos",
  RELACIONAR: "Relacionar",
  ORDENAR: "Ordenar",
};

// Solo para pintar el desplegable: los valores válidos salen del enum
// generado, no de esta tabla.
const destrezaLabel: Record<string, string> = {
  CE: "Comprensión escrita",
  CO: "Comprensión oral",
  EE: "Expresión escrita",
  EO: "Expresión oral",
  EEI: "Interacción escrita",
  EOI: "Interacción oral",
};

export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{
    nivel?: string;
    destreza?: string;
    tipo?: string;
    estado?: string;
    q?: string;
  }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { nivel, destreza, tipo, estado, q } = await searchParams;

  // Los filtros vienen de la URL, no de un <select> que el servidor
  // controle: alguien puede teclear cualquier cosa. Un valor que no exista
  // en el enum generado revienta a Prisma con un `PrismaClientValidationError`
  // (un 500) en vez de ignorarse. Se comprueba con `Object.hasOwn` contra el
  // propio enum, igual que ya hace `guardarEjercicio` en
  // `lib/acciones-recursos.ts`.
  const nivelValido = nivel && Object.hasOwn(Nivel, nivel) ? nivel : undefined;
  const destrezaValida =
    destreza && Object.hasOwn(Destreza, destreza) ? destreza : undefined;
  const tipoValido = tipo && Object.hasOwn(tipoLabel, tipo) ? tipo : undefined;

  const where: Prisma.EjercicioWhereInput = {
    // Sin filtro de tipo, se excluye WIDGET siempre: Recursos no lo
    // gestiona. `tipoValido` ya descarta un `?tipo=WIDGET` escrito a mano,
    // porque WIDGET no está en `tipoLabel`.
    tipo: tipoValido
      ? (tipoValido as Prisma.EnumTipoEjercicioFilter["equals"])
      : { not: "WIDGET" },
    ...(nivelValido ? { nivel: nivelValido as Prisma.EnumNivelFilter["equals"] } : {}),
    // `destreza` es opcional en la tabla, así que su filtro es el «nullable»:
    // pedir una destreza deja fuera los que no tienen ninguna, que es lo que
    // se espera al elegirla en el desplegable.
    ...(destrezaValida ? { destreza: destrezaValida as Destreza } : {}),
    ...(estado === "publicado" ? { publicado: true } : {}),
    ...(estado === "borrador" ? { publicado: false } : {}),
    ...(q ? { titulo: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const ejercicios = await prisma.ejercicio.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titulo: true,
      tipo: true,
      nivel: true,
      destreza: true,
      publicado: true,
      _count: { select: { pasos: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-tinta">Recursos</h1>
        <Link
          href="/profe/recursos/nuevo"
          className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold leading-[2.75rem] text-white hover:bg-hp-500"
        >
          Nuevo ejercicio
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por título"
          className="h-10 flex-1 rounded-full border border-hp-200 px-4 text-sm text-tinta outline-none focus:border-hp-400"
        />
        <select name="nivel" defaultValue={nivel ?? ""} className="h-10 rounded-full border border-hp-200 px-4 text-sm">
          <option value="">Todos los niveles</option>
          {["A1", "A2", "B1", "B2", "C1", "A2_B1_ESCOLAR"].map((n) => (
            <option key={n} value={n}>
              {n === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : n}
            </option>
          ))}
        </select>
        <select name="destreza" defaultValue={destreza ?? ""} className="h-10 rounded-full border border-hp-200 px-4 text-sm">
          <option value="">Todas las destrezas</option>
          {Object.entries(destrezaLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className="h-10 rounded-full border border-hp-200 px-4 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(tipoLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={estado ?? ""} className="h-10 rounded-full border border-hp-200 px-4 text-sm">
          <option value="">Todos</option>
          <option value="publicado">Publicados</option>
          <option value="borrador">Borradores</option>
        </select>
        <button type="submit" className="h-10 rounded-full border border-hp-200 px-5 text-sm font-bold text-tinta hover:border-hp-400">
          Filtrar
        </button>
      </form>

      {ejercicios.length === 0 ? (
        <p className="mt-8 rounded-tarjeta border border-dashed border-hp-200 p-10 text-center text-tinta-suave">
          No hay ningún ejercicio que encaje.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {ejercicios.map((e) => (
            <li key={e.id}>
              <Link
                href={`/profe/recursos/${e.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hp-100 bg-white px-4 py-3 shadow-suave transition hover:border-hp-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-tinta">{e.titulo}</p>
                  <p className="truncate text-xs text-tinta-suave">
                    {tipoLabel[e.tipo] ?? e.tipo} · {e.nivel}
                    {e.destreza ? ` · ${e.destreza}` : ""} ·{" "}
                    {e._count.pasos === 0
                      ? "sin usar"
                      : `en ${e._count.pasos} paso${e._count.pasos !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    e.publicado ? "bg-hp-100 text-hp-700" : "bg-sol-100 text-tinta"
                  }`}
                >
                  {e.publicado ? "Publicado" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
