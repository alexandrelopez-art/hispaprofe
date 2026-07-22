import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import {
  borrarBloque,
  crearBloque,
  desmarcarPasoHecho,
  marcarPasoHecho,
} from "@/lib/acciones";
import { notFound } from "next/navigation";
import Link from "next/link";

// Fuerza render dinámico: lee de la base en cada visita.
export const dynamic = "force-dynamic";

const tipoLabel: Record<string, string> = {
  ACTIVACION: "Activación",
  ACTIVIDAD: "Actividad",
  ANDAMIAJE: "Andamiaje",
  MICRO_TAREA: "Micro tarea",
  MACRO_TAREA: "Macro tarea",
};

const tipoStyle: Record<string, string> = {
  ACTIVACION: "bg-bloque2/25 text-tinta ring-bloque2/50",
  ACTIVIDAD: "bg-hp-100 text-hp-700 ring-hp-200",
  ANDAMIAJE: "bg-bloque1/25 text-tinta ring-bloque1/50",
  MICRO_TAREA: "bg-sol-200/70 text-tinta ring-sol-400/60",
  MACRO_TAREA: "bg-bloque3/25 text-tinta ring-bloque3/50",
};

const tipoDescripcion: Record<string, string> = {
  ACTIVACION:
    "Actividad de activación: conecta conocimientos previos e introduce el tema del recorrido.",
  ACTIVIDAD:
    "Actividad de práctica centrada en una destreza (comprensión o expresión).",
  ANDAMIAJE:
    "Andamiaje: apoyo lingüístico (léxico y gramática) que prepara para las tareas. También nutre la biblioteca del Bloque 4.",
  MICRO_TAREA:
    "Micro tarea: producción breve que integra lo trabajado en el ciclo.",
  MACRO_TAREA:
    "Macro tarea: producción final que integra todo el recorrido.",
};

type BloqueData = {
  id: string;
  tipo: string;
  texto: string | null;
  url: string | null;
  etiqueta: string | null;
};

// Renderiza un bloque según su tipo.
function BloqueContenido({ bloque }: { bloque: BloqueData }) {
  switch (bloque.tipo) {
    case "TEXTO":
      return (
        <p className="whitespace-pre-line leading-relaxed text-tinta">
          {bloque.texto}
        </p>
      );

    case "IMAGEN":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bloque.url ?? ""}
            alt={bloque.etiqueta ?? ""}
            className="w-full rounded-xl border border-hp-100"
          />
          {bloque.etiqueta && (
            <figcaption className="mt-2 text-xs text-tinta-suave">
              {bloque.etiqueta}
            </figcaption>
          )}
        </figure>
      );

    case "AUDIO":
      return (
        <div>
          {bloque.etiqueta && (
            <p className="mb-2 text-sm font-semibold text-tinta">
              {bloque.etiqueta}
            </p>
          )}
          <audio controls className="w-full" src={bloque.url ?? ""} />
        </div>
      );

    case "EMBED":
      return (
        <div>
          {bloque.etiqueta && (
            <p className="mb-2 text-sm font-semibold text-tinta">
              {bloque.etiqueta}
            </p>
          )}
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-hp-100">
            <iframe
              src={bloque.url ?? ""}
              title={bloque.etiqueta ?? "Contenido embebido"}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        </div>
      );

    case "ENLACE":
      return (
        <a
          href={bloque.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-hp-200 px-4 py-2 text-sm font-bold text-hp-600 transition hover:border-hp-400"
        >
          {bloque.etiqueta ?? bloque.url} ↗
        </a>
      );

    default:
      return null;
  }
}

