"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { listKey, type Entry } from "./model";

export async function fetchList(householdId: string): Promise<Entry[]> {
  const { data, error } = await getBrowserSupabase()
    .from("shopping_list_entries")
    .select("*")
    .eq("household_id", householdId);
  if (error) throw error;
  return data;
}

/** O cache guarda linhas cruas (o Realtime escreve linhas cruas aqui); agrupar e juntar avatares é na renderização. */
/**
 * `initialUpdatedAt`: quando o servidor leu `initial`. Sem ele o initialData valeria "agora" e venceria o
 * cache persistido na hidratação — e o HTML pode ter vindo do cache do SW (aberto sem sinal), mais velho
 * que o que o aparelho já sabe.
 */
export function useList(householdId: string, initial?: Entry[], initialUpdatedAt?: number) {
  return useQuery({
    queryKey: listKey(householdId),
    queryFn: () => fetchList(householdId),
    initialData: initial,
    initialDataUpdatedAt: initialUpdatedAt,
  });
}
