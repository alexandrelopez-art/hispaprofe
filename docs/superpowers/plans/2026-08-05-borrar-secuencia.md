# Borrar una secuencia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el administrador pueda borrar cualquier secuencia y el profesor la suya, sin dejar atrás grabaciones huérfanas de alumnos y sin destruir de más.

**Architecture:** La regla de quién puede y el texto del aviso son funciones puras en `lib/recorridos.ts`, que es lo que un script puede ejercitar; las cuentas y la selección de archivos borrables viven ahí también, pegadas a la regla que sirven. La acción de `lib/acciones.ts` solo comprueba el permiso y ejecuta una transacción. El botón se pinta únicamente a quien puede.

**Tech Stack:** Next.js 16.2.6 (App Router, acciones de servidor), React 19, Prisma 7, TypeScript, Tailwind 4, scripts de verificación con `tsx`.

## Global Constraints

- **Castellano en todo**: nombres de símbolos, comentarios, textos de pantalla y mensajes de commit. Los commits son una frase que dice qué cambia de comportamiento, sin prefijos tipo `feat:`.
- **`AGENTS.md`**: esta versión de Next tiene cambios de ruptura. Antes de escribir código de Next, leer la guía correspondiente en `node_modules/next/dist/docs/`.
- **Lo verificable vive en `lib/`**: una acción de servidor necesita sesión y contexto de petición, así que un script no puede llamarla. Toda regla que haya que comprobar va fuera de la acción.
- **Cómo se verifica aquí**: el proyecto **no tiene framework de tests**. Se comprueba con scripts `scripts/verificar-*.ts` ejecutados con `npx tsx`, que crean sus propios datos y los borran al terminar. Las páginas y los componentes se comprueban a mano.
- **Los comentarios explican el porqué**, no el qué, y dicen la verdad sobre las trampas.
- **`npx tsc --noEmit` y `npm run lint` limpios** antes de cada commit.
- **Un archivo solo se borra si nadie de fuera lo referencia.** `PasoCompletado.entrega` es texto libre del alumno: puede contener a mano el identificador de la grabación de otro.

---

### Task 1: `lib/recorridos.ts` — quién puede, qué se lleva y qué avisa

**Files:**
- Create: `lib/recorridos.ts`
- Create: `scripts/verificar-borrado-recorrido.ts`

**Interfaces:**
- Consumes: `PREFIJO_GRABACION` y `esGrabacionEntregada(entrega: string | null): boolean` de `@/lib/expresion`; `prisma` de `@/lib/prisma`.
- Produces, para las Tasks 2 y 3:
  - `puedeBorrarRecorrido(usuario: { id: string; role: string } | null, recorrido: { autorId: string | null }): boolean`
  - `type ResumenDeBorrado = { pasos: number; alumnos: number; pasosHechos: number; notas: number; grabaciones: number }`
  - `resumenDeBorrado(recorridoId: string): Promise<ResumenDeBorrado>`
  - `avisoDeBorrado(titulo: string, resumen: ResumenDeBorrado): string`
  - `grabacionesBorrables(recorridoId: string): Promise<string[]>`

- [ ] **Step 1: Escribe la verificación que falla**

Crea `scripts/verificar-borrado-recorrido.ts`. Este primer paso cubre solo lo puro; la Task 2 le añade el barrido contra filas de verdad.

