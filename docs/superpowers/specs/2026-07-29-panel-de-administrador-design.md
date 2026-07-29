# Panel de administrador

Fecha: 2026-07-29

## El problema

`ADMIN` existe en el esquema y se comprueba en quince sitios del código. En los
quince significa exactamente lo mismo que `PROFESOR`: la condición siempre es
`role === "PROFESOR" || role === "ADMIN"`. Un administrador **no puede hacer hoy
nada que un profesor no pueda**.

Y hay un problema más gordo debajo: **nadie puede llegar a ser profesor a través
de la aplicación**. Todas las fichas se crean con `role: "STUDENT"` — en
`getUsuarioActual`, en `crearEstudiante`, en `meterCorreosEnGrupo`, en la
sincronización con Classroom. No existe ni una pantalla que cambie un rol.

Eso ya ha mordido: el profesor entró en producción, la aplicación le creó una
ficha nueva —la base de producción es distinta de la de desarrollo— con rol
`STUDENT`, y se quedó viendo el panel del alumno sin forma de salir de ahí salvo
editando la base de datos a mano.

## Qué construimos

Un área `/admin`, separada de `/profe`, con su propio candado, donde un
administrador nombra profesores y ve el estado de la plataforma.

**Por qué separada y no dentro de `/profe`:** hoy "administrador" y "profesor"
son sinónimos en quince condiciones. Si el panel viviera dentro de `/profe`, esa
confusión se quedaría para siempre. Un área aparte obliga a que el candado sea
distinto, que es justo lo que falta.

### Cómo se nace administrador

Una variable de entorno con los correos, separados por comas:

```
ADMIN_EMAILS=a.lopez.ele@hotmail.com
```

`getUsuarioActual` la lee en cada entrada: si el correo de quien entra está en la
lista y su rol todavía no es `ADMIN`, lo asciende. Da igual el orden — se puede
registrar antes y añadir la variable después.

**La variable solo sube, nunca baja.** Quitarle el rol a alguien desde el panel
no sirve de nada si su correo sigue en la variable: la próxima vez que entre
volverá a ser administrador. Es deliberado: es la red que impide quedarse fuera
de la propia aplicación. Retirar el acceso de verdad exige las dos cosas.

Consecuencia asumida: nunca hay que tocar la base de datos, ni ahora ni al montar
un entorno nuevo.

### El rol pasa a significar algo

Un administrador puede **todo lo que puede un profesor, y además lo suyo**. Las
quince condiciones `PROFESOR || ADMIN` que ya existen siguen siendo correctas y
no se tocan. Lo que se añade es un candado nuevo, más estrecho, solo para el área
de administración.

### Las tres pantallas

**`/admin` — el resumen.** Los números de salud: cuántas cuentas y de qué tipo,
cuántas secuencias y cuántas publicadas, cuántos ejercicios, y cuánto ocupan las
imágenes y audios. Este último importa: los archivos viven dentro de la base de
datos, así que conviene ver el tamaño antes de que dé problemas.

**`/admin/personas` — el corazón.** Todas las cuentas: correo, rol, nivel, y si
ya ha entrado alguna vez o sigue siendo una ficha sin reclamar. Con buscador.
En cada fila, **hacer profesor** o **quitar profesor**. Arriba, un campo para
**invitar por correo** a alguien que aún no se ha registrado: se crea su ficha ya
con rol de profesor y, cuando entre por primera vez, se la encuentra hecha —el
mismo mecanismo que ya usan los alumnos.

**`/admin/biblioteca` — el material de todos.** Todas las secuencias, no solo las
propias: título, nivel, autor, número de pasos y a cuántos estudiantes está
asignada. Con un aviso visible en las que no tienen autor, que son las sembradas
antes de que existiera ese campo.

### Las salvaguardas

Las tres existen para lo mismo: que nadie se quede fuera de su propia aplicación.

- **Nadie puede quitarse a sí mismo el rol de administrador.** El botón no
  aparece en la propia fila.
- **No se puede dejar la plataforma sin ningún administrador.** Si es el último,
  la acción se niega.
- **Todo se comprueba en el servidor.** `exigirAdmin()`, gemelo del
  `exigirProfesor()` que ya existe, lo usan tanto las páginas como las acciones.
  Esconder un botón no es seguridad.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `lib/admin.ts` | `exigirAdmin()`, el candado del servidor. |
| `lib/usuario.ts` | El ascenso por variable de entorno, dentro de `getUsuarioActual`. |
| `app/(app)/admin/page.tsx` | El resumen y la salud. |
| `app/(app)/admin/personas/page.tsx` | Las cuentas y sus roles. |
| `app/(app)/admin/biblioteca/page.tsx` | Todas las secuencias. |
| `lib/acciones.ts` | `hacerProfesor`, `quitarProfesor`, `invitarProfesor`. |
| `app/(app)/layout.tsx` | El enlace «Administración», solo para administradores. |

**Cero cambios en la base de datos.** El rol `ADMIN` ya existe en el enum `Role`.

## Errores y casos límite

| Caso | Comportamiento |
|---|---|
| `ADMIN_EMAILS` sin definir | Nadie asciende. La aplicación funciona igual; el área `/admin` queda inaccesible para todos. |
| Correo en la variable con mayúsculas o espacios | Se compara en minúsculas y sin espacios, como ya hace `getUsuarioActual` con el correo de Clerk. |
| Un profesor escribe `/admin` a mano | `exigirAdmin()` lo rechaza. No basta con esconder el enlace. |
| El administrador intenta quitarse el rol | El botón no se dibuja en su fila, y la acción lo rechaza igualmente. |
| Queda un solo administrador y se le intenta quitar el rol | La acción se niega. |
| Invitar un correo que ya tiene ficha | Se le sube el rol a profesor en vez de crear una ficha duplicada. |
| Invitar un correo mal escrito | Se rechaza con el mismo criterio que ya usa `parsearCorreos`. |
| Secuencia sin autor | Aparece marcada en la biblioteca; no es un error. |

## Comprobación

El proyecto no tiene framework de pruebas. Se sigue el precedente de
`scripts/verificar-cifrado.ts` y `scripts/verificar-ejercicios.ts`: un
`scripts/verificar-admin.ts` ejecutable con `tsx` que verifica:

1. Un correo presente en `ADMIN_EMAILS` asciende a `ADMIN`; uno ausente, no.
2. El ascenso es idempotente: entrar dos veces no cambia nada la segunda.
3. `exigirAdmin()` rechaza a un `STUDENT` y a un `PROFESOR`, y acepta a un `ADMIN`.
4. `quitarProfesor` sobre el último administrador se niega.
5. `invitarProfesor` con un correo existente sube el rol en vez de duplicar la ficha.
6. `invitarProfesor` con un correo inválido no crea nada.

Más una pasada manual: poner el correo en la variable, entrar, comprobar que
aparece «Administración», nombrar profesor a una segunda cuenta y comprobar que
esa cuenta ve el panel del profesor.

## Fuera de alcance

- **Borrar cuentas.** Un profesor con secuencias creadas y asignaciones vivas no
  se puede borrar sin decidir qué pasa con todo eso. Quitarle el rol ya lo deja
  sin poderes, que es lo que hace falta casi siempre.
- **Registro de quién hizo qué.** Sin traza de acciones administrativas.
- **Editar el contenido ajeno desde la biblioteca.** Es una vista de consulta.
- **Invitar por correo electrónico de verdad.** La invitación crea la ficha; no
  se envía ningún mensaje.
