"use client";

import { useState } from "react";
import type { BuscadorCasas, Vivienda } from "@/lib/ejercicios/buscador-casas";

function Fachada({ tipo }: { tipo: Vivienda["ilustracion"] }) {
  const comun = { width: "100%", height: "100%", viewBox: "0 0 200 200" } as const;
  if (tipo === "casa")
    return (
      <svg {...comun} role="presentation">
        <rect width="200" height="200" fill="var(--cielo)" />
        <rect x="20" y="150" width="160" height="50" fill="var(--verde)" />
        <path d="M45 95 100 55 155 95Z" fill="var(--teja)" />
        <rect x="55" y="95" width="90" height="60" fill="#fff" />
        <rect x="90" y="118" width="20" height="37" fill="var(--cobalto)" />
        <rect x="65" y="105" width="18" height="18" fill="var(--cobalto)" opacity=".75" />
        <rect x="117" y="105" width="18" height="18" fill="var(--cobalto)" opacity=".75" />
        <circle cx="40" cy="150" r="14" fill="var(--verde)" stroke="#fff" strokeWidth="3" />
        <circle cx="163" cy="152" r="11" fill="var(--verde)" stroke="#fff" strokeWidth="3" />
      </svg>
    );
  if (tipo === "atico")
    return (
      <svg {...comun} role="presentation">
        <rect width="200" height="200" fill="var(--cielo)" />
        <rect x="45" y="70" width="110" height="130" fill="#fff" />
        <rect x="45" y="62" width="110" height="10" fill="var(--teja)" />
        {[0, 1, 2].map((f) =>
          [0, 1].map((c) => (
            <rect key={`${f}${c}`} x={64 + c * 44} y={92 + f * 34} width="26" height="22" fill="var(--cobalto)" opacity=".7" />
          ))
        )}
        <rect x="62" y="30" width="76" height="32" fill="var(--ocre)" />
        <rect x="70" y="38" width="60" height="16" fill="#fff" opacity=".55" />
        <circle cx="100" cy="22" r="7" fill="var(--ocre)" />
      </svg>
    );
  return (
    <svg {...comun} role="presentation">
      <rect width="200" height="200" fill="var(--cielo)" />
      <rect x="35" y="35" width="130" height="165" fill="#fff" />
      <rect x="35" y="35" width="130" height="12" fill="var(--cobalto)" />
      {[0, 1, 2, 3].map((f) =>
        [0, 1, 2].map((c) => (
          <rect key={`${f}${c}`} x={50 + c * 38} y={62 + f * 32} width="26" height="22"
            fill={f === 1 && c === 2 ? "var(--ocre)" : "var(--cobalto)"} opacity={f === 1 && c === 2 ? 1 : 0.7} />
        ))
      )}
      <rect x="86" y="172" width="28" height="28" fill="var(--teja)" />
    </svg>
  );
}

export default function BuscadorCasas({ marca, viviendas, consigna }: BuscadorCasas) {
  const [activa, setActiva] = useState(0);
  const v = viviendas[activa];

  return (
    <div className="buscador">
      <style>{`
        .buscador{
          --cobalto:#0F4C9C; --cielo:#E4EDF8; --ocre:#E9A825;
          --teja:#B84A2E; --verde:#3F7D5C; --tinta:#14243A; --linea:#CBD8E8;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          color: var(--tinta); background:#fff; max-width:820px; margin:0 auto;
          border:1px solid var(--linea); border-radius:14px; overflow:hidden;
        }
        .buscador *{box-sizing:border-box;}
        .b-marca{
          background:var(--cobalto); color:#fff; padding:14px 20px;
          display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap;
        }
        .b-marca strong{font-size:19px; font-weight:800; letter-spacing:-.02em; text-transform:lowercase;}
        .b-marca span{font-size:12px; letter-spacing:.14em; text-transform:uppercase; opacity:.75;}
        .b-tabs{display:flex; gap:2px; background:var(--cielo); padding:6px 6px 0; overflow-x:auto;}
        .b-tab{
          flex:1 1 auto; white-space:nowrap; border:0; cursor:pointer;
          background:transparent; color:var(--tinta); opacity:.6;
          font:inherit; font-size:14px; font-weight:600; padding:11px 14px;
          border-radius:9px 9px 0 0; transition:opacity .15s, background .15s;
        }
        .b-tab:hover{opacity:.85;}
        .b-tab[aria-selected="true"]{background:#fff; opacity:1; box-shadow:0 -2px 0 var(--ocre) inset;}
        .b-tab:focus-visible{outline:3px solid var(--ocre); outline-offset:-3px;}
        .b-cuerpo{display:grid; grid-template-columns:210px 1fr; gap:24px; padding:22px;}
        .b-foto{border-radius:10px; overflow:hidden; border:1px solid var(--linea); aspect-ratio:1;}
        .b-titulo{font-size:23px; font-weight:800; letter-spacing:-.02em; margin:0;}
        .b-zona{font-size:14px; color:#5A6B82; margin:3px 0 0;}
        .b-precio{
          display:inline-block; margin:12px 0 20px; padding:5px 12px;
          background:var(--ocre); color:var(--tinta); font-weight:700; font-size:15px; border-radius:6px;
        }
        .b-listas{display:grid; grid-template-columns:1fr 1fr; gap:18px;}
        .b-et{
          font-size:12px; font-weight:800; letter-spacing:.18em; text-transform:uppercase;
          margin:0 0 9px; padding-bottom:6px; border-bottom:2px solid currentColor;
        }
        .b-si .b-et{color:var(--verde);} .b-no .b-et{color:var(--teja);}
        .b-listas ul{list-style:none; margin:0; padding:0; display:grid; gap:7px;}
        .b-listas li{display:flex; gap:8px; font-size:15px; line-height:1.35;}
        .b-listas li::before{font-weight:800; flex:none;}
        .b-si li::before{content:"+"; color:var(--verde);}
        .b-no li::before{content:"–"; color:var(--teja);}
        .b-no li{color:#5A6B82;}
        .b-pie{background:var(--cielo); padding:14px 22px; font-size:14px; border-top:1px solid var(--linea);}
        .b-pie b{color:var(--cobalto);}
        @media (max-width:560px){
          .b-cuerpo{grid-template-columns:1fr; gap:16px;}
          .b-foto{max-width:170px;}
          .b-listas{grid-template-columns:1fr; gap:14px;}
        }
        @media (prefers-reduced-motion:reduce){ .buscador *{transition:none !important;} }
      `}</style>

      <header className="b-marca">
        <strong>{marca}</strong>
        <span>{viviendas.length} viviendas</span>
      </header>

      <div className="b-tabs" role="tablist" aria-label="Viviendas disponibles">
        {viviendas.map((item, i) => (
          <button key={item.id} role="tab" className="b-tab" aria-selected={i === activa} onClick={() => setActiva(i)}>
            {item.titulo}
          </button>
        ))}
      </div>

      <div className="b-cuerpo" role="tabpanel">
        <div className="b-foto"><Fachada tipo={v.ilustracion} /></div>
        <div>
          <h3 className="b-titulo">{v.titulo}</h3>
          <p className="b-zona">{v.zona}</p>
          <p className="b-precio">{v.precio}</p>
          <div className="b-listas">
            <div className="b-si">
              <p className="b-et">Hay</p>
              <ul>{v.hay.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="b-no">
              <p className="b-et">No hay</p>
              <ul>{v.noHay.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </div>
      </div>

      <p className="b-pie"><b>Tu turno.</b> {consigna}</p>
    </div>
  );
}