```ts
/**
 * Verifica quién puede borrar una secuencia y qué dice el aviso.
 *
 * Ejecutar con:  npx tsx scripts/verificar-borrado-recorrido.ts
 */
import "dotenv/config";
import { avisoDeBorrado, puedeBorrarRecorrido } from "@/lib/recorridos";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const ADMIN = { id: "u-admin", role: "ADMIN" };
const PROFE = { id: "u-profe", role: "PROFESOR" };
const OTRO_PROFE = { id: "u-otro", role: "PROFESOR" };
const ALUMNO = { id: "u-alumno", role: "STUDENT" };

async function main() {
  // ─── Quién puede ────────────────────────────────────────────────────
  const suya = { autorId: PROFE.id };
  const ajena = { autorId: OTRO_PROFE.id };
  const huerfana = { autorId: null };

  afirmar(puedeBorrarRecorrido(ADMIN, ajena), "el administrador borra la de otro");
  afirmar(puedeBorrarRecorrido(ADMIN, huerfana), "y también una sin autor");
  afirmar(puedeBorrarRecorrido(PROFE, suya), "el profesor borra la suya");
  afirmar(!puedeBorrarRecorrido(PROFE, ajena), "pero no la de otro profesor");
  afirmar(
    !puedeBorrarRecorrido(PROFE, huerfana),
    "ni una sin autor: ahí solo entra el administrador",
  );
  afirmar(!puedeBorrarRecorrido(ALUMNO, suya), "un alumno no borra nada");
  afirmar(!puedeBorrarRecorrido(null, huerfana), "y sin sesión, tampoco");

  // ─── El aviso ───────────────────────────────────────────────────────
  const vacia = { pasos: 4, alumnos: 0, pasosHechos: 0, notas: 0, grabaciones: 0 };
  const corto = avisoDeBorrado("<sdfsdfsd", vacia);
  afirmar(corto.includes("<sdfsdfsd"), "el aviso nombra la secuencia");
  afirmar(corto.includes("4 pasos"), "y dice cuántos pasos se lleva");
  afirmar(
    !corto.includes("alumno") && !corto.includes("nota") && !corto.includes("grabaci"),
    "y no menciona lo que no hay: un aviso que enumera ceros no se lee",
  );

  const conTrabajo = { pasos: 6, alumnos: 3, pasosHechos: 12, notas: 2, grabaciones: 1 };
  const largo = avisoDeBorrado("Piso o Casa", conTrabajo);
  afirmar(largo.includes("3 alumnos"), "con trabajo dentro, el aviso cuenta los alumnos");
  afirmar(largo.includes("12 pasos hechos"), "los pasos hechos");
  afirmar(largo.includes("2 notas"), "las notas puestas");
  afirmar(largo.includes("1 grabación"), "y las grabaciones");
  afirmar(
    largo.includes("no hay vuelta atrás"),
    "y dice que no hay vuelta atrás, que es lo único que de verdad frena a nadie",
  );

  // El singular, que es donde se nota una plantilla mal escrita.
  const uno = avisoDeBorrado("Prueba", {
    pasos: 1,
    alumnos: 1,
    pasosHechos: 1,
    notas: 1,
    grabaciones: 1,
  });
  afirmar(uno.includes("1 alumno ") || uno.includes("1 alumno,"), "un alumno, en singular");
  afirmar(!uno.includes("1 alumnos"), "y no «1 alumnos»");
  afirmar(!uno.includes("1 grabaciones"), "ni «1 grabaciones»");

  console.log("\nTodo bien.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecútala para verla fallar**

Run: `npx tsx scripts/verificar-borrado-recorrido.ts`
Expected: FAIL — no existe `@/lib/recorridos`.

- [ ] **Step 3: Escribe `lib/recorridos.ts`**

```ts
import { esGrabacionEntregada, PREFIJO_GRABACION } from "@/lib/expresion";
import { prisma } from "@/lib/prisma";

/**
 * Quién puede borrar una secuencia, qué se lleva por delante y cómo se avisa.
 *
 * Vive fuera de la acción por el criterio de siempre en este proyecto: una
 * acción de servidor necesita sesión y contexto de petición, así que ningún
 * script puede llamarla, y una regla que no se puede ejercitar es una regla de
 * la que nadie se puede fiar.
 */

/**
 * Administrador siempre; profesor solo lo suyo; una secuencia sin autor, solo
 * el administrador.
 *
 * La fila de la secuencia sin autor no es un caso rebuscado: es el caso
 * corriente. `Recorrido.autorId` admite nulo, lo que se copia de una base a
 * otra entra sin autor —los usuarios de la de origen no existen en la de
 * destino— y lo que siembran los scripts tampoco firma. Dejar eso al alcance
 * de cualquier profesor sería abrir la mano justo donde no se sabe de quién es.
 */
