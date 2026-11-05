import { describe, expect, test } from "vitest";
import { cari } from "@/features/cari/messages";
import {
  checkedEntries,
  countPausedListWrites,
  countUnchecked,
  groupEntries,
  initials,
  isListWriteKey,
  parseEntryQuantity,
  toQuantityInput,
  type Entry,
} from "./model";

function entry(name: string, category: string, checked = false): Entry {
  return {
    id: name,
    household_id: "h",
    item_id: null,
    name,
    quantity: null,
    unit: "un",
    category,
    checked,
    checked_by: null,
    added_by: null,
    created_at: "",
    updated_at: "",
  };
}

describe("groupEntries", () => {
  const entries = [
    entry("Sorvete", "congelados"),
    entry("azeite", "mercearia"),
    entry("Arroz", "mercearia"),
    entry("Iogurte", "laticinios", true),
    entry("Detergente", "limpeza", true),
    entry("Coisa", "categoria-que-nao-existe"),
  ];

  test("agrupa não marcadas na ordem das categorias, alfabético dentro do grupo", () => {
    const { toBuy } = groupEntries(entries);
    expect(toBuy.map((g) => g.category)).toEqual(["mercearia", "congelados", "outros"]);
    expect(toBuy[0].rows.map((r) => r.name)).toEqual(["Arroz", "azeite"]);
    expect(toBuy[2].rows.map((r) => r.name)).toEqual(["Coisa"]);
  });

  test("marcadas vão para o carrinho em ordem alfabética", () => {
    expect(groupEntries(entries).inCart.map((r) => r.name)).toEqual(["Detergente", "Iogurte"]);
    expect(checkedEntries(entries).map((r) => r.name)).toEqual(["Detergente", "Iogurte"]);
  });

  test("countUnchecked conta só as não marcadas", () => {
    expect(countUnchecked(entries)).toBe(4);
    expect(countUnchecked(undefined)).toBe(0);
  });
});

test("initials", () => {
  expect(initials("Ana Souza")).toBe("AS");
  expect(initials("lucas")).toBe("L");
  expect(initials("Maria da Silva")).toBe("MS");
  expect(initials("  ")).toBe("?");
});

describe("escritas pausadas da lista", () => {
  test("isListWriteKey aceita só as operações da fila", () => {
    expect(isListWriteKey(["list", "setChecked"])).toBe(true);
    expect(isListWriteKey(["list", "finish"])).toBe(false);
    expect(isListWriteKey(["items", "write"])).toBe(false);
    expect(isListWriteKey(undefined)).toBe(false);
  });

  test("countPausedListWrites ignora as não pausadas e as de outras chaves", () => {
    expect(
      countPausedListWrites([
        { mutationKey: ["list", "setChecked"], isPaused: true },
        { mutationKey: ["list", "upsert"], isPaused: true },
        { mutationKey: ["list", "remove"], isPaused: false },
        { mutationKey: ["items", "write"], isPaused: true },
      ]),
    ).toBe(2);
  });
});

describe("parseEntryQuantity", () => {
  test("vazio é null quando opcional e erro quando obrigatório", () => {
    expect(parseEntryQuantity("")).toEqual({ ok: true, value: null });
    expect(parseEntryQuantity(" ", true)).toEqual({ ok: false, error: cari.quantityInvalid });
  });
  test("aceita vírgula", () => {
    expect(parseEntryQuantity("1,5", true)).toEqual({ ok: true, value: 1.5 });
  });
  test("recusa zero, negativo, texto e grande demais", () => {
    expect(parseEntryQuantity("0")).toEqual({ ok: false, error: cari.quantityInvalid });
    expect(parseEntryQuantity("-1")).toEqual({ ok: false, error: cari.quantityInvalid });
    expect(parseEntryQuantity("abc")).toEqual({ ok: false, error: cari.quantityInvalid });
    expect(parseEntryQuantity("0,0001")).toEqual({ ok: false, error: cari.quantityInvalid });
    expect(parseEntryQuantity("99999999")).toEqual({ ok: false, error: cari.quantityTooLarge });
  });
});

test("toQuantityInput usa vírgula", () => {
  expect(toQuantityInput(0.5)).toBe("0,5");
  expect(toQuantityInput(2)).toBe("2");
  expect(toQuantityInput(1000)).toBe("1000");
});
