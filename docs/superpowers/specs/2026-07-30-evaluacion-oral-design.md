# Evaluación oral: la parrilla y el viaje del archivo

Fecha: 2026-07-30

## El problema

Existe una herramienta de evaluación de exámenes orales **fuera de HispaProfe**:
un HTML monolítico de 2,3 MB con su CSS, su JavaScript y sus imágenes en base64,
escrito para examinar a 33 estudiantes del liceo Saint-Jean de Passy en mayo de
2026. Funciona. Guarda en `localStorage` y vive en un archivo suelto.

Eso significa que **las notas no son de nadie**. No cuelgan de una ficha, no se
cruzan con las clases ni con el progreso, y desaparecen si se borra el
navegador. El profesor evalúa dentro de HispaProfe todo lo demás —clases,
deberes, puntos de ejercicios— y esto queda fuera.

Existen además dos HTML más, de otra sesión: una **transcripción con el audio
troceado por líneas** y un **informe de 72 errores clasificados** por tipo
(fonéticos, morfológicos, léxicos, sintácticos) con su forma esperada y su
etiqueta de nivel PCIC. Esos dos no son la herramienta: son lo que sale al otro
lado cuando una IA analiza el examen. Pero el primero —el reproductor con un
botón por línea— sí es una pantalla que hace falta, porque es donde se corrige
lo que la IA transcribe mal.

## Qué construimos

**Evaluación oral**: una convocatoria de examen dentro de HispaProfe, con su
horario, sus sujets, su parrilla de calificación y sus dos cronómetros; y un
viaje de ida y vuelta en `.json` que deja el análisis lingüístico fuera.

Cinco capacidades:

1. **Convocar** un examen: horario, sujets y a quién se examina.
2. **Evaluar** en directo: cronómetros, cinco criterios sobre 20, comentarios.
3. **Exportar e importar** un `.json` que la IA rellena fuera de aquí.
4. **Corregir** la transcripción contra el audio, línea a línea.
5. **Entregar**: ficha imprimible de una página, CSV para el liceo, informe
   colgado de la ficha del alumno.

**La idea que lo sostiene: HispaProfe no habla con ninguna IA.** Ni ahora ni en
este diseño. El paso caro —transcribir y analizar— se hace en el chat que el
profesor ya paga, y el puente entre las dos cosas es un archivo que él descarga
y vuelve a subir. Cero claves de API, cero coste por minuto, cero dependencia de
un proveedor que mañana cambie de precio o de nombre.

---

## El viaje del archivo

Dos idas y dos vueltas, con la corrección humana en medio:

```
   EVALUAR            parrilla + cronómetros + audio
      │
      ├─ bajas  examen.json
      │            [ IA, fuera de HispaProfe ]
      ├─ subes  examen.json + transcripción
      │
   CORREGIR           el editor con el audio troceado
      │
      ├─ bajas  examen.json + transcripción corregida
      │            [ IA, fuera de HispaProfe ]
      ├─ subes  examen.json + informe
      │
   FICHA DEL ALUMNO
```

**Por qué la corrección humana no se puede saltar.** Un transcriptor automático
—Whisper, Google, cualquiera— está entrenado para *normalizar*: oye a una
francófona decir «bondo» y escribe «bando», porque asume acento o ruido y
devuelve lo que quiso decir. Es su trabajo y lo hace bien. Pero el informe del
examen se sostiene entero sobre esas desviaciones: `[bondo]`, `[dirijado]`,
`[dictatura]`, `[tuyeron]`, `[aleados]`. Transcribir sin corregir no ahorra
trabajo: **falsea el dato**, y el informe sale diciendo que la candidata habla
mejor de lo que habla.

**Los tiempos no los da un chat.** Cada línea necesita saber dónde empieza y
dónde acaba (`inicio: 27, fin: 32`) para que el botón ▶ lleve al fragmento. Eso
sale de procesar la onda del audio, no del texto. Así que el editor los deja
poner a mano: se reproduce y se marca el corte. Si el `.json` que entra ya los
trae, se respetan; si no, se ponen escuchando. Las dos entradas valen, y así el
diseño no queda atado a ninguna herramienta concreta.

---

## Los datos

Cinco modelos nuevos. **Ninguno duplica lo que ya existe**: los estudiantes
siguen siendo `User`, los grupos `Grupo`, y las imágenes y el audio van a
`Archivo`. La convocatoria los apunta; no los copia.

