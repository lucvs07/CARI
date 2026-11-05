import { expect, type Page } from "@playwright/test";
import { loginAs } from "./auth";
import { A1 } from "./db";

/**
 * Espera a tela (Lista/Estoque) hidratar: antes disso o React ainda não ligou os handlers
 * e um toque do teste se perde. O marcador é posto num useEffect dentro da própria tela.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: "attached" });
}

/** Linha da lista: o botão inteiro tem o nome da entrada (exato, para não casar "Ações de …"). */
export function entry(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

export async function gotoLista(page: Page): Promise<void> {
  await page.goto(`/${A1}/lista`);
  await waitForHydration(page);
  await expect(entry(page, "Arroz")).toBeVisible();
}

export async function openLista(page: Page, email = "ana@cari.test"): Promise<void> {
  await loginAs(page, email);
  await gotoLista(page);
}

export async function openEstoque(page: Page): Promise<void> {
  await loginAs(page, "ana@cari.test");
  await page.getByRole("link", { name: "Estoque" }).click();
  await expect(page).toHaveURL(/\/estoque/);
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: "Diminuir Leite" })).toBeVisible();
}

/** Número de mutações pausadas já gravadas pelo persister no IndexedDB (idb-keyval). */
export function persistedPausedMutations(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction("keyval").objectStore("keyval").get("cari-query-cache");
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const raw = req.result as string | undefined;
            if (!raw) return resolve(0);
            const parsed = JSON.parse(raw) as {
              clientState: { mutations: { state: { isPaused: boolean } }[] };
            };
            resolve(parsed.clientState.mutations.filter((m) => m.state.isPaused).length);
          };
        };
      }),
  );
}
