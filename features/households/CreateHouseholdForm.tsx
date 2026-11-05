"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cari } from "@/features/cari/messages";
import { createHousehold } from "./actions";

const nameSchema = z.string().trim().min(1, "Dá um nome para a casa.").max(60, "Use até 60 caracteres.");

export function CreateHouseholdForm() {
  const router = useRouter();
  const [name, setName] = useState("");
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
        const { id } = await createHousehold(parsed.data);
        // Tarefa 13 troca o destino por /[id]/casa?novo=1 (convite).
        router.push(`/${id}/lista`);
      } catch {
        setError(cari.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3" noValidate>
      <Label htmlFor="household-name">Nome da casa</Label>
      <Input
        id="household-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoComplete="off"
        placeholder="Ex.: Casa da família"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "household-name-error" : undefined}
      />
      {error && (
        <p id="household-name-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        Criar casa
      </Button>
    </form>
  );
}
