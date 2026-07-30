import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Link from "next/link";
import Editor, { VACIO } from "@/components/recursos/editor";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";

/**
 * Los tipos que se ofrecen. Se filtra por `VACIO`, que es quien sabe cuáles
 * tienen editor: así esta lista puede estar completa desde el principio sin
 * ofrecer una puerta que no lleva a ninguna parte.
 */
const TODOS_LOS_TIPOS: { marca: MarcaEjercicio; nombre: string; explica: string }[] = [
  { marca: "opcion", nombre: "Opción", explica: "Preguntas con opciones. Una correcta, o varias." },
  { marca: "huecos", nombre: "Huecos", explica: "Un texto con palabras que faltan y hay que escribir." },
  { marca: "relacionar", nombre: "Relacionar", explica: "Dos columnas que se emparejan arrastrando." },
  { marca: "ordenar", nombre: "Ordenar", explica: "Piezas desordenadas que hay que poner en su sitio." },
];

// Aparte de `TODOS_LOS_TIPOS` para que la anotación de tipo se aplique al
// literal del array: encadenado con `.filter` en la misma expresión, TS
// infería `marca` como `string` y no como `MarcaEjercicio`.
const TIPOS = TODOS_LOS_TIPOS.filter((t) => VACIO[t.marca] !== undefined);

export default async function NuevoRecursoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { tipo } = await searchParams;
  const elegido = TIPOS.find((t) => t.marca === tipo);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/profe/recursos" className="text-sm font-semibold text-tinta-suave hover:text-hp-500">
        ← Recursos
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        {elegido ? `Nuevo ejercicio · ${elegido.nombre}` : "Nuevo ejercicio"}
      </h1>

      {elegido ? (
        <div className="mt-8">
          <Editor inicial={null} marca={elegido.marca} bloqueado={null} />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {TIPOS.map((t) => (
            <li key={t.marca}>
              <Link
                href={`/profe/recursos/nuevo?tipo=${t.marca}`}
                className="block rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave transition hover:border-hp-300"
              >
                <p className="font-bold text-tinta">{t.nombre}</p>
                <p className="mt-1 text-sm text-tinta-suave">{t.explica}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
