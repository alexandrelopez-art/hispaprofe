import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

const enlacesNav = [
  { href: "/", label: "Inicio" },
  { href: "/#clases", label: "Clases" },
  { href: "/#actividades", label: "Actividades" },
  { href: "/#dele", label: "DELE" },
  { href: "/#sobre-mi", label: "Sobre mí" },
  { href: "/#hablared", label: "HablaRed", destacado: true },
];

export default function PublicoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-hp-100">
        <div className="mx-auto max-w-6xl flex items-center gap-6 px-6 h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-hp-500 text-white font-extrabold text-xl">
              ñ
            </span>
            <span className="font-extrabold text-tinta text-lg">
              Hispa<span className="text-coral-500">profe</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold text-tinta-suave">
            {enlacesNav.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className={`transition-colors ${
                  e.destacado
                    ? "text-coral-500 hover:text-coral-600"
                    : "hover:text-hp-500"
                }`}
              >
                {e.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton>
                <button className="hidden sm:block text-sm font-semibold text-tinta-suave hover:text-hp-500 transition-colors cursor-pointer">
                  Iniciar sesión
                </button>
              </SignInButton>
              <a
                href="mailto:contacto@hispaprofe.com?subject=Reservar%20una%20clase"
                className="rounded-full bg-hp-500 text-white text-sm font-bold h-10 px-5 flex items-center justify-center hover:bg-hp-600 transition-colors"
              >
                Reserva una clase
              </a>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-tinta-suave hover:text-hp-500 transition-colors"
              >
                Mi panel
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </>
  );
}
