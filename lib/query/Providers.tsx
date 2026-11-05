"use client";

import { useState, type ReactNode } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SerwistProvider } from "@serwist/next/react";
import { claimLocalData } from "@/features/shell/localData";
import { reapplyPausedListWrites } from "@/features/shopping/mutations";
import { GC_TIME, makeQueryClient } from "./client";
import { holdPausedMutations } from "./holdPausedMutations";
import { persister } from "./persist";
import { UserGate, UserGateContext } from "./userGate";

const PERSISTED_KEYS = ["items", "list", "members"];

export function Providers({ children }: { children: ReactNode }) {
  const [{ queryClient, gate }] = useState(() => {
    const queryClient = makeQueryClient();
    // Antes do mount/hidratação: nenhum evento de foco/rede retoma a fila antes do gate abrir.
    const release = holdPausedMutations(queryClient);
    const gate = new UserGate(async (userId) => {
      // Dados locais de outra conta: apaga (como o "Sair", sem deslogar) e recarrega do servidor.
      if (await claimLocalData(queryClient, userId)) {
        window.location.reload();
        return;
      }
      release();
      reapplyPausedListWrites(queryClient);
      await queryClient.resumePausedMutations();
    });
    return { queryClient, gate };
  });
  return (
    <UserGateContext.Provider value={gate}>
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
        onSuccess={() => gate.restored()}
        onError={() => gate.restored()}
      >
        {/* SW só no build de produção; sem recarregar ao voltar o sinal (a fila do TanStack sincroniza). */}
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === "development"} reloadOnOnline={false}>
          {children}
        </SerwistProvider>
      </PersistQueryClientProvider>
    </UserGateContext.Provider>
  );
}
