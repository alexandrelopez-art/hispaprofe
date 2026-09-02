import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "ffmpeg-static"],

  // El binario de ffmpeg no es código que el empaquetador pueda seguir: nadie
  // lo importa, se lanza como proceso. Sin esto no viaja con la función y en
  // producción no hay con qué comprimir. Las claves son rutas de ruta (route
  // globs) y los valores se resuelven desde la raíz del proyecto.
  outputFileTracingIncludes: {
    "/api/archivos": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/entregas/audio": ["./node_modules/ffmpeg-static/ffmpeg"],
  },

  // Con `proxy.ts` en la raíz, Next bufferiza el cuerpo de toda petición que
  // pase por él —incluidas las de `/api`— ANTES de que corra el manejador de
  // la ruta, y por defecto solo guarda los primeros 10 MB.
  //
  // Ojo: este número solo manda en local. En Vercel el cuerpo de una petición
  // no puede pasar de 4,5 MB y lo corta la plataforma antes de llegar aquí,
  // así que los topes que de verdad valen en producción son los de las rutas
  // (`MAXIMO_SUBIDA` y `MAXIMO_AUDIO_RECIBIDO`), puestos por debajo de esa
  // cifra. Esto se queda para que en el portátil el comportamiento no sea
  // distinto por accidente.
  experimental: {
    proxyClientMaxBodySize: 100 * 1024 * 1024,
  },

  // Preparación vivió en /preparacion hasta la carcasa (sept 2026). Los
  // enlaces viejos siguen valiendo.
  async redirects() {
    return [
      { source: "/preparacion", destination: "/dele", permanent: true },
      { source: "/preparacion/:bloque", destination: "/dele/:bloque", permanent: true },
    ];
  },
};

export default nextConfig;
