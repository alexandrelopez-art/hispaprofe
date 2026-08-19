import Link from "next/link";
import { empezarPractica } from "@/lib/acciones-preparacion";
import type { Tarjeta } from "@/lib/catalogo-preparacion";

const NOMBRE_PRUEBA: Record<string, string> = {
  CO: "Comprensión auditiva",
  CE: "Comprensión de lectura",
  EE: "Expresión escrita",
  EO: "Expresión oral",
  EEI: "Expresión e interacción escritas",
  EOI: "Expresión e interacción orales",
};

function textoDelEstado(estado: Tarjeta["estado"]): string {
  if (estado.clase === "A_MEDIAS") {
    return `A medias · ${estado.hechos} de ${estado.total} tareas`;
  }
  if (estado.clase === "ENTREGADO") return "Entregado · esperando corrección";
  if (estado.clase === "REVISADO") return `Revisado · ${estado.puntos} puntos`;
  return "Sin empezar";
}

/**
 * Un examen del catálogo.
 *
 * `motivo` llega ya resuelto por la página: es la razón por la que este alumno
 * no puede abrirlo (sin grupo, o es un examen blanco). Con motivo no se pinta
 * botón, se pinta la razón: un botón que solo sirve para dar un error no es un
 * botón.
 */
export default function TarjetaExamen({
  tarjeta,
  motivo,
}: {
  tarjeta: Tarjeta;
  motivo: string | null;
}) {
  const empezada = tarjeta.estado.clase !== "SIN_EMPEZAR";

  return (
    <article className="flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-tinta">
          {tarjeta.destreza
            ? (NOMBRE_PRUEBA[tarjeta.destreza] ?? tarjeta.destreza)
            : tarjeta.titulo}
        </h3>
        <p className="mt-1 text-sm text-tinta-suave">
          {tarjeta.pasos} {tarjeta.pasos === 1 ? "tarea" : "tareas"} ·{" "}
          {textoDelEstado(tarjeta.estado)}
        </p>
      </div>

      {empezada ? (
        <Link
          href={`/recorridos/${tarjeta.recorridoId}`}
          className="rounded-full bg-hp-400 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-hp-500"
        >
          Seguir
        </Link>
      ) : motivo ? (
        <p className="rounded-full bg-fondo px-4 py-2 text-xs font-bold text-tinta-suave">
          {motivo}
        </p>
      ) : (
        <form action={empezarPractica}>
          <input type="hidden" name="recorridoId" value={tarjeta.recorridoId} />
          <button
            type="submit"
            className="rounded-full bg-hp-400 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-hp-500"
          >
            Empezar
          </button>
        </form>
      )}
    </article>
  );
}
