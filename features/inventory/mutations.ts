"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cari } from "@/features/cari/messages";
import { toCariError } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Category } from "@/lib/categories";
import type { Unit } from "@/lib/units";
import { itemsKey } from "./queries";
import { MAX_QUANTITY, normalizeName, type Item } from "./schema";

// Estoque é online-only: sem setMutationDefaults, sem retry automático.
const MUTATION_KEY = ["items", "write"] as const;

type Cache = { prev: Item[] | undefined };

async function beginOptimistic(qc: QueryClient, householdId: string, fn: (rows: Item[]) => Item[]): Promise<Cache> {
  await qc.cancelQueries({ queryKey: itemsKey(householdId) });
  const prev = qc.getQueryData<Item[]>(itemsKey(householdId));
  patchItems(qc, householdId, fn);
  return { prev };
}

function patchItems(qc: QueryClient, householdId: string, fn: (rows: Item[]) => Item[]) {
  qc.setQueryData<Item[]>(itemsKey(householdId), (rows) => (rows ? fn(rows) : rows));
}

function rollback(qc: QueryClient, householdId: string, ctx: Cache | undefined) {
  if (ctx?.prev) qc.setQueryData(itemsKey(householdId), ctx.prev);
}

/** Só a última mutação em voo invalida: evita sobrescrever o estado otimista das anteriores. */
function settle(qc: QueryClient, householdId: string) {
  if (qc.isMutating({ mutationKey: MUTATION_KEY }) <= 1) {
    void qc.invalidateQueries({ queryKey: itemsKey(householdId) });
  }
}

function errorText(err: unknown, name = ""): string {
  const key = toCariError(err);
  return key === "duplicateItem" ? cari.duplicateItem(name) : cari[key];
}

function failToast(err: unknown, retry: () => void, name?: string) {
  toast.error(errorText(err, name), { action: { label: "Tentar de novo", onClick: retry } });
}

async function currentUserId(): Promise<string | null> {
  const { data } = await getBrowserSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

function sortedInvalidateBoth(qc: QueryClient, householdId: string) {
  void qc.invalidateQueries({ queryKey: itemsKey(householdId) });
  void qc.invalidateQueries({ queryKey: ["list", householdId] });
}

export function useSetItemQuantity() {
  const qc = useQueryClient();
  type Vars = { householdId: string; id: string; quantity: number };
  const m = useMutation<void, Error, Vars, Cache>({
    mutationKey: MUTATION_KEY,
    retry: false,
    mutationFn: async ({ householdId, id, quantity }) => {
      const { error } = await getBrowserSupabase()
        .from("items")
        .update({ quantity, updated_by: await currentUserId() })
        .eq("id", id)
        .eq("household_id", householdId);
      if (error) throw error;
    },
    onMutate: ({ householdId, id, quantity }) =>
      beginOptimistic(qc, householdId, (rows) => rows.map((r) => (r.id === id ? { ...r, quantity } : r))),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, ctx);
      failToast(err, () => m.mutate(vars));
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });
  return m;
}

export function useMarkEmpty() {
  const qc = useQueryClient();
  type Vars = { householdId: string; item: Item };
  type Result = { hadEntry: boolean };
  const m = useMutation<Result, Error, Vars, Cache>({
    mutationKey: MUTATION_KEY,
    retry: false,
    mutationFn: async ({ householdId, item }) => {
      const supabase = getBrowserSupabase();
      const userId = await currentUserId();
      // O cache ['list'] costuma estar vazio aqui: a verdade está no banco.
      const { data: entries, error: selectError } = await supabase
        .from("shopping_list_entries")
        .select("id")
        .eq("item_id", item.id)
        .eq("household_id", householdId)
        .limit(1);
      if (selectError) throw selectError;
      const hadEntry = entries.length > 0;

      const { error } = await supabase
        .from("items")
        .update({ quantity: 0, updated_by: userId })
        .eq("id", item.id)
        .eq("household_id", householdId);
      if (error) throw error;

      // O trigger só dispara em quantidade > 0 → 0; item que já estava em 0 precisa da entrada explícita.
      if (!hadEntry && item.quantity === 0) {
        const { error: insertError } = await supabase.from("shopping_list_entries").insert({
          household_id: householdId,
          item_id: item.id,
          name: item.name,
          quantity: null,
          unit: item.unit,
          category: item.category,
          added_by: userId,
        });
        if (insertError) throw insertError;
      }
      return { hadEntry };
    },
    onMutate: ({ householdId, item }) =>
      beginOptimistic(qc, householdId, (rows) => rows.map((r) => (r.id === item.id ? { ...r, quantity: 0 } : r))),
    onSuccess: ({ hadEntry }, { householdId, item }) => {
      toast(cari.movedToList(item.name), {
        action: {
          label: "Desfazer",
          onClick: () => void undoMarkEmpty(qc, householdId, item, hadEntry),
        },
      });
      void qc.invalidateQueries({ queryKey: ["list", householdId] });
    },
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, ctx);
      failToast(err, () => m.mutate(vars));
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });
  return m;
}

