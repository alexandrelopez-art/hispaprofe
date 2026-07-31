"use client";

export type SujetoDeParrilla = {
  id: string;
  numero: number;
  eje: string;
  titulo: string;
  descripcion: string;
  fuente: string | null;
  url: string | null;
  preguntas: string[];
  imagenId: string | null;
};

export default function ParrillaSujets({
  sujetos,
  elegidoId,
  alElegir,
  preguntadas = [],
  alPreguntar,
}: {
  sujetos: SujetoDeParrilla[];
  elegidoId: string | null;
  alElegir: (id: string) => void;
  preguntadas?: number[];
  alPreguntar?: (indice: number) => void;
}) {
  const elegido = sujetos.find((s) => s.id === elegidoId) ?? null;

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">
        {sujetos.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => alElegir(s.id)}
            className={`relative overflow-hidden rounded-lg border bg-white p-1.5 text-left ${
              s.id === elegidoId ? "border-2 border-verde-500" : "border-hp-100"
            }`}
          >
            <span className="absolute left-2 top-2 rounded bg-tinta px-1.5 py-0.5 text-[10px] font-extrabold text-white">
              {s.numero}
            </span>
            {s.imagenId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/archivos/${s.imagenId}`}
                alt={`Sujet ${s.numero}`}
                className="aspect-[1/1.18] w-full rounded object-cover object-top"
              />
            ) : (
              <span className="flex aspect-[1/1.18] items-center justify-center rounded bg-fondo text-xs text-tinta-suave">
                sin imagen
              </span>
            )}
            <span className="mt-1 block text-center text-[10px] font-semibold leading-tight text-tinta-suave">
              {s.titulo.length > 30 ? `${s.titulo.slice(0, 28)}…` : s.titulo}
            </span>
          </button>
        ))}
      </div>

      {elegido && (
        <div className="mt-4 rounded-tarjeta bg-white p-5 shadow-suave">
          <span className="inline-block rounded-full bg-bloque1/25 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-tinta">
            {elegido.eje} · Doc. {elegido.numero}
          </span>
          <h3 className="mt-2 text-lg font-extrabold text-tinta">{elegido.titulo}</h3>
          <p className="mt-1 text-sm text-tinta-suave">{elegido.descripcion}</p>
          {elegido.fuente && (
            <p className="mt-1 text-xs text-tinta-suave">
              {elegido.fuente}
              {elegido.url && (
                <>
                  {" — "}
                  <a
                    href={elegido.url}
                    target="_blank"
                    rel="noopener"
                    className="font-bold text-hp-400"
                  >
                    ver fuente ↗
                  </a>
                </>
              )}
            </p>
          )}

          {elegido.preguntas.length > 0 && alPreguntar && (
            <div className="mt-4 border-l-4 border-bloque1 pl-4">
              <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-tinta-suave">
                Preguntas para la interacción · clic para marcar
              </h4>
              <ol className="mt-2 space-y-1.5">
                {elegido.preguntas.map((q, i) => {
                  const hecha = preguntadas.includes(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => alPreguntar(i)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          hecha
                            ? "border-verde-500 bg-verde-500/10 text-tinta-suave line-through"
                            : "border-transparent bg-fondo text-tinta"
                        }`}
                      >
                        {hecha ? "✓ " : `${i + 1}. `}
                        {q}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </>
  );
}
