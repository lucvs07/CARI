import { expect, test } from "vitest";
import { applyRealtimeEvent } from "./realtime";

const a = { id: "a", name: "Leite" },
  b = { id: "b", name: "Pão" };
test("insert", () => expect(applyRealtimeEvent([a], { eventType: "INSERT", new: b, old: {} })).toEqual([a, b]));
test("insert idempotente", () => expect(applyRealtimeEvent([a], { eventType: "INSERT", new: a, old: {} })).toEqual([a]));
test("update", () =>
  expect(applyRealtimeEvent([a], { eventType: "UPDATE", new: { id: "a", name: "Leite 2" }, old: {} })).toEqual([
    { id: "a", name: "Leite 2" },
  ]));
test("update atrasado (updated_at mais velho que o do cache) é ignorado", () => {
  const cached = { id: "a", name: "Leite", quantity: 1, updated_at: "2026-11-05T02:26:06.375+00:00" };
  const echo = { id: "a", name: "Leite", quantity: 1.5, updated_at: "2026-11-05T02:26:06.326+00:00" };
  expect(applyRealtimeEvent([cached], { eventType: "UPDATE", new: echo, old: {} })).toEqual([cached]);
  const newer = { ...echo, quantity: 0.5, updated_at: "2026-11-05T02:26:06.400+00:00" };
  expect(applyRealtimeEvent([cached], { eventType: "UPDATE", new: newer, old: {} })).toEqual([newer]);
});
test("delete só com pk", () =>
  expect(applyRealtimeEvent([a, b], { eventType: "DELETE", new: {}, old: { id: "a" } })).toEqual([b]));
test("delete de id desconhecido", () =>
  expect(applyRealtimeEvent([a], { eventType: "DELETE", new: {}, old: { id: "zz" } })).toEqual([a]));
test("cache vazio", () =>
  expect(applyRealtimeEvent(undefined, { eventType: "INSERT", new: a, old: {} })).toBeUndefined());

import { shouldSkipRealtime } from "./realtime";

test("shouldSkipRealtime só pula com mutação pendente da mesma chave e casa", () => {
  const pending = [{ mutationKey: ["items", "write"], variables: { householdId: "h1", id: "i" } }];
  expect(shouldSkipRealtime(pending, "items", "h1")).toBe(true);
  expect(shouldSkipRealtime(pending, "items", "h2")).toBe(false);
  expect(shouldSkipRealtime(pending, "list", "h1")).toBe(false);
  expect(shouldSkipRealtime([], "items", "h1")).toBe(false);
  expect(shouldSkipRealtime([{ mutationKey: ["list", "x"], variables: { householdId: "h1" } }], "list", "h1")).toBe(true);
});
