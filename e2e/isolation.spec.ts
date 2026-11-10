import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { resetFixture } from "./helpers/db";

test.beforeEach(async () => {
  await resetFixture();
});

test("não membro é redirecionado", async ({ page }) => {
  await loginAs(page, "intruso@cari.test");
  await page.goto("/00000000-0000-0000-0000-0000000000a1/lista");
  await expect(page).not.toHaveURL(/0000000000a1/);
});

test("não membro não vê receitas da casa alheia", async ({ page }) => {
  await loginAs(page, "intruso@cari.test");
  await page.goto("/00000000-0000-0000-0000-0000000000a1/receitas");
  await expect(page).not.toHaveURL(/0000000000a1/);
});
