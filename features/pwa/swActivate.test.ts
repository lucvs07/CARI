import { expect, test, vi } from "vitest";
import { LISTA_CACHE } from "./cacheNames";
import { clearListaOnActivate } from "./swActivate";

test("no activate, apaga o cache da Lista dentro do waitUntil", async () => {
  const del = vi.fn(async () => true);
  const waitUntil = vi.fn();
  clearListaOnActivate({ waitUntil }, { delete: del });
  expect(del).toHaveBeenCalledWith(LISTA_CACHE);
  expect(waitUntil).toHaveBeenCalledOnce();
  await expect(waitUntil.mock.calls[0][0]).resolves.toBe(true);
});
