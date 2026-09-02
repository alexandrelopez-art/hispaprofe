import Boton from "@/components/ui/boton";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta, { type Acento } from "@/components/ui/tarjeta";
import { cuantosPorBloque } from "@/lib/catalogo-preparacion";
import { BLOQUES } from "@/lib/preparacion";
import { getUsuarioActual } from "@/lib/usuario";

export const dynamic = "force-dynamic";

const ACENTO_POR_ORDEN: Record<number, Acento> = {
  1: "bloque1",
  2: "bloque2",
  3: "bloque3",
  4: "bloque4",
};

// Clases completas y literales a propósito: Tailwind solo genera las clases
// que puede leer tal cual en el código, no las que se arman por concatenación.
const CIRCULO_POR_ORDEN: Record<number, string> = {
  1: "bg-bloque1",
  2: "bg-bloque2",
  3: "bg-bloque3",
  4: "bg-bloque4",
};

export default async function DelePage() {
  const usuario = await getUsuarioActual();
  const cuantosPor = await cuantosPorBloque(BLOQUES, usuario?.id ?? null);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado
        titulo="DELE"
        lede="Cuatro bloques, en orden. El primero es la llave: sin saber cómo está hecho el examen, practicar sirve de poco."
      />

      <div className="space-y-5">
        {BLOQUES.map((bloque) => {
          const cuantos = cuantosPor.get(bloque.orden) ?? 0;
          const activo = cuantos > 0;

          return (
            <Tarjeta
              key={bloque.orden}
              acento={ACENTO_POR_ORDEN[bloque.orden]}
              className={activo ? undefined : "opacity-70"}
            >
              <div className="flex gap-5">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-extrabold text-tinta ${CIRCULO_POR_ORDEN[bloque.orden]}`}
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

                  <div className="mt-4">
                    {activo ? (
                      <Boton tamano="pequeno" href={`/dele/${bloque.nombre}`}>
                        Ver los {cuantos}
                      </Boton>
                    ) : (
                      // Vacío no significa lo mismo en los dos sitios: en un bloque
                      // autoservicio es que no hay material cargado, y en el examen
                      // blanco es que su profe todavía no le ha abierto ninguno.
                      <Etiqueta tono="neutro">
                        {bloque.autoservicio ? "En preparación" : "Te lo abre tu profe"}
                      </Etiqueta>
                    )}
                  </div>
                </div>
              </div>
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}
