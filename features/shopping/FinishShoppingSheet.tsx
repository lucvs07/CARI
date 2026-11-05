"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cari } from "@/features/cari/messages";
import { toCariError } from "@/lib/errors";
import { defaultPurchaseQuantity, type Unit } from "@/lib/units";
import { parseEntryQuantity, toQuantityInput, type Entry } from "./model";
import { useFinishShopping } from "./mutations";

/**
 * `entries` é uma foto tirada ao abrir: se outro aparelho finalizar antes, o Realtime tira as entradas
 * do cache, mas o painel continua com elas e o servidor responde "já guardaram".
 */
export function FinishShoppingSheet({
  open,
  onOpenChange,
  householdId,
  entries,
  online,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  entries: Entry[];
  online: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-dvh overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Finalizar compra</SheetTitle>
          <SheetDescription>Confira as quantidades compradas.</SheetDescription>
        </SheetHeader>
        <FinishForm householdId={householdId} entries={entries} online={online} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function FinishForm({
  householdId,
  entries,
  online,
  onDone,
}: {
  householdId: string;
  entries: Entry[];
  online: boolean;
  onDone: () => void;
}) {
  const finish = useFinishShopping();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, toQuantityInput(defaultPurchaseQuantity(e.quantity, e.unit as Unit))])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const nextErrors: Record<string, string> = {};
    const payload: { entry_id: string; quantity: number }[] = [];
    for (const e of entries) {
      const parsed = parseEntryQuantity(values[e.id] ?? "", true);
      if (!parsed.ok) nextErrors[e.id] = parsed.error;
      else payload.push({ entry_id: e.id, quantity: parsed.value! });
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    finish.mutate(
      { householdId, entries: payload },
      {
        onSuccess: onDone,
        onError: (err) => {
          if (toCariError(err) === "alreadyFinished") onDone();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <ul className="flex flex-col gap-2">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-base">{e.name}</span>
              <Input
                className="h-11 w-24 text-right"
                inputMode="decimal"
                aria-label={`Quantidade de ${e.name}`}
                aria-invalid={errors[e.id] ? true : undefined}
                value={values[e.id] ?? ""}
                onChange={(ev) => setValues((v) => ({ ...v, [e.id]: ev.target.value }))}
              />
              <span className="w-6 text-sm text-muted-foreground">{e.unit}</span>
            </div>
            {errors[e.id] && (
              <p role="alert" className="text-sm text-destructive">
                {errors[e.id]}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Button type="submit" className="h-11" disabled={finish.isPending || !online}>
        Guardar no estoque
      </Button>
      {!online && <p className="text-sm text-muted-foreground">{cari.finishNeedsNetwork}</p>}
    </form>
  );
}
