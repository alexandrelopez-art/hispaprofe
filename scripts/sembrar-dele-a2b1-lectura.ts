/**
 * Siembra la prueba de Comprensión de lectura del DELE A2/B1 para escolares,
 * convocatoria de mayo de 2015.
 *
 * El contenido es el del examen oficial publicado en examenes.cervantes.es
 * (`a2b1_cl_t1..t4.pdf`), y las respuestas correctas son las de su clave
 * (`a2b1_cl_claves.pdf`): F A D C B E · C C B A C A · C B C C A C · B B A C A C C.
 *
 * Se siembra este examen y no el Modelo 0 porque es el que tiene audios
 * publicados, y así las dos pruebas de comprensión salen del mismo examen.
 *
 * Idempotente: borra su versión anterior antes de crear la nueva.
 * Ejecutar con:  npx tsx scripts/sembrar-dele-a2b1-lectura.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { TIPO_DE_EJERCICIO } from "@/lib/recursos";
import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import { analizar, corregir, versionPublica } from "@/lib/ejercicios/registro";
import type { Respuestas } from "@/lib/ejercicios/tipos";
import { opcionSchema } from "@/lib/ejercicios/opcion";
import { relacionarSchema } from "@/lib/ejercicios/relacionar";

const TITULO = "A2/B1 escolar · Comprensión de lectura (mayo 2015)";
const CORREO_PROFE = "a.lopez.ele@hotmail.com";
const CORREO_ALUMNO = "gaspard@hotmail.com";
const NIVEL = "A2_B1_ESCOLAR" as const;

/**
 * Una tarea del examen: el estímulo que se lee y el ejercicio que se hace.
 *
 * El título es «Tarea N» a propósito y no algo más descriptivo: `numeroDeTarea`
 * lo lee de ahí para saber de qué tarea del mapa se trata, y el orden del paso
 * solo manda cuando el título no dice nada.
 */
