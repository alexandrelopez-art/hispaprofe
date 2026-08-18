# La portada de preparación: elegir un examen y empezarlo

Fecha: 2026-08-18

## El problema

`/preparacion` ya existe y enseña los cuatro bloques de la preparación al DELE
—estructura, práctica por tarea, examen blanco, ejercicios temáticos—, pero se
queda a un paso de servir para algo: cada bloque enlaza directamente con un
recorrido suelto. No hay dónde elegir **qué examen** se hace, y en cuanto entren
los siete exámenes del Instituto Cervantes con sus cuatro pruebas cada uno, la
portada tiene que listar veintiocho secuencias dentro de una tarjeta.

Debajo de eso hay tres cosas rotas que este trabajo tiene que arreglar, porque
sin ellas el catálogo nace vacío o miente:

**`orden` hace dos trabajos incompatibles.** En `/preparacion` es *el bloque*
(1-4). Pero `crearSecuencia` (`lib/acciones.ts:397`) lo calcula como
`max(orden) + 1` dentro del tipo, así que toda secuencia de preparación creada
desde el formulario nace con `orden` 5, 6, 7… y no aparece en ningún bloque. Las
que hoy se ven tienen el 1-4 puesto a mano.

**El catálogo no filtra `publicado`.** `/preparacion` lista todos los
`PREPARACION_DELE`, borradores incluidos. Con un alumno entrando de verdad, eso
deja de ser inocente.

**No hay forma de saber qué examen es cuál.** `Recorrido` tiene `nivel` y
`destreza`, pero el número de examen solo viviría en el título, y ordenar por
título pone el 10 antes del 2.

## Lo que se decide

- **El catálogo se ve entero; el examen blanco lo abre el profesor.** El alumno
  se pone por su cuenta la estructura (bloque 1), la práctica por tarea (2) y
  los ejercicios temáticos (4). El simulacro completo (3) solo aparece si su
  profe se lo asignó.
- **Lo que responde deja rastro.** Empezar una práctica crea una asignación de
  verdad: las respuestas se guardan, las escuchas se racionan igual que en el
  examen, y el trabajo llega a la bandeja de entregas del profesor.
- **Un examen es una prueba, no el examen entero.** «Examen 1 · Comprensión
  auditiva» es un `Recorrido` con sus cuatro tareas como pasos. Es lo que ya hay
  montado y permite practicar una prueba suelta.
- **Cada examen se hace una vez.** No hay reintentos: se respeta el
  `@@unique([estudianteId, recorridoId])` de `Asignacion` tal cual, y las
  escuchas siguen colgando de ella. Quien quiera más práctica hace otro de los
  siete exámenes.
- **La entrega es del profesor de su grupo.** Un alumno sin grupo —o cuyo grupo
  está archivado— no puede autoasignarse: se le dice que hable con su profe. Es
  la única salida que no le inventa un dueño a su entrega.

## Rutas y piezas

`/preparacion` se queda como la portada de los cuatro bloques. Se añade un
escalón:

- **`/preparacion/[bloque]`** — `estructura`, `practica`, `examen-blanco`,
  `tematicos`. Lista los recorridos publicados de ese bloque, agrupados por
  examen y ordenados por `examen asc, destreza asc`.
- **`lib/preparacion.ts`** (nuevo) — la tabla de los cuatro bloques: nombre,
  número de `orden`, título y descripción. Hoy está incrustada como la constante
  `BLOQUES` dentro de `app/(app)/preparacion/page.tsx`, y la necesitan las dos
  páginas. Duplicarla es garantizar que se separen.
- **`app/(app)/preparacion/[bloque]/tarjeta-examen.tsx`** (nuevo) — una tarjeta
  por recorrido, con su estado y su botón o su motivo.
- **`lib/acciones-preparacion.ts`** (nuevo) — `empezarPractica`, la única
  escritura de todo esto.

Los botones de la portada dejan de apuntar a un recorrido concreto y pasan a
apuntar a su bloque.

## Modelo de datos

**`Recorrido.examen Int?`** — qué examen del Cervantes es (1-7). Nulo en todo lo
demás: las clases particulares, y también los bloques 1 y 4, que no van por
examen. Columna anulable, sin relleno hacia atrás: hoy no hay ningún examen
cargado.

**`orden` deja de autoincrementarse cuando el tipo es `PREPARACION_DELE`.** Pasa
a ser un desplegable de cuatro opciones en el formulario de secuencia nueva —el
bloque al que pertenece—, y sigue autoincrementándose en las clases
particulares, donde significa lo que siempre ha significado.