export default async function PasoPage({
  params,
}: {
  params: Promise<{ pasoId: string }>;
}) {
  const { pasoId } = await params;

  const paso = await prisma.paso.findUnique({
    where: { id: pasoId },
    include: {
      recorrido: true,
      bloques: { orderBy: { orden: "asc" } },
    },
  });

  if (!paso) notFound();

  // Hermanos del mismo recorrido, ordenados, para calcular anterior/siguiente.
  const hermanos = await prisma.paso.findMany({
    where: { recorridoId: paso.recorridoId },
    orderBy: { orden: "asc" },
    select: { id: true, titulo: true },
  });

  const indice = hermanos.findIndex((p) => p.id === paso.id);
  const anterior = hermanos[indice - 1];
  const siguiente = hermanos[indice + 1];

  // Si quien mira tiene una asignación viva de este recorrido, puede marcar.
  const usuario = await getUsuarioActual();
  const asignacion = usuario
    ? await prisma.asignacion.findUnique({
        where: {
          estudianteId_recorridoId: {
            estudianteId: usuario.id,
            recorridoId: paso.recorridoId,
          },
        },
        select: { id: true, archivada: true },
      })
    : null;

  const puedeMarcar = Boolean(asignacion && !asignacion.archivada);
  const esProfe =
    usuario?.role === "PROFESOR" || usuario?.role === "ADMIN";

  const hecho = puedeMarcar
    ? Boolean(
        await prisma.pasoCompletado.findUnique({
          where: {
            asignacionId_pasoId: {
              asignacionId: asignacion!.id,
              pasoId: paso.id,
            },
          },
          select: { id: true },
        }),
      )
    : false;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/recorridos/${paso.recorridoId}`}
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← {paso.recorrido.titulo}
      </Link>

      <div className="mt-6 flex items-center gap-2 text-xs font-bold text-tinta-suave">
        <span>
          Paso {paso.orden} de {hermanos.length}
        </span>
        <span>·</span>
        <span>Ciclo {paso.ciclo}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
            tipoStyle[paso.tipo] ?? "bg-hp-50 text-tinta ring-hp-200"
          }`}
        >
          {tipoLabel[paso.tipo] ?? paso.tipo}
        </span>
        {paso.destreza && (
          <span className="rounded bg-hp-100 px-1.5 py-0.5 text-[10px] font-bold text-hp-700">
            {paso.destreza}
          </span>
        )}
      </div>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-tinta">
        {paso.titulo}
      </h1>

      <p className="mt-2 text-sm text-tinta-suave">
        {tipoDescripcion[paso.tipo] ?? ""}
      </p>

      {/* Contenido: bloques ordenados, o área reservada si aún no hay. */}
      {paso.bloques.length > 0 ? (
        <div className="mt-8 space-y-6">
          {paso.bloques.map((bloque) => (
            <div key={bloque.id} className="group relative">
              {esProfe && (
                <form
                  action={borrarBloque}
                  className="absolute -right-2 -top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <input type="hidden" name="bloqueId" value={bloque.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-hp-200 bg-white px-2 py-0.5 text-[11px] font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
                    title="Borrar bloque"
                  >
                    Borrar
                  </button>
                </form>
              )}
              <BloqueContenido bloque={bloque} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-tarjeta border border-dashed border-hp-200 bg-white p-10 text-center">
          <p className="text-sm text-tinta-suave">
            Este paso todavía no tiene contenido.
          </p>
        </div>
      )}

      {/* Editor: añadir bloque de contenido (solo profes). */}
      {esProfe && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
          <h2 className="text-lg font-bold text-tinta">Añadir contenido</h2>
          <form action={crearBloque} className="mt-3">
            <input type="hidden" name="pasoId" value={paso.id} />

            <div className="flex flex-wrap gap-3">
              <label className="text-sm font-semibold text-tinta">
                Tipo
                <select
                  name="tipo"
                  required
                  defaultValue="TEXTO"
                  className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                >
                  <option value="TEXTO">Texto</option>
                  <option value="IMAGEN">Imagen (URL)</option>
                  <option value="AUDIO">Audio (URL mp3)</option>
                  <option value="EMBED">Embed (YouTube, etc.)</option>
                  <option value="ENLACE">Enlace</option>
                </select>
              </label>

              <label className="min-w-48 flex-1 text-sm font-semibold text-tinta">
                URL (para imagen, audio, embed o enlace)
                <input
                  type="url"
                  name="url"
                  placeholder="https://..."
                  className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                />
              </label>

              <label className="min-w-48 flex-1 text-sm font-semibold text-tinta">
                Etiqueta (opcional)
                <input
                  type="text"
                  name="etiqueta"
                  placeholder="Descripción o título"
                  className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
                />
              </label>
            </div>

            <label className="mt-3 block text-sm font-semibold text-tinta">
              Texto (solo para bloques de texto)
              <textarea
                name="texto"
                rows={4}
                className="mt-1 w-full rounded-2xl border border-hp-200 bg-white px-4 py-3 text-sm font-normal text-tinta outline-none focus:border-hp-400"
              />
            </label>

            <button
              type="submit"
              className="mt-4 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
            >
              Añadir bloque
            </button>
          </form>
        </section>
      )}

      {/* Marcar como hecho: solo con asignación viva de este recorrido. */}
      {puedeMarcar && (
        <div className="mt-10 flex justify-center">
          {hecho ? (
            <form action={desmarcarPasoHecho}>
              <input type="hidden" name="pasoId" value={paso.id} />
              <button
                type="submit"
                className="rounded-full bg-bloque2 px-6 py-3 text-sm font-extrabold text-tinta transition hover:opacity-80"
                title="Pulsa para desmarcar"
              >
                Hecho ✓
              </button>
            </form>
          ) : (
            <form action={marcarPasoHecho}>
              <input type="hidden" name="pasoId" value={paso.id} />
              <button
                type="submit"
                className="rounded-full bg-hp-400 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-hp-500"
              >
                Marcar como hecho
              </button>
            </form>
          )}
        </div>
      )}

      {/* Navegación anterior / siguiente dentro del recorrido. */}
      <nav className="mt-10 flex items-stretch justify-between gap-4 border-t border-hp-100 pt-6">
        {anterior ? (
          <Link
            href={`/pasos/${anterior.id}`}
            className="group flex max-w-[45%] flex-col text-left"
          >
            <span className="text-xs text-tinta-suave">← Anterior</span>
            <span className="truncate text-sm font-semibold text-tinta group-hover:text-hp-500">
              {anterior.titulo}
            </span>
          </Link>
        ) : (
          <span />
        )}

        {siguiente ? (
          <Link
            href={`/pasos/${siguiente.id}`}
            className="group flex max-w-[45%] flex-col text-right"
          >
            <span className="text-xs text-tinta-suave">Siguiente →</span>
            <span className="truncate text-sm font-semibold text-tinta group-hover:text-hp-500">
              {siguiente.titulo}
            </span>
          </Link>
        ) : (
          <Link
            href={`/recorridos/${paso.recorridoId}`}
            className="group flex max-w-[45%] flex-col text-right"
          >
            <span className="text-xs text-tinta-suave">Fin del recorrido</span>
            <span className="truncate text-sm font-semibold text-tinta group-hover:text-hp-500">
              Volver a {paso.recorrido.titulo}
            </span>
          </Link>
        )}
      </nav>
    </div>
  );
}
