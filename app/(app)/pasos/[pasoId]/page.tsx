import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { desmarcarPasoHecho, marcarPasoHecho, renombrarPaso } from "@/lib/acciones";
import BloqueEditable from "./bloque-editable";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditorBloques from "./editor-bloques";
import TextoRico from "@/components/texto-rico";
import Ejercicio from "@/components/ejercicios/ejercicio";
import { analizar, corregir, versionPublica } from "@/lib/ejercicios/registro";
import type { Respuestas } from "@/lib/ejercicios/tipos";

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

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
});

type BloqueData = {
  id: string;
  tipo: string;
  texto: string | null;
  url: string | null;
  etiqueta: string | null;
  imagen: string | null;
};

/** Los audios de Drive van en iframe, pero no necesitan alto de vídeo. */
function esAudioDeDrive(url: string | null): boolean {
  return Boolean(url && url.includes("drive.google.com") && url.endsWith("/preview"));
}

// Renderiza un bloque según su tipo.
function BloqueContenido({ bloque }: { bloque: BloqueData }) {
  switch (bloque.tipo) {
    case "TEXTO":
      return <TextoRico>{bloque.texto ?? ""}</TextoRico>;

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
          <audio controls preload="metadata" className="w-full" src={bloque.url ?? ""}>
            <a href={bloque.url ?? "#"} target="_blank" rel="noopener noreferrer">
              Abrir el audio
            </a>
          </audio>
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
          <div
            className={`w-full overflow-hidden rounded-xl border border-hp-100 ${
              esAudioDeDrive(bloque.url) ? "h-24" : "aspect-video"
            }`}
          >
            <iframe
              src={bloque.url ?? ""}
              title={bloque.etiqueta ?? "Contenido embebido"}
              className="h-full w-full"
              allow="autoplay"
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
          className="block overflow-hidden rounded-tarjeta border border-hp-100 bg-white shadow-suave transition hover:border-hp-300 hover:shadow-tarjeta"
        >
          {bloque.imagen && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={bloque.imagen}
              alt=""
              className="h-48 w-full object-cover"
            />
          )}
          <div className="p-4">
            <p className="font-bold text-tinta">
              {bloque.etiqueta ?? bloque.url} ↗
            </p>
            {bloque.texto && (
              <p className="mt-1 text-sm text-tinta-suave">{bloque.texto}</p>
            )}
            <p className="mt-1 truncate text-xs text-hp-600">{bloque.url}</p>
          </div>
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

  // Se carga con o sin asignación viva: una secuencia archivada sigue
  // mostrando su marca en la escalera de pasos, así que aquí también debe
  // verse, aunque no ofrezca acción sobre ella.
  const registro = asignacion
    ? await prisma.pasoCompletado.findUnique({
        where: {
          asignacionId_pasoId: {
            asignacionId: asignacion.id,
            pasoId: paso.id,
          },
        },
        select: { completadoEl: true, verificadoEl: true, puntos: true, respuestas: true },
      })
    : null;

  const hecho = Boolean(registro);
  // Revisado por el profesor: ya no se puede desmarcar, porque la fila
  // guarda sus puntos.
  const revisado = Boolean(registro?.verificadoEl);

  // Ejercicio autocorregible colgado de este paso, si lo hay. Se toma el
  // primero: la corrección escribe los puntos del paso entero, así que dos
  // ejercicios en el mismo paso se pisarían.
  const vinculo = await prisma.pasoEjercicio.findFirst({
    where: { pasoId: paso.id },
    orderBy: { orden: "asc" },
    select: { ejercicio: { select: { id: true, datos: true } } },
  });
  const analizado = vinculo ? analizar(vinculo.ejercicio.datos) : null;
  const hayEjercicio = analizado !== null;

  // La corrección solo se calcula —y por tanto solo viaja al navegador—
  // cuando el ejercicio ya está cerrado y no se puede reenviar.
  const correccion =
    analizado && revisado && registro?.respuestas && vinculo
      ? corregir(analizado, registro.respuestas as Respuestas, vinculo.ejercicio.id)
      : null;

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
          {paso.bloques.map((bloque, i) =>
            esProfe ? (
              <BloqueEditable
                key={bloque.id}
                bloque={bloque}
                indice={i}
                total={paso.bloques.length}
              >
                <BloqueContenido bloque={bloque} />
              </BloqueEditable>
            ) : (
              <BloqueContenido key={bloque.id} bloque={bloque} />
            ),
          )}
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
          <h2 className="text-lg font-bold text-tinta">Editar este paso</h2>
          <form action={renombrarPaso} className="mt-3 flex gap-2">
            <input type="hidden" name="pasoId" value={paso.id} />
            <input
              type="text"
              name="titulo"
              required
              defaultValue={paso.titulo}
              className="h-10 min-w-0 flex-1 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-full border-2 border-hp-200 px-4 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
            >
              Renombrar
            </button>
          </form>

        </section>
      )}

      {esProfe && <EditorBloques pasoId={paso.id} />}

      {/*
        El ejercicio autocorregible. Al estudiante se le da interactivo y sin
        soluciones; al profesor, la hoja con la respuesta correcta marcada,
        para que pueda revisar lo que va a contestar su alumno.
      */}
      {analizado && asignacion && (
        <Ejercicio
          pasoId={paso.id}
          ejercicioId={vinculo!.ejercicio.id}
          tipo={analizado.tipo}
          publica={versionPublica(analizado, vinculo!.ejercicio.id)}
          respondido={revisado}
          puntos={registro?.puntos ?? null}
          correccion={correccion}
          // Lo que el estudiante ya envió. Sin esto, recargar la página
          // reinicia el estado del componente a `{}` y "las respuestas
          // están guardadas" deja de ser cierto en pantalla: ver el
          // comentario de `PropsEjercicio.respuestas`.
          respuestas={(registro?.respuestas as Respuestas | null) ?? null}
        />
      )}

      {analizado && esProfe && !asignacion && (
        <section className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">
            Ejercicio autocorregible · tipo {analizado.tipo}
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-fondo p-4 text-xs text-tinta">
            {JSON.stringify(analizado.datos, null, 2)}
          </pre>
        </section>
      )}

      {/*
        La línea de estado se muestra si hay registro, viva o archivada la
        asignación: el estado es un hecho pasado, no una acción. Los dos
        botones ("Marcar como hecho" y "Hecho ✓") siguen bloqueados detrás
        de puedeMarcar, que sigue significando lo mismo que antes: solo una
        asignación viva permite tocar el paso.
      */}
      {(registro || puedeMarcar) && (
        <div className="mt-10 flex flex-col items-center gap-3">
          {registro && !(hayEjercicio && revisado) && (
            <p className="text-sm text-tinta-suave">
              {revisado
                ? `Tu profe lo revisó: ${registro.puntos ?? 0} puntos.`
                : `Entregado el ${formatoFecha.format(registro.completadoEl)}. Esperando a tu profe.`}
            </p>
          )}

          {revisado ? (
            <span className="rounded-full bg-sol-300 px-6 py-3 text-sm font-extrabold text-tinta">
              Revisado ✓
            </span>
          ) : puedeMarcar ? (
            hecho ? (
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
            )
          ) : null}
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
