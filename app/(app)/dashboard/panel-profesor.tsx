import { prisma } from "@/lib/prisma";
import { contarEstudiantesElegibles } from "@/lib/estudiantes";
import Encabezado from "@/components/ui/encabezado";
import Puertas from "./puertas";

type Usuario = { id: string; firstName: string | null; email: string };

export default async function PanelProfesor({ usuario }: { usuario: Usuario }) {
  const saludo = `Hola, ${usuario.firstName ?? usuario.email}`;

  const [examenesPublicados, estudiantes] = await Promise.all([
    prisma.recorrido.count({
      where: { tipo: "PREPARACION_DELE", publicado: true },
    }),
    contarEstudiantesElegibles(),
  ]);

  const dele = `${examenesPublicados} exámenes publicados`;
  const clases = `${estudiantes} estudiantes`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado titulo={saludo} />

      <Puertas datos={{ dele, clases }} />
    </div>
  );
}
