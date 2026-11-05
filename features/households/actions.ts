"use server";

import { z } from "zod";
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
