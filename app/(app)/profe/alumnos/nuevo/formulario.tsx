"use client";

import { useActionState } from "react";
import Link from "next/link";
import Campo from "@/components/ui/campo";
import BotonEnviar from "@/components/ui/boton-enviar";
import Aviso from "@/components/ui/aviso";
import Tarjeta from "@/components/ui/tarjeta";
import { NIVELES } from "@/lib/niveles";
import { crearEstudiante, type EstadoAlta } from "@/lib/acciones";

export default function Formulario() {
  const [estado, accion] = useActionState<EstadoAlta, FormData>(crearEstudiante, {});

  if (estado.id) {
    return (
      <Tarjeta className="mt-8">
        {estado.yaExistia ? (
          <p className="font-bold text-tinta">Esa ficha ya existía. No se ha tocado.</p>
        ) : (
          <>
            <p className="font-bold text-tinta">Ficha creada.</p>
            <Aviso tono="aviso" className="mt-3">
              Contraseña inicial:{" "}
              <code className="rounded bg-white px-2 py-0.5 text-base font-bold">{estado.contrasena}</code>
              <br />
              <span className="text-tinta-suave">Apúntala: no se vuelve a ver. Al entrar tendrá que cambiarla.</span>
            </Aviso>
          </>
        )}
        <div className="mt-4 flex gap-4 text-sm font-semibold">
          <Link href={`/profe/alumnos/${estado.id}`} className="text-hp-600 hover:text-hp-500">Ver la ficha →</Link>
          <Link href="/profe/alumnos/nuevo" className="text-tinta-suave hover:text-hp-500">Otro estudiante</Link>
        </div>
      </Tarjeta>
    );
  }

  return (
    <form action={accion} className="mt-8 rounded-tarjeta border border-hp-100 bg-white p-5 shadow-suave">
      <Campo etiqueta="Correo" name="email" tipo="correo" required placeholder="estudiante@gmail.com" />
      <div className="mt-4 flex gap-3">
        <Campo etiqueta="Nombre" name="firstName" tipo="texto" className="flex-1" />
        <Campo etiqueta="Apellido" name="lastName" tipo="texto" className="flex-1" />
      </div>
      <Campo
        etiqueta="Nivel"
        name="nivel"
        tipo="elegir"
        defaultValue=""
        className="mt-4"
        opciones={[{ valor: "", nombre: "Sin nivel" }, ...NIVELES]}
      />
      {estado.error && (
        <Aviso tono="error" className="mt-4">{estado.error}</Aviso>
      )}
      <BotonEnviar gerundio="Creando…" className="mt-5">
        Crear ficha
      </BotonEnviar>
    </form>
  );
}
