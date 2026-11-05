import { expect, test } from "@playwright/test";
import { loginAs, loginViaMagicLink } from "./helpers/auth";
import { resetFixture } from "./helpers/db";

test.beforeEach(async () => {
  await resetFixture();
});

test("sem sessão vai para /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("login por magic link abre a lista da casa", async ({ page }) => {
  await loginViaMagicLink(page, "ana@cari.test");
  await expect(page).toHaveURL(/\/00000000-0000-0000-0000-0000000000a1\/lista/);
});

test("loginAs reaproveita a sessão salva no global-setup", async ({ page }) => {
  await loginAs(page, "ana@cari.test");
  await expect(page).toHaveURL(/\/00000000-0000-0000-0000-0000000000a1\/lista/);
});

test("sair apaga o cache persistido", async ({ page }) => {
  await loginViaMagicLink(page, "ana@cari.test");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("keyval-store");
      req.onupgradeneeded = () => req.result.createObjectStore("keyval");
      req.onsuccess = () => {
        const tx = req.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put("x", "cari-query-cache");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
    const c = await caches.open("cari-lista");
    await c.put("/x", new Response("x"));
  });
  const readKeys = () =>
    page.evaluate(
      () =>
        new Promise<string[]>((r) => {
          const req = indexedDB.open("keyval-store");
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("keyval")) return r([]);
            const g = db.transaction("keyval").objectStore("keyval").getAllKeys();
            g.onsuccess = () => r(g.result as string[]);
          };
        }),
    );
  expect(await readKeys()).toContain("cari-query-cache");
  expect(await page.evaluate(() => caches.has("cari-lista"))).toBe(true);
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  const keys = await page.evaluate(
    () =>
      new Promise<string[]>((r) => {
        const req = indexedDB.open("keyval-store");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("keyval")) return r([]);
          const g = db.transaction("keyval").objectStore("keyval").getAllKeys();
          g.onsuccess = () => r(g.result as string[]);
        };
      }),
  );
  expect(keys).not.toContain("cari-query-cache");
  expect(await page.evaluate(() => caches.has("cari-lista"))).toBe(false);
});

test("sair não derruba a sessão em outro aparelho", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await loginViaMagicLink(pa, "ana@cari.test");
  await loginViaMagicLink(pb, "ana@cari.test");
  await pa.getByRole("button", { name: "Menu da conta" }).click();
  await pa.getByRole("menuitem", { name: "Sair" }).click();
  await pb.reload();
  await expect(pb).toHaveURL(/\/lista/);
  await a.close();
  await b.close();
});
