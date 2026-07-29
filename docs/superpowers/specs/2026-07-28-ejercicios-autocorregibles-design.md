# Cinco tipos de ejercicio autocorregible

Fecha: 2026-07-28

## El problema

HispaProfe tiene un solo tipo de ejercicio autocorregible: la opción única, con
una pregunta y una respuesta buena. El profesor necesita cinco formas distintas
de preguntar, porque una clase de lengua no se sostiene sobre un único formato.

Hay además dos límites que estorban a cualquiera de ellos:

- Al enviar, el estudiante solo ve su nota. No sabe qué falló, justo en el
  momento en que más receptivo está.
- Lo que respondió no se guarda en ninguna parte. El profesor ve el resultado,
  nunca el razonamiento.

## Qué construimos

Cinco tipos, todos autocorregidos en el servidor, todos volcando sus puntos a la
hucha del estudiante sin intervención del profesor:

| Tipo | Qué hace el estudiante |
|---|---|
| **Opción única** | Elige una respuesta entre varias |
| **Opción múltiple** | Marca todas las que valen |
| **Huecos** | Escribe la palabra que falta en cada hueco |
| **Relacionar** | Une cada elemento con su pareja, arrastrando |
| **Ordenar** | Coloca las piezas en su orden |

**Fuera de este trabajo, a petición del profesor:** seleccionar palabras dentro
de un texto (por ejemplo, marcar los verbos en pasado). Es el único de los seis
que pedía añadir un valor nuevo a `TipoEjercicio`.

### Un motor, cinco caras

Una sola maquinaria hace lo común —guardar, corregir, puntuar, enseñar la
corrección— y cada tipo aporta solo tres piezas:

1. **Su forma**: qué campos describen su contenido (esquema de validación).
2. **Su cara**: cómo se dibuja para el estudiante.
3. **Su cuenta**: cómo se convierten sus respuestas en aciertos.

Añadir un sexto tipo será escribir esas tres piezas, no rehacer el motor. La
razón concreta de no montar cinco ejercicios independientes: la corrección vive
en el servidor por seguridad, y así hay **una sola puerta que vigilar** en vez
de cinco.

`Ejercicio.datos` ya es un campo JSON, así que las cinco formas caben sin
migración. `TipoEjercicio` ya contempla `OPCION_MULTIPLE`, `HUECOS`,
`RELACIONAR` y `ORDENAR`.

**Opción única y opción múltiple no son dos tipos**, sino el mismo con un
interruptor `multiple: boolean`. Es el mismo ejercicio con distinto control:
botón redondo o casilla. Ambos viven bajo `OPCION_MULTIPLE`.

### La lista compartida

El mismo tipo cubre un tercer formato que el profesor usa en clase: una lista de
frases y, en cada una, un desplegable con **los mismos nombres para todas**
(*Tiene el pelo rizado* → ¿Fede, Luisa, Carmen…?).

Dos añadidos lo resuelven:

- `opcionesComunes`: cuando está, las preguntas no llevan sus propias opciones y
  todas comparten esa lista.
- `presentacion`: `"botones"` o `"desplegable"`. Con once frases y seis nombres,
  once filas de botones serían una pared; el desplegable cabe.

**Y una consecuencia deliberada: la misma opción puede valer para varias
preguntas.** Carmen puede tener el pelo rizado y llevar gafas. Por eso este
formato es opción única y no `relacionar`: relacionar empareja uno a uno y
suelta la pieza si la reutilizas, que es justo lo contrario de lo que hace falta
aquí.

### Cómo se cuentan los puntos

| Tipo | Regla | Máximo |
|---|---|---|
| Opción única | Acierta o no | 1 por pregunta |
| Opción múltiple | Cada buena marcada suma 1; cada mala marcada resta 1; nunca baja de 0 **en esa pregunta** | número de respuestas buenas |
| Huecos | 1 por hueco correcto | número de huecos |
| Relacionar | 1 por pareja correcta | número de parejas |
| Ordenar | 1 por **pareja consecutiva** correcta | número de piezas menos una |

Los fallos solo restan en **opción múltiple**, que es el único donde marcarlo
todo daría los puntos sin saber nada. En los demás no existe el exceso: cada
hueco, cada pareja y cada posición admite una sola respuesta.

**Ordenar puntúa por vecindad, no por posición absoluta.** Con el orden correcto
`A B C D`, quien responda `B C D A` acierta las parejas `B→C` y `C→D`: 2 de 3.
Puntuar por posición le habría dado cero por un desplazamiento, que castiga un
descuido como si fuera desconocimiento. Consecuencia asumida: un ejercicio de
seis piezas vale cinco puntos, no seis.

**Los huecos perdonan la forma, no el fondo.** Cada hueco acepta una lista de
respuestas válidas, y la comparación ignora dos cosas: las mayúsculas y los
espacios sobrantes al principio y al final. Un A1 no debe perder un punto por
escribir con mayúscula inicial.

**Los acentos sí cuentan.** Escribir "balcon" por "balcón" es un fallo, porque
la tilde es parte de la palabra y esto es una clase de lengua. Si el profesor
quiere perdonarlos en algún hueco concreto, puede añadir la forma sin tilde a
la lista de respuestas válidas de ese hueco.

