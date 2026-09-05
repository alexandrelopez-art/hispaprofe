"use client";

import type { OpcionPublica } from "@/lib/ejercicios/opcion";
import { comoLista, TANDAS_ENCADENADO, trozos, type Respuestas } from "@/lib/ejercicios/tipos";
import type { Progreso, PropsCara } from "./ejercicio";
import Reproductor from "./reproductor";
import ReproductorEncadenado from "./reproductor-encadenado";

export default function CaraOpcion({
  publica,
  valor,
  alCambiar,
  correccion,
  cerrado,
  pasoId,
  escuchasUsadas,
  puedeContar,
  encadenado,
}: PropsCara) {
  const datos = publica as OpcionPublica;

  // Los audios de la tarea, en orden y sin repetidos: en la tarea 4 de la
  // auditiva dos preguntas comparten un mismo trozo, y no tiene sentido que
  // suene dos veces dentro de la misma escucha encadenada.
  const audiosEncadenados = encadenado
    ? [...new Set(datos.preguntas.map((p) => p.audio).filter((a): a is string => Boolean(a)))]
    : [];
  const hayEncadenado = audiosEncadenados.length > 0;

  // Con pasaje es un cloze y se pinta dentro del texto. Sin él, la lista de
  // siempre. Las preguntas con audio nunca llevan pasaje —son tareas
  // distintas del examen—, así que el cloze no necesita reproductor.
  if (datos.texto) {
    return (
      <CaraCloze
        datos={datos}
        valor={valor}
        alCambiar={alCambiar}
        correccion={correccion}
        cerrado={cerrado}
      />
    );
  }

  function alternar(preguntaId: string, indice: number) {
    if (!datos.multiple) {
      alCambiar({ ...valor, [preguntaId]: String(indice) });
      return;
    }
    const actuales = new Set(comoLista(valor[preguntaId]));
    const clave = String(indice);
    if (actuales.has(clave)) actuales.delete(clave);
    else actuales.add(clave);
    alCambiar({ ...valor, [preguntaId]: [...actuales] });
  }

  return (
    <>
      {hayEncadenado && (
        <div className="mb-6">
          <ReproductorEncadenado
            srcs={audiosEncadenados}
            pasoId={pasoId}
            maximo={TANDAS_ENCADENADO}
            usadas={escuchasUsadas["encadenado"] ?? 0}
            cerrado={cerrado || pasoId === "" || !puedeContar}
          />
        </div>
      )}
      <ol className="space-y-6">
      {datos.preguntas.map((pregunta, i) => {
        const marcadas = new Set(comoLista(valor[pregunta.id]));
        const item = correccion?.items.find((x) => x.id === pregunta.id);
        return (
          <li key={pregunta.id}>
            <p className="font-semibold text-tinta">
              {i + 1}. {pregunta.enunciado}
            </p>
            {pregunta.audio && !hayEncadenado && (
              <div className="mt-3">
                <Reproductor
                  src={pregunta.audio}
                  pasoId={pasoId}
                  clave={pregunta.id}
                  maximo={datos.escuchas}
                  usadas={escuchasUsadas[pregunta.id] ?? 0}
                  // `!puedeContar` también: sin asignación viva el servidor
                  // no concede ninguna escucha, así que contar aquí solo
                  // serviría para decir «Sin escuchas» sin haber sonado.
                  cerrado={cerrado || pasoId === "" || !puedeContar}
                />
              </div>
            )}

            {/*
              Con lista compartida y muchas preguntas, una fila de botones
              por pregunta sería un muro. El desplegable cabe.
            */}
            {datos.presentacion === "desplegable" ? (
              <Desplegable
                pregunta={pregunta}
                valor={comoLista(valor[pregunta.id])[0] ?? ""}
                alElegir={(v) => alCambiar({ ...valor, [pregunta.id]: v })}
                cerrado={cerrado}
                className="mt-2 h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400 disabled:opacity-70"
              />
            ) : (
            <div className={`mt-3 grid gap-2 ${pregunta.imagenes?.some((i) => i) ? "grid-cols-3" : "sm:grid-cols-2"}`}>
              {pregunta.opciones.map((opcion, indice) => {
                const elegida = marcadas.has(String(indice));
                const imagen = pregunta.imagenes?.[indice];
                const entrada = (
                  <input
                    type={datos.multiple ? "checkbox" : "radio"}
                    name={`p-${pregunta.id}`}
                    checked={elegida}
                    disabled={cerrado}
                    onChange={() => alternar(pregunta.id, indice)}
                    className="h-4 w-4 shrink-0 accent-hp-400"
                  />
                );
                return (
                  <label
                    key={indice}
                    className={`flex min-w-0 rounded-xl border-2 py-3 text-sm transition ${
                      imagen ? "flex-col items-center gap-2 px-2" : "items-center gap-3 px-4"
                    } ${cerrado ? "cursor-default" : "cursor-pointer"} ${
                      elegida
                        ? "border-hp-400 bg-hp-50 font-bold text-tinta"
                        : "border-hp-100 bg-fondo text-tinta hover:border-hp-200"
                    }`}
                  >
                    {imagen ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagen} alt={`Opción ${opcion}`} className="h-auto w-full max-h-40 rounded-lg object-contain" />
                        <span className="flex items-center gap-2">
                          {entrada}
                          <span>{opcion}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        {entrada}
                        <span>{opcion}</span>
                      </>
                    )}
                  </label>
                );
              })}
            </div>
            )}
            {item && <Veredicto acertado={item.acertado} correcta={item.correcta} />}
          </li>
        );
      })}
      </ol>
    </>
  );
}