async function undoMarkEmpty(qc: QueryClient, householdId: string, item: Item, hadEntry: boolean) {
  const supabase = getBrowserSupabase();
  patchItems(qc, householdId, (rows) => rows.map((r) => (r.id === item.id ? { ...r, quantity: item.quantity } : r)));
  try {
    const { error } = await supabase
      .from("items")
      .update({ quantity: item.quantity, updated_by: await currentUserId() })
      .eq("id", item.id)
      .eq("household_id", householdId);
    if (error) throw error;
    // Só apaga a entrada se ela foi criada por esta ação; o id da criada pelo trigger não é conhecido aqui.
    if (!hadEntry) {
      const { error: deleteError } = await supabase
        .from("shopping_list_entries")
        .delete()
        .eq("item_id", item.id)
        .eq("household_id", householdId);
      if (deleteError) throw deleteError;
    }
  } catch (err) {
    toast.error(errorText(err));
  } finally {
    sortedInvalidateBoth(qc, householdId);
  }
}

/** Colunas graváveis de uma linha (name_key é gerada pelo banco). */
function toInsertRow(item: Item) {
  return {
    id: item.id,
    household_id: item.household_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    updated_by: item.updated_by,
    created_at: item.created_at,
  };
}

export function useRemoveItem() {
  const qc = useQueryClient();
  type Vars = { householdId: string; item: Item };
  const m = useMutation<void, Error, Vars, Cache>({
    mutationKey: MUTATION_KEY,
    retry: false,
    mutationFn: async ({ householdId, item }) => {
      const { error } = await getBrowserSupabase()
        .from("items")
        .delete()
        .eq("id", item.id)
        .eq("household_id", householdId);
      if (error) throw error;
    },
    onMutate: ({ householdId, item }) => beginOptimistic(qc, householdId, (rows) => rows.filter((r) => r.id !== item.id)),
    onSuccess: (_d, { householdId, item }) => {
      toast(cari.removed, {
        action: { label: "Desfazer", onClick: () => void undoRemove(qc, householdId, item) },
      });
    },
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, ctx);
      failToast(err, () => m.mutate(vars));
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });
  return m;
}

async function undoRemove(qc: QueryClient, householdId: string, item: Item) {
  patchItems(qc, householdId, (rows) => (rows.some((r) => r.id === item.id) ? rows : [...rows, item]));
  try {
    const { error } = await getBrowserSupabase().from("items").upsert(toInsertRow(item), { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    toast.error(errorText(err, item.name));
  } finally {
    void qc.invalidateQueries({ queryKey: itemsKey(householdId) });
  }
}

export type UpsertVars = {
  householdId: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  existingId?: string;
  /** Id do novo item, gerado por quem chama: o cache otimista, o insert e o Realtime concordam, e o retry é idempotente. */
  id?: string;
};

/** Duplicata (23505) não gera toast: o QuickAdd pergunta se soma. */
export function useUpsertItem() {
  const qc = useQueryClient();
  const m = useMutation<void, Error, UpsertVars, Cache>({
    mutationKey: MUTATION_KEY,
    retry: false,
    mutationFn: async ({ householdId, name, quantity, unit, category, existingId, id }) => {
      const supabase = getBrowserSupabase();
      const userId = await currentUserId();
      if (existingId) {
        const { data, error } = await supabase
          .from("items")
          .select("quantity")
          .eq("id", existingId)
          .eq("household_id", householdId)
          .single();
        if (error) throw error;
        const total = Math.min(MAX_QUANTITY, Math.round((data.quantity + quantity) * 1000) / 1000);
        const { error: updateError } = await supabase
          .from("items")
          .update({ quantity: total, updated_by: userId })
          .eq("id", existingId)
          .eq("household_id", householdId);
        if (updateError) throw updateError;
        return;
      }
      const { error } = await supabase.from("items").insert({
        id: id ?? crypto.randomUUID(),
        household_id: householdId,
        name,
        quantity,
        unit,
        category,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onMutate: ({ householdId, name, quantity, unit, category, existingId, id }) =>
      beginOptimistic(qc, householdId, (rows) => {
        if (existingId) {
          return rows.map((r) =>
            r.id === existingId ? { ...r, quantity: Math.min(MAX_QUANTITY, Math.round((r.quantity + quantity) * 1000) / 1000) } : r,
          );
        }
        const now = new Date().toISOString();
        const optimistic: Item = {
          id: id ?? crypto.randomUUID(),
          household_id: householdId,
          name,
          name_key: normalizeName(name),
          quantity,
          unit,
          category,
          updated_by: null,
          created_at: now,
          updated_at: now,
        };
        return [...rows, optimistic];
      }),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, ctx);
      if (toCariError(err) !== "duplicateItem") failToast(err, () => m.mutate(vars), vars.name);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });
  return m;
}

export type UpdateVars = {
  householdId: string;
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
};

export function useUpdateItem() {
  const qc = useQueryClient();
  const m = useMutation<void, Error, UpdateVars, Cache>({
    mutationKey: MUTATION_KEY,
    retry: false,
    mutationFn: async ({ householdId, id, name, quantity, unit, category }) => {
      const { error } = await getBrowserSupabase()
        .from("items")
        .update({ name, quantity, unit, category, updated_by: await currentUserId() })
        .eq("id", id)
        .eq("household_id", householdId);
      if (error) throw error;
    },
    onMutate: ({ householdId, id, name, quantity, unit, category }) =>
      beginOptimistic(qc, householdId, (rows) =>
        rows.map((r) => (r.id === id ? { ...r, name, name_key: normalizeName(name), quantity, unit, category } : r)),
      ),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, ctx);
      failToast(err, () => m.mutate(vars), vars.name);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });
  return m;
}
