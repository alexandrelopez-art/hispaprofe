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
import SelectorEjercicio, { type Candidato } from "./selector-ejercicio";
import PegarCodigo from "./pegar-codigo";
import { encargosPara } from "@/lib/pegado/encargo";
import Reproductor from "@/components/ejercicios/reproductor";
import { esRacionado, escuchasDelPaso } from "@/lib/escuchas";
import { numeroDeTarea, tareaDe } from "@/lib/dele";
import { TIPO_DE_EJERCICIO } from "@/lib/recursos";
import { analizarExpresion, versionPublicaExpresion } from "@/lib/expresion";
import Entrega from "@/components/expresion/entrega";
import { esAudioDeDrive } from "@/lib/bloques";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";
import { tipoLabel, tipoTono } from "@/lib/tipos-de-paso";

// Fuerza render dinámico: lee de la base en cada visita.
export const dynamic = "force-dynamic";

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

// Renderiza un bloque según su tipo.
function BloqueContenido({
  bloque,
  pasoId,
  racionado,
  puedeContar,
  escuchas,
}: {
  bloque: BloqueData;
  pasoId: string;
  /**
   * El paso es una tarea de examen de verdad: recorrido de preparación y con
   * prueba elegida. Solo entonces se raciona el audio. Un audio de una clase
   * particular se oye las veces que haga falta.
   */
  racionado: boolean;
  /**
   * Quien mira tiene una asignación viva de este recorrido: solo así puede
   * `pedirEscucha` concederle nada. Sin esto, un profesor viendo su propio
   * paso (nunca tiene `Asignacion`, es de estudiantes) o un estudiante con
   * la asignación archivada veían "Sin escuchas" sin que el audio hubiera
   * sonado ni una vez — no podían oír el audio que ellos mismos habían
   * subido. Cuando es `false`, se cae en la misma rama sin contar que ya
   * usa la previsualización del profesor (`cerrado` en `Reproductor`).
   */
  puedeContar: boolean;
  /** Ver el comentario de `PropsEjercicio.escuchas`, en `ejercicio.tsx`. */
  escuchas: Record<string, number>;
}) {
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
          {racionado ? (
            // Una sola escucha, y no dos: el archivo oficial ya trae la
            // repetición dentro. Por eso el máximo es un literal y no una
            // columna del bloque — no hay nada que configurar.
            <Reproductor
              src={bloque.url ?? ""}
              pasoId={pasoId}
              clave={bloque.id}
              maximo={1}
              usadas={escuchas[bloque.id] ?? 0}
              // `!puedeContar` y no `false`: ver el comentario de la prop.
              cerrado={!puedeContar}
            />
          ) : (
            <audio controls preload="metadata" className="w-full" src={bloque.url ?? ""}>
              <a href={bloque.url ?? "#"} target="_blank" rel="noopener noreferrer">
                Abrir el audio
              </a>
            </audio>
          )}
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
        <Tarjeta href={bloque.url ?? "#"} externo relleno="ninguno" className="overflow-hidden">
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
        </Tarjeta>
      );

    default:
      return null;
  }
}

