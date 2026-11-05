import type { QueryClient } from "@tanstack/react-query";
import { LISTA_CACHE } from "@/features/pwa/cacheNames";
import { forgetLastHousehold } from "@/features/pwa/lastHousehold";
import { clearPersistedCache, persister } from "@/lib/query/persist";

/** Dono dos dados locais (cache persistido, fila offline, Lista do SW): id do usuário vindo do servidor. */
export const USER_KEY = "cari-user";

export type LocalDataClient = Pick<QueryClient, "cancelQueries" | "clear">;

async function attempt(step: () => unknown): Promise<void> {
  try {
    await step();
  } catch {
    // cada passo é independente: uma falha (IndexedDB, Cache Storage, storage bloqueado) não impede os outros
  }
}

/**
 * Apaga tudo o que o aparelho guarda do usuário: queries e mutações (inclusive as pausadas na fila),
 * o cache persistido no IndexedDB, a Lista no cache do SW e a última casa. Não toca na sessão.
 */
export async function clearLocalUserData(queryClient: LocalDataClient): Promise<void> {
  await attempt(() => queryClient.cancelQueries());
  await attempt(() => queryClient.clear());
  await attempt(() => persister.removeClient());
  await attempt(() => clearPersistedCache());
  await attempt(() => forgetLastHousehold());
  await attempt(() => typeof window !== "undefined" && "caches" in window && caches.delete(LISTA_CACHE));
  await attempt(() => localStorage.removeItem(USER_KEY));
  // De novo no fim: nada que um refetch em voo tenha escrito durante a limpeza sobrevive.
  await attempt(() => queryClient.clear());
}

function storedUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

/**
 * Troca de conta sem "Sair" (outro login no mesmo aparelho): os dados locais são de outra pessoa.
 * Limpa como o signOut (sem chamar auth.signOut) e passa a marcar o novo dono.
 * @returns true se havia dados de outro usuário e eles foram apagados.
 */
export async function claimLocalData(queryClient: LocalDataClient, userId: string): Promise<boolean> {
  const previous = storedUser();
  const mismatch = previous !== null && previous !== userId;
  if (mismatch) await clearLocalUserData(queryClient);
  await attempt(() => localStorage.setItem(USER_KEY, userId));
  return mismatch;
}
