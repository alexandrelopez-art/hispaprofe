# El Creador DELE: el mapa del examen, encima de Recursos

Fecha: 2026-07-31

## El problema

Recursos ya deja crear cualquier ejercicio de los cuatro tipos del motor. Lo que
no hace es **saber nada del examen**. Para montar la Tarea 1 de comprensión de
lectura de B1 hay que acordarse de que son nueve textos, que se relacionan seis
con sus enunciados, que sobran tres, y que eso se construye con el tipo
`relacionar`. Ese conocimiento está hoy en la cabeza del profesor y en ningún
sitio más.

El encargo original pedía exactamente eso: una herramienta que, elegido el nivel,
la prueba y la tarea, **proponga solo lo que esa tarea admite**. Este diseño lo
construye — pero encima de lo que ya existe, no al lado.

## Qué construimos

Un **mapa del examen como datos** y las pantallas que ya existen leyéndolo.

Cuatro capacidades:

1. **Nombrar la prueba**: una secuencia de preparación sabe de qué nivel y de qué
   prueba es.
2. **Proponer las tareas** que le faltan a esa prueba, con su formato y su número
   de ítems.
3. **Abrir el editor por la página correcta**, con la estructura de la tarea ya
   montada y el selector de Recursos filtrado por su formato.
4. **Reproducir audio con las dos escuchas del examen**, contadas en el servidor.

---

## El principio: el mapa aconseja, no manda

**Todo lo que se puede hacer hoy en Recursos y en las secuencias se sigue
pudiendo hacer exactamente igual.** El mapa añade atajos por encima; no cierra
ninguna puerta.

Cada sitio donde el mapa interviene tiene una salida visible:

- El título que propone al crear la prueba **se puede cambiar**.
- Las tareas que sugiere son **botones al lado** del «añadir paso» libre de
  siempre, que conserva su título, su tipo y su destreza a elección.
- El selector filtrado por formato lleva un **«ver todos»**, el mismo patrón que
  el enlace para salirse del filtro de nivel que ya existe en la ficha del paso.
- El número oficial de ítems **avisa, no rechaza**: «esta tarea suele llevar
  seis; llevas cuatro». Un ejercicio de práctica más corto es una decisión
  pedagógica, no un error.

El filtrado es el **estado inicial**, no una casilla que haya que marcar: el
valor de la herramienta está en que la Tarea 1 de B1 abra directamente en
«relacionar textos con enunciados» sin tener que recordarlo. La salida está, pero
no hace falta el 95% de las veces.

**Ninguna regla de este diseño rechaza nada.** La única regla nueva que sí
rechaza es del motor, no del mapa (ver «Los sobrantes»).

---

## El alcance: las dos pruebas de comprensión

Una secuencia de preparación **es una prueba**; un paso **es una tarea**. Esa es
la unidad con la que se estudia y con la que se cronometra.

De las cuatro pruebas de un nivel, este diseño cubre **comprensión de lectura** y
**comprensión auditiva**. Las dos de expresión no tienen ni un formato
autocorregible: son el diseño C entero, con su rúbrica, su texto modelo y su
pantalla de corrección a mano.

No es una coincidencia cómoda: **el corte por «lo que el motor sabe corregir» es
el mismo corte que hace el examen** entre destrezas receptivas y productivas.

**C2 queda fuera** de todo, porque no existe en el enum `Nivel` y esa ausencia es
deliberada: ese nivel casi no se vende.

---

## Los datos

Una sola migración, con dos cambios.

### `Recorrido.destreza`

```prisma
  /// De qué prueba del DELE es esta secuencia. Null en clases particulares.
  destreza  Destreza?
```

Hoy la destreza vive solo en los pasos. Una prueba recién creada todavía no tiene
ninguno, así que sin esta columna el Creador no sabría, al volver a abrirla, de
qué prueba se trata. El nivel ya está en `Recorrido.nivel` y el número de tarea es
`Paso.orden`: no hace falta nada más para identificar «B1 · Comprensión de
lectura · Tarea 3».

