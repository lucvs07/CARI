import { notFound } from "next/navigation";
import { InvitePanel, type ActiveInvite } from "@/features/households/InvitePanel";
import { LeaveHouseholdButton } from "@/features/households/LeaveHouseholdButton";
import { MembersList } from "@/features/households/MembersList";
import { RenameHouseholdForm } from "@/features/households/RenameHouseholdForm";
import { inviteUrlFor } from "@/features/households/inviteUrl";
import { getMembers } from "@/features/households/queries";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function CasaPage({
  params,
  searchParams,
}: PageProps<"/[householdId]/casa">) {
  const { householdId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createServerSupabase();

  const { data: household } = await supabase
    .from("households")
    .select("id, name")
    .eq("id", householdId)
    .maybeSingle();
  if (!household) notFound();

  const members = await getMembers(supabase, householdId);
  const isOwner = members.some((m) => m.user_id === user.id && m.role === "owner");

  let invite: ActiveInvite | null = null;
  if (isOwner) {
    const { data } = await supabase
      .from("household_invites")
      .select("token, expires_at")
      .eq("household_id", householdId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) invite = { url: await inviteUrlFor(data.token), expiresAt: data.expires_at };
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Casa</h1>
      {isOwner ? (
        <RenameHouseholdForm key={household.name} householdId={householdId} initialName={household.name} />
      ) : (
        <p className="text-lg font-medium">{household.name}</p>
      )}
      <MembersList householdId={householdId} currentUserId={user.id} initialMembers={members} />
      {isOwner && <InvitePanel householdId={householdId} initialInvite={invite} novo={sp.novo === "1"} />}
      <LeaveHouseholdButton householdId={householdId} householdName={household.name} />
    </div>
  );
}
