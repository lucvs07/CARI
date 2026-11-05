import { redirect } from "next/navigation";
import { AppShell } from "@/features/shell/AppShell";
import { getHouseholds } from "@/features/households/queries";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function HouseholdLayout({ children, params }: LayoutProps<"/[householdId]">) {
  const { householdId } = await params;
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const households = await getHouseholds(supabase); // RLS: só as casas do usuário
  if (!households.some((h) => h.id === householdId)) redirect("/");

  return (
    <AppShell
      householdId={householdId}
      households={households.map(({ id, name }) => ({ id, name }))}
      user={{ id: user.id, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
