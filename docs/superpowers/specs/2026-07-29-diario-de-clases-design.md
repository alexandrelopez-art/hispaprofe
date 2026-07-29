# Diario de clases

Fecha: 2026-07-29

## El problema

HispaProfe sabe todo del trabajo asíncrono —secuencias, pasos, ejercicios,
puntos— y **nada de la clase en sí**. La hora en que se dio, cuánto duró, qué se
trabajó, qué deberes salieron de ahí y cuánto hay que cobrar por ella viven hoy
fuera de la aplicación, en la cabeza del profesor y en un calendario suelto.

Eso tiene tres consecuencias:

- **No hay forma de saber cuántas horas se han trabajado** con nadie, ni de
  cerrar un mes para facturarlo.
- **Los deberes no llegan a ninguna parte.** Se dicen en voz alta al final de la
  clase y se olvidan.
- **El estudiante no sabe cuándo es su próxima clase ni por dónde entra.** El
  enlace de conexión se manda por WhatsApp cada vez.

## Qué construimos

Un **diario de clases** para el profesor: una ficha por clase que puede nacer
antes de darla (agenda) o después (bitácora), con lo que se hizo, los deberes y
lo que cuesta; un cuadro de horas e importes con filtros; y, en el tablero del
estudiante, su próxima clase con el enlace y los deberes que le han puesto.

El calendario de Google entra como **espejo**: la clase vive en HispaProfe y se
copia a Google, nunca al revés.

---

## Los datos

Tres cambios en `prisma/schema.prisma`. **Este diseño sí lleva migraciones**, a
diferencia del panel de administrador.

### `Clase` — la ficha

```prisma
enum EstadoClase {
  AGENDADA
  DADA
  ANULADA
}

model Clase {
  id           String      @id @default(cuid())
  profesor     User        @relation("ProfesorClase", fields: [profesorId], references: [id])
  profesorId   String

  // Destinatario: uno de los dos, nunca los dos ni ninguno. Prisma no sabe
  // expresar esa exclusión, así que la hace cumplir la acción al guardar.
  estudiante   User?       @relation("EstudianteClase", fields: [estudianteId], references: [id])
  estudianteId String?
  grupo        Grupo?      @relation(fields: [grupoId], references: [id])
  grupoId      String?

  empiezaEl    DateTime
  minutos      Int
  estado       EstadoClase @default(AGENDADA)

  donde        String?     // "en su casa", "aula 2"
  enlace       String?     // URL de conexión: Meet automático o pegado a mano
  notas        String?     // registro académico. Privado del profesor.
  deberes      String?     // el texto, uno para toda la clase

  // Foto del precio en el momento de darla, no espejo de la tarifa actual.
  importeCentimos Int?
  cobradaEl       DateTime?

  googleEventoId  String?  // id del evento espejo en Google Calendar

  asignados    Deber[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([profesorId, empiezaEl])
  @@index([estudianteId, empiezaEl])
  @@index([grupoId, empiezaEl])
}
```

**Duración en minutos y no hora de fin.** Es lo que hace falta para sumar horas
al final del mes, y evita el caso de la clase que cruza la medianoche.

**El importe se congela.** Si en enero la tarifa es 20 € y en marzo sube a 25,
las clases de enero siguen valiendo 20. Un precio guardado es una foto, no un
espejo.

### `Deber` — una fila por estudiante

```prisma
model Deber {
  id           String    @id @default(cuid())
  clase        Clase     @relation(fields: [claseId], references: [id], onDelete: Cascade)
  claseId      String
  estudiante   User      @relation("EstudianteDeber", fields: [estudianteId], references: [id], onDelete: Cascade)
  estudianteId String
  cerradoEl    DateTime?
  createdAt    DateTime  @default(now())

  @@unique([claseId, estudianteId])
  @@index([estudianteId, cerradoEl])
}
```

**La fila no guarda el texto.** El texto vive en `Clase.deberes` y se lee de
ahí; la fila solo dice *a quién* y *si ya está cerrado*. Así corregir una falta
de ortografía en los deberes no obliga a reescribir seis filas.

