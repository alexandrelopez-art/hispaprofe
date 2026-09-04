"use client";

import { useActionState } from "react";
import { crearExamenAccion, type EstadoTaller } from "@/lib/acciones-taller";
import Aviso from "@/components/ui/aviso";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Tarjeta from "@/components/ui/tarjeta";

export default function FormularioNuevo() {
  const [estado, accion] = useActionState<EstadoTaller, FormData>(crearExamenAccion, {});

  return (
    <Tarjeta className="mt-8">
      <form action={accion}>
        <Campo etiqueta="Título" name="titulo" tipo="texto" required />
        <Campo
          etiqueta="De dónde sale"
          name="fuente"
          tipo="texto"
          ayuda="Libro y examen, o convocatoria. Solo para ti."
          className="mt-4"
        />
        <div className="mt-4 flex gap-3">
          <Campo etiqueta="Número" name="numero" tipo="numero" min={1} required className="flex-1" />
          <Campo
            etiqueta="Bloque de la puerta DELE"
            name="bloque"
            tipo="elegir"
            defaultValue="2"
            className="flex-1"
            opciones={[
              { valor: "2", nombre: "Práctica por tarea" },
              { valor: "3", nombre: "Examen blanco" },
            ]}
          />
        </div>
        <Aviso tono="info" className="mt-4">
          Nivel: A2/B1 escolar. Se montan las dos pruebas con sus ocho tareas.
        </Aviso>
        {estado.error && <Aviso tono="error" className="mt-4">{estado.error}</Aviso>}
        <BotonEnviar gerundio="Montando el examen…" className="mt-5">
          Crear examen
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}
