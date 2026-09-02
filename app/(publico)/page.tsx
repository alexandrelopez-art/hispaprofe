import Link from "next/link";
import Image from "next/image";


export default function LandingPublica() {
  return (
    <>
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#ece5ff] px-4 py-1.5 text-sm font-semibold text-[#6a5ad8]">
            <span className="w-2 h-2 rounded-full bg-[#6a5ad8]" />
            Español como lengua extranjera
          </span>
          <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-tinta leading-[1.05]">
            Aprende español con un profe{" "}
            <span className="text-coral-500">de verdad.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-tinta-suave">
            Clases en línea personalizadas y recursos de ELE pensados para
            estudiantes adultos de todo el mundo. A tu ritmo, con un
            acompañamiento real.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:contacto@hispaprofe.com?subject=Reservar%20una%20clase"
              className="rounded-full bg-hp-500 text-white text-sm font-bold h-12 px-8 flex items-center justify-center hover:bg-hp-600 transition-colors"
            >
              Reservar una clase
            </a>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-tinta-suave">
            <span className="flex items-center gap-2">
              <span className="text-hp-500">🌍</span> +20 países
            </span>
            <span className="text-hp-200">·</span>
            <span className="flex items-center gap-2">
              <span className="text-hp-500">📊</span> Niveles A1–C2
            </span>
            <span className="text-hp-200">·</span>
            <span className="flex items-center gap-2">
              <span className="text-verde-500">👥</span> Clases 1 a 1
            </span>
          </div>
        </div>

        {/* Composición visual del hero */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative aspect-square w-full max-w-md">
            {/*
              El logo tiene fondo blanco opaco, no transparente. Por eso el
              círculo es blanco: el fondo del PNG se funde con él y la figura
              parece recortada, sin tener que tocar la imagen.
              La versión con rayos azules está en /logo-rayos.png.
            */}
            <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-full bg-white shadow-tarjeta ring-1 ring-hp-100">
              <div className="relative h-[86%] w-[86%]">
                <Image
                  src="/logo.png"
                  alt="HispaProfe"
                  fill
                  priority
                  sizes="(min-width: 1024px) 28rem, 0px"
                  className="object-contain"
                />
              </div>
            </div>
            <div className="absolute top-6 left-2 bg-white rounded-2xl shadow-suave px-4 py-3 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-hp-100 grid place-items-center text-hp-500">
                💬
              </span>
              <div>
                <div className="text-sm font-extrabold text-tinta">¡Hola!</div>
                <div className="text-xs text-tinta-suave">¿Empezamos?</div>
              </div>
            </div>
            <div className="absolute bottom-6 right-2 bg-white rounded-2xl shadow-suave px-4 py-3 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-verde-100 grid place-items-center text-verde-500">
                🏅
              </span>
              <div>
                <div className="text-sm font-extrabold text-tinta">DELE</div>
                <div className="text-xs text-tinta-suave">A1–C2</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLASES Y EXÁMENES */}
      <section id="clases" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-hp-500">
            Clases y exámenes
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold text-tinta leading-tight">
            Aprende con un plan
            <br className="hidden sm:block" /> hecho a tu medida
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-tinta-suave">
            Clases en directo y preparación para el DELE, con el acompañamiento
            de un profe de verdad.
          </p>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 max-w-4xl mx-auto text-left">
            {/* Clases en línea */}
            <article className="rounded-3xl border border-hp-100 bg-fondo p-8">
              <div className="w-14 h-14 rounded-2xl bg-hp-100 grid place-items-center text-hp-500 text-2xl mb-6">
                📹
              </div>
              <h3 className="text-2xl font-extrabold text-tinta">
                Clases en línea
              </h3>
              <p className="mt-3 text-tinta-suave leading-7">
                Clases 1 a 1 por videollamada, adaptadas a tu nivel, tus
                intereses y tus objetivos. Tú eliges el horario; yo me ocupo del
                plan.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Niveles A1–C2", "Material incluido", "Conversación"].map(
                  (t) => (
                    <span
                      key={t}
                      className="rounded-full bg-white border border-hp-100 px-3 py-1 text-xs font-bold text-tinta-suave"
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
              <a
                href="mailto:contacto@hispaprofe.com?subject=Reservar%20una%20clase"
                className="mt-6 inline-flex items-center gap-2 text-hp-500 font-bold hover:text-hp-600"
              >
                Reservar una clase →
              </a>
            </article>

            {/* Preparación DELE */}
            <article
              id="dele"
              className="scroll-mt-20 rounded-3xl border border-hp-100 bg-fondo p-8 relative"
            >
              <span className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-sol-200 px-3 py-1 text-xs font-bold text-tinta">
                ⏳ En construcción
              </span>
              <div className="w-14 h-14 rounded-2xl bg-verde-100 grid place-items-center text-verde-500 text-2xl mb-6">
                🏅
              </div>
              <h3 className="text-2xl font-extrabold text-tinta">
                Preparación DELE
              </h3>
              <p className="mt-3 text-tinta-suave leading-7">
                Un módulo con simulacros, estrategias y materiales para llegar a
                tu examen DELE con confianza. Estoy preparándolo con mucho mimo.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Simulacros", "Estrategias", "Todos los niveles"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white border border-hp-100 px-3 py-1 text-xs font-bold text-tinta-suave"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <a
                href="#avisame"
                className="mt-6 inline-flex items-center gap-2 text-verde-500 font-bold hover:text-verde-600"
              >
                Avísame cuando esté listo →
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-hp-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-hp-500 text-white font-extrabold text-xl">
                ñ
              </span>
              <span className="font-extrabold text-tinta text-lg">
                Hispa<span className="text-coral-500">profe</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-tinta-suave leading-6">
              Recursos y clases de español como lengua extranjera, hechos con
              cariño por un profe.
            </p>
          </div>
          <div>
            <p className="text-sm font-extrabold text-tinta">Aprende</p>
            <ul className="mt-4 space-y-2 text-sm text-tinta-suave">
              <li>
                <Link href="/#clases" className="hover:text-hp-500">
                  Clases en línea
                </Link>
              </li>
              <li>
              </li>
              <li>
                <Link href="/#dele" className="hover:text-hp-500">
                  Preparación DELE
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-extrabold text-tinta">Hispaprofe</p>
            <ul className="mt-4 space-y-2 text-sm text-tinta-suave">
              <li>
                <Link href="/#sobre-mi" className="hover:text-hp-500">
                  Sobre mí
                </Link>
              </li>
              <li>
                <a href="#contacto" className="hover:text-hp-500">
                  Contacto
                </a>
              </li>
              <li>
                <a href="#boletin" className="hover:text-hp-500">
                  Boletín
                </a>
              </li>
              <li>
                <Link
                  href="/#hablared"
                  className="text-coral-500 hover:text-coral-600 font-semibold"
                >
                  HablaRed
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-hp-100">
          <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-tinta-suave">
            <span>© 2026 Hispaprofe. Todos los derechos reservados.</span>
            <span>Hecho con cariño para estudiantes de español.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
