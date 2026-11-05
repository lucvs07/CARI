/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import { LISTA_CACHE } from "@/features/pwa/cacheNames";
import { clearListaOnActivate } from "@/features/pwa/swActivate";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const LISTA_PATH = /^\/[^/]+\/lista\/?$/;

/** Rota de página (não asset): fora de /_next/ e sem extensão. */
const isPage = (url: URL) => !url.pathname.startsWith("/_next/") && !/\.[a-z0-9]+$/i.test(url.pathname);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Abrir o app sem sinal (spec §8): HTML e RSC da Lista, rede primeiro e a última resposta como reserva.
      // Todo GET do caminho da Lista: a navegação, o RSC (`RSC: 1` + `?_rsc=`, inclusive o prefetch
      // parcial) e o GET simples que o SerwistProvider faz a cada navegação no cliente (cacheOnNavigation),
      // para que quem chega à Lista por uma aba também tenha o HTML dela guardado.
      matcher: ({ url, sameOrigin }) => sameOrigin && LISTA_PATH.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: LISTA_CACHE,
        networkTimeoutSeconds: 3,
        plugins: [
          // HTML + variantes `?_rsc=` (uma por estado do router): sem teto, cresceriam sem limite.
          new ExpirationPlugin({ maxEntries: 32 }),
          {
            // Só guarda a Lista de verdade: nada de redirecionamento (login, casa alheia) nem erro.
            cacheWillUpdate: async ({ response }) =>
              response.status === 200 && !response.redirected && response.type !== "opaqueredirect" ? response : null,
          },
        ],
      }),
    },
    {
      // Supabase (outra origem): dados por usuário, autorizados por header que não entra na chave do cache.
      // Offline quem responde é o cache persistido do TanStack Query, não o SW.
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkOnly(),
    },
    {
      // Demais páginas (HTML, RSC e o GET do cacheOnNavigation): só rede. Sem sinal, cai na tela offline
      // da Cari (spec §8), e nenhum dado da casa fica em caches que o "Sair" não apaga (só o da Lista).
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin && (request.mode === "navigate" || request.headers.get("RSC") === "1" || isPage(url)),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();

// Ao lado do activate do Serwist (que limpa o precache antigo); cada um estende o evento com waitUntil.
self.addEventListener("activate", (event) => clearListaOnActivate(event, caches));
