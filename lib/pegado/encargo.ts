import type { MarcaEjercicio } from "@/lib/ejercicios/tipos";
import { sobrantesDe, type TareaDele } from "@/lib/dele";
import { EJEMPLOS } from "@/lib/pegado/ejemplos";

/**
 * El encargo que se descarga y se le da a una IA junto al PDF del examen.
 *
 * **No enseña los cuatro motores: enseña el suyo**, ya elegido por el mapa.
 * Elegir mal entre `relacionar` y `opcion` es el error caro del proyecto
 * —usar `opcion` donde las opciones no se repiten deja al alumno marcar el
 * mismo texto en dos enunciados, que el examen no permite—, así que esa
 * elección no se delega en quien lee el encargo.
 *
 * Módulo puro: solo datos y plantillas. Nada de base, nada de sesión. Por eso
 * `scripts/verificar-pegado.ts` puede recorrer las 52 tareas del mapa y
 * comprobar el encargo de cada una.
 */
export type Encargo = {
  motor: MarcaEjercicio;
  /** Cómo se llama en el desplegable, cuando hay que elegir. */
  etiqueta: string;
  /** El markdown entero, listo para descargar o copiar. */
  texto: string;
};

const ETIQUETA: Record<MarcaEjercicio, string> = {
  opcion: "Opción múltiple",
  relacionar: "Relacionar en dos columnas",
  huecos: "Huecos que se escriben",
  ordenar: "Ordenar piezas",
};

/**
 * `opcion` va partido en dos mitades porque el pasaje de un cloze se mete
 * justo en medio: primero qué es el ejercicio, luego cómo se contesta. Ese es
 * el orden en el que se transcribe la tarea, y el sitio donde una IA busca el
 * texto que acaba de leer en el PDF.
 */
const OPCION_QUE_ES = [
  "`ejercicio`: la cadena `\"opcion\"`.",
  "`consigna`: lo que se le dice al estudiante que haga.",
];

const OPCION_COMO_SE_CONTESTA = [
  "`multiple`: `false` salvo que una pregunta admita varias respuestas buenas.",
  "`presentacion`: `\"botones\"`, o `\"desplegable\"` si son muchas preguntas cortas.",
  "`opcionesComunes`: la lista que comparten todas las preguntas. Se pone **solo** cuando una misma opción vale para varias preguntas; si no, se omite y cada pregunta lleva las suyas.",
  "`preguntas`: una por ítem, con `id` (\"1\", \"2\", …), `enunciado`, `opciones` (si no hay lista común) y `correctas`.",
  "`correctas`: la **posición** de la opción buena empezando en cero, dentro de una lista. La primera opción es `[0]`, la tercera es `[2]`.",
];

/**
 * El pasaje de un cloze, y solo de un cloze.
 *
 * No se documenta en las demás tareas de `opcion` a propósito: `texto` cambia
 * la cara del ejercicio —con él, cada pregunta se pinta como un desplegable
 * dentro del párrafo— y sus `refine` exigen que las marcas cuadren con los
 * `id`. Una IA que lo usara en una tarea `MC` corriente se llevaría un
 * «Las marcas {{...}} del pasaje no coinciden con los ids de las preguntas»
 * sobre unas marcas que el profesor no ha escrito.
 */
const CAMPO_TEXTO_CLOZE =
  "`texto`: el pasaje entero, con una marca `{{1}}`, `{{2}}`… en el sitio de cada hueco. Va **dentro** de `ejercicio`, y es lo que hace que el hueco se pinte como un desplegable en su sitio del texto en vez de en una lista debajo. Con `texto`, `presentacion` no se mira: el hueco siempre es un desplegable.";

