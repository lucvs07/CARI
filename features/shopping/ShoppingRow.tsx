"use client";

import { CheckIcon, MoreVerticalIcon } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatQuantity, type Unit } from "@/lib/units";
import { initials, type Entry } from "./model";

export function ShoppingRow({
  entry,
  addedByName,
  highlighted,
  onToggle,
  onEditQuantity,
  onRemove,
}: {
  entry: Entry;
  addedByName?: string;
  highlighted: boolean;
  onToggle: (entry: Entry) => void;
  onEditQuantity: (entry: Entry) => void;
  onRemove: (entry: Entry) => void;
}) {
  return (
    <li
      id={`entrada-${entry.id}`}
      className={cn(
        "flex items-center gap-1 rounded-lg border-b transition-shadow last:border-b-0",
        highlighted && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        aria-pressed={entry.checked}
        aria-label={entry.name}
        onClick={() => onToggle(entry)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
            entry.checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {entry.checked && <CheckIcon className="size-4" />}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-base", entry.checked && "text-muted-foreground line-through")}>
          {entry.name}
        </span>
        {entry.quantity !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatQuantity(entry.quantity, entry.unit as Unit)}
          </span>
        )}
        {addedByName !== undefined && (
          <Avatar size="sm" title={addedByName} aria-hidden>
            <AvatarFallback className="text-[0.625rem]">{initials(addedByName)}</AvatarFallback>
          </Avatar>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="size-11" aria-label={`Ações de ${entry.name}`}>
            <MoreVerticalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11" onSelect={() => onEditQuantity(entry)}>
            Editar quantidade
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => onRemove(entry)}>
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
