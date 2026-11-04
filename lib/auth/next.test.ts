import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it.each([
    "/%09/evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "//evil.com",
    "/.//evil.com",
    "/..//evil.com",
    "/a/../..//evil.com",
    "/./\\evil.com",
    "/\\evil.com",
    "%2F%2Fevil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "",
    undefined,
    null,
  ])("rejeita %j", (input) => {
    expect(safeNext(input)).toBe("/");
  });

  it("mantém paths internos", () => {
    const p = "/00000000-0000-0000-0000-0000000000a1/lista?x=1#y";
    expect(safeNext(p)).toBe(p);
  });
});
