"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Item } from "./schema";

export const itemsKey = (householdId: string) => ["items", householdId] as const;

/** O cache guarda linhas cruas de `items` (o Realtime escreve linhas cruas aqui); agrupar/ordenar é na renderização. */
export function useItems(householdId: string, initial?: Item[]) {
  return useQuery({
    queryKey: itemsKey(householdId),
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await getBrowserSupabase().from("items").select("*").eq("household_id", householdId);
      if (error) throw error;
      return data;
    },
    initialData: initial,
  });
}
