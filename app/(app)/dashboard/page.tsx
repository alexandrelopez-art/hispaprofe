import { getUsuarioActual } from "@/lib/usuario";
import { redirect } from "next/navigation";
import PanelEstudiante from "./panel-estudiante";
import PanelProfesor from "./panel-profesor";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/");

  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";

  return esProfe ? (
    <PanelProfesor usuario={usuario} />
  ) : (
    <PanelEstudiante usuario={usuario} />
  );
}
