import Encabezado from "@/components/ui/encabezado";
import Vacio from "@/components/ui/vacio";

export default function ArticulosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado
        titulo="Artículos"
        lede="Textos con imágenes: lo que el profe quiera contar, enseñar o recomendar."
      />
      <Vacio>El primero está por escribir.</Vacio>
    </div>
  );
}
