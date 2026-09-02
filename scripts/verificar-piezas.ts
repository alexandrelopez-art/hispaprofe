/**
 * Verifica «por mutación» que nadie escribe a mano lo que las piezas de
 * components/ui ya dan: si un botón, una casilla, una tarjeta o un título
 * aparecen sueltos fuera de las piezas, aquí se ve. Falla si queda alguno
 * fuera de la lista de excepciones. Ejecutar con: npx tsx scripts/verificar-piezas.ts
 * Con --listar, solo imprime lo que queda, sin fallar (para ir bajando el contador).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();

/** Cada patrón dice qué pieza lo sustituye. */
const PATRONES: { nombre: string; pieza: string; regex: RegExp }[] = [
  { nombre: "título a mano", pieza: "Encabezado", regex: /text-3xl font-extrabold/ },
  { nombre: "tarjeta a mano", pieza: "Tarjeta", regex: /rounded-tarjeta border border-hp-100 bg-white/ },
  { nombre: "botón a mano", pieza: "Boton / BotonEnviar", regex: /rounded-full (bg-hp-[45]00|border(-2)? border-(hp-2|tinta))/ },
  { nombre: "casilla a mano", pieza: "Campo", regex: /const campo =|rounded-full border border-hp-200 bg-white px-4/ },
  { nombre: "nombres de nivel duplicados", pieza: "lib/niveles", regex: /nivelLabel|NOMBRE_NIVEL|const nombreNivel/ },
  { nombre: "rótulo a mano", pieza: "Rotulo", regex: /text-xs font-bold uppercase tracking-wider/ },
  { nombre: "aviso amarillo como error", pieza: "Aviso tono=\"error\"", regex: /bg-sol-100[^"]*text-(coral|tinta)[^"]*"[^>]*>\s*\{?\s*(error|estado\.error|mensaje)/ },
];

/**
 * Lo que se queda como está, con su razón. Cada entrada es un prefijo de ruta.
 * Quitar una entrada de aquí es la forma de «reclamar» ese fichero para las piezas.
 */
const EXCEPCIONES: { prefijo: string; razon: string }[] = [
  { prefijo: "components/ui/", razon: "son las piezas" },
  { prefijo: "components/carcasa/", razon: "la cabecera usa las clases de la identidad directamente" },
  { prefijo: "app/(publico)/", razon: "la portada tiene su propio diseño, aprobado" },
  { prefijo: "app/(imprimible)/", razon: "es la ficha A4 para imprimir" },
  { prefijo: "components/ejercicios/", razon: "el motor de ejercicios que resuelve el estudiante; no se toca en la sesión B" },
  { prefijo: "components/expresion/grabadora.tsx", razon: "la grabadora tiene su propia interfaz de estados" },
];

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith(".tsx")) salida.push(ruta);
  }
  return salida;
}

const soloListar = process.argv.includes("--listar");
const hallazgos: { fichero: string; patron: string; pieza: string; veces: number }[] = [];

for (const raiz of ["app", "components"]) {
  for (const ruta of ficheros(join(RAIZ, raiz))) {
    const rel = relative(RAIZ, ruta);
    if (EXCEPCIONES.some((e) => rel.startsWith(e.prefijo))) continue;
    const texto = readFileSync(ruta, "utf8");
    for (const p of PATRONES) {
      const veces = (texto.match(new RegExp(p.regex.source, "g")) ?? []).length;
      if (veces > 0) hallazgos.push({ fichero: rel, patron: p.nombre, pieza: p.pieza, veces });
    }
  }
}

if (hallazgos.length === 0) {
  console.log("OK: ninguna pieza escrita a mano fuera de las excepciones.\n\nTodo en orden.");
  process.exit(0);
}

const porFichero = new Map<string, typeof hallazgos>();
for (const h of hallazgos) porFichero.set(h.fichero, [...(porFichero.get(h.fichero) ?? []), h]);
for (const [fichero, lista] of [...porFichero.entries()].sort()) {
  console.log(fichero);
  for (const h of lista) console.log(`  ${h.veces} × ${h.patron} → ${h.pieza}`);
}
console.log(`\n${porFichero.size} ficheros, ${hallazgos.reduce((s, h) => s + h.veces, 0)} hallazgos.`);
if (!soloListar) {
  console.error("\nFALLO: quedan piezas escritas a mano fuera de las excepciones.");
  process.exit(1);
}
