import { CRITERIOS, TOPE_SEGUNDOS } from "@/lib/orales/criterios";
import type { ClaveCriterio } from "@/lib/orales/criterios";
import { fmtNota, pasoDe } from "@/lib/orales/formato";

/**
 * Las reglas de la evaluación oral que no tocan la base: por eso puede
 * importarlas un componente de cliente (`tarjeta-criterio.tsx` usa
 * `ajustarNota`) sin arrastrar Prisma al navegador.
 *
 * Las reglas que sí necesitan `await prisma…` viven en
 * `lib/orales/reglas-servidor.ts`, no aquí. La separación no es cosmética:
 * si este archivo importara aunque solo fuera `prisma` para una función que
 * el cliente no usa, el bundle del navegador arrastraría igualmente `pg`,
 * que pide el módulo `dns` de Node —inexistente fuera del servidor—, y la
 * página entera se caería con un «Module not found: Can't resolve 'dns'» en
 * cuanto un componente de cliente importara algo de aquí. Se descubrió así,
 * escribiendo la tarea 8: la tarjeta de criterio dejó de compilar en cuanto
 * pidió `ajustarNota` de un archivo que también tenía `grupoDeProfesor`.
 */

/**
 * Regla 6: un sujet tiene un origen y solo uno. O una imagen subida o una
 * tarea de Recursos, nunca las dos ni ninguna.
 */
export function origenDeSujetValido(origen: {
  imagenId?: string | null;
  recursoId?: string | null;
}): string | null {
  const conImagen = Boolean(origen.imagenId);
  const conRecurso = Boolean(origen.recursoId);
  if (conImagen && conRecurso) {
    return "Un sujet sale de una imagen o de una tarea de Recursos, no de las dos.";
  }
  if (!conImagen && !conRecurso) {
    return "Falta el documento: sube una imagen o elige una tarea de Recursos.";
  }
  return null;
}

/**
 * Regla 5: la nota no puede salirse del criterio.
 *
 * Devuelve la nota ya movida, capada arriba y abajo.
 *
 * El redondeo a dos decimales no es por la coma flotante: 0,25 y 0,5 son
 * potencias de dos y se suman exactas, así que dentro de esta rejilla nunca
 * aparece un 2,7755e-17. Está por lo que entra de fuera —una nota con más
 * decimales, del archivo de la tanda 2 o de un criterio al que algún día se
 * le cambie el paso—: sale de aquí encajada en la rejilla en vez de
 * arrastrar decimales que la ficha no sabría enseñar.
 */
export function ajustarNota(
  actual: number | null,
  direccion: 1 | -1,
  maximo: number,
): number {
  const paso = pasoDe(maximo);
  const desde = actual ?? 0;
  const bruto = desde + direccion * paso;
  const dentro = Math.min(maximo, Math.max(0, bruto));
  return Math.round(dentro * 100) / 100;
}

/**
 * La misma regla, del lado del servidor: lo que llega por una acción no
 * pasó necesariamente por los botones.
 */
export function notaDentroDelCriterio(
  key: ClaveCriterio,
  valor: number,
): string | null {
  const criterio = CRITERIOS.find((c) => c.key === key);
  if (!criterio) return `«${key}» no es un criterio de esta parrilla.`;
  if (!Number.isFinite(valor)) return "Esa nota no es un número.";
  if (valor < 0) return "Una nota no puede ser negativa.";
  if (valor > criterio.maximo) {
    return `${criterio.titulo} va sobre ${fmtNota(criterio.maximo)}; ${fmtNota(valor)} se sale.`;
  }
  return null;
}

/**
 * Regla 4: el cronómetro nunca pasa de cinco minutos. El reloj del
 * navegador ya se detiene solo, pero lo que llega a la acción puede venir
 * de una pestaña dormida que despertó con un salto de reloj.
 */
export function caparTiempo(segundos: number): number {
  if (!Number.isFinite(segundos) || segundos < 0) return 0;
  return Math.min(TOPE_SEGUNDOS, segundos);
}

/**
 * Encender o apagar una frase sugerida de la tarjeta de criterio.
 *
 * Encenderla la escribe en el comentario, pero solo una vez: si el
 * profesor ya la había tecleado a mano, no se repite. Apagarla no borra
 * nada del texto —a esas alturas puede llevar retoques del profesor que la
 * frase por sí sola no explica.
 *
 * Vive aquí y no en `panel.tsx` para poder verificarla desde un script: es
 * la única regla del panel con una condición sutil (no duplicar, no
 * borrar) que merece una prueba y no solo una lectura del código.
 */
export function alternarFrase(
  activas: string[],
  texto: string,
  frase: string,
): { activas: string[]; texto: string } {
  const encendida = activas.includes(frase);
  const siguientesActivas = encendida
    ? activas.filter((f) => f !== frase)
    : [...activas, frase];
  const siguienteTexto =
    !encendida && !texto.includes(frase)
      ? texto
        ? `${texto.replace(/\s+$/, "")} · ${frase}`
        : frase
      : texto;
  return { activas: siguientesActivas, texto: siguienteTexto };
}

/**
 * Qué pasa con `preguntadas` (los índices de las preguntas de la EOI ya
 * hechas) al elegir un sujet.
 *
 * `preguntadas` es una lista de índices sin más: no dice de qué sujet son.
 * Cambiar de verdad de documento las vacía, porque si no la pregunta 2 de
 * un sujet se queda marcada en el siguiente sin tener nada que ver. Volver
 * a pulsar el sujet que ya estaba elegido no borra el progreso: no hay
 * cambio real que justifique perderlo.
 */
export function preguntadasAlElegir(
  sujetoIdActual: string | null,
  sujetoIdElegido: string,
  preguntadasActuales: number[],
): number[] {
  return sujetoIdActual === sujetoIdElegido ? preguntadasActuales : [];
}
