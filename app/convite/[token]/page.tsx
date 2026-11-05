import { AcceptInvite } from "@/features/households/AcceptInvite";
import { requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  await requireUser(); // sem sessão: /login?next=/convite/<token>
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <AcceptInvite token={token} />
    </main>
  );
}
