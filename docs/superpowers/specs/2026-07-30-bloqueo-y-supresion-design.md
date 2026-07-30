# Bloquear, suprimir y borrar una clase

Fecha: 2026-07-30

## El problema

Nada se puede quitar de en medio. Una ficha creada con el correo mal escrito se
queda en la lista para siempre. Un estudiante que lo dejó hace un año sigue
apareciendo como si fuera a volver mañana. Y si alguien ejerce su derecho a que
se borren sus datos, hoy no hay forma de cumplirlo sin entrar a mano en la base.

Al borrado en crudo se le vio la costura al diseñar el panel de administrador y
se dejó fuera de alcance a propósito: *un profesor con secuencias y asignaciones
vivas no se borra sin decidir qué pasa con todo eso*. Esa decisión sigue sin
tomarse, y ahora hay más cosas colgando de una persona que entonces —clases,
deberes, horas trabajadas—, así que el problema es mayor.

Concretamente, borrar hoy una fila de `User` haría tres cosas distintas y
ninguna buena:

- **Bloquearía la operación** si tiene alguna asignación, algún grupo propio o
  alguna clase como profesor: son claves con `RESTRICT` y la base se niega.
- **Dejaría huérfanas sus clases** como estudiante: la clave es
  `ON DELETE SET NULL`, así que quedarían sin estudiante y sin grupo — el estado
  exacto que `validarClase` prohíbe.
- **Se llevaría por delante las horas que le diste**, que son tuyas y puede que
  facturadas.

Y falta una cosa más pequeña que el plan del diario dejó anotada: *«Borrar una
clase. Se puede anular, que es lo que hace falta. Borrar de verdad se añade si
estorba»*. Estorba.

## Qué construimos

Tres capacidades:

1. **Bloquear** a una persona: pierde el acceso, su ficha se ve apagada, sus
   clases futuras se anulan. Reversible.
2. **Suprimir** a una persona: se le vacía la ficha de todo lo identificable y
   se borra su rastro personal, pero **la fila no se borra** y sus clases siguen
   contando horas e importe. Irreversible.
3. **Borrar una clase** agendada o anulada.

**La idea que sostiene las dos primeras: la fila de `User` no se borra nunca.**
Suprimir la vacía y la deja como lápida. Eso resuelve de paso la deuda del
`ON DELETE SET NULL`, porque nunca hay una fila que desaparezca bajo los pies de
otra.

---

## Los datos

Dos campos en `User`, y **una sola migración**:

```prisma
  /// Cuándo se le cerró el acceso. Null = entra con normalidad.
  bloqueadoEl  DateTime?
  /// Cuándo se le vació la ficha. Null = la ficha es de una persona real.
  suprimidoEl  DateTime?
```

**Fechas y no booleanos** porque además de saber que está bloqueado quieres
saber desde cuándo, y una fecha lo dice sin costar nada.

**Dos campos y no un estado único** (`ACTIVO | BLOQUEADO | SUPRIMIDO`) porque no
son excluyentes: quien está suprimido está bloqueado por definición. Con un solo
estado habría que contestar cuál gana; con dos fechas la pregunta no existe.

Nada más. Ni tabla de registro de quién bloqueó a quién, ni motivo escrito: es
otra funcionalidad, y este proyecto tiene un solo administrador.

---

## El bloqueo

### Quién puede

Solo un administrador, desde `/admin/personas`, que es donde ya se reparten los
roles. Un profesor no bloquea a nadie.

Dos negativas, las mismas que ya protegen a `quitarProfesor`:

- **Nadie se bloquea a sí mismo.**
- **No se bloquea al último administrador.**

Sin ellas, un clic te deja fuera de tu propia aplicación y solo se arregla
entrando a la base a mano. `ADMIN_EMAILS` no es red aquí: esa variable sube el
rol, no abre la puerta.

### Qué hace

- Pone `bloqueadoEl`.
- **Anula sus clases futuras**: las que están `AGENDADA` con `empiezaEl` en el
  futuro y en las que esa persona es el estudiante **o** el profesor, pasan a
  `ANULADA`. Las ya dadas no se tocan: son horas trabajadas.
- **No toca las clases de grupo donde solo es un miembro más.** Esa clase no es
  suya: los demás siguen teniéndola.

**Una consecuencia que hay que ver venir:** si a quien se bloquea es un
**profesor**, anular sus clases futuras anula también las de *sus* estudiantes,
que no han hecho nada. Es lo correcto —esa clase no la va a dar nadie— pero
significa que a varios alumnos les desaparece el cartel de «tu próxima clase»
sin explicación. Con un solo profesor el caso no se da; queda escrito para el
día que se dé.
- **No toca sus secuencias asignadas.** Se quedan donde están, sin progreso
  nuevo porque no puede entrar.

