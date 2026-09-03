"use client";

import { useActionState, useState } from "react";
import {
  comprobarPegado,
  pegarEjercicio,
  type EstadoPegado,
} from "@/lib/acciones-recursos";
import type { Encargo } from "@/lib/pegado/encargo";
import Previsualizacion from "@/components/recursos/previsualizacion";
import Aviso from "@/components/ui/aviso";
import Boton, { clasesDeBoton } from "@/components/ui/boton";
import Campo from "@/components/ui/campo";
import Tarjeta from "@/components/ui/tarjeta";

/**
 * Cuál de las dos acciones fue la última en dispararse.
 *
 * Mismo mecanismo que ya usa `components/recursos/editor.tsx`, y por el
 * mismo fallo ya sufrido allí: un `guardado.error ?? comprobado.error` no
 * distingue cuál de los dos intentos es el vigente, así que un «Guardar»
 * que falló seguía mandando encima de un «Comprobar» posterior que ya
 * decía lo contrario. Se apunta en el `onClick` de cada botón, que corre
 * antes de que el formulario se envíe.
 */
type Accion = "comprobar" | "guardar";

/**
 * La tercera puerta para poner el ejercicio de un paso: pegarlo ya escrito.
 *
 * Dos mitades y en este orden: primero el encargo que se le da a una IA, y
 * luego el cuadro donde se pega lo que devuelva. El orden importa porque es
 * el del viaje: sin el encargo, lo que se pegue no tiene por qué encajar.
 */
