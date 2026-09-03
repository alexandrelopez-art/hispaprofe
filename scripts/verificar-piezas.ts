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
  { nombre: "botón montado a mano", pieza: "Boton / BotonEnviar (ya admiten onClick y deshabilitado)", regex: /clasesDeBoton\(/ },
  { nombre: "casilla nativa", pieza: "Campo (tipo fecha/fechahora/hora/url/busqueda)", regex: /type="(date|datetime-local|time|url|search)"/ },
];

/**
 * Lo que se queda como está, con su razón. Cada entrada es un prefijo de ruta
 * y, salvo que perdone el fichero entero, el `patron` (el `nombre` de una
 * entrada de PATRONES) que perdona: un hallazgo solo se excusa si hay una
 * entrada cuyo prefijo casa con el fichero Y (no tiene `patron`, O su
 * `patron` es el mismo patrón del hallazgo). Sin `patron` es una amnistía
 * de fichero entero — se reserva para las excepciones estructurales de
 * abajo; cualquier otra excepción va una por patrón, para que perdonar un
 * falso positivo de «botón a mano» no perdone de paso un «tarjeta a mano»
 * de verdad en el mismo fichero.
 * Quitar una entrada de aquí es la forma de «reclamar» ese hallazgo para las piezas.
 */
const EXCEPCIONES: { prefijo: string; patron?: string; razon: string }[] = [
  { prefijo: "components/ui/", razon: "son las piezas" },
  { prefijo: "components/carcasa/", razon: "la cabecera usa las clases de la identidad directamente" },
  { prefijo: "app/(publico)/", razon: "la portada tiene su propio diseño, aprobado" },
  { prefijo: "app/(imprimible)/", razon: "es la ficha A4 para imprimir" },
  { prefijo: "components/ejercicios/", razon: "el motor de ejercicios que resuelve el estudiante; no se toca en la sesión B" },
  { prefijo: "components/expresion/grabadora.tsx", razon: "la grabadora tiene su propia interfaz de estados" },
  { prefijo: "app/(app)/muestrario/", razon: "es el muestrario de las piezas: enseña sus clases a propósito, no es una pantalla real" },

  // ─── Task 6: falsos positivos del regex «título a mano» ──────────────────
  // `text-3xl font-extrabold` también es la clase del número grande de una
  // tarjeta de estadística (no hay ningún `<h1>` suelto: el título real de
  // la página vive en `Encabezado`, en el layout o justo encima).
  { prefijo: "app/(app)/admin/page.tsx", patron: "título a mano", razon: "falso positivo: text-3xl font-extrabold es el número de cada `Dato`, no un h1 (el título real es el Encabezado del layout de /admin)" },
  { prefijo: "app/(app)/clases/profesor.tsx", patron: "título a mano", razon: "falso positivo: los 4 hallazgos son los números de las tarjetas de estadística (Secuencias/Estudiantes/Asignaciones/Progreso), no un h1 (el título real ya es un Encabezado)" },
  { prefijo: "components/orales/panel.tsx", patron: "título a mano", razon: "falso positivo: es la nota «/20», no un h1" },
  { prefijo: "components/orales/panel.tsx", patron: "casilla a mano", razon: "falso positivo: `const campo = campoDeReloj[...]` es una variable de qué reloj está corriendo, no una clase de <input>" },

  // ─── Task 6: casos «toque ligero» — native date/url/search/file inputs,
  // optgroup, listas — que el contrato deja fuera de Campo/Boton/Tarjeta ──
  { prefijo: "app/(app)/admin/personas/page.tsx", patron: "casilla a mano", razon: "el buscador es <input type=\"search\">, que Campo no cubre todavía (mismo hueco que url/fecha), con las clases de Campo y su propia etiqueta" },
  { prefijo: "app/(app)/admin/personas/page.tsx", patron: "botón a mano", razon: "falso positivo del regex sobre ese mismo buscador y sobre el <input type=\"text\" name=\"confirmacion\"> que exige escribir el correo para confirmar la supresión — un campo con comportamiento propio (aria-label dinámico, compara contra el email de la fila) que se queda nativo a propósito" },
  { prefijo: "app/(app)/profe/alumnos/[id]/page.tsx", patron: "botón a mano", razon: "falso positivo: el único hallazgo que queda es el <input type=\"number\"> nativo del Campo-con-botón-dentro (el botón en sí ya se convirtió a BotonEnviar); Campo no admite un botón dentro de la misma fila sin sitio para su etiqueta" },
  { prefijo: "app/(app)/profe/clases/[id]/page.tsx", patron: "casilla a mano", razon: "<input type=\"datetime-local\">, <select> con <optgroup> (agrupa estudiantes y grupos, Campo no lo soporta) y <input type=\"url\">, los tres con las clases de Campo" },
  { prefijo: "app/(app)/profe/clases/[id]/page.tsx", patron: "botón a mano", razon: "falso positivo del regex sobre esos mismos tres controles" },
  { prefijo: "app/(app)/profe/clases/page.tsx", patron: "casilla a mano", razon: "<input type=\"datetime-local\">, dos <input type=\"date\"> y un <input type=\"url\">, los cuatro con las clases de Campo" },
  { prefijo: "app/(app)/profe/clases/page.tsx", patron: "botón a mano", razon: "falso positivo del regex sobre esos mismos cuatro controles" },
  { prefijo: "app/(app)/profe/orales/[id]/sujets/page.tsx", patron: "casilla a mano", razon: "<input type=\"url\"> con las clases de Campo (Campo no cubre url todavía)" },
  { prefijo: "app/(app)/profe/orales/[id]/sujets/page.tsx", patron: "botón a mano", razon: "falso positivo del regex sobre ese mismo input" },
  { prefijo: "app/(app)/profe/importar/importar-cliente.tsx", patron: "casilla a mano", razon: "la constante `campo` y el <input> de puntos viven dentro de la lista que se repite por cada fila del CSV (\"listas\" — excepción del propio contrato de Campo)" },
  { prefijo: "app/(app)/profe/importar/importar-cliente.tsx", patron: "botón a mano", razon: "falso positivo del regex sobre esos mismos controles" },
  { prefijo: "app/(app)/profe/importar/importar-cliente.tsx", patron: "tarjeta a mano", razon: "las 3 tarjetas se quedan nativas porque Tarjeta no está en la lista de piezas que se tocan en los editores grandes (solo botones, avisos, etiquetas, rótulos y campos sencillos)" },
  { prefijo: "components/recursos/campos.tsx", patron: "casilla a mano", razon: "exporta las clases `campo`/`area` que usan los editores de recursos para los campos que viven dentro de una lista con sus propios botones de añadir/quitar (preguntas, opciones, parejas…) — la excepción de \"listas\" del propio contrato de Campo" },
  { prefijo: "components/recursos/campos.tsx", patron: "botón a mano", razon: "falso positivo del regex sobre esas mismas clases" },
  { prefijo: "components/orales/cronometro.tsx", patron: "tarjeta a mano", razon: "components/orales/* es de toque ligero: Tarjeta no está en la lista de piezas que se tocan ahí (solo botones, avisos, etiquetas, rótulos y campos sencillos), así que la caja del cronómetro se queda con sus clases nativas" },

  // ─── Task 6: el enlace ENLACE no puede ser Tarjeta ────────────────────────
  { prefijo: "app/(app)/pasos/[pasoId]/page.tsx", patron: "tarjeta a mano", razon: "el bloque ENLACE es un <a target=\"_blank\" rel=\"noopener noreferrer\">: Tarjeta no acepta target/rel, y un enlace externo sin noopener es un agujero de verdad (ya razonado en el propio comentario del código)" },
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
    const excepcionesFichero = EXCEPCIONES.filter((e) => rel.startsWith(e.prefijo));
    if (excepcionesFichero.some((e) => !e.patron)) continue; // amnistía de fichero entero
    const texto = readFileSync(ruta, "utf8");
    for (const p of PATRONES) {
      if (excepcionesFichero.some((e) => e.patron === p.nombre)) continue;
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

// El tope frena el apaño de «añadir una excepción por si acaso»: si crece,
// la lista deja de ser lo estructural y los falsos positivos nombrados, y
// vuelve a ser un cajón de sastre. Va antes del veredicto y corre siempre
// (también con --listar): la foto de hallazgos ya se imprimió arriba.
const TOPE_EXCEPCIONES = 14;
if (EXCEPCIONES.length > TOPE_EXCEPCIONES) {
  console.error(`FALLO: ${EXCEPCIONES.length} excepciones; el tope es ${TOPE_EXCEPCIONES}. Antes de añadir una, convertir.`);
  process.exit(1);
}

if (!soloListar) {
  console.error("\nFALLO: quedan piezas escritas a mano fuera de las excepciones.");
  process.exit(1);
}
