# Recursos: la despensa de ejercicios

Fecha: 2026-07-30

## El problema

Hay un motor de ejercicios entero y **ninguna manera de crear uno**.

`lib/ejercicios/` sabe validar, repartir, barajar y corregir cuatro tipos
—`opcion`, `huecos`, `relacionar`, `ordenar`—, y `components/ejercicios/` sabe
pintarlos. La tabla `Ejercicio` los guarda y `PasoEjercicio` los cuelga de un
paso. Todo eso funciona. Pero las únicas filas de `Ejercicio` que existen en la
base las escribió `scripts/sembrar-ejercicios-demo.ts`, y las únicas filas de
`PasoEjercicio` también. **Ninguna pantalla de la aplicación crea ni lo uno ni
lo otro.**

Conviene decir qué sí existe, porque es más de lo que parece y encoge este
trabajo: crear una secuencia (`/profe/secuencias/nueva`), su ficha con crear,
mover y borrar pasos (`/recorridos/[id]`), la ficha del paso con su editor de
bloques (`/pasos/[pasoId]`), y asignar la secuencia a un estudiante o a un
grupo. La cadena `Ejercicio → PasoEjercicio → Paso → Recorrido → Asignacion →
estudiante` está completa en el modelo y le falta un solo eslabón en la
interfaz: el primero.

Detrás de esto viene el **Creador DELE**, que es lo que de verdad se pidió. Pero
un creador de ejercicios DELE que no tenga dónde depositarlos escribe filas que
ningún estudiante puede ver. Este diseño construye el sitio donde depositarlos.

## Qué construimos

**Recursos**: la colección de ejercicios de la plataforma, compartida por los
dos servicios. Los mismos ejercicios valen para clases particulares y para
preparación DELE; `PasoEjercicio` es muchos‑a‑muchos, así que un ejercicio puede
vivir en varios pasos de varias secuencias sin duplicarse.

Cuatro capacidades:

1. **Ver** los ejercicios que hay, con filtros.
2. **Crear y editar** uno, con un formulario por tipo y previsualización.
3. **Engancharlo** a un paso, y desengancharlo.
4. **Impedir** las seis maneras de romper el progreso de un estudiante o de
   guardar algo que nunca se verá.

**La idea que lo sostiene: el formulario es un formulario de ejercicio, con un
guía opcional encima.** Aquí se construye sin guía. El Creador DELE será ese
guía, y por eso este diseño no menciona el DELE en ninguna regla.

---

## El corte en tres

Lo que se pidió no cabe en un diseño. Se parte así, y este documento es el
primero:

| | Qué entra | Por qué va junto |
|---|---|---|
| **A · Recursos** | Este documento. La despensa, el editor libre y el enganche. | Es el sitio donde aterriza todo lo demás. |
| **B · Creador DELE** | `DELE_MAP`, el camino nivel→prueba→tarea→formato, los formularios guiados, los sobrantes en `relacionar` y el audio. | Es una capa fina sobre A: mismo formulario, mismo enganche, con un guía delante. |
| **C · Tareas productivas** | `WRITE` y `SPEAK`: rúbrica, texto modelo y la pantalla donde el profesor los corrige. | No pasan por el motor de autocorrección. Comparten migración y pantalla entre ellos, y nada con A ni con B. |

**El C2 no entra en ninguno de los tres.** El enum `Nivel` llega hasta `C1` a
propósito: ese nivel casi no se vende.

---

## Los datos

**Ninguna tabla nueva y ninguna columna nueva.** El modelo ya tiene todo lo que
hace falta: `Ejercicio` con `tipo`, `titulo`, `nivel`, `destreza`, `etiquetas`,
`datos`, `publicado` y `autor`; y `PasoEjercicio` con su `orden` y su unicidad
por `(pasoId, ejercicioId)`.

Una sola migración, y es de nombres:

```
TipoRecorrido.RECORRIDO   → CLASES_PARTICULARES
TipoRecorrido.PREPARACION → PREPARACION_DELE
```

Se escribe a mano con `ALTER TYPE ... RENAME VALUE`. Prisma, por su cuenta,
tiende a tirar el tipo y rehacerlo, que con datos vivos es otra operación
distinta y peor.

**Por qué se renombran.** `PREPARACION` a secas no dice de qué es la
preparación, y la etiqueta que sí lo decía —«Preparación DELE»— vivía solo en la
interfaz. Y `RECORRIDO` era la peor de las dos: repetía la palabra que ya nombra
el modelo `Recorrido` y la ruta `/recorridos`, así que `tipo: RECORRIDO` dentro
de un `Recorrido` no distinguía nada.

**Ojo con el `next dev` abierto.** Tras esta migración hay que reiniciarlo
(`npm run fresh`): `lib/prisma.ts` fija el cliente en `globalThis` y el proceso
viejo se queda con el enum antiguo.

