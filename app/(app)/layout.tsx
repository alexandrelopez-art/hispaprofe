import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getUsuarioActual } from "@/lib/usuario";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Crea la fila de User la primera vez que entra. Va en el layout para
  // que ocurra en cualquier página de la zona con sesión, no solo en el panel.
  const usuario = await getUsuarioActual();
  const esProfe = usuario?.role === "PROFESOR" || usuario?.role === "ADMIN";

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-hp-100">
        <div className="mx-auto max-w-6xl flex items-center gap-6 px-6 h-16">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-sol-300 text-tinta font-extrabold text-sm">
              H
            </span>
            <span className="font-extrabold text-tinta hidden sm:block">
              HispaProfe
            </span>
          </Link>

          <nav className="flex items-center gap-5 text-sm font-semibold text-tinta-suave">
            <Link
              href="/dashboard"
              className="hover:text-hp-500 transition-colors"
            >
              Panel
            </Link>
            <Link
              href="/recorridos"
              className="hover:text-hp-500 transition-colors"
            >
              Secuencias
            </Link>
            {esProfe && (
              <Link
                href="/profe/alumnos"
                className="hover:text-hp-500 transition-colors"
              >
                Estudiantes
              </Link>
            )}
          </nav>

          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </>
  );
}
