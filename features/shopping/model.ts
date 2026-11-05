import { cari } from "@/features/cari/messages";
import { MAX_QUANTITY } from "@/features/inventory/schema";
import { CATEGORIES, type Category } from "@/lib/categories";
import type { Database } from "@/lib/supabase/database.types";
import { parseQuantity } from "@/lib/units";

export type Entry = Database["public"]["Tables"]["shopping_list_entries"]["Row"];

export const listKey = (householdId: string) => ["list", householdId] as const;

/** Escritas da lista que vão para a fila offline (setMutationDefaults). */
export const LIST_OPS = ["upsert", "setChecked", "setQuantity", "remove"] as const;
export type ListOp = (typeof LIST_OPS)[number];
export const listMutationKey = (op: ListOp) => ["list", op] as const;

export function isListWriteKey(key: readonly unknown[] | undefined): boolean {
  return key?.[0] === "list" && (LIST_OPS as readonly unknown[]).includes(key?.[1]);
}

export function categoryOf(raw: string): Category {
  return (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : "outros";
}

const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

export type EntryGroups = {
  toBuy: { category: Category; rows: Entry[] }[];
  inCart: Entry[];
};

/** "A comprar" agrupado na ordem das categorias e alfabético; "No carrinho" alfabético. */
export function groupEntries(entries: Entry[]): EntryGroups {
  const unchecked = entries.filter((e) => !e.checked);
  return {
    toBuy: CATEGORIES.map((category) => ({
      category,
      rows: unchecked.filter((e) => categoryOf(e.category) === category).sort(byName),
    })).filter((g) => g.rows.length > 0),
    inCart: entries.filter((e) => e.checked).sort(byName),
  };
}

/** Entradas marcadas na ordem em que aparecem no carrinho. */
export function checkedEntries(entries: Entry[]): Entry[] {
  return groupEntries(entries).inCart;
}

export function countUnchecked(entries: Entry[] | undefined): number {
  return entries?.filter((e) => !e.checked).length ?? 0;
}

export function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export type MutationSnapshot = { mutationKey?: readonly unknown[]; isPaused: boolean };

/** Escritas da lista paradas esperando rede. */
export function countPausedListWrites(mutations: MutationSnapshot[]): number {
  return mutations.filter((m) => m.isPaused && isListWriteKey(m.mutationKey)).length;
}

export type QuantityParse = { ok: true; value: number | null } | { ok: false; error: string };

/** Quantidade desejada (opcional na lista) ou comprada (`required`): aceita vírgula, > 0, até o máximo. */
export function parseEntryQuantity(input: string, required = false): QuantityParse {
  if (input.trim() === "") return required ? { ok: false, error: cari.quantityInvalid } : { ok: true, value: null };
  const parsed = parseQuantity(input);
  if (parsed === null || parsed <= 0) return { ok: false, error: cari.quantityInvalid };
  const value = Math.round(parsed * 1000) / 1000;
  if (value > MAX_QUANTITY) return { ok: false, error: cari.quantityTooLarge };
  if (value <= 0) return { ok: false, error: cari.quantityInvalid };
  return { ok: true, value };
}

/** Número para pré-preencher um campo editável (vírgula decimal, sem separador de milhar). */
export function toQuantityInput(n: number): string {
  return String(n).replace(".", ",");
}
