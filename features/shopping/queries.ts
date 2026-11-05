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
export function useList(householdId: string, initial?: Entry[]) {
  return useQuery({
    queryKey: listKey(householdId),
    queryFn: () => fetchList(householdId),
    initialData: initial,
  });
}
