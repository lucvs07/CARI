import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

const MAILPIT = "http://127.0.0.1:54324";

export const SEED_USERS = [
  "lucas@cari.test",
  "ana@cari.test",
  "intruso@cari.test",
  "novo@cari.test",
  "convidado@cari.test",
] as const;

export function authStatePath(email: string): string {
  return `e2e/.auth/${email.split("@")[0]}.json`;
}

async function findMagicLink(email: string, since: number): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages = [] } = (await res.json()) as { messages?: { ID: string; Created: string }[] };
    const fresh = messages
      .filter((m) => new Date(m.Created).getTime() >= since)
      .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
    if (fresh[0]) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json()) as {
        HTML?: string;
        Text?: string;
      };
      const body = `${msg.HTML ?? ""}\n${msg.Text ?? ""}`;
      const href = body.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1] ?? body.match(/https?:\/\/\S*\/auth\/v1\/verify\S*/)?.[0];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Magic link para ${email} não chegou ao Mailpit`);
}

export async function loginViaMagicLink(page: Page, email: string): Promise<void> {
  const since = Date.now() - 1000;
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  const sent = page.getByText("Te mandei um link! Confere seu e-mail.");
  // O Supabase local limita 1 envio por segundo por e-mail; tenta de novo se bater nisso.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByRole("button", { name: "Receber link por e-mail" }).click();
    const outcome = await Promise.race([
      sent.waitFor().then(() => "sent" as const),
      page.getByRole("alert").filter({ hasText: "Não consegui enviar" }).waitFor().then(() => "failed" as const),
    ]);
    if (outcome === "sent") break;
    await page.waitForTimeout(1500);
  }
  await sent.waitFor();
  const link = await findMagicLink(email, since);
  await page.goto(link);
  await page.waitForURL((u) => !/^\/(auth|login)/.test(u.pathname));
}

/** Aplica o storageState salvo no global-setup e abre `/`. */
export async function loginAs(page: Page, email: string): Promise<void> {
  const state = JSON.parse(readFileSync(authStatePath(email), "utf8")) as {
    cookies: Parameters<ReturnType<Page["context"]>["addCookies"]>[0];
  };
  await page.context().addCookies(state.cookies);
  await page.goto("/");
}
