"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { asignarImagenPedidaAccion, quitarImagenPedidaAccion } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";

export type ImagenPedida = { pregunta: string; opcion: number | null; para: string; archivoId: string | null };

const LETRAS = "ABCDEFGHIJ";

/**
 * Reduce la imagen en el navegador antes de subirla. Copiado de
 * `components/subir-imagen.tsx`: una foto de móvil de 8 MP baja a unos
 * 200 KB sin diferencia visible en pantalla, y así la base de datos no se
 * llena de fotos a tamaño original.
 */
async function reducir(archivo: File): Promise<Blob> {
  // Los SVG y los GIF animados se rompen al pasarlos por el lienzo.
  if (archivo.type === "image/svg+xml" || archivo.type === "image/gif") {
    return archivo;
  }

  const mapa = await createImageBitmap(archivo);
  const maximo = 1600;
  const escala = Math.min(1, maximo / Math.max(mapa.width, mapa.height));
  const ancho = Math.round(mapa.width * escala);
  const alto = Math.round(mapa.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext("2d")?.drawImage(mapa, 0, 0, ancho, alto);
  mapa.close();

  return new Promise((resolver) =>
    lienzo.toBlob(
      (b) => resolver(b ?? archivo),
      "image/webp",
      0.85,
    ),
  );
}

/**
 * La lista de imágenes que la IA pidió para una tarea: para las que ya
 * tienen `archivoId`, la miniatura; para las que no, el sitio por donde
 * entra la imagen (subida desde aquí, comprimida igual que en
 * `SubirImagen`) o el botón para decir que no hace falta.
 *
 * La usan tanto la pantalla de revisión de la tarea (con `bloqueado` atado
 * a si hay cambios sin guardar: subir una imagen mientras el ejercicio
 * tiene ediciones a medio guardar mezclaría dos guardados distintos) como
 * la mesa de trabajo, agrupada por tarea, donde no hay edición a medio
 * hacer y `bloqueado` siempre es `false`.
 */
export default function ImagenesPedidas({ tareaId, pedidas, bloqueado }: { tareaId: string; pedidas: ImagenPedida[]; bloqueado: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [subiendoIndice, setSubiendoIndice] = useState<number | null>(null);
  const [errores, setErrores] = useState<Record<number, string>>({});

  async function subir(indice: number, archivo: File) {
    setErrores((e) => ({ ...e, [indice]: "" }));
    setOcupado(true);
    setSubiendoIndice(indice);
    try {
      const reducida = await reducir(archivo);
      const cuerpo = new FormData();
      cuerpo.append(
        "archivo",
        new File([reducida], archivo.name.replace(/\.\w+$/, ".webp"), { type: reducida.type || archivo.type }),
      );
      const respuesta = await fetch("/api/archivos", { method: "POST", body: cuerpo });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setErrores((e) => ({ ...e, [indice]: datos.error ?? "No se pudo subir." }));
        return;
      }
      const r = await asignarImagenPedidaAccion(tareaId, indice, datos.url);
      if (r.error) {
        setErrores((e) => ({ ...e, [indice]: r.error! }));
        return;
      }
      router.refresh();
    } catch {
      setErrores((e) => ({ ...e, [indice]: "No se pudo procesar esa imagen." }));
    } finally {
      setOcupado(false);
      setSubiendoIndice(null);
    }
  }

  async function quitar(indice: number) {
    setErrores((e) => ({ ...e, [indice]: "" }));
    setOcupado(true);
    try {
      const r = await quitarImagenPedidaAccion(tareaId, indice);
      if (r.error) setErrores((e) => ({ ...e, [indice]: r.error! }));
      else router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  const titulo = bloqueado ? "Guarda o descarta tus cambios antes" : undefined;

  return (
    <ul className="space-y-3 text-sm">
      {pedidas.map((img, i) => (
        <li key={i} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {img.pregunta}
              {img.opcion !== null ? ` · opción ${LETRAS[img.opcion] ?? img.opcion + 1}` : ""}: {img.para}
              {img.archivoId ? " (subida)" : ""}
            </span>
            {!img.archivoId && (
              <div className="flex items-center gap-2">
                <label
                  className={`inline-flex h-8 cursor-pointer items-center rounded-full border border-hp-200 px-3.5 text-xs font-bold text-tinta-suave transition-colors ${
                    bloqueado || ocupado ? "cursor-not-allowed opacity-60" : "hover:border-hp-400 hover:text-hp-500"
                  }`}
                  title={titulo}
                >
                  {subiendoIndice === i ? "Subiendo…" : "Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={bloqueado || ocupado}
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      e.target.value = "";
                      if (archivo) void subir(i, archivo);
                    }}
                  />
                </label>
                <Boton variante="sutil" tamano="pequeno" onClick={() => quitar(i)} disabled={bloqueado || ocupado} title={titulo}>
                  No hace falta
                </Boton>
              </div>
            )}
          </div>
          {img.archivoId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/archivos/${img.archivoId}`} alt={img.para} className="h-16 w-16 rounded-lg object-cover" />
          )}
          {errores[i] && <Aviso tono="error">{errores[i]}</Aviso>}
        </li>
      ))}
    </ul>
  );
}
