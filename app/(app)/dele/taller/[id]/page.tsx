import { notFound } from "next/navigation";
import { repartirEnOrdenAccion } from "@/lib/acciones-taller";
import { examenDe } from "@/lib/taller/consultas";
import { tareaDe as tareaDelMapa } from "@/lib/dele";
import type { TareaParaTarjeta } from "@/components/taller/tarjeta-tarea";
import TarjetaTarea from "@/components/taller/tarjeta-tarea";
import Cuadernillo from "@/components/taller/cuadernillo";
import Paginas from "@/components/taller/paginas";
import BotonEnviar from "@/components/ui/boton-enviar";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import type { TonoEtiqueta } from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TONO: Record<string, TonoEtiqueta> = {
  EN_CONSTRUCCION: "sol",
  PUBLICADO: "verde",
  ARCHIVADO: "neutro",
};

const NOMBRE: Record<string, string> = {
  EN_CONSTRUCCION: "En construcción",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};

/** Una fila de `TareaDeExamen`, vista para `TarjetaTarea`. */
function paraTarjeta(t: {
  id: string;
  numero: number;
  prueba: "CE" | "CO";
  estado: "VACIA" | "RELLENADA" | "REVISADA";
  pasoId: string;
  paginaIds: string[];
  avisos: unknown;
  dudas: unknown;
  imagenesPedidas: unknown;
}): TareaParaTarjeta {
  return {
    id: t.id,
    numero: t.numero,
    prueba: t.prueba,
    estado: t.estado,
    pasoId: t.pasoId,
    paginaIds: t.paginaIds,
    avisos: (t.avisos as string[] | null) ?? [],
    dudas: ((t.dudas as unknown[] | null) ?? []).length,
    imagenesPendientes: ((t.imagenesPedidas as { archivoId?: string }[] | null) ?? []).filter((i) => !i.archivoId).length,
  };
}

export default async function ExamenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const examen = await examenDe(id);
  if (!examen) notFound();

  const paginasParaAsignar = examen.paginas.map((p) => ({ id: p.id, orden: p.orden }));
  const lectura = examen.tareas.filter((t) => t.prueba === "CE");
  const auditiva = examen.tareas.filter((t) => t.prueba === "CO");
  const imagenesPorSubir = examen.tareas.reduce(
    (n, t) => n + ((t.imagenesPedidas as { archivoId?: string }[] | null) ?? []).filter((i) => !i.archivoId).length,
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Encabezado
        titulo={examen.titulo}
        lede={examen.fuente}
        volver={{ href: "/dele/taller", texto: "Taller" }}
        acciones={<Etiqueta tono={TONO[examen.estado] ?? "neutro"}>{NOMBRE[examen.estado] ?? examen.estado}</Etiqueta>}
      />

      <Tarjeta className="mt-6">
        <Paginas examenId={examen.id} paginas={examen.paginas} />
        <form action={repartirEnOrdenAccion} className="mt-4">
          <input type="hidden" name="examenId" value={examen.id} />
          <BotonEnviar
            gerundio="Repartiendo…"
            variante="sutil"
            tamano="pequeno"
            deshabilitado={examen.paginas.length === 0}
          >
            Repartir en orden
          </BotonEnviar>
        </form>
      </Tarjeta>

      <Tarjeta className="mt-6">
        <Cuadernillo examenId={examen.id} caracteres={examen.clavesTexto?.length ?? null} />
      </Tarjeta>

      <Tarjeta titulo="Imágenes que faltan" className="mt-6">
        {imagenesPorSubir === 0 ? (
          <Vacio>Ninguna por ahora.</Vacio>
        ) : (
          <p className="text-sm text-tinta-suave">
            {imagenesPorSubir} imagen{imagenesPorSubir !== 1 ? "es" : ""} por subir. Se suben desde aquí en la siguiente entrega.
          </p>
        )}
      </Tarjeta>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <Rotulo>Lectura</Rotulo>
          <div className="mt-3 space-y-4">
            {lectura.map((t) => (
              <TarjetaTarea
                key={t.id}
                tarea={paraTarjeta(t)}
                delMapa={tareaDelMapa("A2_B1_ESCOLAR", t.prueba, t.numero)!}
                paginas={paginasParaAsignar}
                examenId={examen.id}
              />
            ))}
          </div>
        </div>
        <div>
          <Rotulo>Auditiva</Rotulo>
          <div className="mt-3 space-y-4">
            {auditiva.map((t) => (
              <TarjetaTarea
                key={t.id}
                tarea={paraTarjeta(t)}
                delMapa={tareaDelMapa("A2_B1_ESCOLAR", t.prueba, t.numero)!}
                paginas={paginasParaAsignar}
                examenId={examen.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
