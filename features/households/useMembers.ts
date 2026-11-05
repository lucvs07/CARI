"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { getMembers, membersKey, type Member } from "./queries";

export function useMembers(householdId: string, initialData?: Member[]) {
  return useQuery({
    queryKey: membersKey(householdId),
    queryFn: () => getMembers(getBrowserSupabase(), householdId),
    initialData,
    staleTime: 5 * 60_000,
  });
}