/** La forma del `ejercicio` de cada motor, campo a campo. */
const FORMA: Record<MarcaEjercicio, string[]> = {
  opcion: [...OPCION_QUE_ES, ...OPCION_COMO_SE_CONTESTA],
  relacionar: [
    "`ejercicio`: la cadena `\"relacionar\"`.",
    "`consigna`: lo que se le dice al estudiante que haga.",
    "`parejas`: una por ítem, con `id` (\"1\", \"2\", …), `izquierda` (lo que se lee en la columna fija) y `derecha` (la opción que le corresponde).",
    "`sobrantes`: las opciones que se barajan con las buenas y no emparejan con nada. Lista vacía si no sobra ninguna.",
  ],
  huecos: [
    "`ejercicio`: la cadena `\"huecos\"`.",
    "`consigna`: lo que se le dice al estudiante que haga.",
    "`texto`: el pasaje con una marca `{{1}}`, `{{2}}`… donde falta cada palabra.",
    "`huecos`: uno por marca, con `id` (el mismo que la marca) y `acepta`, la lista de formas que se dan por buenas.",
  ],
  ordenar: [
    "`ejercicio`: la cadena `\"ordenar\"`.",
    "`consigna`: lo que se le dice al estudiante que haga.",
    "`piezas`: en **su orden correcto**, con `id` y `texto`. Al estudiante le llegan barajadas.",
  ],
};

/** Las reglas que ese motor puede romper, y lo que pasa si se rompen. */
const REGLAS: Record<MarcaEjercicio, string[]> = {
  opcion: [
    "`correctas` cuenta desde cero. Escribir `[1]` para la primera opción da un ejercicio que nadie puede acertar.",
    "Con `opcionesComunes`, ninguna pregunta lleva su propio `opciones`. Sin ella, todas lo llevan.",
    "Los `id` de las preguntas no se repiten.",
  ],
  relacionar: [
    "Dos parejas no pueden compartir el mismo texto en `derecha`: el estudiante vería dos celdas idénticas y una de las dos filas quedaría mal contada pase lo que pase.",
    "Un sobrante no puede repetir el texto de una respuesta buena, por lo mismo.",
    "Dos sobrantes tampoco pueden ser iguales entre sí, por lo mismo.",
    "`izquierda` sí se puede repetir.",
  ],
  huecos: [
    "Las marcas `{{...}}` del `texto` y los `id` de `huecos` tienen que ser exactamente los mismos: ni una de más ni una de menos.",
    "Ninguna forma de `acepta` puede estar vacía: nadie podría acertar ese hueco.",
    "Se perdona la mayúscula y los espacios de sobra, pero **no la tilde**. Si una palabra se puede escribir de dos formas buenas, van las dos en `acepta`.",
  ],
  ordenar: [
    "Las piezas van en su orden correcto, no barajadas: barajarlas es cosa de la aplicación.",
    "Ninguna pieza puede estar en blanco.",
  ],
};

/**
 * Lo que añade el pasaje, encima de las reglas de `opcion`. Son las tres que
 * el esquema hace cumplir en cuanto aparece `texto` (ver los `refine` de
 * `lib/ejercicios/opcion.ts`), más la que evita el error de bulto: mandar el
 * pasaje en `bloque` y dejar los desplegables sin contexto.
 */
const REGLAS_CLOZE = [
  "Las marcas `{{...}}` del `texto` y los `id` de las preguntas tienen que ser exactamente los mismos: ni una de más ni una de menos.",
  "El pasaje va en `texto` y **no** en `bloque`. Fuera, los desplegables quedan en una lista debajo del texto y el hueco pierde la frase en la que está, que es lo único que se estaba preguntando.",
  "La pregunta **es** el hueco: su `enunciado` es solo el número de su marca —«19.»— porque lo que hay que entender ya está en el pasaje.",
  "`multiple` va en `false`: el desplegable de un hueco solo deja elegir una opción.",
];

/**
 * Compone el encargo de una tarea concreta.
 *
 * `tarea` es null en un paso que no es tarea del examen. Entonces el encargo
 * sale sin número de ítems ni sobrantes, que son datos que solo tiene el
 * mapa: pedírselos a la IA sería pedirle que se los invente.
 */
