import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function Dato({ n, etiqueta }: { n: number | string; etiqueta: string }) {
  return (
    <div className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <p className="text-3xl font-extrabold text-tinta">{n}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-tinta-suave">
        {etiqueta}
      </p>
    </div>
  );
}

/** Bytes en algo legible. Los archivos viven en la base, así que importa. */
function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminResumenPage() {
  const [porRol, secuencias, publicadas, ejercicios, archivos] =
    await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.recorrido.count(),
      prisma.recorrido.count({ where: { publicado: true } }),
      prisma.ejercicio.count(),
      prisma.archivo.aggregate({ _sum: { tamano: true }, _count: { _all: true } }),
    ]);

  const cuantos = (rol: string) =>
    porRol.find((r) => r.role === rol)?._count._all ?? 0;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dato n={cuantos("ADMIN")} etiqueta="Administradores" />
        <Dato n={cuantos("PROFESOR")} etiqueta="Profesores" />
        <Dato n={cuantos("STUDENT")} etiqueta="Estudiantes" />
        <Dato n={`${publicadas} / ${secuencias}`} etiqueta="Secuencias publicadas" />
        <Dato n={ejercicios} etiqueta="Ejercicios" />
        <Dato
          n={tamano(archivos._sum.tamano ?? 0)}
          etiqueta={`${archivos._count._all} archivos en la base`}
        />
      </div>

      <p className="mt-6 rounded-xl bg-sol-100 px-4 py-3 text-sm text-tinta">
        Las imágenes y los audios se guardan dentro de la base de datos, no en un
        servicio aparte. Vigila ese último número: si crece mucho, la copia de
        seguridad crece con él.
      </p>
    </>
  );
}
