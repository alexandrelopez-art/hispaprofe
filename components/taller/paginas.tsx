"use client";

import { useState, useTransition } from "react";
import { borrarPaginaAccion, registrarPaginaAccion, reordenarPaginasAccion } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Rotulo from "@/components/ui/rotulo";

type Pagina = { id: string; orden: number; archivoId: string };

// Misma función que `components/subir-imagen.tsx`, copiada aquí: reduce la
// imagen en el navegador antes de subirla, para que la base de datos no se
// llene de fotos a tamaño original. Aquí la salida es siempre JPEG (no WebP)
// porque las páginas también pueden venir de un PDF renderizado a canvas.
async function reducir(archivo: Blob, nombre: string): Promise<File> {
  const mapa = await createImageBitmap(archivo);
  const maximo = 1600;
  const escala = Math.min(1, maximo / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext("2d")?.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  mapa.close();
  const blob = await new Promise<Blob>((r) => lienzo.toBlob((b) => r(b ?? archivo), "image/jpeg", 0.85));
  return new File([blob], nombre.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Un PDF, a una imagen por página. */
async function paginasDePdf(archivo: File): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  const salida: File[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: 2 });
    const lienzo = document.createElement("canvas");
    lienzo.width = vista.width;
    lienzo.height = vista.height;
    await pagina.render({ canvasContext: lienzo.getContext("2d")!, viewport: vista, canvas: lienzo }).promise;
    const blob = await new Promise<Blob>((r) => lienzo.toBlob((b) => r(b!), "image/jpeg", 0.85));
    salida.push(new File([blob], `${archivo.name.replace(/\.pdf$/i, "")}-${n}.jpg`, { type: "image/jpeg" }));
  }
  return salida;
}

async function subir(f: File): Promise<string> {
  const cuerpo = new FormData();
  cuerpo.append("archivo", f);
  const r = await fetch("/api/archivos", { method: "POST", body: cuerpo });
  const json = (await r.json()) as { url?: string; error?: string };
  if (!r.ok || !json.url) throw new Error(json.error ?? "No se pudo subir la página.");
  return json.url;
}

export default function Paginas({ examenId, paginas }: { examenId: string; paginas: Pagina[] }) {
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  async function alElegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setError(null);
    try {
      const ficheros: File[] = [];
      for (const f of Array.from(lista)) {
        if (f.type === "application/pdf") ficheros.push(...(await paginasDePdf(f)));
        else ficheros.push(await reducir(f, f.name));
      }
      for (let i = 0; i < ficheros.length; i++) {
        setProgreso(`Subiendo página ${i + 1} de ${ficheros.length}…`);
        const url = await subir(ficheros[i]);
        const r = await registrarPaginaAccion(examenId, url);
        if (r.error) throw new Error(r.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron subir las páginas.");
    } finally {
      setProgreso(null);
    }
  }

  function mover(id: string, sentido: -1 | 1) {
    const ids = paginas.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + sentido;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    empezar(() => reordenarPaginasAccion(examenId, ids));
  }

  return (
    <div>
      <Rotulo>Páginas del examen</Rotulo>
      <label className="mt-2 block text-sm text-tinta-suave">
        Imágenes o un PDF; cada página se sube por separado.
        <input type="file" accept="image/*,application/pdf" multiple className="mt-2 block text-sm" onChange={(e) => alElegir(e.target.files)} disabled={progreso !== null} />
      </label>
      {progreso && <Aviso tono="info" className="mt-3">{progreso}</Aviso>}
      {error && <Aviso tono="error" className="mt-3">{error}</Aviso>}
      <ol className="mt-4 flex flex-wrap gap-3">
        {paginas.map((p, i) => (
          <li key={p.id} className="w-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/archivos/${p.archivoId}`} alt={`Página ${i + 1}`} className="rounded-tarjeta border border-hp-100" />
            <div className="mt-1 flex items-center justify-between text-xs text-tinta-suave">
              <span>{i + 1}</span>
              <span className="flex gap-1">
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(p.id, -1)} title="Antes">↑</Boton>
                <Boton variante="sutil" tamano="pequeno" onClick={() => mover(p.id, 1)} title="Después">↓</Boton>
                <form action={borrarPaginaAccion}>
                  <input type="hidden" name="examenId" value={examenId} />
                  <input type="hidden" name="paginaId" value={p.id} />
                  <BotonEnviar gerundio="Quitando…" variante="peligro" tamano="pequeno">Quitar</BotonEnviar>
                </form>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
