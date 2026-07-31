# El cloze dentro del texto

Fecha: 2026-07-31

## El problema

La Tarea 4 de comprensión de lectura del A2/B1 escolar es un texto con siete
huecos, cada uno con tres opciones. Hoy se monta con el pasaje en un bloque
`TEXTO` del paso y los siete desplegables debajo, en la lista que pinta la cara
de `opcion`.

Leer eso es ir y volver. Se lee «Nunca **(19)** sabe dónde puede estar…», hay
que bajar a buscar el desplegable 19, elegir, y subir otra vez a retomar la
frase. Siete veces. El examen en papel no hace eso: el hueco está en su sitio y
las opciones al pie de la misma página.

El profesor lo dijo tras probarlo: «me parece un poco difícil seguir la lectura
cuando los números están tan abajo».

## Qué construimos

Que `opcion` sepa pintar sus desplegables **dentro de un texto**, en el sitio
exacto del hueco.

No es un tipo nuevo. Es un campo opcional en el que ya existe.

---

## El principio: quien no lo use no se entera

`texto` es opcional. Sin él, la cara de `opcion` hace exactamente lo de hoy: una
lista numerada de preguntas con sus botones o su desplegable. Las Tareas 2 y 3
del mismo examen, que son de `opcion` y no llevan pasaje, no cambian ni un píxel.

**Ningún ejercicio existente se queda inválido.** El campo nace opcional y sin
valor por defecto.

---

## El esquema

`opcionSchema` gana un campo:

```ts
  /// Pasaje con marcas {{id}} donde va cada hueco. Con él, el desplegable se
  /// pinta dentro del texto y no en una lista debajo.
  ///
  /// Es lo que distingue un cloze de una batería de preguntas: en el cloze,
  /// la pregunta *es* el hueco y sacarla del texto la deja sin contexto.
  texto: z.string().optional(),
```

### La presentación deja de mirarse

Con `texto`, el control es siempre el desplegable. `presentacion` no se consulta:
una fila de botones incrustada en mitad de un párrafo no es una opción de diseño
que nadie vaya a querer, y admitirla obligaría a inventar cómo se pinta.

No se rechaza la combinación —`presentacion: "botones"` con `texto` valida sin
protestar—; simplemente se ignora. Rechazarla sería un error nuevo que no
protege de nada: el resultado de ignorarla es el que el profesor quería.

### La regla nueva: las marcas tienen que cuadrar

Si hay `texto`, cada marca `{{id}}` corresponde a una pregunta y cada pregunta
tiene su marca. Ni marcas huérfanas ni preguntas sin sitio.

Es **la misma regla que `huecos` ya hace cumplir** (`lib/ejercicios/huecos.ts`),
y por el mismo motivo, que conviene repetir porque no es obvio: las marcas del
texto y los ids de las preguntas se escriben en dos sitios distintos del script
de siembra, sin editor que los enlace. Con un id que no cuadra, la cara dibuja un
desplegable por marca y el progreso cuenta sobre `preguntas`, así que el
estudiante puede rellenar todo lo que ve y el contador nunca llega al total: el
botón de enviar no se activa nunca. Mejor rechazarlo al sembrar que descubrirlo
con un alumno atascado.

Sin `texto` la regla no aplica: no hay marcas que cuadrar.

---

## La limpieza que hace falta por el camino

`trozos()` —la función que parte un texto en trozos alternos por sus marcas—
vive hoy en `lib/ejercicios/huecos.ts`. La necesita `opcion`.

Importarla de `huecos` ataría dos tipos que no comparten nada: el día que
`huecos` cambie, `opcion` se entera sin motivo.

**Se mueve a `lib/ejercicios/tipos.ts`**, que es el archivo del contrato común,
junto con una función nueva que comprueba que las marcas cuadran con una lista
de ids. `huecos` pasa a importarla de allí y usa la misma comprobación en su
`refine`, que hoy tiene escrita a mano.

Ninguna de las dos sabe nada de huecos ni de opciones: una parte por `{{...}}` y
la otra compara dos conjuntos de ids. Es donde tenían que haber estado.

---

## La cara

`components/ejercicios/opcion.tsx` se bifurca al principio: con `texto`, pinta el
pasaje; sin él, la lista de siempre.

