import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
              Recorridos
            </Link>
            <Link
              href="/preparacion"
              className="hover:text-hp-500 transition-colors"
            >
              Preparación
            </Link>
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