const TAREAS = [
  // ─── Tarea 1 ────────────────────────────────────────────────────────
  // MATCH_TEXT: seis jóvenes y nueve anuncios, sobran tres.
  //
  // El anuncio I es el del ejemplo (Susan), así que se queda en el tablón
  // pero fuera de las opciones: seis parejas más tres sobrantes son nueve,
  // que es lo que dice el mapa.
  {
    titulo: "Tarea 1",
    tipoPaso: "ACTIVIDAD" as const,
    bloque: `## Tablón de anuncios

**A. MUSICALDÍA.** Si sois un grupo de música y estáis buscando un buen espacio para practicar con la banda, el centro cultural Musicaldía está pensado para vosotros. Musicaldía os ofrece varias salas con instrumentos y un pequeño estudio de grabación. Información: www.musicaldia.org

**B. ASOCIACIÓN AMIGOS DEL CARNAVAL.** Somos un grupo de jóvenes que organiza cursos gratuitos para diseñar disfraces de carnaval. Para hacer tus disfraces, puedes traer la ropa vieja que ya no usas. Nos reunimos los sábados a las 12 h en la asociación Zigzag. Si quieres participar, entra en www.zigzags.org para informarte y para ver las fotografías de nuestros diseños.

**C. CREA TU BLOG.** Os enseñamos a crear un blog digital de forma fácil y gratuita. Días: 6 y 13 de octubre. Horario: de 17 h a 18.30 h. Inscripciones desde el 2 de octubre. Plazas limitadas. Para jóvenes de 12 a 18 años. Más información: Infojoven, Edificio La Gota de Leche, c/ Once de Junio, n.º 2.

**D. EL JUEGO DEL TÓTEM, UNA AVENTURA INTERACTIVA.** Una oportunidad para descubrir y aprender más sobre las culturas precolombinas (Incas, Mayas y Aztecas). El juego tiene diez niveles. Para resolver las dudas, se puede consultar Internet, enciclopedias, etc. Forma de participar: equipos de 5 personas (de 12 a 15 años). Información: www.lojoven.es

**E. SI ERES EL MEJOR, TE ESTAMOS ESPERANDO.** Hemos creado un blog para jóvenes artistas de nuestra ciudad. Buscamos chicos y chicas de 14 a 17 años que quieran enviarnos sus creaciones. Si queréis tener más información, podéis entrar en www.fundaciongsr.es. Si queréis ver las obras recibidas, nuestro enlace es: http://artistas.blogjovenes.com

**F. AYUNTAMIENTO. ÁREA DE DEPORTES.** ¿Te gustaría moverte en bici por la ciudad pero no tienes una? Si no quieres comprártela, infórmate en la oficina de la Juventud del Ayuntamiento o en la página web www.prestamobici.org. Tenemos la bici que estás buscando por solo 5 euros al mes.

**G. LOS ROCKEROS.** Somos un grupo de chicos que necesita encontrar urgentemente un guitarrista porque es el único músico que no tenemos en la banda. Si estás interesado en tocar con nosotros, puedes encontrarnos de 17 h a 20 h en el centro juvenil de la calle Joaquín Achúcarro, n.º 2-2.º

**H. ACCIÓN SÚBITA.** Buscamos artistas jóvenes de todo tipo (pintura, escultura, fotografía, instalaciones, happenings…) que estén empezando. Tenemos un bar-galería en el que exponemos a gente que se quiere dar a conocer. Más información en: exposiciones@accionsubita.com

**I. CLUB TÁNDEM.** ¿Tienes problemas con los idiomas? Puedes solucionarlos en la cafetería Babel. Cada tarde, de 18.00 a 20.00 h puedes practicar el idioma que desees con estudiantes nativos (inglés, francés, alemán, italiano, ruso y español). Solo tienes que enviar un correo electrónico a babeltandem@hotmail.com y hacer la reserva para organizar los grupos.

**J. LIMPÍSIMA.** Si quieres lavar tu ropa rápido y barato, utiliza las lavanderías Limpísima. Tenemos los precios más baratos y la mayor red de lavanderías de la ciudad. Autoservicio. Para más información, consulta nuestra página web: www.limpisima.com

---

**Ejemplo. SUSAN** — «Soy inglesa y este es mi primer año en el Instituto. Busco compañeros para formar un grupo de estudio y mejorar mi español. Puedo ayudar con el inglés.» La opción correcta es **I. CLUB TÁNDEM**.`,
    esquema: relacionarSchema,
    datos: {
      ejercicio: "relacionar",
      consigna:
        "Vas a leer seis textos en los que unos jóvenes dicen lo que necesitan y diez anuncios del tablón de su instituto. Relaciona a cada joven con su anuncio. HAY TRES ANUNCIOS QUE NO DEBES RELACIONAR.",
      parejas: [
        {
          id: "1",
          izquierda:
            "1. MARÍA — Necesito dos bicicletas de niño no demasiado grandes para poder llevarlas fácilmente en el metro. Me gustaría encontrar un lugar donde alquilarlas por un precio razonable.",
          derecha: "F. AYUNTAMIENTO. ÁREA DE DEPORTES",
        },
        {
          id: "2",
          izquierda:
            "2. ÁLVARO — Buscamos un lugar especializado donde poder tocar, tener la posibilidad de crear nuestro propio disco y dar algún mini-concierto.",
          derecha: "A. MUSICALDÍA",
        },
        {
          id: "3",
          izquierda:
            "3. YOLANDA — Tengo 14 años y me encanta la historia antigua. Estoy interesada en formar parte de algún grupo para participar en concursos, cursos o programas especiales.",
          derecha: "D. EL JUEGO DEL TÓTEM",
        },
        {
          id: "4",
          izquierda:
            "4. DAVID — Soy un chico de 14 años y quiero hacer un curso relacionado con las nuevas tecnologías. Tiene que ser un curso barato y de tarde, para hacerlo después de las clases.",
          derecha: "C. CREA TU BLOG",
        },
        {
          id: "5",
          izquierda:
            "5. SARA — El mes que viene tengo que ir a una fiesta medieval y no sé qué ponerme. Me gustaría diseñar y hacer mi propio vestido, pero no sé cómo hacerlo ni quién me podría ayudar.",
          derecha: "B. ASOCIACIÓN AMIGOS DEL CARNAVAL",
        },
        {
          id: "6",
          izquierda:
            "6. ANTONIO — Me llamo Andrés y tengo 15 años. Me gustaría conocer alguna página web o algún blog para enseñar mis pinturas y fotografías y conocer a otros aficionados al mundo del arte como yo.",
          derecha: "E. SI ERES EL MEJOR, TE ESTAMOS ESPERANDO",
        },
      ],
      sobrantes: ["G. LOS ROCKEROS", "H. ACCIÓN SÚBITA", "J. LIMPÍSIMA"],
    },
  },

  // ─── Tarea 2 ────────────────────────────────────────────────────────
  // MATCH_PERSON: seis preguntas sobre tres textos. La clave repite —C, C,
  // B, A, C, A—, así que va con lista común de `opcion` y no con
  // `relacionar`, que es uno a uno y prohibiría que Clara conteste tres.
  {
    titulo: "Tarea 2",
    tipoPaso: "ACTIVIDAD" as const,
    bloque: `## Estudiar Medicina después de otra carrera

### A. ADELA

Siempre quise ser médico. Sin embargo, en el último año de Secundaria suspendí Matemáticas, porque no estudiaba nada, y me olvidé de la idea. Aconsejada por mis profesores, empecé la carrera de Filosofía. Es una carrera bonita, pero todavía tengo la ilusión de hacer Medicina. Me parece que no puedo realizar mi sueño porque no trabajé en su momento.

No puedo dejar Filosofía y empezar Medicina porque hay que pasar una prueba muy difícil y porque mis padres dicen que no debo cambiar ahora de carrera. Estoy pensando en estudiar mientras tanto, a distancia, otra carrera más relacionada con la ciencia para poder pasar la prueba de entrada en Medicina. O puedo olvidarme de esto y seguir con Filosofía. Gracias por vuestros consejos.

### B. BEATRIZ

Mejor que darte un consejo, te voy a contar mi experiencia. Yo tengo la ilusión de ser médico desde niña, pero por distintas razones hice la carrera de Derecho. Obtuve buenas notas, hice un máster, conseguí trabajo… y este año me volvió la idea de la Medicina. ¿Y por qué no? Ahora tengo dinero y tiempo para hacerlo. Me presenté a las pruebas de una universidad privada… y empiezo en septiembre. Voy a trabajar a media jornada y con horario libre, así que espero poder hacerlo todo.

¿Por qué lo hago si ya tengo la vida organizada, estoy casada, tengo niños y un trabajo estable? Porque los sueños que tenemos de pequeños nunca se van del todo, y hay que hacer algo con ellos.

### C. CLARA

Yo estoy en un caso parecido al tuyo. Estudié la carrera de Magisterio para enseñar Lengua y Literatura, pero siempre me gustó el ámbito de la salud porque cuidas de la gente, y me parece muy bonito. Cuando iba a empezar el último año de carrera, decidí dejarlo todo y estudiar Enfermería, aunque a mis padres no les pareció bien la idea. Luego hice otros cursos relacionados con la salud y este año me presenté a las pruebas para hacer Medicina. No he obtenido plaza, pero estoy en lista de espera y sé que, si no es este año, voy a hacerlo el próximo. Mucha gente empieza Medicina cuando ya tienen otro título. Cuando tienes ilusión, todo es posible.

*(Adaptado de casimedicos.com)*`,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna:
        "Relaciona cada pregunta con el texto correspondiente. La misma persona puede ser la respuesta de varias preguntas.",
      multiple: false,
      opcionesComunes: ["A. ADELA", "B. BEATRIZ", "C. CLARA"],
      preguntas: [
        { id: "7", enunciado: "7. ¿Quién dejó una carrera para empezar otra?", correctas: [2] },
        {
          id: "8",
          enunciado:
            "8. ¿Quién piensa que hay muchas personas que hacen Medicina después de terminar otra carrera?",
          correctas: [2],
        },
        { id: "9", enunciado: "9. ¿Quién va a trabajar y estudiar a la vez?", correctas: [1] },
        {
          id: "10",
          enunciado:
            "10. ¿Quién piensa que su carrera se decidió por no estudiar suficiente en el colegio?",
          correctas: [0],
        },
        {
          id: "11",
          enunciado: "11. ¿A quién le gusta Medicina porque se puede ayudar a otras personas?",
          correctas: [2],
        },
        {
          id: "12",
          enunciado:
            "12. ¿Quién tiene familiares que piensan que debe terminar lo que está haciendo?",
          correctas: [0],
        },
      ],
    },
  },

  // ─── Tarea 3 ────────────────────────────────────────────────────────
  // MC: un texto y seis preguntas, cada una con sus tres opciones.
  {
    titulo: "Tarea 3",
    tipoPaso: "ACTIVIDAD" as const,
    bloque: `## Plácido Domingo

Plácido Domingo es uno de los más destacados cantantes de ópera del siglo XX. Nació en Madrid en 1941, pero a los pocos años se trasladó con su familia a Latinoamérica, donde sus padres, cantantes de un género musical español llamado "zarzuela", tenían que actuar con la compañía de Moreno Torroba. Finalizada la gira, en 1950 decidieron quedarse en México, donde se formaría el futuro tenor.

El pequeño Plácido asistía a las funciones en que actuaban sus padres, por lo que el mundo de la música pronto se le hizo familiar. Cuando todavía estaba en la escuela primaria, empezó a estudiar música e interpretó papeles de niño en algunas obras. De joven, aunque su voz todavía no estaba formada, comenzó a cantar zarzuelas.

Su carácter inquieto le llevó, en los años siguientes, de una actividad a otra: fue jugador de fútbol, quiso ser torero, participó en comedias musicales, acompañó a cantantes en salas de fiestas y recibió alguna oferta para hacer cine. Su amigo Manuel Aguilar le sugirió que podía probar en la ópera, y, aunque pensaba que no tenía voz para ello, Plácido aprendió varios temas y se presentó a una prueba en la Academia de la Ópera de México.

Tras continuar su formación en la escuela de música de la capital mexicana, su debut como protagonista llegaría en 1961 en La Traviata. Después, el pianista mexicano José Cahan le informó de que en el Teatro de la Ópera de Tel Aviv necesitaban cantantes. Plácido habló con su mujer, Marta Ornella, también cantante, y juntos marcharon a Israel el 21 de diciembre de 1962. Aunque el contrato era por seis meses, permanecieron allí dos años y medio. El tenor participó en 280 funciones y allí empezó a interpretar los papeles que luego mantendría para siempre. Su esposa, Marta, intervino en 150 representaciones, pero luego abandonó la profesión para acompañar a Plácido en la carrera que le llevaría a los principales teatros del mundo.

Desde entonces Plácido Domingo no ha dejado de recorrer las óperas de todas las capitales. Considerado como uno de los grandes tenores de su generación, ha interpretado más de ochenta y cinco personajes operísticos diferentes. El tenor español da gran realismo a sus interpretaciones y su voz posee gran belleza y color. El director de óperas Franco Zeffirelli dijo de él que «es un equilibrado actor que canta». Ha destacado en los grandes papeles de la ópera francesa e italiana, cantó con especial fortuna los dramas de Wagner y ha estrenado numerosas óperas nuevas.

Junto con Luciano Pavarotti y José Carreras, actuó en numerosas ocasiones en macroconciertos bajo el nombre de «los tres tenores». Desde 1973, y cada vez con mayor frecuencia, se dedica también a la dirección de orquesta. Su formación musical es muy completa, y es maestro en todo lo relacionado con la música: asesora teatros, organiza grandes eventos, canta géneros ligeros, ha protagonizado la versión para el cine de algunas óperas y en 1992 cantó en la inauguración de los Juegos Olímpicos de Barcelona.

*(Texto adaptado de biografiasyvidas.com)*`,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "Lee el texto y selecciona la respuesta correcta.",
      multiple: false,
      preguntas: [
        {
          id: "13",
          enunciado: "13. Según el texto, la familia de Plácido Domingo…",
          opciones: ["procedía de Latinoamérica.", "se trasladó a Madrid.", "se instaló en México."],
          correctas: [2],
        },
        {
          id: "14",
          enunciado: "14. En el texto se dice que Plácido Domingo…",
          opciones: [
            "actuaba en el teatro con sus padres cuando era un niño.",
            "recibió educación musical desde que era pequeño.",
            "de joven cantaba sin la formación musical adecuada.",
          ],
          correctas: [1],
        },
        {
          id: "15",
          enunciado: "15. Antes de dedicarse a la ópera, Plácido Domingo…",
          opciones: [
            "ya sabía que acabaría siendo cantante.",
            "hizo muchas pruebas para encontrar trabajo.",
            "probó a trabajar en diferentes profesiones.",
          ],
          correctas: [2],
        },
        {
          id: "16",
          enunciado: "16. En el texto se dice que Plácido Domingo y su mujer…",
          opciones: [
            "se separaron por la carrera de Plácido.",
            "se casaron cuando estaban en Tel Aviv.",
            "se dedicaban a la misma profesión.",
          ],
          correctas: [2],
        },
        {
          id: "17",
          enunciado: "17. Profesionalmente, Plácido Domingo…",
          opciones: [
            "es valorado como actor además de cantante.",
            "prefiere cambiar de sitio y obra frecuentemente.",
            "se ha especializado en un número limitado de óperas.",
          ],
          correctas: [0],
        },
        {
          id: "18",
          enunciado: "18. Según el texto, en la actualidad Plácido Domingo…",
          opciones: [
            "ha decidido retirarse definitivamente de la ópera.",
            "da cursos especializados a cantantes jóvenes.",
            "tiene ocupaciones relacionadas con la música.",
          ],
          correctas: [2],
        },
      ],
    },
  },

  // ─── Tarea 4 ────────────────────────────────────────────────────────
  // CLOZE: siete huecos con tres opciones. Va con `opcion` y no con
  // `huecos` porque no se escribe la palabra, se elige entre tres; y en
  // desplegable para que siete filas de botones no sean un muro.
  //
  // Los huecos se marcan {{19}}…{{25}} y el pasaje va en el ejercicio, no en
  // un bloque: así el desplegable se pinta dentro del texto, en su sitio, y
  // el ejercicio es autónomo — se puede reutilizar en otra secuencia sin
  // arrastrar un bloque suelto que hay que acordarse de copiar.
  {
    titulo: "Tarea 4",
    tipoPaso: "ACTIVIDAD" as const,
    bloque: undefined,
    esquema: opcionSchema,
    datos: {
      ejercicio: "opcion",
      consigna: "Lee el texto y rellena los huecos con la opción correcta.",
      multiple: false,
      presentacion: "desplegable",
      texto: `Nunca {{19}} sabe dónde puede estar el próximo Juan Antonio Bayona. O el próximo Norman Foster, o David Delfín o Banksy… Si te gusta escribir, si tu {{20}} libre lo dedicas a diseñar, a componer canciones o cualquier forma de creación artística, este puede ser tu momento. No importa de dónde eres: {{21}} interesa descubrir tu talento y compartir tus creaciones. Porque muchas veces, las formas de creatividad están escondidas y es lo que buscamos {{22}} en nuestro concurso «Se busca talento».

Queremos conocer a esos creadores, de cualquier disciplina, que tienen algo nuevo que {{23}} al mundo. Puede {{24}} un poema, una película corta, una canción, una fotografía… Cualquier muestra, de cualquier arte, será bienvenida. Buscamos creadores de literatura, cine, vídeos, música, arquitectura, pintura, moda, ilustración.

Esta es la segunda edición de un concurso que empezó {{25}} doce meses. Ahora tú también puedes ser uno de ellos. Solo tienes que enviarnos una breve biografía tuya y tu muestra de talento por correo electrónico (talentos@lavida.es). Nosotros la valoraremos y, durante el verano, escogeremos las más interesantes, que tendrán su reflejo en la edición digital de EL PAÍS. Porque, quién sabe, quizá tu talento es uno de los que estamos buscando.`,
      preguntas: [
        { id: "19", enunciado: "19.", opciones: ["me", "se", "le"], correctas: [1] },
        { id: "20", enunciado: "20.", opciones: ["momento", "tiempo", "ocio"], correctas: [1] },
        { id: "21", enunciado: "21.", opciones: ["nos", "si", "se"], correctas: [0] },
        { id: "22", enunciado: "22.", opciones: ["cambiar", "repartir", "encontrar"], correctas: [2] },
        { id: "23", enunciado: "23.", opciones: ["llevar", "contar", "producir"], correctas: [0] },
        { id: "24", enunciado: "24.", opciones: ["estar", "haber", "ser"], correctas: [2] },
        { id: "25", enunciado: "25.", opciones: ["por", "desde hace", "hace"], correctas: [2] },
      ],
    },
  },
];