**Cuándo nacen las filas.** Al guardar la clase con `deberes` no vacío: una por
el estudiante, o una por cada miembro del grupo. Si `deberes` está vacío no hay
filas; si se vacía después, las filas se borran. Guardar dos veces el mismo
texto no duplica nada — lo impide `@@unique([claseId, estudianteId])`.

**Por qué una fila por estudiante y no un campo en la clase.** Con un campo, un
grupo de seis se cierra entero o no se cierra: no se puede dar por hecho el de
Ana y dejar el de Luis. Además, el tablero del estudiante tendría que preguntar
«dame las clases de los grupos donde estoy», que es una consulta cara. Con la
fila, la pregunta es la más barata que existe: `deber.findMany({ where: {
estudianteId, cerradoEl: null } })`.

### Campos añadidos

- `User.tarifaCentimos Int?` — la tarifa por hora de ese estudiante.
- `Grupo.tarifaCentimos Int?` — la del grupo entero.

**Céntimos enteros y no euros con decimales.** Los decimales en coma flotante
arrastran errores diminutos que al sumar un año de clases se notan.

---

## Las pantallas del profesor

### `/profe/clases` — la lista y el cuadro

Tres piezas, de arriba abajo:

1. **El formulario de nueva clase**, plegado, como «Invitar a un profesor» en
   `/admin/personas`. Fecha y hora, duración, estudiante o grupo, dónde. No
   merece una página propia.

2. **Los filtros**: estudiante o grupo, desde, hasta, estado, cobradas o
   pendientes. Van en la dirección de la página (`searchParams`), como ya hace
   el buscador de `/admin/personas`. Consecuencia útil: «las clases de Ana de
   marzo sin cobrar» es un enlace que se guarda en favoritos.

3. **Los totales de lo filtrado** —horas, total, cobrado, pendiente— y debajo la
   lista de esas clases ordenada por fecha descendente.

Una clase **dada sin importe** (porque el estudiante no tiene tarifa) se marca
en `sol-200` en la lista. Es un olvido, no un cero.

### `/profe/clases/[id]` — la ficha

Todo lo que en la lista no cabe: editar los datos, las notas privadas, el texto
de los deberes, el botón de **marcar dada** —que es cuando se calcula el
importe—, la casilla de **cobrada**, y la lista de estudiantes con sus deberes
para cerrarlos uno a uno o todos de golpe.

### Cambios en pantallas existentes

- `app/(app)/layout.tsx`: enlace **«Clases»** junto a «Estudiantes», con la
  misma condición `esProfe` que ya existe.
- `app/(app)/profe/alumnos/[id]/page.tsx`: el campo de **tarifa por hora**, y
  una línea con las horas que lleva contigo enlazando a sus clases ya filtradas.

Lo que **no** se construye: calendario mensual, vista semanal, arrastrar clases.
Una lista ordenada con filtros hace el mismo trabajo.

---

## El tablero del estudiante

`app/(app)/dashboard/panel-estudiante.tsx` gana dos bloques **antes** de la
hucha de puntos y las dos bandejas:

**Próxima clase.** La primera clase `AGENDADA` suya —o de un grupo donde esté—
con `empiezaEl` en el futuro:

> **Tu próxima clase** — martes 4 de agosto a las 18:00, con Alejandro
> [ Entrar a la clase ]

El botón solo aparece si la ficha tiene `enlace`. Si no hay ninguna clase
agendada, **el bloque no se dibuja**: nadie necesita un hueco que dice «nada».
Es la misma decisión que ya se tomó con la hucha (`mostrarHucha`).

**Deberes de tu profe.** Sus filas de `Deber` con `cerradoEl: null`, con el
texto de la clase y su fecha. **Sin botón de cerrar**: los cierra el profesor.
Para el estudiante es un recado en la nevera, no una tarea que pueda tachar.

