export default function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs font-bold uppercase tracking-wider text-tinta-suave ${className}`}>{children}</p>;
}
