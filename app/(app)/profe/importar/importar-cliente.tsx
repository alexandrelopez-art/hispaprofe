"use client";

import { useMemo, useState } from "react";
import { importarPuntos } from "@/lib/acciones";

type Estudiante = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

type Secuencia = {
  id: string;
  titulo: string;
  pasos: { id: string; orden: number; titulo: string }[];
};

type Fila = {
  usuario: string;
  puntos: number;
  total: number | null;
  estudianteId: string; // "" = sin emparejar
};

const campo =
  "h-10 rounded-full border border-hp-200 bg-white px-4 text-sm text-tinta outline-none focus:border-hp-400";

/** Parser CSV mínimo con soporte de comillas, suficiente para Genially. */
function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
      celda = "";
    } else {
      celda += c;
    }
  }
  fila.push(celda);
  if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  return filas;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Empareja un nombre libre de Genially con un estudiante, o "" si hay dudas. */
function sugerirEstudiante(usuario: string, estudiantes: Estudiante[]): string {
  const tokens = normalizar(usuario).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  const puntuados = estudiantes.map((e) => {
    const nombre = normalizar(
      `${e.firstName ?? ""} ${e.lastName ?? ""} ${e.email.split("@")[0]}`,
    );
    const aciertos = tokens.filter((t) => nombre.includes(t)).length;
    return { id: e.id, aciertos };
  });

  const maximo = Math.max(...puntuados.map((p) => p.aciertos));
  if (maximo === 0) return "";
  const mejores = puntuados.filter((p) => p.aciertos === maximo);
  // Solo se propone si hay un ganador claro; ante empate, decide el profe.
  return mejores.length === 1 ? mejores[0].id : "";
}

/** Extrae filas Usuario/Aciertos de un CSV de Genially (ranking o individual). */
function extraerFilas(csv: string): { usuario: string; puntos: number; total: number | null }[] {
  const filas = parsearCsv(csv);
  const iCabecera = filas.findIndex((f) =>
    f.some((c) => normalizar(c) === "usuario"),
  );
  if (iCabecera === -1) return [];

  const cabecera = filas[iCabecera].map(normalizar);
  const iUsuario = cabecera.indexOf("usuario");
  const iAciertos = cabecera.findIndex((c) => c === "aciertos");

  return filas
    .slice(iCabecera + 1)
    .map((f) => {
      const usuario = (f[iUsuario] ?? "").trim();
      const bruto = (iAciertos >= 0 ? f[iAciertos] : "") ?? "";
      const partes = bruto.split("/");
      const puntos = Number(partes[0]) || 0;
      const total = partes[1] ? Number(partes[1]) || null : null;
      return { usuario, puntos, total };
    })
    .filter((f) => f.usuario !== "");
}

function nombreDe(e: Estudiante) {
  return [e.firstName, e.lastName].filter(Boolean).join(" ") || e.email;
}

