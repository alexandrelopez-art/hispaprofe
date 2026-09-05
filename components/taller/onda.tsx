"use client";

import { useEffect, useRef, useState } from "react";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import Campo from "@/components/ui/campo";

// Colores de la casa (app/globals.css): hp-200 para las barras de la onda,
// coral-500 para los marcadores de corte. El canvas se pinta con el 2D
// context, que no lee clases de Tailwind — de ahí el hex a mano, solo aquí.
const COLOR_BARRA = "#93d8f9";
const COLOR_MARCADOR = "#e0566e";

/** El pico de cada cubo, de 0 a 1, para pintar la onda. */
export function picosDe(canal: Float32Array, cubos: number): number[] {
  const porCubo = Math.max(1, Math.floor(canal.length / cubos));
  const picos: number[] = [];
  for (let c = 0; c < cubos; c++) {
    let max = 0;
    const desde = c * porCubo;
    for (let i = desde; i < Math.min(desde + porCubo, canal.length); i++) max = Math.max(max, Math.abs(canal[i]));
    picos.push(max);
  }
  const tope = Math.max(...picos, 1e-6);
  return picos.map((p) => p / tope);
}

/**
 * Dónde vuelve el sonido tras cada silencio largo: ventanas de 100 ms cuyo
 * RMS no llega al 2 % del máximo, encadenadas ≥ 1,5 s, saltando los primeros
 * `saltarSegundos` (las instrucciones). Devuelve segundos, ordenados.
 */
export function silenciosDe(canal: Float32Array, frecuencia: number, saltarSegundos = 3, minimoSegundos = 1.5, umbral = 0.02): number[] {
  const ventana = Math.floor(frecuencia / 10);
  const rms: number[] = [];
  for (let i = 0; i + ventana <= canal.length; i += ventana) {
    let suma = 0;
    for (let j = i; j < i + ventana; j++) suma += canal[j] * canal[j];
    rms.push(Math.sqrt(suma / ventana));
  }
  const tope = Math.max(...rms, 1e-6);
  const cortes: number[] = [];
  let enSilencio = 0;
  for (let v = 0; v < rms.length; v++) {
    if (rms[v] / tope < umbral) { enSilencio++; continue; }
    if (enSilencio * 0.1 >= minimoSegundos) {
      const t = v * 0.1;
      if (t >= saltarSegundos) cortes.push(Number(t.toFixed(1)));
    }
    enSilencio = 0;
  }
  return cortes;
}

const CUBOS = 1200;
const ALTO_CANVAS = 120;
/** Distancia, en píxeles, para considerar que un clic empieza a arrastrar un marcador en vez de crear uno nuevo. */
const RADIO_ARRASTRE = 6;

function formatoTiempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Estado = "cargando" | "ok" | "error";

/**
 * La onda de una grabación, con marcadores de corte que se arrastran, se
 * añaden con un clic y se pueden proponer solos por los silencios. Todo el
 * análisis vive en `picosDe`/`silenciosDe`, puras y exportadas para el
 * script de verificación (un canal sintético, sin base de datos).
 *
 * Sin `AudioContext` o si la grabación no se puede decodificar (un Safari
 * viejo, un formato raro), no hay onda que pintar: se ofrece un campo de
 * texto para escribir los cortes a mano, y desde ahí también se corta.
 */
