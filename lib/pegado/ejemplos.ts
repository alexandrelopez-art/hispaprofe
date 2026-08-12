import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";

/**
 * Un sobre resuelto por motor, para meterlo dentro del encargo.
 *
 * Son **sobres enteros y no ejercicios sueltos**: lo que se le pide a la IA
 * es un sobre, así que enseñarle solo el contenido sería enseñarle otra cosa
 * distinta de la que tiene que devolver.
 *
 * Salen del examen ya sembrado —A2/B1 escolar, mayo de 2015— recortados a dos
 * o tres ítems, los que hagan falta para que se vea la forma. Recortados y no
 * inventados a propósito: un ejemplo con la voz del examen de verdad le enseña
 * a la IA el registro además del formato.
 *
 * Ese número no es el que se le pide: el encargo dice expresamente que la
 * cuenta de ítems no sale del ejemplo, porque en un paso libre —sin tarea del
 * mapa, sin sección de números— el ejemplo sería el único número a la vista.
 *
 * **Seis ejemplos para cuatro motores.** `opcion` tiene tres formas que el
 * encargo distingue —cada pregunta con sus propias `opciones`; una lista
 * común en `opcionesComunes` que varias preguntas comparten; o un pasaje en
 * `texto` con sus marcas `{{n}}`, el cloze—, y el encargo de cada una dice
 * explícitamente lo que la otra forma no cumple: una tarea con lista común
 * (`MATCH_PERSON`, `ATTRIB`) exige que «ninguna pregunta lleve su propio
 * `opciones`»; un cloze exige que «el pasaje va en `texto` y no en `bloque`».
 * Enseñar ahí el ejemplo de otra forma es peor que no enseñar ninguno:
 * contradice la regla que el propio documento acaba de dar, y una IA que
 * copie el ejemplo en vez de leer la regla comete justo «el error caro» de
 * este proyecto. Por eso hay un `opcionListaComun` y un `opcionCloze` además
 * de `opcion`.
 *
 * `scripts/verificar-pegado.ts` comprueba que cada uno pasa el esquema de su
 * motor. Es la comprobación que impide que un ejemplo roto enseñe a devolver
 * basura sin que nada avise.
 */
