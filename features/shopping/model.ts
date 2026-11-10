import { cari } from "@/features/cari/messages";
import { MAX_QUANTITY } from "@/features/inventory/schema";
import { CATEGORIES, type Category } from "@/lib/categories";
import type { Database } from "@/lib/supabase/database.types";
import { parseQuantity, type Unit } from "@/lib/units";

export type Entry = Database["public"]["Tables"]["shopping_list_entries"]["Row"];

export const listKey = (householdId: string) => ["list", householdId] as const;

/** Escritas da lista que vão para a fila offline (setMutationDefaults). */
export const LIST_OPS = ["upsert", "setChecked", "setQuantity", "remove"] as const;
export type ListOp = (typeof LIST_OPS)[number];
export const listMutationKey = (op: ListOp) => ["list", op] as const;

export function isListWriteKey(key: readonly unknown[] | undefined): boolean {
  return key?.[0] === "list" && (LIST_OPS as readonly unknown[]).includes(key?.[1]);
}

export type EntryInput = {
  id: string;
  name: string;
  unit: Unit;
  category: string;
  quantity: number | null;
  item_id: string | null;
  /** Só no Desfazer do remover: restaura a linha como estava. */
  checked?: boolean;
  added_by?: string | null;
};

/**
 * `userId` vem de quem chama (sessão conhecida no toque, via useCurrentUserId): nenhuma chamada de
 * auth no onMutate/mutationFn — offline com token vencendo, getSession segura o lock por ~30 s.
 * Mutações persistidas antes deste campo existir não o têm: cai para null.
 */
export type UpsertEntryVars = { householdId: string; entry: EntryInput; userId?: string | null };
export type SetCheckedVars = { householdId: string; id: string; checked: boolean; userId?: string | null };
export type SetEntryQuantityVars = { householdId: string; id: string; quantity: number | null };
export type RemoveEntryVars = { householdId: string; id: string };

export type ListWriteVars = {
  upsert: UpsertEntryVars;
  setChecked: SetCheckedVars;
  setQuantity: SetEntryQuantityVars;
  remove: RemoveEntryVars;
};

/*
 * Patches otimistas da lista: funções puras e idempotentes. O onMutate dos defaults usa estas e,
 * ao reabrir o app, as mesmas são reaplicadas às mutações pausadas restauradas do IndexedDB
 * (restauradas não passam pelo onMutate).
 */
export function patchUpsert(rows: Entry[], { householdId, entry, userId }: UpsertEntryVars, now: string): Entry[] {
  const { checked, added_by, ...fields } = entry;
  if (rows.some((r) => r.id === entry.id)) {
    return rows.map((r) => (r.id === entry.id ? { ...r, ...fields, ...(checked !== undefined ? { checked } : {}) } : r));
  }
  const row: Entry = {
    ...fields,
    household_id: householdId,
    checked: checked ?? false,
    checked_by: null,
    added_by: added_by !== undefined ? added_by : (userId ?? null),
    created_at: now,
    updated_at: now,
  };
  return [...rows, row];
}

export function patchSetChecked(rows: Entry[], { id, checked, userId }: SetCheckedVars): Entry[] {
  return rows.map((r) => (r.id === id ? { ...r, checked, checked_by: checked ? (userId ?? null) : null } : r));
}

export function patchSetQuantity(rows: Entry[], { id, quantity }: SetEntryQuantityVars): Entry[] {
  return rows.map((r) => (r.id === id ? { ...r, quantity } : r));
}

export function patchRemove(rows: Entry[], { id }: RemoveEntryVars): Entry[] {
  return rows.filter((r) => r.id !== id);
}

/** Aplica a escrita `op` com estas `variables` às linhas (despacho usado na reaplicação). */
export function applyListWrite<O extends ListOp>(op: O, vars: ListWriteVars[O], rows: Entry[], now: string): Entry[] {
  switch (op) {
    case "upsert":
      return patchUpsert(rows, vars as UpsertEntryVars, now);
    case "setChecked":
      return patchSetChecked(rows, vars as SetCheckedVars);
    case "setQuantity":
      return patchSetQuantity(rows, vars as SetEntryQuantityVars);
    case "remove":
      return patchRemove(rows, vars as RemoveEntryVars);
    default:
      return rows;
  }
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
