import { getMembers } from "@/features/households/queries";
import { ShoppingScreen } from "@/features/shopping/ShoppingScreen";
import { createServerSupabase } from "@/lib/supabase/server";

export const instant = false;

async function loadLista(householdId: string) {
  const supabase = await createServerSupabase();
  const [entries, items, members] = await Promise.all([
    supabase.from("shopping_list_entries").select("*").eq("household_id", householdId),
    supabase.from("items").select("*").eq("household_id", householdId),
    getMembers(supabase, householdId),
  ]);
  if (entries.error) throw entries.error;
  if (items.error) throw items.error;
  // Momento da leitura: o cliente compara com o cache persistido (o HTML pode vir do cache do SW).
  return { entries: entries.data, entriesAt: Date.now(), items: items.data, members };
}

/** A carga do servidor é só initialData: a tela renderiza do cache (persistido) do TanStack Query. */
export default async function ListaPage({ params }: PageProps<"/[householdId]/lista">) {
  const { householdId } = await params;
  const { entries, entriesAt, items, members } = await loadLista(householdId);
  return (
    <ShoppingScreen
      householdId={householdId}
      initialEntries={entries}
      initialEntriesAt={entriesAt}
      initialItems={items}
      initialMembers={members}
    />
  );
}
