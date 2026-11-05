"use client";

import { useId, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Button } from "@/components/ui/button";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cari } from "@/features/cari/messages";
import { QuantityField, UnitCategoryFields } from "@/features/inventory/ItemFields";
import { useCurrentUserId } from "@/features/shell/CurrentUser";
import { LAST_CATEGORY, LAST_UNIT, readStored, writeStored } from "@/features/inventory/lastChoice";
import { normalizeName, type Item } from "@/features/inventory/schema";
import { CATEGORIES, type Category } from "@/lib/categories";
import { UNITS, type Unit } from "@/lib/units";
import { parseEntryQuantity, type Entry } from "./model";
import { useUpsertEntry } from "./mutations";

const MAX_NAME = 80;

/** Adição rápida da Lista: mesmo autocompletar do Estoque; item do estoque vira entrada ligada. */
export function AddEntrySheet({
  open,
  onOpenChange,
  householdId,
  items,
  entries,
  onHighlight,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  items: Item[];
  entries: Entry[];
  onHighlight: (entryId: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-dvh overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Adicionar à lista</SheetTitle>
          <SheetDescription className="sr-only">Escolha um item da casa ou escreva um novo.</SheetDescription>
        </SheetHeader>
        <AddEntryForm
          householdId={householdId}
          items={items}
          entries={entries}
          onHighlight={onHighlight}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function AddEntryForm({
  householdId,
  items,
  entries,
  onHighlight,
  onDone,
}: {
  householdId: string;
  items: Item[];
  entries: Entry[];
  onHighlight: (entryId: string) => void;
  onDone: () => void;
}) {
  const nameId = useId();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<Unit>(() => readStored(LAST_UNIT, UNITS, "un"));
  const [category, setCategory] = useState<Category>(() => readStored(LAST_CATEGORY, CATEGORIES, "outros"));
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertEntry();
  const userId = useCurrentUserId();

  const query = normalizeName(name);
  const suggestions = picked || !query ? [] : items.filter((i) => normalizeName(i.name).includes(query)).slice(0, 5);

  function pick(item: Item) {
    setPicked(item);
    setName(item.name);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError(cari.itemNameRequired);
    if (trimmed.length > MAX_NAME) return setError(cari.itemNameTooLong);
    const qty = parseEntryQuantity(quantity);
    if (!qty.ok) return setError(qty.error);
    setError(null);

    const key = normalizeName(trimmed);
    const item = picked ?? items.find((i) => normalizeName(i.name) === key);
    const existing = entries.find((en) => (item ? en.item_id === item.id : !en.item_id && normalizeName(en.name) === key));
    if (existing) {
      onDone();
      onHighlight(existing.id);
      return;
    }

    if (!item) {
      writeStored(LAST_UNIT, unit);
      writeStored(LAST_CATEGORY, category);
    }
    // Sem await: offline a escrita fica na fila e a UI já mostra a entrada.
    upsert.mutate({
      householdId,
      userId,
      entry: {
        id: crypto.randomUUID(),
        name: item?.name ?? trimmed,
        unit: item?.unit ?? unit,
        category: item?.category ?? category,
        quantity: qty.value,
        item_id: item?.id ?? null,
      },
    });
    onDone();
  }

  const linked = picked ?? null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
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
      {linked ? (
        <p className="text-sm text-muted-foreground">Unidade: {linked.unit}</p>
      ) : (
        <UnitCategoryFields unit={unit} category={category} onUnit={setUnit} onCategory={setCategory} />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11">
        Adicionar à lista
      </Button>
    </form>
  );
}
