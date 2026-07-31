import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Link from "next/link";
import Editor, { VACIO } from "@/components/recursos/editor";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import { sobrantesDe, tareaDe, type TareaDele } from "@/lib/dele";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";

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

/** El nombre del nivel tal y como se escribe en pantalla. */
function nombreNivel(nivel: string): string {
  return nivel === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : nivel;
}

/**
 * El punto de partida de un ejercicio para esta tarea: tantos ítems y tantas
 * opciones como dice el mapa, y los sobrantes ya separados.
 *
 * Los ids van `p1…pN` y `r1…rN` porque es lo que esperan los editores, que
 * calculan el siguiente por el máximo de los sufijos existentes.
 *
 * Sale con los campos en blanco, así que todavía no pasa el esquema: es un
 * andamio para rellenar, y los avisos del editor van diciendo qué falta.
 */
function estructuraDe(tarea: TareaDele): unknown {
  const sobrantes = sobrantesDe(tarea);

  if (tarea.motor === "relacionar") {
    return {
      ejercicio: "relacionar",
      consigna: "",
      ...(tarea.formato === "GAP_INSERT" ? { texto: "" } : {}),
      parejas: Array.from({ length: tarea.items }, (_, i) => ({
        id: `r${i + 1}`,
        izquierda: tarea.formato === "GAP_INSERT" ? `Hueco ${i + 1}` : "",
        derecha: "",
      })),
      sobrantes: Array.from({ length: sobrantes }, () => ""),
      escuchas: 2,
    };
  }

  // `opcion`, con lista común o sin ella según lo que diga el mapa.
  return {
    ejercicio: "opcion",
    consigna: "",
    multiple: false,
    // El muro lo hace el número de preguntas, no el de opciones: catorce
    // huecos de tres opciones son catorce filas de botones. La regla de
    // antes era `listaComun && opciones > 4`, y no la cumple ninguna tarea
    // del mapa —con lista común el máximo de opciones es 4—, así que el
    // desplegable era inalcanzable justo donde hace falta: B2 · CE · T4 son
    // catorce huecos, y `CLOZE` ni siquiera usa lista común.
    //
    // Ocho es el corte: las tareas normales de seis o siete se leen mejor en
    // botones. No es una decisión cerrada: «Cómo se enseña» está en el
    // editor, fuera del bloque de lista común, y se cambia en un clic.
    presentacion: tarea.items > 8 ? "desplegable" : "botones",
    ...(tarea.listaComun
      ? { opcionesComunes: Array.from({ length: tarea.opciones }, () => "") }
      : {}),
    escuchas: 2,
    preguntas: Array.from({ length: tarea.items }, (_, i) => ({
      id: `p${i + 1}`,
      enunciado: "",
      ...(tarea.listaComun
        ? {}
        : { opciones: Array.from({ length: tarea.opciones }, () => "") }),
      correctas: [],
    })),
  };
}

export default async function NuevoRecursoPage({
  searchParams,
}: {
  /**
   * `?tipo=` abre el editor de ese tipo a secas. `?nivel=&prueba=&tarea=`
   * lo abren por una tarea del mapa, con su formato y su estructura ya
   * montada.
   */
  searchParams: Promise<{
    tipo?: string;
    nivel?: string;
    prueba?: string;
    tarea?: string;
  }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { tipo, nivel: nivelBruto, prueba, tarea: tareaBruta } = await searchParams;
  const elegido = TIPOS.find((t) => t.marca === tipo);

  // Si vienen los tres, el editor arranca por la tarea del mapa en vez de
  // por el tipo a secas. `tareaDe` devuelve null para cualquier trío que no
  // esté en el mapa, así que de aquí no sale un nivel inventado.
  const numero = Number(tareaBruta);
  const tareaDele =
    nivelBruto && prueba && Number.isInteger(numero)
      ? tareaDe(nivelBruto as Nivel, prueba as Destreza, numero)
      : null;

  const motor = tareaDele
    ? TIPOS.find((t) => t.marca === tareaDele.motor)
    : elegido;

  // `tareaDele` ya implica los otros dos, pero repetirlos aquí es lo que
  // convence a TypeScript de que no son `undefined`.
  const partida =
    tareaDele && nivelBruto && prueba
      ? {
          datos: estructuraDe(tareaDele),
          // El nivel no es un detalle: el editor arranca en B1, y un
          // ejercicio creado para una prueba de A1 que se quedara en B1 no
          // volvería a aparecer en el selector de su propio paso, que se
          // acota al nivel del recorrido.
          nivel: nivelBruto,
          // La destreza se sabe —es la prueba— y `Ejercicio` la tiene: no
          // ponerla dejaba el recurso peor catalogado que si se hubiera
          // creado a mano, y la lista de Recursos filtra por ella.
          destreza: prueba,
          // Recursos es una biblioteca global y el desplegable del paso
          // pinta «título · nivel»: dos «Tarea 1 · B1» de pruebas distintas
          // salían indistinguibles. El nivel se escribe como se lee, que
          // nadie quiere encontrarse un «A2_B1_ESCOLAR» en la lista.
          titulo: `${nombreNivel(nivelBruto)} · ${prueba} · Tarea ${tareaDele.numero}`,
        }
      : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/profe/recursos" className="text-sm font-semibold text-tinta-suave hover:text-hp-500">
        ← Recursos
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        {motor ? `Nuevo ejercicio · ${motor.nombre}` : "Nuevo ejercicio"}
      </h1>

      {tareaDele && (
        <div className="mt-4 rounded-tarjeta border border-hp-100 bg-fondo p-4">
          <p className="text-sm font-bold text-tinta">
            Tarea {tareaDele.numero}
            {!tareaDele.verificado && (
              <span className="ml-2 rounded-full bg-sol-100 px-2 py-0.5 text-xs font-bold">
                sin confirmar
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-tinta-suave">{tareaDele.pide}</p>
        </div>
      )}

      {tareaDele && partida ? (
        <div className="mt-8">
          {/*
            El `key` remonta el editor al cambiar de tarea. `partida` solo se
            lee en el estado inicial de `useState`: sin él, navegar del
            cliente entre dos tareas distintas reutilizaría el mismo `Editor`
            con los datos de la anterior, y un `relacionar` dentro de
            `EditorOpcion` revienta en `d.preguntas.map`. Hoy no hay ningún
            enlace que haga esa navegación; el `key` la cierra igualmente.
          */}
          <Editor
            key={tareaDele.numero}
            inicial={null}
            marca={tareaDele.motor}
            bloqueado={null}
            partida={partida}
            // Para el aviso del número de ítems, que compara lo escrito con
            // lo que dice el mapa mientras se edita. Avisa y deja guardar.
            tarea={tareaDele}
          />
        </div>
      ) : elegido ? (
        <div className="mt-8">
          {/* Misma razón que el de arriba: el editor de `?tipo=` ocupa la
              misma posición del árbol, así que también se remonta al
              cambiar de tipo. Las dos claves no se pisan: una es un número
              y la otra una marca. */}
          <Editor key={elegido.marca} inicial={null} marca={elegido.marca} bloqueado={null} />
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
