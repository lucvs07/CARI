"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";
import type { Member } from "@/features/households/queries";
import { useMembers } from "@/features/households/useMembers";
import { useCurrentUserId } from "@/features/shell/CurrentUser";
import { QuantityField } from "@/features/inventory/ItemFields";
import { useItems } from "@/features/inventory/queries";
import type { Item } from "@/features/inventory/schema";
import { HydrationMarker } from "@/features/pwa/HydrationMarker";
import { rememberLastHousehold } from "@/features/pwa/lastHousehold";
import { CATEGORY_LABELS } from "@/lib/categories";
import { useOnlineStatus } from "@/lib/query/useOnlineStatus";
import { AddEntrySheet } from "./AddEntrySheet";
import { FinishShoppingSheet } from "./FinishShoppingSheet";
import { checkedEntries, groupEntries, listKey, parseEntryQuantity, toQuantityInput, type Entry } from "./model";
import { useRemoveEntry, useSetChecked, useSetEntryQuantity, useUpsertEntry } from "./mutations";
import { useList } from "./queries";
import { ShoppingRow } from "./ShoppingRow";

const HIGHLIGHT_MS = 2000;

export function ShoppingScreen({
  householdId,
  initialEntries,
  initialEntriesAt,
  initialItems,
  initialMembers,
}: {
  householdId: string;
  initialEntries: Entry[];
  /** Quando o servidor leu `initialEntries` (ms). */
  initialEntriesAt: number;
  initialItems: Item[];
  initialMembers: Member[];
}) {
  const qc = useQueryClient();
  const { data: entries = [] } = useList(householdId, initialEntries, initialEntriesAt);
  const { data: items = [] } = useItems(householdId, initialItems);
  const { data: members = [] } = useMembers(householdId, initialMembers);
  const online = useOnlineStatus();
  const userId = useCurrentUserId();
  const setChecked = useSetChecked();
  const setQuantity = useSetEntryQuantity();
  const remove = useRemoveEntry();
  const upsert = useUpsertEntry();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishSnapshot, setFinishSnapshot] = useState<Entry[]>([]);
  const [cartOpen, setCartOpen] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const networkHintId = useId();
  const cartId = useId();

  useEffect(() => rememberLastHousehold(householdId), [householdId]);

  const names = new Map(members.map((m) => [m.user_id, m.display_name]));
  const { toBuy, inCart } = groupEntries(entries);

  function current(entry: Entry): Entry {
    // Lê o cache no toque: toques seguidos encadeiam no último valor otimista.
    return qc.getQueryData<Entry[]>(listKey(householdId))?.find((r) => r.id === entry.id) ?? entry;
  }

  function toggle(entry: Entry) {
    navigator.vibrate?.(10);
    setChecked.mutate({ householdId, id: entry.id, checked: !current(entry).checked, userId });
  }

  function removeEntry(entry: Entry) {
    const row = current(entry);
    remove.mutate({ householdId, id: row.id });
    toast(cari.removed, {
      action: {
        label: "Desfazer",
        onClick: () =>
          upsert.mutate({
            householdId,
            userId,
            entry: {
              id: row.id,
              name: row.name,
              unit: row.unit,
              category: row.category,
              quantity: row.quantity,
              item_id: row.item_id,
              checked: row.checked,
              added_by: row.added_by,
            },
          }),
      },
    });
  }

  function highlight(entryId: string) {
    const row = entries.find((e) => e.id === entryId);
    if (row?.checked) setCartOpen(true);
    setHighlightId(entryId);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    requestAnimationFrame(() =>
      document.getElementById(`entrada-${entryId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }

  function openFinish() {
    setFinishSnapshot(checkedEntries(qc.getQueryData<Entry[]>(listKey(householdId)) ?? entries));
    setFinishOpen(true);
  }

  const row = (entry: Entry) => (
    <ShoppingRow
      key={entry.id}
      entry={entry}
      addedByName={entry.added_by ? names.get(entry.added_by) : undefined}
      highlighted={highlightId === entry.id}
      onToggle={toggle}
      onEditQuantity={setEditing}
      onRemove={removeEntry}
    />
  );

  return (
    <div className="flex flex-col gap-4 pb-20">
      <HydrationMarker />
      {entries.length === 0 ? (
        <CariSays
          message={cari.emptyList}
          action={
            <Button className="h-11" onClick={() => setAdding(true)}>
              Adicionar item
            </Button>
          }
        />
      ) : (
        <>
          {toBuy.length > 0 && (
            <section aria-labelledby="a-comprar" className="flex flex-col gap-3">
              <h2 id="a-comprar" className="font-heading text-lg font-semibold">
                A comprar
              </h2>
              {toBuy.map(({ category, rows }) => (
                <section key={category} aria-labelledby={`grupo-${category}`}>
                  <h3 id={`grupo-${category}`} className="mb-1 text-sm font-semibold text-secondary">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <ul>{rows.map(row)}</ul>
                </section>
              ))}
            </section>
          )}
          {inCart.length > 0 && (
            <section aria-label="No carrinho">
              <h2>
                <button
                  type="button"
                  aria-expanded={cartOpen}
                  aria-controls={cartId}
                  onClick={() => setCartOpen((o) => !o)}
                  className="flex min-h-11 w-full items-center gap-2 text-left font-heading text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  No carrinho ({inCart.length})
                  <ChevronDownIcon aria-hidden className={cn("size-5 transition-transform", cartOpen && "rotate-180")} />
                </button>
              </h2>
              <ul id={cartId} hidden={!cartOpen}>
                {inCart.map(row)}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] z-30 mx-auto flex max-w-2xl items-end gap-3 px-4">
        <div className="pointer-events-auto min-w-0 flex-1">
          {inCart.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-background/95 shadow-lg">
              <Button
                className="h-12 w-full text-base"
                disabled={!online}
                aria-describedby={online ? undefined : networkHintId}
                onClick={openFinish}
              >
                Finalizar compra ({inCart.length})
              </Button>
              {!online && (
                <p id={networkHintId} className="px-2 pb-1 text-center text-xs text-muted-foreground">
                  {cari.finishNeedsNetwork}
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          size="icon"
          className="pointer-events-auto size-14 shrink-0 rounded-full shadow-lg"
          aria-label="Adicionar item"
          onClick={() => setAdding(true)}
        >
          <PlusIcon className="size-6" aria-hidden />
        </Button>
      </div>

      <AddEntrySheet
        open={adding}
        onOpenChange={setAdding}
        householdId={householdId}
        items={items}
        entries={entries}
        onHighlight={highlight}
      />
      <FinishShoppingSheet
        open={finishOpen}
        onOpenChange={setFinishOpen}
        householdId={householdId}
        entries={finishSnapshot}
        online={online}
      />
      <EditQuantitySheet
        entry={editing}
        onClose={() => setEditing(null)}
        onSave={(quantity) => {
          if (editing) setQuantity.mutate({ householdId, id: editing.id, quantity });
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditQuantitySheet({
  entry,
  onClose,
  onSave,
}: {
  entry: Entry | null;
  onClose: () => void;
  onSave: (quantity: number | null) => void;
}) {
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{entry?.name}</SheetTitle>
          <SheetDescription>Quanto você quer comprar? Deixe vazio se tanto faz.</SheetDescription>
        </SheetHeader>
        {entry && <EditQuantityForm key={entry.id} entry={entry} onSave={onSave} />}
      </SheetContent>
    </Sheet>
  );
}

function EditQuantityForm({ entry, onSave }: { entry: Entry; onSave: (quantity: number | null) => void }) {
  const [value, setValue] = useState(entry.quantity === null ? "" : toQuantityInput(entry.quantity));
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseEntryQuantity(value);
    if (!parsed.ok) return setError(parsed.error);
    onSave(parsed.value);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <QuantityField value={value} onChange={setValue} />
      <p className="text-sm text-muted-foreground">Unidade: {entry.unit}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11">
        Salvar
      </Button>
    </form>
  );
}