export default function Onda({
  src,
  cortesIniciales,
  esperados,
  alCortar,
  bloqueado,
}: {
  src: string;
  cortesIniciales: number[];
  esperados: number;
  alCortar: (cortes: number[]) => void;
  bloqueado: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [canal, setCanal] = useState<Float32Array | null>(null);
  const [frecuencia, setFrecuencia] = useState(0);
  const [picos, setPicos] = useState<number[] | null>(null);
  const [marcadores, setMarcadores] = useState<number[]>(() => [...cortesIniciales].sort((a, b) => a - b));
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [anchoCanvas, setAnchoCanvas] = useState(600);
  const [textoManual, setTextoManual] = useState(cortesIniciales.join(", "));

  const contenedorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const duracion = canal && frecuencia ? canal.length / frecuencia : 0;
  const titulo = bloqueado ? "Guarda o descarta tus cambios antes" : undefined;

  // Al montar: trae el audio, lo decodifica y calcula los picos y, si no
  // había cortes guardados, propone marcadores por los silencios. Solo al
  // montar: la página remonta este componente entero (por su `key`) cuando
  // cambian la grabación o los cortes, así que no hace falta reaccionar a
  // que cambien `cortesIniciales` en caliente.
  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        type VentanaConWebkit = Window & { webkitAudioContext?: typeof AudioContext };
        const Contexto = window.AudioContext ?? (window as VentanaConWebkit).webkitAudioContext;
        if (!Contexto) throw new Error("Este navegador no tiene AudioContext.");
        const respuesta = await fetch(src);
        const datos = await respuesta.arrayBuffer();
        const contexto = new Contexto();
        const decodificado = await contexto.decodeAudioData(datos);
        void contexto.close().catch(() => {});
        if (cancelado) return;
        const canalDecodificado = decodificado.getChannelData(0);
        setCanal(canalDecodificado);
        setFrecuencia(decodificado.sampleRate);
        setPicos(picosDe(canalDecodificado, CUBOS));
        if (cortesIniciales.length === 0) {
          setMarcadores(silenciosDe(canalDecodificado, decodificado.sampleRate));
        }
        setEstado("ok");
      } catch {
        if (!cancelado) setEstado("error");
      }
    }
    cargar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // El ancho del canvas sigue al de su contenedor: la onda ocupa todo el
  // ancho disponible, no un tamaño fijo.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const observador = new ResizeObserver((entradas) => {
      const ancho = entradas[0]?.contentRect.width;
      if (ancho) setAnchoCanvas(Math.max(1, Math.round(ancho)));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Repinta cuando cambian los picos, los marcadores o el ancho.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !picos) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ancho = canvas.width;
    const alto = canvas.height;
    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = COLOR_BARRA;
    const anchoBarra = ancho / picos.length;
    picos.forEach((p, i) => {
      const h = Math.max(1, p * alto);
      ctx.fillRect(i * anchoBarra, alto - h, Math.max(1, anchoBarra - 0.5), h);
    });
    if (duracion > 0) {
      ctx.strokeStyle = COLOR_MARCADOR;
      ctx.lineWidth = 2;
      for (const t of marcadores) {
        const x = (t / duracion) * ancho;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, alto);
        ctx.stroke();
      }
    }
  }, [picos, marcadores, anchoCanvas, duracion]);

  function xDeTiempo(t: number): number {
    return duracion > 0 ? (t / duracion) * anchoCanvas : 0;
  }

  function tiempoDeX(x: number): number {
    return duracion > 0 ? Math.max(0, Math.min(duracion, (x / anchoCanvas) * duracion)) : 0;
  }

  function alPulsarCanvas(e: React.MouseEvent<HTMLCanvasElement>) {
    if (bloqueado || estado !== "ok") return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let cerca = -1;
    let distanciaMinima = RADIO_ARRASTRE;
    marcadores.forEach((t, i) => {
      const distancia = Math.abs(xDeTiempo(t) - x);
      if (distancia < distanciaMinima) { distanciaMinima = distancia; cerca = i; }
    });
    if (cerca >= 0) {
      setArrastrando(cerca);
    } else {
      const t = tiempoDeX(x);
      setMarcadores((m) => [...m, t].sort((a, b) => a - b));
    }
  }

  function alMoverCanvas(e: React.MouseEvent<HTMLCanvasElement>) {
    if (arrastrando === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t = tiempoDeX(e.clientX - rect.left);
    setMarcadores((m) => m.map((v, i) => (i === arrastrando ? t : v)));
  }

  function alSoltarCanvas() {
    if (arrastrando === null) return;
    setArrastrando(null);
    setMarcadores((m) => [...m].sort((a, b) => a - b));
  }

  function escuchar(t: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = t;
    void audio.play().catch(() => {});
    setTimeout(() => audio.pause(), 5000);
  }

  function quitar(i: number) {
    setMarcadores((m) => m.filter((_, idx) => idx !== i));
  }

  function proponerPorSilencios() {
    if (!canal || !frecuencia) return;
    setMarcadores(silenciosDe(canal, frecuencia));
  }

  function confirmarYCortar(cortes: number[]) {
    const trozos = cortes.length + 1;
    if (trozos !== esperados) {
      if (!window.confirm(`El examen espera ${esperados} trozos y has marcado ${cortes.length} cortes. ¿Cortar igualmente?`)) return;
    }
    alCortar(cortes);
  }

  function cortesDelTextoManual(): number[] {
    return textoManual
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);
  }

  if (estado === "error") {
    const cortesManuales = cortesDelTextoManual();
    const trozosManuales = cortesManuales.length + 1;
    const coincideManual = trozosManuales === esperados;
    return (
      <div className="space-y-3">
        <Aviso tono="aviso">No se pudo dibujar la onda en este navegador; puedes escribir los cortes a mano.</Aviso>
        <Campo
          etiqueta="Cortes, en segundos y separados por comas"
          value={textoManual}
          onChange={(e) => setTextoManual(e.target.value)}
          disabled={bloqueado}
          title={titulo}
          placeholder="12.5, 27, 41.3"
        />
        <p className={`text-sm ${coincideManual ? "text-tinta-suave" : "text-error-600"}`}>
          {cortesManuales.length} corte(s) → {trozosManuales} trozo(s); el examen espera {esperados}
        </p>
        <Boton variante="primario" onClick={() => confirmarYCortar(cortesManuales)} disabled={bloqueado} title={titulo}>
          Cortar y repartir
        </Boton>
      </div>
    );
  }

  const trozos = marcadores.length + 1;
  const coincide = trozos === esperados;

  return (
    <div className="space-y-3">
      {/* Audio oculto, solo para «Escuchar 5 s»: no lleva controles visibles. */}
      <audio ref={audioRef} src={src} preload="none" className="hidden" />
      <div ref={contenedorRef}>
        {estado === "cargando" ? (
          <p className="text-sm text-tinta-suave">Cargando la onda…</p>
        ) : (
          <canvas
            ref={canvasRef}
            width={anchoCanvas}
            height={ALTO_CANVAS}
            title={titulo}
            className={`w-full rounded-xl bg-white ${bloqueado ? "cursor-not-allowed" : "cursor-pointer"}`}
            onMouseDown={alPulsarCanvas}
            onMouseMove={alMoverCanvas}
            onMouseUp={alSoltarCanvas}
            onMouseLeave={alSoltarCanvas}
          />
        )}
      </div>

      {estado === "ok" && (
        <>
          <p className={`text-sm ${coincide ? "text-tinta-suave" : "text-error-600"}`}>
            {marcadores.length} corte(s) → {trozos} trozo(s); el examen espera {esperados}
          </p>

          {marcadores.length > 0 && (
            <ul className="space-y-2 text-sm">
              {marcadores.map((t, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-14 font-mono text-tinta-suave">{formatoTiempo(t)}</span>
                  <Boton variante="sutil" tamano="pequeno" onClick={() => escuchar(t)} disabled={bloqueado} title={titulo}>
                    Escuchar 5 s
                  </Boton>
                  <Boton variante="sutil" tamano="pequeno" onClick={() => quitar(i)} disabled={bloqueado} title={titulo}>
                    Quitar
                  </Boton>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Boton variante="primario" onClick={() => confirmarYCortar(marcadores)} disabled={bloqueado} title={titulo}>
              Cortar y repartir
            </Boton>
            <Boton variante="sutil" onClick={proponerPorSilencios} disabled={bloqueado} title={titulo}>
              Proponer cortes por los silencios
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}
