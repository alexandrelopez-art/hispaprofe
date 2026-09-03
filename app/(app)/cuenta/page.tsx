import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";
import Boton from "@/components/ui/boton";
import Encabezado from "@/components/ui/encabezado";
import Tarjeta from "@/components/ui/tarjeta";

export const dynamic = "force-dynamic";

const rolLabel: Record<string, string> = {
  ADMIN: "Administrador",
  PROFESOR: "Profesor",
  STUDENT: "Estudiante",
};

export default async function CuentaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");
  const nombre = [usuario.firstName, usuario.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Encabezado titulo="Mi cuenta" />
      <Tarjeta className="mt-6 text-sm">
        <dl>
          <div className="flex justify-between py-1"><dt className="text-tinta-suave">Correo</dt><dd className="font-semibold text-tinta">{usuario.email}</dd></div>
          <div className="flex justify-between py-1"><dt className="text-tinta-suave">Nombre</dt><dd className="font-semibold text-tinta">{nombre || "—"}</dd></div>
          <div className="flex justify-between py-1"><dt className="text-tinta-suave">Perfil</dt><dd className="font-semibold text-tinta">{rolLabel[usuario.role]}</dd></div>
        </dl>
      </Tarjeta>
      <Boton href="/cuenta/contrasena" variante="secundario" className="mt-5">
        Cambiar contraseña
      </Boton>
    </div>
  );
}
