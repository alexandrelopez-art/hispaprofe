import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { NIVELES } from "@/lib/niveles";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

export const dynamic = "force-dynamic";

// WIDGET no está: Recursos no lo gestiona (no tiene `datos.ejercicio` ni
// editor propio, y su página da 404). Esta tabla también hace de lista de
// tipos válidos para el filtro de la URL, así que basta con no ponerlo aquí
// para que desaparezca del desplegable y de la consulta a la vez.
const tipoLabel: Record<string, string> = {
  OPCION_MULTIPLE: "Opción",
  HUECOS: "Huecos",
  RELACIONAR: "Relacionar",
  ORDENAR: "Ordenar",
  // Recursos sí la gestiona: tiene editor propio y su fila se lista como las
  // demás. Sin esta entrada se leía «EXPRESION · B1» y `?tipo=EXPRESION` se
  // descartaba como si no existiera.
  EXPRESION: "Expresión",
};

// Solo para pintar el desplegable: los valores válidos salen del enum
// generado, no de esta tabla.
const destrezaLabel: Record<string, string> = {
  CE: "Comprensión escrita",
  CO: "Comprensión oral",
  EE: "Expresión escrita",
  EO: "Expresión oral",
  EEI: "Interacción escrita",
  EOI: "Interacción oral",
};

export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{
    nivel?: string;
    destreza?: string;
    tipo?: string;
    estado?: string;
    q?: string;
  }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { nivel, destreza, tipo, estado, q } = await searchParams;

  // Los filtros vienen de la URL, no de un <select> que el servidor
  // controle: alguien puede teclear cualquier cosa. Un valor que no exista
  // en el enum generado revienta a Prisma con un `PrismaClientValidationError`
  // (un 500) en vez de ignorarse. Se comprueba con `Object.hasOwn` contra el
  // propio enum, igual que ya hace `guardarEjercicio` en
  // `lib/acciones-recursos.ts`.
  const nivelValido = nivel && Object.hasOwn(Nivel, nivel) ? nivel : undefined;
  const destrezaValida =
    destreza && Object.hasOwn(Destreza, destreza) ? destreza : undefined;
  const tipoValido = tipo && Object.hasOwn(tipoLabel, tipo) ? tipo : undefined;

  const where: Prisma.EjercicioWhereInput = {
    // Sin filtro de tipo, se excluye WIDGET siempre: Recursos no lo
    // gestiona. `tipoValido` ya descarta un `?tipo=WIDGET` escrito a mano,
    // porque WIDGET no está en `tipoLabel`.
    tipo: tipoValido
      ? (tipoValido as Prisma.EnumTipoEjercicioFilter["equals"])
      : { not: "WIDGET" },
    ...(nivelValido ? { nivel: nivelValido as Prisma.EnumNivelFilter["equals"] } : {}),
    // `destreza` es opcional en la tabla, así que su filtro es el «nullable»:
    // pedir una destreza deja fuera los que no tienen ninguna, que es lo que
    // se espera al elegirla en el desplegable.
    ...(destrezaValida ? { destreza: destrezaValida as Destreza } : {}),
    ...(estado === "publicado" ? { publicado: true } : {}),
    ...(estado === "borrador" ? { publicado: false } : {}),
    ...(q ? { titulo: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const ejercicios = await prisma.ejercicio.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titulo: true,
      tipo: true,
      nivel: true,
      destreza: true,
      publicado: true,
      _count: { select: { pasos: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Encabezado
        titulo="Recursos"
        acciones={<Boton href="/profe/recursos/nuevo">Nuevo ejercicio</Boton>}
      />

      {/* El buscador no tenía ninguna etiqueta visible antes (inputs y
          selects sueltos con solo `placeholder`/orden como pista); `Campo`
          exige una, así que «Buscar», «Nivel», «Destreza», «Tipo» y «Estado»
          son texto nuevo — mismo criterio que ya usó la zona 1 en el
          buscador de `/recorridos`. */}
      <form className="mt-6 flex flex-wrap gap-3">
        <Campo
          etiqueta="Buscar"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por título"
          className="min-w-56 flex-1"
        />
        <Campo
          etiqueta="Nivel"
          name="nivel"
          tipo="elegir"
          defaultValue={nivel ?? ""}
          opciones={[{ valor: "", nombre: "Todos los niveles" }, ...NIVELES]}
        />
        <Campo
          etiqueta="Destreza"
          name="destreza"
          tipo="elegir"
          defaultValue={destreza ?? ""}
          opciones={[
            { valor: "", nombre: "Todas las destrezas" },
            ...Object.entries(destrezaLabel).map(([valor, nombre]) => ({ valor, nombre })),
          ]}
        />
        <Campo
          etiqueta="Tipo"
          name="tipo"
          tipo="elegir"
          defaultValue={tipo ?? ""}
          opciones={[
            { valor: "", nombre: "Todos los tipos" },
            ...Object.entries(tipoLabel).map(([valor, nombre]) => ({ valor, nombre })),
          ]}
        />
        <Campo
          etiqueta="Estado"
          name="estado"
          tipo="elegir"
          defaultValue={estado ?? ""}
          opciones={[
            { valor: "", nombre: "Todos" },
            { valor: "publicado", nombre: "Publicados" },
            { valor: "borrador", nombre: "Borradores" },
          ]}
        />
        <BotonEnviar gerundio="Filtrando…" variante="sutil" className="self-end">
          Filtrar
        </BotonEnviar>
      </form>

      {ejercicios.length === 0 ? (
        <Vacio className="mt-8">No hay ningún ejercicio que encaje.</Vacio>
      ) : (
        <ul className="mt-6 space-y-2">
          {ejercicios.map((e) => (
            <li key={e.id}>
              <Tarjeta href={`/profe/recursos/${e.id}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-tinta">{e.titulo}</p>
                    <p className="truncate text-xs text-tinta-suave">
                      {tipoLabel[e.tipo] ?? e.tipo} · {e.nivel}
                      {e.destreza ? ` · ${e.destreza}` : ""} ·{" "}
                      {e._count.pasos === 0
                        ? "sin usar"
                        : `en ${e._count.pasos} paso${e._count.pasos !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <Etiqueta tono={e.publicado ? "verde" : "neutro"} className="shrink-0">
                    {e.publicado ? "Publicado" : "Borrador"}
                  </Etiqueta>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