### La etiqueta del servicio, en un solo sitio

Hoy la tabla que traduce el enum a castellano está **copiada a mano en siete
archivos**: `admin/biblioteca`, `profe/grupos/[id]`, `profe/alumnos/[id]`,
`profe/secuencias/nueva`, `dashboard/panel-estudiante`, `recorridos/page` y
`recorridos/[id]`. Todas idénticas, todas llamadas `servicioLabel`.

Se juntan en una, en **`lib/servicios.ts`**, y las siete pantallas la importan.
En su propio módulo y no en `lib/recursos.ts`: habla de `TipoRecorrido`, que es
el servicio contratado, y no tiene nada que ver con los ejercicios. Meterla en
Recursos obligaría a media aplicación a importar Recursos para pintar una
palabra.

Es la lección que ya quedó escrita en la deuda del plan del bloqueo: *cuando
algo se escribe de memoria en varios sitios, tarde o temprano falta en uno*.

### `Ejercicio.tipo` deja de escribirse a mano

La columna `Ejercicio.tipo` (el enum `TipoEjercicio` de la base) y el campo
`datos.ejercicio` (el discriminante que lee `lib/ejercicios/registro.ts`) son
dos datos distintos que tienen que decir lo mismo. La correspondencia entre
ellos existe hoy dentro de `scripts/sembrar-ejercicios-demo.ts`, en una
constante `TIPO_DE_EJERCICIO`, con un comentario que ya avisa de que nada la
vigila.

Esa tabla sube a `lib/recursos.ts` y la acción de guardar **la deriva sola**. El
profesor elige el tipo una vez, al empezar; deja de haber dos sitios donde
puedan discrepar.

`TipoEjercicio.WIDGET` se queda fuera: no tiene ningún `datos.ejercicio` que le
corresponda y el motor no lo sabe renderizar. Recursos no crea widgets.

---

## Las pantallas

**`/profe/recursos`** — la lista. Filtros por nivel, destreza, tipo y estado
(publicado o borrador), y búsqueda por título. Cada fila dice de cuántos pasos
cuelga: es el dato que evita borrar algo que está en uso, y el que hace visible
que un ejercicio se reutiliza.

**`/profe/recursos/nuevo`** — eliges tipo y entras en su editor. Esta es la
puerta libre, la de clases particulares.

**`/profe/recursos/[id]`** — el editor de un ejercicio guardado, con la
previsualización al lado.

**`/pasos/[pasoId]`** — se le añade una sección de ejercicio junto a la de
bloques: un selector para enganchar **uno** de Recursos (ver la regla 2) y un
botón para desengancharlo. El selector solo ofrece ejercicios publicados, y por
omisión los del nivel del recorrido. Aquí nace la fila `PasoEjercicio` que hoy
no nace en ninguna parte.

**`/admin/biblioteca` pasa a `/admin/secuencias`**, que es lo que lista de
verdad. El nombre «biblioteca» se queda libre y no se usa: la colección de
ejercicios se llama **Recursos**.

### Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `lib/recursos.ts` | Las reglas y la tabla que deriva `Ejercicio.tipo`. **Fuera de las acciones.** |
| `lib/servicios.ts` | La etiqueta de `TipoRecorrido`, hoy copiada en siete pantallas. |
| `lib/acciones-recursos.ts` | Las acciones de servidor. Sigue a `acciones-admin.ts` y `acciones-clases.ts`. |
| `components/recursos/editor-<tipo>.tsx` | Un editor por tipo, en espejo de las cuatro caras de `components/ejercicios/`. |
| `components/recursos/previsualizacion.tsx` | El envoltorio que reúne una cara con el botón de corregir. |
| `scripts/verificar-recursos.ts` | Ejercita las reglas contra filas reales. |

**Las reglas van en `lib/recursos.ts` y no dentro de las acciones** por el
motivo que ya está establecido en el proyecto: una acción de servidor necesita
sesión de Clerk y contexto de petición, así que no se puede llamar desde un
script. Lo que está fuera es lo único verificable. Es la decisión que ya se tomó
con `puedeQuitarseElRol`, `congelarImporte` y `estudianteAsignable`.

---

## El editor: una pieza por tipo

Cuatro editores escritos a mano, uno por tipo, y no un generador de formularios
a partir de los esquemas.

El motor ya reparte cada tipo en tres piezas —su forma (esquema zod), su cara
(componente de cliente) y su cuenta (función de corrección)—, cada una en su
archivo. Esto le añade una cuarta, el editor, en el mismo sitio y con la misma
lógica de reparto.

