import { getUsuarioActual } from "@/lib/usuario";
import { esAdmin } from "@/lib/roles";
import { notFound } from "next/navigation";
import Link from "next/link";

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
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">
        Administración
      </h1>

      <nav className="mt-6 flex flex-wrap gap-2">
        {pestanas.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-full border-2 border-hp-200 px-4 py-1.5 text-sm font-bold text-hp-600 transition-colors hover:border-hp-400"
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
