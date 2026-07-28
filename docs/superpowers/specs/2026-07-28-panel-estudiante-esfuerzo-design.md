# Panel del estudiante: que vea su esfuerzo

Fecha: 2026-07-28

## El problema

El profesor ya otorga puntos: a mano desde `/profe/alumnos/[id]` y en lote desde el
importador de Genially. Esos puntos se guardan en `PasoCompletado.puntos` junto con
`verificadoEl`, y **el estudiante no los ve en ninguna pantalla**. La devolución existe
en la base de datos y se queda en el lado del profesor.

Su panel muestra hoy un saludo y la lista de secuencias asignadas con una barra de
progreso construida solo con sus propios checks. Nada de lo que el profesor hace al
revisar llega hasta él.

Hay además un agujero: `desmarcarPasoHecho` borra la fila `PasoCompletado` con un
`deleteMany`, y esa fila es donde viven `puntos` y `verificadoEl`. Si el estudiante
desmarca un paso ya revisado, la corrección del profesor desaparece sin aviso ni rastro.
Hoy pasa inadvertido porque nadie ve los puntos; en cuanto se muestren, será un agujero
por el que se vacía la hucha.

## Qué construimos

Los puntos son **una hucha que suma**: un acumulado sin techo ni nota. No se guarda el
máximo posible de cada paso, así que no hay "40 sobre 50". Esto no exige ningún cambio
en el esquema de la base ni en el importador.

### Los tres estados de un paso

El estudiante distingue hoy solo *hecho* / *no hecho*. Se hace visible el estado
intermedio que ya existe en los datos:

| Estado | Cómo se determina | Qué ve el estudiante |
|---|---|---|
| `PENDIENTE` | no hay fila `PasoCompletado` | nada |
| `ENTREGADO` | hay fila y `verificadoEl` es `null` | "Esperando a tu profe" |
| `REVISADO` | `verificadoEl` tiene fecha | "Revisado · N pts" |

`verificadoEl` es el discriminador fiable. Las dos rutas que otorgan puntos
(`otorgarPuntos`, `importarPuntos`) escriben siempre `puntos` y `verificadoEl` a la vez,
y vaciar el campo de puntos pone los dos a `null`.

Dos consecuencias asumidas:

- Un paso puede estar `REVISADO` con **0 puntos** (corrección legítima). Se muestra
  "Revisado · 0 pts", sin ocultarlo.
- `importarPuntos` crea la fila aunque el estudiante nunca marcase el paso, así que un
  paso puede llegar a `REVISADO` sin pasar por `ENTREGADO`. El modelo lo admite: el
  estado se decide por `verificadoEl`, no por una secuencia obligatoria.

### El panel: la hucha y las bandejas

**La hucha.** Número grande arriba con los puntos acumulados y una línea de apoyo
("12 pasos revisados por tu profe"). Cuenta **también las asignaciones archivadas**: la
hucha es el historial de la persona y archivar una secuencia no debe vaciarle el
marcador. Sin puntos todavía, en lugar de un "0" se muestra: *"Aún no tienes puntos. Se
ganan cuando tu profe revisa un paso."*

**Dos bandejas**, en columnas, mirando solo asignaciones vivas (`archivada: false`):

- *Esperando revisión* — pasos `ENTREGADO`, con el título del paso, el de su secuencia y
  cuánto hace que se entregaron. Orden: `completadoEl` descendente.
- *Tu profe ha revisado* — los **cinco** últimos `REVISADO`, con sus puntos. Orden:
  `verificadoEl` descendente.

**Sus secuencias.** La lista actual con su barra de progreso, sin cambios, al final.

### Las señales donde trabaja

**Lista de pasos de una secuencia** (`/recorridos/[id]`). El círculo numerado de cada
paso pasa a mostrar el estado: el número si está `PENDIENTE`, un ✓ si `ENTREGADO`, y si
está `REVISADO`, el ✓ más sus puntos junto al título. La página hoy solo consulta la
asignación cuando el usuario es profesor; pasa a cargarla también para el estudiante.

**Página del paso** (`/pasos/[pasoId]`). Encima del botón, una línea de estado:
*"Entregado el 3 de julio. Esperando a tu profe."* o *"Tu profe lo revisó: 40 puntos."*

### Cerrar el agujero

