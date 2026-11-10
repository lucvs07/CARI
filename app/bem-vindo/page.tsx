import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";
import { CreateHouseholdForm } from "@/features/households/CreateHouseholdForm";
import { requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function BemVindo() {
  await requireUser();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <CariSays message={cari.welcome} />
      <CreateHouseholdForm />
    </main>
  );
}
