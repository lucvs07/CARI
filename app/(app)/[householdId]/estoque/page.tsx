import { InventoryScreen } from "@/features/inventory/InventoryScreen";
import { createServerSupabase } from "@/lib/supabase/server";

export const instant = false;

export default async function EstoquePage({ params }: PageProps<"/[householdId]/estoque">) {
  const { householdId } = await params;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("items").select("*").eq("household_id", householdId);
  if (error) throw error;
  return <InventoryScreen householdId={householdId} initialItems={data} />;
}