### El candado

**`getUsuarioActual` devuelve `null` para una persona bloqueada.**

Esa es la decisión importante y el motivo de que esté ahí y no en otro sitio:
todo pasa por esa función, así que las comprobaciones que ya existen —cada
página con su `if (!usuario) redirect(...)`, `exigirProfesor`, `exigirAdmin`—
fallan cerradas solas, sin una sola línea nueva que alguien pueda olvidarse de
escribir. La alternativa, un `exigirActivo()` en cada acción, es justo la clase
de cosa que se olvida: es el mismo error que coló el agujero de los deberes
ajenos en la tanda 1.

La comprobación va **antes** del ascenso por `ADMIN_EMAILS`: a un bloqueado no
se le sube el rol al entrar, aunque su correo esté en la variable.

### Qué ve cada uno

**La persona bloqueada** entra con su cuenta y encuentra un cartel: su acceso
está bloqueado, que hable con su profesor. No una página rota ni un 404.

Ese cartel vive en `app/(app)/layout.tsx`, un único sitio que envuelve toda la
zona con sesión. Como `getUsuarioActual` ya devolvió `null`, el layout no puede
distinguir «bloqueado» de «sin sesión»; para eso pregunta una segunda vez, y
**solo cuando el usuario ha salido nulo**, si la sesión de Clerk corresponde a
una ficha bloqueada. Una consulta de más únicamente en el caso raro.

**El administrador** ve su fila apagada en `/admin/personas`, con la etiqueta
«Bloqueado» y un botón **Desbloquear**.

**Desbloquear** devuelve el acceso y **no resucita las clases anuladas**.
Anularlas fue una decisión; deshacerla a espaldas del profesor sería peor que
dejársela a él.

---

## La supresión

Irreversible y sin papelera. Por eso lleva dos frenos:

1. **Solo se puede suprimir a alguien que ya esté bloqueado.** Obliga a pasar
   por un gesto reversible antes del que no lo es.
2. **Hay que escribir su correo** en el formulario para confirmar. Obliga a
   mirar a quién se está suprimiendo.

Y valen las mismas dos negativas: ni a uno mismo, ni al último administrador.

### Qué se borra de verdad

- Su cuenta de Google (`CuentaGoogle`).
- Su pertenencia a los grupos (`MiembroGrupo`).
- Sus deberes (`Deber`).
- **Sus asignaciones (`Asignacion`) y, en cascada, todo su progreso**
  (`PasoCompletado`): los pasos que marcó, lo que respondió en cada ejercicio y
  los puntos que le dieron.

### Qué se vacía

En su propia fila: `firstName`, `lastName`, `nivel`, `tarifaCentimos` y
`clerkId` pasan a `null`, y el correo pasa a
`suprimido-<id>@hispaprofe.invalid`.

El correo se sustituye en vez de vaciarse porque la columna es única y no acepta
nulos; el `id` es un `cuid`, así que el nuevo correo es único por construcción y
el dominio `.invalid` está reservado por norma para que no sea de nadie jamás.

`clerkId` a `null` importa: sin él, la cuenta de acceso no vuelve a engancharse
a esta ficha si esa persona se registra otra vez. Empezaría de cero, como
cualquier desconocido.

`role` pasa a `STUDENT`. No cambia nada práctico —no puede entrar— pero deja la
lápida sin poderes por si algún día alguien mira la base a mano.

### Qué se queda

- **Sus clases**, con fecha, duración, tus notas, su estado y su importe. Se
  enseñan como «Estudiante suprimido» o «Profesor suprimido». Son tus horas, no
  las suyas, y puede que las hayas facturado.

  Para poder escribir esa etiqueta, las dos pantallas de clases y el perfil del
  estudiante tienen que traerse `suprimidoEl` en su `select` — sin él verían el
  correo `suprimido-<id>@hispaprofe.invalid` en crudo, que es feo y además
  parece un correo de verdad.
- **Sus grupos, si era profesor** (`Grupo.profesorId` apunta a la lápida).
- **Las asignaciones que creó como profesor**: pertenecen a sus estudiantes.

### Qué se queda sin firma

Las secuencias, ejercicios y archivos de los que fuera autor pasan a no tener
autor —`autorId` y `subidoPorId` a `null`—, igual que ya les ocurre a las
secuencias sembradas antes de que existiera ese campo. El contenido sobrevive,
la firma no.

---

## Borrar una clase

En la ficha de la clase, y **solo si está `AGENDADA` o `ANULADA`**. Una clase
`DADA` no se borra: primero se vuelve a agendar —un gesto consciente— y entonces
sí.