export function puedeBorrarRecorrido(
  usuario: { id: string; role: string } | null,
  recorrido: { autorId: string | null },
): boolean {
  if (!usuario) return false;
  if (usuario.role === "ADMIN") return true;
  if (usuario.role !== "PROFESOR") return false;
  return recorrido.autorId !== null && recorrido.autorId === usuario.id;
}

export type ResumenDeBorrado = {
  pasos: number;
  alumnos: number;
  pasosHechos: number;
  notas: number;
  grabaciones: number;
};

/**
 * Lo que hay dentro de una secuencia, para poder decirlo antes de borrarla.
 *
 * Se cuenta en el servidor al pintar la página y no en el navegador: el aviso
 * tiene que decir lo que hay, no lo que el cliente crea que hay.
 */
export async function resumenDeBorrado(recorridoId: string): Promise<ResumenDeBorrado> {
  const pasos = await prisma.paso.findMany({
    where: { recorridoId },
    select: { id: true },
  });
  const pasoIds = pasos.map((p) => p.id);

  const [alumnos, completados] = await Promise.all([
    prisma.asignacion.count({ where: { recorridoId } }),
    prisma.pasoCompletado.findMany({
      where: { pasoId: { in: pasoIds } },
      select: { puntos: true, entrega: true },
    }),
  ]);

  return {
    pasos: pasos.length,
    alumnos,
    pasosHechos: completados.length,
    notas: completados.filter((c) => c.puntos !== null).length,
    grabaciones: completados.filter((c) => esGrabacionEntregada(c.entrega)).length,
  };
}

/** «3 alumnos» o «1 alumno», que una plantilla en plural fijo canta. */
function cuenta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * El aviso de la confirmación.
 *
 * Enumera solo lo que hay. Un aviso que dice «0 alumnos, 0 notas, 0
 * grabaciones» es un aviso que se lee en diagonal, y entonces deja de avisar
 * el día que los números no son cero.
 */
export function avisoDeBorrado(titulo: string, resumen: ResumenDeBorrado): string {
  const partes: string[] = [];
  if (resumen.alumnos) partes.push(cuenta(resumen.alumnos, "alumno asignado", "alumnos asignados"));
  if (resumen.pasosHechos) partes.push(cuenta(resumen.pasosHechos, "paso hecho", "pasos hechos"));
  if (resumen.notas) partes.push(cuenta(resumen.notas, "nota puesta", "notas puestas"));
  if (resumen.grabaciones) partes.push(cuenta(resumen.grabaciones, "grabación", "grabaciones"));

  if (partes.length === 0) {
    return `¿Borrar «${titulo}»? Se borrarán la secuencia y sus ${cuenta(resumen.pasos, "paso", "pasos")}.`;
  }

  const enumerado =
    partes.length === 1
      ? partes[0]
      : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

  return (
    `¿Borrar «${titulo}»? Esta secuencia tiene ${enumerado}. ` +
    `Se borra todo, incluidas las grabaciones, y no hay vuelta atrás.`
  );
}

/**
 * Los archivos de las grabaciones que esta secuencia se puede llevar.
 *
 * Existe porque si no, esas filas se quedan en la base **sin nada que las
 * referencie**: no es que ocupen sitio, es que ya no hay forma de llegar a
 * ellas ni para suprimirlas. Son voces de alumnos, a menudo menores, y eso es
 * justo lo que el proyecto evita en `lib/admin.ts` al suprimir una persona.
 *
 * Y se queda fuera lo que alguien de fuera todavía nombre. `entrega` es texto
 * libre del alumno —lo avisa `lib/expresion.ts`—, así que en una tarea escrita
 * se puede teclear el identificador de la grabación de un compañero. Sin esta
 * comprobación, borrar esta secuencia destruiría el audio de otra.
 */
