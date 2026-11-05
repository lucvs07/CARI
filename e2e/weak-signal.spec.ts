import { expect, test, type Page } from "@playwright/test";
import { entry, openLista, persistedPausedMutations, waitForHydration } from "./helpers/app";
import { isEntryChecked, resetFixture } from "./helpers/db";

/*
 * Sinal fraco: navigator.onLine continua true, mas a escrita não chega ao Supabase.
 * Prazo para sincronizar depois que a rede volta (derivado, não folga):
 *   timeout do fetch (8 s, lib/query/network.ts) + intervalo da sonda (5 s) + espera do retry (1 s)
 *   + margem de 6 s para a requisição e o poll = 20 s.
 */
const SYNC_DEADLINE_MS = 20_000;
const ENTRIES = "**/rest/v1/shopping_list_entries**";

test.beforeEach(async () => {
  await resetFixture();
});

async function failPatches(page: Page, mode: "abort" | "hang") {
  await page.route(ENTRIES, (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    if (mode === "abort") return route.abort("internetdisconnected");
    // hang: nunca responde; só o timeout do fetch do app encerra a requisição
  });
}

test("online com sinal fraco: a marcação não volta atrás, fica na fila e sincroniza sozinha", async ({ page }) => {
  await openLista(page);
  await failPatches(page, "abort");

  await entry(page, "Arroz").click();
  await expect(entry(page, "Arroz")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1 alteração aguardando sinal")).toBeVisible();
  // Sem rollback nem toast de erro: o toque continua valendo enquanto espera o sinal.
  await expect(entry(page, "Arroz")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Algo deu errado. Tenta de novo?")).toHaveCount(0);
  expect(await isEntryChecked("Arroz")).toBe(false);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await expect.poll(() => isEntryChecked("Arroz"), { timeout: SYNC_DEADLINE_MS }).toBe(true);
  await expect(page.getByText(/aguardando sinal/)).toHaveCount(0);
  await expect(entry(page, "Arroz")).toHaveAttribute("aria-pressed", "true");
});

test("requisição pendurada: o timeout a encerra, a fila sobrevive ao recarregar e sincroniza", async ({ page }) => {
  await openLista(page);
  await failPatches(page, "hang");

  await entry(page, "Azeite").click();
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");
  // Só aparece depois do timeout do fetch: a requisição pendurada não segura o scope "list" para sempre.
  await expect(page.getByText("1 alteração aguardando sinal")).toBeVisible({ timeout: SYNC_DEADLINE_MS });
  await expect.poll(() => persistedPausedMutations(page)).toBeGreaterThanOrEqual(1);

  // Recarrega ainda com o PATCH pendurado: a marcação vem da fila persistida.
  await page.reload();
  await waitForHydration(page);
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");
  expect(await isEntryChecked("Azeite")).toBe(false);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await expect.poll(() => isEntryChecked("Azeite"), { timeout: SYNC_DEADLINE_MS }).toBe(true);
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/aguardando sinal/)).toHaveCount(0);
});
