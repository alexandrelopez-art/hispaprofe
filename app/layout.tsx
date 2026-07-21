import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HispaProfe",
  description: "Aprende español con un profe de verdad",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="es"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <header className="flex justify-end items-center gap-3 p-4 h-16">
            <Show when="signed-out">
              <SignInButton>
                <button className="rounded-full bg-purple-600 text-white text-sm font-medium h-10 px-5 cursor-pointer">
                  Iniciar sesión
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="rounded-full border border-purple-600 text-purple-600 text-sm font-medium h-10 px-5 cursor-pointer">
                  Crear cuenta
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