Regla: **un paso `REVISADO` no se puede desmarcar.**

- En la interfaz, donde hoy hay un botón "Hecho ✓" que se apaga al pulsarlo, aparece una
  marca fija de revisado, sin acción.
- En el servidor, `desmarcarPasoHecho` comprueba `verificadoEl` antes de borrar y no hace
  nada si tiene fecha. Esta es la protección real; el candado de la interfaz solo evita
  el clic accidental.

No es un callejón sin salida para el profesor: vaciar el campo de puntos en la ficha del
alumno limpia `verificadoEl` y el paso vuelve a ser desmarcable.

## Estructura

`app/(app)/dashboard/page.tsx` son hoy dos páginas distintas separadas por un `if` en
233 líneas. Se parte, porque la vista del estudiante crece con este trabajo:

| Archivo | Responsabilidad |
|---|---|
| `app/(app)/dashboard/page.tsx` | Resuelve el usuario, decide el rol y delega. |
| `app/(app)/dashboard/panel-estudiante.tsx` | Hucha, bandejas y secuencias. |
| `app/(app)/dashboard/panel-profesor.tsx` | La vista actual del profesor, movida tal cual. |
| `lib/progreso.ts` | Consultas de estado y puntos, compartidas. |

`lib/progreso.ts` expone:

- `type EstadoPaso = "PENDIENTE" | "ENTREGADO" | "REVISADO"`
- `resumenEstudiante(usuarioId)` → `{ puntosTotales, pasosRevisados, esperandoRevision[], revisadosRecientes[] }`
- `estadoDePasos(asignacionId)` → mapa `pasoId → { estado, puntos }`, para la lista de
  pasos y la página del paso.

Vive en `lib/` y no dentro de la carpeta del dashboard porque lo consumen también
`/recorridos/[id]` y `/pasos/[pasoId]`. El panel del profesor no se modifica: solo se
mueve de archivo.

Archivos tocados fuera del dashboard:

- `app/(app)/recorridos/[id]/page.tsx` — cargar la asignación del estudiante y marcar los pasos.
- `app/(app)/pasos/[pasoId]/page.tsx` — línea de estado y estado bloqueado del botón.
- `lib/acciones.ts` — guarda en `desmarcarPasoHecho`.

## Errores y casos límite

| Caso | Comportamiento |
|---|---|
| Estudiante sin ninguna asignación | Mensaje actual de "todavía no tienes secuencias"; la hucha no se muestra. |
| Con asignaciones pero sin puntos | Hucha con el mensaje de "aún no tienes puntos", bandejas vacías con su propio texto. |
| Paso `REVISADO` con 0 puntos | Se muestra "Revisado · 0 pts". |
| Intento de desmarcar un paso revisado | La acción del servidor retorna sin borrar. Sin mensaje de error: la interfaz ya no ofrece el botón. |
| Asignación archivada | Sus puntos siguen sumando en la hucha; no aparece en las bandejas ni en la lista. |
| Profesor entrando a `/dashboard` | Sin cambios respecto a hoy. |

## Comprobación

El proyecto no tiene framework de pruebas. Se sigue el precedente de
`scripts/verificar-cifrado.ts`: un `scripts/verificar-puntos.ts` ejecutable con `tsx`
contra la base de desarrollo, que verifica tres reglas:

1. Un paso con `verificadoEl` sobrevive a una llamada a `desmarcarPasoHecho`.
2. Un paso solo entregado (`verificadoEl` nulo) sí se desmarca.
3. `resumenEstudiante` devuelve el mismo total que la suma directa de las filas
   `PasoCompletado` con `verificadoEl` no nulo.

El script crea sus propios datos y los borra al terminar. Además, una pasada manual con
una cuenta de estudiante de prueba recorriendo el bucle completo: marcar un paso, otorgar
puntos desde la ficha del alumno, comprobar que el panel y la secuencia lo reflejan.

## Fuera de alcance

Rachas y constancia, avance por destrezas (CO/CE/EO/EE), avisos de novedades desde la
última visita, notificaciones por correo, y guardar el máximo posible de cada paso para
convertir los puntos en nota.

Aparte, detectado durante el diseño y **no** abordado aquí: en `/recorridos` cualquier
estudiante ve todas las secuencias de la base, incluidas las no publicadas y las que no
tiene asignadas. Merece su propio análisis.
