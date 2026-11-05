import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { authStatePath, loginAs } from "./helpers/auth";
import { A1, resetFixture, setEntriesChecked } from "./helpers/db";
import { waitForRealtimeReady } from "./helpers/realtime";

const BASE_URL = "http://localhost:3000";

test.beforeEach(async () => {
  await resetFixture();
});

/** Linha da lista: o botão inteiro tem o nome da entrada (exato, para não casar "Ações de …"). */
function entry(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

async function openLista(page: Page, email = "ana@cari.test") {
  await loginAs(page, email);
  await page.goto(`/${A1}/lista`);
  await expect(entry(page, "Arroz")).toBeVisible();
}

async function lucasPage(browser: Browser) {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: BASE_URL,
    storageState: authStatePath("lucas@cari.test"),
  });
  return context.newPage();
}

test("marcação aparece em tempo real para o outro membro", async ({ page, browser }) => {
  const lucas = await lucasPage(browser);
  const ready = waitForRealtimeReady(lucas);
  await lucas.goto(`/${A1}/lista`);
  await expect(entry(lucas, "Iogurte")).toHaveAttribute("aria-pressed", "false");
  await ready;

  await openLista(page);
  await entry(page, "Iogurte").click();
  await expect(entry(page, "Iogurte")).toHaveAttribute("aria-pressed", "true");

  await expect(entry(lucas, "Iogurte")).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
  await lucas.context().close();
});

test("finalizar compra guarda no estoque e limpa a lista", async ({ page }) => {
  await openLista(page);
  await entry(page, "Arroz").click();
  await entry(page, "Azeite").click();
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Finalizar compra (2)" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByLabel("Quantidade de Arroz")).toHaveValue("2");
  await expect(sheet.getByLabel("Quantidade de Azeite")).toHaveValue("1");
  await sheet.getByLabel("Quantidade de Arroz").fill("1,5");
  await sheet.getByRole("button", { name: "Guardar no estoque" }).click();

  await expect(page.getByText("Prontinho! Guardei 2 itens no estoque.")).toBeVisible();
  await expect(entry(page, "Arroz")).toHaveCount(0);
  await expect(entry(page, "Azeite")).toHaveCount(0);
  await expect(entry(page, "Iogurte")).toBeVisible();

  await page.getByRole("link", { name: "Estoque" }).click();
  const row = (name: string) =>
    page.getByRole("listitem").filter({ has: page.getByRole("button", { name: `Diminuir ${name}` }) });
  await expect(row("Arroz").getByText("1,5 kg")).toBeVisible();
  await expect(row("Azeite").getByText("1 un")).toBeVisible();
});

test("compra já finalizada em outro aparelho", async ({ page, browser }) => {
  await setEntriesChecked(["Arroz", "Azeite"], true);
  const lucas = await lucasPage(browser);
  await lucas.goto(`/${A1}/lista`);
  await openLista(page);

  await page.getByRole("button", { name: "Finalizar compra (2)" }).click();
  await lucas.getByRole("button", { name: "Finalizar compra (2)" }).click();

  await lucas.getByRole("dialog").getByRole("button", { name: "Guardar no estoque" }).click();
  await expect(lucas.getByText("Prontinho! Guardei 2 itens no estoque.")).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Guardar no estoque" }).click();
  await expect(page.getByText("Alguém da casa já guardou essa compra.")).toBeVisible();
  await lucas.context().close();
});

test("adição rápida: item do estoque vira entrada ligada, nome novo vira avulsa", async ({ page }) => {
  await openLista(page);
  await page.getByRole("button", { name: "Adicionar item" }).first().click();
  await page.getByLabel("Nome do item").fill("Lei");
  await page.getByRole("option", { name: "Leite" }).click();
  await page.getByRole("button", { name: "Adicionar à lista" }).click();
  await expect(page.getByRole("region", { name: "Laticínios" }).getByRole("button", { name: "Leite", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar item" }).first().click();
  await page.getByLabel("Nome do item").fill("Pilhas");
  await page.getByLabel("Quantidade").fill("4");
  await page.getByRole("button", { name: "Adicionar à lista" }).click();
  await expect(entry(page, "Pilhas")).toBeVisible();
  await expect(entry(page, "Pilhas")).toContainText("4 un");
});

test("remover entrada e desfazer", async ({ page }) => {
  await openLista(page);
  await page.getByRole("button", { name: "Ações de Sorvete" }).click();
  await page.getByRole("menuitem", { name: "Remover" }).click();
  await expect(entry(page, "Sorvete")).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(entry(page, "Sorvete")).toBeVisible();
});
