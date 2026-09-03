import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { puedeEditarse } from "@/lib/recursos";
import { analizar } from "@/lib/ejercicios/registro";
import { analizarExpresion } from "@/lib/expresion";
import { notFound, redirect } from "next/navigation";
import Editor, { type MarcaRecurso } from "@/components/recursos/editor";
import Encabezado from "@/components/ui/encabezado";

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
  // discriminante que lee el motor, y el editor tiene que casar con él. La
  // expresión no pasa por `analizar` —no es uno de los cuatro tipos del
  // motor—, así que a la primera vez que falla se le pregunta a su propio
  // esquema antes de rendirse.
  const analizado = analizar(fila.datos);
  const expresion = analizado ? null : analizarExpresion(fila.datos);
  if (!analizado && !expresion) notFound();
  const marca: MarcaRecurso = analizado ? analizado.tipo : "expresion";

  const bloqueado = await puedeEditarse(id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Encabezado
        titulo={fila.titulo}
        volver={{ href: "/profe/recursos", texto: "Recursos" }}
      />

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
          marca={marca}
          bloqueado={bloqueado}
        />
      </div>
    </div>
  );
}
