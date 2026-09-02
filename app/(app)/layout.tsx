import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { bloqueoDelActual, getUsuarioActual } from "@/lib/usuario";
import Cabecera from "@/components/carcasa/cabecera";
import Banda from "@/components/carcasa/banda";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Lee el usuario de la sesión actual. La fila de User ya existe de antes:
  // la crea el profesor al dar de alta a la persona, no esta pantalla.
  const usuario = await getUsuarioActual();

  // Si no hay usuario puede ser que no haya sesión o que esté bloqueado. Solo
  // en ese caso se pregunta por el bloqueo, así que es una consulta de más
  // únicamente en el caso raro.
  if (!usuario && (await bloqueoDelActual())) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-tinta">
          Tu acceso está bloqueado
        </h1>
        <p className="mt-3 text-tinta-suave">
          Tu cuenta sigue existiendo, pero ahora mismo no puedes entrar. Habla
          con tu profesor si crees que es un error.
        </p>
      </main>
    );
  }

  if (!usuario) redirect("/entrar");

  // Una contraseña puesta por el profesor no se puede usar más de una vez:
  // hasta que la cambie, la única página que existe es la del cambio. Se
  // permite salir, para no atrapar a quien entró por error.
  if (usuario.debeCambiarContrasena) {
    const ruta = (await headers()).get("x-ruta-actual") ?? "";
    if (ruta !== "/cuenta/contrasena") redirect("/cuenta/contrasena");

    // Next no vuelve a ejecutar el layout en una navegación de cliente, así
    // que la única forma segura de que no haya salida es que no haya
    // enlaces: sin <nav> ni «Mi cuenta», no hay a dónde navegar aunque la
    // redirección de arriba solo se ejecute en la carga de esta página.
  }

  return (
    <>
      <Cabecera usuario={usuario} reducida={usuario.debeCambiarContrasena} />
      {!usuario.debeCambiarContrasena && <Banda rol={usuario.role} />}
      <main className="flex-1">{children}</main>
    </>
  );
}
