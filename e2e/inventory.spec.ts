import { expect, test, type Page } from "@playwright/test";
import { openEstoque } from "./helpers/app";
import { adminClient, resetFixture } from "./helpers/db";

test.beforeEach(async () => {
  await resetFixture();
});

async function listEntryNames(): Promise<string[]> {
  const { data, error } = await adminClient().from("shopping_list_entries").select("name");
  if (error) throw error;
  return (data ?? []).map((e) => e.name);
}

function row(page: Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("button", { name: `Diminuir ${name}` }) });
}

async function addCafe(page: Page) {
  await page.getByRole("button", { name: "Adicionar item" }).first().click();
  await page.getByLabel("Nome do item").fill("Café");
  await page.getByLabel("Quantidade").fill("500");
  await page.getByLabel("Unidade").click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  await page.getByLabel("Categoria").click();
  await page.getByRole("option", { name: "Mercearia" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
}

test("adicionar Café 500 g aparece em Mercearia", async ({ page }) => {
  await openEstoque(page);
  await addCafe(page);
  const group = page.getByRole("region", { name: "Mercearia" });
  await expect(group.getByText("Café")).toBeVisible();
  await expect(group.getByText("500 g")).toBeVisible();
});

test("Leite diminuído até 0 vai para a lista", async ({ page }) => {
  await openEstoque(page);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Diminuir Leite" }).click();
  await expect(page.getByText("Leite foi para a lista")).toBeVisible();
  await page.getByRole("link", { name: "Lista" }).click();
  await expect(page).toHaveURL(/\/lista/);
  await expect(page.getByRole("region", { name: "Laticínios" }).getByRole("button", { name: "Leite", exact: true })).toBeVisible();
});

test("desfazer devolve Leite a 0,5 L e fora da lista", async ({ page }) => {
  await openEstoque(page);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Diminuir Leite" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Leite foi para a lista" })).toBeVisible();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(row(page, "Leite").getByText("0,5 L")).toBeVisible();
  await expect.poll(listEntryNames).not.toContain("Leite");
});

test("Acabou + Desfazer em Arroz mantém a entrada que já existia", async ({ page }) => {
  await openEstoque(page);
  await page.getByRole("button", { name: "Aumentar Arroz" }).click();
  await expect(row(page, "Arroz").getByText("0,5 kg")).toBeVisible();
  await page.getByRole("button", { name: "Ações de Arroz" }).click();
  await page.getByRole("menuitem", { name: "Acabou" }).click();
  await expect(page.getByText("Arroz foi para a lista")).toBeVisible();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(row(page, "Arroz").getByText("0,5 kg")).toBeVisible();
  await expect.poll(listEntryNames).toContain("Arroz");
});

test("remover Café e desfazer", async ({ page }) => {
  await openEstoque(page);
  await addCafe(page);
  await expect(row(page, "Café")).toBeVisible();
  await page.getByRole("button", { name: "Ações de Café" }).click();
  await page.getByRole("menuitem", { name: "Remover" }).click();
  await expect(row(page, "Café")).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(row(page, "Café")).toBeVisible();
});

test("nome duplicado oferece somar quantidade", async ({ page }) => {
  await openEstoque(page);
  await page.getByRole("button", { name: "Adicionar item" }).first().click();
  await page.getByLabel("Nome do item").fill("leite");
  await page.getByLabel("Quantidade").fill("1");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Já existe Leite — somar quantidade?")).toBeVisible();
  await page.getByRole("button", { name: "Somar" }).click();
  await expect(row(page, "Leite").getByText("3 L")).toBeVisible();
});

test("toques rápidos com latência não perdem passos", async ({ page }) => {
  await openEstoque(page);
  await page.route("**/rest/v1/items*", async (r) => {
    if (r.request().method() === "PATCH") await new Promise((res) => setTimeout(res, 600));
    await r.continue();
  });
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Diminuir Leite" }).click();
  await expect(row(page, "Leite").getByText("0,5 L")).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(row(page, "Leite").getByText("0,5 L")).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await adminClient().from("items").select("quantity, name").eq("name", "Leite").single();
      return data?.quantity;
    })
    .toBe(0.5);
});

test("sem rede: controles do estoque desabilitados, com aviso", async ({ page, context }) => {
  await openEstoque(page);
  await context.setOffline(true);

  await expect(page.getByRole("status").filter({ hasText: "Sem internet: o estoque volta quando o sinal voltar." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adicionar item" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Diminuir Leite" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Aumentar Leite" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ações de Leite" })).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Adicionar item" })).toBeEnabled();
  await expect(page.getByText("Sem internet: o estoque volta quando o sinal voltar.")).toHaveCount(0);
});