/**
 * Los ítems de una tarea: parejas si es de relacionar, preguntas si no.
 *
 * Va aparte y no en línea con un `"parejas" in datos` porque TypeScript
 * infiere para la lista de arriba un solo tipo con las dos propiedades
 * opcionales, y ahí el `in` no estrecha nada.
 */
function itemsDe(datos: { parejas?: unknown[]; preguntas?: unknown[] }): number {
  return datos.parejas?.length ?? datos.preguntas?.length ?? 0;
}

/**
 * La clave de respuestas tal y como la imprime el Cervantes en
 * `a2b1_cl_claves.pdf`, copiada letra a letra.
 *
 * Está escrita por segunda vez a propósito: arriba las respuestas correctas
 * viven como índices (`correctas: [2]`) y como texto de la derecha, y aquí
 * como la letra del examen. Son veinticinco ítems tecleados a mano, y una
 * tilde de más en un texto o un índice corrido una posición no se ven
 * leyendo. Si las dos transcripciones no coinciden, `comprobarLaClave`
 * falla y dice en qué ítem.
 *
 * No es circular: lo que se compara son dos copias independientes del mismo
 * papel, no el examen consigo mismo.
 */
const CLAVE = "F A D C B E · C C B A C A · C B C C A C · B B A C A C C"
  .split("·")
  .map((tramo) => tramo.trim().split(/\s+/));

