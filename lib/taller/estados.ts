import type { TonoEtiqueta } from "@/components/ui/etiqueta";

export const NOMBRE_ESTADO_EXAMEN: Record<string, string> = {
  EN_CONSTRUCCION: "En construcción",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};
export const TONO_ESTADO_EXAMEN: Record<string, TonoEtiqueta> = {
  EN_CONSTRUCCION: "sol",
  PUBLICADO: "verde",
  ARCHIVADO: "neutro",
};
export const NOMBRE_ESTADO_TAREA: Record<string, string> = {
  VACIA: "Vacía",
  RELLENADA: "Rellenada",
  REVISADA: "Revisada",
};
export const TONO_ESTADO_TAREA: Record<string, TonoEtiqueta> = {
  VACIA: "neutro",
  RELLENADA: "sol",
  REVISADA: "verde",
};
