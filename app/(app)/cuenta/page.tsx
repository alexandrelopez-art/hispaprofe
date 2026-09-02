import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";
import Boton from "@/components/ui/boton";
import Encabezado from "@/components/ui/encabezado";

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
      <dl className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave text-sm">
        <div className="flex justify-between py-1"><dt className="text-tinta-suave">Correo</dt><dd className="font-semibold text-tinta">{usuario.email}</dd></div>
        <div className="flex justify-between py-1"><dt className="text-tinta-suave">Nombre</dt><dd className="font-semibold text-tinta">{nombre || "—"}</dd></div>
        <div className="flex justify-between py-1"><dt className="text-tinta-suave">Perfil</dt><dd className="font-semibold text-tinta">{rolLabel[usuario.role]}</dd></div>
      </dl>
      <Boton href="/cuenta/contrasena" variante="secundario" className="mt-5">
        Cambiar contraseña
      </Boton>
    </div>
  );
}
