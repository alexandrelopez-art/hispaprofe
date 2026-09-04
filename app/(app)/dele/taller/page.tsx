import { listarExamenes } from "@/lib/taller/consultas";
import Boton from "@/components/ui/boton";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import type { TonoEtiqueta } from "@/components/ui/etiqueta";
import Rotulo from "@/components/ui/rotulo";
import Tarjeta from "@/components/ui/tarjeta";
import Vacio from "@/components/ui/vacio";

export const dynamic = "force-dynamic";

const GRUPOS = [
  { estado: "EN_CONSTRUCCION", rotulo: "En construcción" },
  { estado: "PUBLICADO", rotulo: "Publicados" },
  { estado: "ARCHIVADO", rotulo: "Archivados" },
] as const;

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

export default async function TallerPage() {
  const examenes = await listarExamenes();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado
        titulo="Taller del examen"
        lede="Un examen entra aquí desde sus páginas; tú revisas y publicas."
        acciones={<Boton href="/dele/taller/nuevo">Nuevo examen</Boton>}
      />

      {examenes.length === 0 ? (
        <Vacio accion={<Boton href="/dele/taller/nuevo" variante="primario" tamano="pequeno">Nuevo examen</Boton>}>
          Todavía no hay ningún examen. Crea el primero.
        </Vacio>
      ) : (
        <div className="space-y-8">
          {GRUPOS.map(({ estado, rotulo }) => {
            const delGrupo = examenes.filter((e) => e.estado === estado);
            if (delGrupo.length === 0) return null;
            return (
              <div key={estado}>
                <Rotulo>{rotulo}</Rotulo>
                <div className="mt-3 space-y-3">
                  {delGrupo.map((e) => {
                    const revisadas = e.tareas.filter((t) => t.estado === "REVISADA").length;
                    return (
                      <Tarjeta key={e.id} href={`/dele/taller/${e.id}`} titulo={e.titulo}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-tinta-suave">{revisadas} de {e.tareas.length} tareas revisadas</p>
                          <Etiqueta tono={TONO[e.estado] ?? "neutro"}>{NOMBRE[e.estado] ?? e.estado}</Etiqueta>
                        </div>
                      </Tarjeta>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
