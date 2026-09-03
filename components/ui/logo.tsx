import Link from "next/link";

type TamanoLogo = "normal";

const CUADRADO: Record<TamanoLogo, string> = {
  normal: "h-9 w-9 text-xl",
};

const TEXTO: Record<TamanoLogo, string> = {
  normal: "text-lg",
};

/**
 * El logo de Hispaprofe: la «ñ» en cuadrado azul y «Hispa**profe**». Con
 * `enlaza=false` pinta lo mismo pero sin enlace (la cabecera reducida, que no
 * debe llevar ningún `<a href` para no dejar por dónde saltarse el cambio de
 * contraseña obligatorio).
 */
export default function Logo({ enlaza = true, href = "/", tamano = "normal" }: { enlaza?: boolean; href?: string; tamano?: TamanoLogo }) {
  const cuerpo = (
    <>
      <span className={`grid place-items-center rounded-xl bg-hp-500 font-extrabold text-white ${CUADRADO[tamano]}`}>ñ</span>
      <span className={`font-extrabold text-tinta ${TEXTO[tamano]}`}>Hispa<span className="text-coral-500">profe</span></span>
    </>
  );
  return enlaza
    ? <Link href={href} className="flex shrink-0 items-center gap-2">{cuerpo}</Link>
    : <span className="flex shrink-0 items-center gap-2">{cuerpo}</span>;
}
