import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { puedeEditarse } from "@/lib/recursos";
import { analizar } from "@/lib/ejercicios/registro";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Editor from "@/components/recursos/editor";

export const dynamic = "force-dynamic";

export default async function RecursoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const fila = await prisma.ejercicio.findUnique({ where: { id } });
  if (!fila) notFound();

  // La marca sale del propio `datos`, no de la columna `tipo`: es el
  // discriminante que lee el motor, y el editor tiene que casar con él.
  const analizado = analizar(fila.datos);
  if (!analizado) notFound();

  const bloqueado = await puedeEditarse(id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/profe/recursos" className="text-sm font-semibold text-tinta-suave hover:text-hp-500">
        ← Recursos
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">{fila.titulo}</h1>

      <div className="mt-8">
        <Editor
          inicial={{
            id: fila.id,
            titulo: fila.titulo,
            nivel: fila.nivel,
            destreza: fila.destreza,
            etiquetas: fila.etiquetas,
            datos: fila.datos,
            publicado: fila.publicado,
          }}
          marca={analizado.tipo}
          bloqueado={bloqueado}
        />
      </div>
    </div>
  );
}
