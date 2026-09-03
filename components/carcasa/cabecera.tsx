import Link from "next/link";
import { salir } from "@/lib/acciones-entrada";
import { esAdmin } from "@/lib/roles";
import Etiqueta from "@/components/ui/etiqueta";
import Logo from "@/components/ui/logo";
import NavPuertas from "./nav-puertas";

type Usuario = { firstName: string | null; email: string; role: string };

/**
 * La cabecera de dentro: el mismo logo que la portada, las puertas, y a la
 * derecha quién eres. `reducida` es la de «debes cambiar la contraseña»: sin
 * puertas ni enlaces, para que no haya por dónde saltarse el cambio.
 */
export default function Cabecera({ usuario, reducida = false }: { usuario: Usuario; reducida?: boolean }) {
  const nombre = usuario.firstName ?? usuario.email;
  const esProfe = usuario.role === "PROFESOR" || usuario.role === "ADMIN";
  return (
    <header className="sticky top-0 z-10 border-b border-hp-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-6 pt-3">
        <Logo enlaza={!reducida} href="/dashboard" />
        <div className="ml-auto flex items-center gap-3 text-sm font-semibold text-tinta-suave">
          {!reducida && (
            <Link href="/cuenta" className="hidden sm:inline hover:text-hp-500">{nombre}</Link>
          )}
          {!reducida && (
            <Link href="/cuenta" className="sm:hidden hover:text-hp-500">Mi cuenta</Link>
          )}
          {!reducida && esProfe && <Etiqueta tono="sol">Profesor</Etiqueta>}
          {!reducida && esProfe && (
            <Link href="/muestrario" className="hover:text-hp-500">Piezas</Link>
          )}
          {!reducida && esAdmin(usuario) && (
            <Link href="/admin" className="hover:text-hp-500">Administración</Link>
          )}
          <form action={salir}>
            <button type="submit" className="h-9 rounded-full border border-hp-200 px-4 transition-colors hover:border-hp-400 hover:text-hp-500">Salir</button>
          </form>
        </div>
        {!reducida && <div className="w-full sm:w-auto sm:basis-full"><NavPuertas /></div>}
      </div>
    </header>
  );
}
