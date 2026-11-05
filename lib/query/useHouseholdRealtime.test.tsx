import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const sb = vi.hoisted(() => ({
  getSession: vi.fn(),
  setAuth: vi.fn(async () => {}),
  subscribe: vi.fn(),
  removeChannel: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/browser", () => {
  const channel = { on: () => channel, subscribe: (cb: (s: string) => void) => (sb.subscribe(cb), channel) };
  return {
    getBrowserSupabase: () => ({
      auth: { getSession: sb.getSession },
      realtime: { setAuth: sb.setAuth },
      channel: () => channel,
      removeChannel: sb.removeChannel,
    }),
  };
});

import { useHouseholdRealtime } from "./useHouseholdRealtime";

const session = { data: { session: { access_token: "jwt" } }, error: null };
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
});

function mount() {
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useHouseholdRealtime("h1"), { wrapper });
}

test("getSession/setAuth falhando: sem rejeição solta, tenta de novo com espera crescente (2 s, 5 s, 10 s)", async () => {
  sb.getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  sb.setAuth.mockRejectedValueOnce(new Error("socket"));
  sb.getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  sb.getSession.mockResolvedValue(session);
  const { unmount } = mount();

  await vi.advanceTimersByTimeAsync(0);
  expect(sb.getSession).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2_000);
  expect(sb.getSession).toHaveBeenCalledTimes(2); // setAuth falha nesta
  await vi.advanceTimersByTimeAsync(4_999);
  expect(sb.getSession).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(sb.getSession).toHaveBeenCalledTimes(3);
  expect(sb.subscribe).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(sb.getSession).toHaveBeenCalledTimes(4);
  expect(sb.subscribe).toHaveBeenCalledOnce();
  expect(warn).toHaveBeenCalledTimes(3);
  unmount();
});

test("desmontar cancela a próxima tentativa", async () => {
  sb.getSession.mockRejectedValue(new TypeError("Failed to fetch"));
  const { unmount } = mount();
  await vi.advanceTimersByTimeAsync(0);
  unmount();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(sb.getSession).toHaveBeenCalledTimes(1);
});
