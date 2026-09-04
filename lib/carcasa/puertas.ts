/**
 * Las cinco puertas del sitio (más Inicio), como datos. La cabecera, la banda
 * del profesor y las páginas de puerta leen de aquí; nadie escribe rutas de
 * puertas a mano en otro sitio.
 */
export type Herramienta = { nombre: string; ruta: string; pronto?: boolean };

export type Puerta = {
  clave: "inicio" | "dele" | "clases" | "actividades" | "articulos" | "biblioteca";
  nombre: string;
  ruta: string;
  /** Rutas que cuentan como «estar dentro» de la puerta, por prefijo de segmento. */
  prefijos: string[];
  /** Lo que ve el profesor bajo la cabecera cuando está en esta puerta. */
  herramientas: Herramienta[];
};

export const PUERTAS: Puerta[] = [
  { clave: "inicio", nombre: "Inicio", ruta: "/dashboard", prefijos: ["/dashboard", "/cuenta"], herramientas: [] },
  {
    clave: "dele", nombre: "DELE", ruta: "/dele", prefijos: ["/dele", "/preparacion"],
    herramientas: [
      { nombre: "Exámenes", ruta: "/recorridos?servicio=PREPARACION_DELE" },
      { nombre: "Nuevo examen", ruta: "/profe/secuencias/nueva?servicio=PREPARACION_DELE" },
      { nombre: "Taller", ruta: "/dele/taller" },
      { nombre: "Recursos", ruta: "/profe/recursos" },
    ],
  },
  {
    clave: "clases", nombre: "Mis clases", ruta: "/clases",
    prefijos: ["/clases", "/profe/alumnos", "/profe/grupos", "/profe/clases", "/profe/importar", "/profe/entregas", "/profe/orales", "/recorridos", "/pasos", "/profe/secuencias"],
    herramientas: [
      { nombre: "Estudiantes", ruta: "/profe/alumnos" },
      { nombre: "Grupos", ruta: "/profe/grupos" },
      { nombre: "Diario y deberes", ruta: "/profe/clases" },
      { nombre: "Secuencias", ruta: "/recorridos?servicio=CLASES_PARTICULARES" },
      { nombre: "Nueva secuencia", ruta: "/profe/secuencias/nueva?servicio=CLASES_PARTICULARES" },
      { nombre: "Correcciones", ruta: "/profe/entregas" },
      { nombre: "Orales", ruta: "/profe/orales" },
      { nombre: "Importar", ruta: "/profe/importar" },
    ],
  },
  { clave: "actividades", nombre: "Actividades", ruta: "/actividades", prefijos: ["/actividades"], herramientas: [{ nombre: "Publicar", ruta: "/actividades/nueva", pronto: true }] },
  { clave: "articulos", nombre: "Artículos", ruta: "/articulos", prefijos: ["/articulos"], herramientas: [{ nombre: "Escribir", ruta: "/articulos/nuevo", pronto: true }] },
  {
    clave: "biblioteca", nombre: "Biblioteca", ruta: "/biblioteca", prefijos: ["/biblioteca", "/profe/recursos"],
    herramientas: [
      { nombre: "Ejercicios", ruta: "/profe/recursos" },
      { nombre: "Nuevo ejercicio", ruta: "/profe/recursos/nuevo" },
    ],
  },
];

/** `/profe/alumnos` cubre `/profe/alumnos` y `/profe/alumnos/…`, pero no `/profe/alumnosx`. */
function cubre(prefijo: string, ruta: string): boolean {
  return ruta === prefijo || ruta.startsWith(prefijo + "/");
}

function sinQuery(ruta: string): string {
  return ruta.split("?")[0];
}

/** La puerta cuyo prefijo más largo cubre la ruta; Inicio si ninguno. */
export function puertaActiva(pathname: string): Puerta {
  const ruta = sinQuery(pathname);
  let mejor: { puerta: Puerta; largo: number } | null = null;
  for (const puerta of PUERTAS) {
    for (const prefijo of puerta.prefijos) {
      if (cubre(prefijo, ruta) && (!mejor || prefijo.length > mejor.largo)) {
        mejor = { puerta, largo: prefijo.length };
      }
    }
  }
  return mejor?.puerta ?? PUERTAS[0];
}

/** Solo el profesor y el administrador tienen banda. */
export function herramientasDe(puerta: Puerta, rol: string): Herramienta[] {
  return rol === "PROFESOR" || rol === "ADMIN" ? puerta.herramientas : [];
}

/** La herramienta cuya ruta (sin query) cubre la actual; la más larga gana. */
export function herramientaActiva(herramientas: Herramienta[], pathname: string): Herramienta | null {
  const ruta = sinQuery(pathname);
  let mejor: Herramienta | null = null;
  for (const h of herramientas) {
    const base = sinQuery(h.ruta);
    if (!h.pronto && cubre(base, ruta) && (!mejor || base.length > sinQuery(mejor.ruta).length)) mejor = h;
  }
  return mejor;
}