/**
 * Contestada = al menos una opción marcada, sea única o múltiple.
 *
 * El desplegable manda `""` cuando se reselecciona el placeholder "?": ese
 * valor está presente (no es `undefined`), así que `comoLista` lo envuelve
 * en una lista de longitud 1. Contar longitud, sin más, la daría por
 * contestada estando en blanco. Se filtran las cadenas vacías antes de
 * contar, no solo su longitud.
 */
export function progresoOpcion(publica: unknown, valor: Respuestas): Progreso {
  const datos = publica as OpcionPublica;
  const total = datos.preguntas.length;
  const contestadas = datos.preguntas.filter((p) =>
    comoLista(valor[p.id]).some((v) => v !== ""),
  ).length;
  return { total, contestadas };
}

/** La marca de acierto o fallo, con la respuesta buena cuando toca. */
export function Veredicto({ acertado, correcta }: { acertado: boolean; correcta: string }) {
  return (
    <p
      className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
        acertado ? "bg-bloque2/25 text-tinta" : "bg-sol-200 text-tinta"
      }`}
    >
      {acertado ? "Bien ✓" : `No. La respuesta era: ${correcta}`}
    </p>
  );
}

/**
 * El desplegable de una pregunta. Lo usan la lista de siempre y el cloze:
 * dos copias del mismo control acabarían separándose, y la de dentro del
 * texto es la que menos se mira al cambiar algo.
 */
function Desplegable({
  pregunta,
  valor,
  alElegir,
  cerrado,
  className,
  etiqueta,
}: {
  pregunta: OpcionPublica["preguntas"][number];
  valor: string;
  alElegir: (v: string) => void;
  cerrado: boolean;
  className: string;
  /**
   * `aria-label` del desplegable. Por defecto, el enunciado de la pregunta
   * —que en la lista de siempre ya dice algo ("¿Dónde vive?")—, pero el
   * cloze lo llama con "Hueco {id}": ahí el enunciado es solo el número
   * ("19."), y un lector de pantalla lo anunciaría sin ningún contexto.
   */
  etiqueta?: string;
}) {
  return (
    <select
      value={valor}
      disabled={cerrado}
      onChange={(e) => alElegir(e.target.value)}
      // El ejercicio se responde una sola vez, así que Enter no puede
      // enviarlo: al elegir el último desplegable el botón se habilita, y un
      // Enter por reflejo quemaría el único intento.
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      aria-label={etiqueta ?? pregunta.enunciado}
      className={className}
    >
      <option value="">?</option>
      {pregunta.opciones.map((opcion, indice) => (
        <option key={indice} value={String(indice)}>
          {opcion}
        </option>
      ))}
    </select>
  );
}

/**
 * El pasaje con los desplegables en su hueco.
 *
 * Corregido, el desplegable se queda con lo que eligió el estudiante dentro
 * —ya se ve lo que contestó, sin repetirlo— y solo se colorea. La respuesta
 * buena aparece pegada al hueco cuando se falla: releyendo el texto se ve
 * todo, que es justo lo que una lista de veredictos al final no da.
 */
function CaraCloze({
  datos,
  valor,
  alCambiar,
  correccion,
  cerrado,
}: {
  datos: OpcionPublica;
  valor: Respuestas;
  alCambiar: (nuevo: Respuestas) => void;
  correccion: PropsCara["correccion"];
  cerrado: boolean;
}) {
  const porId = new Map(datos.preguntas.map((p) => [p.id, p]));

  return (
    <div>
      {/* Interlineado holgado: los desplegables son más altos que la línea.
          `whitespace-pre-wrap`: el pasaje sembrado trae `\n\n` entre
          párrafos y sin esto el navegador los colapsa, dejando todo el
          texto corrido en una sola línea (como en `relacionar.tsx`). */}
      <p className="whitespace-pre-wrap text-lg leading-loose text-tinta">
        {/* `datos.texto` ya se comprobó en `CaraOpcion` (`if (datos.texto)`)
            antes de llamar a este componente: no puede faltar aquí. */}
        {trozos(datos.texto!).map((parte, i) => {
          if (parte.tipo === "texto") return <span key={i}>{parte.valor}</span>;

          const pregunta = porId.get(parte.valor);
          // El esquema ya impide que una marca no tenga pregunta, así que
          // esto solo salta con datos escritos a mano saltándose el parseo.
          if (!pregunta) return <span key={i}>{`{{${parte.valor}}}`}</span>;

          const item = correccion?.items.find((x) => x.id === pregunta.id);
          const borde = !item
            ? "border-hp-200 focus:border-hp-400"
            : item.acertado
              ? "border-bloque2 bg-bloque2/20"
              : "border-sol-400 bg-sol-100";

          return (
            <span key={i}>
              <Desplegable
                pregunta={pregunta}
                valor={comoLista(valor[pregunta.id])[0] ?? ""}
                alElegir={(v) => alCambiar({ ...valor, [pregunta.id]: v })}
                cerrado={cerrado}
                className={`mx-1 inline-block h-9 rounded-lg border-2 bg-white px-2 align-middle text-base text-tinta outline-none disabled:opacity-100 ${borde}`}
                etiqueta={`Hueco ${pregunta.id}`}
              />
              {item && !item.acertado && (
                <strong className="mx-1 font-extrabold text-tinta">{item.correcta}</strong>
              )}
            </span>
          );
        })}
      </p>

      {correccion && (
        <p className="mt-4 rounded-lg bg-hp-50 px-3 py-2 text-sm font-semibold text-tinta">
          Aciertos: {correccion.aciertos} de {correccion.total}
        </p>
      )}
    </div>
  );
}