Al borrarla se van sus filas de `Deber` con ella, por la cascada que ya existe.

El botón va escondido tras un desplegable, no suelto al lado de «Guardar los
cambios». La borra su profesor o un administrador, con la misma comprobación de
propiedad que ya usan las demás acciones de la ficha.

---

## Dónde vive el código

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | **Modificar.** Los dos campos y su migración. |
| `lib/roles.ts` | **Modificar.** `estaBloqueado(usuario)`, función pura, junto a `esAdmin`. |
| `lib/usuario.ts` | **Modificar.** `getUsuarioActual` devuelve `null` si está bloqueado; `bloqueoDelActual()` para el cartel. |
| `lib/admin.ts` | **Modificar.** `puedeBloquearse`, `bloquear`, `desbloquear`, `puedeSuprimirse`, `suprimir`. |
| `lib/clases.ts` | **Modificar.** `sePuedeBorrar(estado)` y `borrarClase(claseId)`. |
| `lib/acciones-admin.ts` | **Crear.** Las acciones de administración, incluidas las tres que hoy viven en `lib/acciones.ts`. |
| `lib/acciones.ts` | **Modificar.** Se le quitan `hacerProfesor`, `quitarProfesor` e `invitarProfesor`, que se mudan enteras. |
| `lib/acciones-clases.ts` | **Modificar.** La acción de borrar la clase. |
| `app/(app)/admin/personas/page.tsx` | **Modificar.** Fila apagada, etiquetas, y los formularios de bloquear, desbloquear y suprimir. |
| `app/(app)/layout.tsx` | **Modificar.** El cartel de cuenta bloqueada. |
| `app/(app)/profe/clases/[id]/page.tsx` | **Modificar.** El desplegable de borrar. |
| `scripts/verificar-personas.ts` | **Crear.** Las verificaciones. |

**Por qué se mudan las tres acciones de administración.** `lib/acciones.ts`
tiene 1.112 líneas y las nuevas son cinco más. Dejar unas en un archivo y otras
en otro sería peor que cualquiera de las dos opciones puras, así que se mudan
las tres que ya hay. Es una mudanza, no una reescritura.

**Por qué las salvaguardas van en `lib/admin.ts` y no dentro de las acciones.**
Una acción de servidor no se puede llamar desde un script: necesita sesión de
Clerk y contexto de petición. Lo que está fuera es lo único verificable de
verdad. Es la decisión que ya se tomó con `puedeQuitarseElRol` y con
`congelarImporte`.

---

## Cómo se verifica

No hay framework de pruebas. `scripts/verificar-personas.ts`, al estilo de
`scripts/verificar-admin.ts`: crea sus propios datos y los borra al terminar.

Comprueba:

1. `estaBloqueado` distingue una ficha con fecha de una sin ella, y tolera
   `null`.
2. Bloquear pone la fecha y **anula las clases futuras** de esa persona, como
   estudiante y como profesor.
3. Bloquear **no toca** sus clases ya dadas, ni las de un grupo donde solo es
   miembro.
4. No se puede bloquear al último administrador, ni bloquearse a uno mismo.
5. Desbloquear quita la fecha y **no resucita** las clases anuladas.
6. Suprimir a quien no está bloqueado se rechaza.
7. Suprimir borra asignaciones, progreso, deberes, membresías y cuenta de
   Google.
8. Suprimir **deja las clases en pie** con su importe intacto.
9. El correo de una ficha suprimida es único: suprimir a dos personas seguidas
   no choca.
10. Un ejercicio o secuencia de su autoría se queda sin autor, no se borra.
11. `sePuedeBorrar` acepta `AGENDADA` y `ANULADA` y rechaza `DADA`.
12. Borrar una clase se lleva sus deberes.

Más `npx tsc --noEmit`, `npm run lint` y los scripts que ya existen.

Lo que el script no cubre y se prueba a mano: que una persona bloqueada vea el
cartel al entrar, porque hace falta una sesión real de Clerk.

---

## Fuera de alcance

- **Registro de quién bloqueó o suprimió a quién, y por qué.** Con un solo
  administrador no aporta nada todavía.
- **Avisar por correo a la persona bloqueada o suprimida.** La aplicación no
  envía correos, aquí tampoco.
- **Exportar los datos de alguien antes de suprimirlo.** Es la otra mitad del
  derecho al olvido y merece su propio diseño.
- **Bloquear temporalmente, con fecha de vuelta.** Se bloquea y se desbloquea a
  mano.
- **Que un profesor bloquee a sus estudiantes.** Hoy hay un administrador y es
  el mismo profesor; el día que haya varios, se decide entonces.
- **Deshacer una supresión.** No se puede, y es a propósito.
