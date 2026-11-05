import { QueryClient } from "@tanstack/react-query";

export const GC_TIME = 1000 * 60 * 60 * 24 * 7;

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: GC_TIME, staleTime: 30_000 },
      mutations: { retry: 3 },
    },
  });
}
