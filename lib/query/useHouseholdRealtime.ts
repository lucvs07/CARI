"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { applyRealtimeEvent, type RealtimeEvent } from "./realtime";

type Row = { id: string };

export function useHouseholdRealtime(householdId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let subscribedBefore = false;

    const handler = (key: "items" | "list") => (payload: unknown) => {
      const p = payload as RealtimeEvent<Row>;
      qc.setQueryData<Row[]>([key, householdId], (rows) => applyRealtimeEvent(rows, p));
    };

    const channel = supabase
      .channel(`household:${householdId}`)
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

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
