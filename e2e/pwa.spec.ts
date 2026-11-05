import { expect, test, type Page } from "@playwright/test";
import { entry, openEstoque, openLista, persistedPausedMutations, waitForHydration } from "./helpers/app";
import { loginAs } from "./helpers/auth";
import { A1, isEntryChecked, resetFixture } from "./helpers/db";

test.beforeEach(async () => {
  await resetFixture();
});

/**
 * Aparelho lento: atrasa as respostas do IndexedDB para a tela montar (com o initialData do HTML em
 * cache) antes de o PersistQueryClientProvider restaurar o cache e a fila.
 */
async function slowIndexedDB(page: Page, ms = 800) {
  await page.addInitScript((delay) => {
    const desc = Object.getOwnPropertyDescriptor(IDBRequest.prototype, "onsuccess")!;
    Object.defineProperty(IDBRequest.prototype, "onsuccess", {
      configurable: true,
      get: desc.get,
      set(fn: ((this: IDBRequest, ev: Event) => unknown) | null) {
        desc.set!.call(this, fn && function (this: IDBRequest, ev: Event) {
          setTimeout(() => fn.call(this, ev), delay);
        });
      },
    });
  }, ms);
}

/** Garante que o SW controla a página e que a navegação da Lista passou por ele (foi para o cache). */
async function primeServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await waitForHydration(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test("manifest", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.theme_color).toBe("#006B5C");
  expect(m.display).toBe("standalone");
});

test("abre a Lista sem sinal e marca item", async ({ page, context }) => {
  await loginAs(page, "ana@cari.test");
  await page.goto(`/${A1}/lista`);
  await primeServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await waitForHydration(page);
  const row = entry(page, "Arroz"); // entrada ligada do seed (nome exato: não casa "Ações de Arroz")
  await expect(row).toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await context.setOffline(false);
  await expect.poll(() => isEntryChecked("Arroz")).toBe(true);
});

test("reabre o app fechado sem sinal e mostra a marcação que ficou na fila", async ({ page, context }) => {
  await openLista(page);
  await primeServiceWorker(page);

  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await entry(page, "Arroz").click();
  await expect(page.getByText("1 alteração aguardando sinal")).toBeVisible();
  await expect.poll(() => persistedPausedMutations(page)).toBe(1);

  // Fecha o app e reabre ainda sem sinal: tudo vem do SW (HTML) e do IndexedDB (cache + fila).
  await page.close();
  const reopened = await context.newPage();
  await slowIndexedDB(reopened);
  await reopened.goto(`/${A1}/lista`);
  await waitForHydration(reopened);
  await expect(entry(reopened, "Arroz")).toHaveAttribute("aria-pressed", "true");
  await expect(reopened.getByText("1 alteração aguardando sinal")).toBeVisible();
  expect(await isEntryChecked("Arroz")).toBe(false);

  await context.setOffline(false);
  await expect.poll(() => isEntryChecked("Arroz")).toBe(true);
  await expect(reopened.getByText(/aguardando sinal/)).toHaveCount(0);
});

test("chegou à Lista pela aba (navegação no cliente) e depois abre sem sinal", async ({ page, context }) => {
  await openEstoque(page);
  await primeServiceWorker(page);
  await page.getByRole("link", { name: "Lista" }).click();
  await expect(page).toHaveURL(new RegExp(`/${A1}/lista`));
  await expect(entry(page, "Arroz")).toBeVisible();
  // O SerwistProvider pede ao SW o HTML da rota navegada no cliente; ele vai para o cache da Lista.
  await expect
    .poll(() => page.evaluate(async (path) => !!(await (await caches.open("cari-lista")).match(path)), `/${A1}/lista`))
    .toBe(true);

  await context.setOffline(true);
  const cold = await context.newPage();
  await page.close();
  await cold.goto(`/${A1}/lista`);
  await waitForHydration(cold);
  await expect(entry(cold, "Arroz")).toBeVisible();
});

test("outra aba sem sinal e sem cache mostra a tela offline da Cari", async ({ page, context }) => {
  await openLista(page);
  await primeServiceWorker(page);
  await context.setOffline(true);
  await page.goto(`/${A1}/receitas`);
  await expect(page.getByText("Estou sem sinal e ainda não tenho essa tela guardada.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Abrir a Lista" }).click();
  await expect(page).toHaveURL(new RegExp(`/${A1}/lista`));
  await expect(entry(page, "Arroz")).toBeVisible();
});

test("sem sinal, tocar na aba Estoque mostra a tela offline da Cari", async ({ page, context }) => {
  await openLista(page);
  await primeServiceWorker(page);
  await context.setOffline(true);
  await page.getByRole("link", { name: "Estoque" }).click();
  await expect(page.getByText("Estou sem sinal e ainda não tenho essa tela guardada.", { exact: false })).toBeVisible({
    timeout: 10_000,
  });
});

test("SW novo (deploy) apaga a Lista guardada: sem sinal, tela offline em vez de página morta", async ({ page, context }) => {
  await openLista(page);
  await primeServiceWorker(page);
  const listaCached = () =>
    page.evaluate(async () => (await (await caches.open("cari-lista")).keys()).length);
  await expect.poll(listaCached).toBeGreaterThan(0);

  // Sai da Lista (como fechar a aba): nela um RSC da rota fica aberto e segura a ativação do SW novo.
  await page.goto("/offline");
  // Simula um deploy: outra URL de script no mesmo escopo é um SW novo (instala, skipWaiting, ativa).
  // O Playwright não intercepta o fetch do script do SW, então não dá para trocar o corpo do sw.js.
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js?deploy=2", { scope: "/", type: "module" }));
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg?.active?.scriptURL.includes("deploy=2") && reg.active.state === "activated";
      }),
    )
    .toBe(true);
  await expect.poll(listaCached).toBe(0);

  await context.setOffline(true);
  await page.goto(`/${A1}/lista`);
  await expect(page.getByText("Estou sem sinal e ainda não tenho essa tela guardada.", { exact: false })).toBeVisible();
});
