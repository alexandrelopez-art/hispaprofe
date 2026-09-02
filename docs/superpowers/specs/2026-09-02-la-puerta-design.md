# La puerta: entrada propia, sin Clerk, y todo lo de dentro cerrado

Fecha: 2026-09-02. Entrega 1 de tres (puerta → carcasa → taller del examen).

## El problema

Tres cosas, comprobadas en vivo el 2 sept 2026:

1. **Entrar molesta.** La instancia de Clerk que usa producción
   (`magnetic-hen-52`, de desarrollo) tiene la contraseña marcada como *no
   válida para entrar*: el único factor es un código por correo, en cada
   entrada y en cada aparato. Esa instancia vive en una cuenta de Clerk a la
   que no hay acceso; la instancia nueva lleva doce días en 0/5 de
   verificación DNS. No hay nada que pulsar desde nuestro lado.
2. **La puerta está abierta.** `proxy.ts` es `clerkMiddleware()` sin
   proteger rutas y `app/(app)/layout.tsx` no redirige sin usuario. Sin
   sesión, `/recorridos`, `/recorridos/<id>` y `/pasos/<id>` devuelven el
   examen entero, y el listado enseña borradores. `app/test-ejercicio` es una
   página de pruebas publicada por descuido.
3. **El alumno no encuentra el DELE.** `/preparacion` no está enlazada desde
   ningún menú ni panel.

Decisiones del profesor (2 sept): contraseña propia que él entrega al
estudiante; sin Clerk; orden puerta → carcasa → taller.

## Qué construimos

- Entrada con **correo y contraseña**, guardada por nosotros. Sin correos de
  verificación, sin terceros.
- El profesor **da de alta** al estudiante y le pone una contraseña inicial que
  la pantalla enseña **una sola vez**. Al entrar por primera vez el estudiante
  debe cambiarla. Si la olvida, el profesor le pone otra desde su ficha.
- **Todo lo que no es la portada exige sesión.** Sin ella, se va a `/entrar` y
  vuelve después a la página pedida.
- **Preparación DELE** en el menú y en el panel del estudiante.
- Clerk desaparece del código y del `package.json`.

## Qué no cambia

Roles (`STUDENT`/`PROFESOR`/`ADMIN`), el ascenso por `ADMIN_EMAILS`, bloqueo y
supresión de fichas, el audio racionado, la corrección, la portada pública, el
mapa del DELE. Las cuatro cuentas de producción conservan todo; solo necesitan
una contraseña.

---

## Los datos

Una migración, dos cambios.

### `User`, cuatro columnas nuevas

```prisma
  /// Contraseña cifrada (scrypt). Null = nunca se le ha puesto: no puede entrar.
  contrasenaHash        String?
  /// True tras una contraseña puesta por el profesor o por script: al entrar
  /// se le exige cambiarla antes de seguir.
  debeCambiarContrasena Boolean   @default(false)
  /// Intentos fallidos seguidos. Se pone a cero al entrar bien.
  intentosFallidos      Int       @default(0)
  /// Hasta cuándo se rechaza cualquier intento por exceso de fallos.
  intentosBloqueadosHasta DateTime?
```

`clerkId` **se queda** (nullable, sin uso). Quitarlo es una migración
destructiva que no aporta nada a esta entrega; va con la limpieza de la
carcasa.

### `Sesion`, tabla nueva

```prisma
/// Una sesión abierta en un navegador. La cookie lleva el token en claro; aquí
/// se guarda su hash, para que una copia de la base no sirva para entrar.
model Sesion {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  usuario   User     @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId String
  caducaEl  DateTime
  createdAt DateTime @default(now())

  @@index([usuarioId])
}
```

Tabla y no cookie firmada sin estado, porque hace falta **revocar**: cuando el
profesor pone una contraseña nueva, las sesiones viejas de ese estudiante se
cierran. `onDelete: Cascade` para que suprimir una ficha se lleve sus sesiones.

---

## La cookie

Nombre `hp_sesion`. Valor: 32 bytes aleatorios en hex. `httpOnly`, `sameSite:
"lax"`, `secure` fuera de desarrollo, `path: "/"`, `maxAge` 30 días. La fila
`Sesion.caducaEl` lleva la misma fecha; la que manda es la de la base.

---

## Las piezas

Todas las reglas viven en `lib/`, sin `"use server"`, para que
`scripts/verificar-entrada.ts` las ejercite contra la base local, como hace el
resto del repo.