Nullable a propósito: una secuencia de clases particulares no tiene prueba, y una
de preparación tampoco está obligada a tenerla — se puede querer una tanda suelta
de práctica.

### `Escucha`

```prisma
/// Cuántas veces ha oído un estudiante un audio concreto de un paso.
model Escucha {
  id           String     @id @default(cuid())
  asignacion   Asignacion @relation(fields: [asignacionId], references: [id], onDelete: Cascade)
  asignacionId String
  pasoId       String
  /// Qué audio dentro del paso: el id del elemento que lo lleva —una
  /// pregunta en `opcion`, una pareja en `relacionar`—.
  clave        String
  veces        Int        @default(0)

  @@unique([asignacionId, pasoId, clave])
  @@index([asignacionId])
}
```

**Tabla propia y no una columna en `PasoCompletado`**, que es el sitio donde se
pondría a ojo. `PasoCompletado` es la fila que significa «este paso está hecho», y
se crea cuando el estudiante lo marca: escribir ahí la primera escucha haría que
el paso apareciera como hecho por haber dado al play.

**Una fila por audio y no por paso**, porque una tarea auditiva puede llevar
varios: la Tarea 1 de comprensión auditiva de B1 son seis monólogos cortos, y cada
uno se oye dos veces.

**Cuelga de la asignación y no del estudiante** para que se borre en cascada con
ella, igual que `PasoCompletado`. Suprimir una ficha ya se lleva sus asignaciones;
esto viaja en el mismo barco sin que haya que acordarse.

---

## El mapa

Vive en `lib/dele/mapa.ts`, como datos comentados. Una entrada por prueba, y
dentro una por tarea:

```ts
{
  nivel: "B1", prueba: "CE", duracionMinutos: 70,
  tareas: [
    { numero: 1, formato: "MATCH_TEXT", motor: "relacionar",
      items: 6, opciones: 9,
      pide: "Relacionar seis enunciados con seis de los nueve textos.",
      verificado: true },
    { numero: 2, formato: "MC", motor: "opcion",
      items: 6, opciones: 3,
      pide: "Seis preguntas de tres opciones sobre un texto informativo.",
      verificado: true },
    …
  ]
}
```

`items` son los ítems oficiales; `opciones` son las opciones totales entre las que
se elige. Cuando `opciones > items` hay sobrantes, y su número sale de la resta.
`pide` es lo que se enseña en pantalla al elegir la tarea.

### Los formatos y con qué se construyen

**La pregunta que decide el tipo del motor no es cómo se llama el formato, sino
si una misma opción puede valer para más de un ítem.**

Si cada opción se usa **una sola vez** —nueve textos para seis enunciados, y cada
texto es de un enunciado— es `relacionar`, que es uno a uno y admite sobrantes.
Si una opción **se repite** —tres textos para seis preguntas, así que cada texto
contesta dos— es `opcion` con lista común, que es justo lo que distingue a ese
tipo: «la misma opción puede valer en varias preguntas».

Confundirlas se paga caro en las dos direcciones. Usar `relacionar` donde se
repite es imposible: el esquema prohíbe dos derechas iguales. Usar `opcion` donde
no se repite deja al estudiante marcar el mismo texto en dos enunciados, que el
examen no permite.

| Formato | Qué es | Tipo del motor | Por qué |
|---|---|---|---|
| `MC` | Opción múltiple de tres opciones | `opcion` | Cada pregunta tiene sus propias opciones. |
| `MATCH_TEXT` | Relacionar textos con enunciados, con sobrantes | `relacionar` | Cada texto se usa una vez. |
| `MATCH_TOPIC` | Relacionar hablantes con temas, con sobrantes | `relacionar` | Cada tema se usa una vez. |
| `GAP_INSERT` | Insertar fragmentos en los huecos de un texto | `relacionar` con texto | Cada fragmento va en un hueco. |
| `MATCH_PERSON` | Relacionar preguntas con personas o textos | `opcion` con lista común | **Se repiten**: tres o cuatro personas para seis preguntas. |
| `ATTRIB` | Atribuir a hablante: A, B o ninguno | `opcion` con lista común | Se repiten: tres opciones para seis enunciados. |
| `CLOZE` | Huecos con tres opciones | `opcion` | Cada hueco tiene sus propias opciones. |

