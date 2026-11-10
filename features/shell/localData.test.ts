import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearPersisted: vi.fn(async () => {}),
  removeClient: vi.fn(async () => {}),
  cachesDelete: vi.fn(async () => true),
}));

vi.mock("@/lib/query/persist", () => ({
  clearPersistedCache: mocks.clearPersisted,
  persister: { removeClient: mocks.removeClient },
}));

import { claimLocalData, USER_KEY } from "./localData";

const qc = { cancelQueries: vi.fn(async () => {}), clear: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(window, "caches", { value: { delete: mocks.cachesDelete }, configurable: true });
});

test("primeira vez (sem dono gravado): só marca o usuário, não apaga nada", async () => {
  expect(await claimLocalData(qc, "lucas")).toBe(false);
  expect(localStorage.getItem(USER_KEY)).toBe("lucas");
  expect(qc.clear).not.toHaveBeenCalled();
  expect(mocks.removeClient).not.toHaveBeenCalled();
});

test("mesmo usuário: mantém cache e fila", async () => {
  localStorage.setItem(USER_KEY, "lucas");
  localStorage.setItem("cari-last-household", "h1");
  expect(await claimLocalData(qc, "lucas")).toBe(false);
  expect(qc.clear).not.toHaveBeenCalled();
  expect(localStorage.getItem("cari-last-household")).toBe("h1");
});

test("outra conta no mesmo aparelho: apaga queries, fila persistida, Lista do SW e última casa; marca o novo dono", async () => {
  localStorage.setItem(USER_KEY, "lucas");
  localStorage.setItem("cari-last-household", "h1");
  expect(await claimLocalData(qc, "ana")).toBe(true);
  expect(qc.cancelQueries).toHaveBeenCalled();
  expect(qc.clear).toHaveBeenCalled();
  expect(mocks.removeClient).toHaveBeenCalled();
  expect(mocks.clearPersisted).toHaveBeenCalled();
  expect(mocks.cachesDelete).toHaveBeenCalledWith("cari-lista");
  expect(localStorage.getItem("cari-last-household")).toBeNull();
  expect(localStorage.getItem(USER_KEY)).toBe("ana");
});

test("limpeza que falha num passo segue nos outros e ainda marca o novo dono", async () => {
  localStorage.setItem(USER_KEY, "lucas");
  mocks.removeClient.mockRejectedValueOnce(new Error("idb"));
  expect(await claimLocalData(qc, "ana")).toBe(true);
  expect(mocks.clearPersisted).toHaveBeenCalled();
  expect(localStorage.getItem(USER_KEY)).toBe("ana");
});
