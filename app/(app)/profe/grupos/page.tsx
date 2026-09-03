import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import { crearGrupo, desconectarGoogle } from "@/lib/acciones";
import { googleConfigurado } from "@/lib/google";
import { redirect } from "next/navigation";
import { nombreNivel } from "@/lib/niveles";
import Aviso, { type TonoAviso } from "@/components/ui/aviso";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Encabezado from "@/components/ui/encabezado";
import Etiqueta from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";

export const dynamic = "force-dynamic";

const mensajes: Record<string, string> = {
  ok: "Cuenta de Google conectada.",
  cancelado: "Se canceló la conexión con Google.",
  fallo: "Google no aceptó la conexión. Prueba otra vez.",
  estado: "La vuelta de Google no cuadró. Prueba otra vez.",
  incompleto: "Google devolvió una respuesta incompleta.",
};

// Éxito → ok; el resto son fallos técnicos de la vuelta de Google → error,
// salvo la cancelación, que no es un fallo sino una elección del profesor.
const tonos: Record<string, TonoAviso> = {
  ok: "ok",
  cancelado: "aviso",
  fallo: "error",
  estado: "error",
  incompleto: "error",
};

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || (usuario.role !== "PROFESOR" && usuario.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const { google } = await searchParams;

  const [grupos, cuenta] = await Promise.all([
    prisma.grupo.findMany({
      where: { profesorId: usuario.id, archivado: false },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { miembros: true } } },
    }),
    prisma.cuentaGoogle.findUnique({
      where: { usuarioId: usuario.id },
      select: { email: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Encabezado
        titulo="Grupos"
        lede="Un grupo permite asignar una secuencia a toda la clase de una vez."
      />

      {google && mensajes[google] && (
        <Aviso tono={tonos[google] ?? "aviso"} className="mt-4">
          {mensajes[google]}
        </Aviso>
      )}

      {/* Conexión con Classroom: opcional, solo la usan los grupos vinculados. */}
      <Tarjeta titulo="Google Classroom" className="mt-8">
        {!googleConfigurado() ? (
          <p className="mt-2 text-sm text-tinta-suave">
            Sin configurar. Faltan las credenciales de Google en el archivo
            .env del proyecto.
          </p>
        ) : cuenta ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-tinta-suave">
              Conectado como{" "}
              <span className="font-semibold text-tinta">
                {cuenta.email ?? "tu cuenta de Google"}
              </span>
              . Ya puedes vincular un grupo con un curso desde su ficha.
            </p>
            <form action={desconectarGoogle} className="ml-auto">
              <BotonEnviar gerundio="Desconectando…" variante="sutil" tamano="pequeno" className="h-9">
                Desconectar
              </BotonEnviar>
            </form>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-tinta-suave">
              Conecta tu cuenta para traer la lista de alumnos de un curso sin
              pegar correos a mano. Solo se lee: la plataforma nunca escribe
              nada en Classroom.
            </p>
            <Boton href="/api/google/conectar" className="mt-3">
              Conectar con Google Classroom
            </Boton>
          </div>
        )}
      </Tarjeta>

      {grupos.length > 0 && (
        <ul className="mt-8 space-y-3">
          {grupos.map((grupo) => (
            <li key={grupo.id}>
              <Tarjeta href={`/profe/grupos/${grupo.id}`}>
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-tinta">{grupo.nombre}</p>
                    <p className="text-sm text-tinta-suave">
                      {grupo._count.miembros} estudiante
                      {grupo._count.miembros !== 1 ? "s" : ""}
                      {grupo.classroomNombre && ` · ${grupo.classroomNombre}`}
                    </p>
                  </div>
                  {grupo.classroomCursoId && (
                    <Etiqueta tono="bloque2" className="shrink-0">
                      Classroom
                    </Etiqueta>
                  )}
                  {grupo.nivel && (
                    <Etiqueta tono="hp" className="shrink-0">
                      {nombreNivel(grupo.nivel)}
                    </Etiqueta>
                  )}
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-bold text-tinta">Crear un grupo</h2>

      <Tarjeta className="mt-3">
        <form action={crearGrupo}>
          <div className="flex flex-wrap gap-3">
            <Campo
              etiqueta="Nombre"
              name="nombre"
              required
              placeholder="DELE B2 · septiembre"
              className="min-w-56 flex-1"
            />

            <Campo
              etiqueta="Nivel"
              name="nivel"
              tipo="elegir"
              defaultValue=""
              opciones={[
                { valor: "", nombre: "Sin nivel" },
                { valor: "A1", nombre: "A1" },
                { valor: "A2", nombre: "A2" },
                { valor: "B1", nombre: "B1" },
                { valor: "B2", nombre: "B2" },
                { valor: "C1", nombre: "C1" },
                { valor: "A2_B1_ESCOLAR", nombre: "A2/B1 escolar" },
              ]}
            />
          </div>

          <Campo
            etiqueta="Correos de los estudiantes"
            name="correos"
            tipo="area"
            rows={5}
            placeholder="Pega aquí la lista. Separados por comas, espacios o saltos de línea."
            className="mt-4"
          />
          <p className="mt-1 text-xs text-tinta-suave">
            Puedes dejarlo vacío y traer la lista desde Classroom después.
          </p>

          <BotonEnviar gerundio="Creando…" className="mt-4">
            Crear grupo
          </BotonEnviar>
        </form>
      </Tarjeta>
    </div>
  );
}
