import Tarjeta from "@/components/ui/tarjeta";
import Rotulo from "@/components/ui/rotulo";
import { PUERTAS } from "@/lib/carcasa/puertas";

export type DatoDePuerta = { dele: string; clases: string };

/** Las cinco puertas como tarjetas, con un dato vivo en las dos que ya tienen contenido. */
export default function Puertas({ datos }: { datos: DatoDePuerta }) {
  const acento = { dele: "bloque1", clases: "bloque2", actividades: "bloque3", articulos: "bloque4", biblioteca: "hp" } as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PUERTAS.filter((p) => p.clave !== "inicio").map((p) => (
        <Tarjeta key={p.clave} href={p.ruta} acento={acento[p.clave as keyof typeof acento]}>
          <Rotulo>{p.nombre}</Rotulo>
          <p className="mt-2 text-lg font-bold text-tinta">
            {p.clave === "dele" ? datos.dele : p.clave === "clases" ? datos.clases : "Pronto"}
          </p>
        </Tarjeta>
      ))}
    </div>
  );
}
