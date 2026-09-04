import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendor asset copiado tal cual por `postinstall` (ver package.json y
    // components/taller/paginas.tsx): es el worker de pdfjs-dist minificado,
    // no código propio; lintarlo solo produce miles de avisos ajenos.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
