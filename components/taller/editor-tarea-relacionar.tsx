"use client";

import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import { dudaDe, type Duda } from "./dudas";

type Pareja = { id: string; izquierda: string; derecha: string; audio?: string };
type DatosRelacionar = { ejercicio: "relacionar"; consigna: string; texto?: string; parejas: Pareja[]; sobrantes: string[]; escuchas?: number };

function siguienteId(parejas: Pareja[]): string {
  const max = parejas.reduce((m, p) => { const r = /^r(\d+)$/.exec(p.id); return r ? Math.max(m, Number(r[1])) : m; }, 0);
  return `r${max + 1}`;
}

function ayudaCon(dudas: Duda[], campo: string, normal?: string): string | undefined {
  const duda = dudaDe(dudas, campo);
  return duda ? `Duda de la IA: ${duda}` : normal;
}

export default function EditorTareaRelacionar({ datos, alCambiar, dudas }: { datos: unknown; alCambiar: (nuevo: unknown) => void; dudas: Duda[] }) {
  const d = datos as DatosRelacionar;
  const cambiar = (parcial: Partial<DatosRelacionar>) => alCambiar({ ...d, ...parcial });
  const cambiarPareja = (i: number, parcial: Partial<Pareja>) => cambiar({ parejas: d.parejas.map((p, j) => (j === i ? { ...p, ...parcial } : p)) });
  const mover = (i: number, sentido: -1 | 1) => {
    const j = i + sentido;
    if (j < 0 || j >= d.parejas.length) return;
    const parejas = [...d.parejas];
    [parejas[i], parejas[j]] = [parejas[j], parejas[i]];
    cambiar({ parejas });
  };

  return (
    <div className="space-y-6">
      <Campo etiqueta="Consigna" tipo="area" rows={2} value={d.consigna} onChange={(e) => cambiar({ consigna: e.target.value })} ayuda={ayudaCon(dudas, "consigna")} />
      <ol className="space-y-4">
        {d.parejas.map((p, i) => (
          <li key={p.id}>
            <Tarjeta relleno="compacto" titulo={`Pareja ${i + 1} · ${p.id}`}>
              <Campo etiqueta="Enunciado o persona" tipo="area" rows={3} value={p.izquierda} onChange={(e) => cambiarPareja(i, { izquierda: e.target.value })} ayuda={ayudaCon(dudas, `${p.id}.izquierda`)} />
              <Campo etiqueta="Texto que le corresponde (su título)" className="mt-3" value={p.derecha} onChange={(e) => cambiarPareja(i, { derecha: e.target.value })} ayuda={ayudaCon(dudas, `${p.id}.derecha`, "Tiene que ser distinto en cada pareja.")} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir">↑</Boton>
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(i, 1)} disabled={i === d.parejas.length - 1} title="Bajar">↓</Boton>
                <Boton variante="peligro" tamano="pequeno" onClick={() => cambiar({ parejas: d.parejas.filter((_, j) => j !== i) })} disabled={d.parejas.length <= 2}>Quitar</Boton>
              </div>
            </Tarjeta>
          </li>
        ))}
      </ol>
      <Boton variante="secundario" onClick={() => cambiar({ parejas: [...d.parejas, { id: siguienteId(d.parejas), izquierda: "", derecha: "" }] })}>Añadir pareja</Boton>
      <Tarjeta relleno="compacto">
        <Rotulo>Sobrantes</Rotulo>
        <p className="mt-1 text-sm text-tinta-suave">Los textos que no casan con nadie. En el examen son tres.</p>
        <div className="mt-2 space-y-2">
          {d.sobrantes.map((s, i) => (
            <div key={i} className="flex items-end gap-2">
              <Campo etiqueta={`Sobrante ${i + 1}`} className="flex-1" value={s} onChange={(e) => cambiar({ sobrantes: d.sobrantes.map((x, j) => (j === i ? e.target.value : x)) })} ayuda={ayudaCon(dudas, `sobrantes[${i}]`)} />
              <Boton variante="peligro" tamano="pequeno" onClick={() => cambiar({ sobrantes: d.sobrantes.filter((_, j) => j !== i) })}>Quitar</Boton>
            </div>
          ))}
        </div>
        <Boton variante="sutil" tamano="pequeno" className="mt-3" onClick={() => cambiar({ sobrantes: [...d.sobrantes, ""] })}>Añadir sobrante</Boton>
      </Tarjeta>
    </div>
  );
}
