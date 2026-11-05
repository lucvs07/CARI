import { devices, expect, test, type Browser } from "@playwright/test";
import { entry, openLista, waitForHydration } from "./helpers/app";
import { authStatePath } from "./helpers/auth";
import { A1, adminClient, isEntryChecked, resetFixture, setEntriesChecked } from "./helpers/db";
import { waitForRealtimeReady } from "./helpers/realtime";

const BASE_URL = "http://localhost:3000";

async function checkedBy(name: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("shopping_list_entries")
    .select("checked_by")
    .eq("household_id", A1)
    .eq("name", name)
    .single();
  if (error) throw error;
  return data.checked_by;
}

test.beforeEach(async () => {
  await resetFixture();
});

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
  await waitForHydration(lucas);
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
  await waitForHydration(lucas);
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

test("toques rápidos encadeiam: 2 toques desmarcam, 3 toques marcam", async ({ page }) => {
  await openLista(page);
  // Latência nas escritas: os toques chegam antes de qualquer resposta do servidor.
  await page.route("**/rest/v1/shopping_list_entries*", async (r) => {
    if (r.request().method() === "PATCH") await new Promise((res) => setTimeout(res, 400));
    await r.continue();
  });

  for (let i = 0; i < 2; i++) await entry(page, "Azeite").click();
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(1500);
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => isEntryChecked("Azeite")).toBe(false);

  for (let i = 0; i < 3; i++) await entry(page, "Azeite").click();
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(2000);
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => isEntryChecked("Azeite")).toBe(true);
});

test("toques offline encadeiam e marcação leva quem marcou", async ({ page, context }) => {
  await openLista(page);
  await context.setOffline(true);
  for (let i = 0; i < 3; i++) await entry(page, "Azeite").click();
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("3 alterações aguardando sinal")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/aguardando sinal/)).toHaveCount(0);
  await expect.poll(() => isEntryChecked("Azeite")).toBe(true);
  await expect.poll(() => checkedBy("Azeite")).not.toBeNull();
});
