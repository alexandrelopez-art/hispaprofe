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
