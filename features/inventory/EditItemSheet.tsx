"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORIES, type Category } from "@/lib/categories";
import { useOnlineStatus } from "@/lib/query/useOnlineStatus";
import { QuantityField, UnitCategoryFields } from "./ItemFields";
import { useUpdateItem } from "./mutations";
import { InventoryOfflineNotice } from "./OfflineNotice";
import { itemInputSchema, type Item } from "./schema";

export function EditItemSheet({
  item,
  householdId,
  onClose,
}: {
  item: Item | null;
  householdId: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-dvh overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Editar item</SheetTitle>
          <SheetDescription className="sr-only">Altere nome, quantidade, unidade e categoria.</SheetDescription>
        </SheetHeader>
        {item && <EditForm key={item.id} item={item} householdId={householdId} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({ item, householdId, onClose }: { item: Item; householdId: string; onClose: () => void }) {
  const update = useUpdateItem(item.id);
  const online = useOnlineStatus();
  const nameId = useId();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity).replace(".", ","));
  const [unit, setUnit] = useState(item.unit);
  const [category, setCategory] = useState<Category>(
    (CATEGORIES as readonly string[]).includes(item.category) ? (item.category as Category) : "outros",
  );
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!online) return;
    const parsed = itemInputSchema.safeParse({ name, quantity, unit, category });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    update.mutate({ householdId, id: item.id, ...parsed.data });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Nome do item</Label>
        <Input id={nameId} className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <QuantityField value={quantity} onChange={setQuantity} />
      <UnitCategoryFields unit={unit} category={category} onUnit={setUnit} onCategory={setCategory} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!online && <InventoryOfflineNotice />}
      <Button type="submit" className="h-11" disabled={!online}>
        Salvar
      </Button>
    </form>
  );
}
