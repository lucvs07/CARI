"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { applyRealtimeEvent, shouldSkipRealtime, type RealtimeEvent } from "./realtime";

type Row = { id: string };

export function useHouseholdRealtime(householdId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    let subscribedBefore = false;

    const handler = (key: "items" | "list") => (payload: unknown) => {
      const p = payload as RealtimeEvent<Row>;
      const pending = qc
        .getMutationCache()
        .getAll()
        .filter((m) => m.state.status === "pending")
        .map((m) => ({ mutationKey: m.options.mutationKey, variables: m.state.variables }));
      if (shouldSkipRealtime(pending, key, householdId)) return;
      qc.setQueryData<Row[]>([key, householdId], (rows) => applyRealtimeEvent(rows, p));
    };

    void (async () => {
      // Sem o JWT do usuário no socket o join usa a chave anon e o Realtime recusa os filtros (RLS).
      const { data } = await supabase.auth.getSession();
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
          // Reconexão: pode ter perdido eventos enquanto offline.
          if (subscribedBefore) {
            void qc.invalidateQueries({ queryKey: ["items", householdId] });
            void qc.invalidateQueries({ queryKey: ["list", householdId] });
          }
          subscribedBefore = true;
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