export async function grabacionesBorrables(recorridoId: string): Promise<string[]> {
  const pasos = await prisma.paso.findMany({
    where: { recorridoId },
    select: { id: true },
  });
  const pasoIds = pasos.map((p) => p.id);

  const dentro = await prisma.pasoCompletado.findMany({
    where: { pasoId: { in: pasoIds } },
    select: { entrega: true },
  });
  const candidatos = new Set(
    dentro
      .filter((c) => esGrabacionEntregada(c.entrega))
      .map((c) => c.entrega!.slice(PREFIJO_GRABACION.length)),
  );
  if (candidatos.size === 0) return [];

  // Quién más los nombra, mirando solo fuera de esta secuencia.
  const fuera = await prisma.pasoCompletado.findMany({
    where: { pasoId: { notIn: pasoIds } },
    select: { entrega: true },
  });
  for (const { entrega } of fuera) {
    if (!esGrabacionEntregada(entrega)) continue;
    candidatos.delete(entrega!.slice(PREFIJO_GRABACION.length));
  }

  return [...candidatos];
}
```

- [ ] **Step 4: Ejecútala para verla pasar**

Run: `npx tsx scripts/verificar-borrado-recorrido.ts`
Expected: PASS, y «Todo bien.»

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/recorridos.ts scripts/verificar-borrado-recorrido.ts
git commit -m "Quién puede borrar una secuencia, y qué hay que avisar antes"
```

---

### Task 2: La acción, y el mismo agujero un piso más abajo

**Files:**
- Modify: `lib/acciones.ts` (la acción nueva, y `borrarPaso` en la línea 537)
- Modify: `scripts/verificar-borrado-recorrido.ts` (el barrido contra filas de verdad)

**Interfaces:**
- Consumes: `puedeBorrarRecorrido` y `grabacionesBorrables` de `@/lib/recorridos` (Task 1); `getUsuarioActual` de `@/lib/usuario`; `exigirProfesor` de `@/lib/profesor`; `esGrabacionEntregada` y `PREFIJO_GRABACION` de `@/lib/expresion`.
- Produces, para la Task 3: `borrarRecorrido(formData: FormData): Promise<void>`, que espera un campo `recorridoId` y redirige a `/recorridos`.

- [ ] **Step 1: Amplía la verificación con el barrido**

En `scripts/verificar-borrado-recorrido.ts`, añade los imports que faltan arriba:

```ts
import { grabacionesBorrables, resumenDeBorrado } from "@/lib/recorridos";
import { prisma } from "@/lib/prisma";
```

Y antes del `console.log("\nTodo bien.")`, el bloque contra filas de verdad:

