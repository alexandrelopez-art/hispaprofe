import { getUsuarioActual } from "@/lib/usuario";
import { crearEstudiante } from "@/lib/acciones";
import { redirect } from "next/navigation";
import Link from "next/link";

const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export default async function NuevoEstudiantePage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link
        href="/profe/alumnos"
        className="text-sm font-semibold text-tinta-suave hover:text-hp-500"
      >
        ← Estudiantes
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tinta">
        Nuevo estudiante
      </h1>
      <p className="mt-2 text-tinta-suave">
        Se crea su ficha con el correo. Cuando esa persona se registre con ese
        mismo correo, la ficha se empareja sola y encuentra lo que le hayas
        asignado. Para dar de alta una clase entera, es más rápido pegar la
        lista en un <Link href="/profe/grupos" className="font-semibold text-hp-600 hover:text-hp-500">grupo</Link>.
      </p>

      <form
        action={crearEstudiante}
        className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave"
      >
        <label className="block text-sm font-semibold text-tinta">
          Correo
          <input
            type="email"
            name="email"
            required
            placeholder="estudiante@gmail.com"
            className={campo}
          />
        </label>

        <div className="mt-4 flex gap-3">
          <label className="flex-1 text-sm font-semibold text-tinta">
            Nombre
            <input type="text" name="firstName" className={campo} />
          </label>
          <label className="flex-1 text-sm font-semibold text-tinta">
            Apellido
            <input type="text" name="lastName" className={campo} />
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-tinta">
          Nivel
          <select name="nivel" defaultValue="" className={campo}>
            <option value="">Sin nivel</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="A2_B1_ESCOLAR">A2/B1 escolar</option>
          </select>
        </label>

        <button
          type="submit"
          className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500"
        >
          Crear ficha
        </button>
      </form>
    </div>
  );
}
