/**
 * Los cinco criterios del oral de Terminale del liceo Saint-Jean de Passy.
 *
 * No son tabla de la base a propósito: son del examen del liceo francés, no
 * de HispaProfe. Meterlos en la base obligaría a mantener una pantalla para
 * editarlos que nadie va a usar. Otro colegio con otra parrilla es otro
 * trabajo, y el sitio donde tocar sería este archivo.
 *
 * `color` es un token de app/globals.css. La traducción desde los pasteles
 * del HTML original está en el diseño: lavender→bloque1, teal→bloque2,
 * amber→bloque4, indigo→hp-400, mint→verde-500.
 */
export type ClaveCriterio =
  | "lengua"
  | "fluidez"
  | "contenido"
  | "organizacion"
  | "oratoria";

export type Criterio = {
  key: ClaveCriterio;
  romano: string;
  titulo: string;
  descripcion: string;
  maximo: number;
  color: string;
  frases: string[];
};

export const CRITERIOS: Criterio[] = [
  {
    key: "lengua",
    romano: "I.",
    titulo: "Corrección de la lengua",
    descripcion: "Corrección gramatical, riqueza del vocabulario.",
    maximo: 4,
    color: "bloque1",
    frases: [
      "Léxico variado y preciso",
      "Estructuras complejas bien manejadas",
      "Errores menores que no impiden la comprensión",
      "Errores recurrentes en concordancia",
      "Léxico limitado / repetitivo",
      "Confusión ser/estar",
      "Buen uso del subjuntivo",
      "Falsos amigos del francés",
    ],
  },
  {
    key: "fluidez",
    romano: "II.",
    titulo: "Pronunciación y fluidez",
    descripcion:
      "Pronunciación clara, entonación adecuada, fluidez sin pausas excesivas.",
    maximo: 2,
    color: "bloque2",
    frases: [
      "Pronunciación clara y comprensible",
      "Buena entonación",
      "Fluidez natural",
      "Algunas pausas, pero coherentes",
      "Pausas excesivas",
      "Acento francófono marcado",
      "Bloqueos frecuentes",
      "Buen ritmo discursivo",
    ],
  },
  {
    key: "contenido",
    romano: "III.",
    titulo: "Contenido",
    descripcion: "Pertinencia y calidad de los argumentos presentados.",
    maximo: 5,
    color: "bloque4",
    frases: [
      "Análisis pertinente y profundo",
      "Buen aprovechamiento del documento",
      "Conocimientos culturales sólidos",
      "Argumentos pertinentes",
      "Análisis superficial",
      "Falta de problemática clara",
      "Lectura descriptiva sin interpretación",
      "Vincula con el eje de manera convincente",
      "Aporta ejemplos personales relevantes",
    ],
  },
  {
    key: "organizacion",
    romano: "IV.",
    titulo: "Organización de las ideas",
    descripcion:
      "Introducción breve, desarrollo estructurado con conectores, conclusión + apertura.",
    maximo: 5,
    color: "hp-400",
    frases: [
      "Plan claro: intro / desarrollo / conclusión",
      "Buen uso de conectores lógicos",
      "Apertura pertinente y original",
      "Transiciones fluidas entre partes",
      "Falta problemática en la introducción",
      "Conclusión sin apertura",
      "Estructura difusa",
      "Sigue el plan anunciado",
    ],
  },
  {
    key: "oratoria",
    romano: "V.",
    titulo: "Cualidades oratorias",
    descripcion:
      "Gestualidad, contacto visual, convicción, recursos retóricos, seguridad al hablar.",
    maximo: 4,
    color: "verde-500",
    frases: [
      "Buen contacto visual",
      "Habla con convicción",
      "Lectura excesiva de notas",
      "Gestualidad apropiada",
      "Tono monótono",
      "Seguridad al hablar",
      "Empleo de recursos retóricos",
      "Postura nerviosa",
    ],
  },
];

/** El tope de cada cronómetro, en segundos. Cinco minutos. */
export const TOPE_SEGUNDOS = 300;
