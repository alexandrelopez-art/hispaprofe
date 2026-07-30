/**
 * Los correos que ascienden a administrador, desde ADMIN_EMAILS.
 *
 * Se lee en cada llamada y no se guarda en una constante de módulo: en
 * desarrollo la variable puede cambiar sin reiniciar, y el script de
 * verificación la modifica entre comprobaciones.
 */
export function correosDeAdmin(): string[] {
  const bruto = process.env.ADMIN_EMAILS ?? "";
  return bruto
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function esCorreoDeAdmin(email: string): boolean {
  return correosDeAdmin().includes(email.trim().toLowerCase());
}

/**
 * Administrador de verdad, no "profesor o administrador". El resto de la
 * aplicacion usa `PROFESOR || ADMIN` a proposito; esto es mas estrecho y
 * solo vale para el area de administracion.
 */
export function esAdmin(usuario: { role: string } | null | undefined): boolean {
  return usuario?.role === "ADMIN";
}

/**
 * Bloqueado es quien tiene fecha de bloqueo. Se comprueba en
 * `getUsuarioActual`, que es por donde pasa todo, y no en cada acción: una
 * comprobación repartida por veinte sitios es una comprobación que alguien
 * acabará olvidando.
 */
export function estaBloqueado(
  usuario: { bloqueadoEl: Date | null } | null | undefined,
): boolean {
  return Boolean(usuario?.bloqueadoEl);
}

/** Suprimido es quien tiene la ficha vacía. Su fila sigue ahí a propósito. */
export function estaSuprimido(
  usuario: { suprimidoEl: Date | null } | null | undefined,
): boolean {
  return Boolean(usuario?.suprimidoEl);
}
