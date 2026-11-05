import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MutationObserver, onlineManager, QueryClient } from "@tanstack/react-query";

type Result = { error: { message: string; code?: string } | null; status: number; data?: unknown };

const net = vi.hoisted(() => ({
  next: [] as Result[],
  calls: 0,
  rpcCalls: 0,
}));

function respond(): Promise<Result> {
  net.calls++;
  return Promise.resolve(net.next.length > 1 ? net.next.shift()! : net.next[0]);
}

// Encadeamento mínimo do postgrest-js: update/delete/upsert → eq → eq (thenable).
function chain(): unknown {
  const c = {
    eq: () => c,
    then: (ok: (r: Result) => unknown, ko: (e: unknown) => unknown) => respond().then(ok, ko),
  };
  return c;
}

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({
    from: () => ({ update: chain, delete: chain, upsert: chain }),
    rpc: () => {
      net.rpcCalls++;
      return respond();
    },
  }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { toast } from "sonner";
import { cari } from "@/features/cari/messages";
import { _resetNetworkForTests, NetworkError } from "@/lib/query/network";
import { finishErrorMessage, finishShopping, registerListMutationDefaults } from "./mutations";
import { listKey, listMutationKey, type Entry } from "./model";

const H = "h1";
const NETWORK: Result = { error: { message: "TypeError: Failed to fetch", code: "" }, status: 0 };
const TIMEOUT: Result = { error: { message: "TimeoutError: signal timed out", code: "" }, status: 0 };
const RLS: Result = { error: { message: "permission denied", code: "42501" }, status: 403 };
const OK: Result = { error: null, status: 204 };

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
  vi.useFakeTimers();
  net.next = [OK];
  net.calls = 0;
  net.rpcCalls = 0;
  vi.mocked(toast.error).mockClear();
  onlineManager.setOnline(true);
  qc = new QueryClient();
  qc.mount();
  registerListMutationDefaults(qc);
  qc.setQueryData(listKey(H), [row("arroz")]);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

afterEach(() => {
  qc.clear();
  qc.unmount();
  _resetNetworkForTests();
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const cached = () => qc.getQueryData<Entry[]>(listKey(H))!;
const only = () => qc.getMutationCache().getAll()[0];

function tap() {
  void new MutationObserver<void, Error, unknown>(qc, { mutationKey: listMutationKey("setChecked") })
    .mutate({ householdId: H, id: "arroz", checked: true, userId: "u1" })
    .catch(() => {});
}

test.each([
  ["fetch rejeitado", NETWORK],
  ["timeout", TIMEOUT],
])("online com falha de rede (%s): sem rollback, app offline e a escrita pausa na fila", async (_, failure) => {
  net.next = [failure];
  tap();
  await vi.advanceTimersByTimeAsync(5_000 - 1);
  expect(cached()[0].checked).toBe(true);
  expect(onlineManager.isOnline()).toBe(false);
  expect(only().state).toMatchObject({ status: "pending", isPaused: true });
  expect(toast.error).not.toHaveBeenCalled();
});

test("a sonda devolve o online e a escrita pausada sincroniza sem toque do usuário", async () => {
  net.next = [NETWORK, OK];
  tap();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(only().state.isPaused).toBe(true);
  expect(fetch).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(5_000);
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/v1\/health$/), expect.anything());
  expect(onlineManager.isOnline()).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(only().state.status).toBe("success");
  expect(net.calls).toBe(2);
  expect(cached()[0].checked).toBe(true);
});

test("sonda que falha mantém offline e tenta de novo no próximo intervalo", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
  net.next = [NETWORK];
  tap();
  await vi.advanceTimersByTimeAsync(11_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(onlineManager.isOnline()).toBe(false);
  expect(only().state.isPaused).toBe(true);
});

test("erro do servidor (com código) mantém o rollback e o toast", async () => {
  net.next = [RLS];
  tap();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(net.calls).toBe(4);
  expect(cached()[0].checked).toBe(false);
  expect(onlineManager.isOnline()).toBe(true);
  expect(toast.error).toHaveBeenCalledWith(cari.genericError, expect.anything());
});

test("finalizar com marcação ainda na fila: não chama o RPC e não vira 'já guardaram'", async () => {
  net.next = [NETWORK];
  tap();
  await vi.advanceTimersByTimeAsync(2_000);
  const err = await finishShopping(qc, { householdId: H, entries: [{ entry_id: "arroz", quantity: 1 }] }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(NetworkError);
  expect(net.rpcCalls).toBe(0);
  expect(finishErrorMessage(err)).toBe(cari.finishNeedsNetwork);
});

test("finalizar: timeout do RPC vira falta de rede, entry_invalid vira 'já guardaram'", async () => {
  net.next = [TIMEOUT];
  const timeout = await finishShopping(qc, { householdId: H, entries: [] }).catch((e: unknown) => e);
  expect(finishErrorMessage(timeout)).toBe(cari.finishNeedsNetwork);
  expect(onlineManager.isOnline()).toBe(false);

  onlineManager.setOnline(true);
  net.next = [{ error: { message: "entry_invalid", code: "P0001" }, status: 400 }];
  const invalid = await finishShopping(qc, { householdId: H, entries: [] }).catch((e: unknown) => e);
  expect(finishErrorMessage(invalid)).toBe(cari.alreadyFinished);
});
