"use client";

/**
 * Botón que pide confirmación antes de enviar el formulario.
 * Para acciones que borran cosas con contenido dentro.
 */
export default function BotonConfirmar({
  aviso,
  children,
  className,
  title,
}: {
  aviso: string;
  children: React.ReactNode;
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
      className={className}
    >
      {children}
    </button>
  );
}