### `lib/contrasena.ts` (puro, sin base)

- `cifrarContrasena(texto): Promise<string>` — `scrypt` de `node:crypto`
  (N=16384, r=8, p=1, 32 bytes), sal de 16 bytes. Formato
  `scrypt$<sal hex>$<hash hex>`. Sin dependencias: Vercel no lleva binarios
  y `bcrypt` nativo es justamente eso.
- `comprobarContrasena(texto, hash): Promise<boolean>` — `timingSafeEqual`.
- `generarContrasena(): string` — 10 caracteres de un alfabeto sin ambiguos
  (`abcdefghjkmnpqrstuvwxyz23456789`), con `randomInt`. Legible por teléfono.
- `validarContrasena(texto): string | null` — devuelve el motivo o null. Regla
  única: **8 caracteres o más**. Nada de mayúsculas obligatorias.

### `lib/entrada.ts` (reglas contra la base)

```ts
export const MAX_INTENTOS = 5;
export const MINUTOS_DE_CASTIGO = 15;

export type ResultadoEntrada =
  | { ok: true; usuario: User }
  | { ok: false; motivo: "credenciales" | "demasiados-intentos" | "sin-acceso" };

export async function intentarEntrar(
  email: string, contrasena: string, ahora = new Date(),
): Promise<ResultadoEntrada>
```

Orden de comprobación, y por qué:

1. Normalizar el correo (`trim().toLowerCase()`), buscar la fila. Sin fila →
   `credenciales`. **El mismo motivo que una contraseña mal**: no se revela
   qué correos existen.
2. Si `intentosBloqueadosHasta > ahora` → `demasiados-intentos`, sin comprobar
   nada más ni contar el intento.
3. Sin `contrasenaHash` → `credenciales` (nunca le pusieron una).
4. Contraseña mal → `intentosFallidos + 1`; si llega a `MAX_INTENTOS`, se pone
   `intentosBloqueadosHasta = ahora + 15 min` y el contador a cero. Devuelve
   `credenciales` (o `demasiados-intentos` si acaba de cerrarse).
5. Contraseña bien pero `bloqueadoEl` o `suprimidoEl` → `sin-acceso`. Va
   **después** de la contraseña a propósito: un desconocido no puede saber si
   una cuenta está bloqueada probando correos.
6. Bien → contador a cero, `intentosBloqueadosHasta = null`, `ok`.

También aquí, para que el script y el guion de emergencia compartan la regla:

```ts
/// Pone una contraseña nueva desde fuera (profesor o script). Devuelve la
/// contraseña en claro: es la única vez que existe fuera del hash.
export async function ponerContrasenaNueva(usuarioId: string): Promise<string>
```

Guarda el hash, `debeCambiarContrasena = true`, contador a cero,
`intentosBloqueadosHasta = null` y borra las sesiones de ese usuario.

El bloqueo por intentos es por cuenta y no por IP: en Vercel la IP no es
fiable y con cuatro usuarios lo que hay que parar es el ataque a *una*
cuenta. Cuesta 15 minutos a quien lo sufra y lo ve el profesor en la ficha.

### `lib/sesion.ts` (sesiones contra la base + la cookie)

- `abrirSesion(usuarioId): Promise<void>` — crea la fila con el hash, pone la
  cookie. Solo desde una acción de servidor (Next solo deja poner cookies ahí).
- `usuarioDeLaSesion(): Promise<User | null>` — lee la cookie, busca por hash,
  descarta caducadas (`caducaEl <= ahora`: se borra la fila y se devuelve
  null). Sin cookie → null. Es la única función que `lib/usuario.ts` llama.
- `cerrarSesion(): Promise<void>` — borra fila y cookie.
- `cerrarSesionesDe(usuarioId): Promise<number>` — borra todas las filas de ese
  usuario. Se llama al ponerle contraseña nueva desde fuera (profesor o script).

Las tres primeras leen la cookie con `cookies()` de `next/headers`; las reglas
de base (`buscarSesionPorToken`, `caducada`) van en funciones sueltas que el
script puede probar sin cookie.

### `lib/usuario.ts`, reescrito por dentro

`getUsuarioActual()` pasa a ser `usuarioDeLaSesion()` → `dejarEntrar()`. Se
van los tres casos de Clerk: ya no hay que emparejar por correo, porque la
fila existe antes de que exista la contraseña. `bloqueoDelActual()` lee la
sesión igual y devuelve `bloqueadoEl`. `ascenderSiEsAdmin` y `dejarEntrar` no
cambian. `syncUser` desaparece (se comprueba con grep que nadie la llama).

