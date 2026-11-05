import { QueryClient } from "@tanstack/react-query";
import { registerListMutationDefaults } from "@/features/shopping/mutations";

export const GC_TIME = 1000 * 60 * 60 * 24 * 7;

export function makeQueryClient(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { gcTime: GC_TIME, staleTime: 30_000 },
      mutations: { retry: 3 },
    },
  });
  // Antes do PersistQueryClientProvider hidratar: mutações pausadas restauradas do IndexedDB
  // só têm mutationKey + variables; a mutationFn vem destes defaults ("No mutationFn found" sem eles).
  registerListMutationDefaults(qc);
  return qc;
}
