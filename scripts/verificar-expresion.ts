/**
 * Verifica el esquema de la expresión, la versión pública y las reglas de la
 * entrega. Crea sus propios datos y los borra al terminar.
 * Ejecutar con:  npx tsx scripts/verificar-expresion.ts
 */
import "dotenv/config";
import { clasesParaCitar, puedeCitarse } from "@/lib/citas";
import {
  analizarExpresion,
  esDeEsteProfesor,
  expresionDelPaso,
  expresionSchema,
  MAXIMO_ENTREGA,
  puedeEntregar,
  puedeValorarse,
  puntosDe,
  versionPublicaExpresion,
} from "@/lib/expresion";
import { desmarcarSiNoRevisado } from "@/lib/progreso";
import { prisma } from "@/lib/prisma";

function afirmar(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(`FALLO: ${mensaje}`);
  console.log(`OK: ${mensaje}`);
}

const marca = `verificar-expresion-${process.pid}`;

let recorridoId: string | null = null;
let pasoId: string | null = null;
let asignacionId: string | null = null;
const usuarioIds: string[] = [];
const claseIds: string[] = [];
const grupoIds: string[] = [];
const pasoExtraIds: string[] = [];
const ejercicioIds: string[] = [];

const ESCRITA = {
  ejercicio: "expresion",
  modalidad: "escrita",
  consigna: "Escribe un correo a un amigo contándole tus vacaciones.",
  estimulo: { texto: "Has vuelto de un viaje." },
  palabras: { minimo: 100, maximo: 120 },
  criterios: [
    { id: "c1", nombre: "Adecuación y cumplimiento", maximo: 3 },
    { id: "c2", nombre: "Coherencia", maximo: 3 },
  ],
  modelo: "Querida Ana:\nAcabo de volver…",
};

const ORAL = {
  ejercicio: "expresion",
  modalidad: "oral",
  consigna: "Describe la foto y contesta a las preguntas.",
  estimulo: { imagen: "/api/archivos/loquesea" },
  minutos: 3,
  criterios: [{ id: "c1", nombre: "Fluidez", maximo: 3 }],
};

