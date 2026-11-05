"use client";

import { MutationObserver, onlineManager, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cari } from "@/features/cari/messages";
import { itemsKey } from "@/features/inventory/queries";
import { toCariError } from "@/lib/errors";
import { goOffline, isNetworkError, NetworkError, throwIfError } from "@/lib/query/network";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  applyListWrite,
  isListWriteKey,
  listKey,
  listMutationKey,
  patchRemove,
  patchSetChecked,
  patchSetQuantity,
  patchUpsert,
  type Entry,
  type ListOp,
  type ListWriteVars,
  type RemoveEntryVars,
  type SetCheckedVars,
  type SetEntryQuantityVars,
  type UpsertEntryVars,
} from "./model";

/*
 * Escritas da lista são offline-safe: os defaults ficam registrados no QueryClient (makeQueryClient)
 * antes de o PersistQueryClientProvider hidratar e retomar as mutações pausadas. Por isso
 * mutationFn/onMutate/onError/onSettled não fecham sobre estado de componente: tudo vem de `variables`.
 * Todas compartilham o scope "list": rodam em série, na ordem dos toques, também ao retomar.
 */

export type { EntryInput, RemoveEntryVars, SetCheckedVars, SetEntryQuantityVars, UpsertEntryVars } from "./model";

/** Linha como estava antes da escrita (undefined = não existia no cache). */
type Ctx = { prev: Entry | undefined };

const LIST_SCOPE = { id: "list" };

/** Espera antes de pausar depois de uma falha de rede (o app já foi marcado offline). */
export const NETWORK_RETRY_DELAY_MS = 1_000;

/*
 * Falha de rede (sem resposta HTTP) não é erro da escrita: as escritas são idempotentes, então a
 * mutação tenta de novo sem limite — com o app marcado offline ela pausa, é persistida e volta
 * quando a rede voltar. Erro com resposta (RLS, validação) segue o caminho de sempre: 3 tentativas,
 * rollback e toast.
 */
const LIST_RETRY = {
  retry: (failureCount: number, err: Error) => isNetworkError(err) || failureCount < 3,
  retryDelay: (failureCount: number, err: Error) =>
    isNetworkError(err) ? NETWORK_RETRY_DELAY_MS : Math.min(1000 * 2 ** failureCount, 30_000),
};

/** Roda a escrita; falha de rede marca o app offline antes de o retryer decidir (então ele pausa). */
async function listWrite(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    if (isNetworkError(err)) goOffline();
    throw err;
  }
}

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
    ...LIST_RETRY,
    mutationFn: ({ householdId, entry, userId }) => listWrite(async () => {
      const { checked, added_by, ...fields } = entry;
      const res = await entriesTable().upsert(
        {
          ...fields,
          household_id: householdId,
          added_by: added_by !== undefined ? added_by : (userId ?? null),
          ...(checked !== undefined ? { checked } : {}),
        },
        { onConflict: "id" },
      );
      // Item do estoque que outro aparelho já pôs na lista (índice único em item_id): a entrada existe, ok.
      if (res.error && !(res.error.code === "23505" && entry.item_id)) throwIfError(res);
    }),
    onMutate: (vars) => {
      const now = new Date().toISOString();
      return beginOptimistic(qc, vars.householdId, vars.entry.id, (rows) => patchUpsert(rows, vars, now));
    },
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.entry.id, ctx);
      failToast(qc, "upsert", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });

  qc.setMutationDefaults<void, Error, SetCheckedVars, Ctx>(listMutationKey("setChecked"), {
    scope: LIST_SCOPE,
    ...LIST_RETRY,
    mutationFn: ({ householdId, id, checked, userId }) => listWrite(async () => {
      throwIfError(
        await entriesTable()
          .update({ checked, checked_by: checked ? (userId ?? null) : null })
          .eq("id", id)
          .eq("household_id", householdId),
      );
    }),
    onMutate: (vars) => beginOptimistic(qc, vars.householdId, vars.id, (rows) => patchSetChecked(rows, vars)),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.id, ctx);
      failToast(qc, "setChecked", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });

  qc.setMutationDefaults<void, Error, SetEntryQuantityVars, Ctx>(listMutationKey("setQuantity"), {
    scope: LIST_SCOPE,
    ...LIST_RETRY,
    mutationFn: ({ householdId, id, quantity }) => listWrite(async () => {
      throwIfError(await entriesTable().update({ quantity }).eq("id", id).eq("household_id", householdId));
    }),
    onMutate: (vars) => beginOptimistic(qc, vars.householdId, vars.id, (rows) => patchSetQuantity(rows, vars)),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.id, ctx);
      failToast(qc, "setQuantity", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });

  qc.setMutationDefaults<void, Error, RemoveEntryVars, Ctx>(listMutationKey("remove"), {
    scope: LIST_SCOPE,
    ...LIST_RETRY,
    // Remover o que já foi removido (0 linhas) é sucesso.
    mutationFn: ({ householdId, id }) => listWrite(async () => {
      throwIfError(await entriesTable().delete().eq("id", id).eq("household_id", householdId));
    }),
    onMutate: (vars) => beginOptimistic(qc, vars.householdId, vars.id, (rows) => patchRemove(rows, vars)),
    onError: (err, vars, ctx) => {
      rollback(qc, vars.householdId, vars.id, ctx);
      failToast(qc, "remove", err, vars);
    },
    onSettled: (_d, _e, { householdId }) => settle(qc, householdId),
  });
}