```prisma
/// Un examen con nombre y fecha: «Oral de Seconde, SJDP, mayo 2026».
/// Es lo que hace el examen repetible: en octubre se convoca otro sin
/// pisar este.
model Convocatoria {
  id         String   @id @default(cuid())
  nombre     String
  profesor   User     @relation("ProfesorConvocatoria", fields: [profesorId], references: [id])
  profesorId String
  archivada  Boolean  @default(false)
  sujetos    Sujeto[]
  turnos     Turno[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([profesorId, archivada])
}

/// Una fiche de sujet: dos documentos entre los que el estudiante elige.
/// Va por grupo porque cada grupo tiene su propio juego (MORENO 19, SEQUEDA 7).
model Sujeto {
  id             String       @id @default(cuid())
  convocatoria   Convocatoria @relation(fields: [convocatoriaId], references: [id], onDelete: Cascade)
  convocatoriaId String
  grupo          Grupo        @relation(fields: [grupoId], references: [id])
  grupoId        String
  numero         Int
  eje            String
  doc1Resumen    String
  doc2Resumen    String
  doc1ImagenId   String?      // -> Archivo, servido desde /api/archivos/[id]
  doc2ImagenId   String?
  evaluaciones   EvaluacionOral[]

  @@unique([convocatoriaId, grupoId, numero])
  @@index([convocatoriaId])
}

/// Un hueco del horario. Con estudiante, o una pausa (estudiante nulo).
/// El día y la hora viven aquí y no en `User` porque son del examen,
/// no de la persona: la misma persona puede examinarse dos veces.
model Turno {
  id             String       @id @default(cuid())
  convocatoria   Convocatoria @relation(fields: [convocatoriaId], references: [id], onDelete: Cascade)
  convocatoriaId String
  grupo          Grupo        @relation(fields: [grupoId], references: [id])
  grupoId        String
  estudiante     User?        @relation("EstudianteTurno", fields: [estudianteId], references: [id])
  estudianteId   String?      // null = pausa
  dia            String       // «Mercredi 6 mai», en francés: viene del liceo
  hora           String       // «13:20»
  orden          Int
  evaluacion     EvaluacionOral?

  @@unique([convocatoriaId, grupoId, orden])
  @@index([estudianteId])
}

/// Lo que el profesor rellena. Una por turno.
model EvaluacionOral {
  id         String  @id @default(cuid())
  turno      Turno   @relation(fields: [turnoId], references: [id], onDelete: Cascade)
  turnoId    String  @unique
  sujeto     Sujeto? @relation(fields: [sujetoId], references: [id])
  sujetoId   String?
  documento  String? // «d1» | «d2»

  // Segundos, capados a 300. Float y no Int: el cronómetro para donde para.
  segundosEoc Float?
  segundosEoi Float?

  // Las cinco notas y los seis comentarios, en un solo Json. Se leen y se
  // escriben siempre juntos, y así añadir un criterio no es una migración.
  notas       Json?
  comentarios Json?

  transcripcion TranscripcionOral?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

/// El audio, sus segmentos y el informe que devuelve la IA.
/// Aparte de EvaluacionOral porque nace después y a menudo no nace:
/// se puede calificar un examen sin transcribirlo nunca.
model TranscripcionOral {
  id           String         @id @default(cuid())
  evaluacion   EvaluacionOral @relation(fields: [evaluacionId], references: [id], onDelete: Cascade)
  evaluacionId String         @unique
  audioId      String?        // -> Archivo
  segmentos    Json?          // [{ hablante, inicio, fin, texto }]
  informe      Json?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}
```

**Los dos modelos que ya existen ganan sus relaciones inversas**, que Prisma
exige: `User` recibe `convocatorias Convocatoria[]` y `turnosOrales Turno[]`;
`Grupo` recibe `sujetos Sujeto[]` y `turnos Turno[]`. Ninguna columna nueva en
ninguno de los dos.

**Las imágenes y el audio se referencian por id suelto**, sin clave foránea
—`doc1ImagenId`, `audioId`—, siguiendo lo que ya hace `Bloque`, que guarda la
ruta `/api/archivos/[id]` en un campo de texto. Es deliberado: así borrar un
`Archivo` huérfano no revienta contra una relación.

`segmentos` e `informe` van en `Json` y no en tablas propias por el precedente
que ya hay en el proyecto: `PasoCompletado.respuestas` y `Ejercicio.datos` son
lo mismo —estructuras que solo se leen y escriben enteras—. Treinta segmentos
que siempre viajan juntos no son treinta filas.

**Los cinco criterios no son tabla.** Van en `lib/orales/criterios.ts` como
constante: `key`, título, descripción, máximo (4, 2, 5, 5, 4 = 20) y las frases
sugeridas de cada uno. Son del examen del liceo francés, no de HispaProfe.
Meterlos en la base obligaría a mantener una pantalla para editarlos que nadie
va a usar.

