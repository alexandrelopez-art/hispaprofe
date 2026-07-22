import { redirect } from "next/navigation";
import { syncUser } from "@/lib/syncUser";

export default async function DashboardPage() {
  const user = await syncUser();
  if (!user) redirect("/");
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Hola, {user.firstName ?? user.email}</h1>
      <p className="mt-2 text-zinc-600">Rol: {user.role}</p>
      <p className="mt-1 text-sm text-zinc-500">ID en base de datos: {user.id}</p>
    </main>
  );
}