export default function PegarCodigo({
  pasoId,
  titulo,
  encargos,
}: {
  pasoId: string;
  titulo: string;
  encargos: Encargo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cual, setCual] = useState(0);
  const [copiado, setCopiado] = useState(false);

  /**
   * Lo pegado vive en el estado, no en el DOM.
   *
   * No es una preferencia de estilo: React resetea el formulario en **toda**
   * acción de función. `requestFormReset` se encola dentro del scope de la
   * transición, antes de llamar a la acción, y acaba en un
   * `HTMLFormElement.reset()` durante el commit. Un `<textarea>` sin valor
   * propio vuelve entonces a su `defaultValue`, que sin `value` es la cadena
   * vacía: el cuadro se quedaba en blanco justo en el momento en que hay que
   * corregir lo que se pegó, que es el bucle en el que vive esta pantalla.
   *
   * Con `value`, React mantiene el `defaultValue` del nodo igual al valor
   * controlado, así que ese mismo `reset()` devuelve el texto en vez de
   * borrarlo. Es el patrón que `components/recursos/editor.tsx` usa en todos
   * sus campos, y por eso los `<input type="hidden">` de aquí nunca se
   * vaciaron.
   */
  const [pegado, setPegado] = useState("");

  const [comprobado, comprobar, comprobando] = useActionState<EstadoPegado, FormData>(
    comprobarPegado,
    {},
  );
  const [guardado, guardar, guardando] = useActionState<EstadoPegado, FormData>(
    pegarEjercicio,
    {},
  );

  const [ultima, setUltima] = useState<Accion>("comprobar");
  const resultado: Record<Accion, EstadoPegado> = { comprobar: comprobado, guardar: guardado };
  const enMarcha: Record<Accion, boolean> = { comprobar: comprobando, guardar: guardando };

  // `error` y `ok` sí necesitan la exclusión de `ultima`/`enMarcha`: son los
  // que un `??` sin más se pisaba (mismo fallo, mismo arreglo que en
  // editor.tsx). Mientras la acción vigente está en vuelo no se enseña su
  // resultado anterior, que ya es de un intento reemplazado.
  const vigente = enMarcha[ultima] ? undefined : resultado[ultima];
  const error = vigente?.error;
  const ok = vigente?.ok;

  // `entendido` no entra en ese mismo mecanismo, y a propósito: no es una
  // carrera entre dos intentos, es un pestillo que solo se cierra una vez.
  // Guardar con éxito no tiene marcha atrás (`guardado.ok` ya no se
  // desharía), pero un guardado que **falla** —el paso ya ocupado por otra
  // pestaña— no invalida la comprobación anterior: `comprobado.entendido`
  // sigue siendo la lectura correcta de lo pegado, y el profesor tiene que
  // poder reintentar «Guardar» con el mismo clic, sin pasar otra vez por
  // «Comprobar». Si lo que cambia es la propia comprobación, `ultima` vuelve
  // a `"comprobar"` de todos modos y esto se refresca igual. Leerlo por
  // `vigente` aquí retiraba la previsualización —y su botón de guardar—
  // en cualquier fallo de guardado, que es justo el escenario en el que
  // hace falta reintentar rápido.
  const entendido = guardado.ok ? undefined : comprobado.entendido;

  const encargo = encargos[cual] ?? encargos[0];

  function descargar() {
    // Un Blob y un enlace de usar y tirar: no hace falta ninguna ruta nueva,
    // porque el encargo ya viaja entero en las props.
    const url = URL.createObjectURL(new Blob([encargo.texto], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `encargo-${titulo.replace(/[^\wáéíóúñü]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiar() {
    await navigator.clipboard.writeText(encargo.texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!abierto) {
    return (
      <Boton variante="sutil" tamano="pequeno" onClick={() => setAbierto(true)} className="mt-4">
        Pegar por código
      </Boton>
    );
  }

  return (
    <Tarjeta className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-extrabold text-tinta">Pegar por código</h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
        >
          Cerrar
        </button>
      </div>

      {/* ① El encargo */}
      <p className="mt-4 text-sm font-bold text-tinta">1. El encargo para la IA</p>
      {encargos.length > 1 && (
        <Campo
          etiqueta="Este paso no es una tarea del examen, así que elige el tipo:"
          name="cual"
          tipo="elegir"
          value={cual}
          onChange={(e) => setCual(Number(e.target.value))}
          opciones={encargos.map((e, i) => ({ valor: String(i), nombre: e.etiqueta }))}
          className="mt-2"
        />
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Boton tamano="pequeno" onClick={descargar}>
          Descargar encargo.md
        </Boton>
        <Boton variante="sutil" tamano="pequeno" onClick={copiar}>
          {copiado ? "Copiado" : "Copiar"}
        </Boton>
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        Dáselo a la IA junto al PDF del examen. El audio no va aquí: va en un
        bloque aparte.
      </p>

      {/* ② El cuadro */}
      <form action={comprobar} className="mt-6">
        <input type="hidden" name="pasoId" value={pasoId} />
        {/*
          Sigue controlado (`value` + `onChange`): `Campo` reenvía las dos
          props tal cual al <textarea> de siempre, que es lo único que hace
          falta para que el `reset()` de la transición de la acción —ver el
          comentario de `pegado` más arriba— devuelva el texto en vez de
          vaciarlo.
        */}
        <Campo
          etiqueta="2. Lo que te devuelva, pégalo aquí"
          name="pegado"
          tipo="area"
          value={pegado}
          onChange={(e) => setPegado(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder='{ "bloque": "…", "ejercicio": { … } }'
          className="font-mono"
        />
        {/* Se queda con su <button> nativo, no BotonEnviar: el `onClick` que
            marca `ultima` tiene que correr antes de que el formulario se
            envíe, y BotonEnviar no acepta onClick. */}
        <button
          type="submit"
          onClick={() => setUltima("comprobar")}
          disabled={comprobando}
          className={`mt-2 ${clasesDeBoton("sutil", "pequeno")}`}
        >
          {comprobando ? "Comprobando…" : "Comprobar"}
        </button>
      </form>

      {error && <Aviso tono="error" className="mt-3">{error}</Aviso>}

      {ok && <Aviso tono="ok" className="mt-3">{ok}</Aviso>}

      {entendido && (
        <div className="mt-4 border-t border-hp-100 pt-4">
          <p className="text-sm font-bold text-tinta">{entendido.resumen}</p>
          {entendido.aviso && (
            <Aviso tono="aviso" className="mt-2">
              {entendido.aviso}
            </Aviso>
          )}
          {entendido.bloque && (
            <p className="mt-2 text-xs text-tinta-suave">
              Trae también un texto de {entendido.bloque.length} caracteres, que
              se guardará como bloque encima del ejercicio.
            </p>
          )}

          <Previsualizacion datos={entendido.datos} />

          {/*
            El texto se manda otra vez en un campo oculto en vez de fiarse de lo
            que haya en el textarea al pulsar: si se toca después de comprobar,
            lo que se guardaría no sería lo que se ha previsualizado.
          */}
          <form action={guardar} className="mt-4">
            <input type="hidden" name="pasoId" value={pasoId} />
            <input
              type="hidden"
              name="pegado"
              value={JSON.stringify({
                bloque: entendido.bloque ?? undefined,
                ejercicio: entendido.datos,
              })}
            />
            {/* Mismo motivo que «Comprobar»: el onClick que marca `ultima`
                tiene que correr antes del envío, y BotonEnviar no lo admite. */}
            <button
              type="submit"
              onClick={() => setUltima("guardar")}
              disabled={guardando}
              className={clasesDeBoton("primario", "normal")}
            >
              {guardando ? "Guardando…" : "Guardar en este paso"}
            </button>
          </form>
        </div>
      )}
    </Tarjeta>
  );
}
