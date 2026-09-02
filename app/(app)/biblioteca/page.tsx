import Encabezado from "@/components/ui/encabezado";
import Vacio from "@/components/ui/vacio";

export default function BibliotecaPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado
        titulo="Biblioteca"
        lede="Ejercicios que se corrigen solos y juegos, por nivel, para practicar por tu cuenta."
      />
      <Vacio>Se abre después del taller del DELE.</Vacio>
    </div>
  );
}