**Ojo con el `next dev` abierto.** Tras la migración hay que reiniciarlo
(`npm run fresh`): `lib/prisma.ts` fija el cliente en `globalThis` y el proceso
viejo se queda con el esquema antiguo.

---

## Las pantallas

**`/profe/orales`** — las convocatorias, con un botón para crear otra. Al
crearla se eligen los grupos que se examinan y se le pone nombre.

**`/profe/orales/[id]`** — la pantalla donde se pasa el 90% del tiempo. Dos
columnas:

- *Izquierda, el horario*: agrupado por día, con hora y nombre, y un semáforo a
  la derecha —gris sin empezar, amarillo a medias, la nota sobre 20 en verde con
  los cinco criterios puestos—. Las pausas salen como separador, sin
  interacción. Pestañas arriba para cambiar de grupo.
- *Derecha, el panel*: nombre y nota global; el selector de sujet y documento en
  un solo `<select>` con `<optgroup>` por sujet, y debajo la vista previa de la
  imagen elegida; los dos cronómetros; las cinco tarjetas de criterio; el
  comentario general; y el sitio para subir el audio del examen.

**`/profe/orales/evaluacion/[id]/transcripcion`** — el editor. Lista de líneas
con hablante, botón ▶ por línea que reproduce solo ese fragmento, y el texto
editable. Arriba, los dos botones del viaje: subir el `.json` de la IA y bajar
el corregido. Si el archivo entró sin tiempos, se reproduce y se marcan los
cortes con una tecla.

**`/profe/orales/evaluacion/[id]/ficha`** — el A4 de una página, en su propia
dirección para poder guardarlo en PDF o enlazarlo. Cabecera con nombre y nota,
tira de tiempos EOC/EOI, imagen del documento elegido, los cinco criterios con
su color y su comentario en texto plano, y el comentario general.

**`/profe/alumnos/[id]`** — se le añade una sección con los exámenes orales de
esa persona: convocatoria, nota y enlace al informe.

### El aspecto

El HTML de referencia es Plus Jakarta Sans sobre blanco con pasteles menta,
lavanda y coral. **No se copia.** Se usa el sistema de HispaProfe —Nunito, el
fondo `#f4f9fc`, `hp-400`, `rounded-tarjeta`, `shadow-suave`— y los colores de
los cinco criterios se traducen a los que ya existen:

| Criterio | Color del HTML | Color aquí |
|---|---|---|
| I. Corrección de la lengua | lavender | `bloque1` |
| II. Pronunciación y fluidez | cyan | `bloque2` |
| III. Contenido | mint-bright | `verde-500` |
| IV. Organización de las ideas | yellow | `bloque4` |
| V. Cualidades oratorias | coral | `bloque3` |
| Comentario general | peach | `sol-300` |

Mismo código de color por criterio y misma lectura de un vistazo. Copiar la
paleta original daría una pantalla que parece de otra aplicación.

### Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `lib/orales/criterios.ts` | Los cinco criterios y sus frases. Constante. |
| `lib/orales/formato.ts` | `fmtTiempo` (MM:SS), `fmtNota`, `calcularTotal`, `estadoDe`. |
| `lib/orales/archivo.ts` | El esquema zod del `.json`, y leerlo y escribirlo. **Fuera de las acciones.** |
| `lib/orales/csv.ts` | El CSV con BOM y sus veintidós columnas. |
| `lib/orales/reglas.ts` | Las reglas de más abajo. **Fuera de las acciones.** |
| `lib/acciones-orales.ts` | Las acciones de servidor. Sigue a `acciones-clases.ts`. |
| `components/orales/*.tsx` | Horario, panel, cronómetro, tarjeta de criterio, editor de transcripción. |
| `scripts/verificar-orales.ts` | Ejercita las reglas y el formato contra filas reales. |

**Las reglas y el esquema van fuera de las acciones** por el motivo ya
establecido en el proyecto: una acción de servidor necesita sesión de Clerk y
contexto de petición, así que no se puede llamar desde un script. Lo que está
fuera es lo único verificable. Es la decisión que ya se tomó con
`puedeQuitarseElRol`, `congelarImporte` y `estudianteAsignable`.

---

## El contrato del archivo

**Un solo archivo que va y vuelve engordando**, no cuatro formatos distintos.
Cuatro formatos serían más limpios sobre el papel y un infierno en la práctica:
cuatro validaciones que mantener y el profesor teniendo que acordarse de cuál
toca.

