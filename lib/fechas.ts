/**
 * Fechas en español y con zona horaria fija.
 *
 * La zona se escribe a mano en vez de dejar la del servidor: en producción
 * el servidor va en UTC y una clase de las 18:00 se enseñaría a las 16:00.
 */
const ZONA = "Europe/Madrid";

const largo = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const corto = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

/** «martes, 4 de agosto, 18:00» */
export function fechaHora(d: Date): string {
  return largo.format(d);
}

/** «4/8/2026» */
export function fechaCorta(d: Date): string {
  return corto.format(d);
}

/**
 * El formato que quiere un <input type="datetime-local">: 2026-08-04T18:00.
 * Se compone a partir de las piezas ya traducidas a la zona, porque
 * `toISOString()` daría UTC y adelantaría o atrasaría la hora.
 */
export function paraInput(d: Date): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  // sv-SE da «2026-08-04 18:00»; el input quiere una T en medio.
  return partes.replace(" ", "T");
}
