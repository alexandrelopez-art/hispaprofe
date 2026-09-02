import Link from "next/link";
import { headers } from "next/headers";
import { herramientaActiva, herramientasDe, puertaActiva } from "@/lib/carcasa/puertas";
import Rotulo from "@/components/ui/rotulo";

/**
 * La franja de herramientas del profesor bajo la cabecera. Lee la ruta de
 * `x-ruta-actual`, que pone el proxy (la Entrega 1 la dejó para esto).
 */
export default async function Banda({ rol }: { rol: string }) {
  const ruta = (await headers()).get("x-ruta-actual") ?? "/";
  const puerta = puertaActiva(ruta);
  const herramientas = herramientasDe(puerta, rol);
  if (herramientas.length === 0) return null;
  const activa = herramientaActiva(herramientas, ruta);
  return (
    <div className="border-b border-hp-100 bg-white/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-6 py-2 text-sm font-semibold">
        <Rotulo>Tus herramientas</Rotulo>
        {herramientas.map((h) =>
          h.pronto ? (
            <span key={h.nombre} className="text-tinta-suave/60">{h.nombre} <span className="text-[11px]">· pronto</span></span>
          ) : (
            <Link key={h.nombre} href={h.ruta} className={activa?.nombre === h.nombre ? "text-hp-500" : "text-tinta-suave hover:text-hp-500"}>{h.nombre}</Link>
          ),
        )}
      </div>
    </div>
  );
}
