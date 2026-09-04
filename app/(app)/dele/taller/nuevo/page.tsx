import Encabezado from "@/components/ui/encabezado";
import FormularioNuevo from "@/components/taller/formulario-nuevo";

export default function NuevoExamenPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Encabezado titulo="Nuevo examen" volver={{ href: "/dele/taller", texto: "Taller" }} />
      <FormularioNuevo />
    </div>
  );
}
