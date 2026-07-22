import { prisma } from "@/lib/prisma";
import { buscadorCasasSchema } from "@/lib/ejercicios/buscador-casas";
import BuscadorCasas from "@/components/buscador-casas";

export default async function TestEjercicioPage() {
  const ej = await prisma.ejercicio.findUnique({
    where: { id: "seed-buscador-casas" },
  });

  if (!ej) return <main style={{ padding: 40 }}>No se encontró el ejercicio.</main>;

  const datos = buscadorCasasSchema.parse(ej.datos);

  return (
    <main style={{ padding: "40px 20px" }}>
      <h1 style={{ maxWidth: 820, margin: "0 auto 20px", fontSize: 22 }}>{ej.titulo}</h1>
      <BuscadorCasas {...datos} />
    </main>
  );
}
