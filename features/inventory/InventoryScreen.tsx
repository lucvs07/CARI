"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";
import { HydrationMarker } from "@/features/pwa/HydrationMarker";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { useOnlineStatus } from "@/lib/query/useOnlineStatus";
import { EditItemSheet } from "./EditItemSheet";
import { InventoryRow } from "./InventoryRow";
import { InventoryOfflineNotice } from "./OfflineNotice";
import { QuickAddSheet } from "./QuickAddSheet";
import { useItems } from "./queries";
import { normalizeName, type Item } from "./schema";

export function InventoryScreen({ householdId, initialItems }: { householdId: string; initialItems: Item[] }) {
  const { data: items = [] } = useItems(householdId, initialItems);
  const online = useOnlineStatus();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const query = normalizeName(search);
  const visible = query ? items.filter((i) => normalizeName(i.name).includes(query)) : items;
  const groups = CATEGORIES.map((category) => ({
    category,
    rows: visible
      .filter((i) => (CATEGORIES as readonly string[]).includes(i.category) ? i.category === category : category === "outros")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <HydrationMarker />
      {!online && <InventoryOfflineNotice />}

      {items.length === 0 ? (
        <CariSays
          message={cari.emptyInventory}
          action={
            <Button className="h-11" disabled={!online} onClick={() => setAdding(true)}>
              Adicionar item
            </Button>
          }
        />
      ) : (
        <>
          <Input
            type="search"
            className="h-11"
            aria-label="Buscar item"
            placeholder="Buscar item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {groups.length === 0 && <p className="text-sm text-muted-foreground">{cari.inventoryNoResults}</p>}
          {groups.map(({ category, rows }) => (
            <section key={category} aria-labelledby={`grupo-${category}`}>
              <h2 id={`grupo-${category}`} className="mb-1 text-sm font-semibold text-secondary">
                {CATEGORY_LABELS[category]}
              </h2>
              <ul>
                {rows.map((item) => (
                  <InventoryRow key={item.id} item={item} householdId={householdId} online={online} onEdit={setEditing} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <Button
        size="icon"
        className="fixed right-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] z-30 size-14 rounded-full shadow-lg"
        aria-label="Adicionar item"
        disabled={!online}
        onClick={() => setAdding(true)}
      >
        <PlusIcon className="size-6" aria-hidden />
      </Button>

      <QuickAddSheet open={adding} onOpenChange={setAdding} householdId={householdId} items={items} />
      <EditItemSheet item={editing} householdId={householdId} onClose={() => setEditing(null)} />
    </div>
  );
}
