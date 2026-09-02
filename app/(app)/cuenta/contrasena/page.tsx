import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";
import Formulario from "./formulario";

export const dynamic = "force-dynamic";

export default async function ContrasenaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");
  const obligado = usuario.debeCambiarContrasena;

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        {obligado ? "Elige tu contraseña" : "Cambiar contraseña"}
      </h1>
      <p className="mt-2 text-tinta-suave">
        {obligado
          ? "Tu profe te dio una contraseña para entrar. Elige una tuya para seguir."
          : "Escribe la actual y la nueva dos veces."}
      </p>
      <Formulario obligado={obligado} />
    </div>
  );
}
