import { expect, test, vi } from "vitest";
import { UserGate } from "./userGate";

test("só retoma depois de restaurar o cache E saber o usuário, uma vez por usuário", async () => {
  const onReady = vi.fn(async () => {});
  const gate = new UserGate(onReady);
  gate.setUser("ana");
  expect(onReady).not.toHaveBeenCalled();
  gate.restored();
  expect(onReady).toHaveBeenCalledExactlyOnceWith("ana");
  gate.setUser("ana");
  expect(onReady).toHaveBeenCalledOnce();
  gate.setUser("lucas");
  expect(onReady).toHaveBeenLastCalledWith("lucas");
});

test("restaurado antes do usuário: espera o AppShell", () => {
  const onReady = vi.fn(async () => {});
  const gate = new UserGate(onReady);
  gate.restored();
  expect(onReady).not.toHaveBeenCalled();
  gate.setUser("ana");
  expect(onReady).toHaveBeenCalledWith("ana");
});
