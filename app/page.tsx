import { redirect } from "next/navigation";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function Home() {
  const user = await requireUser();
  const supabase = await createServerSupabase();

  // Falha de leitura vai para o error boundary: tratar como "sem casa" mandaria um membro para /bem-vindo.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("last_household_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  if (profile?.last_household_id) {
    // Confirma que ainda é membro antes de confiar no last_household_id.
    const { data: membership, error: membershipError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("household_id", profile.last_household_id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (membership) redirect(`/${membership.household_id}/lista`);
  }

  const { data: first, error: firstError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstError) throw firstError;

  redirect(first ? `/${first.household_id}/lista` : "/bem-vindo");
}