```ts
  // ─── Contra filas reales ────────────────────────────────────────────
  const marca = `verificar-borrado-${process.pid}`;

  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  const alumno = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });

  // El ejercicio es de la biblioteca: tiene que sobrevivir al borrado.
  const ejercicio = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Ejercicio ${marca}`,
      nivel: "A2",
      datos: { ejercicio: "opcion", items: [] },
      autorId: profesor.id,
    },
  });

  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Secuencia ${marca}`, nivel: "A2", orden: 999, autorId: profesor.id },
  });
  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Paso" },
  });
  const bloque = await prisma.bloque.create({
    data: { pasoId: paso.id, orden: 1, tipo: "TEXTO", texto: "Hola" },
  });
  const enganche = await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: ejercicio.id, orden: 1 },
  });
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: alumno.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });

  // La grabación de este alumno, y otra que además nombra alguien de fuera.
  const suya = await prisma.archivo.create({
    data: { nombre: "suya.m4a", tipo: "audio/mp4", tamano: 3, datos: Buffer.from("abc"), privado: true },
  });
  const deOtra = await prisma.archivo.create({
    data: { nombre: "de-otra.m4a", tipo: "audio/mp4", tamano: 3, datos: Buffer.from("abc"), privado: true },
  });

  const completado = await prisma.pasoCompletado.create({
    data: {
      asignacionId: asignacion.id,
      pasoId: paso.id,
      puntos: 5,
      entrega: `/api/archivos/${suya.id}`,
    },
  });

  // El caso que de verdad hay que montar bien: `deOtra` tiene que ser
  // **candidato** —o sea, estar nombrado por una entrega de ESTA secuencia— y
  // además estar nombrado desde fuera. Si solo lo nombrara la otra secuencia,
  // no sería candidato y la afirmación de abajo no podría fallar nunca, que es
  // no comprobar nada.
  //
  // Así que aquí va el alumno que teclea en su redacción el identificador de
  // la grabación de un compañero, que es exactamente lo que avisa
  // `lib/expresion.ts`: `entrega` es texto libre.
  const segundoPaso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, orden: 2, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Paso 2" },
  });
  const listillo = await prisma.user.create({
    data: { email: `listillo-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  const suAsignacion = await prisma.asignacion.create({
    data: { estudianteId: listillo.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  await prisma.pasoCompletado.create({
    data: {
      asignacionId: suAsignacion.id,
      pasoId: segundoPaso.id,
      entrega: `/api/archivos/${deOtra.id}`,
    },
  });

  // Y la secuencia de fuera que lo nombra de verdad: es lo que salva el
  // archivo de que este borrado se lo lleve.
  const otraSecuencia = await prisma.recorrido.create({
    data: { titulo: `Otra ${marca}`, nivel: "A2", orden: 998 },
  });
  const otroPaso = await prisma.paso.create({
    data: { recorridoId: otraSecuencia.id, orden: 1, ciclo: 1, tipo: "ACTIVIDAD", titulo: "Otro" },
  });
  const otraAsignacion = await prisma.asignacion.create({
    data: { estudianteId: alumno.id, profesorId: profesor.id, recorridoId: otraSecuencia.id },
  });
  await prisma.pasoCompletado.create({
    data: {
      asignacionId: otraAsignacion.id,
      pasoId: otroPaso.id,
      entrega: `/api/archivos/${deOtra.id}`,
    },
  });

  const clase = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: alumno.id, empiezaEl: new Date(), minutos: 60 },
  });
  const cita = await prisma.citaOral.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, claseId: clase.id },
  });
  const escucha = await prisma.escucha.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, clave: "audio-1", veces: 2 },
  });

  const resumen = await resumenDeBorrado(recorrido.id);
  afirmar(resumen.pasos === 2, `el resumen cuenta los dos pasos (${resumen.pasos})`);
  afirmar(resumen.alumnos === 2, `los dos alumnos asignados (${resumen.alumnos})`);
  afirmar(resumen.pasosHechos === 2, `los dos pasos hechos (${resumen.pasosHechos})`);
  afirmar(resumen.notas === 1, `una sola nota puesta (${resumen.notas})`);
  // Dos: la entrega del listillo también empieza por el prefijo, y el resumen
  // cuenta lo que hay escrito, no lo que resulte borrable. Distinguirlas es
  // trabajo de `grabacionesBorrables`, dos afirmaciones más abajo.
  afirmar(resumen.grabaciones === 2, `dos entregas con pinta de grabación (${resumen.grabaciones})`);

  const borrables = await grabacionesBorrables(recorrido.id);
  afirmar(borrables.includes(suya.id), "la grabación de esta secuencia es borrable");
  afirmar(
    !borrables.includes(deOtra.id),
    "y la que nombra una entrega de otra secuencia, no: no se destruye de más",
  );

  // El barrido. La acción no se puede llamar desde aquí —necesita sesión—, así
  // que se ejecuta la misma transacción que ella, que es lo que se comprueba.
  const pasoIds = [paso.id, segundoPaso.id];
  await prisma.$transaction([
    prisma.citaOral.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.escucha.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.archivo.deleteMany({ where: { id: { in: borrables } } }),
    prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.asignacion.deleteMany({ where: { recorridoId: recorrido.id } }),
    prisma.paso.deleteMany({ where: { recorridoId: recorrido.id } }),
    prisma.recorrido.delete({ where: { id: recorrido.id } }),
  ]);

  const nada = async (que: string, buscar: () => Promise<unknown | null>) =>
    afirmar((await buscar()) === null, `tras borrar no queda ${que}`);

  await nada("la secuencia", () => prisma.recorrido.findUnique({ where: { id: recorrido.id } }));
  await nada("el paso", () => prisma.paso.findUnique({ where: { id: paso.id } }));
  await nada("el bloque", () => prisma.bloque.findUnique({ where: { id: bloque.id } }));
  await nada("el enganche", () => prisma.pasoEjercicio.findUnique({ where: { id: enganche.id } }));
  await nada("la asignación", () => prisma.asignacion.findUnique({ where: { id: asignacion.id } }));
  await nada("el paso completado", () => prisma.pasoCompletado.findUnique({ where: { id: completado.id } }));
  await nada("la cita del oral", () => prisma.citaOral.findUnique({ where: { id: cita.id } }));
  await nada("la escucha", () => prisma.escucha.findUnique({ where: { id: escucha.id } }));
  await nada("la grabación", () => prisma.archivo.findUnique({ where: { id: suya.id } }));

  afirmar(
    (await prisma.ejercicio.findUnique({ where: { id: ejercicio.id } })) !== null,
    "y el ejercicio sigue vivo: vive en la biblioteca, no en la secuencia",
  );
  afirmar(
    (await prisma.archivo.findUnique({ where: { id: deOtra.id } })) !== null,
    "y la grabación que nombraba otra secuencia, también",
  );

  // Limpieza de lo que queda en pie. El orden lo mandan las claves ajenas:
  // los pasos completados antes que su asignación, la clase antes que su
  // profesor, y los usuarios al final.
  await prisma.pasoCompletado.deleteMany({ where: { pasoId: otroPaso.id } });
  await prisma.citaOral.deleteMany({ where: { claseId: clase.id } });
  await prisma.clase.delete({ where: { id: clase.id } });
  await prisma.asignacion.deleteMany({ where: { id: otraAsignacion.id } });
  await prisma.paso.deleteMany({ where: { recorridoId: otraSecuencia.id } });
  await prisma.recorrido.delete({ where: { id: otraSecuencia.id } });
  await prisma.ejercicio.delete({ where: { id: ejercicio.id } });
  await prisma.archivo.delete({ where: { id: deOtra.id } });
  await prisma.user.deleteMany({
    where: { id: { in: [profesor.id, alumno.id, listillo.id] } },
  });
  await prisma.$disconnect();
