import Encabezado from "@/components/ui/encabezado";
import Vacio from "@/components/ui/vacio";

export default function ActividadesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado titulo="Actividades" lede="Propuestas para hacer en clase o en casa, con su material." />
      <Vacio>Todavía no hay ninguna publicada. Las primeras llegarán después del taller del DELE.</Vacio>
    </div>
  );
}
