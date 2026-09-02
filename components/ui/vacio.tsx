export default function Vacio({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="rounded-tarjeta border border-dashed border-hp-200 px-6 py-8 text-center text-sm text-tinta-suave">
      <p>{children}</p>
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}