```

- [ ] **Step 2: Ejecútala**

Run: `npx tsx scripts/verificar-borrado-recorrido.ts`
Expected: PASS. Si algo de la limpieza falla por una clave ajena, arregla el orden de la limpieza —no las afirmaciones.

- [ ] **Step 3: Escribe la acción**

Al final de `lib/acciones.ts`, con los imports nuevos arriba (`import { grabacionesBorrables, puedeBorrarRecorrido } from "@/lib/recorridos";`):

```ts
/**
 * Borra una secuencia entera con todo lo que cuelga de ella.
 *
 * `exigirProfesor` no basta y por eso hay una segunda comprobación: esa solo
 * dice «eres profesor o administrador», y aquí hace falta saber si esta
 * secuencia es tuya. La regla vive en `lib/recorridos.ts` para que un script
 * pueda ejercitar los cuatro casos.
 */
export async function borrarRecorrido(formData: FormData) {
  const usuario = await exigirProfesor();
  const recorridoId = String(formData.get("recorridoId") ?? "");
  if (!recorridoId) return;

  const recorrido = await prisma.recorrido.findUnique({
    where: { id: recorridoId },
    select: { autorId: true },
  });
  if (!recorrido) return;
  if (!puedeBorrarRecorrido(usuario, recorrido)) return;

  const pasos = await prisma.paso.findMany({
    where: { recorridoId },
    select: { id: true },
  });
  const pasoIds = pasos.map((p) => p.id);

  // Fuera de la transacción a propósito: son dos lecturas que deciden qué
  // archivos se pueden llevar, y meterlas dentro alargaría la transacción sin
  // ganar nada. Lo peor que puede pasar entre medias es que alguien entregue
  // una grabación nueva, y esa se queda en pie en vez de borrarse de más.
  const archivoIds = await grabacionesBorrables(recorridoId);

  await prisma.$transaction([
    // `CitaOral.pasoId` y `Escucha.pasoId` no tienen relación declarada —está
    // razonado en el esquema—, así que nada las borra en cascada. Es la misma
    // trampa que ya aprendió `borrarPaso` con las citas.
    prisma.citaOral.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.escucha.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.pasoCompletado.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    // Las voces de los alumnos. Sin esto quedarían en la base sin nada que las
    // referencie: ni accesibles ni suprimibles.
    prisma.archivo.deleteMany({ where: { id: { in: archivoIds } } }),
    prisma.bloque.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.pasoEjercicio.deleteMany({ where: { pasoId: { in: pasoIds } } }),
    prisma.asignacion.deleteMany({ where: { recorridoId } }),
    prisma.paso.deleteMany({ where: { recorridoId } }),
    prisma.recorrido.delete({ where: { id: recorridoId } }),
  ]);

  revalidatePath("/recorridos");
  revalidatePath("/dashboard");
  redirect("/recorridos");
}
```

Los ejercicios **no** se borran: viven en la biblioteca de Recursos y pueden estar en otras secuencias. Solo desaparece el enganche.

- [ ] **Step 4: Arregla `borrarPaso`, que tiene el mismo agujero**

`borrarPaso` (`lib/acciones.ts:537`) borra los pasos completados y deja atrás las escuchas y los archivos de sus entregas. La transacción pasa a ser:

```ts
  // Las mismas dos cosas que en `borrarRecorrido`, por el mismo motivo: la
  // escucha cuelga del paso por un `pasoId` sin relación, y la grabación de
  // una entrega no la borra nadie más. Se calcula antes de la transacción.
  const entregas = await prisma.pasoCompletado.findMany({
    where: { pasoId },
    select: { entrega: true },
  });
  const suyos = entregas
    .filter((c) => esGrabacionEntregada(c.entrega))
    .map((c) => c.entrega!.slice(PREFIJO_GRABACION.length));
  // Solo los que no nombre nadie más, por lo mismo que en `borrarRecorrido`:
  // `entrega` es texto libre del alumno.
  const fuera = await prisma.pasoCompletado.findMany({
    where: { pasoId: { not: pasoId } },
    select: { entrega: true },
  });
  const nombradosFuera = new Set(
    fuera
      .filter((c) => esGrabacionEntregada(c.entrega))
      .map((c) => c.entrega!.slice(PREFIJO_GRABACION.length)),
  );
  const archivoIds = suyos.filter((id) => !nombradosFuera.has(id));

  await prisma.$transaction([
    prisma.pasoCompletado.deleteMany({ where: { pasoId } }),
    prisma.escucha.deleteMany({ where: { pasoId } }),
    prisma.archivo.deleteMany({ where: { id: { in: archivoIds } } }),
    // `CitaOral.pasoId` no tiene relación —está razonado en el esquema—, así
    // que nada la borra en cascada: sin esto, la clase seguía pintando una
    // línea con el nombre del alumno y sin título para siempre, y
    // `descitarOral` necesita el paso desde la ficha, que ya no lo pinta.
    prisma.citaOral.deleteMany({ where: { pasoId } }),
    prisma.bloque.deleteMany({ where: { pasoId } }),
    prisma.paso.delete({ where: { id: pasoId } }),
  ]);
