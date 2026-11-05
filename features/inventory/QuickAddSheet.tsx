"use client";

import { useId, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Button } from "@/components/ui/button";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cari } from "@/features/cari/messages";
import { CariSays } from "@/features/cari/CariSays";
import { CATEGORIES, type Category } from "@/lib/categories";
import { toCariError } from "@/lib/errors";
import { useOnlineStatus } from "@/lib/query/useOnlineStatus";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { UNITS, type Unit } from "@/lib/units";
import { QuantityField, UnitCategoryFields } from "./ItemFields";
import { LAST_CATEGORY, LAST_UNIT, readStored, writeStored } from "./lastChoice";
import { useUpsertItem } from "./mutations";
import { InventoryOfflineNotice } from "./OfflineNotice";
import { itemInputSchema, normalizeName, type Item } from "./schema";

export function QuickAddSheet({
  open,
  onOpenChange,
  householdId,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  items: Item[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-dvh overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Adicionar item</SheetTitle>
          <SheetDescription className="sr-only">Escolha um item da casa ou cadastre um novo.</SheetDescription>
        </SheetHeader>
        <QuickAddForm householdId={householdId} items={items} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

type Pending = { existing: Item; quantity: number };

function QuickAddForm({ householdId, items, onDone }: { householdId: string; items: Item[]; onDone: () => void }) {
  const nameId = useId();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<Unit>(() => readStored(LAST_UNIT, UNITS, "un"));
  const [category, setCategory] = useState<Category>(() => readStored(LAST_CATEGORY, CATEGORIES, "outros"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const upsert = useUpsertItem(picked?.id ?? pending?.existing.id);
  const online = useOnlineStatus();

  const query = normalizeName(name);
  const suggestions = picked || !query ? [] : items.filter((i) => normalizeName(i.name).includes(query)).slice(0, 5);

  function pick(item: Item) {
    setPicked(item);
    setName(item.name);
    setError(null);
  }

  async function sum(existing: Item, qty: number) {
    try {
      await upsert.mutateAsync({ householdId, name: existing.name, quantity: qty, unit: existing.unit, category: existing.category as Category, existingId: existing.id });
      setPending(null);
      onDone();
    } catch {
      setPending(null); // o toast com "Tentar de novo" vem da mutação
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!online) return;
    const parsed = itemInputSchema.safeParse({
      name: picked?.name ?? name,
      quantity,
      unit: picked?.unit ?? unit,
      category: picked ? (CATEGORIES as readonly string[]).includes(picked.category) ? picked.category : "outros" : category,
    });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);

    if (picked) return void sum(picked, parsed.data.quantity);

    const match = items.find((i) => normalizeName(i.name) === normalizeName(parsed.data.name));
    if (match) return setPending({ existing: match, quantity: parsed.data.quantity });

    writeStored(LAST_UNIT, parsed.data.unit);
    writeStored(LAST_CATEGORY, parsed.data.category);
    try {
      await upsert.mutateAsync({ householdId, id: crypto.randomUUID(), ...parsed.data });
      onDone();
    } catch (err) {
      if (toCariError(err) !== "duplicateItem") return;
      // Outro membro criou o mesmo nome antes do cache atualizar: busca no banco e pergunta.
      const { data } = await getBrowserSupabase()
        .from("items")
        .select("*")
        .eq("household_id", householdId)
        .eq("name_key", normalizeName(parsed.data.name))
        .maybeSingle();
      if (data) setPending({ existing: data, quantity: parsed.data.quantity });
      else setError(cari.genericError);
    }
  }

  if (pending) {
    return (
      <div className="flex flex-col gap-3">
        {!online && <InventoryOfflineNotice />}
        <CariSays
          live
          message={cari.duplicateItem(pending.existing.name)}
          action={
            <div className="flex gap-2">
              <Button className="h-11" disabled={!online || upsert.isPending} onClick={() => void sum(pending.existing, pending.quantity)}>
                Somar
              </Button>
              <Button variant="outline" className="h-11" onClick={() => setPending(null)}>
                Voltar
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Nome do item</Label>
        <Command shouldFilter={false} label="Nome do item" className="bg-transparent p-0">
          <CommandPrimitive.Input
            id={nameId}
            value={name}
            onValueChange={(v) => {
              setName(v);
              setPicked(null);
            }}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {suggestions.length > 0 && (
            <CommandList>
              {suggestions.map((i) => (
                <CommandItem key={i.id} value={i.id} className="min-h-11" onSelect={() => pick(i)}>
                  {i.name}
                </CommandItem>
              ))}
            </CommandList>
          )}
        </Command>
      </div>
      <QuantityField value={quantity} onChange={setQuantity} />
      {picked ? (
        <p className="text-sm text-muted-foreground">Unidade: {picked.unit}</p>
      ) : (
        <UnitCategoryFields unit={unit} category={category} onUnit={setUnit} onCategory={setCategory} />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!online && <InventoryOfflineNotice />}
      <Button type="submit" className="h-11" disabled={!online || upsert.isPending}>
        Salvar
      </Button>
    </form>
  );
}