/**
 * Contesta el examen recién sembrado con la clave oficial y comprueba que
 * saca el máximo.
 *
 * Para `relacionar` hay que pasar por la versión pública: la clave de cada
 * opción es opaca y se reparte barajando, así que hay que buscar cuál lleva
 * el texto bueno — que es exactamente lo que hace el estudiante en pantalla.
 */
async function comprobarLaClave(recorridoId: string) {
  const pasos = await prisma.paso.findMany({
    where: { recorridoId },
    orderBy: { orden: "asc" },
    select: { titulo: true, ejercicios: { select: { ejercicio: true } } },
  });

  let aciertos = 0;
  let total = 0;

  for (const [i, paso] of pasos.entries()) {
    const ej = paso.ejercicios[0].ejercicio;
    const analizado = analizar(ej.datos);
    if (!analizado) throw new Error(`${paso.titulo}: los datos no son de ningún tipo conocido.`);
    const letras = CLAVE[i];

    let respuestas: Respuestas;
    if (analizado.tipo === "relacionar") {
      const publica = versionPublica(analizado, ej.id) as {
        derechas: { clave: string; texto: string }[];
      };
      respuestas = Object.fromEntries(
        analizado.datos.parejas.map((pareja, j) => {
          // La letra de la clave tiene que ser la del texto que este script
          // puso como respuesta buena: "F" contra "F. AYUNTAMIENTO…".
          if (!pareja.derecha.startsWith(`${letras[j]}.`)) {
            throw new Error(
              `${paso.titulo}, ítem ${pareja.id}: la clave dice ${letras[j]} y aquí está «${pareja.derecha}».`,
            );
          }
          const d = publica.derechas.find((x) => x.texto === pareja.derecha);
          if (!d) throw new Error(`${paso.titulo}: «${pareja.derecha}» no está entre las opciones.`);
          return [pareja.id, d.clave];
        }),
      );
    } else if (analizado.tipo === "opcion") {
      respuestas = Object.fromEntries(
        analizado.datos.preguntas.map((pregunta, j) => [
          pregunta.id,
          String("ABC".indexOf(letras[j])),
        ]),
      );
    } else {
      // `huecos` y `ordenar` no los usa ninguna tarea de comprensión del
      // DELE, y si alguna acabara aquí es que el ejercicio está mal montado.
      throw new Error(`${paso.titulo}: el tipo «${analizado.tipo}» no es de este examen.`);
    }

    const c = corregir(analizado, respuestas, ej.id);
    aciertos += c.aciertos;
    total += c.total;
    const fallos = c.items.filter((x) => !x.acertado).map((x) => x.id);
    if (fallos.length) {
      throw new Error(
        `${paso.titulo}: la clave oficial falla en ${fallos.join(", ")}. Revisa esos ítems.`,
      );
    }
  }

  if (aciertos !== 25 || total !== 25) {
    throw new Error(`La clave oficial saca ${aciertos}/${total} y tiene que sacar 25/25.`);
  }
  console.log("\nLa clave oficial puntúa 25/25: contenido y respuestas cuadran.");
}

