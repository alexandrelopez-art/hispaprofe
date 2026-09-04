import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Editor, { type MarcaRecurso } from "@/components/recursos/editor";
import { tareaDe } from "@/lib/dele";
import { estructuraDe } from "@/lib/dele/estructura";
import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import { nombreNivel } from "@/lib/niveles";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";

/**
 * Los tipos que se ofrecen, escritos a mano.
 *
 * Antes se filtraban contra `VACIO` para no ofrecer una puerta sin editor
 * detrás, y eso dejaba la página en blanco: `VACIO` vive en `editor.tsx`,
 * que es un componente de cliente, y esta página es de servidor. Al otro
 * lado de esa frontera un import de valor no trae el objeto, trae una
 * referencia al módulo del cliente: `Object.keys` devuelve `[]` y cualquier
 * propiedad sale `undefined`, así que el filtro descartaba los cinco tipos
 * sin que nada fallara ni se quejara. La puerta sin editor la sigue tapando
 * el propio `Editor`, que comprueba `VACIO` ahí donde sí es de verdad.
 */
const TIPOS: { marca: MarcaRecurso; nombre: string; explica: string }[] = [
  { marca: "opcion", nombre: "Opción", explica: "Preguntas con opciones. Una correcta, o varias." },
  { marca: "huecos", nombre: "Huecos", explica: "Un texto con palabras que faltan y hay que escribir." },
  { marca: "relacionar", nombre: "Relacionar", explica: "Dos columnas que se emparejan arrastrando." },
  { marca: "ordenar", nombre: "Ordenar", explica: "Piezas desordenadas que hay que poner en su sitio." },
  { marca: "expresion", nombre: "Expresión", explica: "Una redacción o una tarea oral, que corriges tú con una rúbrica." },
];

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
      <Encabezado
        titulo={motor ? `Nuevo ejercicio · ${motor.nombre}` : "Nuevo ejercicio"}
        volver={{ href: "/profe/recursos", texto: "Recursos" }}
      />

      {tareaDele && (
        <div className="mt-4 rounded-tarjeta border border-hp-100 bg-fondo p-4">
          <p className="text-sm font-bold text-tinta">
            Tarea {tareaDele.numero}
            {!tareaDele.verificado && (
              <Etiqueta tono="sol" className="ml-2">
                sin confirmar
              </Etiqueta>
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
              <Tarjeta href={`/profe/recursos/nuevo?tipo=${t.marca}`}>
                <p className="font-bold text-tinta">{t.nombre}</p>
                <p className="mt-1 text-sm text-tinta-suave">{t.explica}</p>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
