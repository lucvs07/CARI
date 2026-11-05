import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _u: string,
    _k: string,
    opts: { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        opts.cookies.setAll([{ name: "sb-access", value: "novo", options: {} }]);
        return { data: { user: null } };
      },
    },
  }),
}));

import { updateSession } from "./proxy";

describe("updateSession", () => {
  it("repassa cookies renovados aos Server Components e mantém x-pathname", async () => {
    const req = new NextRequest("http://localhost:3000/abc?x=1", { headers: { cookie: "sb-access=velho" } });
    const res = await updateSession(req);
    const forwarded = res.headers.get("x-middleware-request-cookie");
    expect(forwarded).toContain("sb-access=novo");
    expect(forwarded).not.toContain("velho");
    expect(res.headers.get("x-middleware-request-x-pathname")).toBe("/abc?x=1");
    expect(res.cookies.get("sb-access")?.value).toBe("novo");
  });
});