/**
 * Mutações pausadas restauradas do IndexedDB não passam pelo onMutate, e o cache restaurado (ou o
 * initialData do servidor) pode não ter o patch delas. Reaplica, na ordem dos toques, antes de retomar.
 */
export function reapplyPausedListWrites(qc: QueryClient): void {
  const now = new Date().toISOString();
  const paused = qc
    .getMutationCache()
    .getAll()
    .filter((m) => m.state.isPaused && isListWriteKey(m.options.mutationKey))
    .sort((a, b) => a.state.submittedAt - b.state.submittedAt);
  for (const m of paused) {
    const op = m.options.mutationKey![1] as ListOp;
    const vars = m.state.variables as ListWriteVars[ListOp] | undefined;
    if (!vars?.householdId) continue;
    patchList(qc, vars.householdId, (rows) => applyListWrite(op, vars, rows, now));
  }
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

/**
 * Espera a fila da lista esvaziar: finish_shopping exige que as marcações já estejam no banco.
 * Offline (fila pausada) não adianta esperar.
 */
async function waitForListWrites(qc: QueryClient, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (pendingListWrites(qc) > 0 && onlineManager.isOnline() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Corpo do "Guardar no estoque". Com marcações ainda na fila (sem sinal) o RPC nem é chamado: as
 * entradas não estariam marcadas no banco e o `entry_invalid` viraria um falso "já guardaram".
 */
export async function finishShopping(qc: QueryClient, { householdId, entries }: FinishVars): Promise<number> {
  await waitForListWrites(qc);
  if (pendingListWrites(qc) > 0 || !onlineManager.isOnline()) throw new NetworkError("list_pending");
  const res = await getBrowserSupabase().rpc("finish_shopping", {
    p_household_id: householdId,
    p_entries: entries,
  });
  if (res.error && res.status === 0) goOffline();
  throwIfError(res);
  return res.data ?? 0;
}

/** Erro do "Guardar no estoque" → fala da Cari. Falha de rede nunca vira "já guardaram". */
export function finishErrorMessage(err: unknown): string {
  if (isNetworkError(err)) return cari.finishNeedsNetwork;
  return toCariError(err) === "alreadyFinished" ? cari.alreadyFinished : cari.genericError;
}

/**
 * Exige conexão: fora da fila offline (chave fora de "list", networkMode "always" para nunca pausar
 * e ser persistida sem mutationFn registrada). Não é idempotente: sem retry.
 */
export function useFinishShopping() {
  const qc = useQueryClient();
  return useMutation<number, Error, FinishVars>({
    mutationKey: ["finish"],
    networkMode: "always",
    retry: false,
    mutationFn: (vars) => finishShopping(qc, vars),
    onSuccess: (n, { householdId, entries }) => {
      const done = new Set(entries.map((e) => e.entry_id));
      patchList(qc, householdId, (rows) => rows.filter((r) => !done.has(r.id)));
      toast.success(cari.finished(n));
      void qc.invalidateQueries({ queryKey: itemsKey(householdId) });
      void qc.invalidateQueries({ queryKey: listKey(householdId) });
    },
    onError: (err, { householdId }) => {
      toast.error(finishErrorMessage(err));
      if (!isNetworkError(err)) void qc.invalidateQueries({ queryKey: listKey(householdId) });
    },
  });
}
