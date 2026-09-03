export default function Vacio({ children, accion, className = "" }: { children: React.ReactNode; accion?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-tarjeta border border-dashed border-hp-200 px-6 py-8 text-center text-sm text-tinta-suave ${className}`}>
      <p>{children}</p>
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}
