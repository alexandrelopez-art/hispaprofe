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
