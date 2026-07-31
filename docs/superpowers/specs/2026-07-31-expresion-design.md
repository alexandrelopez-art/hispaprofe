# Expresión: lo que el motor no puede corregir

Fecha: 2026-07-31

## El problema

De las cuatro pruebas del DELE, la aplicación ya sabe montar y corregir las dos
de comprensión. Las otras dos —**expresión escrita** y **expresión oral**— son la
mitad del examen y **no tienen ni un formato autocorregible**: se evalúan con una
rúbrica y las corrige una persona.

Hoy la aplicación no puede con ellas por tres motivos distintos:

- **El alumno no puede producir nada.** No hay ninguna forma de que escriba un
  texto y lo entregue. La subida de archivos existe pero es solo para
  profesores.
- **No hay rúbrica.** Un paso corregido a mano guarda un número de puntos y nada
  más: ni criterios, ni desglose, ni comentario. Y el desglose es justo lo que le
  enseña al alumno dónde falla.
- **Y no hay forma de saber que algo ha llegado.** Para enterarse de que un
  alumno ha entregado habría que ir entrando en su ficha una por una.

Este es el tercero y último de los diseños en que se partió el encargo del
Creador DELE. Los dos anteriores —**Recursos** y el **Creador DELE**— están
construidos y fusionados.

## Qué construimos

**Las tareas de expresión como un tipo más de Recursos**, con su rúbrica, su
texto modelo y la pantalla donde el profesor las corrige. Más la agenda del oral.

Cuatro capacidades:

1. **Crear** una tarea de expresión, escrita u oral, con su consigna, su
   estímulo, sus criterios y su modelo.
2. **Entregar**: el alumno escribe en la aplicación y su texto queda en su ficha.
3. **Corregir**: el profesor lee, rellena la rúbrica y comenta.
4. **Citar** un oral en una clase de las que ya tiene agendadas.

**La idea que lo sostiene: una tarea de expresión es un ejercicio más.** Vive en
la misma tabla, sale en la misma lista, se engancha al mismo paso, y el mapa del
DELE la propone igual que las de comprensión. Lo único que la distingue es que el
motor no la corrige.

---

## Hermano del motor, no miembro

`lib/ejercicios/` tiene hoy una propiedad valiosa: **cuatro tipos, y los cuatro se
corrigen solos**. `corregir()` es un `switch` exhaustivo, y el tipo de retorno se
escribe a mano precisamente para que un quinto caso sin implementar no compile en
silencio.

Meter la expresión ahí dentro obligaría a poner la primera excepción en el sitio
donde hoy no hay ninguna: un tipo que se analiza pero no se corrige.

Así que **el motor no se toca**. La expresión tiene su propio validador al lado,
`lib/expresion.ts`, con su esquema zod y su versión pública. La página del paso
pregunta primero a `analizar()` —los cuatro de siempre— y luego a
`analizarExpresion()`. Ninguna función del motor cambia ni una línea.

---

## El alcance

**Escrita y oral**, las dos pruebas productivas, en los seis niveles que tiene la
aplicación.

**La diferencia entre ellas es si el alumno entrega algo:**

- **Escrita**: ve la consigna y el estímulo, escribe en un recuadro con su
  contador de palabras, y entrega. Ese texto queda guardado.
- **Oral**: no entrega nada. La tarea es material para la clase —la lámina, la
  tarjeta, el guion, el tiempo— y el profesor la evalúa con el alumno delante.
  Sin grabación y sin buzón.

Las dos comparten la rúbrica y la pantalla de corrección.

**No entra el cálculo de la nota de la prueba ni los grupos de calificación** del
examen (Grupo 1 = lectura + escritas, Grupo 2 = auditiva + orales, ≥30/50 cada
uno). Eso es el simulacro completo: necesita las cuatro pruebas puntuando juntas
y es su propia conversación.

---

## Los datos

Una sola migración, con tres cambios.

### `TipoEjercicio` gana `EXPRESION`

Para que una tarea de expresión se liste y se filtre en Recursos como cualquier
otra.

### `PasoCompletado` gana dos columnas

```prisma
  /// Lo que escribió el alumno en una tarea de expresión escrita.
  /// Null en todo lo demás, y en las orales, que no tienen entrega.
  entrega    String?

  /// La rúbrica rellenada: una nota por criterio y el comentario.
  /// La suma de las notas es lo que acaba en `puntos`.
  valoracion Json?
```

Ni tabla nueva ni modelo aparte: la entrega y la corrección de un alumno son
datos **de ese alumno en ese paso**, que es exactamente lo que esa fila significa
desde que existe. Y ya guarda `puntos` y `verificadoEl`.

### `CitaOral`, tabla propia

