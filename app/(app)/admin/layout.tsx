import { getUsuarioActual } from "@/lib/usuario";
import { esAdmin } from "@/lib/roles";
import { notFound } from "next/navigation";
import Boton from "@/components/ui/boton";
import Encabezado from "@/components/ui/encabezado";

export const dynamic = "force-dynamic";

const pestanas = [
  { href: "/admin", texto: "Resumen" },
  { href: "/admin/personas", texto: "Personas" },
  { href: "/admin/secuencias", texto: "Secuencias" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El candado de verdad. Esconder el enlace en la barra no basta: quien
  // escriba /admin a mano tiene que rebotar aquí.
  const usuario = await getUsuarioActual();
  if (!esAdmin(usuario)) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Encabezado titulo="Administración" margen="corto" />

      {/* Sin marca de pestaña activa: el nav de origen tampoco la tenía. */}
      <nav className="mb-6 flex flex-wrap gap-2">
        {pestanas.map((p) => (
          <Boton key={p.href} href={p.href} variante="sutil" tamano="pequeno">
            {p.texto}
          </Boton>
        ))}
      </nav>

      {children}
    </div>
  );
}
