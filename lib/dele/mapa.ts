import type { Destreza, Nivel } from "@/lib/generated/prisma/enums";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";

/**
 * El mapa del examen: qué tareas tiene cada prueba y cómo se construye cada
 * una. Datos puros, sin base de datos: se edita a mano.
 *
 * Solo están las dos pruebas de comprensión —`CE` de lectura y `CO` de
 * auditiva—, que son las que el motor sabe corregir solo. Las de expresión
 * tienen su propio diseño.
 *
 * `verificado: false` marca lo que está deducido y no confirmado por el
 * profesor. La aplicación lo enseña en pantalla; corregir el dato y poner
 * `true` hace desaparecer el aviso.
 */
export type FormatoDele =
  | "MC"
  | "MATCH_TEXT"
  | "MATCH_PERSON"
  | "MATCH_TOPIC"
  | "GAP_INSERT"
  | "ATTRIB"
  | "CLOZE";

export type TareaDele = {
  numero: number;
  formato: FormatoDele;
  /** Con qué tipo del motor se construye. */
  motor: MarcaEjercicio;
  /**
   * Si las opciones son una lista común a todos los ítems.
   *
   * Es lo que decide entre `opcion` y `relacionar`, y no el nombre del
   * formato: cuando una misma opción vale para varios ítems —tres textos
   * para seis preguntas— hace falta la lista común de `opcion`, porque
   * `relacionar` es uno a uno y su esquema prohíbe dos derechas iguales.
   */
  listaComun: boolean;
  /** Los ítems oficiales de la tarea. */
  items: number;
  /**
   * Entre cuántas opciones elige **cada ítem**.
   *
   * Ojo, que no es lo mismo que «cuántas opciones hay en la pantalla». En
   * `MC` y en `CLOZE` cada pregunta trae sus tres propias, así que tres
   * opciones y seis preguntas son dieciocho opciones en total. En `ATTRIB` y
   * en `MATCH_PERSON` las tres son una lista común que todos comparten. En
   * los dos casos el número dice lo mismo desde el punto de vista del
   * estudiante: entre cuántas elige cada vez.
   *
   * **Los sobrantes solo existen en `relacionar`**, que es el único que
   * reparte de una lista única y uno a uno: ahí, nueve opciones para seis
   * ítems son tres que no emparejan con nada. En `opcion` la resta no
   * significa nada.
   */
  opciones: number;
  /** Lo que se enseña en pantalla al elegir la tarea. */
  pide: string;
  verificado: boolean;
};

export type PruebaDele = {
  nivel: Nivel;
  prueba: Destreza;
  duracionMinutos: number;
  tareas: TareaDele[];
};