Consecuencia asumida: si el profesor no los cierra, se acumulan. Por eso la
ficha de la clase se los pone delante.

---

## Google Calendar y el Meet

`lib/google.ts` ya resuelve lo difícil: consentimiento, tokens cifrados
(`lib/crypto.ts`), renovación automática y borrado de la cuenta cuando el
refresco muere. Lo que falta es un alcance y una llamada.

**El alcance nuevo:** `https://www.googleapis.com/auth/calendar.events`. Hoy
`ALCANCES` es solo de lectura y el comentario del archivo lo dice explícitamente
—ese comentario hay que actualizarlo—. Escribir en el calendario obliga al
profesor a **volver a dar el consentimiento una vez**. `prompt: "consent"` ya
está puesto, así que basta con reconectar desde la pantalla de Google.

**Crear el evento.** Al guardar una clase con `estado: AGENDADA`, se crea el
evento en el calendario del profesor con el estudiante (o los miembros del
grupo) como invitados, pidiendo un Meet:

- `POST /calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`
- `conferenceData.createRequest` para que Google genere el Meet.
- La respuesta trae `hangoutLink` y `id`, que se guardan en `Clase.enlace` y
  `Clase.googleEventoId`.

Editar la clase actualiza el evento; anularla lo borra.

**Si Google falla, la clase se guarda igual.** El error se enseña como aviso en
la ficha, no como pantalla rota. El calendario es un espejo: que se empañe no
rompe el original.

### Lo que hay que saber, y no es técnico

- **Mientras la aplicación esté en modo pruebas de Google, el refresco caduca
  cada siete días** y hay que reconectar. El propio código ya lo comenta en
  `tokenValido`. Se arregla publicando la app en Google, que es un trámite
  aparte de este diseño.
- **La cita solo entra sola en el calendario del estudiante si su correo es una
  cuenta de Google.** Con un Hotmail recibe el correo de invitación pero no la
  entrada automática. En HispaProfe lo ve igual, y por eso el cartel de próxima
  clase no depende de Google.

---

## El cobro

Al pasar una clase a `DADA`:

```
importeCentimos = Math.round(tarifaCentimos * minutos / 60)
```

La tarifa sale del estudiante o del grupo, según a quién apunte la clase. Si no
hay tarifa, `importeCentimos` queda `null` y la clase se marca como aviso en el
cuadro.

`cobradaEl` se pone y se quita desde la ficha, clase por clase. **Coste asumido:**
cobrar el mes de alguien son ocho clics en ocho fichas. Marcar el lote filtrado
de una vez es un botón que se añade después sin tocar nada de esto.

---

## Reglas y casos raros

Reglas que la aplicación hace cumplir, no que confía en que el profesor
recuerde:

- Una clase tiene **estudiante o grupo, nunca los dos ni ninguno**.
- `minutos > 0`.
- Solo las clases `DADA` suman horas e importe. `AGENDADA` y `ANULADA` no.
- **Anular no borra.** Una clase anulada conserva sus notas, sus deberes y su
  importe; simplemente deja de contar. **Pero sus deberes desaparecen del
  tablero del estudiante**: las filas siguen ahí para el historial del profesor,
  y el tablero filtra por `clase.estado != ANULADA`. Pedirle a alguien los
  deberes de una clase que se canceló no tiene sentido.

**El caso feo: cambiar el destinatario de una clase que ya tenía deberes.** Se
rehacen las filas —se crean las de quien entra, se borran las de quien sale—
pero **las ya cerradas de quien sigue se conservan**. Cerrar un deber es un
hecho ocurrido; no se deshace por editar una ficha.

**Quién puede ver qué.** Una clase la ve y la edita su profesor. Un
administrador ve todas, como en el resto de la aplicación. Un estudiante nunca
ve `notas`, ni el importe, ni las clases de otros: su tablero lee sus propias
filas de `Deber` y su próxima clase, nada más.

---

## Dónde vive el código

