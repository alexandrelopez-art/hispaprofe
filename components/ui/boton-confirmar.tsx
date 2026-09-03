"use client";

import { clasesDeBoton, type TamanoBoton, type VarianteBoton } from "./boton";

/**
 * Botón que pide confirmación antes de enviar el formulario.
 * Para acciones que borran cosas con contenido dentro.
 *
 * `variante`/`tamano` y no `className` con `clasesDeBoton(...)` ya hecho: es
 * un botón de la casa como cualquier otro, así que vive con las demás
 * piezas y calcula sus propias clases igual que `Boton`.
 */
export default function BotonConfirmar({
  aviso,
  children,
  variante = "primario",
  tamano = "normal",
  className = "",
  title,
}: {
  aviso: string;
  children: React.ReactNode;
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="submit"
      title={title}
      onClick={(e) => {
        if (!window.confirm(aviso)) e.preventDefault();
      }}
      className={clasesDeBoton(variante, tamano, className)}
    >
      {children}
    </button>
  );
}
