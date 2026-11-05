import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Household = Database["public"]["Tables"]["households"]["Row"];

export type Member = {
  user_id: string;
  role: "owner" | "member";
  display_name: string;
  avatar_url: string | null;
};

// Tarefa 9/11 embrulham estes fetchers em hooks do TanStack Query:
// useHouseholds → key ['households']; useMembers → key ['members', householdId].

export const householdsKey = ["households"] as const;
export const membersKey = (householdId: string) => ["members", householdId] as const;

/** Casas das quais o usuário é membro (RLS filtra). */
export async function getHouseholds(supabase: Client): Promise<Household[]> {
  const { data, error } = await supabase.from("households").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Membros da casa, com nome e avatar do perfil. */
export async function getMembers(supabase: Client, householdId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id, role, profiles(display_name, avatar_url)")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id: m.user_id,
      role: m.role,
      display_name: p?.display_name ?? "",
      avatar_url: p?.avatar_url ?? null,
    };
  });
}
