"use client";

import { useState, type ReactNode } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
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
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
