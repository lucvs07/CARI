import { headers } from "next/headers";

/** Link público do convite, com a origem da requisição atual. */
export async function inviteUrlFor(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}/convite/${token}`;
}
