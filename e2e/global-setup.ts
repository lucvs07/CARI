import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { SEED_USERS, authStatePath, loginViaMagicLink } from "./helpers/auth";
import { resetFixture } from "./helpers/db";

export default async function globalSetup(): Promise<void> {
  await resetFixture();
  mkdirSync("e2e/.auth", { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const email of SEED_USERS) {
      const context = await browser.newContext({ baseURL: "http://localhost:3000" });
      const page = await context.newPage();
      await loginViaMagicLink(page, email);
      await context.storageState({ path: authStatePath(email) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
