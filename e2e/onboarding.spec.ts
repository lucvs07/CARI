import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { resetFixture } from "./helpers/db";

test.beforeEach(async () => {
  await resetFixture();
});

test("usuário sem casa cria a primeira", async ({ page }) => {
  await loginAs(page, "novo@cari.test");
  await expect(page).toHaveURL(/\/bem-vindo/);
  await expect(page.getByText("Oi, eu sou a Cari! Vamos criar sua casa?")).toBeVisible();
  await page.getByLabel("Nome da casa").fill("Casa do Novo");
  await page.getByRole("button", { name: "Criar casa" }).click();
  await expect(page.getByRole("button", { name: /Casa do Novo/ })).toBeVisible();
  await expect(page).toHaveURL(/\/casa\?novo=1/);
  await expect(page.getByText("Casa criada! Manda esse link pra quem mora com você.")).toBeVisible();
  await expect(page.getByLabel("Link de convite")).toHaveValue(/\/convite\/.+/);
});

test("AppShell: abas com aria-current e receitas com a Cari", async ({ page }) => {
  await loginAs(page, "ana@cari.test");
  await expect(page.getByRole("link", { name: "Lista" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Receitas" }).click();
  await expect(page).toHaveURL(/\/receitas/);
  await expect(page.getByText("Em breve vou sugerir receitas com o que você tem em casa.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Receitas" })).toHaveAttribute("aria-current", "page");
});

test("tema escuro escolhido no menu persiste após recarregar", async ({ page }) => {
  await loginAs(page, "ana@cari.test");
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitemradio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("cari-theme"))).toBe("dark");
});

test("troca de casa pelo seletor", async ({ page }) => {
  await loginAs(page, "ana@cari.test");
  await page.getByRole("button", { name: /Casa Lucas & Ana/ }).click();
  await expect(page.getByRole("menuitemradio", { name: /Casa Lucas & Ana/ })).toBeVisible();
});
