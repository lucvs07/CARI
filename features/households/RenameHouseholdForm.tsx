"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cari } from "@/features/cari/messages";
import { cariErrorMessage } from "@/lib/errors";
import { renameHousehold } from "./actions";

const nameSchema = z.string().trim().min(1, cari.houseNameRequired).max(60, cari.houseNameTooLong);

export function RenameHouseholdForm({ householdId, initialName }: { householdId: string; initialName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    start(async () => {
      try {
        const res = await renameHousehold(householdId, parsed.data);
        if ("error" in res) {
          setError(cariErrorMessage(res.error));
          return;
        }
        toast(cari.houseRenamed);
        await queryClient.invalidateQueries({ queryKey: ["households"] });
        router.refresh(); // o seletor da casa vem do layout do servidor
      } catch {
        setError(cari.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <Label htmlFor="rename-household">Nome da casa</Label>
      <div className="flex gap-2">
        <Input
          id="rename-household"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
        <Button type="submit" disabled={pending}>
          Salvar nome
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
