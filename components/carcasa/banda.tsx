"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { herramientaActiva, herramientasDe, puertaActiva } from "@/lib/carcasa/puertas";
import Rotulo from "@/components/ui/rotulo";

/**
 * La franja de herramientas del profesor bajo la cabecera. Cliente: Next no
 * vuelve a ejecutar el layout (ni por tanto un componente de servidor) en
 * una navegación de cliente, así que la ruta se lee con `usePathname()`, no
 * de la cabecera del servidor —si no, la banda se queda congelada en la
 * primera puerta que se cargó.
 */
export default function Banda({ rol }: { rol: string }) {
  const ruta = usePathname() ?? "/";
  const puerta = puertaActiva(ruta);
  const herramientas = herramientasDe(puerta, rol);
  if (herramientas.length === 0) return null;
  const activa = herramientaActiva(herramientas, ruta);
  return (
    <div className="border-b border-hp-100 bg-white/70">
      <nav aria-label="Herramientas" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-6 py-2 text-sm font-semibold">
        <Rotulo>Tus herramientas</Rotulo>
        {herramientas.map((h) =>
          h.pronto ? (
            <span key={h.nombre} className="text-tinta-suave/60">{h.nombre} <span className="text-[11px]">· pronto</span></span>
          ) : (
            <Link
              key={h.nombre}
              href={h.ruta}
              aria-current={activa?.nombre === h.nombre ? "page" : undefined}
              className={activa?.nombre === h.nombre ? "text-hp-500" : "text-tinta-suave hover:text-hp-500"}
            >
              {h.nombre}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
