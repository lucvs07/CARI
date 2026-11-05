import { expect, test } from "vitest";
import { cari } from "./messages";

test("plural", () => {
  expect(cari.finished(1)).toBe("Prontinho! Guardei 1 item no estoque.");
  expect(cari.finished(12)).toBe("Prontinho! Guardei 12 itens no estoque.");
  expect(cari.pendingSync(1)).toBe("1 alteração aguardando sinal");
  expect(cari.pendingSync(3)).toBe("3 alterações aguardando sinal");
});

test("textos fixos e funções com nome", () => {
  expect(cari.welcome).toBe("Oi, eu sou a Cari! Vamos criar sua casa?");
  expect(cari.magicLinkSent).toBe("Te mandei um link! Confere seu e-mail.");
  expect(cari.movedToList("Leite")).toBe("Leite foi para a lista");
});
