"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";
import { cariErrorMessage } from "@/lib/errors";
import { createInvite, revokeInvite } from "./actions";

export type ActiveInvite = { url: string; expiresAt: string };

export function InvitePanel({
  householdId,
  initialInvite,
  novo,
}: {
  householdId: string;
  initialInvite: ActiveInvite | null;
  novo: boolean;
}) {
  const [invite, setInvite] = useState<ActiveInvite | null>(initialInvite);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [welcome] = useState(novo); // sobrevive à remoção do ?novo=1 da URL
  const autoStarted = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  function generate() {
    setError(null);
    start(async () => {
      try {
        const res = await createInvite(householdId);
        if ("error" in res) setError(cariErrorMessage(res.error));
        else {
          setInvite(res);
          // A fala de boas-vindas vale só uma vez: não volta ao revisitar a URL.
          if (novo) router.replace(pathname, { scroll: false });
        }
      } catch {
        setError(cari.genericError);
      }
    });
  }

  // Casa recém-criada: o link já nasce pronto (uma vez só).
  useEffect(() => {
    if (novo && !initialInvite && !autoStarted.current) {
      autoStarted.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function revoke() {
    setError(null);
    start(async () => {
      try {
        const res = await revokeInvite(householdId);
        if ("error" in res) setError(cariErrorMessage(res.error));
        else setInvite(null);
      } catch {
        setError(cari.genericError);
      }
    });
  }

  async function share(url: string) {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "CARI", text: "Entra na nossa casa no CARI!", url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(cari.linkCopied);
    } catch {
      toast.error(cari.genericError);
    }
  }

  return (
    <section aria-labelledby="convite-titulo" className="flex flex-col gap-3">
      <h2 id="convite-titulo" className="text-lg font-semibold">
        Convite
      </h2>
      {welcome && invite && <CariSays message={cari.houseCreated} live />}
      {invite ? (
        <>
          <Input readOnly aria-label="Link de convite" value={invite.url} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-sm text-muted-foreground">
            Vale até{" "}
            <span suppressHydrationWarning>
              {new Date(invite.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => share(invite.url)}>
              <Share2 aria-hidden /> Compartilhar
            </Button>
            <Button variant="outline" onClick={generate} disabled={pending}>
              Gerar novo link
            </Button>
            <Button variant="ghost" onClick={revoke} disabled={pending}>
              Revogar
            </Button>
          </div>
        </>
      ) : (
        <div>
          <Button onClick={generate} disabled={pending}>
            <Link2 aria-hidden /> Gerar link de convite
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
