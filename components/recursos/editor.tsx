"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  borrarEjercicio,
  despublicarEjercicio,
  duplicarEjercicio,
  guardarEjercicio,
  publicarEjercicio,
  type EstadoRecurso,
} from "@/lib/acciones-recursos";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import Previsualizacion from "./previsualizacion";
import EditorOpcion, { OPCION_VACIA } from "./editor-opcion";
import EditorHuecos, { HUECOS_VACIO } from "./editor-huecos";
import EditorRelacionar, { RELACIONAR_VACIO } from "./editor-relacionar";
import EditorOrdenar, { ORDENAR_VACIO } from "./editor-ordenar";
import { campo } from "./campos";

const NIVELES = ["A1", "A2", "B1", "B2", "C1", "A2_B1_ESCOLAR"] as const;
const DESTREZAS: Record<string, string> = {
  CE: "Comprensión escrita",
  CO: "Comprensión oral",
  EE: "Expresión escrita",
  EO: "Expresión oral",
  EEI: "Interacción escrita",
  EOI: "Interacción oral",
};

/**
 * El punto de partida de cada tipo. Parcial a propósito: un tipo entra aquí
 * cuando tiene editor, y `nuevo/page.tsx` solo ofrece los que están. Ya
 * están los cuatro, así que `Partial` no tapa nada ahora mismo: se deja
 * porque un tipo futuro volverá a entrar por aquí antes de tener editor.
 */
export const VACIO: Partial<Record<MarcaEjercicio, unknown>> = {
  opcion: OPCION_VACIA,
  huecos: HUECOS_VACIO,
  relacionar: RELACIONAR_VACIO,
  ordenar: ORDENAR_VACIO,
};

/**
 * Los mismos datos, siempre la misma cadena: las claves de cada objeto van
 * ordenadas y las que valen `undefined` se caen, igual que hace
 * `JSON.stringify` al mandarlas. Hace falta para comparar lo que hay en el
 * formulario con lo que devolvió el servidor: la columna `datos` es `jsonb`,
 * y `jsonb` reordena las claves por su cuenta, así que un `JSON.stringify` a
 * secas diría «hay cambios sin guardar» en cuanto la fila vuelve de la base
 * aunque nadie haya tocado nada. El orden de los arrays sí se respeta, que
 * ahí sí significa algo.
 */
function canonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const entradas = Object.entries(v as Record<string, unknown>)
    .filter(([, valor]) => valor !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entradas.map(([k, valor]) => `${JSON.stringify(k)}:${canonico(valor)}`).join(",")}}`;
}

/** Cuál de las cuatro acciones fue la última en dispararse. */
type Accion = "guardar" | "publicar" | "duplicar" | "borrar";

export type FilaEjercicio = {
  id: string;
  titulo: string;
  nivel: string;
  destreza: string | null;
  etiquetas: string[];
  datos: unknown;
  publicado: boolean;
};

export default function Editor({
  inicial,
  marca,
  bloqueado,
}: {
  inicial: FilaEjercicio | null;
  marca: MarcaEjercicio;
  /** El motivo por el que no se puede editar, si lo hay. */
  bloqueado: string | null;
}) {
  const router = useRouter();

  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [nivel, setNivel] = useState(inicial?.nivel ?? "B1");
  const [destreza, setDestreza] = useState(inicial?.destreza ?? "");
  const [etiquetas, setEtiquetas] = useState((inicial?.etiquetas ?? []).join(", "));
  const [datos, setDatos] = useState<unknown>(inicial?.datos ?? VACIO[marca]);

  const [estado, guardar, guardando] = useActionState<EstadoRecurso, FormData>(
    guardarEjercicio,
    {},
  );
  const [estadoPublicar, publicar, publicando] = useActionState<EstadoRecurso, FormData>(
    inicial?.publicado ? despublicarEjercicio : publicarEjercicio,
    {},
  );
  const [estadoDuplicar, duplicarAccion, duplicando] = useActionState<EstadoRecurso, FormData>(
    duplicarEjercicio,
    {},
  );
  const [estadoBorrar, borrar, borrando] = useActionState<EstadoRecurso, FormData>(
    borrarEjercicio,
    {},
  );

  /**
   * Si lo que hay en el formulario ya no es lo que hay en la base.
   *
   * «Publicar» y «Duplicar» trabajan sobre la fila guardada: releen `datos`
   * de la base y no miran el `<input hidden name="datos">` del envío. Con
   * cambios sin guardar eso decía «Publicado.» mientras la pantalla seguía
   * enseñando una corrección que no había llegado a ninguna parte. Con esto
   * se apagan hasta que se guarde, que es lo que hay que hacer de todos
   * modos, en vez de esconder una escritura dentro de otra acción.
   */
  const sinGuardar =
    canonico({
      titulo: titulo.trim(),
      nivel,
      destreza,
      etiquetas: etiquetas.split(",").map((s) => s.trim()).filter(Boolean),
      datos,
    }) !==
    canonico({
      titulo: inicial?.titulo ?? "",
      nivel: inicial?.nivel ?? "",
      destreza: inicial?.destreza ?? "",
      etiquetas: inicial?.etiquetas ?? [],
      datos: inicial?.datos ?? null,
    });

  /**
   * Guardar uno nuevo devuelve el id de la fila recién creada y duplicar el
   * de la copia; en los dos casos hay que irse a su página, o el siguiente
   * «Guardar» crearía otra fila más. Borrar devuelve a la lista.
   *
   * Va en un efecto y no suelto en el cuerpo: navegar durante el render es
   * un efecto secundario, y React lo castiga con avisos y con navegaciones
   * repetidas en cada repintado.
   */
  const idNuevo = !inicial && estado.id ? estado.id : null;
  useEffect(() => {
    if (idNuevo) router.replace(`/profe/recursos/${idNuevo}`);
  }, [idNuevo, router]);
  useEffect(() => {
    if (estadoDuplicar.id) router.replace(`/profe/recursos/${estadoDuplicar.id}`);
  }, [estadoDuplicar.id, router]);
  useEffect(() => {
    if (estadoBorrar.ok) router.replace("/profe/recursos");
  }, [estadoBorrar.ok, router]);

  /**
   * Un solo mensaje para las cuatro acciones, no cuatro bloques copiados:
   * al segundo guardado de un ejercicio ya existente no hay ningún sitio a
   * donde navegar, así que sin esto el "Guardado." no se veía nunca, y
   * duplicar fallaba en silencio porque a su bloque de error le tocó
   * quedarse fuera cuando había cuatro copiados a mano.
   *
   * Se enseña el resultado de la última acción que se pulsó y solo ese. Los
   * cuatro `useActionState` son independientes y ninguno limpia al otro: al
   * encadenarlos por prioridad fija, un error de «Guardar» ya arreglado
   * seguía en pantalla —y anulaba el «Publicado.»— después de que
   * «Publicar» hubiera ido bien. Cuál se pulsó se apunta en el `onClick` de
   * cada botón, que corre antes de que el formulario se envíe.
   */
  const [ultima, setUltima] = useState<Accion>("guardar");
  const resultado: Record<Accion, EstadoRecurso> = {
    guardar: estado,
    publicar: estadoPublicar,
    duplicar: estadoDuplicar,
    borrar: estadoBorrar,
  };
  const enMarcha: Record<Accion, boolean> = {
    guardar: guardando,
    publicar: publicando,
    duplicar: duplicando,
    borrar: borrando,
  };
  // Mientras la acción está en vuelo no se enseña su resultado anterior: ese
  // ya es de un intento que el profesor acaba de reemplazar.
  const mensajeError = enMarcha[ultima] ? null : (resultado[ultima].error ?? null);
  const mensajeOk =
    enMarcha[ultima] || mensajeError ? null : (resultado[ultima].ok ?? null);

  /**
   * La línea de al lado de los botones. Dice también por qué «Publicar» está
   * apagado: un botón deshabilitado sin explicación es otra forma de no
   * contar lo que pasa.
   */
  const lineaDeEstado = !inicial
    ? "Borrador"
    : !sinGuardar
      ? inicial.publicado
        ? "Publicado"
        : "Borrador"
      : inicial.publicado
        ? "Publicado, con cambios sin guardar."
        : "Sin guardar: guarda antes de publicar.";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form action={guardar} className="space-y-6">
        <input type="hidden" name="id" value={inicial?.id ?? ""} />
        <input type="hidden" name="datos" value={JSON.stringify(datos)} />
        <input type="hidden" name="titulo" value={titulo} />
        <input type="hidden" name="nivel" value={nivel} />
        <input type="hidden" name="destreza" value={destreza} />
        <input type="hidden" name="etiquetas" value={etiquetas} />

        {bloqueado && (
          <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">
            {bloqueado}{" "}
            {/*
              Duplicar copia la fila guardada, no lo que hay en pantalla, así
              que le pasaría lo mismo que a «Publicar» con cambios sin
              guardar. No se apaga por eso, y a propósito: este botón solo
              existe dentro del aviso de bloqueo, donde todos los campos
              están deshabilitados y no puede haber ningún cambio que
              perder. Apagarlo ahí solo serviría para dejar sin salida al
              único camino que tiene un ejercicio ya respondido.
            */}
            {/*
              Sin `name`/`value`: el `id` ya viaja en el campo oculto de
              arriba, y React necesita el `name` del botón para codificar
              qué acción se invoca. Ponerlo lo sobrescribe y avisa por
              consola.
            */}
            <button
              formAction={duplicarAccion}
              onClick={() => setUltima("duplicar")}
              className="font-bold underline"
            >
              Duplicar y editar la copia
            </button>
          </p>
        )}

        <div className="flex flex-wrap gap-4">
          <label className="block flex-1 text-sm font-semibold text-tinta">
            Título
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={campo}
              disabled={Boolean(bloqueado)}
            />
          </label>

          <label className="block w-44 text-sm font-semibold text-tinta">
            Nivel
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className={campo}
              disabled={Boolean(bloqueado)}
            >
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : n}
                </option>
              ))}
            </select>
          </label>

          <label className="block w-56 text-sm font-semibold text-tinta">
            Destreza
            <select
              value={destreza}
              onChange={(e) => setDestreza(e.target.value)}
              className={campo}
              disabled={Boolean(bloqueado)}
            >
              <option value="">Ninguna</option>
              {Object.entries(DESTREZAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold text-tinta">
          Etiquetas, separadas por comas
          <input
            type="text"
            value={etiquetas}
            onChange={(e) => setEtiquetas(e.target.value)}
            placeholder="la casa, ser y estar"
            className={campo}
            disabled={Boolean(bloqueado)}
          />
        </label>

        <fieldset disabled={Boolean(bloqueado)}>
          {marca === "opcion" && <EditorOpcion datos={datos} alCambiar={setDatos} />}
          {marca === "huecos" && <EditorHuecos datos={datos} alCambiar={setDatos} />}
          {marca === "relacionar" && <EditorRelacionar datos={datos} alCambiar={setDatos} />}
          {marca === "ordenar" && <EditorOrdenar datos={datos} alCambiar={setDatos} />}
          {/*
            No es una lista de negaciones (una por marca) porque eso se
            desincroniza en cuanto se añade un tipo nuevo: se comprueba
            contra `VACIO`, la misma fuente que ya usa `nuevo/page.tsx` para
            decidir qué tipos ofrecer. Con los cuatro tipos actuales nunca
            se pinta; queda listo para cuando `MarcaEjercicio` crezca antes
            de que su editor exista.
          */}
          {VACIO[marca] === undefined && (
            <p className="rounded-tarjeta border border-dashed border-hp-200 p-6 text-center text-sm text-tinta-suave">
              Este tipo de ejercicio todavía no tiene editor. Puedes cambiar
              el título, el nivel, la destreza y las etiquetas, pero no su
              contenido.
            </p>
          )}
        </fieldset>

        {mensajeError && (
          <p className="rounded-tarjeta bg-sol-100 px-4 py-3 text-sm text-tinta">{mensajeError}</p>
        )}
        {mensajeOk && (
          <p className="rounded-tarjeta bg-hp-100 px-4 py-3 text-sm text-tinta">{mensajeOk}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            onClick={() => setUltima("guardar")}
            disabled={guardando || Boolean(bloqueado)}
            className="h-11 rounded-full bg-hp-400 px-6 text-sm font-extrabold text-white transition-colors hover:bg-hp-500 disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>

          {inicial && (
            <button
              formAction={publicar}
              onClick={() => setUltima("publicar")}
              // Volver a borrador no mira `datos`, así que unos cambios sin
              // guardar no le hacen prometer nada falso: solo se apaga en el
              // sentido de publicar.
              disabled={!inicial.publicado && sinGuardar}
              className="h-11 rounded-full border border-hp-200 px-6 text-sm font-bold text-tinta hover:border-hp-400 disabled:opacity-40 disabled:hover:border-hp-200"
            >
              {inicial.publicado ? "Volver a borrador" : "Publicar"}
            </button>
          )}

          <span className="flex-1 text-sm text-tinta-suave">{lineaDeEstado}</span>

          {/*
            Borrar solo tiene sentido para limpiar los borradores que uno
            deja por el camino. Si cuelga de algún paso, `puedeBorrarse` lo
            niega y el motivo sale arriba.
          */}
          {inicial && (
            <button
              formAction={borrar}
              onClick={() => setUltima("borrar")}
              className="text-sm font-semibold text-tinta-suave underline hover:text-hp-500"
            >
              Borrar
            </button>
          )}
        </div>
      </form>

      <Previsualizacion datos={datos} />
    </div>
  );
}
