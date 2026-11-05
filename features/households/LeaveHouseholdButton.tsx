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
import { forgetLastHousehold } from "@/features/pwa/lastHousehold";
import type { CariErrorKey } from "@/lib/errors";
import { leaveHousehold } from "./actions";

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
        forgetLastHousehold();
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
            <DialogTitle>Sair da casa?</DialogTitle>
            <DialogDescription>
              {cari.leaveConfirmPrefix} <em>{householdName}</em>
              {cari.leaveConfirmSuffix}
            </DialogDescription>
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
