import { prisma } from "@/lib/prisma";
import { listarEstudiantesElegibles } from "@/lib/estudiantes";
import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Link from "next/link";
import ImportarCliente from "./importar-cliente";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const [estudiantes, secuencias] = await Promise.all([
    listarEstudiantesElegibles({
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.recorrido.findMany({
      orderBy: [{ tipo: "asc" }, { orden: "asc" }],
      select: {
        id: true,
        titulo: true,
        pasos: {
          orderBy: { orden: "asc" },
          select: { id: true, orden: true, titulo: true },
        },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Panel
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        Importar resultados
      </h1>
      <p className="mt-2 text-tinta-suave">
        Sube el informe de Genially (el .zip entero o el CSV de ranking).
        La herramienta propone el emparejamiento con tus estudiantes y los
        puntos según los aciertos; tú revisas, corriges y confirmas. Nada se
        guarda sin tu aprobación.
      </p>

      <ImportarCliente estudiantes={estudiantes} secuencias={secuencias} />
    </div>
  );
}