### `lib/acciones-entrada.ts` (acciones de servidor)

- `entrar(estadoPrevio, formData)` — para `useActionState`. Llama a
  `intentarEntrar`; si ok, `abrirSesion` y `redirect` a: `/cuenta/contrasena`
  si `debeCambiarContrasena`; si no, a `volver` (solo si empieza por `/` y no
  por `//`) o a `/dashboard`. Si falla, devuelve `{ error }` con texto en
  español: «Correo o contraseña incorrectos», «Demasiados intentos. Espera 15
  minutos», «Tu acceso está cerrado. Habla con tu profe».
- `salir()` — `cerrarSesion` y `redirect("/")`.
- `cambiarMiContrasena(estadoPrevio, formData)` — pide la actual **salvo** si
  `debeCambiarContrasena` (acaba de recibirla del profesor y ya la escribió
  al entrar). Valida la nueva, guarda, pone `debeCambiarContrasena = false`,
  cierra las **otras** sesiones (conserva la actual) y devuelve `{ hecho:
  true }`.
- `ponerContrasenaAEstudiante(estadoPrevio, formData)` — `exigirProfesor`.
  Genera una contraseña, la guarda cifrada, `debeCambiarContrasena = true`,
  `intentosFallidos = 0`, `intentosBloqueadosHasta = null`,
  `cerrarSesionesDe`. Devuelve `{ contrasena }` **en claro, una sola vez**,
  para pintarla. No redirige (una redirección la perdería).
- `crearEstudiante` (la de `lib/acciones.ts`) pasa a devolver estado en vez
  de redirigir: `{ id, contrasena }`. La contraseña inicial se genera al crear
  la ficha, salvo que ya existiera (el `upsert` no la pisa).

Un profesor solo pone contraseñas a filas con `role === "STUDENT"`. A otro
profesor o administrador, solo un ADMIN, y a sí mismo nadie: para eso está
`cambiarMiContrasena` o el script.

---

## Las pantallas

### `app/(publico)/entrar/page.tsx`

Correo, contraseña, botón «Entrar». Debajo, una línea: «¿Sin contraseña?
Pídesela a tu profe.» Error en una franja coral (`coral-100`/`coral-600`, que
ya existen). Lee `?volver=`. Si ya hay sesión, redirige a `/dashboard`.

### `app/(app)/cuenta/page.tsx` y `app/(app)/cuenta/contrasena/page.tsx`

`/cuenta`: correo, nombre, rol, botón «Salir» y enlace «Cambiar contraseña».
`/cuenta/contrasena`: actual (oculta si `debeCambiarContrasena`), nueva,
repetir. Con `debeCambiarContrasena` el texto dice por qué está ahí: «Tu profe
te dio esta contraseña. Elige una tuya para seguir.»

Mientras `debeCambiarContrasena` sea true, `app/(app)/layout.tsx` redirige
cualquier ruta que no sea `/cuenta/contrasena` a esa página. Así el cambio no
se puede saltar.

### Cabecera de `app/(app)/layout.tsx`

`UserButton` de Clerk → dos enlaces a la derecha: «Mi cuenta» y un botón
«Salir» (formulario con `salir`). Se añade **«Preparación»** al menú, visible
para todos (al profesor le sirve para ver lo que ve el alumno).

### Panel del estudiante

Tarjeta «Preparación DELE» con enlace a `/preparacion`, encima de la hucha,
siempre visible (también para el alumno nuevo: es lo primero que debe ver).

### Estudiantes

- `profe/alumnos/nuevo`: el mismo formulario, pero como componente cliente
  con `useActionState`. Al crear, en lugar de saltar a la ficha, enseña:
  «Ficha creada. Contraseña inicial: **xxxxxxxxxx**. Apúntala: no se vuelve a
  ver.» y un enlace a la ficha.
- `profe/alumnos/[id]`: bloque **Acceso** con el estado («Nunca ha entrado» si
  no hay hash; «Debe cambiar la contraseña al entrar»; «Bloqueado por intentos
  hasta las HH:MM») y el botón «Nueva contraseña», que enseña la nueva una
  vez.

### Portada `app/(publico)/layout.tsx`