async function main() {
  const profe = await prisma.user.findUnique({ where: { email: CORREO_PROFE } });
  if (!profe) throw new Error(`No encuentro al profesor ${CORREO_PROFE}`);
  const alumno = await prisma.user.findUnique({ where: { email: CORREO_ALUMNO } });
  if (!alumno) throw new Error(`No encuentro al estudiante ${CORREO_ALUMNO}`);

  // Se valida todo antes de tocar la base: si la tarea 4 tuviera una errata,
  // no tiene sentido haber creado ya las tres primeras.
  const total = TAREAS.reduce((n, t) => {
    t.esquema.parse(t.datos);
    return n + itemsDe(t.datos);
  }, 0);
  if (total !== 25) throw new Error(`El examen tiene que sumar 25 ítems, y suma ${total}.`);

  const previos = await prisma.recorrido.findMany({
    where: { titulo: TITULO },
    select: { id: true, pasos: { select: { id: true } } },
  });
  for (const r of previos) {
    const pasoIds = r.pasos.map((p) => p.id);
    const vinculos = await prisma.pasoEjercicio.findMany({
      where: { pasoId: { in: pasoIds } },
      select: { ejercicioId: true },
    });
    // El orden importa: primero lo que apunta al paso, luego el paso.
    await prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.ejercicio.deleteMany({ where: { id: { in: vinculos.map((v) => v.ejercicioId) } } });
    await prisma.asignacion.deleteMany({ where: { recorridoId: r.id } });
    await prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } });
    await prisma.paso.deleteMany({ where: { recorridoId: r.id } });
    await prisma.recorrido.delete({ where: { id: r.id } });
    console.log("Versión anterior borrada.");
  }

  const recorrido = await prisma.recorrido.create({
    data: {
      titulo: TITULO,
      descripcion:
        "Prueba 1 del examen de mayo de 2015. Cuatro tareas, 25 preguntas, 50 minutos.",
      nivel: NIVEL,
      // La destreza en el recorrido y no solo en los pasos: es lo que hace
      // que la aplicación sepa de qué prueba es y proponga las tareas que
      // faltan. Y, para la auditiva, lo que raciona el audio.
      destreza: "CE",
      tipo: "PREPARACION_DELE",
      orden: 1,
      publicado: false,
      autorId: profe.id,
    },
    select: { id: true },
  });

  let orden = 1;
  for (const t of TAREAS) {
    const paso = await prisma.paso.create({
      data: {
        recorridoId: recorrido.id,
        orden,
        ciclo: 1,
        tipo: t.tipoPaso,
        destreza: "CE",
        titulo: t.titulo,
      },
      select: { id: true },
    });
    // La Tarea 4 no lleva bloque: su texto vive dentro del ejercicio, con
    // los huecos marcados, porque los desplegables se pintan encima.
    if (t.bloque) {
      await prisma.bloque.create({
        data: { pasoId: paso.id, orden: 1, tipo: "TEXTO", texto: t.bloque },
      });
    }
    const ejercicio = await prisma.ejercicio.create({
      data: {
        tipo: TIPO_DE_EJERCICIO[t.datos.ejercicio as MarcaEjercicio],
        titulo: `${TITULO} · ${t.titulo}`,
        nivel: NIVEL,
        destreza: "CE",
        etiquetas: ["DELE", "A2/B1 escolar", "mayo 2015"],
        datos: t.datos,
        publicado: false,
        autorId: profe.id,
      },
      select: { id: true },
    });
    await prisma.pasoEjercicio.create({
      data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
    });
    const items = itemsDe(t.datos);
    console.log(`  ${t.titulo}: ${items} ítems`);
    orden++;
  }

  await prisma.asignacion.create({
    data: {
      estudianteId: alumno.id,
      profesorId: profe.id,
      recorridoId: recorrido.id,
      nota: "Prueba de comprensión de lectura completa. 50 minutos.",
    },
  });

  await comprobarLaClave(recorrido.id);

  console.log(`\n25 ítems en 4 tareas. Ábrela en /recorridos/${recorrido.id}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