```

Añade a los imports de `lib/acciones.ts`: `import { esGrabacionEntregada, PREFIJO_GRABACION } from "@/lib/expresion";`

- [ ] **Step 5: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Ejecuta las verificaciones que tocan lo mismo**

Run: `npx tsx scripts/verificar-borrado-recorrido.ts && npx tsx scripts/verificar-expresion.ts && npx tsx scripts/verificar-oral-grabada.ts`
Expected: los tres «Todo bien.»

- [ ] **Step 7: Commit**

```bash
git add lib/acciones.ts scripts/verificar-borrado-recorrido.ts
git commit -m "Borrar una secuencia se lleva también las voces que había dentro"
```

---

### Task 3: El botón, solo para quien puede

**Files:**
- Modify: `app/(app)/recorridos/[id]/page.tsx`

**Interfaces:**
- Consumes: `borrarRecorrido` de `@/lib/acciones` (Task 2); `puedeBorrarRecorrido`, `resumenDeBorrado` y `avisoDeBorrado` de `@/lib/recorridos` (Task 1); `BotonConfirmar` de `@/components/boton-confirmar` y `getUsuarioActual` de `@/lib/usuario`, que la página ya importa.

- [ ] **Step 1: Amplía los imports**

```ts
import {
  asignarSecuenciaAVarios,
  borrarPaso,
  borrarRecorrido,
  crearPaso,
  moverPaso,
} from "@/lib/acciones";
import { avisoDeBorrado, puedeBorrarRecorrido, resumenDeBorrado } from "@/lib/recorridos";
```

- [ ] **Step 2: Calcula el permiso y el aviso**

En el cuerpo del componente, después de cargar `recorrido` y el usuario, y **solo** si se puede borrar: contar cuesta dos consultas y no hay por qué pagarlas para no enseñar nada.

```ts
  const sePuedeBorrar = puedeBorrarRecorrido(usuario, recorrido);
  const aviso = sePuedeBorrar
    ? avisoDeBorrado(recorrido.titulo, await resumenDeBorrado(recorrido.id))
    : null;