async function main() {
  // ─── El esquema ─────────────────────────────────────────────────────
  afirmar(expresionSchema.safeParse(ESCRITA).success, "una escrita completa es válida");
  afirmar(expresionSchema.safeParse(ORAL).success, "una oral completa es válida");

  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, palabras: undefined }).success,
    "una escrita sin número de palabras se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ORAL, minutos: undefined }).success,
    "una oral sin minutos se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, minutos: 3 }).success,
    "una escrita con minutos se rechaza: eso es de las orales",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ORAL, palabras: { minimo: 1, maximo: 2 } }).success,
    "una oral con número de palabras se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, palabras: { minimo: 200, maximo: 100 } }).success,
    "un mínimo de palabras mayor que el máximo se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({ ...ESCRITA, criterios: [] }).success,
    "una tarea sin criterios se rechaza",
  );
  afirmar(
    !expresionSchema.safeParse({
      ...ESCRITA,
      criterios: [
        { id: "c1", nombre: "", maximo: 3 },
        { id: "c2", nombre: "Coherencia", maximo: 3 },
      ],
    }).success,
    "un criterio sin nombre se rechaza: la lista no basta con tener dos elementos",
  );
  afirmar(
    !expresionSchema.safeParse({
      ...ESCRITA,
      criterios: [
        { id: "c1", nombre: "Uno", maximo: 3 },
        { id: "c1", nombre: "Dos", maximo: 3 },
      ],
    }).success,
    "dos criterios con el mismo id se rechazan: sus notas se pisarían",
  );

  afirmar(analizarExpresion(ESCRITA) !== null, "analizarExpresion reconoce una escrita");
  afirmar(analizarExpresion({ ejercicio: "opcion" }) === null, "no reconoce un ejercicio del motor");
  afirmar(analizarExpresion(null) === null, "no reconoce null");

  const {
    tipoDeEjercicio,
    revisarDatos,
    tieneTrabajo,
    puedeDesengancharse,
    puedeEditarse,
    puedeEngancharse,
  } = await import("@/lib/recursos");
  afirmar(tipoDeEjercicio(ESCRITA) === "EXPRESION", "una escrita se guarda como EXPRESION");
  afirmar(tipoDeEjercicio(ORAL) === "EXPRESION", "una oral también");

  // ─── El portero de Recursos ─────────────────────────────────────────
  // `guardarEjercicio` y `publicarEjercicio` preguntan a esto antes de tocar
  // la base. Mientras solo preguntaba al motor, ninguna expresión se podía
  // guardar ni publicar: contestaba «al ejercicio le falta el tipo».
  const revisada = revisarDatos(ESCRITA);
  afirmar(
    "tipo" in revisada && revisada.tipo === "EXPRESION",
    "una expresión válida pasa el portero de guardarEjercicio",
  );
  afirmar(
    "tipo" in revisarDatos({ ...ORAL }),
    "una oral válida también lo pasa",
  );

  // Y el motivo del no lo escribe su propio esquema, en castellano: es el
  // único sitio del proyecto donde esos errores se traducen.
  const sinCriterios = revisarDatos({ ...ESCRITA, criterios: [] });
  afirmar(
    "error" in sinCriterios && sinCriterios.error.includes("al menos un criterio"),
    "una expresión sin criterios se rechaza con el motivo del esquema, no con uno genérico",
  );
  const alReves = revisarDatos({ ...ESCRITA, palabras: { minimo: 200, maximo: 100 } });
  afirmar(
    "error" in alReves && alReves.error.includes("no puede ser mayor que el máximo"),
    "un mínimo de palabras mayor que el máximo llega a la pantalla con su mensaje propio",
  );
  const sinMarca = revisarDatos({ consigna: "x" });
  afirmar(
    "error" in sinMarca && sinMarca.error.includes("le falta el tipo"),
    "algo sin discriminante sigue diciendo que le falta el tipo",
  );
  afirmar(
    "tipo" in revisarDatos({
      ejercicio: "opcion",
      consigna: "Elige.",
      multiple: false,
      preguntas: [{ id: "p1", enunciado: "¿Cuál?", opciones: ["a", "b"], correctas: [0] }],
    }),
    "el portero sigue aceptando los del motor",
  );

  // ─── La versión pública: el modelo no viaja antes de tiempo ─────────
  const datos = analizarExpresion(ESCRITA)!;
  const sinCorregir = versionPublicaExpresion(datos, false);
  const corregida = versionPublicaExpresion(datos, true);

  afirmar(
    !("modelo" in sinCorregir) || sinCorregir.modelo === undefined,
    "sin corregir, el modelo NO viaja: si viajara, se lee en el código de la página",
  );
  afirmar(corregida.modelo === ESCRITA.modelo, "corregida, el modelo sí viaja");
  afirmar(sinCorregir.consigna === ESCRITA.consigna, "la consigna viaja siempre");
  afirmar(sinCorregir.criterios.length === 2, "los criterios viajan siempre: el alumno ve con qué se le puntúa");

  // ─── La rúbrica ─────────────────────────────────────────────────────
  // El tercer argumento es la entrega ya guardada: fuera de las pruebas de
  // esa regla concreta, se manda un texto cualquiera para que no interfiera.
  afirmar(puedeValorarse(datos, { c1: 3, c2: 2 }, "Algo entregado.") === null, "una rúbrica completa se puede guardar");
  afirmar(puedeValorarse(datos, { c1: 3 }, "Algo entregado.") !== null, "falta un criterio: no se guarda");
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 9 }, "Algo entregado.") !== null,
    "una nota por encima del máximo se rechaza",
  );
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: -1 }, "Algo entregado.") !== null,
    "una nota negativa se rechaza",
  );
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 2, c9: 1 }, "Algo entregado.") !== null,
    "una nota de un criterio que no existe se rechaza",
  );
  afirmar(puntosDe(datos, { c1: 3, c2: 2 }) === 5, "los puntos son la suma de las notas");

  // Una escrita sin entrega no se puede corregir: si no, el profesor podía
  // valorar antes de que el alumno escribiera nada, y `puedeEntregar` le
  // cerraría la puerta para siempre con «ya está corregida».
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 2 }, null) !== null,
    "una escrita sin entrega no se puede corregir",
  );
  afirmar(
    puedeValorarse(datos, { c1: 3, c2: 2 }, "") !== null,
    "una escrita con entrega vacía tampoco se puede corregir",
  );

  // En una oral, en cambio, no hay entrega que guardar: valorar sin ella es
  // lo normal, no una excepción.
  const datosOral = analizarExpresion(ORAL)!;
  afirmar(
    puedeValorarse(datosOral, { c1: 3 }, null) === null,
    "una oral sin entrega sí se puede corregir",
  );

  // ─── La entrega, contra filas reales ────────────────────────────────
  const estudiante = await prisma.user.create({
    data: { email: `alumno-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(estudiante.id);
  const profesor = await prisma.user.create({
    data: { email: `profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  usuarioIds.push(profesor.id);
  // Un segundo profesor, solo para probar que `esDeEsteProfesor` distingue
  // entre «la asignación es mía» y «existe, pero es de otro».
  const otroProfesor = await prisma.user.create({
    data: { email: `otro-profe-${marca}@ejemplo.test`, role: "PROFESOR" },
  });
  usuarioIds.push(otroProfesor.id);

  const recorrido = await prisma.recorrido.create({
    data: { titulo: `Recorrido ${marca}`, nivel: "B1", orden: 1 },
  });
  recorridoId = recorrido.id;
  const paso = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Tarea 1", tipo: "MACRO_TAREA", ciclo: 1, orden: 1 },
  });
  pasoId = paso.id;
  const asignacion = await prisma.asignacion.create({
    data: { estudianteId: estudiante.id, profesorId: profesor.id, recorridoId: recorrido.id },
  });
  asignacionId = asignacion.id;

  // El paso lleva la escrita colgada desde el principio: `puedeEntregar`
  // exige que el paso pida de verdad una redacción, así que sin ejercicio
  // todo lo de abajo diría que no por el motivo equivocado.
  const escritaDelPaso = await prisma.ejercicio.create({
    data: { tipo: "EXPRESION", titulo: `Escrita del paso ${marca}`, nivel: "B1", datos: ESCRITA },
  });
  ejercicioIds.push(escritaDelPaso.id);
  await prisma.pasoEjercicio.create({
    data: { pasoId: paso.id, ejercicioId: escritaDelPaso.id, orden: 1 },
  });

  // ─── esDeEsteProfesor: una acción de servidor es un endpoint público ───
  afirmar(
    (await esDeEsteProfesor(asignacion.id, profesor.id)) === true,
    "esDeEsteProfesor acepta la propia asignación",
  );
  afirmar(
    (await esDeEsteProfesor(asignacion.id, otroProfesor.id)) === false,
    "esDeEsteProfesor rechaza la asignación de otro profesor",
  );
  afirmar(
    (await esDeEsteProfesor("noexiste", profesor.id)) === false,
    "esDeEsteProfesor rechaza una asignación que no existe",
  );

  afirmar(
    (await puedeEntregar(asignacion.id, paso.id, "Un texto normal.")) === null,
    "sin nada entregado todavía, se puede entregar",
  );

  // El tope de tamaño: `entregar` es un endpoint público y nadie tiene por
  // qué mandar dos megas de texto a una tarea de 120 palabras.
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id, "a".repeat(MAXIMO_ENTREGA))) === null,
    "un texto justo en el tope todavía entra",
  );
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id, "a".repeat(MAXIMO_ENTREGA + 1))) !== null,
    "un carácter más y se rechaza",
  );
  afirmar(
    MAXIMO_ENTREGA > 250 * 8,
    "el tope no le estorba a una tarea de 250 palabras, que es la más larga del examen",
  );

  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: paso.id, entrega: "Un primer intento." },
  });
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id, "Otro intento.")) === null,
    "entregado pero sin corregir, todavía se puede reescribir",
  );

  // ─── Desmarcar no borra una entrega ─────────────────────────────────
  // El botón «Hecho ✓» de la página del paso llama a esto. La fila de arriba
  // tiene entrega y no está verificada: sin el freno, un clic del alumno le
  // borraba su redacción de la base y la tiraba de la bandeja del profesor.
  afirmar(
    (await desmarcarSiNoRevisado(asignacion.id, paso.id)) === false,
    "una fila con entrega no se desmarca",
  );
  afirmar(
    (await prisma.pasoCompletado.count({
      where: { asignacionId: asignacion.id, pasoId: paso.id },
    })) === 1,
    "y sigue ahí: la entrega no se ha ido a ninguna parte",
  );

  // El otro extremo, que es el que discrimina: sin entrega y sin corregir,
  // desmarcar sigue borrando como siempre.
  const pasoSuelto = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Suelto", tipo: "ACTIVIDAD", ciclo: 1, orden: 9 },
  });
  pasoExtraIds.push(pasoSuelto.id);
  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: pasoSuelto.id },
  });
  afirmar(
    (await desmarcarSiNoRevisado(asignacion.id, pasoSuelto.id)) === true,
    "un paso corriente marcado a mano sí se desmarca",
  );

  await prisma.pasoCompletado.updateMany({
    where: { asignacionId: asignacion.id, pasoId: paso.id },
    data: { puntos: 5, verificadoEl: new Date() },
  });
  afirmar(
    (await puedeEntregar(asignacion.id, paso.id, "Otro más.")) !== null,
    "una vez corregida, ya no se puede reescribir",
  );

  // ─── La cita del oral ───────────────────────────────────────────────
  const otro = await prisma.user.create({
    data: { email: `otro-${marca}@ejemplo.test`, role: "STUDENT" },
  });
  usuarioIds.push(otro.id);

  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const suya = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: estudiante.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(suya.id);
  const ajena = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: otro.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(ajena.id);
  const anulada = await prisma.clase.create({
    data: {
      profesorId: profesor.id,
      estudianteId: estudiante.id,
      empiezaEl: manana,
      minutos: 60,
      estado: "ANULADA",
    },
  });
  claseIds.push(anulada.id);

  // Grupo del que el alumno es miembro: la clase se cita a través de él,
  // no de un `estudianteId` directo.
  const grupo = await prisma.grupo.create({
    data: { nombre: `Grupo ${marca}`, profesorId: profesor.id },
  });
  grupoIds.push(grupo.id);
  await prisma.miembroGrupo.create({
    data: { grupoId: grupo.id, estudianteId: estudiante.id },
  });
  const deGrupo = await prisma.clase.create({
    data: { profesorId: profesor.id, grupoId: grupo.id, empiezaEl: manana, minutos: 60 },
  });
  claseIds.push(deGrupo.id);

  // Suya, no anulada, pero ya pasada: ni se cita ni se ofrece.
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pasada = await prisma.clase.create({
    data: { profesorId: profesor.id, estudianteId: estudiante.id, empiezaEl: ayer, minutos: 60 },
  });
  claseIds.push(pasada.id);

  // Del mismo alumno, pero con otro profesor: un alumno puede dar clase con
  // varios, y las de los demás no son de este ni para ofrecerlas.
  const deOtroProfesor = await prisma.clase.create({
    data: {
      profesorId: otroProfesor.id,
      estudianteId: estudiante.id,
      empiezaEl: manana,
      minutos: 60,
      donde: "el aula del otro",
    },
  });
  claseIds.push(deOtroProfesor.id);

  afirmar(
    (await puedeCitarse(asignacion.id, suya.id, profesor.id)) === null,
    "se puede citar en una clase suya",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, ajena.id, profesor.id)) !== null,
    "no se puede citar en la clase de otro alumno",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, anulada.id, profesor.id)) !== null,
    "no se puede citar en una clase anulada",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, "noexiste", profesor.id)) !== null,
    "no se puede citar en una clase que no existe",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, deGrupo.id, profesor.id)) === null,
    "se puede citar en la clase de un grupo del alumno",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, pasada.id, profesor.id)) !== null,
    "no se puede citar en una clase que ya pasó",
  );

  // Los dos extremos de la cuarta negativa: la misma clase, un profesor a cada
  // lado. Sin el filtro, esa clase se citaba igual desde la ficha del alumno.
  afirmar(
    (await puedeCitarse(asignacion.id, deOtroProfesor.id, profesor.id)) !== null,
    "no se puede citar en la clase que el alumno tiene con otro profesor",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, deOtroProfesor.id, otroProfesor.id)) === null,
    "esa misma clase sí se cita desde el profesor que la da",
  );
  afirmar(
    (await puedeCitarse(asignacion.id, deOtroProfesor.id, null)) === null,
    "sin profesor no se filtra: es lo que manda un administrador",
  );

  const ofrecidas = await clasesParaCitar(asignacion.id, profesor.id);
  afirmar(
    ofrecidas.some((c) => c.id === suya.id),
    "la clase suya sale entre las que se ofrecen",
  );
  afirmar(
    ofrecidas.some((c) => c.id === deGrupo.id),
    "la clase del grupo sale entre las que se ofrecen",
  );
  afirmar(
    !ofrecidas.some(
      (c) => c.id === ajena.id || c.id === anulada.id || c.id === pasada.id,
    ),
    "la ajena, la anulada y la pasada no salen entre las que se ofrecen",
  );
  afirmar(
    !ofrecidas.some((c) => c.id === deOtroProfesor.id),
    "la clase del alumno con otro profesor no se ofrece: ni ella ni su «donde»",
  );

  const ofrecidasAlOtro = await clasesParaCitar(asignacion.id, otroProfesor.id);
  afirmar(
    ofrecidasAlOtro.some((c) => c.id === deOtroProfesor.id) &&
      !ofrecidasAlOtro.some((c) => c.id === suya.id),
    "al otro profesor se le ofrece la suya y no la de este",
  );

  const ofrecidasSinFiltro = await clasesParaCitar(asignacion.id, null);
  afirmar(
    ofrecidasSinFiltro.some((c) => c.id === suya.id) &&
      ofrecidasSinFiltro.some((c) => c.id === deOtroProfesor.id),
    "sin profesor salen las de los dos: es lo que ve un administrador",
  );

  // ─── expresionDelPaso: la rúbrica se resuelve en lib/, no en la acción ──
  const pasoSinEjercicio = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Sin ejercicio", tipo: "MACRO_TAREA", ciclo: 1, orden: 2 },
  });
  pasoExtraIds.push(pasoSinEjercicio.id);
  afirmar(
    (await expresionDelPaso(pasoSinEjercicio.id)) === null,
    "un paso sin ningún ejercicio no tiene tarea de expresión",
  );

  const ejercicioMotor = await prisma.ejercicio.create({
    data: {
      tipo: "OPCION_MULTIPLE",
      titulo: `Del motor ${marca}`,
      nivel: "B1",
      datos: { ejercicio: "opcion", consigna: "x", multiple: false, preguntas: [] },
    },
  });
  ejercicioIds.push(ejercicioMotor.id);
  const pasoDelMotor = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Del motor", tipo: "MACRO_TAREA", ciclo: 1, orden: 3 },
  });
  pasoExtraIds.push(pasoDelMotor.id);
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoDelMotor.id, ejercicioId: ejercicioMotor.id, orden: 1 },
  });
  afirmar(
    (await expresionDelPaso(pasoDelMotor.id)) === null,
    "un paso con un ejercicio del motor tampoco tiene tarea de expresión",
  );

  const ejercicioExpresion = await prisma.ejercicio.create({
    data: { tipo: "EXPRESION", titulo: `Escrita ${marca}`, nivel: "B1", datos: ESCRITA },
  });
  ejercicioIds.push(ejercicioExpresion.id);
  const pasoConExpresion = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Con expresión", tipo: "MACRO_TAREA", ciclo: 1, orden: 4 },
  });
  pasoExtraIds.push(pasoConExpresion.id);
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoConExpresion.id, ejercicioId: ejercicioExpresion.id, orden: 1 },
  });
  const resuelta = await expresionDelPaso(pasoConExpresion.id);
  afirmar(
    resuelta !== null && resuelta.consigna === ESCRITA.consigna,
    "un paso con una tarea de expresión la devuelve",
  );

  // ─── Un paso que no pide redacción no admite entrega ────────────────
  // `entregar` es un endpoint público: con un `pasoId` cualquiera se creaba
  // una fila, el paso quedaba «hecho» y la bandeja listaba algo que al
  // abrirlo contestaba `notFound()`.
  afirmar(
    (await puedeEntregar(asignacion.id, pasoSinEjercicio.id, "Hola.")) !== null,
    "un paso sin ejercicio no admite entrega",
  );
  afirmar(
    (await puedeEntregar(asignacion.id, pasoDelMotor.id, "Hola.")) !== null,
    "un paso con un ejercicio del motor tampoco",
  );

  const ejercicioOral = await prisma.ejercicio.create({
    data: { tipo: "EXPRESION", titulo: `Oral ${marca}`, nivel: "B1", datos: ORAL },
  });
  ejercicioIds.push(ejercicioOral.id);
  const pasoOral = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "El oral", tipo: "MACRO_TAREA", ciclo: 1, orden: 5 },
  });
  pasoExtraIds.push(pasoOral.id);
  await prisma.pasoEjercicio.create({
    data: { pasoId: pasoOral.id, ejercicioId: ejercicioOral.id, orden: 1 },
  });
  afirmar(
    (await puedeEntregar(asignacion.id, pasoOral.id, "Hola.")) !== null,
    "un oral tampoco: se evalúa en clase, no se escribe aquí",
  );
  afirmar(
    (await puedeEntregar(asignacion.id, pasoConExpresion.id, "Hola.")) === null,
    "y el paso que sí pide una redacción la sigue admitiendo",
  );

  // ─── Quitar o editar un ejercicio con entregas ──────────────────────
  // Las tres reglas miraban solo `respuestas`, y una expresión no escribe ahí
  // nunca: escribe en `entrega` y en `valoracion`.
  const publicado = await prisma.ejercicio.create({
    data: {
      tipo: "EXPRESION",
      titulo: `Publicado ${marca}`,
      nivel: "B1",
      datos: ESCRITA,
      publicado: true,
    },
  });
  ejercicioIds.push(publicado.id);

  // Antes de que nadie trabaje: las tres puertas están abiertas. Esta mitad
  // es la que discrimina, porque prohibir siempre también pasaría el resto.
  afirmar(!(await tieneTrabajo(pasoConExpresion.id)), "un paso sin nada del alumno no tiene trabajo");
  afirmar(
    (await puedeDesengancharse(pasoConExpresion.id)) === null,
    "y se le puede quitar el ejercicio",
  );
  afirmar(
    (await puedeEditarse(ejercicioExpresion.id)) === null,
    "y el ejercicio se puede editar",
  );

  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: pasoConExpresion.id, entrega: "Mi redacción." },
  });
  afirmar(
    await tieneTrabajo(pasoConExpresion.id),
    "una entrega cuenta como trabajo, aunque `respuestas` esté vacía",
  );
  afirmar(
    (await puedeDesengancharse(pasoConExpresion.id)) !== null,
    "con una entrega no se desengancha: la redacción se quedaría sin ninguna pantalla",
  );
  afirmar(
    (await puedeEditarse(ejercicioExpresion.id)) !== null,
    "con una entrega no se editan los criterios: las notas guardadas apuntan a sus ids",
  );

  // Solo la valoración, sin entrega ni respuestas: es el oral ya corregido.
  await prisma.pasoCompletado.create({
    data: {
      asignacionId: asignacion.id,
      pasoId: pasoOral.id,
      valoracion: { notas: { c1: 3 }, comentario: "Bien." },
      puntos: 3,
      verificadoEl: new Date(),
    },
  });
  afirmar(await tieneTrabajo(pasoOral.id), "una valoración sola también cuenta como trabajo");
  afirmar(
    (await puedeEditarse(ejercicioOral.id)) !== null,
    "un oral ya corregido no se edita: quitarle un criterio dejaría la nota apuntando a nada",
  );

  // La tercera puerta, sobre un paso al que ya le quitaron el ejercicio pero
  // que conserva la entrega: no se le cuelga otro encima.
  const pasoHuerfano = await prisma.paso.create({
    data: { recorridoId: recorrido.id, titulo: "Huérfano", tipo: "MACRO_TAREA", ciclo: 1, orden: 6 },
  });
  pasoExtraIds.push(pasoHuerfano.id);
  afirmar(
    (await puedeEngancharse(publicado.id, pasoHuerfano.id)) === null,
    "a un paso vacío sí se le cuelga un ejercicio",
  );
  await prisma.pasoCompletado.create({
    data: { asignacionId: asignacion.id, pasoId: pasoHuerfano.id, entrega: "Lo que escribí." },
  });
  afirmar(
    (await puedeEngancharse(publicado.id, pasoHuerfano.id)) !== null,
    "con una entrega guardada, ya no",
  );

  console.log("\nTodo bien.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    // `process.exit` mataría el proceso antes del `finally` y la limpieza no
    // correría: en TDD el paso que falla lo hace a propósito, así que eso
    // dejaría basura en la base cada vez.
    process.exitCode = 1;
  })
  .finally(async () => {
    let fallos = 0;
    async function intentar(que: string, fn: () => Promise<unknown>) {
      try {
        await fn();
      } catch (e) {
        fallos++;
        console.error(`FALLO AL LIMPIAR (${que}): ${e instanceof Error ? e.message : e}`);
      }
    }
    // El orden importa: los vínculos antes que sus extremos.
    if (asignacionId) {
      const id = asignacionId;
      await intentar("citas", () => prisma.citaOral.deleteMany({ where: { asignacionId: id } }));
      await intentar("pasos completados", () => prisma.pasoCompletado.deleteMany({ where: { asignacionId: id } }));
      await intentar("asignación", () => prisma.asignacion.delete({ where: { id } }));
    }
    if (pasoId) {
      const id = pasoId;
      await intentar("paso", () => prisma.paso.delete({ where: { id } }));
    }
    if (pasoExtraIds.length) {
      // Antes que sus ejercicios y que el recorrido: borrar el paso
      // arrastra en cascada su `PasoEjercicio`, así que el ejercicio queda
      // libre para borrarse justo después.
      await intentar("pasos extra", () => prisma.paso.deleteMany({ where: { id: { in: pasoExtraIds } } }));
    }
    if (ejercicioIds.length) {
      await intentar("ejercicios", () => prisma.ejercicio.deleteMany({ where: { id: { in: ejercicioIds } } }));
    }
    if (recorridoId) {
      const id = recorridoId;
      await intentar("recorrido", () => prisma.recorrido.delete({ where: { id } }));
    }
    if (claseIds.length) {
      // Antes que los usuarios: Clase.profesorId es RESTRICT.
      await intentar("clases", () => prisma.clase.deleteMany({ where: { id: { in: claseIds } } }));
    }
    if (grupoIds.length) {
      // Después de las clases: Clase.grupoId apunta al grupo. Y los
      // miembros antes que el grupo, aunque el borrado en cascada ya lo
      // haría: mejor no depender de eso.
      await intentar("miembros de grupo", () =>
        prisma.miembroGrupo.deleteMany({ where: { grupoId: { in: grupoIds } } }),
      );
      await intentar("grupos", () => prisma.grupo.deleteMany({ where: { id: { in: grupoIds } } }));
    }
    if (usuarioIds.length) {
      await intentar("usuarios", () => prisma.user.deleteMany({ where: { id: { in: usuarioIds } } }));
    }
    await intentar("desconectar", () => prisma.$disconnect());
    if (fallos > 0) {
      console.error(`\n${fallos} paso(s) de limpieza fallaron: puede quedar basura en la base.`);
      process.exitCode = 1;
    }
  });