`lib/acciones.ts` tiene 1.119 líneas y es todo lo que ese archivo se puede
permitir. Lo nuevo va aparte:

| Archivo | Responsabilidad |
|---|---|
| `lib/clases.ts` | **Crear.** Los cálculos: importe, totales del cuadro, filas de deberes, próxima clase del estudiante. Sin sesión. |
| `lib/acciones-clases.ts` | **Crear.** Las acciones de servidor: crear, editar, marcar dada, anular, cerrar deberes, cobrar. |
| `app/(app)/profe/clases/page.tsx` | **Crear.** Lista, filtros y totales. |
| `app/(app)/profe/clases/[id]/page.tsx` | **Crear.** La ficha. |
| `app/(app)/dashboard/panel-estudiante.tsx` | **Modificar.** Próxima clase y deberes. |
| `app/(app)/layout.tsx` | **Modificar.** El enlace «Clases». |
| `app/(app)/profe/alumnos/[id]/page.tsx` | **Modificar.** Tarifa y horas. |
| `lib/google.ts` | **Modificar** (tanda 2). Alcance de calendario y creación del evento. |
| `scripts/verificar-clases.ts` | **Crear.** Las verificaciones. |

**Por qué los cálculos separados de las acciones.** Una acción de servidor no se
puede llamar desde un script: necesita sesión de Clerk y contexto de petición.
Lo que esté fuera es lo único verificable de verdad. Es la misma decisión que se
tomó con `puedeQuitarseElRol` y con `desmarcarSiNoRevisado`.

---

## Cómo se verifica

No hay framework de pruebas. `scripts/verificar-clases.ts`, al estilo de
`scripts/verificar-admin.ts`: crea sus propios datos, los borra al terminar.

Comprueba:

1. El importe se calcula bien y **se congela**: cambiar la tarifa después no
   toca las clases ya dadas.
2. Una clase con estudiante **y** grupo se rechaza. Una sin ninguno, también.
3. `minutos <= 0` se rechaza.
4. Un grupo de seis genera seis filas de `Deber`.
5. Cerrar el deber de uno **no** cierra el de los demás.
6. Cambiar el destinatario conserva las filas cerradas de quien sigue.
7. Una clase `ANULADA` no suma ni horas ni importe.
8. Los totales del cuadro cuadran con los filtros (estudiante, rango de fechas,
   cobradas).
9. La próxima clase del estudiante ignora las pasadas y las anuladas.

Más `npx tsc --noEmit` y `npm run lint`.

Lo de Google no se puede verificar así —hace falta consentimiento real— y se
prueba a mano en la tanda 2.

---

## Las tres tandas

1. **El diario.** Modelos `Clase` y `Deber`, las dos pantallas del profesor, el
   cuadro de horas, y en el tablero del estudiante la próxima clase (con el
   enlace escrito a mano) y sus deberes.
2. **Google Calendar.** El alcance nuevo, el evento espejo y el Meet automático.
3. **El cobro.** Tarifas, importe y casilla de cobrada.

Cada tanda deja la aplicación funcionando. El cartel de la próxima clase con su
enlace está desde la primera, sin depender de que Google coopere.

**Cada tanda lleva su propio plan de implementación.** Este documento es el
diseño de las tres; los planes se escriben uno cada vez, al empezar la tanda,
para que lo aprendido en la anterior entre en la siguiente.

---

## Fuera de alcance

- **Registrar asistencia.** Quién vino de verdad, para no cobrar las faltas.
  Otra tabla y otro gesto en cada clase; se añade después si las faltas resultan
  ser un problema.
- **Marcar un lote de clases como cobradas.** Ver arriba.
- **Vista de calendario dentro de HispaProfe.** Para eso está el de Google.
- **Facturas, impuestos, recibos.** Esto cuenta horas y dinero; no es un
  programa de facturación.
- **Que el estudiante cierre sus propios deberes.** Decisión explícita: los
  cierra el profesor.
- **Clases recurrentes** («todos los martes a las 18:00»). Se crean una a una.
