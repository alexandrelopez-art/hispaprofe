/**
 * Verifica las reglas puras de la carcasa: qué puerta está activa en cada
 * ruta, qué herramientas ve cada rol, y los nombres de nivel.
 * Ejecutar con:  npx tsx scripts/verificar-carcasa.ts   (no toca la base)
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PUERTAS, puertaActiva, herramientasDe, herramientaActiva } from "@/lib/carcasa/puertas";
import { NIVELES, nombreNivel } from "@/lib/niveles";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const casos: [string, string][] = [
  ["/dashboard", "inicio"], ["/cuenta", "inicio"], ["/cuenta/contrasena", "inicio"], ["/", "inicio"], ["/loquesea", "inicio"],
  ["/dele", "dele"], ["/dele/practica", "dele"], ["/preparacion", "dele"], ["/preparacion/examen-blanco", "dele"],
  ["/clases", "clases"], ["/profe/alumnos", "clases"], ["/profe/alumnos/abc", "clases"], ["/profe/grupos", "clases"],
  ["/profe/clases/x", "clases"], ["/profe/importar", "clases"], ["/profe/entregas/x", "clases"], ["/profe/orales", "clases"],
  ["/recorridos", "clases"], ["/recorridos/abc", "clases"], ["/pasos/abc", "clases"],
  ["/actividades", "actividades"], ["/articulos", "articulos"],
  ["/biblioteca", "biblioteca"], ["/profe/recursos", "biblioteca"], ["/profe/recursos/nuevo", "biblioteca"],
];
for (const [ruta, clave] of casos) {
  afirmar(puertaActiva(ruta).clave === clave, `${ruta} está en la puerta «${clave}»`);
}
afirmar(puertaActiva("/profesor").clave === "inicio", "un prefijo parcial (/profesor) no cuenta como /profe/*");

const dele = PUERTAS.find((p) => p.clave === "dele")!;
const clases = PUERTAS.find((p) => p.clave === "clases")!;
const inicio = PUERTAS.find((p) => p.clave === "inicio")!;
afirmar(herramientasDe(dele, "STUDENT").length === 0, "el estudiante no ve herramientas");
afirmar(herramientasDe(dele, "PROFESOR").length === 4, "el profesor ve cuatro herramientas en DELE");
afirmar(herramientasDe(clases, "ADMIN").length === 8, "el administrador ve ocho herramientas en Mis clases");
afirmar(herramientasDe(inicio, "PROFESOR").length === 0, "Inicio no tiene banda");
afirmar(herramientasDe(dele, "PROFESOR").some((h) => h.pronto && h.nombre === "Taller"), "el taller está marcado como pronto");
afirmar(PUERTAS.map((p) => p.nombre).join("·") === "Inicio·DELE·Mis clases·Actividades·Artículos·Biblioteca", "las puertas, en su orden y con su nombre");

const hs = herramientasDe(clases, "PROFESOR");
afirmar(herramientaActiva(hs, "/profe/alumnos/abc")?.nombre === "Estudiantes", "la herramienta activa se marca por prefijo");
afirmar(herramientaActiva(hs, "/recorridos?servicio=CLASES_PARTICULARES")?.nombre === "Secuencias", "la herramienta activa ignora la query al comparar");
afirmar(herramientaActiva(hs, "/clases") === null, "en la página de la puerta ninguna herramienta está activa");

afirmar(NIVELES.length === 6, "seis niveles");
afirmar(nombreNivel("A2_B1_ESCOLAR") === "A2/B1 escolar", "el escolar tiene su nombre");
afirmar(nombreNivel("B1") === "B1", "los demás se llaman como su valor");
afirmar(nombreNivel("Z9") === "Z9", "un valor desconocido vuelve tal cual, no revienta");

// Ninguna ruta de puerta o de herramienta puede quedar huérfana: es la
// comprobación que habría cazado /profe/importar antes de que lo cazara una
// revisión a mano. Para "/a/b" busca app/(app)/a/b/page.tsx o
// app/(publico)/a/b/page.tsx; la query (?servicio=...) no cuenta.
function sinQueryRuta(ruta: string): string {
  return ruta.split("?")[0];
}

function existePagina(ruta: string): boolean {
  const segmentos = sinQueryRuta(ruta).split("/").filter(Boolean);
  return (
    existsSync(join(process.cwd(), "app", "(app)", ...segmentos, "page.tsx")) ||
    existsSync(join(process.cwd(), "app", "(publico)", ...segmentos, "page.tsx"))
  );
}

const rutas = new Set<string>();
for (const puerta of PUERTAS) {
  rutas.add(puerta.ruta);
  for (const h of puerta.herramientas) {
    if (!h.pronto) rutas.add(h.ruta);
  }
}
for (const ruta of rutas) {
  afirmar(existePagina(ruta), `${ruta} tiene una página que existe`);
}

console.log("\nTodo en orden.");
