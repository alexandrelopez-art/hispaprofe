/**
 * Los cuatro bloques de la preparación al DELE.
 *
 * Vive aquí y no dentro de la página porque lo necesitan las dos: la portada,
 * que pinta las cuatro tarjetas, y `/dele/[bloque]`, que resuelve el
 * nombre de la URL. Duplicarlo es garantizar que se separen.
 *
 * `orden` es el campo `Recorrido.orden`: en una secuencia de preparación no
 * significa «la posición en una lista» sino a qué bloque pertenece.
 *
 * Módulo puro a propósito —ni Prisma ni nada de servidor—: así lo puede
 * importar también un componente de cliente.
 */
export type BloquePreparacion = {
  orden: number;
  /** El segmento de la URL: `/dele/practica`. */
  nombre: string;
  titulo: string;
  descripcion: string;
  /**
   * Si el alumno puede abrírselo por su cuenta. El examen blanco no: ese lo
   * asigna el profesor, y es lo que separa un ensayo de un simulacro.
   */
  autoservicio: boolean;
};

export const BLOQUES: BloquePreparacion[] = [
  {
    orden: 1,
    nombre: "estructura",
    titulo: "Estructura y estrategias",
    descripcion:
      "Cómo es el examen por dentro: cuántas pruebas, cuánto duran y qué busca el tribunal en cada una.",
    autoservicio: true,
  },
  {
    orden: 2,
    nombre: "practica",
    titulo: "Práctica por tarea",
    descripcion:
      "Propuestas reales de cada prueba, una por una, con corrección de tu profe.",
    autoservicio: true,
  },
  {
    orden: 3,
    nombre: "examen-blanco",
    titulo: "Examen blanco",
    descripcion:
      "Simulacro completo y cronometrado, seguido de una cita para repasar los resultados.",
    autoservicio: false,
  },
  {
    orden: 4,
    nombre: "tematicos",
    titulo: "Ejercicios temáticos",
    descripcion:
      "Biblioteca de ejercicios cortos clasificados por tema y categoría, para practicar suelto.",
    autoservicio: true,
  },
];

export function bloquePorNombre(nombre: string): BloquePreparacion | null {
  return BLOQUES.find((b) => b.nombre === nombre) ?? null;
}

export function bloquePorOrden(orden: number): BloquePreparacion | null {
  return BLOQUES.find((b) => b.orden === orden) ?? null;
}

/**
 * El bloque que pide el formulario de secuencia nueva.
 *
 * Cae en la práctica (2) ante cualquier cosa rara —campo ausente, texto, un
 * número que no es de ningún bloque— en vez de rechazar la ficha entera: es
 * dónde aparece en una portada, no una regla de negocio, y el profesor lo
 * cambia en dos clics si se equivoca.
 */
export function bloquePedido(valor: FormDataEntryValue | null): number {
  const n = Number(valor);
  return bloquePorOrden(n) ? n : 2;
}

/**
 * El número de examen que pide el formulario. Nulo si no lo hay o no es un
 * entero positivo: el catálogo agrupa por él, y un 0 o un -2 harían un grupo
 * «Examen 0» que no existe en ningún cuadernillo.
 */
export function examenPedido(valor: FormDataEntryValue | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}