export default function ImportarCliente({
  estudiantes,
  secuencias,
}: {
  estudiantes: Estudiante[];
  secuencias: Secuencia[];
}) {
  const [secuenciaId, setSecuenciaId] = useState("");
  const [pasoId, setPasoId] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  const secuencia = useMemo(
    () => secuencias.find((s) => s.id === secuenciaId),
    [secuenciaId, secuencias],
  );

  async function leerArchivo(archivo: File) {
    setError("");
    setHecho(false);
    try {
      let csv = "";
      if (archivo.name.toLowerCase().endsWith(".zip")) {
        // El ZIP de Genially trae *_ranking.csv y *_individual.csv.
        // Preferimos el ranking, que es compacto y trae los aciertos.
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(archivo);
        const nombres = Object.keys(zip.files);
        const elegido =
          nombres.find((n) => n.toLowerCase().includes("ranking")) ??
          nombres.find((n) => n.toLowerCase().endsWith(".csv"));
        if (!elegido) throw new Error("El ZIP no contiene ningún CSV.");
        csv = await zip.files[elegido].async("string");
      } else {
        csv = await archivo.text();
      }

      const extraidas = extraerFilas(csv);
      if (extraidas.length === 0) {
        throw new Error(
          "No encontré la columna Usuario. ¿Es un informe de Genially?",
        );
      }

      setFilas(
        extraidas.map((f) => ({
          ...f,
          estudianteId: sugerirEstudiante(f.usuario, estudiantes),
        })),
      );
    } catch (e) {
      setFilas([]);
      setError(e instanceof Error ? e.message : "No pude leer el archivo.");
    }
  }

  async function confirmar() {
    const listas = filas.filter((f) => f.estudianteId);
    if (!secuenciaId || !pasoId || listas.length === 0) return;
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.set("recorridoId", secuenciaId);
      formData.set("pasoId", pasoId);
      for (const f of listas) {
        formData.append("estudianteIds", f.estudianteId);
        formData.append("puntos", String(f.puntos));
      }
      await importarPuntos(formData);
      setHecho(true);
      setFilas([]);
    } finally {
      setEnviando(false);
    }
  }

  const emparejadas = filas.filter((f) => f.estudianteId).length;

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        <h2 className="text-lg font-bold text-tinta">
          1 · ¿A qué paso corresponde?
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={secuenciaId}
            onChange={(e) => {
              setSecuenciaId(e.target.value);
              setPasoId("");
            }}
            className={`${campo} min-w-64 flex-1`}
          >
            <option value="">Elige la secuencia</option>
            {secuencias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titulo}
              </option>
            ))}
          </select>

          <select
            value={pasoId}
            onChange={(e) => setPasoId(e.target.value)}
            disabled={!secuencia}
            className={`${campo} min-w-64 flex-1 disabled:opacity-50`}
          >
            <option value="">Elige el paso</option>
            {secuencia?.pasos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.orden}. {p.titulo}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        <h2 className="text-lg font-bold text-tinta">2 · Sube el informe</h2>
        <input
          type="file"
          accept=".zip,.csv"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) void leerArchivo(archivo);
          }}
          className="mt-3 block text-sm text-tinta-suave file:mr-3 file:rounded-full file:border-0 file:bg-hp-400 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-hp-500"
        />
        {error && (
          <p className="mt-3 rounded-xl bg-bloque3/20 px-4 py-2 text-sm text-tinta">
            {error}
          </p>
        )}
        {hecho && (
          <p className="mt-3 rounded-xl bg-bloque2/25 px-4 py-2 text-sm font-semibold text-tinta">
            Puntos importados. Los ves en la ficha de cada estudiante.
          </p>
        )}
      </section>

      {filas.length > 0 && (
        <section className="rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
          <h2 className="text-lg font-bold text-tinta">
            3 · Revisa y confirma
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            {emparejadas} de {filas.length} emparejadas. Las que queden «Sin
            emparejar» no se importan.
          </p>

          <ul className="mt-4 space-y-2">
            {filas.map((fila, i) => (
              <li
                key={i}
                className={`flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 ${
                  fila.estudianteId ? "bg-fondo" : "bg-sol-100"
                }`}
              >
                <span className="min-w-28 font-semibold text-tinta">
                  {fila.usuario}
                </span>
                <span className="text-xs text-tinta-suave">→</span>
                <select
                  value={fila.estudianteId}
                  onChange={(e) =>
                    setFilas((prev) =>
                      prev.map((f, j) =>
                        j === i ? { ...f, estudianteId: e.target.value } : f,
                      ),
                    )
                  }
                  className={`${campo} h-8 min-w-52 flex-1 text-xs`}
                >
                  <option value="">Sin emparejar</option>
                  {estudiantes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {nombreDe(e)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs font-semibold text-tinta-suave">
                  pts
                  <input
                    type="number"
                    min={0}
                    value={fila.puntos}
                    onChange={(e) =>
                      setFilas((prev) =>
                        prev.map((f, j) =>
                          j === i
                            ? { ...f, puntos: Number(e.target.value) || 0 }
                            : f,
                        ),
                      )
                    }
                    className="h-8 w-16 rounded-full border border-hp-200 bg-white px-2 text-center text-xs text-tinta outline-none focus:border-hp-400"
                  />
                  {fila.total != null && (
                    <span className="text-tinta-suave">/ {fila.total}</span>
                  )}
                </label>
              </li>
            ))}
          </ul>

          <button
            onClick={() => void confirmar()}
            disabled={
              !secuenciaId || !pasoId || emparejadas === 0 || enviando
            }
            className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-50"
          >
            {enviando
              ? "Importando..."
              : `Otorgar puntos a ${emparejadas} estudiante${emparejadas !== 1 ? "s" : ""}`}
          </button>
          {(!secuenciaId || !pasoId) && (
            <p className="mt-2 text-xs text-tinta-suave">
              Falta elegir la secuencia y el paso arriba.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
