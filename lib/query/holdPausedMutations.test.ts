import { afterEach, expect, test, vi } from "vitest";
import { dehydrate, focusManager, hydrate, MutationObserver, onlineManager, QueryClient } from "@tanstack/react-query";
import { holdPausedMutations } from "./holdPausedMutations";
import { UserGate } from "./userGate";

const KEY = ["list", "setChecked"] as const;

/** Cliente como o de outra aba/conta deixou: uma escrita pausada persistida. */
function persistedPausedWrite() {
  onlineManager.setOnline(false);
  const before = new QueryClient();
  before.setMutationDefaults(KEY, { mutationFn: async () => {} });
  void new MutationObserver<void, Error, unknown>(before, { mutationKey: KEY }).mutate({ householdId: "h1" }).catch(() => {});
  const state = dehydrate(before);
  before.clear();
  return state;
}

afterEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});

test("rota sem usuário (login, bem-vindo, convite): foco/online não retomam a fila antes do gate", async () => {
  const persisted = persistedPausedWrite();
  const mutationFn = vi.fn(async () => {});
  const qc = new QueryClient();
  qc.setMutationDefaults(KEY, { mutationFn });
  const release = holdPausedMutations(qc);
  qc.mount();
  hydrate(qc, persisted);

  const gate = new UserGate(async () => {
    release();
    await qc.resumePausedMutations();
  });
  gate.restored();

  // Volta do app de e-mail com o magic link: foco e rede voltam, mas ninguém confirmou o usuário.
  onlineManager.setOnline(true);
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await new Promise((r) => setTimeout(r, 10));
  expect(mutationFn).not.toHaveBeenCalled();
  expect(qc.getMutationCache().getAll()[0].state.isPaused).toBe(true);

  // Uma tela da casa confirma o mesmo usuário: aí sim a fila sai.
  gate.setUser("ana");
  await new Promise((r) => setTimeout(r, 10));
  expect(mutationFn).toHaveBeenCalledOnce();
  qc.unmount();
});
