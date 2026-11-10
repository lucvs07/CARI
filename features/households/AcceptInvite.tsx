"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";
import { cariErrorMessage } from "@/lib/errors";
import type { CariErrorKey } from "@/lib/errors";
import { acceptInvite } from "./actions";

export function AcceptInvite({ token, houseName }: { token: string; houseName: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<CariErrorKey | null>(null);
  const [pending, start] = useTransition();

  function accept() {
    setError(null);
    start(async () => {
      try {
        const res = await acceptInvite(token);
        if ("error" in res) setError(res.error);
        else router.replace(`/${res.householdId}/lista`);
      } catch {
        setError("genericError");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{houseName ? cari.invitePrompt(houseName) : cari.invitePromptUnknown}</h1>
      <Button size="lg" onClick={accept} disabled={pending}>
        Entrar
      </Button>
      {error && <CariSays message={cariErrorMessage(error)} live />}
    </div>
  );
}
