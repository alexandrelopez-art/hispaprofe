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

// El mismo criterio que el resto de la casa (`/recorridos/[id]`, la elección
// de DELE al crear una secuencia…): los niveles MCER se enseñan tal cual y el
// único que necesita traducción es el combinado de escolares.
const NOMBRE_NIVEL: Record<string, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  A2_B1_ESCOLAR: "A2/B1 escolar",
};

function textoDelEstado(estado: Tarjeta["estado"]): string {
  if (estado.clase === "A_MEDIAS") {
    return `A medias · ${estado.hechos} de ${estado.total} tareas`;
  }
  if (estado.clase === "ENTREGADO") return "Entregado · esperando corrección";
  if (estado.clase === "REVISADO") return `Revisado · ${estado.puntos} puntos`;
  if (estado.clase === "ARCHIVADA") return "Archivado por tu profe";
  return "Sin empezar";
}

/**
 * Un examen del catálogo.
 *
 * `motivo` llega ya resuelto por la página: es la razón por la que este alumno
 * no puede abrirlo (sin grupo, o es un examen blanco). Con motivo no se pinta
 * botón, se pinta la razón: un botón que solo sirve para dar un error no es un
 * botón.
 *
 * `bloque` es el segmento de URL de la página que pinta esta tarjeta; viaja en
 * el formulario para que la acción sepa a dónde devolver al alumno si al
 * pulsar ya no se puede empezar.
 */
export default function TarjetaExamen({
  tarjeta,
  motivo,
  bloque,
  distintivo,
}: {
  tarjeta: Tarjeta;
  motivo: string | null;
  bloque: string;
  /** Lo que separa esta tarjeta de otra que se leería igual, o null. */
  distintivo: string | null;
}) {
  // Quién decide la puerta es la asignación, no los pasos hechos: un examen
  // blanco que su profe le abrió y que todavía no ha tocado tiene que
  // enlazarse desde aquí, que es la página que existe para eso, y no solo
  // desde el panel.
  const estado = tarjeta.estado.clase;

  return (
    <article className="flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-tinta">
          {NOMBRE_NIVEL[tarjeta.nivel] ?? tarjeta.nivel} ·{" "}
          {tarjeta.destreza
            ? (NOMBRE_PRUEBA[tarjeta.destreza] ?? tarjeta.destreza)
            : tarjeta.titulo}
          {distintivo && (
            <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-xs font-bold text-tinta-suave">
              {distintivo}
            </span>
          )}
        </h3>
        <p className="mt-1 text-sm text-tinta-suave">
          {tarjeta.pasos} {tarjeta.pasos === 1 ? "tarea" : "tareas"} ·{" "}
          {textoDelEstado(tarjeta.estado)}
        </p>
      </div>

      {estado === "ARCHIVADA" ? (
        <p className="rounded-full bg-fondo px-4 py-2 text-xs font-bold text-tinta-suave">
          Habla con tu profe para recuperarlo
        </p>
      ) : estado !== "SIN_ASIGNAR" ? (
        <Link
          href={`/recorridos/${tarjeta.recorridoId}`}
          className="rounded-full bg-hp-400 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-hp-500"
        >
          {estado === "SIN_EMPEZAR" ? "Empezar" : "Seguir"}
        </Link>
      ) : motivo ? (
        <p className="rounded-full bg-fondo px-4 py-2 text-xs font-bold text-tinta-suave">
          {motivo}
        </p>
      ) : (
        <form action={empezarPractica}>
          <input type="hidden" name="recorridoId" value={tarjeta.recorridoId} />
          <input type="hidden" name="bloque" value={bloque} />
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