El pasaje es un párrafo con interlineado holgado —los desplegables son más altos
que la línea— donde cada marca se sustituye por un `<select>` con las opciones de
esa pregunta. El desplegable en blanco enseña `?`, igual que ahora.

### La corrección, en el hueco

Corregido, el desplegable se queda deshabilitado con la opción que eligió el
estudiante dentro: ya se ve lo que contestó, sin repetirlo. Se colorea según
acierte o falle, y **cuando falla, la respuesta buena aparece pegada al hueco**,
en la misma línea.

Debajo del texto, el recuento: «Aciertos: 6 de 7».

Esto es distinto de lo que hace `huecos`, que apila los veredictos en una lista
al final. Aquí no hace falta: releyendo el texto corregido se ve todo, y una
lista de «Bien ✓» sin decir de qué hueco —que es lo que `huecos` enseña hoy— no
informa de nada.

**La lista de veredictos de `huecos` se queda como está.** De `huecos` solo
cambia de dónde importa `trozos` —una línea en `huecos.ts` y otra en
`huecos.tsx`—; lo que pinta no se toca. Mejorar esa lista es una conversación
aparte, y arreglarla de paso aquí mezclaría dos cambios que no tienen por qué
caer juntos.

### El progreso no cambia

`progresoOpcion` cuenta preguntas contestadas y le da igual dónde se pinten. Con
`texto` o sin él, cuenta lo mismo.

---

## Lo que arrastra

### El sembrador

`scripts/sembrar-dele-a2b1-lectura.ts`: en la Tarea 4, el pasaje sale del bloque
`TEXTO` y entra en el `texto` del ejercicio, con `{{19}}`…`{{25}}` en vez de las
marcas `**(19)**` de ahora. El paso se queda sin bloque, que es lo correcto: el
texto es del ejercicio.

De paso, el ejercicio queda **autónomo** — se puede reutilizar desde Recursos en
otra secuencia sin arrastrar un bloque suelto que hay que acordarse de copiar.

Las otras tres tareas no se tocan. Y el sembrador ya comprueba su propia clave,
así que si algo de esto rompe la Tarea 4, deja de dar 25/25 y lo dice.

### El editor de recursos

`components/recursos/editor-opcion.tsx` gana el campo del pasaje, con su aviso
cuando las marcas no cuadran con las preguntas. El aviso avisa y no impide
guardar: es el patrón que ya sigue el editor con el número de ítems.

---

## Verificación

`npx tsc --noEmit`, `npm run lint` y dos scripts.

**`scripts/verificar-recursos.ts`** gana las suyas:

- que el esquema **rechace** un texto con una marca que no es de ninguna
  pregunta;
- que **rechace** una pregunta que no tiene marca en el texto;
- que **acepte** un `opcion` sin `texto`, que es el caso de casi todos;
- que `versionPublica` lleve el texto al navegador —sin él la cara no puede
  pintar nada— y que siga sin llevar las respuestas correctas;
- que `trozos` parta un texto de `opcion` igual que uno de `huecos`, ahora que
  la comparten.

**`scripts/sembrar-dele-a2b1-lectura.ts`** es la otra verificación, y la que
prueba el conjunto: si sigue diciendo 25/25 después del cambio, el cloze se
corrige igual que antes desde otro sitio.

**A mano**, que es lo que un script no ve: abrir la Tarea 4 con la cuenta del
estudiante, comprobar que se lee de corrido, contestar y ver que los aciertos se
colorean en su sitio y que el fallo enseña la buena al lado.

---

## Fuera de alcance

- **Los huecos de `relacionar`.** El `GAP_INSERT` de B1 y B2 sigue en dos
  columnas: soltar cada fragmento dentro del texto es arrastrar y soltar, con su
  propia cara de cliente. Ya estaba anotado como posible evolución en el diseño
  del Creador DELE y sigue estándolo.
- **La lista de veredictos de `huecos`.** No dice de qué hueco es cada uno, y eso
  se nota con siete. Es un arreglo real, pero de otro tipo de ejercicio.
- **Que el editor enseñe el texto con los huecos ya pintados.** El editor tendrá
  un campo de texto y un aviso, no una previsualización viva. La
  previsualización que ya existe en Recursos enseña el ejercicio de verdad.
