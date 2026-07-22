import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

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
            <span className="grid place-items-center w-8 h-8 rounded-full bg-sol-300 text-tinta font-extrabold text-sm">
              H
            </span>
            <span className="font-extrabold text-tinta">HispaProfe</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-5 text-sm font-semibold text-tinta-suave">
            <Link href="/dele" className="hover:text-hp-500 transition-colors">
              DELE
            </Link>
            <Link
              href="/entre-profes"
              className="hover:text-hp-500 transition-colors"
            >
              Entre profes
            </Link>
            <Link
              href="/cultura"
              className="hover:text-hp-500 transition-colors"
            >
              Cultura
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton>
                <button className="rounded-full bg-hp-400 text-white text-sm font-bold h-10 px-5 cursor-pointer hover:bg-hp-500 transition-colors">
                  Iniciar sesión
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="hidden sm:block rounded-full border-2 border-hp-200 text-hp-600 text-sm font-bold h-10 px-5 cursor-pointer hover:border-hp-400 transition-colors">
                  Crear cuenta
                </button>
              </SignUpButton>
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
