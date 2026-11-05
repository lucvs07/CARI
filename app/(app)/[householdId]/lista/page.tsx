import { getMembers } from "@/features/households/queries";
import { ShoppingScreen } from "@/features/shopping/ShoppingScreen";
import { createServerSupabase } from "@/lib/supabase/server";

export const instant = false;

/** A carga do servidor é só initialData: a tela renderiza do cache (persistido) do TanStack Query. */
export default async function ListaPage({ params }: PageProps<"/[householdId]/lista">) {
  const { householdId } = await params;
  const supabase = await createServerSupabase();
  const [entries, items, members] = await Promise.all([
    supabase.from("shopping_list_entries").select("*").eq("household_id", householdId),
    supabase.from("items").select("*").eq("household_id", householdId),
    getMembers(supabase, householdId),
  ]);
  if (entries.error) throw entries.error;
  if (items.error) throw items.error;
  return (
    <ShoppingScreen
      householdId={householdId}
      initialEntries={entries.data}
      initialItems={items.data}
      initialMembers={members}
    />
  );
}
