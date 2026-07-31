"use client";

import { useState } from "react";
import { pruebasDe } from "@/lib/dele";
import type { Nivel } from "@/lib/generated/prisma/enums";

const NIVELES: Nivel[] = ["A1", "A2", "B1", "B2", "C1", "A2_B1_ESCOLAR"];

const nombreNivel = (n: string) => (n === "A2_B1_ESCOLAR" ? "A2/B1 escolar" : n);

const NOMBRE_PRUEBA: Record<string, string> = {
  CE: "Comprensión de lectura",
  CO: "Comprensión auditiva",
};

const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

/**
 * El servicio, el nivel y —si es preparación— la prueba, más el título que
 * se propone a partir de los tres y la casilla de la plantilla.
 *
 * El título se propone y no se impone: en cuanto el profesor lo toca, deja
 * de reescribirse. El mapa aconseja, no manda. La casilla de la plantilla va
 * por el mismo camino: se desmarca sola al elegir una prueba, y se puede
 * volver a marcar.
 */
export default function EleccionDele({
  tituloInicial,
  children,
}: {
  tituloInicial: string;
  /**
   * Lo que va entre la prueba y la casilla de la plantilla —hoy, la
   * descripción—. Es una ranura para dejarlo en el servidor: la casilla
   * tiene que estar aquí dentro porque depende de la prueba elegida, que es
   * estado de este componente, y así el orden de la pantalla no cambia.
   */
  children?: React.ReactNode;
}) {
  const [tipo, setTipo] = useState("CLASES_PARTICULARES");
  const [nivel, setNivel] = useState<Nivel | "">("");
  const [destreza, setDestreza] = useState("");
  const [titulo, setTitulo] = useState(tituloInicial);
  const [tituloTocado, setTituloTocado] = useState(false);
  const [plantillaTocada, setPlantillaTocada] = useState(false);
  const [plantillaAMano, setPlantillaAMano] = useState(true);

  const pruebas = nivel ? pruebasDe(nivel) : [];

  /** Esta secuencia es una prueba de examen concreta. */
  const hayPrueba = tipo === "PREPARACION_DELE" && destreza !== "";

  /**
   * Marcada mientras el profesor no diga otra cosa, salvo que haya prueba
   * elegida.
   *
   * Una prueba tiene la estructura que dice el mapa —cinco tareas—, no la de
   * las clases particulares. Con la casilla marcada, la secuencia nacía con
   * nueve pasos de plantilla que ocupaban los números 1 a 9: el panel de
   * tareas sugeridas los daba todos por puestos y no se pintaba nunca, y
   * «Actividad 1» abría con la ficha de la Tarea 2. La función principal de
   * la pantalla era invisible por el camino por defecto.
   *
   * Se desmarca, no se esconde: la plantilla sigue estando a un clic para
   * quien la quiera con prueba y todo.
   */
  const plantilla = plantillaTocada ? plantillaAMano : !hayPrueba;

  function proponerTitulo(n: string, d: string) {
    if (tituloTocado) return;
    if (n && d) setTitulo(`${nombreNivel(n)} · ${NOMBRE_PRUEBA[d] ?? d}`);
  }

  return (
    <>
      <label className="block text-sm font-semibold text-tinta">
        Título
        <input
          type="text"
          name="titulo"
          required
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setTituloTocado(true);
          }}
          placeholder="El barrio: describir dónde vivo"
          className={campo}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex-1 text-sm font-semibold text-tinta">
          Servicio
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={campo}
          >
            <option value="CLASES_PARTICULARES">Clases particulares</option>
            <option value="PREPARACION_DELE">Preparación DELE</option>
          </select>
        </label>

        <label className="flex-1 text-sm font-semibold text-tinta">
          Nivel
          <select
            name="nivel"
            required
            value={nivel}
            onChange={(e) => {
              const n = e.target.value as Nivel;
              setNivel(n);
              proponerTitulo(n, destreza);
            }}
            className={campo}
          >
            <option value="" disabled>
              Elige
            </option>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {nombreNivel(n)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tipo === "PREPARACION_DELE" && (
        <label className="mt-4 block text-sm font-semibold text-tinta">
          Prueba
          <select
            name="destreza"
            value={destreza}
            onChange={(e) => {
              setDestreza(e.target.value);
              proponerTitulo(nivel, e.target.value);
            }}
            className={campo}
          >
            <option value="">Ninguna en concreto</option>
            {pruebas.map((p) => (
              <option key={p.prueba} value={p.prueba}>
                {NOMBRE_PRUEBA[p.prueba] ?? p.prueba} · {p.tareas.length} tareas ·{" "}
                {p.duracionMinutos} min
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-tinta-suave">
            {nivel === ""
              ? "Elige antes el nivel."
              : pruebas.length === 0
                ? "Este nivel todavía no tiene pruebas en el mapa."
                : "Elegir una hace que la ficha te proponga sus tareas. Puedes dejarlo sin elegir."}
          </span>
        </label>
      )}

      {children}

      <label className="mt-5 flex items-start gap-2 text-sm text-tinta">
        <input
          type="checkbox"
          name="plantilla"
          checked={plantilla}
          onChange={(e) => {
            setPlantillaTocada(true);
            setPlantillaAMano(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 accent-hp-400"
        />
        <span>
          <span className="font-semibold">Crear con la estructura recomendada</span>
          <br />
          <span className="text-tinta-suave">
            9 pasos en 2 ciclos: activación, actividades, andamiaje y micro
            tarea; luego actividades, andamiaje y macro tarea. Los títulos son
            provisionales y se cambian al entrar en cada paso.
          </span>
          {hayPrueba && (
            <>
              <br />
              <span className="text-tinta-suave">
                Para una prueba de examen viene desmarcada: la ficha te
                propondrá sus tareas una a una, con su formato. Márcala si
                además quieres los nueve pasos.
              </span>
            </>
          )}
        </span>
      </label>
    </>
  );
}