```

`autorId` ya llega: la consulta de la página usa `include` (línea 59), que trae todos los campos escalares del recorrido. No hay que tocarla.

- [ ] **Step 3: Pinta el botón en la cabecera de la secuencia**

Junto al título, al final de la cabecera de la página:

```tsx
        {sePuedeBorrar && aviso && (
          <form action={borrarRecorrido} className="mt-4">
            <input type="hidden" name="recorridoId" value={recorrido.id} />
            <BotonConfirmar
              aviso={aviso}
              title="Borrar la secuencia entera"
              className="rounded-full border border-hp-200 px-4 py-1 text-sm font-bold text-tinta-suave transition-colors hover:border-bloque3 hover:text-tinta"
            >
              Borrar la secuencia
            </BotonConfirmar>
          </form>
        )}
```

Se pinta solo a quien puede: enseñar un botón que va a contestar que no es una promesa que no se piensa cumplir.

- [ ] **Step 4: Comprueba tipos y estilo**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Comprueba a mano**

Run: `npm run dev`, entra como profesor y abre una secuencia tuya.
Expected: el botón aparece; al pulsarlo, el aviso corto si nadie la ha tocado («Se borrarán la secuencia y sus N pasos»); al aceptar, vuelve a `/recorridos` y ya no está. En una secuencia sin autor, el botón solo debe salir si entras como administrador.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/recorridos/[id]/page.tsx"
git commit -m "El botón de borrar la secuencia, con lo que se lleva escrito"
```

---

## Verificación final

```bash
npx tsc --noEmit
npm run lint
npx tsx scripts/verificar-borrado-recorrido.ts
npx tsx scripts/verificar-expresion.ts
npx tsx scripts/verificar-oral-grabada.ts
npx tsx scripts/verificar-recursos.ts
```

## Fuera de alcance

- Archivar en vez de borrar.
- Deshacer: no hay papelera, y el aviso lo dice.
- Borrado en lote desde la lista de secuencias.