export const EJEMPLOS: Record<MarcaEjercicio | "opcionListaComun" | "opcionCloze", unknown> = {
  relacionar: {
    bloque:
      "## Tablón de anuncios\n\n" +
      "**A. MUSICALDÍA.** Si sois un grupo de música y buscáis un buen espacio para practicar, el centro cultural Musicaldía os ofrece varias salas con instrumentos.\n\n" +
      "**C. CREA TU BLOG.** Os enseñamos a crear un blog digital de forma fácil y gratuita. Días: 6 y 13 de octubre. Para jóvenes de 12 a 18 años.\n\n" +
      "**F. AYUNTAMIENTO. ÁREA DE DEPORTES.** ¿Te gustaría moverte en bici por la ciudad pero no tienes una? Tenemos la bici que buscas por solo 5 euros al mes.",
    ejercicio: {
      ejercicio: "relacionar",
      consigna:
        "Relaciona a cada joven con el anuncio que le interesa. Hay más anuncios que jóvenes.",
      parejas: [
        {
          id: "1",
          izquierda: "MARCOS: «Toco la guitarra y con mi banda no tenemos dónde ensayar.»",
          derecha: "A. MUSICALDÍA",
        },
        {
          id: "2",
          izquierda: "LUCÍA: «Voy al instituto andando y tardo mucho. Necesito una bici barata.»",
          derecha: "F. AYUNTAMIENTO. ÁREA DE DEPORTES",
        },
      ],
      sobrantes: ["C. CREA TU BLOG"],
    },
  },

  opcion: {
    bloque:
      "## Estudiar Medicina después de otra carrera\n\n" +
      "Cada año, decenas de licenciados deciden empezar Medicina cuando ya han terminado otros estudios. La mayoría son biólogos o químicos, y casi todos coinciden en que la decisión les llegó tarde pero clara.",
    ejercicio: {
      ejercicio: "opcion",
      consigna: "Lee el texto y elige la opción correcta.",
      multiple: false,
      presentacion: "botones",
      preguntas: [
        {
          id: "1",
          enunciado: "Según el texto, quienes empiezan Medicina más tarde…",
          opciones: [
            "ya han estudiado otra carrera.",
            "no terminaron sus estudios anteriores.",
            "estudian a la vez las dos carreras.",
          ],
          correctas: [0],
        },
        {
          id: "2",
          enunciado: "La mayoría de ellos vienen de…",
          opciones: ["Derecho o Economía.", "Biología o Química.", "Bellas Artes."],
          correctas: [1],
        },
      ],
    },
  },

  /**
   * `opcion` con lista común: tres personas breves y tres preguntas que
   * reparten entre ellas, con una persona que contesta a dos. Es lo que
   * distingue este formato de `relacionar`: aquí una misma opción puede
   * justificar más de un ítem, así que no hace falta —ni se permite— que
   * cada pregunta traiga sus propias `opciones`.
   */
  opcionListaComun: {
    bloque:
      "## Tres aficiones\n\n" +
      "**A. CARLA.** Empecé a hacer punto por pura casualidad, viendo tejer a mi abuela un verano, y ya no lo he dejado: tejo cada tarde al volver del trabajo.\n\n" +
      "**B. DIEGO.** Colecciono sellos desde que tenía diez años. No compro ninguno entre semana, solo cuando encuentro alguno especial en una feria de fin de semana.\n\n" +
      "**C. SOFÍA.** Toco la guitarra en un grupo de versiones. Empezamos hace dos años y ya hemos tocado en tres bares del barrio.",
    ejercicio: {
      ejercicio: "opcion",
      consigna: "Lee los tres textos y decide de quién se habla en cada pregunta.",
      multiple: false,
      presentacion: "botones",
      opcionesComunes: ["A. CARLA", "B. DIEGO", "C. SOFÍA"],
      preguntas: [
        {
          id: "1",
          enunciado: "¿Quién empezó su afición por casualidad?",
          correctas: [0],
        },
        {
          id: "2",
          enunciado: "¿Quién practica su afición todos los días?",
          correctas: [0],
        },
        {
          id: "3",
          enunciado: "¿Quién forma parte de un grupo?",
          correctas: [2],
        },
      ],
    },
  },

  /**
   * `opcion` con el pasaje de un cloze: el mismo extracto de la Tarea 4 del
   * A2/B1 escolar (mayo de 2015, ver `scripts/sembrar-dele-a2b1-lectura.ts`)
   * que dio los otros cinco ejemplos, recortado a tres huecos y renumerado
   * desde `{{1}}` en vez de sus marcas reales `{{19}}`…`{{21}}` — lo que se
   * enseña es la forma, no en qué tarea iba.
   *
   * Sin `bloque` y con el pasaje dentro de `ejercicio`, en `texto`: es
   * justo lo que pide `REGLAS_CLOZE` dos secciones más arriba del encargo, y
   * lo que ni `opcion` ni `opcionListaComun` pueden enseñar aquí sin
   * contradecirla. Si un cloze enseñara cualquiera de esos dos, la IA
   * copiaría un `bloque` con el pasaje suelto y unas `preguntas` sin `texto`
   * — un ejercicio válido donde cada hueco pierde la frase en la que está,
   * que es lo único que se estaba preguntando.
   */
  opcionCloze: {
    ejercicio: {
      ejercicio: "opcion",
      consigna: "Lee el texto y rellena los huecos con la opción correcta.",
      multiple: false,
      presentacion: "desplegable",
      texto:
        "Buscamos nuevos talentos\n\n" +
        "Nunca {{1}} sabe dónde puede estar el próximo Juan Antonio Bayona. O el próximo Norman Foster, o David Delfín o Banksy… Si te gusta escribir, si tu {{2}} libre lo dedicas a diseñar, a componer canciones o cualquier forma de creación artística, este puede ser tu momento. No importa de dónde eres: {{3}} interesa descubrir tu talento y compartir tus creaciones.",
      preguntas: [
        { id: "1", enunciado: "1.", opciones: ["me", "se", "le"], correctas: [1] },
        { id: "2", enunciado: "2.", opciones: ["momento", "tiempo", "ocio"], correctas: [1] },
        { id: "3", enunciado: "3.", opciones: ["nos", "si", "se"], correctas: [0] },
      ],
    },
  },

  huecos: {
    ejercicio: {
      ejercicio: "huecos",
      consigna: "Completa el texto con la forma que falta.",
      texto:
        "Ayer {{1}} al cine con mi hermana y la película nos {{2}} muchísimo.",
      huecos: [
        { id: "1", acepta: ["fui", "fuimos"] },
        { id: "2", acepta: ["gustó"] },
      ],
    },
  },

  ordenar: {
    ejercicio: {
      ejercicio: "ordenar",
      consigna: "Ordena las frases para reconstruir el diálogo.",
      piezas: [
        { id: "1", texto: "Buenos días, ¿en qué puedo ayudarle?" },
        { id: "2", texto: "Quería información sobre los cursos de verano." },
        { id: "3", texto: "Claro. ¿Para qué nivel?" },
      ],
    },
  },
};