```json
{
  "version": 1,
  "evaluacionId": "clx7f2...",
  "instrucciones": "Añade la sección «transcripcion» con ...",
  "examen": {
    "convocatoria": "Oral de Seconde · Saint-Jean de Passy · mayo 2026",
    "estudiante": "MORENO Camille",
    "dia": "Mercredi 6 mai", "hora": "13:20",
    "sujet": 7, "eje": "Représentations",
    "documento": "Documento 2: cartel de la Guerra Civil",
    "tiempos": { "eoc": 287, "eoi": 300 }
  },
  "evaluacion": {
    "notas": { "lengua": 3, "fluidez": 1.5, "contenido": 4,
               "organizacion": 3.5, "oratoria": 3 },
    "total": 15,
    "comentarios": { "lengua": "...", "general": "..." }
  },
  "transcripcion": {
    "segmentos": [
      { "hablante": "E",  "inicio": 0, "fin": 4, "texto": "¿Quién quiere comenzar?" },
      { "hablante": "C1", "inicio": 4, "fin": 6, "texto": "[Mí], por favor." }
    ]
  },
  "informe": { "errores": [], "nivelObservado": "B1.1" }
}
```

`examen` y `evaluacion` van siempre. `transcripcion` aparece tras el primer
viaje; `informe` tras el segundo. HispaProfe lee lo que haya y rellena lo que
reconoce.

Tres campos que parecen menores y no lo son:

**`version`.** El día que el formato cambie, los archivos viejos siguen
abriéndose. Sin él, un cambio dentro de seis meses deja tirados los exámenes del
curso pasado.

**`evaluacionId`.** Es lo que ata el archivo a su examen. Subir el de Camille en
la ficha de Théo se rechaza diciendo de quién es realmente. Sin ese campo, un
despiste machaca la evaluación equivocada en silencio.

**`instrucciones`.** El archivo que se descarga lleva dentro la explicación de
qué debe devolver la IA: qué secciones añadir, con qué campos, y —lo que más
importa— **que respete las desviaciones fonéticas tal cual y no las corrija**.
Así no hay que reexplicárselo en cada chat ni recordar el formato de memoria.

---

## Las reglas

En `lib/orales/reglas.ts`. Cada una devuelve el motivo del rechazo o `null`,
siguiendo la forma de `puedeBloquearse`.

**1. El archivo se valida antes de tocar nada.** Viene de un chat, y los chats
devuelven JSON roto con bastante alegría. Se comprueba con `zod`; si falla, se
dice qué campo y por qué, no un error genérico. Si pasa, se enseña un resumen
—«30 segmentos, 1 informe con 46 errores»— y **el profesor confirma antes de que
se escriba nada**. Nunca se sobrescribe a ciegas un examen ya corregido.

**2. Un archivo solo entra en su propia evaluación.** `evaluacionId` tiene que
coincidir.

**3. A una ficha suprimida no se le crea un examen.** Esto no es una regla nueva
de aquí: `lib/estudiantes.ts` ya la tiene escrita y explica que existe porque se
olvidó en tres consultas. El horario se monta con `listarEstudiantesElegibles` y
la creación de turnos pasa por `estudianteAsignable`. Un examen es exactamente
el tipo de fila que la supresión no debe volver a ver nacer.

**4. Solo un cronómetro corre a la vez, y todo cambio de contexto lo para.**
Iniciar uno detiene el otro y guarda su tiempo; cambiar de estudiante, de grupo
o de sujet también. Al llegar a 300 segundos se detiene solo, guarda 300 exactos
y suena. Nunca pasa de 300. «Reanudar» continúa desde lo guardado, no reinicia.

**5. Una nota fuera de rango se avisa pero no se bloquea.** Un 5 en un criterio
sobre 4 se pinta en rojo y se guarda igual. A veces hay una excepción
justificada y el programa no es quién para impedirla. El CSV la exporta tal
cual.

---

## El audio pesa, y hay que decirlo

`Archivo` guarda los bytes **dentro de la propia base**, y el schema explica por
qué: «para no depender de ningún servicio externo y para que viajen con la copia
de seguridad». Para imágenes redimensionadas es la decisión correcta. **El audio
es dos órdenes de magnitud más grande**: un examen de 6:29 en MP3 normal son
unos 6 MB, y 33 exámenes son ~200 MB metidos en la base, que engordan cada copia
de seguridad.

No es catastrófico —Postgres lo aguanta— pero no debe descubrirse en enero. Dos
frenos:

