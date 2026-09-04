"use client";

import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import { dudaDe, type Duda } from "./dudas";

export type Pregunta = { id: string; enunciado: string; opciones?: string[]; correctas: number[]; audio?: string };
export type DatosOpcion = {
  ejercicio: "opcion"; consigna: string; multiple: boolean; opcionesComunes?: string[];
  presentacion: "botones" | "desplegable"; texto?: string; escuchas?: number; preguntas: Pregunta[];
};

const LETRAS = "ABCDEFGHIJ";

/**
 * El próximo id `pN` libre: ni lo usa ya una pregunta, ni queda como marca
 * `{{pN}}` en el pasaje (si lo hay). Sin mirar el pasaje, «Quitar» la
 * pregunta con el id más alto y luego «Añadir pregunta» generaba el mismo
 * id que se acababa de quitar — y como su marca `{{pN}}` seguía en el
 * texto, la pregunta nueva (en blanco) quedaba emparejada con el hueco de
 * la que se borró, sin que `marcasCuadran` lo detectara al guardar.
 */
export function siguienteId(preguntas: Pregunta[], texto?: string): string {
  let max = 0;
  for (const p of preguntas) {
    const r = /^p(\d+)$/.exec(p.id);
    if (r) max = Math.max(max, Number(r[1]));
  }
  if (texto) {
    for (const m of texto.matchAll(/\{\{p(\d+)\}\}/g)) max = Math.max(max, Number(m[1]));
  }
  return `p${max + 1}`;
}

/**
 * Quita la pregunta `i`. En un cloze (`d.texto` definido), borra también su
 * marca `{{id}}` del pasaje, dejando `____` en su lugar: sin esto la marca
 * quedaba huérfana y, si luego se añadía una pregunta, `siguienteId` podía
 * reasignarle en silencio el mismo hueco de la que se acababa de quitar.
 */
export function quitarPregunta(d: DatosOpcion, i: number): DatosOpcion {
  const quitada = d.preguntas[i];
  const preguntas = d.preguntas.filter((_, j) => j !== i);
  if (d.texto === undefined || !quitada) return { ...d, preguntas };
  return { ...d, preguntas, texto: d.texto.split(`{{${quitada.id}}}`).join("____") };
}

function nuevaPregunta(d: DatosOpcion): Pregunta {
  const id = siguienteId(d.preguntas, d.texto);
  if (d.opcionesComunes !== undefined) return { id, enunciado: "", correctas: [] };
  const n = d.preguntas[0]?.opciones?.length ?? 3;
  return { id, enunciado: "", opciones: Array.from({ length: n }, () => ""), correctas: [] };
}

export default function EditorTareaOpcion({ datos, alCambiar, dudas }: { datos: unknown; alCambiar: (nuevo: unknown) => void; dudas: Duda[] }) {
  const d = datos as DatosOpcion;
  const comunes = d.opcionesComunes !== undefined;
  const cambiar = (parcial: Partial<DatosOpcion>) => alCambiar({ ...d, ...parcial });
  const cambiarPregunta = (i: number, parcial: Partial<Pregunta>) =>
    cambiar({ preguntas: d.preguntas.map((p, j) => (j === i ? { ...p, ...parcial } : p)) });
  const mover = (i: number, sentido: -1 | 1) => {
    const j = i + sentido;
    if (j < 0 || j >= d.preguntas.length) return;
    const preguntas = [...d.preguntas];
    [preguntas[i], preguntas[j]] = [preguntas[j], preguntas[i]];
    cambiar({ preguntas });
  };

  return (
    <div className="space-y-6">
      <Campo etiqueta="Consigna" tipo="area" rows={2} value={d.consigna} onChange={(e) => cambiar({ consigna: e.target.value })} duda={dudaDe(dudas, "consigna") ?? undefined} />
      {d.texto !== undefined && (
        <Campo etiqueta="Pasaje con huecos" tipo="area" rows={8} value={d.texto} onChange={(e) => cambiar({ texto: e.target.value })}
          ayuda="Cada hueco es una marca {{p1}}, {{p2}}… con el id de su pregunta." duda={dudaDe(dudas, "texto") ?? undefined} />
      )}
      {comunes && (
        <Tarjeta relleno="compacto">
          <Rotulo>Opciones comunes a todas las preguntas</Rotulo>
          <div className="mt-2 space-y-2">
            {d.opcionesComunes!.map((o, i) => (
              <Campo key={i} etiqueta={`Opción ${LETRAS[i] ?? i + 1}`} value={o}
                onChange={(e) => cambiar({ opcionesComunes: d.opcionesComunes!.map((x, j) => (j === i ? e.target.value : x)) })}
                duda={dudaDe(dudas, `opcionesComunes[${i}]`) ?? undefined} />
            ))}
          </div>
        </Tarjeta>
      )}
      <ol className="space-y-4">
        {d.preguntas.map((p, i) => {
          const opciones = p.opciones ?? d.opcionesComunes ?? [];
          return (
            <li key={p.id}>
              <Tarjeta relleno="compacto" titulo={`Pregunta ${i + 1} · ${p.id}`}>
                <Campo etiqueta="Enunciado" tipo="area" rows={2} value={p.enunciado} onChange={(e) => cambiarPregunta(i, { enunciado: e.target.value })} duda={dudaDe(dudas, `${p.id}.enunciado`) ?? undefined} />
                <fieldset className="mt-3 space-y-2">
                  <legend><Rotulo>Opciones y correcta</Rotulo></legend>
                  {opciones.map((o, k) => (
                    <div key={k} className="flex items-start gap-3">
                      <label className="mt-2 flex items-center gap-1 text-sm">
                        <input type={d.multiple ? "checkbox" : "radio"} name={`correcta-${p.id}`} checked={p.correctas.includes(k)}
                          onChange={() => cambiarPregunta(i, { correctas: d.multiple ? (p.correctas.includes(k) ? p.correctas.filter((c) => c !== k) : [...p.correctas, k].sort()) : [k] })} />
                        {LETRAS[k] ?? k + 1}
                      </label>
                      {p.opciones ? (
                        <Campo etiqueta={`Opción ${LETRAS[k] ?? k + 1}`} className="flex-1" value={o}
                          onChange={(e) => cambiarPregunta(i, { opciones: p.opciones!.map((x, j) => (j === k ? e.target.value : x)) })}
                          duda={dudaDe(dudas, `${p.id}.opciones[${k}]`) ?? undefined} />
                      ) : (
                        <span className="mt-2 text-sm text-tinta">{o || "(sin texto)"}</span>
                      )}
                    </div>
                  ))}
                </fieldset>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir">↑</Boton>
                  <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, 1)} disabled={i === d.preguntas.length - 1} title="Bajar">↓</Boton>
                  <Boton variante="peligro" tamano="pequeno" onClick={() => alCambiar(quitarPregunta(d, i))} disabled={d.preguntas.length <= 1}>Quitar</Boton>
                </div>
              </Tarjeta>
            </li>
          );
        })}
      </ol>
      <Boton variante="secundario" onClick={() => cambiar({ preguntas: [...d.preguntas, nuevaPregunta(d)] })}>
        Añadir pregunta
      </Boton>
    </div>
  );
}
