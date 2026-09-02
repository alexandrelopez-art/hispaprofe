import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";

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
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">Mi cuenta</h1>
      <dl className="mt-6 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave text-sm">
        <div className="flex justify-between py-1"><dt className="text-tinta-suave">Correo</dt><dd className="font-semibold text-tinta">{usuario.email}</dd></div>
        <div className="flex justify-between py-1"><dt className="text-tinta-suave">Nombre</dt><dd className="font-semibold text-tinta">{nombre || "—"}</dd></div>
        <div className="flex justify-between py-1"><dt className="text-tinta-suave">Perfil</dt><dd className="font-semibold text-tinta">{rolLabel[usuario.role]}</dd></div>
      </dl>
      <Link
        href="/cuenta/contrasena"
        className="mt-5 inline-flex h-10 items-center rounded-full border border-hp-300 px-5 text-sm font-bold text-hp-600 hover:border-hp-400"
      >
        Cambiar contraseña
      </Link>
    </div>
  );
}
