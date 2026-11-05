import { expect, test } from "vitest";
import { createFetchWithTimeout, isNetworkError, NetworkError, throwIfError } from "./network";

/** fetch que só termina quando o signal aborta (requisição pendurada). */
const hanging: typeof fetch = (_input, init) =>
  new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });

test("requisição pendurada é encerrada pelo prazo (TimeoutError)", async () => {
  const f = createFetchWithTimeout(hanging, 20);
  const err = await f("https://x.test/rest/v1/t").catch((e: unknown) => e);
  expect((err as Error).name).toBe("TimeoutError");
  expect(isNetworkError(err)).toBe(true);
});

test("o signal de quem chamou continua valendo junto com o prazo", async () => {
  const f = createFetchWithTimeout(hanging, 60_000);
  const ctl = new AbortController();
  const p = f("https://x.test/rest/v1/t", { signal: ctl.signal }).catch((e: unknown) => e);
  ctl.abort();
  expect((await p as Error).name).toBe("AbortError");
});

test("resposta rápida passa sem mudança", async () => {
  const f = createFetchWithTimeout(async () => new Response("ok", { status: 201 }), 20);
  expect((await f("https://x.test")).status).toBe(201);
});

test("throwIfError: status 0 vira NetworkError; erro com resposta é relançado como veio", () => {
  expect(() => throwIfError({ error: null, status: 204 })).not.toThrow();
  expect(() => throwIfError({ error: { message: "TypeError: Failed to fetch", code: "" }, status: 0 })).toThrow(NetworkError);
  const rls = { message: "denied", code: "42501" };
  try {
    throwIfError({ error: rls, status: 403 });
  } catch (e) {
    expect(e).toBe(rls);
    expect(isNetworkError(e)).toBe(false);
  }
});

test("TypeError solto é bug de código, não falha de rede (o postgrest-js devolve status 0 para isso)", () => {
  expect(isNetworkError(new TypeError("x"))).toBe(false);
  expect(isNetworkError(new NetworkError())).toBe(true);
});
