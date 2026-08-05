# Borrar una secuencia

Fecha: 2026-08-05

## El problema

No se puede. Se puede borrar un paso, un bloque, un ejercicio y hasta una
persona, pero no una secuencia entera: no hay ni una sola llamada a
`prisma.recorrido.delete` en toda la aplicación.

Se nota enseguida en cuanto se prueba algo. En la base de desarrollo conviven
hoy «S3L1_LA FAMILIA DE OSCAR» y «¿Piso o Casa?» con «<sdfsdfsd» y «TEST DE
RPEUCEPSFS», y no hay forma de quitar las dos últimas de en medio.

## Qué construimos

Un borrado de secuencia, con su regla de quién puede y un aviso que diga la
verdad sobre lo que destruye.

---

## Quién puede

Una función pura, `puedeBorrarRecorrido(usuario, recorrido)`:

| Quién | Secuencia con autor | Secuencia sin autor |
|---|---|---|
| Administrador | sí | sí |
| Profesor, es suya | sí | — |
| Profesor, es de otro | no | no |
| Estudiante, o nadie | no | no |

La fila de la secuencia sin autor no es un caso raro que haya que inventarse:
**es el caso normal ahora mismo**. `Recorrido.autorId` admite nulo, el material
que se copie de la base de desarrollo a la de producción entrará sin autor
—los usuarios del portátil no existen allí— y lo sembrado por los scripts
tampoco firma. Dejar eso al alcance de cualquier profesor sería abrir la mano
justo donde no se sabe de quién es la cosa.

Vive en `lib/recorridos.ts`, fuera de la acción, por el criterio ya establecido
en el proyecto: una acción de servidor necesita sesión y contexto de petición,
así que no se puede llamar desde un script, y **lo que está fuera es lo único
verificable**. Es el mismo sitio que ocupa `esDeEsteProfesor` en
`lib/expresion.ts`.

---

## Qué se lleva por delante

Todo en una transacción. El orden importa, porque las claves ajenas no
perdonan:

1. **Los archivos de las entregas** — ver el apartado siguiente.
2. **Las citas del oral** y **las escuchas**, por `pasoId`.
3. **Los pasos completados**, por `pasoId`.
4. **Los bloques** y **los enganches a ejercicios**, por `pasoId`.
5. **Las asignaciones**, por `recorridoId`.
6. **Los pasos**, y por fin **la secuencia**.

Lo de las citas y las escuchas merece decirse en voz alta porque es una trampa
puesta: `CitaOral.pasoId` y `Escucha.pasoId` **no tienen relación declarada**
—está razonado en el esquema— así que nada las borra en cascada. `borrarPaso`
ya lo aprendió con las citas (`lib/acciones.ts:550`); aquí hay que acordarse de
las dos.

### Los ejercicios no se borran

Viven en la biblioteca de Recursos, se comparten entre secuencias y tienen su
propio borrado. Lo único que desaparece es el enganche, la fila de
`PasoEjercicio`. Borrar el ejercicio al borrar una secuencia le vaciaría el
material a otra que lo estuviera usando.

---

## Las grabaciones, que es lo que de verdad hay que acertar

`PasoCompletado.entrega` guarda, en una oral grabada, la dirección de la
grabación del alumno: `/api/archivos/<id>`. Esos `Archivo` llevan `privado` en
verdadero por un motivo que el proyecto ya tiene escrito: **son voces de
alumnos, a menudo menores de edad**.

Si la secuencia se borra sin más, esas filas se quedan en la base para siempre.
No es que ocupen sitio: es que quedan **sin nada que las referencie**, así que
ya no hay forma de llegar a ellas ni para suprimirlas. Una grabación de un
menor que nadie puede encontrar y nadie puede borrar es exactamente lo que este
proyecto viene evitando en `lib/admin.ts`, donde suprimir una persona se lleva
también su voz.

Así que la transacción empieza recogiendo las entregas de los pasos de esta
secuencia, sacando de ellas los identificadores de archivo, y borrando esos
`Archivo` con lo demás.

### El mismo agujero, un piso más abajo

`borrarPaso` no lo hace: borra los pasos completados de ese paso y deja atrás
tanto las escuchas como los archivos de sus entregas. Es el mismo fallo, en el
borrado de al lado, y se arregla en este trabajo. No es ampliar el alcance por
gusto: es que la función que resuelve esto va a estar escrita a diez líneas de
distancia, y dejar el vecino roto a sabiendas es peor que el trabajo de
llamarla.

---

## El aviso

El botón cuenta antes de preguntar. Con trabajo dentro:

> Esta secuencia tiene 3 alumnos asignados, 12 pasos hechos, 2 notas puestas y
> 1 grabación. Se borra todo y no hay vuelta atrás.

Sin nadie que la haya tocado:

> Se borrarán la secuencia y sus 4 pasos.

Las cifras se cuentan en el servidor al pintar la página, no en el navegador:
el aviso tiene que decir lo que hay, no lo que el cliente crea que hay.

El botón va en la página de la secuencia, `/recorridos/[id]`, junto a lo que ya
se edita ahí, y usa el `BotonConfirmar` que ya existe para las acciones
destructivas. Solo se pinta a quien puede: enseñar un botón que va a contestar
«no tienes permiso» es una promesa que no se piensa cumplir.

Al terminar, vuelta a `/recorridos`. Es lo que ya hace borrar un paso, que
devuelve a la secuencia.

---

## Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `lib/recorridos.ts` | **Crear.** `puedeBorrarRecorrido`, y la lectura de las cifras del aviso. |
| `lib/acciones.ts` | **Modificar.** La acción `borrarRecorrido`, y el arreglo de `borrarPaso`. |
| `app/(app)/recorridos/[id]/page.tsx` | **Modificar.** El botón, y las cifras que lo acompañan. |
| `scripts/verificar-borrado-recorrido.ts` | **Crear.** Los cuatro permisos y el barrido completo. |

---

## Verificación

`npx tsc --noEmit`, `npm run lint` y un script nuevo, que crea sus propios
datos y los borra al terminar, como los quince que ya hay.

**`scripts/verificar-borrado-recorrido.ts`** monta una secuencia con un paso,
un bloque, un ejercicio enganchado, una asignación con un paso completado cuya
entrega apunta a un `Archivo`, una cita de oral y una escucha. Comprueba:

- los cuatro casos de `puedeBorrarRecorrido`: administrador con secuencia
  ajena, profesor con la suya, profesor con la de otro, y profesor con una
  sin autor;
- que tras borrar no queda ni la secuencia, ni el paso, ni el bloque, ni el
  enganche, ni la asignación, ni el paso completado, ni la cita, ni la escucha,
  ni el archivo de la grabación;
- que **el ejercicio sigue vivo**, que es la mitad de la gracia;
- que borrar un paso suelto tampoco deja atrás su escucha ni el archivo de su
  entrega.

**A mano**: borrar «<sdfsdfsd» desde la pantalla y comprobar que el aviso corto
sale cuando no hay nadie asignado.

---

## Fuera de alcance

- **Archivar en vez de borrar.** Se consideró: `Grupo` y `Asignacion` ya tienen
  su `archivado`, y sería no perder nunca nada. Se descarta porque lo que hace
  falta hoy es quitar basura de pruebas de en medio, y archivar la deja donde
  estaba y además pide una pantalla para ver lo archivado.
- **Deshacer.** No hay papelera, y el aviso lo dice.
- **Borrado en lote** desde la lista de secuencias. Una cada vez.
