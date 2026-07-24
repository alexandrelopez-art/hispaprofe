import { cookies } from "next/headers";
import { getUsuarioActual } from "@/lib/usuario";
import { googleConfigurado, urlConsentimiento } from "@/lib/google";

export async function GET() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    return Response.redirect(new URL("/dashboard", process.env.APP_URL ?? "http://localhost:3000"));
  }

  if (!googleConfigurado()) {
    return new Response(
      "Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el archivo .env",
      { status: 500 },
    );
  }

  // Estado aleatorio contra peticiones falsificadas: se guarda en una
  // cookie y se comprueba a la vuelta.
  const estado = crypto.randomUUID();
  const almacen = await cookies();
  almacen.set("estado_google", estado, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return Response.redirect(urlConsentimiento(estado));
}
