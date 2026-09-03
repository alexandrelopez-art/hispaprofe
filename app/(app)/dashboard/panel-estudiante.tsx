import { prisma } from "@/lib/prisma";
import Encabezado from "@/components/ui/encabezado";
import Tarjeta from "@/components/ui/tarjeta";
import { deberesPendientes, proximaClase } from "@/lib/clases";
import { fechaHora } from "@/lib/fechas";
import { cuantosPorBloque } from "@/lib/catalogo-preparacion";
import { BLOQUES } from "@/lib/preparacion";
import { resumenEstudiante } from "@/lib/progreso";
import Puertas from "./puertas";

type Usuario = { id: string; firstName: string | null; email: string };

export default async function PanelEstudiante({
  usuario,
}: {
  usuario: Usuario;
}) {
  const saludo = `Hola, ${usuario.firstName ?? usuario.email}`;

  const [resumen, asignacionesVivas, proxima, deberes, cuantosPor] =
    await Promise.all([
      resumenEstudiante(usuario.id),
      prisma.asignacion.count({
        where: { estudianteId: usuario.id, archivada: false },
      }),
      proximaClase(usuario.id),
      deberesPendientes(usuario.id),
      cuantosPorBloque(BLOQUES, usuario.id),
    ]);

  // Sin secuencias y sin puntos no hay nada que contar: se salta la hucha
  // para no recibir a alguien nuevo con un cero.
  const mostrarHucha = asignacionesVivas > 0 || resumen.pasosRevisados > 0;

  const examenesDisponibles = [...cuantosPor.values()].reduce(
    (suma, n) => suma + n,
    0,
  );
  const dele =
    examenesDisponibles > 0
      ? `${examenesDisponibles} exámenes disponibles`
      : "Todavía sin exámenes";

  let clases = proxima
    ? `Próxima clase: ${fechaHora(proxima.empiezaEl)}`
    : "Sin clase programada";
  if (deberes.length > 0) clases += ` · ${deberes.length} deberes`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado titulo={saludo} />

      <Puertas datos={{ dele, clases }} />

      {mostrarHucha && (
        <Tarjeta className="mt-8">
          {resumen.pasosRevisados === 0 ? (
            <>
              <p className="text-lg font-bold text-tinta">
                Aún no tienes puntos.
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                Se ganan cuando tu profe revisa un paso.
              </p>
            </>
          ) : (
            <>
              <p className="text-5xl font-extrabold leading-none text-tinta">
                {resumen.puntosTotales}
                <span className="ml-2 text-lg font-bold text-tinta-suave">
                  puntos
                </span>
              </p>
              <p className="mt-2 text-sm text-tinta-suave">
                {resumen.pasosRevisados} paso
                {resumen.pasosRevisados !== 1 ? "s" : ""} revisado
                {resumen.pasosRevisados !== 1 ? "s" : ""} por tu profe
              </p>
            </>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
