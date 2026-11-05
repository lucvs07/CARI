"use client";

import { useState, type ReactNode } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SerwistProvider } from "@serwist/next/react";
import { reapplyPausedListWrites } from "@/features/shopping/mutations";
import { GC_TIME, makeQueryClient } from "./client";
import { persister } from "./persist";

const PERSISTED_KEYS = ["items", "list", "members"];

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: "v1",
        maxAge: GC_TIME,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => PERSISTED_KEYS.includes(String(q.queryKey[0])) && q.state.status === "success",
        },
      }}
      onSuccess={() => {
        reapplyPausedListWrites(queryClient);
        void queryClient.resumePausedMutations();
      }}
    >
      {/* SW só no build de produção; sem recarregar ao voltar o sinal (a fila do TanStack sincroniza). */}
      <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === "development"} reloadOnOnline={false}>
        {children}
      </SerwistProvider>
    </PersistQueryClientProvider>
  );
}
