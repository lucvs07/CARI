"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { applyRealtimeEvent, keysToRefetchOnReconnect, shouldSkipRealtime, type RealtimeEvent } from "./realtime";

type Row = { id: string };

/** Espera entre tentativas de abrir o canal (sessão/rede indisponível); a última se repete. */
export const REALTIME_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;

function pendingMutations(qc: QueryClient) {
  return qc
    .getMutationCache()
    .getAll()
    .filter((m) => m.state.status === "pending")
    .map((m) => ({ mutationKey: m.options.mutationKey, variables: m.state.variables }));
}

export function useHouseholdRealtime(householdId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    let subscribedBefore = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handler = (key: "items" | "list") => (payload: unknown) => {
      const p = payload as RealtimeEvent<Row>;
      if (shouldSkipRealtime(pendingMutations(qc), key, householdId)) return;
      qc.setQueryData<Row[]>([key, householdId], (rows) => applyRealtimeEvent(rows, p));
    };

    async function connect(): Promise<void> {
      try {
        // Sem o JWT do usuário no socket o join usa a chave anon e o Realtime recusa os filtros (RLS).
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (cancelled) return;
        if (data.session) await supabase.realtime.setAuth(data.session.access_token);
        if (cancelled) return;

        // Tópico único por execução: StrictMode/troca rápida de casa não reaproveita um canal ainda em remoção.
        channel = supabase
          .channel(`household:${householdId}:${crypto.randomUUID()}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "items", filter: `household_id=eq.${householdId}` },
            handler("items"),
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "shopping_list_entries", filter: `household_id=eq.${householdId}` },
            handler("list"),
          )
          .subscribe((status) => {
            if (status !== "SUBSCRIBED") return;
            // Reconexão: pode ter perdido eventos enquanto offline. A lista com escritas na fila só é
            // buscada quando a fila esvaziar (settle), para não apagar o estado otimista.
            if (subscribedBefore) {
              for (const key of keysToRefetchOnReconnect(pendingMutations(qc))) {
                void qc.invalidateQueries({ queryKey: [key, householdId] });
              }
            }
            subscribedBefore = true;
          });
      } catch (err) {
        if (cancelled) return;
        const delay = REALTIME_RETRY_DELAYS_MS[Math.min(attempt, REALTIME_RETRY_DELAYS_MS.length - 1)];
        attempt++;
        console.warn(`cari: Realtime não conectou; nova tentativa em ${delay / 1000} s`, err);
        retryTimer = setTimeout(() => void connect(), delay);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
