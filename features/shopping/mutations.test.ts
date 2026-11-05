import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { dehydrate, hydrate, MutationObserver, onlineManager, QueryClient } from "@tanstack/react-query";

// getSession que nunca resolve: simula o refresh do token travado sem rede.
const hang = () => new Promise<never>(() => {});
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ auth: { getSession: hang, getUser: hang } }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { reapplyPausedListWrites, registerListMutationDefaults } from "./mutations";
import { listKey, listMutationKey, type Entry } from "./model";

const H = "h1";

function row(id: string, checked = false): Entry {
  return {
    id,
    household_id: H,
    item_id: null,
    name: id,
    quantity: null,
    unit: "un",
    category: "mercearia",
    checked,
    checked_by: null,
    added_by: null,
    created_at: "",
    updated_at: "",
  };
}

let qc: QueryClient;

beforeEach(() => {
  onlineManager.setOnline(false);
  qc = new QueryClient();
  registerListMutationDefaults(qc);
  qc.setQueryData(listKey(H), [row("azeite")]);
});

afterEach(() => {
  qc.clear();
  onlineManager.setOnline(true);
});

const flush = () => new Promise((r) => setTimeout(r, 0));
const cached = () => qc.getQueryData<Entry[]>(listKey(H))!;

function mutate(op: Parameters<typeof listMutationKey>[0], vars: unknown) {
  void new MutationObserver<void, Error, unknown>(qc, { mutationKey: listMutationKey(op) }).mutate(vars).catch(() => {});
}

test("setChecked: patch otimista e pausa sem depender da sessão", async () => {
  mutate("setChecked", { householdId: H, id: "azeite", checked: true, userId: "u1" });
  await flush();
  expect(cached()[0]).toMatchObject({ checked: true, checked_by: "u1" });
  const [m] = qc.getMutationCache().getAll();
  expect(m.state.isPaused).toBe(true);
  expect(m.state.context).toBeDefined();
});

test("upsert: entrada nova aparece na hora com added_by de variables", async () => {
  mutate("upsert", {
    householdId: H,
    userId: "u1",
    entry: { id: "pilhas", name: "Pilhas", unit: "un", category: "outros", quantity: 4, item_id: null },
  });
  await flush();
  expect(cached().find((r) => r.id === "pilhas")).toMatchObject({ added_by: "u1", checked: false });
});

test("variables antigas sem userId (persistidas antes) caem para null", async () => {
  mutate("setChecked", { householdId: H, id: "azeite", checked: true });
  await flush();
  expect(cached()[0]).toMatchObject({ checked: true, checked_by: null });
});

test("reabrir: mutações pausadas restauradas reaplicam o patch sobre o cache, na ordem dos toques", async () => {
  mutate("setChecked", { householdId: H, id: "azeite", checked: true, userId: "u1" });
  await flush();
  mutate("setChecked", { householdId: H, id: "azeite", checked: false, userId: "u1" });
  await flush();
  mutate("setQuantity", { householdId: H, id: "azeite", quantity: 2 });
  await flush();
  const persisted = dehydrate(qc);

  // App reaberto: o servidor (ou o HTML em cache) trouxe a lista sem as marcações da fila.
  const reopened = new QueryClient();
  registerListMutationDefaults(reopened);
  reopened.setQueryData(listKey(H), [{ ...row("azeite"), quantity: null }]);
  hydrate(reopened, { mutations: persisted.mutations, queries: [] });
  expect(reopened.getMutationCache().getAll()).toHaveLength(3);

  reapplyPausedListWrites(reopened);
  expect(reopened.getQueryData<Entry[]>(listKey(H))![0]).toMatchObject({ checked: false, checked_by: null, quantity: 2 });
  reopened.clear();
});