**`CLOZE` se construye con `opcion` y no con `huecos`.** Todos los huecos del DELE
en las pruebas de comprensión dan tres opciones: no se escribe la palabra, se
elige. Cada hueco es una pregunta con sus tres opciones, en desplegable para que
catorce filas de botones no sean un muro.

Consecuencia: **este diseño no usa `huecos` ni `ordenar` en ninguna tarea.** Los
dos siguen existiendo para las clases particulares.

### Qué está verificado y qué no

`verificado: true` en **B1**, **B2** y **A2/B1 escolar** — las tres pruebas de
comprensión de cada uno vienen del encargo del profesor con esa marca, y no se ha
inventado nada.

`verificado: false` en **A1**, **A2** y **C1**, que en el encargo aparecían como
«completar». Están deducidos siguiendo el patrón de los verificados. **Son una
deducción, no conocimiento del profesor**, y la aplicación lo dice a la cara: al
elegir una de esas tareas sale un aviso de que ese dato está sin confirmar. Se
corrige el archivo, se pone `verificado: true`, y el aviso desaparece.

El aviso **no bloquea**: se puede crear la tarea igual.

---

## Los cambios en el motor

### Los sobrantes

`relacionarSchema` gana una lista de textos que se barajan con los buenos y
**nunca son la respuesta de nadie**:

```ts
  /// Textos que se mezclan con los de la derecha y no emparejan con nada.
  /// Nueve textos para seis enunciados son seis parejas y tres sobrantes.
  sobrantes: z.array(z.string()).default([]),
```

**`corregirRelacionar` no cambia ni una línea.** Sigue comparando lo que el
estudiante emparejó contra las parejas buenas, y un sobrante simplemente nunca
está entre ellas. Lo único que cambia es `versionPublicaRelacionar`, que ahora
baraja `[...derechas, ...sobrantes]` con la misma semilla estable y reparte
claves opacas a todos por igual — un sobrante tiene que ser indistinguible de una
respuesta buena, o el ejercicio se resuelve mirando el código de la página.

**La regla nueva:** un sobrante no puede repetir el texto de una respuesta buena.
El esquema ya prohíbe que dos parejas compartan el texto de la derecha, y por el
mismo motivo: el estudiante vería dos celdas idénticas y una de las dos filas
quedaría mal contada pase lo que pase. Un sobrante que repita una buena hace
exactamente eso. Es la **única** regla de este diseño que rechaza algo.

### El texto de por medio

```ts
  /// Pasaje que se pinta encima de las columnas. Para insertar fragmentos.
  texto: z.string().optional(),
```

Con él, `GAP_INSERT` deja de ser un formato aparte: es relacionar huecos con
fragmentos, con el pasaje delante.

**Esta es la versión de dos columnas, y es deliberadamente más pobre que el
examen.** El texto se ve arriba con los huecos numerados, y debajo se empareja
«Hueco 1» con su fragmento en las dos columnas de siempre. Las etiquetas de la
izquierda las escribe el profesor como cualquier otra pareja: no se derivan del
texto, a diferencia de las marcas `{{...}}` del tipo `huecos`. Es una pareja
normal cuyo lado izquierdo dice «Hueco 1». Se corrige y se puntúa
igual que el examen; se lee peor. La versión fiel —soltar cada fragmento **dentro
del texto**, en su sitio— es una cara de cliente nueva con su propio arrastrar y
soltar, tanto trabajo como el resto de este diseño junto. Queda anotada como
posible evolución, para decidirla con la tarea ya funcionando delante.

### El audio, también en `relacionar`

`preguntaOpcionSchema.audio` ya existe y la cara del estudiante ya pinta un
reproductor. Eso cubre `MC`, `ATTRIB` y `CLOZE`, que son preguntas.

