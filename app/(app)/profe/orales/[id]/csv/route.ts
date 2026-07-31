import { prisma } from "@/lib/prisma";
import { exigirProfesor } from "@/lib/profesor";
import { construirCsv } from "@/lib/orales/csv";
import type { FilaCsv } from "@/lib/orales/csv";
import { esPausa } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const usuario = await exigirProfesor();

  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id },
    select: { nombre: true, profesorId: true },
  });
  if (!convocatoria) return new Response("No encontrado", { status: 404 });
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") {
    return new Response("Sin permiso", { status: 403 });
  }

  const turnos = await prisma.turno.findMany({
    where: { convocatoriaId: id },
    orderBy: { orden: "asc" },
    select: {
      estudianteId: true, dia: true, hora: true, sala: true,
      estudiante: { select: { firstName: true, lastName: true, email: true } },
      evaluacion: {
        select: {
          notas: true, comentarios: true, segundosEoc: true, segundosEoi: true,
          // El sujet de la evaluación tiene que ser de esta misma
          // convocatoria: lo garantiza `sujetoDeConvocatoria` al guardar,
          // así que aquí basta con leerlo.
          sujeto: { select: { numero: true, titulo: true, eje: true } },
        },
      },
    },
  });

  // Las pausas fuera: no son un estudiante sin nota, es que no hay nadie.
  // Un turno sin emparejar comparte `estudianteId: null` con la pausa, y por
  // eso hace falta `esPausa` (que mira también la hora) en vez de filtrar
  // por `estudianteId` a secas: ese turno sí tiene que salir en el CSV,
  // con sus celdas vacías, porque el profesor necesita verlo.
  const filas: FilaCsv[] = turnos
    .filter((t) => !esPausa(t))
    .map((t) => ({
      dia: t.dia,
      hora: t.hora,
      apellido: t.estudiante?.lastName ?? "",
      nombre: t.estudiante?.firstName ?? t.estudiante?.email ?? "",
      sala: t.sala ?? "",
      sujetNumero: t.evaluacion?.sujeto?.numero ?? null,
      sujetTitulo: t.evaluacion?.sujeto?.titulo ?? "",
      eje: t.evaluacion?.sujeto?.eje ?? "",
      // `null` y no `0`: sin evaluación, o con evaluación pero sin
      // cronometrar, el examen no ha durado cero segundos, es que no se
      // sabe cuánto ha durado.
      segundosEoc: t.evaluacion?.segundosEoc ?? null,
      segundosEoi: t.evaluacion?.segundosEoi ?? null,
      notas: (t.evaluacion?.notas as Notas) ?? {},
      comentarios: (t.evaluacion?.comentarios as Record<string, string>) ?? {},
    }));

  const nombre = convocatoria.nombre.replace(/[^\w-]+/g, "_").slice(0, 60);
  return new Response(construirCsv(filas), {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}.csv"`,
    },
  });
}
