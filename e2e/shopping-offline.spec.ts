import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { A1, isEntryChecked, resetFixture } from "./helpers/db";

test.beforeEach(async () => {
  await resetFixture();
});

function entry(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

async function openLista(page: Page) {
  await loginAs(page, "ana@cari.test");
  await page.goto(`/${A1}/lista`);
  await expect(entry(page, "Arroz")).toBeVisible();
}

/** Número de mutações pausadas já gravadas pelo persister no IndexedDB (idb-keyval). */
function persistedPausedMutations(page: Page): Promise<number> {
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

test("sem sinal: marcações entram na fila e sincronizam ao voltar", async ({ page, context }) => {
  await openLista(page);
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

  await entry(page, "Arroz").click();
  await entry(page, "Azeite").click();
  await expect(entry(page, "Arroz")).toHaveAttribute("aria-pressed", "true");
  await expect(entry(page, "Azeite")).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByText("2 alterações aguardando sinal")).toBeVisible();
  await expect(page.getByRole("button", { name: /Finalizar compra/ })).toBeDisabled();
  await expect(page.getByText("Precisa de internet para guardar no estoque")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/aguardando sinal/)).toHaveCount(0);
  await expect.poll(() => isEntryChecked("Arroz")).toBe(true);
  await expect.poll(() => isEntryChecked("Azeite")).toBe(true);
  await expect(page.getByRole("button", { name: /Finalizar compra \(2\)/ })).toBeEnabled();
});

test("mutação persistida é retomada do IndexedDB depois de recarregar", async ({ page, context }) => {
  await openLista(page);
  await context.setOffline(true);
  await entry(page, "Sorvete").click();
  await expect(page.getByText("1 alteração aguardando sinal")).toBeVisible();
  // Espera o persister (throttle de 1 s) gravar a mutação pausada.
  await expect.poll(() => persistedPausedMutations(page)).toBe(1);

  // Fecha a aba ainda offline: se ela voltasse ao ar, a própria aba enviaria a mutação
  // e o teste não provaria a retomada a partir do IndexedDB.
  await page.close();
  await context.setOffline(false);
  const reopened = await context.newPage();
  await reopened.goto(`/${A1}/lista`);

  await expect.poll(() => isEntryChecked("Sorvete")).toBe(true);
  await expect(entry(reopened, "Sorvete")).toHaveAttribute("aria-pressed", "true");
});
