import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/usuario";
import { NIVELES } from "@/lib/niveles";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Tarjeta from "@/components/ui/tarjeta";
import Aviso from "@/components/ui/aviso";
import Etiqueta from "@/components/ui/etiqueta";
import Encabezado from "@/components/ui/encabezado";
import Vacio from "@/components/ui/vacio";

/**
 * El catálogo vivo de la identidad: todo lo que se ve en el sitio sale de
 * `components/ui/`. Se queda en producción, solo para PROFESOR/ADMIN —
 * no es un experimento que se retire después de la sesión A.
 */
export default async function MuestrarioPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado
        titulo="Las piezas de la casa"
        lede="Todo lo que se ve en el sitio sale de aquí. Si algo no está, no se inventa: se añade aquí primero."
      />

      <div className="flex flex-col gap-8">
        <Tarjeta titulo="Boton">
          <div className="flex flex-wrap items-center gap-3">
            <Boton variante="primario">Primario</Boton>
            <Boton variante="secundario">Secundario</Boton>
            <Boton variante="sutil">Sutil</Boton>
            <Boton variante="peligro">Peligro</Boton>
            <Boton variante="primario" tamano="pequeno">Pequeño</Boton>
            <Boton variante="secundario" href="/dashboard">A Inicio</Boton>
          </div>
        </Tarjeta>

        <Tarjeta titulo="BotonEnviar">
          <form
            action={async () => {
              "use server";
              await new Promise((r) => setTimeout(r, 1500));
            }}
          >
            <BotonEnviar gerundio="Guardando…">Guardar</BotonEnviar>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Campo">
          <div className="flex flex-col gap-4">
            <Campo etiqueta="Nombre" name="nombre" ayuda="Como aparece en la lista de clase" />
            <Campo etiqueta="Correo" name="correo" tipo="correo" />
            <Campo etiqueta="Contraseña" name="contrasena" tipo="contrasena" />
            <Campo etiqueta="Edad" name="edad" tipo="numero" />
            <Campo etiqueta="Notas" name="notas" tipo="area" />
            <Campo
              etiqueta="Nivel"
              name="nivel"
              tipo="elegir"
              opciones={NIVELES.map((n) => ({ valor: n.valor, nombre: n.nombre }))}
            />
            <Campo etiqueta="Con error" name="con-error" error="Ejemplo de error" />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Aviso">
          <div className="flex flex-col gap-2">
            <Aviso tono="info">Aviso informativo.</Aviso>
            <Aviso tono="ok">Todo salió bien.</Aviso>
            <Aviso tono="aviso">Algo merece atención.</Aviso>
            <Aviso tono="error">Algo falló.</Aviso>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Etiqueta">
          <div className="flex flex-wrap gap-2">
            <Etiqueta tono="neutro">Neutro</Etiqueta>
            <Etiqueta tono="hp">HP</Etiqueta>
            <Etiqueta tono="verde">Verde</Etiqueta>
            <Etiqueta tono="sol">Sol</Etiqueta>
            <Etiqueta tono="coral">Coral</Etiqueta>
            <Etiqueta tono="error">Error</Etiqueta>
            <Etiqueta tono="bloque1">Bloque 1</Etiqueta>
            <Etiqueta tono="bloque2">Bloque 2</Etiqueta>
            <Etiqueta tono="bloque3">Bloque 3</Etiqueta>
            <Etiqueta tono="bloque4">Bloque 4</Etiqueta>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Vacio">
          <Vacio accion={<Boton variante="primario" tamano="pequeno">Crear el primero</Boton>}>
            Todavía no hay nada aquí.
          </Vacio>
        </Tarjeta>

        <Tarjeta titulo="Tarjeta con acento" acento="bloque2">
          <p className="text-sm text-tinta-suave">Una tarjeta con el borde de color a la izquierda.</p>
        </Tarjeta>

        <Tarjeta titulo="Tarjeta como enlace" href="/dashboard">
          <p className="text-sm text-tinta-suave">Toda la tarjeta es un enlace a Inicio.</p>
        </Tarjeta>
      </div>
    </div>
  );
}