```prisma
/// En qué clase se examina un oral concreto de un alumno.
model CitaOral {
  id           String     @id @default(cuid())
  asignacion   Asignacion @relation(fields: [asignacionId], references: [id], onDelete: Cascade)
  asignacionId String
  pasoId       String
  clase        Clase      @relation(fields: [claseId], references: [id], onDelete: Cascade)
  claseId      String
  createdAt    DateTime   @default(now())

  @@unique([asignacionId, pasoId])
  @@index([claseId])
}
```

**Tabla propia y no una columna en `PasoCompletado`**, aunque sea el sitio obvio.
Esa fila significa «este paso está hecho» y se crea cuando el alumno lo marca:
citar ahí haría que **el paso apareciera como hecho por el mero hecho de ponerlo
en la agenda**. Es exactamente la trampa del contador de escuchas del diseño B, y
se resuelve igual.

**Cuelga de la asignación y de la clase, con borrado en cascada por los dos
lados**: si se retira la asignación o se borra la clase, la cita se va con ellas
sin dejar una fila apuntando al vacío.

---

## La forma de la tarea

Guardada en `Ejercicio.datos` como los demás:

```ts
{
  ejercicio: "expresion",
  modalidad: "escrita" | "oral",
  consigna: "Escribe un correo a un amigo contándole…",
  /** Lo que el alumno tiene delante. Los tres opcionales. */
  estimulo: { texto?: string; imagen?: string; audio?: string },
  /** Solo en las escritas. */
  palabras: { minimo: 100, maximo: 120 },
  /** Solo en las orales. */
  minutos: 3,
  criterios: [
    { id: "c1", nombre: "Adecuación y cumplimiento", maximo: 3 },
    { id: "c2", nombre: "Coherencia",                maximo: 3 },
    { id: "c3", nombre: "Corrección",                maximo: 3 },
    { id: "c4", nombre: "Alcance",                   maximo: 3 },
  ],
  /** Se le enseña al alumno solo después de corregir. */
  modelo: "Querida Ana:\n…",
}
```

**Los criterios se definen en cada tarea**, con los cuatro del Instituto
Cervantes puestos por omisión para no tener que escribirlos cada vez. Se puede
quitar uno, añadir otro, cambiar el nombre o el máximo.

**El estímulo viaja con la tarea, no con el paso**, para que la misma tarea sirva
con otro alumno sin volver a montar el gráfico o la foto. La imagen y el audio
usan la subida que ya existe en `/api/archivos`.

**Los ids de los criterios se generan por el máximo de los sufijos existentes más
uno**, no contando elementos: es la clave con la que se guardan las notas, y
contar produce ids repetidos al quitar uno de en medio. Es la lección que ya
costó dos rondas en los diseños anteriores.

**Los campos según la modalidad los exige el esquema, no la buena voluntad**: una
escrita necesita `palabras` y no admite `minutos`; una oral, al revés. Y
`palabras.minimo` no puede ser mayor que `palabras.maximo`, que es la errata
fácil de cometer y difícil de ver.

### Cómo se deriva `Ejercicio.tipo`

Hoy `tipoDeEjercicio()` en `lib/recursos.ts` traduce `datos.ejercicio` al enum de
la base con una tabla de las cuatro marcas del motor. La expresión no es una de
ellas, así que esa función gana su caso: si `analizarExpresion()` lo reconoce, el
tipo es `EXPRESION`. Sigue habiendo **un solo sitio** donde la columna y el
discriminante pueden discrepar, que es lo que se buscaba al subir esa tabla
desde el script de siembra.

---

## Las pantallas

### El editor, en Recursos

Un editor más, hermano de los cuatro que ya hay. Eliges escrita u oral, escribes
la consigna, pones el estímulo, el número de palabras o los minutos, ajustas los
criterios y escribes el modelo.

### El alumno, en su paso

**Escrita:** consigna, estímulo, y un recuadro con **su contador de palabras**
(«87 de 100-120»). El contador **avisa y deja entregar**: escribir noventa
palabras cuando se piden cien es un error del alumno que el profesor va a
puntuar, no algo que la aplicación deba impedirle. Al entregar, el paso queda
marcado como hecho y esperando corrección.

**Oral:** el material y una línea que dice que esta tarea se hace en clase. Si
está citada, cuándo.

### `/profe/entregas`

La pantalla que hoy no existe: **lo que está esperando corrección**. Quién, qué
tarea, cuándo la entregó. Sin ella, enterarse de que ha llegado algo exige entrar
en la ficha de cada alumno.

**Las orales no salen en esta lista**, porque no llega nada: se corrigen desde la
ficha del alumno o desde la clase donde están citadas.

### La pantalla de corrección

Arriba lo que escribió el alumno —en las orales, nada—. Debajo los criterios con
sus botones y un comentario. Es la misma pantalla para las dos modalidades.