`Show`/`SignInButton`/`UserButton` → el layout llama a `usuarioDeLaSesion()`:
con sesión, «Mi panel»; sin ella, enlace «Entrar» a `/entrar`.

---

## Cerrar la puerta

### `proxy.ts`

```ts
const PUBLICAS = ["/", "/entrar"];
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.includes(pathname) || pathname.startsWith("/api/archivos/")) return;
  if (req.cookies.has("hp_sesion")) return;
  const destino = new URL("/entrar", req.url);
  destino.searchParams.set("volver", pathname + req.nextUrl.search);
  return NextResponse.redirect(destino);
}
export const config = { matcher: ["/((?!_next|.*\\..*).*)"] };
```

Solo mira si **hay** cookie: el proxy no toca la base. Una cookie caducada o
falsa pasa el proxy y la para `getUsuarioActual()`, que devuelve null.
`/api/archivos/<id>` sigue público a propósito (los ficheros públicos ya se
sirven sin sesión «a sabiendas», y los privados los guarda la propia ruta).

### `app/(app)/layout.tsx`

Sin usuario y sin bloqueo → `redirect("/entrar")`. Antes no redirigía; era el
agujero.

### `app/(app)/recorridos/page.tsx`

Si no es profesor, `where.publicado = true`. Y la página deja de renderizar
sin usuario (el layout ya lo garantiza, pero la página lo mira igual: la
regla vive donde se usa).

### Restos

Se borran `app/test-ejercicio/` y `app/probar-vacio/`.

---

## Clerk, fuera

- `npm uninstall @clerk/nextjs`; fuera `ClerkProvider` de `app/layout.tsx`.
- `grep -rn "@clerk"` tiene que quedar a cero.
- En Vercel, tras desplegar y comprobar: quitar `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  y `CLERK_SECRET_KEY`. Se quitan **después**, no antes: hasta que el
  despliegue nuevo esté en verde, el viejo las necesita.

---

## Las primeras contraseñas

`scripts/poner-contrasena.ts <correo>`: genera una contraseña, la guarda
cifrada, `debeCambiarContrasena = true`, cierra sus sesiones y la **imprime
una vez**. Sirve para el profesor el día del despliegue y como salida de
emergencia para cualquier cuenta (necesita `DATABASE_URL`). Contra producción
se corre con la URL pública de Neon en la variable, igual que
`copiar-a-produccion.ts`.

Orden del día del despliegue:

1. Desplegar (la migración se aplica sola en el `build`).
2. `poner-contrasena.ts` para el profesor contra producción; entra y la cambia.
3. Desde Estudiantes, «Nueva contraseña» a cada uno de los estudiantes y se
   la manda por donde hable con ellos.
4. Quitar las variables de Clerk en Vercel.

---

## Verificación

`scripts/verificar-entrada.ts`, con el estilo de `verificar-admin.ts` (crea sus
filas con marca única y las borra). Comprueba:

1. `cifrar`/`comprobar`: ida y vuelta; otra contraseña no pasa; dos cifrados de
   la misma contraseña no coinciden (sal).
2. `generarContrasena`: 10 caracteres, solo del alfabeto, distintas entre sí.
3. `validarContrasena`: 7 caracteres no, 8 sí.
4. `intentarEntrar`: correo inexistente y contraseña mal dan el **mismo**
   motivo; sin hash → `credenciales`; cinco fallos → `demasiados-intentos` y
   fecha puesta; con el reloj 16 minutos después, vuelve a probar; un acierto
   pone el contador a cero; bloqueado → `sin-acceso`; suprimido → `sin-acceso`.
5. Sesiones: crear, encontrar por token, no encontrar por otro token, caducada
   se descarta y se borra, `cerrarSesionesDe` borra todas.
6. `ponerContrasena` (la función de `lib/`, no la acción): deja
   `debeCambiarContrasena` en true, contador a cero y cero sesiones.

Y a mano, contra producción tras desplegar, con `curl` sin cookie:
`/recorridos`, `/recorridos/<id>`, `/pasos/<id>`, `/dashboard`,
`/preparacion` → 307 a `/entrar`; `/` → 200; `/test-ejercicio` → 404.

## Fuera de esta entrega

Recuperar contraseña por correo (no hay servicio de correo; el profesor la
repone). Sesiones visibles para cerrar «los otros aparatos». Quitar la
columna `clerkId`. Cualquier cambio de aspecto: eso es la Entrega 2.
