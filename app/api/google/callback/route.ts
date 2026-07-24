import { cookies } from "next/headers";
import { getUsuarioActual } from "@/lib/usuario";
import { guardarTokens } from "@/lib/google";

const BASE = process.env.APP_URL ?? "http://localhost:3000";

function volver(mensaje: string) {
  return Response.redirect(`${BASE}/profe/grupos?google=${mensaje}`);
}

export async function GET(peticion: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    return Response.redirect(`${BASE}/dashboard`);
  }

  const url = new URL(peticion.url);
  const codigo = url.searchParams.get("code");
  const estado = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return volver("cancelado");
  if (!codigo || !estado) return volver("incompleto");

  const almacen = await cookies();
  const esperado = almacen.get("estado_google")?.value;
  almacen.delete("estado_google");

  if (!esperado || esperado !== estado) return volver("estado");

  try {
    await guardarTokens(codigo, usuario.id);
    return volver("ok");
  } catch {
    return volver("fallo");
  }
}