export function componerEncargo(
  titulo: string,
  motor: MarcaEjercicio,
  tarea: TareaDele | null,
): Encargo {
  // `opcion` tiene dos formas, y enseñar la que no toca contradice la regla
  // de «Los números de esta tarea» dos secciones más abajo. Sin tarea del
  // mapa no hay `listaComun` que mirar, así que se queda con el ejemplo de
  // siempre: es el mismo caso que el resto de los datos ausentes.
  const ejemplo = motor === "opcion" && tarea?.listaComun ? EJEMPLOS.opcionListaComun : EJEMPLOS[motor];

  /**
   * Si esta tarea es un cloze, con el pasaje dentro del propio ejercicio.
   *
   * Lo dice el mapa —`formato === "CLOZE"`—, no la IA: es el principio de esta
   * pantalla, que todo lo que la aplicación ya sabe lo pone la aplicación. Sin
   * esto, el encargo de un cloze salía sin `texto` y la IA devolvía un
   * ejercicio válido, con el número de preguntas correcto y el pasaje en un
   * bloque aparte: nada avisaba, porque el resumen y el aviso de ítems cuadran
   * igual, y lo que se guardaba no era la tarea del examen.
   *
   * Sin tarea del mapa no hay formato que mirar, así que un paso libre nunca
   * pide el pasaje: no hay forma de saber si lo lleva.
   *
   * Se mira también el motor y no solo el formato: `texto` es un campo de
   * `opcion`, y las ocho tareas `CLOZE` del mapa se construyen con `opcion`.
   */
  const cloze = motor === "opcion" && tarea?.formato === "CLOZE";

  // El pasaje se documenta entre las dos mitades de `opcion`, y sus reglas
  // detrás de las de siempre.
  const campos = cloze
    ? [...OPCION_QUE_ES, CAMPO_TEXTO_CLOZE, ...OPCION_COMO_SE_CONTESTA]
    : FORMA[motor];
  const reglas = cloze ? [...REGLAS.opcion, ...REGLAS_CLOZE] : REGLAS[motor];

  /**
   * El párrafo que explica `bloque`, que no dice lo mismo en las tres
   * situaciones.
   *
   * En un cloze hay que decir que el pasaje **no** va aquí, y por eso esta
   * tarea no lleva bloque. En `huecos`, `texto` también existe y significa
   * otra cosa que `bloque`, así que hay que distinguirlos. En el resto
   * —una `MC` corriente, `relacionar`, `ordenar`— no se nombra `texto`
   * siquiera: mencionar un campo que su encargo no documenta es invitar a
   * usarlo, y usarlo da un error sobre unas marcas que nadie ha escrito.
   */
  const casillaBloque = cloze
    ? "En esta tarea `bloque` **se omite**: lo que el estudiante lee es el pasaje con los huecos, y ese va **dentro** de `ejercicio`, en su campo `texto`."
    : motor === "huecos"
      ? "`bloque` es **opcional** y se omite si la tarea no tiene nada que leer aparte de los propios ítems. Ojo: `bloque` va **fuera** de `ejercicio`. Dentro de `ejercicio` hay otro campo llamado `texto`, que es el pasaje con los huecos: no son lo mismo."
      : "`bloque` es **opcional** y se omite si la tarea no tiene nada que leer aparte de los propios ítems. Ojo: `bloque` va **fuera** de `ejercicio`.";

  const sobran = tarea ? sobrantesDe(tarea) : 0;

  const cuenta: string[] = [];
  if (tarea) {
    cuenta.push(`- **${tarea.items} ítems.** Ni uno más ni uno menos: es lo que lleva esta tarea en el examen.`);
    if (sobran > 0) {
      cuenta.push(
        `- **${sobran} sobrantes.** Son ${tarea.opciones} opciones en total para ${tarea.items} ítems: ${sobran} no emparejan con nada y van en la lista \`sobrantes\`.`,
      );
    }
    if (tarea.motor === "opcion") {
      cuenta.push(
        tarea.listaComun
          ? `- **Lista común de ${tarea.opciones} opciones**, en \`opcionesComunes\`. Es una lista común porque en esta tarea **una misma opción contesta a varias preguntas**. Ninguna pregunta lleva su propio \`opciones\`.`
          : `- **${tarea.opciones} opciones por pregunta**, cada una en su propio \`opciones\`. Nada de \`opcionesComunes\`: aquí cada pregunta tiene las suyas.`,
      );
    }
  }

  const aviso = tarea && !tarea.verificado
    ? "\n> **Ojo:** los números de esta tarea están deducidos y **sin confirmar** contra un examen oficial. Si el PDF que tienes delante dice otra cosa, manda el PDF.\n"
    : "";

  const texto = `# Encargo: ${titulo}

Vas a transcribir **una tarea de un examen del Instituto Cervantes** al formato
que lee HispaProfe. Te doy el formato; el contenido sale del PDF que te adjunto.

${tarea ? `## Qué es esta tarea\n\n${tarea.pide}\n${aviso}` : `## Qué es esta tarea\n\nUn ejercicio de **${ETIQUETA[motor].toLowerCase()}**. El contenido y cuántos ítems lleva los decides a partir del material que te adjunto.\n`}
## Qué me tienes que devolver

Un único objeto JSON con **dos casillas** y nada más:

\`\`\`json
{
  "bloque": "el texto que el estudiante lee antes de responder, en markdown",
  "ejercicio": { }
}
\`\`\`

${casillaBloque}

Dentro de \`ejercicio\` van estos campos:

${campos.map((l) => `- ${l}`).join("\n")}

${cuenta.length ? `## Los números de esta tarea\n\n${cuenta.join("\n")}\n` : ""}
## Reglas que no se pueden romper

${reglas.map((l) => `- ${l}`).join("\n")}

## Lo que **no** tienes que poner

- **El título, el nivel ni la destreza.** Los pone la aplicación: ya sabe de qué
  examen y de qué prueba es este paso.
- **Nada de audio.** Esta tarea **no lleva audio dentro del ejercicio**. Cuando
  el examen tiene audio, es un MP3 por tarea que se sube aparte, con las dos
  escuchas ya grabadas dentro. No inventes rutas ni campos \`audio\`.
- **Nada de explicaciones.** Devuelve el JSON y solo el JSON.

## Un ejemplo resuelto

Del mismo tipo, recortado para que quepa. **Cópiale la forma, no la cuenta**:
cuántos ítems lleva la tarea no sale de este ejemplo.

\`\`\`json
${JSON.stringify(ejemplo, null, 2)}
\`\`\`

## Al transcribir

- Copia el texto del examen **literal**, con sus tildes y su puntuación. No lo
  resumas ni lo modernices: la dificultad del examen está en cómo está escrito.
- Las respuestas correctas salen de la **clave oficial**, no de tu lectura. Si el
  PDF no la trae, dilo en vez de deducirla.
- Si algo del examen no cabe en este formato —una opción que es un dibujo, por
  ejemplo—, dilo en vez de inventarte un equivalente.
`;

  return { motor, etiqueta: ETIQUETA[motor], texto };
}

/**
 * Los encargos que se le ofrecen a un paso: el suyo si es tarea del examen, y
 * los cuatro si no.
 *
 * El mapa aconseja y no manda, que es el principio de toda esta pantalla: un
 * paso libre de una clase particular sigue pudiendo pegar lo que quiera.
 */
export function encargosPara(titulo: string, tarea: TareaDele | null): Encargo[] {
  if (tarea) return [componerEncargo(titulo, tarea.motor, tarea)];
  const motores: MarcaEjercicio[] = ["opcion", "relacionar", "huecos", "ordenar"];
  return motores.map((m) => componerEncargo(titulo, m, null));
}
