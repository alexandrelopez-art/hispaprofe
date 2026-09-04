import { notFound } from "next/navigation";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import { tareaPorNumero } from "@/lib/taller/consultas";
import { motivosParaNoRevisar } from "@/lib/taller/revision";
import { NOMBRE_ESTADO_TAREA, TONO_ESTADO_TAREA } from "@/lib/taller/estados";
import { hayClaveDeIA } from "@/lib/taller/rellenar";
import { quitarImagenPedidaAccion } from "@/lib/acciones-taller";
import RevisionTarea from "@/components/taller/revision-tarea";
import type { Duda } from "@/components/taller/dudas";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NOMBRE_PRUEBA = { CE: "Lectura", CO: "Auditiva" } as const;

export default async function TareaPage({ params }: { params: Promise<{ id: string; prueba: string; n: string }> }) {
  const { id, prueba, n } = await params;
  const numero = Number(n);
  if ((prueba !== "CE" && prueba !== "CO") || !Number.isInteger(numero) || numero < 1 || numero > 4) notFound();
  const tarea = await tareaPorNumero(id, prueba, numero);
  if (!tarea) notFound();
  const delMapa = tareaDelMapa(tarea.examen.nivel, tarea.prueba, tarea.numero);
  if (!delMapa) notFound();

  const paginas = tarea.examen.paginas.filter((p) => tarea.paginaIds.includes(p.id));
  const bloqueTexto = tarea.paso.bloques.find((b) => b.tipo === "TEXTO")?.texto ?? null;
  const avisos = (tarea.avisos as string[] | null) ?? [];
  const dudas = (tarea.dudas as Duda[] | null) ?? [];
  const pedidas = ((tarea.imagenesPedidas as { pregunta: string; opcion: number | null; para: string; archivoId: string | null }[] | null) ?? []);
  const motivos = motivosParaNoRevisar(tarea);
  const vecina = (k: number) => (k >= 1 && k <= 4 ? `/dele/taller/${id}/tarea/${prueba}/${k}` : null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Encabezado
        titulo={`${NOMBRE_PRUEBA[prueba]} · Tarea ${numero}`}
        lede={delMapa.pide}
        volver={{ href: `/dele/taller/${id}`, texto: tarea.examen.titulo }}
        acciones={<Etiqueta tono={TONO_ESTADO_TAREA[tarea.estado]}>{NOMBRE_ESTADO_TAREA[tarea.estado]}</Etiqueta>}
      />
      {avisos.length > 0 && (
        <Aviso tono="error" className="mb-6"><ul className="list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul></Aviso>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Rotulo>La página original</Rotulo>
          {paginas.length === 0 ? (
            <Vacio className="mt-2">Esta tarea no tiene páginas asignadas. Márcalas en la mesa de trabajo.</Vacio>
          ) : (
            <div className="mt-2 space-y-3">
              {paginas.map((p) => (
                <Tarjeta key={p.id} href={`/api/archivos/${p.archivoId}`} externo relleno="ninguno" className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/archivos/${p.archivoId}`} alt={`Página ${p.orden}`} className="w-full" />
                </Tarjeta>
              ))}
              <p className="text-xs text-tinta-suave">Pulsa una página para verla a tamaño completo en otra pestaña.</p>
            </div>
          )}
          {pedidas.length > 0 && (
            <Tarjeta className="mt-6" titulo="Imágenes que pide esta tarea" relleno="compacto">
              <ul className="space-y-2 text-sm">
                {pedidas.map((img, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span>{img.pregunta}{img.opcion !== null ? ` · opción ${"ABCDEFGHIJ"[img.opcion] ?? img.opcion + 1}` : ""}: {img.para}{img.archivoId ? " (subida)" : ""}</span>
                    {!img.archivoId && (
                      <form action={quitarImagenPedidaAccion}>
                        <input type="hidden" name="tareaId" value={tarea.id} />
                        <input type="hidden" name="indice" value={i} />
                        <BotonEnviar gerundio="Quitando…" variante="sutil" tamano="pequeno">No hace falta</BotonEnviar>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-tinta-suave">Subirlas llega en la siguiente entrega. Si una no hace falta, quítala.</p>
            </Tarjeta>
          )}
        </div>
        <RevisionTarea
          key={tarea.updatedAt.toISOString()}
          tareaId={tarea.id}
          motor={delMapa.motor === "relacionar" ? "relacionar" : "opcion"}
          datosIniciales={tarea.ejercicio.datos}
          bloqueInicial={bloqueTexto}
          dudas={dudas}
          estado={tarea.estado}
          motivos={motivos}
          hayClave={hayClaveDeIA()}
          tieneClave={tarea.claveOficial !== null}
          anterior={vecina(numero - 1)}
          siguiente={vecina(numero + 1)}
        />
      </div>
    </div>
  );
}