export const PRUEBAS: PruebaDele[] = [
  // ─── B1 ──────────────────────────────────────────────────────────────
  // Verificado: viene del encargo del profesor marcado como tal.
  {
    nivel: "B1", prueba: "CE", duracionMinutos: 70,
    tareas: [
      { numero: 1, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis enunciados con seis de los nueve textos breves. Sobran tres." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas de tres opciones sobre un texto informativo." },
      { numero: 3, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas sobre tres textos: para cada una, de qué texto se habla. Un texto vale para varias." },
      { numero: 4, formato: "GAP_INSERT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 8, verificado: true,
        pide: "Insertar seis de los ocho fragmentos en los huecos del texto. Sobran dos." },
      { numero: 5, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis huecos de un texto epistolar, con tres opciones cada uno." },
    ],
  },
  {
    nivel: "B1", prueba: "CO", duracionMinutos: 40,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis monólogos cortos, una pregunta de tres opciones cada uno. Un audio por pregunta." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Un monólogo largo y seis preguntas de tres opciones." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis noticias, una pregunta de tres opciones cada una." },
      { numero: 4, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 5, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Una conversación: de cada enunciado, si lo dice A, B o ninguno." },
    ],
  },

  // ─── B2 ──────────────────────────────────────────────────────────────
  {
    nivel: "B2", prueba: "CE", duracionMinutos: 70,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas de tres opciones sobre un artículo." },
      { numero: 2, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 10, opciones: 4, verificado: true,
        pide: "Diez preguntas sobre cuatro testimonios: de quién se habla en cada una." },
      { numero: 3, formato: "GAP_INSERT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 8, verificado: true,
        pide: "Insertar seis de los ocho fragmentos en los huecos del texto. Sobran dos." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 14, opciones: 3, verificado: true,
        pide: "Catorce huecos de gramática y léxico, con tres opciones cada uno." },
    ],
  },
  {
    nivel: "B2", prueba: "CO", duracionMinutos: 40,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis conversaciones breves, una pregunta de tres opciones cada una." },
      { numero: 2, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Una conversación: de cada enunciado, si lo dice A, B o ninguno." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Una entrevista y seis preguntas de tres opciones." },
      { numero: 4, formato: "MATCH_TOPIC", motor: "relacionar", listaComun: false,
        items: 6, opciones: 10, verificado: true,
        pide: "Relacionar seis hablantes con seis de los diez temas. Sobran cuatro." },
      { numero: 5, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Un monólogo y seis preguntas de tres opciones." },
    ],
  },

  // ─── A2/B1 escolar ───────────────────────────────────────────────────
  // Contrastado contra dos exámenes oficiales distintos, los dos publicados
  // en examenes.cervantes.es: el Modelo 0 y la convocatoria de mayo de 2015.
  // Coinciden en todo, y los dos reparten los 25 ítems de la lectura igual:
  // 6, 6, 6 y 7.
  {
    nivel: "A2_B1_ESCOLAR", prueba: "CE", duracionMinutos: 50,
    tareas: [
      { numero: 1, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis enunciados con seis de los nueve textos. Sobran tres." },
      { numero: 2, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Seis preguntas sobre tres textos: de qué texto se habla en cada una." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Un texto y seis preguntas de tres opciones." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: true,
        pide: "Siete huecos con tres opciones cada uno." },
    ],
  },
  {
    nivel: "A2_B1_ESCOLAR", prueba: "CO", duracionMinutos: 30,
    tareas: [
      // Siete, no seis: "Vas a escuchar siete conversaciones… preguntas (1-7)".
      // Las cuatro primeras dan las tres opciones en dibujos y no en texto, en
      // los dos exámenes, así que es la estructura de la tarea y no una rareza
      // de uno. Hoy el motor solo sabe construir las tres últimas.
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: true,
        pide: "Siete conversaciones, una pregunta de tres opciones cada una. Las cuatro primeras responden con imágenes." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: true,
        pide: "Relacionar seis mensajes con seis de los nueve enunciados. Sobran tres." },
      { numero: 3, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: true,
        pide: "Una conversación: de cada enunciado, si lo dice ella, él o ninguno de los dos." },
      // Tres noticias y seis preguntas —dos por noticia—, no siete noticias.
      { numero: 4, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: true,
        pide: "Tres noticias de radio y seis preguntas de tres opciones: dos por noticia." },
    ],
  },

  // ─── A1, A2 y C1: DEDUCIDOS ──────────────────────────────────────────
  // El encargo los dejó como "completar". Están deducidos siguiendo el
  // patrón de los verificados y las especificaciones del Instituto
  // Cervantes, pero son deducción y no conocimiento confirmado. La
  // aplicación lo avisa en pantalla. Al corregir un dato, pon `verificado`
  // en `true` y el aviso desaparece.
  {
    nivel: "A1", prueba: "CE", duracionMinutos: 45,
    tareas: [
      { numero: 1, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 5, opciones: 8, verificado: false,
        pide: "Relacionar cinco enunciados con cinco de los ocho textos muy breves. Sobran tres." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 5, opciones: 3, verificado: false,
        pide: "Un texto sencillo y cinco preguntas de tres opciones." },
      { numero: 3, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 8, opciones: 3, verificado: false,
        pide: "Ocho preguntas sobre tres textos: de qué texto se habla en cada una." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: false,
        pide: "Siete huecos con tres opciones cada uno." },
    ],
  },
  {
    nivel: "A1", prueba: "CO", duracionMinutos: 25,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 5, opciones: 3, verificado: false,
        pide: "Cinco diálogos muy breves, una pregunta de tres opciones cada uno." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: false,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 3, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 7, opciones: 3, verificado: false,
        pide: "De cada enunciado, si lo dice A, B o ninguno." },
      { numero: 4, formato: "MC", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: false,
        pide: "Siete mensajes breves, una pregunta de tres opciones cada uno." },
    ],
  },
  {
    nivel: "A2", prueba: "CE", duracionMinutos: 60,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 5, opciones: 3, verificado: false,
        pide: "Un texto y cinco preguntas de tres opciones." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 8, opciones: 11, verificado: false,
        pide: "Relacionar ocho enunciados con ocho de los once textos. Sobran tres." },
      { numero: 3, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Un texto informativo y seis preguntas de tres opciones." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Seis huecos con tres opciones cada uno." },
    ],
  },
  {
    nivel: "A2", prueba: "CO", duracionMinutos: 40,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Seis avisos o mensajes, una pregunta de tres opciones cada uno." },
      { numero: 2, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: false,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 3, formato: "ATTRIB", motor: "opcion", listaComun: true,
        items: 6, opciones: 3, verificado: false,
        pide: "Una conversación: de cada enunciado, si lo dice A, B o ninguno." },
      { numero: 4, formato: "MC", motor: "opcion", listaComun: false,
        items: 7, opciones: 3, verificado: false,
        pide: "Un monólogo y siete preguntas de tres opciones." },
    ],
  },
  {
    nivel: "C1", prueba: "CE", duracionMinutos: 90,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Un texto largo y seis preguntas de tres opciones." },
      { numero: 2, formato: "GAP_INSERT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 8, verificado: false,
        pide: "Insertar seis de los ocho fragmentos en los huecos del texto. Sobran dos." },
      { numero: 3, formato: "MATCH_PERSON", motor: "opcion", listaComun: true,
        items: 8, opciones: 4, verificado: false,
        pide: "Ocho preguntas sobre cuatro textos: de cuál se habla en cada una." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 12, opciones: 3, verificado: false,
        pide: "Doce huecos de uso de la lengua, con tres opciones cada uno." },
      { numero: 5, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 8, opciones: 3, verificado: false,
        pide: "Ocho huecos de léxico, con tres opciones cada uno." },
    ],
  },
  {
    nivel: "C1", prueba: "CO", duracionMinutos: 50,
    tareas: [
      { numero: 1, formato: "MC", motor: "opcion", listaComun: false,
        items: 6, opciones: 3, verificado: false,
        pide: "Una conversación larga y seis preguntas de tres opciones." },
      { numero: 2, formato: "MC", motor: "opcion", listaComun: false,
        items: 8, opciones: 3, verificado: false,
        pide: "Una conferencia y ocho preguntas de tres opciones." },
      { numero: 3, formato: "MATCH_TEXT", motor: "relacionar", listaComun: false,
        items: 6, opciones: 9, verificado: false,
        pide: "Relacionar seis audios con seis de los nueve enunciados. Sobran tres." },
      { numero: 4, formato: "CLOZE", motor: "opcion", listaComun: false,
        items: 10, opciones: 3, verificado: false,
        pide: "Diez huecos sobre lo escuchado, con tres opciones cada uno." },
    ],
  },
];
