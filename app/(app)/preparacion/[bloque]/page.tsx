import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogoDeBloque, profesorDelEstudiante } from "@/lib/catalogo-preparacion";
import { bloquePorNombre } from "@/lib/preparacion";
import { getUsuarioActual } from "@/lib/usuario";
import TarjetaExamen from "./tarjeta-examen";

export const dynamic = "force-dynamic";

export default async function BloquePage({
  params,
}: {
  params: Promise<{ bloque: string }>;
}) {
  const { bloque: nombre } = await params;
  const bloque = bloquePorNombre(nombre);
  if (!bloque) notFound();

  const usuario = await getUsuarioActual();
  const tarjetas = await catalogoDeBloque(bloque.orden, usuario?.id ?? null);

  // El motivo se resuelve una vez para toda la página: es el mismo para todas
  // las tarjetas y depende del alumno, no del examen.
  const tieneProfesor = usuario ? (await profesorDelEstudiante(usuario.id)) !== null : false;
  const motivo = !bloque.autoservicio
    ? "Este examen lo abre tu profesor"
    : !usuario
      ? "Entra para empezar"
      : tieneProfesor
        ? null
        : "Habla con tu profe para que te dé un grupo";

  // El vacío también tiene que decir la verdad. En un bloque que no es
  // autoservicio el catálogo ya solo trae lo que le abrieron, así que la lista
  // vacía significa de verdad «no te han abierto ninguno»; lo que no puede es
  // culpar al profe de quien ni siquiera ha entrado.
  const vacio = bloque.autoservicio
    ? "Todavía no hay nada publicado en este bloque."
    : !usuario
      ? "Entra para ver los exámenes blancos que te haya abierto tu profe."
      : "Tu profe no te ha abierto ningún examen blanco todavía.";

  // Agrupadas por examen, en el orden en que vienen del catálogo. Las que no
  // son de un examen concreto caen juntas al final.
  const porExamen = new Map<number | null, typeof tarjetas>();
  for (const t of tarjetas) {
    const lista = porExamen.get(t.examen) ?? [];
    lista.push(t);
    porExamen.set(t.examen, lista);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/preparacion"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Preparación DELE
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        Bloque {bloque.orden} · {bloque.titulo}
      </h1>
      <p className="mt-2 text-tinta-suave">{bloque.descripcion}</p>

      {tarjetas.length === 0 ? (
        <p className="mt-10 rounded-tarjeta border border-hp-100 bg-white p-6 text-sm text-tinta-suave shadow-suave">
          {vacio}
        </p>
      ) : (
        <div className="mt-10 space-y-8">
          {[...porExamen.entries()].map(([examen, lista]) => (
            <section key={examen ?? "sueltos"}>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-tinta-suave">
                {examen === null ? "Sin examen concreto" : `Examen ${examen}`}
              </h2>
              <div className="mt-3 space-y-3">
                {lista.map((t) => (
                  <TarjetaExamen
                    key={t.recorridoId}
                    tarjeta={t}
                    motivo={motivo}
                    bloque={bloque.nombre}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