**Por qué no un generador.** Los cuatro tipos son distintos justo donde un
generador no llega. `huecos` exige que las marcas `{{id}}` del texto cuadren una
a una con la lista de huecos. `opcion` se bifurca entre opciones propias de cada
pregunta y una lista común para todas, y esa bifurcación cambia el formulario
entero. `relacionar` prohíbe que dos parejas compartan el texto de la derecha, y
en B le entrarán además los sobrantes. Son tres reglas cruzadas de cuatro tipos:
un generador tendría que saberselas igual, así que no ahorra trabajo — solo lo
esconde y añade un generador que mantener.

**Por qué no un editor de JSON.** Se construiría en una tarde y podría expresar
cualquier ejercicio válido. Se descarta por el usuario: obliga a escribir llaves
y corchetes para colocar una tilde.

---

## La previsualización es el motor

Una acción de servidor recibe el `datos` que hay en el editor y las respuestas
que el profesor haya ido metiendo, y devuelve la corrección llamando a
`analizar` → `versionPublica` → `corregir`. **Ninguna de las tres toca la
base**: son funciones puras. No hace falta que el ejercicio esté guardado, ni
que exista una `Asignacion`, ni un `PasoCompletado`.

Dos precisiones, para no prometer de más:

- **La corrección es literalmente la misma.** `corregir()` de
  `lib/ejercicios/registro.ts`, sin una sola rama nueva. No hay una segunda
  verdad que se pueda separar de la primera.
- **Las caras son literalmente las mismas.** `CaraOpcion`, `CaraHuecos`,
  `CaraRelacionar` y `CaraOrdenar` ya tienen una interfaz limpia (`PropsCara`:
  `publica`, `valor`, `alCambiar`, `correccion`, `cerrado`) y no saben nada de
  acciones de servidor.

Lo único que se escribe nuevo es el envoltorio con el botón, porque el del
estudiante (`components/ejercicios/ejercicio.tsx`) llama a `responderEjercicio`,
que comprueba asignación, vínculo con el paso y que no haya respondido ya. La
previsualización no debe hacer nada de eso.

**La semilla del barajado.** `relacionar` y `ordenar` barajan con
`semillaDe(ejercicioId)`, que mezcla el id con `ENCRYPTION_KEY`. Un borrador sin
guardar todavía no tiene id, así que la previsualización usa una semilla fija y
literal. No se pierde nada: ese secreto existe para que un estudiante no
resuelva el ejercicio leyendo el código de la página, y aquí quien mira es quien
acaba de escribir las soluciones.

---

## Las reglas

Seis, en `lib/recursos.ts`. Cada una devuelve el motivo del rechazo o `null` si
se puede, siguiendo la forma de `puedeBloquearse`.

**1. Un borrador no se engancha a un paso.** Todo ejercicio nace con
`publicado: false`. Se edita y se previsualiza cuanto haga falta, pero hasta que
no se publica no puede colgar de un paso. Es el freno que impide que algo a
medio escribir aparezca delante de un estudiante.

Publicar es un botón del editor, y lo único que exige es que el `datos` pase
`analizar()` — que es lo mismo que exige guardar, así que en la práctica nunca
falla ahí. Se puede volver a borrador mientras el ejercicio no cuelgue de ningún
paso. Un ejercicio publicado y enganchado, pero que todavía no ha respondido
nadie, **sí se edita con normalidad**: no hay respuestas que romper.

**2. Un paso admite un solo ejercicio.** Esto no es una restricción nueva, es
hacer visible una que ya existe y hoy no se ve. `app/(app)/pasos/[pasoId]/page.tsx`
toma **el primero por orden** y descarta el resto, con este motivo escrito en el
código: *la corrección escribe los puntos del paso entero, así que dos
ejercicios en el mismo paso se pisarían*. Como nada crea filas de
`PasoEjercicio` todavía, la situación no se ha dado nunca. En cuanto exista el
selector, sí puede darse: engancharías un segundo ejercicio, la pantalla te
diría que sí, y el estudiante no lo vería jamás. **El selector rechaza el
segundo con su motivo**, y para cambiar de ejercicio primero se desengancha el
que hay.

**3. Un ejercicio enganchado no se borra: se despublica.** No es una regla
inventada, es evitar un fallo: la relación de `PasoEjercicio` hacia `Ejercicio`
no tiene borrado en cascada, así que borrar hoy un ejercicio enganchado revienta
contra una clave foránea. Mejor rechazarlo con un motivo en castellano.

Las tres siguientes son la misma, vista por tres puertas. **`PasoCompletado`
guarda las respuestas del estudiante indexadas por el id de cada pregunta**, y
el motor renderiza un ejercicio por paso. Hay tres maneras de dejar esas
respuestas apuntando a un id que ya no existe:

**4. De un paso con respuestas guardadas no se desengancha el ejercicio.**

