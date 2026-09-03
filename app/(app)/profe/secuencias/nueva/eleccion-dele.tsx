"use client";

import { useState } from "react";
import { pruebasDe } from "@/lib/dele";
import { BLOQUES } from "@/lib/preparacion";
import type { Nivel } from "@/lib/generated/prisma/enums";
import { nombreNivel } from "@/lib/niveles";
import Campo from "@/components/ui/campo";

const NIVELES: Nivel[] = ["A1", "A2", "B1", "B2", "C1", "A2_B1_ESCOLAR"];

const NOMBRE_PRUEBA: Record<string, string> = {
  CE: "Comprensión de lectura",
  CO: "Comprensión auditiva",
};

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
  tipoInicial,
  children,
}: {
  tituloInicial: string;
  /** El servicio con el que arranca el selector; lo decide `?servicio=` en la URL. */
  tipoInicial: string;
  /**
   * Lo que va entre la prueba y la casilla de la plantilla —hoy, la
   * descripción—. Es una ranura para dejarlo en el servidor: la casilla
   * tiene que estar aquí dentro porque depende de la prueba elegida, que es
   * estado de este componente, y así el orden de la pantalla no cambia.
   */
  children?: React.ReactNode;
}) {
  const [tipo, setTipo] = useState(tipoInicial);
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
      <Campo
        etiqueta="Título"
        name="titulo"
        required
        value={titulo}
        onChange={(e) => {
          setTitulo(e.target.value);
          setTituloTocado(true);
        }}
        placeholder="El barrio: describir dónde vivo"
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Campo
          etiqueta="Servicio"
          name="tipo"
          tipo="elegir"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="flex-1"
          opciones={[
            { valor: "CLASES_PARTICULARES", nombre: "Clases particulares" },
            { valor: "PREPARACION_DELE", nombre: "Preparación DELE" },
          ]}
        />

        <Campo
          etiqueta="Nivel"
          name="nivel"
          tipo="elegir"
          required
          value={nivel}
          onChange={(e) => {
            const n = e.target.value as Nivel;
            setNivel(n);
            proponerTitulo(n, destreza);
          }}
          className="flex-1"
          opciones={[
            { valor: "", nombre: "Elige" },
            ...NIVELES.map((n) => ({ valor: n, nombre: nombreNivel(n) })),
          ]}
        />
      </div>

      {tipo === "PREPARACION_DELE" && (
        <Campo
          etiqueta="Prueba"
          name="destreza"
          tipo="elegir"
          value={destreza}
          onChange={(e) => {
            setDestreza(e.target.value);
            proponerTitulo(nivel, e.target.value);
          }}
          className="mt-4"
          ayuda={
            nivel === ""
              ? "Elige antes el nivel."
              : pruebas.length === 0
                ? "Este nivel todavía no tiene pruebas en el mapa."
                : "Elegir una hace que la ficha te proponga sus tareas. Puedes dejarlo sin elegir."
          }
          opciones={[
            { valor: "", nombre: "Ninguna en concreto" },
            ...pruebas.map((p) => ({
              valor: p.prueba,
              nombre: `${NOMBRE_PRUEBA[p.prueba] ?? p.prueba} · ${p.tareas.length} tareas · ${p.duracionMinutos} min`,
            })),
          ]}
        />
      )}

      {tipo === "PREPARACION_DELE" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Bloque de la preparación"
            name="bloque"
            tipo="elegir"
            defaultValue="2"
            ayuda="Dónde aparece en la portada del alumno."
            opciones={BLOQUES.map((b) => ({
              valor: String(b.orden),
              nombre: `${b.orden} · ${b.titulo}`,
            }))}
          />

          <Campo
            etiqueta="Examen"
            name="examen"
            tipo="numero"
            min={1}
            placeholder="1"
            ayuda="El número del examen del Cervantes. Déjalo vacío si esta secuencia no es de un examen concreto."
          />
        </div>
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
