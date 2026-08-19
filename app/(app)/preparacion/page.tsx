import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BLOQUES } from "@/lib/preparacion";

export const dynamic = "force-dynamic";

export default async function PreparacionPage() {
  const disponibles = await prisma.recorrido.groupBy({
    by: ["orden"],
    where: { tipo: "PREPARACION_DELE", publicado: true },
    _count: { _all: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Preparación DELE
      </h1>
      <p className="mt-2 text-tinta-suave">
        Cuatro bloques, en orden. El primero es la llave: sin saber cómo está
        hecho el examen, practicar sirve de poco.
      </p>

      <div className="mt-10 space-y-5">
        {BLOQUES.map((bloque) => {
          const cuantos =
            disponibles.find((d) => d.orden === bloque.orden)?._count._all ?? 0;
          const activo = cuantos > 0;

          return (
            <article
              key={bloque.orden}
              className={`flex gap-5 rounded-tarjeta border border-hp-100 bg-white p-6 shadow-suave transition ${
                activo ? bloque.borde : "opacity-70"
              }`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-extrabold text-tinta ${bloque.acento}`}
              >
                {bloque.orden}
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-tinta">
                  Bloque {bloque.orden} · {bloque.titulo}
                </h2>
                <p className="mt-1 text-sm text-tinta-suave">
                  {bloque.descripcion}
                </p>

                {activo ? (
                  <Link
                    href={`/preparacion/${bloque.nombre}`}
                    className="mt-4 inline-block rounded-full bg-hp-400 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-hp-500"
                  >
                    Ver los {cuantos}
                  </Link>
                ) : (
                  <p className="mt-4 inline-block rounded-full bg-fondo px-4 py-2 text-xs font-bold text-tinta-suave">
                    En preparación
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
