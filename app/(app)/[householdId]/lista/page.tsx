import { UserMenu } from "@/features/shell/UserMenu";
import { requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function ListaPage() {
  await requireUser();
  return (
    <>
      <header className="flex items-center justify-between p-4">
        <span className="font-semibold">CARI</span>
        <UserMenu />
      </header>
      <main className="p-4">
        <h1 className="text-xl font-semibold">Lista</h1>
      </main>
    </>
  );
}
