"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CRITERIOS, TOPE_SEGUNDOS } from "@/lib/orales/criterios";
import { calcularTotal, fmtTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";
import { guardarEvaluacion } from "@/lib/acciones-orales";
import { alternarFrase, caparTiempo, preguntadasAlElegir } from "@/lib/orales/reglas";
import Cronometro from "@/components/orales/cronometro";
import TarjetaCriterio from "@/components/orales/tarjeta-criterio";
import ParrillaSujets from "@/components/orales/parrilla-sujets";
import type { SujetoDeParrilla } from "@/components/orales/parrilla-sujets";

type Estado = {
  sujetoId: string | null;
  notas: Notas;
  comentarios: Record<string, string>;
  frases: Record<string, string[]>;
  preguntadas: number[];
  segundosEoc: number;
  segundosEoi: number;
};

/**
 * Cuál de los dos cronómetros. Nombre distinto del componente `Cronometro`
 * a propósito: en la tarea 6 una `const` con el mismo nombre que una
 * función importada volvió una condición siempre verdadera sin que nadie
 * lo notara al leer el código.
 */
type Reloj = "eoc" | "eoi";

const campoDeReloj: Record<Reloj, "segundosEoc" | "segundosEoi"> = {
  eoc: "segundosEoc",
  eoi: "segundosEoi",
};

/**
 * El transcurrido de un cronómetro que arrancó en `arranqueEn` (un
 * `Date.now()`) y ya llevaba `acumulado` segundos, visto en el instante
 * `ahora` (otro `Date.now()`). Se apoya en `caparTiempo`, la misma regla
 * que usa el servidor, para que una pestaña que estuvo dormida no enseñe
 * de golpe más de cinco minutos.
 */
function transcurridoDe(acumulado: number, arranqueEn: number, ahora: number): number {
  return caparTiempo(acumulado + (ahora - arranqueEn) / 1000);
}

/**
 * Congela en `base` el tiempo del cronómetro que esté corriendo, si hay
 * alguno. La usan los tres sitios donde un cronómetro en marcha puede
 * quedarse sin dueño de golpe: arrancar el otro, cambiar de sujet y
 * desmontar el panel (cambio de estudiante, recarga, cierre de pestaña).
 */
function congelarReloj(
  base: Estado,
  cual: Reloj | null,
  arranqueEn: number | null,
  instante: number,
): Estado {
  if (!cual || arranqueEn === null) return base;
  const campo = campoDeReloj[cual];
  return { ...base, [campo]: transcurridoDe(base[campo], arranqueEn, instante) };
}

type EstadoGuardado = "guardado" | "guardando" | "error";

export default function Panel({
  turnoId,
  nombre,
  meta,
  sujetos,
  inicial,
}: {
  turnoId: string;
  nombre: string;
  meta: string[];
  sujetos: SujetoDeParrilla[];
  inicial: Estado;
}) {
  // Ojo: no hay aquí un `useEffect` que resincronice `estado` cuando cambia
  // `turnoId` o `inicial`. El brief lo pedía, pero un `useEffect` con
  // `inicial` en las dependencias reacciona a que el objeto sea una
  // referencia nueva, no a que el turno haya cambiado de verdad: si el
  // profesor está escribiendo un comentario y en ese momento cualquier
  // acción del servidor (borrar un turno, pegar sujets…) llama a
  // `revalidatePath` sobre esta misma ruta, Next vuelve a ejecutar el
  // Server Component de la página, que pasa un `inicial` nuevo pero con el
  // mismo contenido — y el efecto lo tomaría por «cambio de estudiante» y
  // pisaría lo que se acaba de teclear, sin vuelta atrás a mitad de examen.
  //
  // La forma correcta de resetear estado al cambiar de turno es la que ya
  // recomienda React: que el padre monte este componente con
  // `key={turnoId}` (ver `app/(app)/profe/orales/[id]/page.tsx`). Un cambio
  // de `key` desmonta y vuelve a montar el árbol entero, así que
  // `useState(inicial)` solo se evalúa una vez por estudiante; una
  // repintada del padre con un `inicial` equivalente no toca este
  // componente si su `key` no cambió.
  const [estado, setEstado] = useState<Estado>(inicial);
  const [corriendo, setCorriendo] = useState<Reloj | null>(null);
  // El tiempo de verdad no vive en `estado`: `arranqueEn` es la marca de
  // cuándo arrancó el cronómetro activo, y de ahí se calcula el
  // transcurrido contra el reloj de pared. `estado.segundosEoc/Eoi` solo
  // guarda lo ya congelado — al pausar, al llegar al tope, al cambiar de
  // sujet o al desmontar con algo corriendo. Es estado de React (no un
  // ref) porque participa del render: `segundosMostrados` lo lee para
  // pintar el reloj, y leer un ref durante el render es justo lo que las
  // reglas de React (y el lint de este proyecto) no dejan hacer.
  const [arranqueEn, setArranqueEn] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("guardado");

  // Espejos de `estado`/`corriendo`/`arranqueEn` para los sitios que no
  // pueden leer estado de React directamente: los manejadores de clic (que
  // solo deben leer refs o su propio parámetro, no cerrarse sobre el
  // render en el que se crearon) y el cleanup de desmontaje, que se define
  // una sola vez y se ejecuta mucho después. Se actualizan después de cada
  // render.
  const estadoRef = useRef(estado);
  const corriendoRef = useRef(corriendo);
  const arranqueEnRef = useRef(arranqueEn);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El último `Estado` que se mandó a guardar pero cuya respuesta no ha
  // llegado o no se ha confirmado. Si el componente se desmonta antes de
  // que resuelva, es lo que se manda de golpe en el cleanup.
  const pendienteRef = useRef<Estado | null>(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    estadoRef.current = estado;
    corriendoRef.current = corriendo;
    arranqueEnRef.current = arranqueEn;
  });

  /** Manda `siguiente` al servidor y actualiza el indicador. */
  const enviar = useCallback(
    async (siguiente: Estado) => {
      try {
        const fallo = await guardarEvaluacion({ turnoId, ...siguiente });
        if (!montadoRef.current) return;
        if (fallo) {
          setError(fallo.error);
          setEstadoGuardado("error");
          return; // no se confirmó nada: pendienteRef se deja puesto
        }
        pendienteRef.current = null;
        setError(null);
        setEstadoGuardado("guardado");
      } catch (e) {
        // B-3: `exigirTurnoSuyo`/`exigirProfesor` *lanzan* (sesión de
        // Clerk caducada, turno de otro profesor) en vez de devolver
        // `{ error }`, igual que una caída de red. Sin este `catch`, esa
        // promesa rechazada dentro del `setTimeout` no la recogía nadie y
        // la pantalla seguía como si todo se hubiera guardado.
        if (!montadoRef.current) return;
        setError(
          e instanceof Error && e.message
            ? e.message
            : "No se pudo guardar. Comprueba la conexión.",
        );
        setEstadoGuardado("error");
      }
    },
    [turnoId],
  );

  /** El autoguardado de toda la vida: medio segundo después de la última
   * tecla, para no mandar una petición por pulsación. */
  const guardar = useCallback(
    (siguiente: Estado) => {
      setEstado(siguiente);
      pendienteRef.current = siguiente;
      setEstadoGuardado("guardando");
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        temporizador.current = null;
        void enviar(siguiente);
      }, 500);
    },
    [enviar],
  );

  /** Los cambios de contexto —arrancar, parar, llegar al tope, cambiar de
   * sujet— se guardan ya. Son discretos, y perder uno cuesta un cronómetro
   * entero o el documento elegido, no una letra de un comentario. */
  const guardarYa = useCallback(
    (siguiente: Estado) => {
      setEstado(siguiente);
      pendienteRef.current = siguiente;
      setEstadoGuardado("guardando");
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        temporizador.current = null;
      }
      void enviar(siguiente);
    },
    [enviar],
  );

  /** Vuelca al desmontar lo que quede sin confirmar: el autoguardado
   * pendiente y, si había un cronómetro corriendo, su tiempo transcurrido
   * hasta ahora mismo. Pasa al cambiar de estudiante (el padre remonta el
   * panel con otra `key`), al recargar y al cerrar la pestaña. No hay
   * forma de esperar una promesa desde el cleanup de un efecto, pero
   * lanzar el guardado es mejor que perderlo sin más. */
  useEffect(() => {
    return () => {
      montadoRef.current = false;
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        temporizador.current = null;
      }
      const base = pendienteRef.current ?? estadoRef.current;
      const final = congelarReloj(base, corriendoRef.current, arranqueEnRef.current, Date.now());
      if (pendienteRef.current !== null || final !== base) {
        void guardarEvaluacion({ turnoId, ...final });
      }
    };
  }, [turnoId]);

  const parar = useCallback(
    (cual: Reloj, instante: number) => {
      const siguiente = congelarReloj(estadoRef.current, cual, arranqueEnRef.current, instante);
      setArranqueEn(null);
      setCorriendo((actual) => (actual === cual ? null : actual));
      guardarYa(siguiente);
    },
    [guardarYa],
  );

  const arrancar = useCallback(
    (cual: Reloj) => {
      const instante = Date.now();
      // Regla del panel: arrancar uno para el otro. Si el otro estaba
      // corriendo, se congela su tiempo transcurrido y se guarda ya —si
      // no, ese tiempo se perdía en cuanto se cambiaba de cronómetro.
      const siguiente = congelarReloj(
        estadoRef.current,
        corriendoRef.current,
        arranqueEnRef.current,
        instante,
      );
      setArranqueEn(instante);
      setCorriendo(cual);
      if (siguiente !== estadoRef.current) guardarYa(siguiente);
    },
    [guardarYa],
  );

  const reiniciar = useCallback(
    (cual: Reloj) => {
      if (corriendoRef.current === cual) {
        setArranqueEn(null);
        setCorriendo(null);
      }
      guardarYa({ ...estadoRef.current, [campoDeReloj[cual]]: 0 });
    },
    [guardarYa],
  );

  // Un solo intervalo, vivo solo mientras algo corre, que fuerza el
  // repintado y comprueba el tope de cinco minutos. `parar` es estable
  // (useCallback) y lee las refs en vez de cerrarse sobre `estado`, así
  // que este efecto no se rehace en cada tecla que teclea el profesor
  // mientras el reloj corre.
  useEffect(() => {
    if (!corriendo) return;
    const id = setInterval(() => {
      const instante = Date.now();
      setAhora(instante);
      if (arranqueEnRef.current === null) return;
      const campo = campoDeReloj[corriendo];
      const valor = transcurridoDe(estadoRef.current[campo], arranqueEnRef.current, instante);
      if (valor >= TOPE_SEGUNDOS) parar(corriendo, instante);
    }, 250);
    return () => clearInterval(id);
  }, [corriendo, parar]);

  /** Lo que enseña cada cronómetro ahora mismo: lo congelado si está
   * parado, o lo congelado más lo corrido desde que arrancó. Se llama
   * durante el render (va directo a la prop `segundos` de `Cronometro`),
   * así que solo lee estado de React —`estado`, `corriendo`, `arranqueEn`,
   * `ahora`—, nunca una ref: leer una ref durante el render puede dar un
   * valor inconsistente con lo que React está pintando en esa pasada.
   */
  function segundosMostrados(cual: Reloj): number {
    if (corriendo !== cual || arranqueEn === null) return estado[campoDeReloj[cual]];
    return transcurridoDe(estado[campoDeReloj[cual]], arranqueEn, ahora);
  }

  // El botón principal, en cambio, es un manejador de clic: aquí sí toca
  // leer las refs (no el estado del render en el que se creó el cierre) y
  // llamar a `Date.now()`, y por eso va en un `useCallback` como
  // `arrancar`/`parar`/`reiniciar`, no como una función suelta del cuerpo
  // del componente.
  const pulsarPrincipal = useCallback(
    (cual: Reloj) => {
      const instante = Date.now();
      const campo = campoDeReloj[cual];
      const valor =
        corriendoRef.current === cual && arranqueEnRef.current !== null
          ? transcurridoDe(estadoRef.current[campo], arranqueEnRef.current, instante)
          : estadoRef.current[campo];
      if (valor >= TOPE_SEGUNDOS) reiniciar(cual);
      else if (corriendoRef.current === cual) parar(cual, instante);
      else arrancar(cual);
    },
    [reiniciar, parar, arrancar],
  );

  const total = calcularTotal(estado.notas);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-4 border-b border-hp-100 pb-4">
        <h2 className="text-2xl font-extrabold text-tinta">{nombre}</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-tinta-suave">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              estadoGuardado === "guardando"
                ? "bg-sol-300"
                : estadoGuardado === "error"
                  ? "bg-coral-500"
                  : "bg-verde-500"
            }`}
          />
          {estadoGuardado === "guardando"
            ? "Guardando…"
            : estadoGuardado === "error"
              ? "Sin guardar"
              : "Guardado"}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {meta.map((m) => (
            <span
              key={m}
              className="rounded-full border border-hp-100 bg-fondo px-2.5 py-1 text-xs font-semibold text-tinta-suave"
            >
              {m}
            </span>
          ))}
        </div>
        <div className="ml-auto text-right">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-tinta-suave">
            Nota /20
          </span>
          <span className="text-3xl font-extrabold tabular-nums text-tinta">
            {fmtTotal(total)}
            <span className="text-base font-semibold text-tinta-suave"> / 20</span>
          </span>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-coral-100 px-4 py-2 text-sm font-semibold text-coral-600">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Cronometro
          romano="I"
          etiqueta="Expresión oral en continuo"
          sub="EOC · 5 min · el alumno habla solo"
          segundos={segundosMostrados("eoc")}
          corriendo={corriendo === "eoc"}
          alPulsar={() => pulsarPrincipal("eoc")}
          alReiniciar={() => reiniciar("eoc")}
        />
        <Cronometro
          romano="II"
          etiqueta="Expresión oral en interacción"
          sub="EOI · 5 min · diálogo con el examinador"
          segundos={segundosMostrados("eoi")}
          corriendo={corriendo === "eoi"}
          alPulsar={() => pulsarPrincipal("eoi")}
          alReiniciar={() => reiniciar("eoi")}
        />
      </div>

      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
        Documento elegido
      </h3>
      <ParrillaSujets
        sujetos={sujetos}
        elegidoId={estado.sujetoId}
        preguntadas={estado.preguntadas}
        alElegir={(id) => {
          const instante = Date.now();
          const conNuevoSujet: Estado = {
            ...estadoRef.current,
            sujetoId: id,
            preguntadas: preguntadasAlElegir(
              estadoRef.current.sujetoId,
              id,
              estadoRef.current.preguntadas,
            ),
          };
          // Cambiar de sujet también para los cronómetros: si alguno
          // estaba corriendo, se congela su tiempo antes de soltarlo.
          const siguiente = congelarReloj(
            conNuevoSujet,
            corriendoRef.current,
            arranqueEnRef.current,
            instante,
          );
          setArranqueEn(null);
          setCorriendo(null);
          guardarYa(siguiente);
        }}
        alPreguntar={(i) =>
          guardar({
            ...estado,
            preguntadas: estado.preguntadas.includes(i)
              ? estado.preguntadas.filter((x) => x !== i)
              : [...estado.preguntadas, i],
          })
        }
      />

      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
        Baremo · 5 criterios / 20 puntos
      </h3>
      <div className="space-y-3.5">
        {CRITERIOS.map((c) => (
          <TarjetaCriterio
            key={c.key}
            criterio={c}
            nota={estado.notas[c.key] ?? null}
            comentario={estado.comentarios[c.key] ?? ""}
            frases={estado.frases[c.key] ?? []}
            alPuntuar={(v) =>
              guardar({ ...estado, notas: { ...estado.notas, [c.key]: v } })
            }
            alComentar={(t) =>
              guardar({ ...estado, comentarios: { ...estado.comentarios, [c.key]: t } })
            }
            alPulsarFrase={(f) => {
              const { activas, texto } = alternarFrase(
                estado.frases[c.key] ?? [],
                estado.comentarios[c.key] ?? "",
                f,
              );
              guardar({
                ...estado,
                frases: { ...estado.frases, [c.key]: activas },
                comentarios: { ...estado.comentarios, [c.key]: texto },
              });
            }}
          />
        ))}
      </div>

      <div className="rounded-tarjeta border border-hp-100 bg-white p-5">
        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
          Comentario general
        </h3>
        <textarea
          value={estado.comentarios.general ?? ""}
          onChange={(e) =>
            guardar({
              ...estado,
              comentarios: { ...estado.comentarios, general: e.target.value },
            })
          }
          placeholder="Apreciación global, consejos, puntos a trabajar…"
          className="mt-2 min-h-24 w-full rounded-lg border border-hp-100 bg-fondo p-3 text-sm"
        />
      </div>
    </div>
  );
}
