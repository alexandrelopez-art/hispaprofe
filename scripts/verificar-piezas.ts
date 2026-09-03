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
  // La tercera alternativa incluye `text-tinta-suave` a propósito: un
  // input nativo también puede llevar `border border-hp-200` (es la clase
  // de Campo), pero el color de texto `text-tinta-suave` solo lo lleva el
  // botón `sutil` — sin eso, cualquier input con las clases de Campo se
  // confundía con un botón.
  { nombre: "botón a mano", pieza: "Boton / BotonEnviar", regex: /rounded-full (bg-hp-[45]00|border-2 border-tinta|border border-hp-200 text-tinta-suave)/ },
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

  // ─── Task 6/2: casos «toque ligero», ficheros enteros ─────────────────────
  // Uno por fichero (o carpeta) en vez de uno por patrón: todo lo que hay
  // hoy en cada uno de estos ya está fuera del contrato por el mismo motivo
  // (listas propias, o «toque ligero» declarado), así que separar por patrón
  // no añadía nada — y con el tope de excepciones, sí que costaba.
  { prefijo: "app/(app)/profe/importar/importar-cliente.tsx", razon: "toda la pantalla es de \"listas\" (CSV fila a fila, con sus propios botones) — la excepción del propio contrato de Campo — y Tarjeta no está en la lista de piezas que se tocan en los editores grandes" },
  { prefijo: "components/recursos/campos.tsx", razon: "exporta las clases `campo`/`area` que usan los editores de recursos para los campos que viven dentro de una lista con sus propios botones de añadir/quitar — la excepción de \"listas\" del propio contrato de Campo" },
  { prefijo: "components/orales/panel.tsx", razon: "los 4 hallazgos son falsos positivos: 1 × «título a mano» es la nota «/20» (no un h1) y 3 × «casilla a mano» son `const campo = campoDeReloj[...]`, una variable de qué reloj está corriendo (no una clase de <input>)" },
  { prefijo: "components/orales/cronometro.tsx", razon: "components/orales/* es de toque ligero: Tarjeta no está en la lista de piezas que se tocan ahí (solo botones, avisos, etiquetas, rótulos y campos sencillos), así que la caja del cronómetro se queda con sus clases nativas" },

  // ─── Task 2: tres botones que comparten un único <form> con varias
  // acciones (formAction) — ver el comentario en el propio fichero ──────────
  { prefijo: "components/recursos/editor.tsx", patron: "botón montado a mano", razon: "Guardar/Publicar/Borrar viven en el mismo <form action={guardar}>, con Publicar y Borrar como formAction sobre ese mismo <form>; BotonEnviar lee su `pending` de useFormStatus(), que es del <form> entero y no de qué botón lo disparó, así que convertir cualquiera de los tres encendería el gerundio y el apagado de los otros dos con el envío equivocado — un botón diría «Guardando…» mientras se publica" },
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

if (hallazgos.length > 0) {
  const porFichero = new Map<string, typeof hallazgos>();
  for (const h of hallazgos) porFichero.set(h.fichero, [...(porFichero.get(h.fichero) ?? []), h]);
  for (const [fichero, lista] of [...porFichero.entries()].sort()) {
    console.log(fichero);
    for (const h of lista) console.log(`  ${h.veces} × ${h.patron} → ${h.pieza}`);
  }
  console.log(`\n${porFichero.size} ficheros, ${hallazgos.reduce((s, h) => s + h.veces, 0)} hallazgos.`);
}

// El tope frena el apaño de «añadir una excepción por si acaso»: si crece,
// la lista deja de ser lo estructural y los falsos positivos nombrados, y
// vuelve a ser un cajón de sastre. Corre SIEMPRE, antes del veredicto de
// hallazgos (y también con --listar) — incluido cuando hallazgos.length es
// 0: una tirada en verde con 27 excepciones obsoletas tiene que seguir
// fallando, no colarse por el atajo de «no hay nada que listar».
const TOPE_EXCEPCIONES = 14;
if (EXCEPCIONES.length > TOPE_EXCEPCIONES) {
  console.error(`FALLO: ${EXCEPCIONES.length} excepciones; el tope es ${TOPE_EXCEPCIONES}. Antes de añadir una, convertir.`);
  process.exit(1);
}

if (hallazgos.length === 0) {
  console.log("OK: ninguna pieza escrita a mano fuera de las excepciones.\n\nTodo en orden.");
  process.exit(0);
}

if (!soloListar) {
  console.error("\nFALLO: quedan piezas escritas a mano fuera de las excepciones.");
  process.exit(1);
}
