import { getUsuarioActual } from "@/lib/usuario";
import { crearSecuencia } from "@/lib/acciones";
import { redirect } from "next/navigation";
import EleccionDele from "./eleccion-dele";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Tarjeta from "@/components/ui/tarjeta";

export default async function NuevaSecuenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  // El `?servicio=` con el que llegan la banda y la puerta de DELE decide el
  // selector inicial; cualquier otro valor cae en particulares, que es lo
  // que había antes de que existiera la query.
  const { servicio } = await searchParams;
  const tipoInicial =
    servicio === "PREPARACION_DELE" ? "PREPARACION_DELE" : "CLASES_PARTICULARES";

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Encabezado
        titulo="Nueva secuencia"
        lede="Aquí van los datos generales. Los pasos se añaden después, desde la ficha de la secuencia."
        volver={{ href: "/recorridos", texto: "Secuencias" }}
      />

      <form action={crearSecuencia}>
        <Tarjeta>
          {/*
            La descripción va dentro de `EleccionDele` como ranura: la casilla
            de la plantilla tiene que estar debajo y depende de la prueba
            elegida, que es estado del cliente. Así el campo se sigue
            renderizando en el servidor y el orden de la pantalla no cambia.
          */}
          <EleccionDele tituloInicial="" tipoInicial={tipoInicial}>
            <Campo
              etiqueta="Descripción"
              name="descripcion"
              tipo="area"
              placeholder="Una línea sobre qué trabaja"
              className="mt-4"
            />
          </EleccionDele>

          <BotonEnviar gerundio="Creando…" className="mt-5">
            Crear y añadir pasos
          </BotonEnviar>
        </Tarjeta>
      </form>
    </div>
  );
}