- **Límite de 15 MB por audio**, que rechaza el que venga sin comprimir.
- **Recomendación de subirlo en mono y baja calidad**, avisada en la propia
  pantalla. Para localizar dónde dice «[bondo]» sobra, y deja el examen en ~3 MB
  y la convocatoria entera en ~100 MB.

Si algún día eso se queda corto, lo que hay que replantear es `Archivo`, y
afectaría también a las imágenes. Queda escrito aquí para que la decisión tenga
fecha.

---

## Verificación

No hay framework de pruebas y este diseño no introduce ninguno. Se sigue el
precedente: `npx tsc --noEmit`, `npm run lint` y un script `tsx` al estilo de
`scripts/verificar-personas.ts`.

**`scripts/verificar-orales.ts`** comprueba:

- `calcularTotal` con criterios a medias, con nulos y con decimales; `fmtTiempo`
  en 0, 59, 60 y 300; `fmtNota` con entero y con decimales.
- El CSV: comillas dentro del comentario, comas, saltos de línea, el BOM al
  principio, y que las filas de pausa no salen.
- **El esquema del archivo con archivos rotos de verdad**, no solo con el
  bonito: JSON inválido, `version` desconocida, `evaluacionId` de otro examen,
  segmento sin `fin`, `notas` con una clave inventada. Es la parte con más
  probabilidad de fallar en uso real y la que más barato sale cubrir.
- Las cinco reglas, cada una con su fila: un archivo ajeno rechazado; una ficha
  suprimida a la que se le niega el turno; un tiempo que no pasa de 300; una
  nota fuera de rango que **sí** se guarda.

Idempotente y limpiando lo que crea, como los demás.

**A mano**, que es lo que un script no puede ver: evaluar a alguien de principio
a fin con los cronómetros corriendo, bajar el `.json`, subirlo con una
transcripción, cortar segmentos escuchando el audio, e imprimir la ficha en A4
comprobando que la tira de tiempos aparece —en el HTML original ese bloque se
perdía porque una regla `display:none` de pantalla ganaba a la de `@media
print`—.

---

## Fuera de alcance

- **Que HispaProfe transcriba el audio.** No hay proveedor de IA en el proyecto
  y este diseño no añade ninguno. La API de Claude, además, no acepta audio: solo
  texto, imágenes y PDF. El día que se quiera automatizar el borrador hará falta
  un servicio de voz a texto, con su cuenta, su clave y su coste por minuto. Es
  otro diseño, y el viaje del `.json` está pensado para que ese día no haya que
  rehacer nada.
- **Generar el informe dentro de HispaProfe.** Mismo motivo. Entra por el
  archivo.
- **Que el examen sea configurable.** Los cinco criterios, sus máximos y el /20
  son del liceo francés y van en una constante. Otro colegio con otra parrilla es
  otro trabajo; el sitio donde tocar sería `lib/orales/criterios.ts`.
- **Extraer los sujets de los PDF originales.** `MORENO_2.pdf` y
  `SEQUEDA_DEF.pdf` no se han entregado. Cuando lleguen, un script recorta cada
  página en dos por la posición del texto «Documento 2:» y sube los dos trozos a
  `Archivo`. Mientras tanto los sujets se crean a mano desde la pantalla.
- **Importar el horario desde el `.xlsx`.** `ORALES_SJDP_6_MAI.xlsx` tampoco se
  ha entregado, y leer Excel es una dependencia nueva. El horario se teclea o se
  pega; 33 filas se hacen una vez.
- **Compartir convocatorias entre profesores.** Hoy hay un solo profesor.
  `profesorId` ya está en la tabla para cuando deje de serlo.
- **Reproducir el aspecto del HTML monolítico.** Descartado a propósito; ver
  «El aspecto».

---

## Deuda conocida

- **El archivo `evaluacion_oral.html` no se ha leído.** El prompt de partida
  dice que ante cualquier duda manda el HTML, y no se ha entregado. Este diseño
  se ha escrito desde la descripción y desde los dos HTML de la sesión de
  franquismo. Si al implementarlo aparece el original y contradice algo de aquí,
  **manda el HTML** y se anota la corrección.
- **Los tiempos se cortan a mano.** Es trabajo del profesor, unos minutos por
  examen. Se acepta porque ocurre mientras escucha, que es tiempo que iba a pasar
  escuchando igual. Si algún día hay servicio de voz a texto, los tiempos vienen
  en el archivo y este trabajo desaparece solo: el editor ya acepta las dos
  entradas.
- **El peso del audio en la base.** Ver la sección propia. La decisión es
  consciente y tiene freno, no es un descuido.
