"use client";

import { MutationObserver, onlineManager, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cari } from "@/features/cari/messages";
import { itemsKey } from "@/features/inventory/queries";
import { toCariError } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Unit } from "@/lib/units";
import { isListWriteKey, listKey, listMutationKey, type Entry, type ListOp } from "./model";

/*
 * Escritas da lista são offline-safe: os defaults ficam registrados no QueryClient (makeQueryClient)
 * antes de o PersistQueryClientProvider hidratar e retomar as mutações pausadas. Por isso
 * mutationFn/onMutate/onError/onSettled não fecham sobre estado de componente: tudo vem de `variables`.
 * Todas compartilham o scope "list": rodam em série, na ordem dos toques, também ao retomar.
 */

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

/** Linha como estava antes da escrita (undefined = não existia no cache). */
type Ctx = { prev: Entry | undefined };

const LIST_SCOPE = { id: "list" };

function patchList(qc: QueryClient, householdId: string, fn: (rows: Entry[]) => Entry[]) {
  qc.setQueryData<Entry[]>(listKey(householdId), (rows) => (rows ? fn(rows) : rows));
}

async function beginOptimistic(
  qc: QueryClient,
  householdId: string,
  id: string,
  fn: (rows: Entry[]) => Entry[],
): Promise<Ctx> {
  await qc.cancelQueries({ queryKey: listKey(householdId) });
  const prev = qc.getQueryData<Entry[]>(listKey(householdId))?.find((r) => r.id === id);
  patchList(qc, householdId, fn);
  return { prev };
}

/** Reverte só a linha afetada: as outras escritas otimistas em fila continuam valendo. */
function rollback(qc: QueryClient, householdId: string, id: string, ctx: Ctx | undefined) {
  patchList(qc, householdId, (rows) => {
    const without = rows.filter((r) => r.id !== id);
    if (!ctx?.prev) return without;
    return rows.some((r) => r.id === id) ? rows.map((r) => (r.id === id ? ctx.prev! : r)) : [...without, ctx.prev];
  });
}

function pendingListWrites(qc: QueryClient): number {
  return qc
    .getMutationCache()
    .getAll()
    .filter((m) => m.state.status === "pending" && isListWriteKey(m.options.mutationKey)).length;
}

/**
 * Só a última escrita da fila invalida (evita sobrescrever o otimista das que ainda vão rodar).
 * Offline não invalida: a reconciliação acontece quando a fila esvazia.
 */
function settle(qc: QueryClient, householdId: string) {
  if (!onlineManager.isOnline()) return;
  if (pendingListWrites(qc) <= 1) void qc.invalidateQueries({ queryKey: listKey(householdId) });
}

function failToast<V>(qc: QueryClient, op: ListOp, err: unknown, vars: V) {
  const key = toCariError(err);
  toast.error(key === "duplicateItem" ? cari.genericError : cari[key], {
    action: {
      label: "Tentar de novo",
      onClick: () => {
        void new MutationObserver<void, Error, V, Ctx>(qc, { mutationKey: listMutationKey(op) }).mutate(vars).catch(() => {});
      },
    },
  });
}

function entriesTable() {
  return getBrowserSupabase().from("shopping_list_entries");
}

