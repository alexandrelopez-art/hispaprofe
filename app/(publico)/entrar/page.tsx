import { redirect } from "next/navigation";
import { usuarioDeLaSesion } from "@/lib/sesion";
import Formulario from "./formulario";

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver = "" } = await searchParams;
  if (await usuarioDeLaSesion()) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight text-tinta">Entrar</h1>
      <p className="mt-2 text-tinta-suave">
        Con el correo y la contraseña que te dio tu profe.
      </p>
      <Formulario volver={volver} />
      <p className="mt-6 text-sm text-tinta-suave">
        ¿Sin contraseña, o la has olvidado? Pídesela a tu profe: te dará una nueva.
      </p>
    </div>
  );
}
