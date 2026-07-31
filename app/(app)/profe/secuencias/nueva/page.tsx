import { getUsuarioActual } from "@/lib/usuario";
import { crearSecuencia } from "@/lib/acciones";
import { redirect } from "next/navigation";
import Link from "next/link";
import EleccionDele from "./eleccion-dele";

const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export default async function NuevaSecuenciaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link
        href="/recorridos"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Secuencias
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        Nueva secuencia
      </h1>
      <p className="mt-2 text-tinta-suave">
        Aquí van los datos generales. Los pasos se añaden después, desde la
        ficha de la secuencia.
      </p>

      <form
        action={crearSecuencia}
        className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
      >
        <EleccionDele tituloInicial="" />

        <label className="mt-4 block text-sm font-semibold text-tinta">
          Descripción
          <input
            type="text"
            name="descripcion"
            placeholder="Una línea sobre qué trabaja"
            className={campo}
          />
        </label>

        <label className="mt-5 flex items-start gap-2 text-sm text-tinta">
          <input
            type="checkbox"
            name="plantilla"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-hp-400"
          />
          <span>
            <span className="font-semibold">
              Crear con la estructura recomendada
            </span>
            <br />
            <span className="text-tinta-suave">
              9 pasos en 2 ciclos: activación, actividades, andamiaje y micro
              tarea; luego actividades, andamiaje y macro tarea. Los títulos
              son provisionales y se cambian al entrar en cada paso.
            </span>
          </span>
        </label>

        <button
          type="submit"
          className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Crear y añadir pasos
        </button>
      </form>
    </div>
  );
}