**5. En un paso con respuestas guardadas no se cambia un ejercicio por otro.**
Con la regla 2, cambiar es desenganchar y volver a enganchar, así que esta se
apoya en la anterior en vez de repetirla.

**6. Un ejercicio que ya respondió alguien no se edita: se duplica.** Sale un
botón que crea una copia en borrador; se edita la copia. **No hay sistema de
versiones** — no hace falta y es caro. El original se queda quieto para que las
respuestas que apuntan a él sigan significando algo.

---

## Los errores se dicen

Las acciones de Recursos **devuelven el motivo del rechazo y la pantalla lo
enseña**. No vuelven en silencio.

Esto decide, solo para Recursos, la pregunta que quedó aparcada en la deuda del
plan del bloqueo (*«que las acciones vuelvan en silencio sigue sin decidirse
para toda la aplicación»*). Aquí la respuesta es clara porque un editor que se
traga un error sin decir nada es inusable: te quedas mirando la pantalla sin
saber si guardó.

Los mensajes ya están escritos y no hay que redactar una segunda tanda: los
esquemas zod del motor los traen en castellano y explicando el porqué («Las
marcas `{{...}}` del texto no coinciden con los ids de `huecos`», «Dos parejas
no pueden compartir el mismo texto en `derecha`…»).

Esto **no** resuelve la pregunta para el resto de la aplicación. Pone el primer
caso donde sí importa y sirve de precedente cuando se retome.

---

## Verificación

No hay framework de pruebas y este diseño no introduce ninguno. Se sigue el
precedente: `npx tsc --noEmit`, `npm run lint` y un script `tsx` que ejercita
las reglas contra filas reales, al estilo de `scripts/verificar-personas.ts`.

**`scripts/verificar-recursos.ts`** comprueba:

- Las seis reglas, cada una con su fila de verdad: un borrador al que se le
  niega el enganche; un paso con un ejercicio al que se le niega el segundo; un
  ejercicio enganchado al que se le niega el borrado; un paso con respuestas al
  que se le niega desenganchar y cambiar; un ejercicio respondido al que se le
  niega editar y sí se le permite duplicar.
- Que un ejercicio publicado y enganchado **pero sin responder** sí se deja
  editar. Sin esta fila, una implementación que bloqueara por «está enganchado»
  en vez de por «tiene respuestas» pasaría igual todas las demás.
- Que `Ejercicio.tipo` sale bien derivado de `datos.ejercicio` en los cuatro
  tipos.
- Que `analizar()` rechaza un `datos` roto y que la acción no guarda nada.

Idempotente y limpiando lo que crea, como los demás.

**A mano**, que es lo que un script no puede ver: crear un ejercicio de cada
tipo desde el editor, previsualizarlo y responderlo ahí mismo, publicarlo,
engancharlo a un paso, y abrirlo con la cuenta de estudiante para confirmar que
se ve igual que en la previsualización.

---

## Fuera de alcance

- **Todo lo que sea DELE.** `DELE_MAP`, el camino guiado, los sobrantes en
  `relacionar`, el audio. Es el diseño B, y depende de este.
- **`WRITE` y `SPEAK`.** Diseño C.
- **Guardar audios e imágenes en Recursos.** El nombre lo sugiere y la tabla
  `Archivo` ya guarda cualquier mime, pero hace falta en B —para las tareas de
  comprensión auditiva— y no antes. Se diseña allí.
- **Versionar un ejercicio.** La regla 5 lo esquiva con una copia. Un historial
  de versiones es otra funcionalidad.
- **Compartir Recursos entre profesores.** Hoy hay un solo profesor. `autorId`
  ya está en la tabla para cuando deje de serlo.
- **Importar ejercicios desde un Genially.** Otro asunto, con su propio diseño.
- **Elegir el ejercicio de un paso por algo que no sea el nivel.** La lista de
  candidatos del selector se acota al nivel del recorrido, con `?todos=1` como
  única puerta de salida: no hay filtro por destreza, por tipo ni por título
  ahí dentro. Con el DELE hará falta más, porque un ejercicio de otro nivel
  puede ser justo el que toca.
- **`Ejercicio.etiquetas` está sin usar** más allá de guardarse y pintarse. No
  se puede filtrar ni buscar por ellas. Es el sitio natural donde el diseño B
  colgará la tarea y el formato del DELE, y habrá que decidir allí si eso son
  etiquetas o una columna propia.
- **Papelera y recuperación.** Un ejercicio suelto —sin ningún paso detrás— se
  borra de verdad y no se puede recuperar. Es deliberado: sirve para tirar los
  borradores que uno deja por el camino, y guardar una papelera para eso sería
  construir un armario para la basura. Lo que nunca se borra es lo que cuelga de
  un paso, y de eso se ocupa la regla 3.
