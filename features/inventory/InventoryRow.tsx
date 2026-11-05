"use client";

import { MinusIcon, MoreVerticalIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatQuantity, stepQuantity } from "@/lib/units";
import { useMarkEmpty, useRemoveItem, useSetItemQuantity } from "./mutations";
import type { Item } from "./schema";

export function InventoryRow({
  item,
  householdId,
  online,
  onEdit,
}: {
  item: Item;
  householdId: string;
  online: boolean;
  onEdit: (item: Item) => void;
}) {
  const setQuantity = useSetItemQuantity();
  const markEmpty = useMarkEmpty();
  const remove = useRemoveItem();
  const empty = item.quantity === 0;

  function step(dir: 1 | -1) {
    const next = stepQuantity(item.quantity, item.unit, dir);
    if (dir === -1 && item.quantity > 0 && next === 0) {
      markEmpty.mutate({ householdId, item });
    } else {
      setQuantity.mutate({ householdId, id: item.id, quantity: next });
    }
  }

  return (
    <li className={cn("flex items-center gap-1 border-b py-1 last:border-b-0", empty && "opacity-60")}>
      <span className="min-w-0 flex-1 truncate text-base">{item.name}</span>
      <Button
        variant="outline"
        className="size-11"
        aria-label={`Diminuir ${item.name}`}
        disabled={!online || empty}
        onClick={() => step(-1)}
      >
        <MinusIcon aria-hidden />
      </Button>
      <span className="min-w-16 text-center text-sm tabular-nums">{formatQuantity(item.quantity, item.unit)}</span>
      <Button
        variant="outline"
        className="size-11"
        aria-label={`Aumentar ${item.name}`}
        disabled={!online}
        onClick={() => step(1)}
      >
        <PlusIcon aria-hidden />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="size-11" aria-label={`Ações de ${item.name}`} disabled={!online}>
            <MoreVerticalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11" onSelect={() => onEdit(item)}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => markEmpty.mutate({ householdId, item })}>
            Acabou
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => remove.mutate({ householdId, item })}>
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
