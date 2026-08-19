/**
 * Los cuatro bloques de la preparación al DELE.
 *
 * Vive aquí y no dentro de la página porque lo necesitan las dos: la portada,
 * que pinta las cuatro tarjetas, y `/preparacion/[bloque]`, que resuelve el
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
  /** El segmento de la URL: `/preparacion/practica`. */
  nombre: string;
  titulo: string;
  descripcion: string;
  /** Clase de color del círculo. */
  acento: string;
  /** Clase del borde al pasar por encima. */
  borde: string;
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
    acento: "bg-bloque1",
    borde: "hover:border-bloque1",
    autoservicio: true,
  },
  {
    orden: 2,
    nombre: "practica",
    titulo: "Práctica por tarea",
    descripcion:
      "Propuestas reales de cada prueba, una por una, con corrección de tu profe.",
    acento: "bg-bloque2",
    borde: "hover:border-bloque2",
    autoservicio: true,
  },
  {
    orden: 3,
    nombre: "examen-blanco",
    titulo: "Examen blanco",
    descripcion:
      "Simulacro completo y cronometrado, seguido de una cita para repasar los resultados.",
    acento: "bg-bloque3",
    borde: "hover:border-bloque3",
    autoservicio: false,
  },
  {
    orden: 4,
    nombre: "tematicos",
    titulo: "Ejercicios temáticos",
    descripcion:
      "Biblioteca de ejercicios cortos clasificados por tema y categoría, para practicar suelto.",
    acento: "bg-bloque4",
    borde: "hover:border-bloque4",
    autoservicio: true,
  },
];

export function bloquePorNombre(nombre: string): BloquePreparacion | null {
  return BLOQUES.find((b) => b.nombre === nombre) ?? null;
}

export function bloquePorOrden(orden: number): BloquePreparacion | null {
  return BLOQUES.find((b) => b.orden === orden) ?? null;
}
