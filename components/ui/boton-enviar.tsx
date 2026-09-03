"use client";

import { useFormStatus } from "react-dom";
import { clasesDeBoton, type TamanoBoton, type VarianteBoton } from "./boton";

/**
 * El botón de enviar de cualquier formulario. Mientras el formulario está
 * en vuelo se apaga y dice qué está haciendo («Guardando…»), para que nadie
 * pulse dos veces ni se quede mirando un botón que parece muerto.
 *
 * `onClick` corre antes del envío, igual que en un submit normal: sirve para
 * apuntar cuál de dos acciones se disparó. `deshabilitado` es la regla de
 * negocio (primero de la lista, sin cambios…); `pending` es el envío en
 * vuelo; el botón se apaga con cualquiera de las dos.
 */
export default function BotonEnviar({
  gerundio,
  variante = "primario",
  tamano = "normal",
  className = "",
  onClick,
  deshabilitado,
  title,
  children,
}: {
  gerundio: string;
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  deshabilitado?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      disabled={pending || deshabilitado}
      aria-busy={pending}
      onClick={onClick}
      className={clasesDeBoton(variante, tamano, className)}
    >
      {pending && (
        <span aria-hidden className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {pending ? gerundio : children}
    </button>
  );
}
