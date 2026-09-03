import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { borrarSujeto, crearSujeto } from "@/lib/acciones-orales";
import SubirDocumento from "@/components/orales/subir-documento";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Tarjeta from "@/components/ui/tarjeta";

export const dynamic = "force-dynamic";

export default async function SujetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Mismo patrón que el resto de pantallas de profe: redirigir por el rol,
  // no lanzar. `exigirProfesor()` está pensado para acciones de servidor,
  // no para páginas: aquí no hay `error.tsx` que atrape el throw.
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }
  const convocatoria = await prisma.convocatoria.findUnique({
    where: { id },
    select: { id: true, nombre: true, profesorId: true },
  });
  if (!convocatoria) notFound();
  if (convocatoria.profesorId !== usuario.id && usuario.role !== "ADMIN") notFound();

  const sujetos = await prisma.sujeto.findMany({
    where: { convocatoriaId: id },
    orderBy: { numero: "asc" },
    select: {
      id: true,
      numero: true,
      eje: true,
      titulo: true,
      imagenId: true,
      _count: { select: { evaluaciones: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Encabezado titulo={`Sujets · ${convocatoria.nombre}`} />

      {/* Ninguno de estos campos tenía una etiqueta visible antes (solo
          `placeholder`); `Campo` exige una, así que «Nº», «Eje», «Título»,
          «Descripción», «Fuente», «URL» y «Preguntas» son texto nuevo — mismo
          criterio que ya usó la zona 1 en el buscador de `/recorridos`. */}
      <form action={crearSujeto} className="mt-5">
        <Tarjeta relleno="compacto" className="space-y-3">
          <input type="hidden" name="convocatoriaId" value={id} />
          <div className="flex gap-3">
            <Campo
              etiqueta="Nº"
              name="numero"
              tipo="numero"
              min={1}
              required
              className="w-20"
            />
            <Campo
              etiqueta="Eje"
              name="eje"
              tipo="texto"
              required
              placeholder="Eje (Arte y poder)"
              className="flex-1"
            />
          </div>
          <Campo
            etiqueta="Título"
            name="titulo"
            tipo="texto"
            required
            placeholder="Título del documento"
          />
          <Campo
            etiqueta="Descripción"
            name="descripcion"
            tipo="area"
            rows={2}
            placeholder="De qué es la imagen"
          />
          <div className="flex gap-3">
            <Campo
              etiqueta="Fuente"
              name="fuente"
              tipo="texto"
              placeholder="Fuente (BBC Mundo)"
              className="flex-1"
            />
            {/* Campo no cubre url todavía: se deja el <input> nativo con las
                clases de Campo. */}
            <label className="block flex-1 text-sm font-semibold text-tinta">
              URL
              <input
                name="url"
                type="url"
                placeholder="https://…"
                className="mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400"
              />
            </label>
          </div>
          <Campo
            etiqueta="Preguntas"
            name="preguntas"
            tipo="area"
            rows={5}
            placeholder="Una pregunta de interacción por línea"
          />
          <SubirDocumento />
          <BotonEnviar gerundio="Añadiendo…">Añadir el sujet</BotonEnviar>
        </Tarjeta>
      </form>

      <ul className="mt-6 space-y-2">
        {sujetos.map((s) => (
          <li key={s.id}>
            <Tarjeta relleno="minimo" className="flex items-center gap-3">
              <span className="w-8 text-center font-extrabold text-tinta">{s.numero}</span>
              <span className="flex-1">
                <span className="block font-bold text-tinta">{s.titulo}</span>
                <span className="text-xs text-tinta-suave">{s.eje}</span>
              </span>
              {s._count.evaluaciones === 0 && (
                <form action={borrarSujeto}>
                  <input type="hidden" name="sujetoId" value={s.id} />
                  <BotonEnviar gerundio="Borrando…" variante="peligro" tamano="pequeno">
                    Borrar
                  </BotonEnviar>
                </form>
              )}
            </Tarjeta>
          </li>
        ))}
      </ul>
    </main>
  );
}