export function registerListMutationDefaults(qc: QueryClient): void {
  qc.setMutationDefaults<void, Error, UpsertEntryVars, Ctx>(listMutationKey("upsert"), {
    scope: LIST_SCOPE,
    mutationFn: async ({ householdId, entry, userId }) => {
      const { checked, added_by, ...fields } = entry;
      const { error } = await entriesTable().upsert(
        {
          ...fields,
          household_id: householdId,
          added_by: added_by !== undefined ? added_by : (userId ?? null),
          ...(checked !== undefined ? { checked } : {}),
        },
        { onConflict: "id" },
      );
      // Item do estoque que outro aparelho já pôs na lista (índice único em item_id): a entrada existe, ok.
      if (error && !(error.code === "23505" && entry.item_id)) throw error;
    },
    onMutate: ({ householdId, entry, userId }) => {
      const { checked, added_by, ...fields } = entry;
      const addedBy = added_by !== undefined ? added_by : (userId ?? null);
      const now = new Date().toISOString();
      return beginOptimistic(qc, householdId, entry.id, (rows) => {
        const existing = rows.find((r) => r.id === entry.id);
        if (existing) return rows.map((r) => (r.id === entry.id ? { ...r, ...fields, ...(checked !== undefined ? { checked } : {}) } : r));
        const row: Entry = {
          ...fields,
          household_id: householdId,
          checked: checked ?? false,
          checked_by: null,
          added_by: addedBy,
          created_at: now,
          updated_at: now,
        };
        return [...rows, row];
      });
    },
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.entry.id, ctx);
      failToast(qc, "upsert", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });

  qc.setMutationDefaults<void, Error, SetCheckedVars, Ctx>(listMutationKey("setChecked"), {
    scope: LIST_SCOPE,
    mutationFn: async ({ householdId, id, checked, userId }) => {
      const { error } = await entriesTable()
        .update({ checked, checked_by: checked ? (userId ?? null) : null })
        .eq("id", id)
        .eq("household_id", householdId);
      if (error) throw error;
    },
    onMutate: ({ householdId, id, checked, userId }) =>
      beginOptimistic(qc, householdId, id, (rows) =>
        rows.map((r) => (r.id === id ? { ...r, checked, checked_by: checked ? (userId ?? null) : null } : r)),
      ),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.id, ctx);
      failToast(qc, "setChecked", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });

  qc.setMutationDefaults<void, Error, SetEntryQuantityVars, Ctx>(listMutationKey("setQuantity"), {
    scope: LIST_SCOPE,
    mutationFn: async ({ householdId, id, quantity }) => {
      const { error } = await entriesTable().update({ quantity }).eq("id", id).eq("household_id", householdId);
      if (error) throw error;
    },
    onMutate: ({ householdId, id, quantity }) =>
      beginOptimistic(qc, householdId, id, (rows) => rows.map((r) => (r.id === id ? { ...r, quantity } : r))),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.id, ctx);
      failToast(qc, "setQuantity", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });

  qc.setMutationDefaults<void, Error, RemoveEntryVars, Ctx>(listMutationKey("remove"), {
    scope: LIST_SCOPE,
    // Remover o que já foi removido (0 linhas) é sucesso.
    mutationFn: async ({ householdId, id }) => {
      const { error } = await entriesTable().delete().eq("id", id).eq("household_id", householdId);
      if (error) throw error;
    },
    onMutate: ({ householdId, id }) => beginOptimistic(qc, householdId, id, (rows) => rows.filter((r) => r.id !== id)),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.id, ctx);
      failToast(qc, "remove", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });
}

export function useUpsertEntry() {
  return useMutation<void, Error, UpsertEntryVars, Ctx>({ mutationKey: listMutationKey("upsert") });
}

export function useSetChecked() {
  return useMutation<void, Error, SetCheckedVars, Ctx>({ mutationKey: listMutationKey("setChecked") });
}

export function useSetEntryQuantity() {
  return useMutation<void, Error, SetEntryQuantityVars, Ctx>({ mutationKey: listMutationKey("setQuantity") });
}

export function useRemoveEntry() {
  return useMutation<void, Error, RemoveEntryVars, Ctx>({ mutationKey: listMutationKey("remove") });
}

export type FinishVars = { householdId: string; entries: { entry_id: string; quantity: number }[] };

/** Espera a fila da lista esvaziar: finish_shopping exige que as marcações já estejam no banco. */
async function waitForListWrites(qc: QueryClient, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (pendingListWrites(qc) > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Exige conexão: fora da fila offline (chave fora de "list", networkMode "always" para nunca pausar
 * e ser persistida sem mutationFn registrada).
 */
export function useFinishShopping() {
  const qc = useQueryClient();
  return useMutation<number, Error, FinishVars>({
    mutationKey: ["finish"],
    networkMode: "always",
    retry: false,
    mutationFn: async ({ householdId, entries }) => {
      await waitForListWrites(qc);
      const { data, error } = await getBrowserSupabase().rpc("finish_shopping", {
        p_household_id: householdId,
        p_entries: entries,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (n, { householdId, entries }) => {
      const done = new Set(entries.map((e) => e.entry_id));
      patchList(qc, householdId, (rows) => rows.filter((r) => !done.has(r.id)));
      toast.success(cari.finished(n));
      void qc.invalidateQueries({ queryKey: itemsKey(householdId) });
      void qc.invalidateQueries({ queryKey: listKey(householdId) });
    },
    onError: (err, { householdId }) => {
      const key = toCariError(err);
      if (key === "alreadyFinished") toast.error(cari.alreadyFinished);
      else toast.error(cari.genericError);
      void qc.invalidateQueries({ queryKey: listKey(householdId) });
    },
  });
}
