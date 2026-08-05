/**
 * Copia el material didáctico de una base de datos a otra.
 *
 * Existe porque el desarrollo se hace contra un Postgres local
 * (`localhost:5432/hispaprofe_dev`) y producción tiene el suyo, separado: las
 * secuencias que se crean probando en el portátil no llegan solas al sitio
 * publicado. Esto las lleva.
 *
 * **Copia el material, no la clase.** Van los recorridos con sus pasos,
 * bloques, ejercicios y archivos. NO van los usuarios, ni los grupos, ni las
 * asignaciones, ni las entregas, ni las notas: esa es la vida de un aula
 * concreta —con los `clerkId` de una instancia de Clerk que en producción no
 * existe—, y mezclarla sería meter alumnos de mentira en el sitio de verdad.
 *
 * **Conserva los identificadores**, y no es un detalle de eficiencia: las
 * imágenes y los audios se referencian *dentro* de los ejercicios y los
 * bloques como `/api/archivos/<id>`. Regenerar los ids obligaría a reescribir
 * esas cadenas por dentro, y cualquiera que se escapara quedaría como un
 * hueco roto en la pantalla del alumno. Copiando el id, la referencia sigue
 * valiendo sin tocar nada.
 *
 * **No pisa nada.** Lo que ya exista en el destino con ese mismo id se salta y
 * se cuenta aparte. Se puede ejecutar dos veces sin duplicar ni machacar.
 *
 * Ensayo (no escribe, solo dice lo que haría):
 *
 *   DESTINO_URL="postgresql://…" npx tsx scripts/copiar-a-produccion.ts
 *
 * De verdad:
 *
 *   DESTINO_URL="postgresql://…" npx tsx scripts/copiar-a-produccion.ts --de-verdad
 *
 * El origen es `DATABASE_URL` del `.env`, salvo que se dé `ORIGEN_URL`.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

const deVerdad = process.argv.includes("--de-verdad");

const origenUrl = process.env.ORIGEN_URL ?? process.env.DATABASE_URL;
const destinoUrl = process.env.DESTINO_URL;

if (!origenUrl) {
  throw new Error("Falta ORIGEN_URL (o DATABASE_URL en el .env).");
}
if (!destinoUrl) {
  throw new Error(
    "Falta DESTINO_URL. Sácala de Vercel: Settings → Environment Variables → DATABASE_URL, " +
      "o con `npx vercel env pull`.",
  );
}
if (origenUrl === destinoUrl) {
  // Sin esto, un despiste copiaría la base sobre sí misma. No rompería nada
  // —todo se saltaría por id repetido— pero el informe mentiría.
  throw new Error("El origen y el destino son la misma base de datos.");
}

function conectar(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const origen = conectar(origenUrl);
const destino = conectar(destinoUrl);

/** Lo hecho con cada modelo, para el informe del final. */
type Cuenta = { copiados: number; saltados: number };

function nueva(): Cuenta {
  return { copiados: 0, saltados: 0 };
}

/**
 * Escribe una fila si su id no está ya en el destino.
 *
 * `existe` y `crear` se pasan como funciones y no se resuelven aquí porque
 * cada modelo tiene su propio delegado en Prisma y no hay forma de recorrerlos
 * con un tipo común sin perder toda la comprobación de tipos.
 */
async function copiarFila(
  id: string,
  cuenta: Cuenta,
  existe: () => Promise<unknown | null>,
  crear: () => Promise<unknown>,
) {
  if (await existe()) {
    cuenta.saltados++;
    return;
  }
  if (deVerdad) await crear();
  cuenta.copiados++;
}

