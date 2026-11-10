import type { QueryClient } from "@tanstack/react-query";

/**
 * Segura a fila offline restaurada até saber de quem ela é. O QueryClient retoma as mutações
 * pausadas sozinho nos eventos de foco e de rede (QueryClient.mount → this.resumePausedMutations()),
 * inclusive em rotas sem AppShell (/login, /bem-vindo, /convite, /offline), onde o gate de usuário
 * nunca abre. Até `release()`, esse método do cliente vira no-op: as escritas continuam pausadas e
 * persistidas (não são descartadas).
 * @returns `release`, que devolve o método original (chamado pelo gate depois de confirmar o usuário).
 */
export function holdPausedMutations(qc: QueryClient): () => void {
  const original = qc.resumePausedMutations;
  qc.resumePausedMutations = () => Promise.resolve();
  return () => {
    qc.resumePausedMutations = original;
  };
}
