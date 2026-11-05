import { AcceptInvite } from "@/features/households/AcceptInvite";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";

export const instant = false;

export default async function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  await requireUser(); // sem sessão: /login?next=/convite/<token>
  // Nome da casa só para token válido (null: inválido/expirado/revogado — o aceite mostra o erro).
  const supabase = await createServerSupabase();
  const { data: houseName } = await supabase.rpc("invite_preview", { p_token: token });
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <AcceptInvite token={token} houseName={houseName ?? null} />
    </main>
  );
}
