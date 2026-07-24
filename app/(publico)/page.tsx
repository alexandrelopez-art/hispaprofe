import Link from "next/link";

const secciones = [
  {
    id: "clases-particulares",
    icono: "🎓",
    titulo: "Clases particulares",
    resumen: "Clases 1 a 1 online, de A1 a C1, para adultos y escolares.",
    cuerpo:
      "Clases 1 a 1 online adaptadas a tu nivel y a tus objetivos. Trabajamos con recorridos estructurados: cada clase tiene un plan, ejercicios que puedes hacer entre sesiones, y seguimiento real de tu progreso.",
    proximamente: false,
  },
  {
    id: "dele",
    icono: "📜",
    titulo: "DELE",
    resumen: "Preparación oficial en todos los niveles (A1–C1) y A2/B1 escolar.",
    cuerpo:
      "Preparación específica para el examen DELE en todos sus niveles: A1, A2, B1, B2, C1, y el especial A2/B1 escolar. Recorridos con actividades que replican las pruebas reales: comprensión lectora, comprensión auditiva, expresión escrita, expresión oral e interacción.",
    proximamente: false,
  },
  {
    id: "entre-profes",
    icono: "👥",
    titulo: "Entre profes",
    resumen: "Materiales y recursos que comparto con otros profes de español.",
    cuerpo:
      "Materiales, secuencias y recursos que comparto con otros profes de español.",
    proximamente: true,
  },
  {
    id: "cultura",
    icono: "🎭",
    titulo: "Cultura",
    resumen: "El español real: música, cine, píldoras de España e Iberoamérica.",
    cuerpo:
      "El español que se habla en la calle, en el cine, en la música. Píldoras culturales de España y América Latina.",
    proximamente: true,
  },
];

export default function LandingPublica() {
  return (
    <>
      <section className="bg-gradient-to-b from-hp-50 to-white">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <h1 className="text-4xl font-extrabold tracking-tight text-tinta sm:text-6xl">
            Aprende español con un profesor{" "}
            <span className="bg-sol-300 px-2 rounded-md">de verdad</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-tinta-suave sm:text-xl">
            Clases particulares, preparación DELE y cultura hispana — con
            material hecho a mano por tu profesor.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 text-sm font-semibold text-tinta-suave">
            <span aria-hidden>↓</span>
            <span>Baja para ver lo que encontrarás</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="text-2xl font-extrabold text-tinta sm:text-3xl">
          Qué encontrarás aquí
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {secciones.map((s) => (
            <Link
              key={s.id}
              href={`#${s.id}`}
              className="group flex flex-col rounded-2xl border-2 border-hp-100 bg-white p-6 transition-colors hover:border-hp-300"
            >
              <span className="text-4xl" aria-hidden>
                {s.icono}
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-tinta">
                {s.titulo}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-tinta-suave">
                {s.resumen}
              </p>
              <span className="mt-4 text-sm font-semibold text-hp-500 group-hover:text-hp-600">
                Ver más →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 pb-24">
        {secciones.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className={`scroll-mt-20 py-12 ${
              i > 0 ? "border-t border-hp-100" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {s.icono}
              </span>
              <h2 className="text-2xl font-extrabold text-tinta sm:text-3xl">
                {s.titulo}
              </h2>
              {s.proximamente && (
                <span className="rounded-full bg-sol-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tinta">
                  Próximamente
                </span>
              )}
            </div>
            <p className="mt-4 text-lg leading-8 text-tinta-suave">
              {s.cuerpo}
            </p>
          </section>
        ))}
      </div>

      <footer className="border-t border-hp-100 bg-hp-50">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-tinta-suave">
          © HispaProfe · Hecho con cariño
        </div>
      </footer>
    </>
  );
}