export default async function PasoPage({
  params,
  searchParams,
}: {
  params: Promise<{ pasoId: string }>;
  /**
   * `?todos=1` ensancha la lista de candidatos a todos los niveles.
   * `?formato=todos` la ensancha a todos los formatos, cuando el paso es una
   * tarea del mapa y la lista viene acotada al suyo.
   */
  searchParams: Promise<{ todos?: string; formato?: string }>;
}) {
  const { pasoId } = await params;
  const parametros = await searchParams;
  const todosLosNiveles = parametros.todos === "1";

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
        select: {
          completadoEl: true,
          verificadoEl: true,
          puntos: true,
          respuestas: true,
          entrega: true,
          valoracion: true,
        },
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

  // La expresión es hermana del motor: si `analizar` no lo reconoce, puede
  // ser una tarea de expresión.
  const expresion = analizado ? null : vinculo ? analizarExpresion(vinculo.ejercicio.datos) : null;
  const corregida = Boolean(registro?.verificadoEl);

  // Entregar es lo que marca el paso, así que el par «marcar / Hecho ✓» sobra
  // —y peor que sobrar: «Hecho ✓» desmarca, y desmarcar borraba la entrega—.
  // Vale para la escrita y para la oral grabada. La oral de clase se queda:
  // ahí marcar sigue siendo la única señal que da el alumno.
  const entregable =
    expresion?.modalidad === "escrita" || (expresion?.modalidad === "oral" && expresion.grabada);
  const marcable = puedeMarcar && !entregable;

  // Si el oral ya está citado, cuándo. El diseño se lo promete al alumno y
  // hasta ahora la cita solo se veía en dos pantallas de profesor: llegaba a
  // clase sin saber que ese día se examinaba. Una clase anulada no cuenta:
  // decir una fecha que no va a pasar es peor que no decir nada.
  //
  // Una grabada no se cita nunca —no se hace en clase—, así que ni se pregunta:
  // `puedeCitarse` ya lo prohíbe, pero esta consulta sobraría igual.
  const cita =
    asignacion && expresion?.modalidad === "oral" && !expresion.grabada
      ? await prisma.citaOral.findFirst({
          where: {
            asignacionId: asignacion.id,
            pasoId: paso.id,
            clase: { estado: { not: "ANULADA" } },
          },
          select: { clase: { select: { empiezaEl: true } } },
        })
      : null;

  // Qué tarea del examen es este paso. La regla vive en `lib/dele` porque la
  // comparte con el panel de tareas sugeridas, que necesita contar como
  // ocupado exactamente lo que esta página da por puesto.
  //
  // Si este paso es una tarea del mapa, el selector se acota a su formato.
  // Un número más allá de la última tarea oficial devuelve null y todo se
  // comporta como si no hubiera mapa.
  const tarea =
    paso.recorrido.tipo === "PREPARACION_DELE" && paso.recorrido.destreza
      ? tareaDe(paso.recorrido.nivel, paso.recorrido.destreza, numeroDeTarea(paso))
      : null;

  // El `tipo` de la base que le toca al motor de esta tarea. La tabla vive
  // en lib/recursos.ts para que solo haya un sitio donde puedan discrepar.
  const tipoDeLaTarea = tarea ? TIPO_DE_EJERCICIO[tarea.motor] : null;
  const verTodos = todosLosNiveles || parametros.formato === "todos";

  // El encargo se compone aquí y viaja entero en las props: es texto puro
  // sacado del mapa, así que no hace falta ninguna ruta que lo sirva. Si el
  // paso no es tarea del examen, `encargosPara` devuelve los cuatro motores y
  // la puerta enseña un desplegable.
  const encargos = esProfe
    ? encargosPara(`${paso.recorrido.titulo} · ${paso.titulo}`, tarea)
    : [];

  // Los publicados que se le pueden ofrecer a este paso. Se acotan al nivel
  // del recorrido porque es lo que se busca el 99% de las veces, pero con
  // puerta de salida (`?todos=1`): el editor de Recursos arranca en B1 y el
  // recorrido puede ser de otro nivel, así que sin ella un ejercicio recién
  // publicado podía no aparecer y la pantalla decía que no había ninguno.
  // Igual con el formato de la tarea: se acota, y `?formato=todos` lo suelta.
  // `WIDGET` no entra nunca: no lo entiende `analizar`, así que enganchado a
  // un paso no se pinta y el estudiante no ve nada — es el mismo motivo por
  // el que la lista de Recursos ya lo excluye.
  // Solo para el profesor: el estudiante no debe ver ni la lista ni el
  // selector.
  const candidatos: Candidato[] = esProfe
    ? await prisma.ejercicio.findMany({
        where: {
          publicado: true,
          tipo: { not: "WIDGET" },
          ...(todosLosNiveles ? {} : { nivel: paso.recorrido.nivel }),
          ...(tipoDeLaTarea && !verTodos ? { tipo: tipoDeLaTarea } : {}),
        },
        orderBy: { titulo: "asc" },
        select: { id: true, titulo: true, tipo: true, nivel: true },
      })
    : [];

  const ejercicioActual =
    vinculo && esProfe
      ? await prisma.ejercicio.findUnique({
          where: { id: vinculo.ejercicio.id },
          select: { id: true, titulo: true },
        })
      : null;

  // La corrección solo se calcula —y por tanto solo viaja al navegador—
  // cuando el ejercicio ya está cerrado y no se puede reenviar.
  const correccion =
    analizado && revisado && registro?.respuestas && vinculo
      ? corregir(analizado, registro.respuestas as Respuestas, vinculo.ejercicio.id)
      : null;

  const racionado = esRacionado(paso.recorrido);

  // Leído una sola vez para todo el paso: sirve tanto al bloque `AUDIO`
  // (clave = id del bloque) como a los audios del ejercicio (clave = id de
  // pregunta o pareja), porque `Escucha.clave` es un espacio único por
  // `(asignacionId, pasoId, clave)` y los dos dominios de id no chocan.
  const escuchasUsadas = asignacion ? await escuchasDelPaso(asignacion.id, paso.id) : {};

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Encabezado
        titulo={paso.titulo}
        lede={tipoDescripcion[paso.tipo] ?? ""}
        volver={{ href: `/recorridos/${paso.recorridoId}`, texto: paso.recorrido.titulo }}
        margen="corto"
      />

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-tinta-suave">
          Paso {paso.orden} de {hermanos.length} · Ciclo {paso.ciclo}
        </span>
        <Etiqueta tono={tipoTono[paso.tipo] ?? "hp"}>
          {tipoLabel[paso.tipo] ?? paso.tipo}
        </Etiqueta>
        {paso.destreza && <Etiqueta tono="hp">{paso.destreza}</Etiqueta>}
      </div>

      {/* Contenido: bloques ordenados, o área reservada si aún no hay ni
          bloques ni ejercicio. La Tarea 4 del examen no lleva bloque —su
          texto vive dentro del cloze—, así que hace falta la segunda
          condición: si no, un paso solo-ejercicio se ve como vacío. */}
      {paso.bloques.length > 0 || hayEjercicio ? (
        <div className="mt-8 space-y-6">
          {paso.bloques.map((bloque, i) =>
            esProfe ? (
              <BloqueEditable
                key={bloque.id}
                bloque={bloque}
                indice={i}
                total={paso.bloques.length}
                racionado={racionado}
              >
                <BloqueContenido
                  bloque={bloque}
                  pasoId={paso.id}
                  racionado={racionado}
                  puedeContar={puedeMarcar}
                  escuchas={escuchasUsadas}
                />
              </BloqueEditable>
            ) : (
              <BloqueContenido
                key={bloque.id}
                bloque={bloque}
                pasoId={paso.id}
                racionado={racionado}
                puedeContar={puedeMarcar}
                escuchas={escuchasUsadas}
              />
            ),
          )}
        </div>
      ) : (
        <div className="mt-8">
          <Vacio>Este paso todavía no tiene contenido.</Vacio>
        </div>
      )}

      {/* Editor: añadir bloque de contenido (solo profes). */}
      {esProfe && (
        <Tarjeta titulo="Editar este paso" className="mt-8">
          <form action={renombrarPaso} className="flex items-end gap-2">
            <input type="hidden" name="pasoId" value={paso.id} />
            <Campo
              etiqueta="Título"
              name="titulo"
              required
              defaultValue={paso.titulo}
              className="min-w-0 flex-1"
            />
            <BotonEnviar gerundio="Renombrando…" variante="sutil" className="shrink-0">
              Renombrar
            </BotonEnviar>
          </form>
        </Tarjeta>
      )}

      {esProfe && <EditorBloques pasoId={paso.id} />}

      {esProfe && (
        <SelectorEjercicio
          pasoId={paso.id}
          actual={ejercicioActual}
          candidatos={candidatos}
          nivel={paso.recorrido.nivel}
          todosLosNiveles={todosLosNiveles}
          prueba={paso.recorrido.destreza}
          tarea={
            tarea
              ? {
                  numero: tarea.numero,
                  pide: tarea.pide,
                  verificado: tarea.verificado,
                  filtrado: !verTodos,
                }
              : null
          }
        />
      )}

      {esProfe && !hayEjercicio && (
        <PegarCodigo
          pasoId={paso.id}
          titulo={`${paso.recorrido.titulo} · ${paso.titulo}`}
          encargos={encargos}
        />
      )}

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
          escuchas={escuchasUsadas}
          // Lo mismo que ya recibía el bloque `AUDIO`: con la asignación
          // archivada, `pedirEscucha` no concede nada, así que un reproductor
          // que cuenta solo serviría para enseñar "Sin escuchas" sobre un
          // audio que nunca ha sonado. Ver `PropsEjercicio.puedeContar`.
          puedeContar={puedeMarcar}
        />
      )}

      {/*
        La tarea de expresión: hermana del ejercicio autocorregible de
        arriba, pero sin corrección automática. `versionPublicaExpresion` es
        lo que impide que el texto modelo viaje al navegador antes de que el
        profesor corrija — no basta con esconderlo en el JSX, porque lo que
        el servidor manda se lee entero en el código fuente de la página.
      */}
      {expresion && asignacion && (
        <Entrega
          pasoId={paso.id}
          publica={versionPublicaExpresion(expresion, corregida)}
          entrega={registro?.entrega ?? null}
          valoracion={
            (registro?.valoracion as { notas: Record<string, number>; comentario: string } | null) ??
            null
          }
          // Con la asignación archivada se sigue viendo lo escrito y la
          // corrección —son un hecho pasado, igual que la línea de estado—,
          // pero sin botón: `entregar` lo rechazaría de todas formas, y un
          // botón que solo sirve para recibir un no no es un botón.
          cerrada={corregida || !puedeMarcar}
          citada={cita?.clase.empiezaEl ?? null}
        />
      )}

      {analizado && esProfe && !asignacion && (
        <Tarjeta titulo={`Ejercicio autocorregible · tipo ${analizado.tipo}`} className="mt-8">
          <pre className="overflow-x-auto rounded-xl bg-fondo p-4 text-xs text-tinta">
            {JSON.stringify(analizado.datos, null, 2)}
          </pre>
        </Tarjeta>
      )}

      {/*
        La línea de estado se muestra si hay registro, viva o archivada la
        asignación: el estado es un hecho pasado, no una acción. Los dos
        botones ("Marcar como hecho" y "Hecho ✓") van detrás de `marcable`:
        asignación viva —solo así se puede tocar el paso— y que el paso no
        sea de los que se entregan (la escrita y la oral grabada), que se
        marcan solos al entregar.
      */}
      {(registro || marcable) && (
        <div className="mt-10 flex flex-col items-center gap-3">
          {registro && !(hayEjercicio && revisado) && (
            <Aviso tono={revisado ? "ok" : "info"}>
              {revisado
                ? `Tu profe lo revisó: ${registro.puntos ?? 0} puntos.`
                : `Entregado el ${formatoFecha.format(registro.completadoEl)}. Esperando a tu profe.`}
            </Aviso>
          )}

          {revisado ? (
            // Insignia de «revisado», no una `Etiqueta`: es el aviso grande y
            // dorado de fin de tarea, no una pill de listado — encogerla a
            // tamaño de pill sería una regresión visual, no solo de marcado.
            <span className="rounded-full bg-sol-300 px-6 py-3 text-sm font-extrabold text-tinta">
              Revisado ✓
            </span>
          ) : marcable ? (
            hecho ? (
              <form action={desmarcarPasoHecho}>
                <input type="hidden" name="pasoId" value={paso.id} />
                {/* Mismo motivo: el dorado de "ya está hecho, toca para
                    desmarcar" no tiene equivalente en las cuatro variantes
                    de Boton (todas leen como llamada a la acción o borrado). */}
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
                <BotonEnviar gerundio="Marcando…">Marcar como hecho</BotonEnviar>
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