### Lo que ve el estudiante al enviar

Cada elemento se marca en verde o rojo y, en los fallados, aparece cuál era la
respuesta correcta.

**Las soluciones nunca salen del servidor antes de tiempo.** Mientras el
ejercicio está abierto, al navegador solo viaja la versión pública: enunciados y
opciones, sin las respuestas. Solo cuando el ejercicio queda cerrado
—`verificadoEl` con fecha, imposible reenviar— se manda la corrección.

Se envía **una sola vez**. Repetir hasta acertar vaciaría de sentido la hucha.

### Lo que se guarda

Una columna nueva, `PasoCompletado.respuestas` (JSON, opcional): lo que el
estudiante marcó, escribió, emparejó u ordenó.

Sirve para dos cosas: que la corrección siga ahí cuando vuelva a abrir el paso
—si no, se perdería al recargar— y que el profesor pueda ver **qué contestó**,
no solo cuánto sacó. Es el primer ladrillo de algo que el profesor pidió aparte:
poder revisar las respuestas una a una.

Es el único cambio de base de datos de todo el trabajo.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `lib/ejercicios/tipos.ts` | La unión de los cinco tipos y el contrato común: versión pública, corrección, resultado. |
| `lib/ejercicios/opcion.ts` | Forma, versión pública y cuenta de opción única y múltiple. |
| `lib/ejercicios/huecos.ts` | Ídem para huecos. |
| `lib/ejercicios/relacionar.ts` | Ídem para relacionar. |
| `lib/ejercicios/ordenar.ts` | Ídem para ordenar, con la cuenta por vecindad. |
| `components/ejercicios/ejercicio.tsx` | Reparte según el tipo y pinta lo común: consigna, botón de enviar, nota. |
| `components/ejercicios/opcion.tsx` | La cara de opción única y múltiple. |
| `components/ejercicios/huecos.tsx` | La cara de huecos. |
| `components/ejercicios/relacionar.tsx` | La cara de relacionar, arrastrando. |
| `components/ejercicios/ordenar.tsx` | La cara de ordenar, arrastrando. |
| `lib/acciones.ts` | Una sola acción, `responderEjercicio`, que reparte según el tipo. |

El trabajo actual queda absorbido: `lib/ejercicios/opcion-multiple.ts` y
`components/opcion-multiple.tsx` se convierten en `opcion.ts` y
`components/ejercicios/opcion.tsx`, y la acción `responderOpcionMultiple` pasa a
ser un caso de `responderEjercicio`. Los ejercicios ya sembrados con la forma
antigua se vuelven a sembrar; no hay ninguno en producción.

**Arrastrar, con red de seguridad.** Relacionar y ordenar se manejan
arrastrando, porque el estudiante trabaja siempre desde ordenador. Además
responden a un toque simple —tocar origen, tocar destino—, que cuesta poco y
evita que el ejercicio quede inservible el día que abra la clase en el móvil.

## Errores y casos límite

| Caso | Comportamiento |
|---|---|
| Envía sin contestar todo | El botón no se activa hasta que no queda nada en blanco. |
| Marca todas las opciones en múltiple | Los fallos restan; la pregunta se queda en cero. |
| Ordena todo desplazado un lugar | Pierde un punto, no todos. |
| Escribe "Hay" donde se esperaba "hay" | Cuenta como acierto. |
| Recarga después de enviar | Ve su nota y su corrección: las respuestas están guardadas. |
| Intenta enviar dos veces | La acción no hace nada: el paso ya tiene fecha de verificación. |
| Un paso con dos ejercicios autocorregibles | **No soportado.** Los puntos viven en la casilla del paso; dos ejercicios se pisarían. Se renderiza el primero. Quitar el límite va con el proyecto del editor. |
| El profesor abre el paso | Ve la hoja con las soluciones marcadas, para revisarlas. |
| `datos` con forma inválida | El ejercicio no se dibuja y no rompe la página. |

## Comprobación

El proyecto no tiene framework de pruebas. Se sigue el precedente de
`scripts/verificar-cifrado.ts` y `scripts/verificar-ejercicios.ts`: un script
ejecutable con `tsx` que verifica, para los cinco tipos:

1. Que la versión pública **no contiene ninguna solución**, en ninguno de los cinco.
2. Que la cuenta de puntos da lo esperado en el caso perfecto, el caso a medias
   y el caso vacío.
3. Que en opción múltiple marcarlo todo da cero, no el máximo.
4. Que ordenar puntúa por vecindad: el desplazamiento cuesta un punto.
5. Que los huecos aceptan mayúsculas y espacios sobrantes.
6. Que todo ejercicio guardado en la base tiene forma válida y sus respuestas
   correctas apuntan a algo que existe.

Más una pasada manual con la cuenta de un estudiante recorriendo los cinco.

## Fuera de alcance

- **Seleccionar palabras dentro de un texto.** Aplazado por el profesor.
- **La pantalla para crear ejercicios.** Hoy se siembran con script. Es un
  proyecto propio, del mismo tamaño o mayor que este.
- **Varios ejercicios autocorregibles en un mismo paso.**
- **Ver las respuestas del estudiante desde la ficha del profesor.** La columna
  queda guardada y disponible, pero la pantalla que la muestra no entra aquí.