**`Asignacion` no se toca.** Ni el único, ni las escuchas, ni `lib/escuchas.ts`.

## El flujo

`empezarPractica(recorridoId)` comprueba, por este orden:

1. Quien pulsa es un estudiante con sesión y **no está bloqueado**
   (`bloqueoDelActual`). No existe hoy una guarda de estudiante equivalente a
   `exigirProfesor` (`lib/profesor.ts:7`): la trae esta acción.
2. El recorrido es `PREPARACION_DELE`, está **publicado** y **no es del bloque
   3**. Un id escrito a mano no abre un examen blanco por la puerta de atrás.
3. El alumno tiene un grupo sin archivar; de ahí sale el `profesorId` de la
   asignación. Con varios grupos activos se toma aquel en el que entró más
   tarde: el `MiembroGrupo.createdAt` mayor. Es un desempate arbitrario y hay
   que escribirlo, no dejarlo al orden que devuelva la base.
4. Crea la asignación y lo lleva a `/recorridos/<id>`.

**Si ya tenía asignación de ese recorrido, no se toca nada**: se le lleva allí y
punto. No se reutiliza `asignarA` (`lib/acciones.ts:40`), que hace un `upsert`
con `archivada: false` y reescribe el `profesorId`: por esa vía un alumno
resucitaría una asignación que su profe archivó, o le cambiaría el dueño a su
propia entrega. La acción del alumno crea, o no hace nada.

**El bloque 3 no tiene botón de empezar.** Enseña los exámenes blancos que su
profe ya le asignó, con las mismas tarjetas, y si no hay ninguno dice a quién
pedirlo.

## El estado en las tarjetas

Cuatro estados, todos de datos que ya existen:

- **Sin empezar** — no hay asignación. Botón «Empezar».
- **A medias · 2 de 4 tareas** — hay asignación y algunos `PasoCompletado`.
  Botón «Seguir».
- **Entregado** — todos los pasos entregados, ninguno revisado.
- **Revisado · 21/30** — corregido, con sus puntos.

`estadoDePasos` (`lib/progreso.ts:123`) ya devuelve por paso si está `ENTREGADO`
o `REVISADO` y sus puntos, pero **no se llama una vez por tarjeta**: con
veintiocho secuencias en el bloque 2 son veintiocho consultas. En su lugar, una
sola consulta agrupada —las asignaciones del alumno para los recorridos de ese
bloque, con el recuento de completados— y las tarjetas leen de ese mapa. Una
consulta por página, no por tarjeta.

## Errores

Se dicen, no se tragan. `empezarPractica` devuelve un motivo y la tarjeta lo
enseña donde estaba el botón:

- «Habla con tu profe para que te dé un grupo» — alumno sin grupo activo.
- «Este examen lo abre tu profesor» — bloque 3.
- «Esta secuencia todavía es un borrador» — sin publicar.

## Verificación

`scripts/verificar-preparacion.ts`, con el estilo de la casa (`afirmar`, datos
propios que se borran al terminar). Tiene que fallar si alguien rompe:

- Un recorrido no publicado no sale en el catálogo ni se puede empezar.
- Un recorrido del bloque 3 no se puede empezar aunque se escriba su id a mano.
- Un alumno sin grupo, o con el grupo archivado, recibe el motivo y no una
  asignación.
- Un alumno bloqueado no se autoasigna nada.
- La asignación nace con el profesor del grupo del alumno.
- Con asignación ya existente, empezar otra vez no la desarchiva, no le cambia
  el profesor y no reinicia sus escuchas.
- El resumen dice «a medias 2 de 4» con dos pasos entregados de cuatro, y
  «revisado» con sus puntos cuando el profe corrigió.
- Una secuencia de preparación creada con bloque 2 se queda en el 2.

## Lo que este diseño no hace

- **Reintentos.** Un examen se hace una vez. Cambiarlo pediría romper el único
  de `Asignacion` y meter el concepto de intento, del que colgarían escuchas,
  pasos completados y entregas.
- **Panel del alumno.** Historial, resultados por prueba y evolución son otro
  proyecto: sin varios exámenes hechos no hay nada que enseñar.
- **Encadenar las cuatro pruebas en un simulacro cronometrado.** El bloque 3
  lista pruebas asignadas; agruparlas en un examen completo pide un concepto
  nuevo por encima del recorrido.
- **Cargar el material.** Subir el Examen 1 no depende de esta página: se hace
  con lo que ya existe.
