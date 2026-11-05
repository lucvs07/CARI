// @ts-check
// Serwist no modo "configurator": o service worker é gerado depois do `next build` (Turbopack)
// por `serwist build`, sem depender do webpack.
import { generateGlobPatterns, serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Não precacheia os HTML pré-renderizados: os shells das rotas dinâmicas ("/", "/[householdId]/…")
  // seriam servidos pelo precache no lugar da página real. Só a tela offline entra (fallback do SW).
  precachePrerendered: false,
  globPatterns: [...generateGlobPatterns(".next/"), ".next/server/app/offline.html"],
});
