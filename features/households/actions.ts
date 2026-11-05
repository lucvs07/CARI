"use server";

import { z } from "zod";
import { toCariError, type CariErrorKey } from "@/lib/errors";
import { inviteUrlFor } from "./inviteUrl";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(60);

/** Cria a casa (o usuário vira owner) e devolve o id. */
export async function createHousehold(name: string): Promise<{ id: string }> {
  await requireUser();
  const parsed = nameSchema.parse(name);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("create_household", { p_name: parsed });
  if (error || !data) throw new Error(error?.message ?? "create_household falhou");
  return { id: data };
}

export type ActionError = { error: CariErrorKey };

export async function renameHousehold(id: string, name: string): Promise<{ ok: true } | ActionError> {
  await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: "genericError" };
  const supabase = await createServerSupabase();
  // RLS: só owner altera; sem permissão nenhuma linha é tocada.
  const { data, error } = await supabase.from("households").update({ name: parsed.data }).eq("id", id).select("id");
  if (error || !data?.length) return { error: toCariError(error) };
  return { ok: true };
}

export async function createInvite(householdId: string): Promise<{ url: string; expiresAt: string } | ActionError> {
  await requireUser();
  const supabase = await createServerSupabase();
  const { data: token, error } = await supabase.rpc("create_invite", { p_household_id: householdId });
  if (error || !token) return { error: toCariError(error) };
  const { data: invite, error: readError } = await supabase
    .from("household_invites")
    .select("expires_at")
    .eq("token", token)
    .single();
  if (readError) return { error: toCariError(readError) };
  return { url: await inviteUrlFor(token), expiresAt: invite.expires_at };
}

export async function revokeInvite(householdId: string): Promise<{ ok: true } | ActionError> {
  await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("household_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .is("revoked_at", null);
  if (error) return { error: toCariError(error) };
  return { ok: true };
}

export async function setMemberRole(
  householdId: string,
  userId: string,
  role: "owner" | "member",
): Promise<{ ok: true } | ActionError> {
  await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("household_members")
    .update({ role })
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) return { error: toCariError(error) };
  return { ok: true };
}

export async function removeMember(householdId: string, userId: string): Promise<{ ok: true } | ActionError> {
  await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) return { error: toCariError(error) };
  return { ok: true };
}

export async function leaveHousehold(householdId: string): Promise<{ ok: true } | ActionError> {
  await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("leave_household", { p_household_id: householdId });
  if (error) return { error: toCariError(error) };
  return { ok: true };
}

export async function acceptInvite(token: string): Promise<{ householdId: string } | ActionError> {
  await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !data) return { error: toCariError(error) };
  return { householdId: data };
}