**Pero dos formatos auditivos no son preguntas: son emparejamientos.**
`MATCH_TOPIC` relaciona seis hablantes con diez temas, y `MATCH_TEXT` en su
versión auditiva relaciona seis audios con enunciados de nueve. Los dos son uno a
uno, así que van con `relacionar`, y en los dos **lo que suena está en la columna
de la izquierda**. Así que `parejaSchema` gana su
propio audio:

```ts
  /// Lo que hay que escuchar para emparejar esta fila. Opcional.
  audio: z.string().optional(),
```

Sin esto, dos de las cinco tareas de comprensión auditiva de B1 y B2 no se pueden
construir, y el diseño se quedaría cojo justo en la prueba que lo motivaba.

El límite de escuchas va en la raíz de **los dos** esquemas, `opcion` y
`relacionar`, con el mismo nombre y el mismo valor por defecto:

```ts
  /// Cuántas veces se puede oír cada audio. Dos, como en el examen.
  escuchas: z.number().int().min(1).default(2),
```

Lo que falta, entonces, es de dónde sale el archivo y cuántas veces suena.

**De dónde sale: de las dos vías.** Subir un archivo desde el ordenador, o pegar
un enlace de fuera. Las dos acaban siendo una dirección en el mismo campo, así
que subir solo añade una forma de generarla. `/api/archivos` deja entrar los
formatos de audio y sube su tope de peso: un audio de cinco minutos ronda los
5 MB y una foto ya comprimida no llega a 400 KB.

**Aviso que conviene dejar escrito:** los archivos se guardan dentro de la base
de datos, no en un disco aparte. Es bueno para las imágenes —todo viaja junto en
la copia de seguridad— y con audio la base va a crecer bastante más rápido. No es
un problema hoy; es algo que hay que saber antes de subir cincuenta audios.

**Cuántas veces suena:** dos, contadas en el servidor. El número va en el
ejercicio y no en una constante, para poder hacer un ejercicio de práctica con
cuatro escuchas sin que dejen de ser dos en los simulacros.

**Se cuenta al dar al play, no al terminar.** Es lo que hace el examen, donde el
audio suena una vez y no se rebobina. Agotadas, el reproductor se apaga. Y como
`/api/archivos/[id]` ya sirve con caché permanente, una vez empieza a sonar el
archivo está en el navegador: que se caiga la conexión a mitad no corta la
reproducción.

**Contado en el servidor y no en el navegador** porque un contador en el
navegador se devuelve recargando la página, y entonces no cuenta nada.

---

## Las pantallas

Ninguna nace. Tres cambian de comportamiento cuando la secuencia es de
preparación.

**`/profe/secuencias/nueva`** — elegido «Preparación DELE», pide **nivel y
prueba**, y propone el título («B1 · Comprensión de lectura»), que se puede
cambiar. Se puede dejar la prueba sin elegir: entonces es una secuencia de
preparación sin mapa, y se comporta como cualquier otra.

**`/recorridos/[id]`** — si la secuencia tiene prueba, enseña **las tareas que le
faltan**, cada una con su formato, su número de ítems y su frase de qué se pide,
y un botón que crea el paso con el título, la destreza y el tipo ya puestos. El
«añadir paso» libre sigue al lado.

**`/pasos/[pasoId]`** — si el paso es una tarea del mapa, el selector de Recursos
viene **filtrado por el formato de esa tarea**, con «ver todos» al lado. El botón
de «crear uno nuevo» lleva al editor con la tarea indicada.

**`/profe/recursos/nuevo`** — acepta la tarea como parámetro y arranca el editor
**con la estructura montada**: seis preguntas si son seis, nueve opciones comunes
si son nueve, los sobrantes ya separados. Y avisa si el número se desvía del
oficial, sin impedir nada.

En cualquier pantalla donde se elija una tarea con `verificado: false`, sale el
aviso de dato sin confirmar.

### Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `lib/dele/mapa.ts` | Los datos del examen. Editables y comentados. |
| `lib/dele/index.ts` | Las preguntas que se le hacen al mapa. **Fuera de las acciones.** |
| `lib/escuchas.ts` | Contar y consultar escuchas. **Fuera de las acciones.** |
| `lib/acciones-escuchas.ts` | La acción que llama el reproductor. |
| `components/ejercicios/reproductor.tsx` | El reproductor con su contador. |
| `components/recursos/editor-relacionar.tsx` | **Modificar.** Sobrantes, texto y el audio de cada pareja. |
| `components/recursos/editor-opcion.tsx` | **Modificar.** El audio de cada pregunta. |
| `components/recursos/subir-audio.tsx` | Subir un archivo o pegar un enlace. |
| `scripts/verificar-dele.ts` | El mapa consigo mismo y el contador de escuchas. |

`lib/dele/index.ts` y `lib/escuchas.ts` van fuera de las acciones por el motivo
ya establecido en el proyecto: una acción de servidor necesita sesión de Clerk y
contexto de petición, así que no se puede llamar desde un script. Lo que está
fuera es lo único verificable.

---

## Verificación

`npx tsc --noEmit`, `npm run lint` y dos scripts.

**`scripts/verificar-dele.ts`** cubre dos cosas distintas.

*El mapa consigo mismo*: que ninguna tarea apunte a un tipo del motor que no
existe, que no haya dos tareas con el mismo número dentro de una prueba, que las
que declaran sobrantes tengan más opciones que ítems, que toda entrada lleve su
marca de verificado, y que las pruebas verificadas tengan el número de tareas que
dice el examen. Es barato y evita la errata tonta en trescientas líneas de datos.

*El contador de escuchas contra filas reales*: que la primera deje una, que la
segunda deje cero, que la tercera se niegue, y —la que de verdad importa— que
**volver a preguntar después de agotarlas siga diciendo que no**. Si eso falla,
recargar la página devuelve las escuchas y el contador no sirve para nada.

**`scripts/verificar-recursos.ts`** gana las suyas para los sobrantes: que un
sobrante nunca puntúe aunque el estudiante lo empareje, que el esquema rechace uno
que repita una respuesta buena, y que `versionPublica` los reparta con claves
indistinguibles de las de las respuestas buenas. Y una para el audio del
emparejamiento: que la versión pública de `relacionar` lleve el audio de cada
pareja a la izquierda, porque sin él dos tareas auditivas no se pueden hacer.

**A mano**, que es lo que un script no ve: crear la prueba de B1 · Comprensión de
lectura entera, con sus cinco tareas, y hacerla con la cuenta de estudiante. Y una
tarea auditiva: oír el audio dos veces, comprobar que a la tercera no suena, y
recargar la página para comprobar que sigue sin sonar.

---

## Fuera de alcance

- **Las dos pruebas de expresión.** `WRITE` y `SPEAK`, con su rúbrica, su texto
  modelo y la pantalla donde el profesor los corrige. Es el diseño C.
- **Soltar los fragmentos dentro del texto.** La versión fiel de `GAP_INSERT`.
  Aquí va la de dos columnas, que se corrige igual y se lee peor. Se decide con la
  tarea funcionando delante.
- **El simulacro completo.** Las cuatro pruebas de un nivel de una sentada, con
  los grupos de calificación (Grupo 1 = lectura + escritas, Grupo 2 = auditiva +
  orales, ≥30/50 cada uno). Necesita las de expresión, así que no antes de C.
- **El cronómetro.** El mapa guarda la duración oficial de cada prueba y la
  enseña, pero no cuenta el tiempo ni cierra nada al agotarse.
- **La calificación especial de A2/B1 escolar.** Un examen que certifica A2 o B1
  según la puntuación. Es aritmética de simulacro, y va con él.
- **Una pantalla para editar el mapa.** Se edita el archivo. Construir un editor
  de tablas para un solo profesor es más trabajo que corregir la tabla.
- **La transcripción oculta del audio.** El encargo la mencionaba. No se ha
  diseñado dónde se enseña ni a quién, y sin eso es un campo que nadie lee.
- **Generar un borrador con IA.** El encargo lo pedía «si el entorno lo permite».
  La aplicación no habla con ninguna IA hoy, y meterlo aquí sería decidir de paso
  proveedor, claves y coste. Merece su propia conversación.
