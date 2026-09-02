"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUERTAS, puertaActiva } from "@/lib/carcasa/puertas";

/** Cliente solo para saber en qué puerta estamos; no tiene estado propio. */
export default function NavPuertas() {
  const activa = puertaActiva(usePathname() ?? "/");
  return (
    <nav aria-label="Puertas" className="-mb-px flex gap-1 overflow-x-auto text-sm font-bold">
      {PUERTAS.map((p) => {
        const esActiva = p.clave === activa.clave;
        return (
          <Link
            key={p.clave}
            href={p.ruta}
            aria-current={esActiva ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 transition-colors ${
              esActiva ? "border-hp-500 text-hp-500" : "border-transparent text-tinta-suave hover:text-hp-500"
            }`}
          >
            {p.nombre}
          </Link>
        );
      })}
    </nav>
  );
}
