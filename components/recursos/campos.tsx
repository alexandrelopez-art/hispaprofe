"use client";

export const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export const area =
  "mt-1 w-full rounded-tarjeta border border-hp-200 bg-white p-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export const botonSecundario =
  "h-9 rounded-full border border-hp-200 px-4 text-sm font-bold text-tinta transition-colors hover:border-hp-400";

export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  ancho = true,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  ancho?: boolean;
}) {
  return (
    <label className={`block text-sm font-semibold text-tinta ${ancho ? "" : "w-40"}`}>
      {etiqueta}
      <input
        type="text"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className={campo}
      />
    </label>
  );
}

export function BotonQuitar({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
    >
      {children}
    </button>
  );
}