Al guardar se escriben `puntos` y `verificadoEl` **exactamente como hace hoy
`otorgarPuntos`**. Eso importa: significa que **todo lo que ya cuenta puntos —la
hucha del alumno, su progreso, el panel del profesor— sigue funcionando sin
enterarse de que existe un tipo nuevo**.

---

## La cita del oral

**Citar un oral es elegir en qué clase se hace.** Desde la tarea oral de un
alumno se ven **sus próximas clases agendadas** y se elige una. Eso es «cuándo
tiene un hueco»: sus clases ya agendadas son los huecos.

Funciona en los dos sentidos:

- **Desde la ficha del alumno**: cada tarea oral dice si está citada y para
  cuándo.
- **Desde la clase**, en el diario: qué orales hay citados ahí. Al preparar la
  clase se sabe qué se lleva.
- Y la corrección se abre desde la propia clase, que es donde el profesor va a
  estar cuando la evalúe.

**No se proponen huecos ni se comprueban solapes.** Dos orales cortos del mismo
alumno caben de sobra en una clase de una hora; quien sabe lo que cabe es el
profesor.

**Y no se crean clases desde aquí.** Si el alumno no tiene ninguna agendada, la
pantalla lo dice y lleva al formulario que ya existe, en vez de montar una agenda
paralela a la que ya se lleva.

---

## Las reglas

Cinco, en `lib/expresion.ts`, **fuera de las acciones** por el motivo ya
establecido: una acción de servidor necesita sesión de Clerk y contexto de
petición, así que no se puede llamar desde un script. Lo que está fuera es lo
único verificable.

**1. El alumno puede reescribir su entrega hasta que se corrige, y no después.**
El equilibrio entre dejarle mejorar y que la corrección no quede colgando de un
texto que ya no existe.

**2. El texto modelo no sale del servidor hasta que la tarea está corregida.** No
basta con esconderlo en pantalla: si viaja, se lee en el código de la página. Es
la misma regla que ya protege las soluciones de los ejercicios autocorregibles,
y por el mismo motivo.

**3. No se puntúa a medias.** Guardar una valoración exige que **todos** los
criterios tengan nota: si falta alguno, se rechaza con su motivo y no se escribe
nada — ni el comentario. Media rúbrica guardada sería una tarea que parece
corregida y no lo está, y el alumno vería una nota que no es la suya.

**4. Una cita solo puede apuntar a una clase de ese alumno y que no esté
anulada.** Citar un oral en la clase de otro, o en una que se cayó, es un error
que la aplicación no debe dejar cometer.

**5. Corregir nunca borra la entrega.** El texto se queda para poder releer en
junio lo que se escribió en marzo.

---

## Verificación

No hay framework de pruebas y este diseño no introduce ninguno. Se sigue el
precedente: `npx tsc --noEmit`, `npm run lint` y un script `tsx`.

**`scripts/verificar-expresion.ts`** ejercita las cinco reglas contra filas
reales, con la limpieza en el `.finally()` y `process.exitCode` en vez de
`process.exit`, como los demás. Las que más importan:

- **Que el modelo no viaje antes de tiempo.** La versión pública de una tarea sin
  corregir no puede contenerlo, y la de una corregida sí. Si esto falla, el
  alumno copia y nadie se entera.
- **Que los puntos sean la suma de los criterios**, y que una valoración
  incompleta no escriba ni `puntos` ni `verificadoEl`.
- **Que una cita a la clase de otro alumno se rechace**, y una a una clase
  anulada también.

**A mano**, que es lo que un script no ve: escribir una redacción como alumno,
comprobar que el contador de palabras avisa sin impedir, entregarla, corregirla
como profesor rellenando la rúbrica, y volver como alumno a ver la nota, el
comentario y —solo entonces— el texto modelo.

---

## Fuera de alcance

- **El simulacro completo y los grupos de calificación.** Necesita las cuatro
  pruebas puntuando juntas.
- **Que el alumno se grabe.** El oral se hace en clase, con el profesor delante.
  Si algún día hay alumnos que preparan a distancia, hará falta abrir la subida a
  los estudiantes y decidir cuánto puede pesar un audio suyo.
- **Que el alumno entregue una foto de su folio.** El DELE escrito se hace a
  mano y la letra cuenta, así que tiene sentido algún día. Hoy se escribe en la
  aplicación.
- **Proponer huecos libres en la agenda.** Se eligen entre las clases ya
  agendadas.
- **Corregir sobre el texto**, señalando errores dentro de la redacción. Es otra
  funcionalidad y merece su propio diseño; aquí hay un comentario general.
- **La herramienta de evaluación oral del liceo.** `Convocatoria`, `Turno` y
  `EvaluacionOral` existen y resuelven otra cosa: un examen convocado con su
  horario para veintiún alumnos. El oral del DELE es una tarea dentro de una
  secuencia asignada a una persona. Comparten dominio y no forma; unirlos sería
  otro diseño y hoy no hace falta.
