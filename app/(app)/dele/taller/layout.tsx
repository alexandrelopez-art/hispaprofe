import { notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";

export default async function TallerLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) notFound();
  return <>{children}</>;
}
