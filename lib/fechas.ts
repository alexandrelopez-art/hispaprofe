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

/** Cuánto se adelanta Madrid a UTC en ese instante (verano incluido), en ms. */
function desfase(d: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>(
      (a, p) => (p.type === "literal" ? a : { ...a, [p.type]: p.value }),
      {},
    );
  const comoUtc = Date.UTC(
    +partes.year,
    +partes.month - 1,
    +partes.day,
    // Medianoche sale como «24» en algunas versiones de ICU.
    +partes.hour % 24,
    +partes.minute,
    +partes.second,
  );
  return comoUtc - d.getTime();
}

/**
 * «2026-08-04T18:00» del navegador son las 18:00 de Madrid, no del servidor.
 *
 * `new Date(bruto)` interpretaría esa cadena sin offset en la zona de la
 * máquina: en un portátil de Madrid acierta por casualidad y en producción
 * (servidor en UTC) guarda la clase dos horas tarde, y el desfase se acumula
 * en cada edición. Null si la cadena no vale, para volver sin escribir.
 */
export function deInput(bruto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(bruto);
  if (!m) return null;
  const aprox = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Dos pasadas: el desfase depende del instante, y el instante del desfase.
  const uno = new Date(aprox - desfase(new Date(aprox)));
  return new Date(aprox - desfase(uno));
}

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
