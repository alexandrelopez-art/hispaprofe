import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";
import ClasesEstudiante from "./estudiante";
import ClasesProfesor from "./profesor";

export const dynamic = "force-dynamic";

export default async function ClasesPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/entrar");
  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {esProfe ? <ClasesProfesor usuario={usuario} /> : <ClasesEstudiante usuario={usuario} />}
    </div>
  );
}
