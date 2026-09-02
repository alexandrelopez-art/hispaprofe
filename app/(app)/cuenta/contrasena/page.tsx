import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";
import Encabezado from "@/components/ui/encabezado";
import Formulario from "./formulario";

export const dynamic = "force-dynamic";

export default async function ContrasenaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");
  const obligado = usuario.debeCambiarContrasena;

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <Encabezado
        titulo={obligado ? "Elige tu contraseña" : "Cambiar contraseña"}
        lede={
          obligado
            ? "Tu profe te dio una contraseña para entrar. Elige una tuya para seguir."
            : "Escribe la actual y la nueva dos veces."
        }
      />
      <Formulario obligado={obligado} />
    </div>
  );
}
