import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";

/**
 * Un sobre resuelto por motor, para meterlo dentro del encargo.
 *
 * Son **sobres enteros y no ejercicios sueltos**: lo que se le pide a la IA
 * es un sobre, así que enseñarle solo el contenido sería enseñarle otra cosa
 * distinta de la que tiene que devolver.
 *
 * Salen del examen ya sembrado —A2/B1 escolar, mayo de 2015— recortados a
 * dos ítems. Recortados y no inventados a propósito: un ejemplo con la voz
 * del examen de verdad le enseña a la IA el registro además del formato.
 *
 * `scripts/verificar-pegado.ts` comprueba que cada uno pasa el esquema de su
 * motor. Es la comprobación que impide que un ejemplo roto enseñe a devolver
 * basura sin que nada avise.
 */
export const EJEMPLOS: Record<MarcaEjercicio, unknown> = {
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
