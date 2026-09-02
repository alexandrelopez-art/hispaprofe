import { NextResponse, type NextRequest } from "next/server";

/**
 * El portero. Solo mira si HAY cookie de sesión: no toca la base, que es
 * lo que la documentación de proxy pide. Una cookie caducada o inventada
 * pasa de aquí y la para `getUsuarioActual()` en el layout.
 *
 * `/api/archivos/<id>` sigue abierto a propósito: los ficheros públicos ya
 * se sirven sin sesión a sabiendas, y los privados los guarda la propia ruta.
 */
const PUBLICAS = new Set(["/", "/entrar"]);
const NOMBRE_COOKIE = "hp_sesion";

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLICAS.has(pathname) || pathname.startsWith("/api/archivos/")) return;
  if (request.cookies.has(NOMBRE_COOKIE)) {
    // Deja pasar el nombre de la ruta actual: el layout de `(app)` lo usa
    // para saber si ya está en la pantalla de cambio de contraseña.
    const cabeceras = new Headers(request.headers);
    cabeceras.set("x-ruta-actual", pathname);
    return NextResponse.next({ request: { headers: cabeceras } });
  }

  const destino = new URL("/entrar", request.url);
  destino.searchParams.set("volver", pathname + search);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
