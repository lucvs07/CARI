"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";
import { cariErrorMessage } from "@/lib/errors";
import { LISTA_CACHE } from "@/features/pwa/cacheNames";
import { forgetLastHousehold, lastListaHref } from "@/features/pwa/lastHousehold";
import type { CariErrorKey } from "@/lib/errors";
import { leaveHousehold } from "./actions";

/** Tira do cache do SW as respostas da Lista da casa que a pessoa deixou. */
async function dropListaCache(householdId: string): Promise<void> {
  try {
    if (typeof window === "undefined" || !("caches" in window)) return;
    const cache = await caches.open(LISTA_CACHE);
    const prefix = `/${householdId}/lista`;
    for (const req of await cache.keys()) {
      if (new URL(req.url).pathname === prefix) await cache.delete(req);
    }
  } catch {
    // limpeza é best-effort: sair da casa já deu certo
  }
}

export function LeaveHouseholdButton({ householdId, householdName }: { householdId: string; householdName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<CariErrorKey | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      try {
        const res = await leaveHousehold(householdId);
        if ("error" in res) {
          setError(res.error);
          setOpen(false);
          return;
        }
        if (lastListaHref() === `/${householdId}/lista`) forgetLastHousehold();
        await dropListaCache(householdId);
        queryClient.removeQueries({ queryKey: ["items", householdId] });
        queryClient.removeQueries({ queryKey: ["list", householdId] });
        queryClient.removeQueries({ queryKey: ["members", householdId] });
        await queryClient.invalidateQueries({ queryKey: ["households"] });
        router.replace("/");
      } catch {
        setError("genericError");
        setOpen(false);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <Button
          variant="destructive"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          Sair da casa
        </Button>
      </div>
      {error && <CariSays message={cariErrorMessage(error)} live />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {cari.leaveConfirmPrefix} <em>{householdName}</em>
              {cari.leaveConfirmSuffix}
            </DialogTitle>
            <DialogDescription>{cari.leaveConfirmDetail}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              Sim, sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
