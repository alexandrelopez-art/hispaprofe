import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Etiqueta, { type TonoEtiqueta } from "@/components/ui/etiqueta";
import TarjetaPieza from "@/components/ui/tarjeta";
import { empezarPractica } from "@/lib/acciones-preparacion";
import type { Tarjeta } from "@/lib/catalogo-preparacion";
import { nombreNivel } from "@/lib/niveles";

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
  if (estado.clase === "ARCHIVADA") return "Archivado por tu profe";
  return "Sin empezar";
}

function tonoDelEstado(estado: Tarjeta["estado"]): TonoEtiqueta {
  if (estado.clase === "A_MEDIAS") return "sol";
  if (estado.clase === "ENTREGADO") return "hp";
  if (estado.clase === "REVISADO") return "verde";
  return "neutro";
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
    <TarjetaPieza className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-tinta">
          {nombreNivel(tarjeta.nivel)} ·{" "}
          {tarjeta.destreza
            ? (NOMBRE_PRUEBA[tarjeta.destreza] ?? tarjeta.destreza)
            : tarjeta.titulo}
          {distintivo && (
            <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-xs font-bold text-tinta-suave">
              {distintivo}
            </span>
          )}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-tinta-suave">
          {tarjeta.pasos} {tarjeta.pasos === 1 ? "tarea" : "tareas"}
          <Etiqueta tono={tonoDelEstado(tarjeta.estado)}>
            {textoDelEstado(tarjeta.estado)}
          </Etiqueta>
        </p>
      </div>

      {estado === "ARCHIVADA" ? (
        // Se le deja mirar, no seguir: el servidor ya se niega a aceptar
        // entregas y a contar escuchas sobre una asignación archivada, así que
        // el enlace no abre ninguna puerta. Sin él, el alumno pierde de vista
        // su propio trabajo, que es lo único que aquí estaba en juego.
        <Boton variante="sutil" tamano="pequeno" href={`/recorridos/${tarjeta.recorridoId}`}>
          Ver lo que hiciste
        </Boton>
      ) : estado !== "SIN_ASIGNAR" ? (
        <Boton variante="sutil" tamano="pequeno" href={`/recorridos/${tarjeta.recorridoId}`}>
          {estado === "SIN_EMPEZAR" ? "Empezar" : "Seguir"}
        </Boton>
      ) : motivo ? (
        <Etiqueta tono="neutro">{motivo}</Etiqueta>
      ) : (
        <form action={empezarPractica}>
          <input type="hidden" name="recorridoId" value={tarjeta.recorridoId} />
          <input type="hidden" name="bloque" value={bloque} />
          <BotonEnviar gerundio="Abriendo…" tamano="pequeno">
            Empezar
          </BotonEnviar>
        </form>
      )}
    </TarjetaPieza>
  );
}
