import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import Link from "next/link";
import Formulario from "./formulario";

export default async function NuevoEstudiantePage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link href="/profe/alumnos" className="text-sm font-semibold text-tinta-suave hover:text-hp-500">
        ← Estudiantes
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">Nuevo estudiante</h1>
      <p className="mt-2 text-tinta-suave">
        Se crea su ficha con el correo y una contraseña inicial que verás una sola
        vez: dásela por donde habléis. Al entrar tendrá que cambiarla. Para una
        clase entera, es más rápido pegar la lista en un{" "}
        <Link href="/profe/grupos" className="font-semibold text-hp-600 hover:text-hp-500">grupo</Link>
        {" "}y darles la contraseña desde cada ficha.
      </p>
      <Formulario />
    </div>
  );
}
