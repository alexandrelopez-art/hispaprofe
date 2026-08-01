import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  // Con `proxy.ts` en la raíz, Next bufferiza el cuerpo de toda petición que
  // pase por él —incluidas las de `/api`— ANTES de que corra el manejador de
  // la ruta, y por defecto solo guarda los primeros 10 MB. Pasado ese tope el
  // resto se descarta en silencio (solo un WARN en el registro) y
  // `peticion.formData()` revienta con un audio de 35,7 MB aunque el tope de
  // `MAXIMO_AUDIO` en la ruta diga 100 MB: ese tope no significa nada si este
  // no lo iguala o lo supera. Aviso también de coste: al bufferizarse antes
  // del manejador, cualquiera sin sesión puede hacer que el servidor reserve
  // hasta este tamaño en memoria antes de que la ruta llegue a comprobar el
  // 403. En un portátil no se nota; en un despliegue real conviene saberlo.
  experimental: {
    proxyClientMaxBodySize: 100 * 1024 * 1024,
  },
};

export default nextConfig;
