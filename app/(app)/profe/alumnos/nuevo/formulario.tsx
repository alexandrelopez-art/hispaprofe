"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearEstudiante, type EstadoAlta } from "@/lib/acciones";

const campo =
  "mt-1 h-10 w-full rounded-full border border-hp-200 bg-white px-4 text-sm font-normal text-tinta outline-none focus:border-hp-400";

export default function Formulario() {
  const [estado, accion, enviando] = useActionState<EstadoAlta, FormData>(crearEstudiante, {});

  if (estado.id) {
    return (
      <div className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
        {estado.yaExistia ? (
          <p className="font-bold text-tinta">Esa ficha ya existía. No se ha tocado.</p>
        ) : (
          <>
            <p className="font-bold text-tinta">Ficha creada.</p>
            <p className="mt-3 rounded-xl bg-sol-100 px-4 py-3 text-sm">
              Contraseña inicial:{" "}
              <code className="rounded bg-white px-2 py-0.5 text-base font-bold">{estado.contrasena}</code>
              <br />
              <span className="text-tinta-suave">Apúntala: no se vuelve a ver. Al entrar tendrá que cambiarla.</span>
            </p>
          </>
        )}
        <div className="mt-4 flex gap-4 text-sm font-semibold">
          <Link href={`/profe/alumnos/${estado.id}`} className="text-hp-600 hover:text-hp-500">Ver la ficha →</Link>
          <Link href="/profe/alumnos/nuevo" className="text-tinta-suave hover:text-hp-500">Otro estudiante</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <label className="block text-sm font-semibold text-tinta">
        Correo
        <input type="email" name="email" required placeholder="estudiante@gmail.com" className={campo} />
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
      {estado.error && (
        <p role="alert" className="mt-4 rounded-xl bg-coral-100 px-4 py-2 text-sm font-semibold text-coral-600">{estado.error}</p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="mt-5 h-10 rounded-full bg-hp-400 px-5 text-sm font-bold text-white transition-colors hover:bg-hp-500 disabled:opacity-60"
      >
        {enviando ? "Creando…" : "Crear ficha"}
      </button>
    </form>
  );
}
