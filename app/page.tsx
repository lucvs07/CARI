import { redirect } from "next/navigation";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function Home() {
  const user = await requireUser();
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_household_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.last_household_id) {
    // Confirma que ainda é membro antes de confiar no last_household_id.
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("household_id", profile.last_household_id)
      .maybeSingle();
    if (membership) redirect(`/${membership.household_id}/lista`);
  }

  const { data: first } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  redirect(first ? `/${first.household_id}/lista` : "/bem-vindo");
}
