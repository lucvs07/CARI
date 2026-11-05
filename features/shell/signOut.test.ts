import { beforeEach, expect, test, vi } from "vitest";

const calls: string[] = [];
const mocks = vi.hoisted(() => ({
  authSignOut: vi.fn(),
  clearPersisted: vi.fn(),
  removeClient: vi.fn(),
  cachesDelete: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabase: () => ({ auth: { signOut: mocks.authSignOut } }) }));
vi.mock("@/lib/query/persist", () => ({
  clearPersistedCache: mocks.clearPersisted,
  persister: { removeClient: mocks.removeClient },
}));

import { signOut } from "./UserMenu";

const qc = {
  cancelQueries: vi.fn(async () => void calls.push("cancel")),
  clear: vi.fn(() => void calls.push("clear")),
};
const navigate = vi.fn(() => void calls.push("navigate"));

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  mocks.authSignOut.mockImplementation(async () => void calls.push("auth"));
  mocks.clearPersisted.mockImplementation(async () => void calls.push("persisted"));
  mocks.removeClient.mockImplementation(async () => void calls.push("removeClient"));
  mocks.cachesDelete.mockImplementation(async () => void calls.push("caches"));
  Object.defineProperty(window, "caches", { value: { delete: mocks.cachesDelete }, configurable: true });
});

test("ordem: auth, cancel, clear, persistência, caches, clear, navegar", async () => {
  await signOut({ queryClient: qc, navigate });
  expect(calls).toEqual(["auth", "cancel", "clear", "removeClient", "persisted", "caches", "clear", "navigate"]);
});

test("apaga o cache da Lista e esquece a última casa", async () => {
  localStorage.setItem("cari-last-household", "h1");
  await signOut({ queryClient: qc, navigate });
  expect(mocks.cachesDelete).toHaveBeenCalledWith("cari-lista");
  expect(localStorage.getItem("cari-last-household")).toBeNull();
});

test("navega e desloga mesmo se clearPersistedCache falhar", async () => {
  mocks.clearPersisted.mockRejectedValue(new Error("idb"));
  await signOut({ queryClient: qc, navigate });
  expect(mocks.authSignOut).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledOnce();
  expect(qc.clear).toHaveBeenCalledTimes(2);
});

test("segue limpando e navega se auth.signOut falhar", async () => {
  mocks.authSignOut.mockRejectedValue(new Error("net"));
  await signOut({ queryClient: qc, navigate });
  expect(mocks.clearPersisted).toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledOnce();
});

test("offline: signOut pendurado não trava o Sair (prazo de 3 s), limpa e navega", async () => {
  vi.useFakeTimers();
  try {
    mocks.authSignOut.mockImplementation(() => new Promise(() => {}));
    const done = signOut({ queryClient: qc, navigate });
    await vi.advanceTimersByTimeAsync(3_000);
    await done;
    expect(mocks.clearPersisted).toHaveBeenCalled();
    expect(mocks.cachesDelete).toHaveBeenCalledWith("cari-lista");
    expect(navigate).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

test("cada passo da limpeza é independente: cancelQueries falhar não impede o resto", async () => {
  qc.cancelQueries.mockRejectedValueOnce(new Error("boom"));
  mocks.removeClient.mockRejectedValueOnce(new Error("idb"));
  localStorage.setItem("cari-last-household", "h1");
  await signOut({ queryClient: qc, navigate });
  expect(qc.clear).toHaveBeenCalledTimes(2);
  expect(mocks.clearPersisted).toHaveBeenCalled();
  expect(mocks.cachesDelete).toHaveBeenCalledWith("cari-lista");
  expect(localStorage.getItem("cari-last-household")).toBeNull();
  expect(navigate).toHaveBeenCalledOnce();
});
