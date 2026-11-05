import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { entry, waitForHydration } from "./helpers/app";
import { authStatePath } from "./helpers/auth";
import { A1, adminClient, resetFixture } from "./helpers/db";

const BASE_URL = "http://localhost:3000";

test.beforeEach(async () => {
  await resetFixture();
});

async function pageFor(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: BASE_URL,
    storageState: authStatePath(email),
  });
  return context.newPage();
}

async function generateInvite(page: Page): Promise<string> {
  await page.goto(`/${A1}/casa`);
  await page.getByRole("button", { name: "Gerar link de convite" }).click();
  const link = page.getByLabel("Link de convite");
  await expect(link).toHaveValue(/\/convite\/.+/);
  return link.inputValue();
}

test("owner gera o link e o convidado entra na casa", async ({ browser }) => {
  const lucas = await pageFor(browser, "lucas@cari.test");
  const url = await generateInvite(lucas);
  await expect(lucas.getByText(/Vale até \d{2}\/\d{2}/)).toBeVisible();

  const convidado = await pageFor(browser, "convidado@cari.test");
  await convidado.goto(url);
  await expect(convidado.getByText("Entrar na casa?")).toBeVisible();
  await convidado.getByRole("button", { name: "Entrar" }).click();
  await expect(convidado).toHaveURL(new RegExp(`/${A1}/lista`));
  await expect(convidado.getByRole("button", { name: /Casa Lucas & Ana/ })).toBeVisible();
});

test("convite revogado mostra a fala da Cari", async ({ browser }) => {
  const lucas = await pageFor(browser, "lucas@cari.test");
  const url = await generateInvite(lucas);
  await lucas.getByRole("button", { name: "Revogar" }).click();
  await expect(lucas.getByLabel("Link de convite")).toHaveCount(0);

  const convidado = await pageFor(browser, "convidado@cari.test");
  await convidado.goto(url);
  await convidado.getByRole("button", { name: "Entrar" }).click();
  await expect(
    convidado.getByText("Não encontrei esse convite. Pede um link novo pra quem te chamou?"),
  ).toBeVisible();
});

test("sem sessão, o convite passa pelo login e volta", async ({ browser }) => {
  const lucas = await pageFor(browser, "lucas@cari.test");
  const url = await generateInvite(lucas);
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE_URL });
  const anon = await context.newPage();
  await anon.goto(url);
  await expect(anon).toHaveURL(/\/login\?next=%2Fconvite%2F/);
});

test("membro comum não gerencia convites", async ({ browser }) => {
  const ana = await pageFor(browser, "ana@cari.test");
  await ana.goto(`/${A1}/casa`);
  await expect(ana.getByRole("heading", { name: "Casa" })).toBeVisible();
  await expect(ana.getByText("Lucas", { exact: true })).toBeVisible();
  await expect(ana.getByRole("button", { name: "Gerar link de convite" })).toHaveCount(0);
  await expect(ana.getByRole("button", { name: /^Ações de/ })).toHaveCount(0);
});

test("último dono não consegue sair", async ({ browser }) => {
  const lucas = await pageFor(browser, "lucas@cari.test");
  await lucas.goto(`/${A1}/casa`);
  await lucas.getByRole("button", { name: "Sair da casa" }).click();
  await expect(lucas.getByText(/Você vai precisar de um novo convite para voltar/)).toBeVisible();
  await lucas.getByRole("button", { name: "Sim, sair" }).click();
  await expect(
    lucas.getByText("Antes de sair, passe a casa para outra pessoa (torne alguém dono)."),
  ).toBeVisible();
});

test("owner promove e remove membro; renomeia a casa", async ({ browser }) => {
  const lucas = await pageFor(browser, "lucas@cari.test");
  await lucas.goto(`/${A1}/casa`);
  await lucas.getByLabel("Nome da casa").fill("Lar Doce Lar");
  await lucas.getByRole("button", { name: "Salvar nome" }).click();
  await expect(lucas.getByRole("button", { name: /Lar Doce Lar/ })).toBeVisible();

  await lucas.getByRole("button", { name: "Ações de Ana" }).click();
  await lucas.getByRole("menuitem", { name: "Tornar dono" }).click();
  await expect(lucas.getByText("Dono").nth(1)).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await adminClient().from("household_members").select("role").eq("household_id", A1);
      return data?.filter((m) => m.role === "owner").length;
    })
    .toBe(2);

  await lucas.getByRole("button", { name: "Ações de Ana" }).click();
  await lucas.getByRole("menuitem", { name: "Remover" }).click();
  await expect(lucas.getByRole("button", { name: "Ações de Ana" })).toHaveCount(0);
});

test("/casa mostra quem entrou depois de o cache de membros já existir", async ({ browser }) => {
  const lucas = await pageFor(browser, "lucas@cari.test");
  await lucas.goto(`/${A1}/lista`);
  await waitForHydration(lucas);
  await expect(entry(lucas, "Arroz")).toBeVisible();
  // Impede o Realtime de entregar a mudança: o /casa precisa vencer o cache sozinho.
  await lucas.context().setOffline(true);
  const { error } = await adminClient()
    .from("household_members")
    .insert({ household_id: A1, user_id: "00000000-0000-0000-0000-0000000000b5", role: "member" });
  if (error) throw error;
  await lucas.context().setOffline(false);
  await lucas.getByRole("button", { name: "Menu da conta" }).click();
  await lucas.getByRole("menuitem", { name: "Gerenciar casa" }).click();
  await expect(lucas.getByText("Convidado", { exact: true })).toBeVisible();
});