async function main() {
  console.log(deVerdad ? "COPIANDO DE VERDAD\n" : "ENSAYO: no se escribe nada\n");

  // Quién firma lo copiado en el destino. Los ids de usuario del origen no
  // existen allí, así que se busca por correo, que es lo único que significa
  // la misma persona en las dos bases. Si no aparece, se deja sin autor: los
  // tres campos de autoría admiten nulo, y un recorrido sin firmar es mejor
  // que uno firmado por alguien que no es.
  const autoresOrigen = await origen.user.findMany({
    where: { role: { in: ["PROFESOR", "ADMIN"] } },
    select: { id: true, email: true },
  });
  const equivalencia = new Map<string, string | null>();
  for (const autor of autoresOrigen) {
    const enDestino = await destino.user.findUnique({
      where: { email: autor.email },
      select: { id: true },
    });
    equivalencia.set(autor.id, enDestino?.id ?? null);
    console.log(
      enDestino
        ? `Autor ${autor.email}: existe en destino, firmará lo suyo.`
        : `Autor ${autor.email}: NO existe en destino; lo suyo irá sin autor.`,
    );
  }
  /** El id de autor equivalente, o null si esa persona no está en el destino. */
  const autorDe = (id: string | null) => (id ? (equivalencia.get(id) ?? null) : null);

  console.log();

  // 1. Los archivos primero: no dependen de nada, y todo lo demás los
  //    referencia por id dentro de su contenido.
  const archivos = nueva();
  const idsArchivo = await origen.archivo.findMany({ select: { id: true } });
  for (const { id } of idsArchivo) {
    // De uno en uno, con los bytes dentro: veinticuatro audios pueden ser
    // cientos de megas, y traerlos todos a memoria de golpe para luego
    // escribirlos es la forma de quedarse sin ella.
    const archivo = await origen.archivo.findUnique({ where: { id } });
    if (!archivo) continue;
    await copiarFila(
      id,
      archivos,
      () => destino.archivo.findUnique({ where: { id }, select: { id: true } }),
      () =>
        destino.archivo.create({
          data: { ...archivo, subidoPorId: autorDe(archivo.subidoPorId) },
        }),
    );
  }
  console.log(`Archivos:   ${archivos.copiados} copiados, ${archivos.saltados} ya estaban`);

  // 2. Los ejercicios: independientes de los recorridos —viven en la
  //    biblioteca— y los pasos los enganchan después.
  const ejercicios = nueva();
  for (const ejercicio of await origen.ejercicio.findMany()) {
    await copiarFila(
      ejercicio.id,
      ejercicios,
      () => destino.ejercicio.findUnique({ where: { id: ejercicio.id }, select: { id: true } }),
      () =>
        destino.ejercicio.create({
          data: {
            ...ejercicio,
            autorId: autorDe(ejercicio.autorId),
            // `datos` se lee como `JsonValue` —que admite `null`— y se escribe
            // con un tipo más estrecho que no. En el esquema la columna no es
            // nulable, así que este `null` no puede darse; se distingue igual
            // en vez de forzar el tipo, porque un `as` aquí taparía el día que
            // la columna sí lo admita.
            datos:
              ejercicio.datos === null
                ? Prisma.JsonNull
                : (ejercicio.datos as Prisma.InputJsonValue),
          },
        }),
    );
  }
  console.log(`Ejercicios: ${ejercicios.copiados} copiados, ${ejercicios.saltados} ya estaban`);

  // 3. Los recorridos con lo que cuelga de ellos, en orden: el paso necesita
  //    su recorrido escrito, y el bloque su paso.
  const recorridos = nueva();
  const pasos = nueva();
  const bloques = nueva();
  const enganches = nueva();

  for (const recorrido of await origen.recorrido.findMany({
    include: { pasos: { include: { bloques: true, ejercicios: true } } },
    orderBy: { createdAt: "asc" },
  })) {
    const { pasos: susPasos, ...soloRecorrido } = recorrido;
    await copiarFila(
      recorrido.id,
      recorridos,
      () => destino.recorrido.findUnique({ where: { id: recorrido.id }, select: { id: true } }),
      () =>
        destino.recorrido.create({
          data: { ...soloRecorrido, autorId: autorDe(soloRecorrido.autorId) },
        }),
    );

    for (const paso of susPasos) {
      const { bloques: susBloques, ejercicios: susEnganches, ...soloPaso } = paso;
      await copiarFila(
        paso.id,
        pasos,
        () => destino.paso.findUnique({ where: { id: paso.id }, select: { id: true } }),
        () => destino.paso.create({ data: soloPaso }),
      );

      for (const bloque of susBloques) {
        await copiarFila(
          bloque.id,
          bloques,
          () => destino.bloque.findUnique({ where: { id: bloque.id }, select: { id: true } }),
          () => destino.bloque.create({ data: bloque }),
        );
      }

      for (const enganche of susEnganches) {
        await copiarFila(
          enganche.id,
          enganches,
          () =>
            destino.pasoEjercicio.findUnique({
              where: { id: enganche.id },
              select: { id: true },
            }),
          () => destino.pasoEjercicio.create({ data: enganche }),
        );
      }
    }
  }

  console.log(`Recorridos: ${recorridos.copiados} copiados, ${recorridos.saltados} ya estaban`);
  console.log(`Pasos:      ${pasos.copiados} copiados, ${pasos.saltados} ya estaban`);
  console.log(`Bloques:    ${bloques.copiados} copiados, ${bloques.saltados} ya estaban`);
  console.log(`Enganches:  ${enganches.copiados} copiados, ${enganches.saltados} ya estaban`);

  console.log(
    deVerdad
      ? "\nHecho. Recarga /recorridos en producción."
      : "\nEnsayo terminado. Repite con --de-verdad para escribirlo.",
  );

  await origen.$disconnect();
  await destino.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await origen.$disconnect().catch(() => {});
  await destino.$disconnect().catch(() => {});
  process.exit(1);
});
