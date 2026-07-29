"use client";

import { trozos, type HuecosPublica } from "@/lib/ejercicios/huecos";
import { comoLista } from "@/lib/ejercicios/tipos";
import type { PropsCara } from "./ejercicio";
import { Veredicto } from "./opcion";

export default function CaraHuecos({ publica, valor, alCambiar, correccion }: PropsCara) {
  const datos = publica as HuecosPublica;
  const partes = trozos(datos.texto);

  return (
    <div>
      <p className="text-lg leading-loose text-tinta">
        {partes.map((parte, i) =>
          parte.tipo === "texto" ? (
            <span key={i}>{parte.valor}</span>
          ) : (
            <input
              key={i}
              type="text"
              value={comoLista(valor[parte.valor])[0] ?? ""}
              disabled={Boolean(correccion)}
              onChange={(e) => alCambiar({ ...valor, [parte.valor]: e.target.value })}
              aria-label="Palabra que falta"
              className="mx-1 inline-block w-32 rounded-lg border-2 border-hp-200 bg-fondo px-2 py-1 text-base text-tinta outline-none focus:border-hp-400 disabled:opacity-70"
            />
          ),
        )}
      </p>

      {correccion && (
        <ul className="mt-4 space-y-2">
          {correccion.items.map((item) => (
            <li key={item.id}>
              <Veredicto acertado={item.acertado} correcta={item.correcta} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
