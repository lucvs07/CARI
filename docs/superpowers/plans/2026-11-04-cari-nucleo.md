# CARI v2 — Núcleo: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o CARI como PWA Next.js + Supabase com casas compartilhadas, estoque, lista de compras em tempo real tolerante a falta de sinal e a Cari como voz do app.

**Architecture:** Regras de negócio e autorização ficam no Postgres (RLS, trigger, RPCs), testadas com pgTAP. O front Next.js (App Router) carrega os dados no servidor, mantém cache no cliente com TanStack Query (persistido em IndexedDB) e aplica os eventos do Supabase Realtime nesse cache. O Serwist entrega o PWA e o cache de navegação da Lista.

**Tech Stack:** Next.js 16.x, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui (+ sonner), Supabase (Postgres, Auth via `@supabase/ssr`, Realtime) via CLI `supabase` 3.x como devDependency, TanStack Query 5 + `@tanstack/query-async-storage-persister` + `idb-keyval`, Serwist 9 (`@serwist/next`), Vitest, Playwright, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-04-cari-nucleo-design.md`. Leia a spec inteira antes de qualquer tarefa; as seções são referenciadas como "spec §N".

## Global Constraints

- Gerenciador de pacotes: **npm**. Node ≥ 24. Supabase CLI sempre via `npx supabase`.
- TypeScript `strict: true`. Sem `any` explícito.
- Todo texto de UI em **pt-BR**. As falas da Cari e as mensagens de erro saem **somente** de `features/cari/messages.ts` (Tarefa 8).
- Unidades: enum `kg | g | L | ml | un`. Passos do −/+: `un` = 1, `kg`/`L` = 0,5, `g`/`ml` = 100. Mínimo 0.
- Categorias (ordem de exibição): `hortifruti, carnes, laticinios, padaria, mercearia, bebidas, congelados, limpeza, higiene, outros`. Default `outros`.
- Limites: nome da casa 1–60 caracteres; nome de item 1–80 (após trim); `quantity numeric(10,3) >= 0`.
- Convite: token de 32 bytes aleatórios em base64url, validade de 7 dias, um link ativo por casa.
- Erros de RPC (texto exato em `raise exception`): `invite_invalid`, `invite_expired`, `last_owner`, `entry_invalid`.
- Alvos de toque ≥ 44 px (abas do rodapé ≥ 48 px). Avisos com Desfazer duram **6000 ms** e usam `role="status"`.
- Nenhuma `service_role` key no front. O front usa apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Rotas: `/login`, `/auth/callback`, `/bem-vindo`, `/convite/[token]`, `/[householdId]/(estoque|lista|receitas|casa)`. Destino padrão de uma casa: `/[householdId]/lista`.
- Query keys: `['items', householdId]`, `['list', householdId]`, `['members', householdId]`, `['households']`.
- Fonte Chillax via `next/font/local` nos pesos 400, 500 e 600.
- Paleta: exatamente a tabela da spec §9.
- Commits em português no formato `tipo: descrição`, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Vírgula decimal:** digitar `1,5` num campo de quantidade precisa valer 1,5 (não 15 nem NaN). → teste em `lib/units.test.ts` (Tarefa 2).
2. **Deriva de ponto flutuante no −/+:** 1,5 kg − 0,5 três vezes precisa dar exatamente `0`, e não `-0.0000001` nem `1e-16`; senão o trigger de "acabou" não dispara. → teste em `lib/units.test.ts` (Tarefa 2).
3. **Finalizar a mesma compra em dois celulares:** a segunda chamada recebe `entry_invalid`; a UI mostra "Alguém da casa já guardou essa compra." e recarrega a lista, sem somar em dobro. → pgTAP na Tarefa 6 e mapeamento de erro na Tarefa 9.
4. **Nome só com espaços ou com mais de 80 caracteres:** o formulário bloqueia, e o banco rejeita se passar. → pgTAP na Tarefa 3 e teste de schema na Tarefa 10.
5. **Celular compartilhado na família:** ao sair da conta, o cache persistido (IndexedDB), a fila de mutações pendentes e o cache `cari-lista` do service worker são apagados, e a sessão é encerrada só naquele aparelho (`scope: 'local'`), para que a próxima pessoa não veja a casa de outra. → E2E na Tarefa 7.

---

## Estrutura de arquivos

```
app/
  layout.tsx                      fontes, tema, providers
  globals.css                     tokens (spec §9) + Tailwind
  page.tsx                        redirect: sem sessão → /login; com casa → /[id]/lista; sem casa → /bem-vindo
  login/page.tsx
  auth/callback/route.ts          troca o code OAuth/magic link por sessão
  bem-vindo/page.tsx
  convite/[token]/page.tsx
  offline/page.tsx                fallback do service worker
  (app)/[householdId]/layout.tsx  guarda de membro + AppShell + RealtimeBridge
  (app)/[householdId]/estoque/page.tsx
  (app)/[householdId]/lista/page.tsx
  (app)/[householdId]/receitas/page.tsx
  (app)/[householdId]/casa/page.tsx
  sw.ts                           service worker Serwist
  manifest.ts
proxy.ts                          renovação de sessão (@supabase/ssr)
components/ui/                    shadcn (button, sheet, dropdown-menu, input, select, sonner, avatar, command)
features/
  cari/        messages.ts, CariSays.tsx, CariAvatar.tsx
  shell/       AppShell.tsx, BottomTabs.tsx, HouseholdSwitcher.tsx, UserMenu.tsx, ThemeToggle.tsx, PendingSyncChip.tsx
  households/  actions.ts, queries.ts, CreateHouseholdForm.tsx, InvitePanel.tsx, MembersList.tsx, LeaveHouseholdButton.tsx
  inventory/   queries.ts, mutations.ts, InventoryScreen.tsx, InventoryRow.tsx, QuickAddSheet.tsx, EditItemSheet.tsx, schema.ts
  shopping/    queries.ts, mutations.ts, ShoppingScreen.tsx, ShoppingRow.tsx, FinishShoppingSheet.tsx
lib/
  units.ts, categories.ts, errors.ts
  supabase/    server.ts, browser.ts, proxy.ts, database.types.ts (gerado)
  query/       client.ts, persist.ts, Providers.tsx, realtime.ts, useHouseholdRealtime.ts
supabase/
  config.toml
  migrations/  0001_schema.sql, 0002_rls.sql, 0003_household_rpcs.sql, 0004_inventory_rules.sql
  seed.sql
  seeds/test_helpers.sql
  tests/       *.test.sql (pgTAP)
e2e/
  helpers/auth.ts, helpers/db.ts
  *.spec.ts
.github/workflows/  ci.yml, migrate.yml, keepalive.yml, backup.yml
```

---

### Task 1: Transição do TCC e scaffold do projeto

**Files:**
- Delete: `css/`, `js/`, `pages/`, `php/`, `img/` (exceto `img/logo.svg`), `.hintrc`
- Move: `img/logo.svg` → `public/cari/cari.svg`
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `app/layout.tsx`, `app/page.tsx` (temporário), `supabase/config.toml` (via `npx supabase init`), `.env.example`, `.gitignore`, `README.md` (substitui `readme.md`), `lib/smoke.test.ts`

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `start`, `lint`, `typecheck`, `test` (vitest run), `test:e2e` (playwright), `db:start`, `db:reset`, `db:test` (`supabase test db`), `db:types` (`supabase gen types typescript --local > lib/supabase/database.types.ts`).

- [ ] **Step 1: Criar a tag do TCC (local, sem push)**

Run: `git tag tcc-2023 0bba547 && git tag -l`
Expected: `tcc-2023` listada. O push da tag fica para o usuário.

- [ ] **Step 2: Remover o código legado e mover a ilustração**

Run: `git mv img/logo.svg public/cari/cari.svg` (crie `public/cari/` antes), depois `git rm -r css js pages php img .hintrc` e `git mv readme.md README.md`.
Expected: `git ls-files` lista apenas `README.md`, `docs/**` e `public/cari/cari.svg`.

- [ ] **Step 3: Gerar o app Next.js na raiz**

Run: `npx create-next-app@16 . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack` (se o CLI reclamar da pasta não vazia, gere numa pasta temporária do scratchpad e copie os arquivos para a raiz).
Depois: `npx shadcn@latest init` (base color neutra, CSS variables) e `npx shadcn@latest add button sheet dropdown-menu input select sonner avatar command label`.
Instale: `npm i @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister idb-keyval zod` e `npm i -D supabase vitest @vitejs/plugin-react jsdom @testing-library/react @playwright/test @serwist/next serwist`.

- [ ] **Step 4: Configurar Vitest, Playwright e Supabase**

- `vitest.config.ts`: `environment: 'jsdom'`, `include: ['**/*.test.ts', '**/*.test.tsx']`, `exclude: ['e2e/**', 'node_modules/**']`, alias `@` → raiz.
- `playwright.config.ts`: `testDir: 'e2e'`, `baseURL: 'http://localhost:3000'`, `webServer: { command: 'npm run build && npm run start', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 180_000 }`, projeto único Chromium com viewport de celular (`devices['Pixel 7']`), **`workers: 1` e `fullyParallel: false`** (os testes compartilham o banco local), `globalSetup: './e2e/global-setup.ts'`.
- `npx supabase init`. No `supabase/config.toml`: `[auth] site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/auth/callback"]`; `[auth.email] enable_signup = true`; `[db.seed] sql_paths = ["./seed.sql", "./seeds/test_helpers.sql"]`. O Google OAuth fica configurado só no projeto cloud; localmente, apenas o magic link.
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` e `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (preencher com a saída de `npx supabase status`).
- `tsconfig.json`: `"strict": true`.

- [ ] **Step 5: Teste de fumaça**

`lib/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
Run: `npm run lint && npm run typecheck && npm test`
Expected: tudo passa.

- [ ] **Step 6: README**

Reescreva o `README.md` com: o que é o CARI v2 (2–3 frases); pré-requisitos (Node 24, Docker); como rodar (`npm i`, `npm run db:start`, copiar `.env.example` → `.env.local` com a anon key, `npm run dev`); como testar (`npm test`, `npm run db:test`, `npm run test:e2e`); seção "História" com o link `https://github.com/lucvs07/CARI/tree/tcc-2023` e os 4 integrantes originais do TCC (copie a lista do readme antigo). Mantenha o bloco `<!-- portfolio:pt -->`, com o texto atualizado: "PWA para organizar estoque e lista de compras da casa, compartilhado em família. Evolução do TCC da Etec Parque Belém."

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: remove código do TCC e cria scaffold Next.js + Supabase"
```

---

### Task 2: Unidades, quantidades e categorias (lógica pura)

**Files:**
- Create: `lib/units.ts`, `lib/categories.ts`
- Test: `lib/units.test.ts`, `lib/categories.test.ts`

**Interfaces:**
- Produces:
  - `type Unit = 'kg' | 'g' | 'L' | 'ml' | 'un'`; `UNITS: readonly Unit[]`
  - `stepFor(unit: Unit): number`
  - `stepQuantity(q: number, unit: Unit, dir: 1 | -1): number`: soma ou subtrai o passo, arredonda para 3 casas e limita a mínimo 0
  - `parseQuantity(input: string): number | null`: aceita `,` ou `.` como separador decimal; retorna `null` se for inválido ou negativo
  - `formatQuantity(q: number, unit: Unit): string`: `Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })` + espaço + unidade
  - `defaultPurchaseQuantity(desired: number | null, unit: Unit): number`: `desired ?? stepFor(unit)`
  - `type Category`; `CATEGORIES: readonly Category[]` (ordem dos Global Constraints); `CATEGORY_LABELS: Record<Category, string>` (`hortifruti: 'Hortifrúti', carnes: 'Carnes', laticinios: 'Laticínios', padaria: 'Padaria', mercearia: 'Mercearia', bebidas: 'Bebidas', congelados: 'Congelados', limpeza: 'Limpeza', higiene: 'Higiene', outros: 'Outros'`)

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/units.test.ts
test('stepFor', () => {
  expect(stepFor('un')).toBe(1); expect(stepFor('kg')).toBe(0.5); expect(stepFor('L')).toBe(0.5)
  expect(stepFor('g')).toBe(100); expect(stepFor('ml')).toBe(100)
})
test('stepQuantity limita em 0', () => { expect(stepQuantity(0.3, 'kg', -1)).toBe(0) })
test('stepQuantity sem deriva de ponto flutuante', () => {
  let q = 1.5; for (let i = 0; i < 3; i++) q = stepQuantity(q, 'kg', -1)
  expect(q).toBe(0)
  expect(stepQuantity(0.1 + 0.2, 'un', 1)).toBe(1.3)
})
test('parseQuantity aceita vírgula', () => {
  expect(parseQuantity('1,5')).toBe(1.5); expect(parseQuantity('2.25')).toBe(2.25)
  expect(parseQuantity(' 3 ')).toBe(3); expect(parseQuantity('')).toBeNull()
  expect(parseQuantity('abc')).toBeNull(); expect(parseQuantity('-1')).toBeNull()
})
test('formatQuantity pt-BR', () => {
  expect(formatQuantity(1.5, 'kg')).toBe('1,5 kg'); expect(formatQuantity(2, 'un')).toBe('2 un')
})
test('defaultPurchaseQuantity', () => {
  expect(defaultPurchaseQuantity(null, 'g')).toBe(100); expect(defaultPurchaseQuantity(3, 'un')).toBe(3)
})
// lib/categories.test.ts
test('ordem e rótulos', () => {
  expect(CATEGORIES[0]).toBe('hortifruti'); expect(CATEGORIES.at(-1)).toBe('outros')
  expect(CATEGORY_LABELS.laticinios).toBe('Laticínios')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/` → FAIL (módulos inexistentes)

- [ ] **Step 3: Implementar `lib/units.ts` e `lib/categories.ts`**

Arredonde com `Math.round(x * 1000) / 1000` e normalize `-0` para `0`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/` → PASS

- [ ] **Step 5: Commit** — `feat: unidades, quantidades e categorias`

---

### Task 3: Schema do banco

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/seeds/test_helpers.sql`, `supabase/seed.sql`
- Test: `supabase/tests/schema.test.sql`

**Interfaces:**
- Produces: tabelas, tipos e constraints exatamente como na spec §5 ("Tipos" e "Tabelas"), mais:
  - `public.normalize_name(text) returns text language sql immutable`: `lower(extensions.unaccent(trim($1)))` (crie a extensão `unaccent` no schema `extensions`)
  - `items.name_key text generated always as (public.normalize_name(name)) stored`
  - checks: `char_length(trim(households.name)) between 1 and 60`; `char_length(trim(items.name)) between 1 and 80`; o mesmo limite em `shopping_list_entries.name`; `category in (...)` nas duas tabelas
  - trigger `on_auth_user_created` em `auth.users` → insere `profiles(id, display_name)` com `coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))`
  - trigger `set_updated_at` (before update) em todas as tabelas com `updated_at`
  - helpers de teste (só local, via `seeds/test_helpers.sql`): `tests.login_as(p_email text)` (`set local role authenticated` + `set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)`) e `tests.logout()` (`reset role`), mais `tests.reset_fixture()` (`security definer`): restaura itens, entradas, membros e convites da casa a1 para o estado exato do seed e apaga todas as casas que não sejam a a1. Os dados do seed ficam em um só lugar: `seed.sql` chama `select tests.reset_fixture()` depois de criar os usuários
  - seed (`seed.sql`): usuários `lucas@cari.test` (Lucas), `ana@cari.test` (Ana), `intruso@cari.test` (Intruso: só para testes de isolamento, nunca entra em casa nenhuma nos E2E), `novo@cari.test` (Novo: onboarding) e `convidado@cari.test` (Convidado: aceita convites nos E2E), com e-mail confirmado e linha em `auth.identities`; casa "Casa Lucas & Ana" com id fixo `00000000-0000-0000-0000-0000000000a1`, Lucas como owner e Ana como member; itens exatamente: Leite 2 L (laticinios), Iogurte 0 un (laticinios), Arroz 0 kg (mercearia), Feijão 1 kg (mercearia), Macarrão 2 un (mercearia), Ovos 6 un (laticinios), Pão de forma 1 un (padaria), Banana 6 un (hortifruti), Tomate 0,5 kg (hortifruti), Frango 1 kg (carnes), Água 6 L (bebidas), Detergente 0 un (limpeza), Sabão em pó 1 un (limpeza), Papel higiênico 4 un (higiene), Pasta de dente 1 un (higiene). Entradas de lista exatamente: Arroz (ligada, 2 kg), Iogurte (ligada, quantidade nula), Detergente (ligada, 1 un), Azeite (avulsa, 1 un, mercearia), Sorvete (avulsa, quantidade nula, congelados); todas `checked = false` e `added_by` = Ana. Não use `Café` nem `Fermento` no seed (os testes os criam). O seed roda como superusuário; insira membros diretamente.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

```sql
-- supabase/tests/schema.test.sql
begin; select plan(6);
select has_table('public','items','items existe');
select is(public.normalize_name('  Leíte '), 'leite', 'normaliza acento/caixa/espaços');
select throws_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1','LEITE','L')$$, '23505', null, 'duplicata por name_key');
select throws_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1','   ','un')$$, '23514', null, 'nome só com espaços');
select throws_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1', repeat('a',81),'un')$$, '23514', null, 'nome > 80');
select ok(exists(select 1 from profiles p join auth.users u on u.id=p.id where u.email='ana@cari.test' and p.display_name is not null), 'profile criado por trigger');
select * from finish(); rollback;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run db:start && npm run db:reset && npm run db:test` → FAIL (tabelas inexistentes)

- [ ] **Step 3: Escrever `0001_schema.sql`, `seed.sql` e `seeds/test_helpers.sql`** conforme as Interfaces.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run db:reset && npm run db:test` → PASS. Depois `npm run db:types` e confirme que `lib/supabase/database.types.ts` contém `items`.

- [ ] **Step 5: Commit** — `feat(db): schema do núcleo, seed e helpers de teste`

---

### Task 4: RLS

**Files:**
- Create: `supabase/migrations/0002_rls.sql`
- Test: `supabase/tests/rls.test.sql`

**Interfaces:**
- Consumes: tabelas da Tarefa 3, `tests.login_as`.
- Produces: `public.is_member(p_household_id uuid) returns boolean` (`security definer`, `stable`, `set search_path = ''`), `public.is_owner(p_household_id uuid) returns boolean` (mesmo padrão) e as policies exatamente como na spec §5 "Regras no banco" (RLS).

- [ ] **Step 1: Escrever o teste que falha**

`rls.test.sql` usa `tests.login_as('intruso@cari.test')` e verifica:
- `is_empty('select * from items')`, `is_empty('select * from shopping_list_entries')`, `is_empty('select * from households')`;
- `throws_ok` em insert de item na casa a1 (código `42501`);
- `update items set quantity = 9` em a1 afeta 0 linhas.

Com `login_as('ana@cari.test')`:
- `isnt_empty('select * from items')`;
- insert de item funciona;
- `is_empty('select * from household_invites')` (member não vê convites);
- `update household_members set role='owner'` afeta 0 linhas;
- `select display_name from profiles` retorna 2 linhas (ela mesma e Lucas, mas não o Intruso).

Com `login_as('lucas@cari.test')`:
- delete do membro Ana funciona (owner remove). Rode essa verificação por último, dentro da mesma transação com rollback.

- [ ] **Step 2: Rodar e ver falhar** — `npm run db:test` → FAIL

- [ ] **Step 3: Implementar `0002_rls.sql`**

- [ ] **Step 4: Rodar e ver passar** — `npm run db:reset && npm run db:test` → PASS

- [ ] **Step 5: Commit** — `feat(db): RLS por casa`

---

### Task 5: RPCs de casa e convite

**Files:**
- Create: `supabase/migrations/0003_household_rpcs.sql`
- Test: `supabase/tests/household_rpcs.test.sql`

**Interfaces:**
- Produces (assinaturas e semântica conforme spec §5 "RPCs"):
  - `create_household(p_name text) returns uuid` — `security definer`
  - `create_invite(p_household_id uuid) returns text` — invoker; exige `is_owner`; token = `translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_')` (aqui o `=` é removido, porque `translate` apaga caracteres sem par); `expires_at = now() + interval '7 days'`
  - `accept_invite(p_token text) returns uuid` — `security definer`
  - `leave_household(p_household_id uuid) returns void` — `security definer`
  - Todas as `security definer` usam `set search_path = ''`, nomes totalmente qualificados e checam `auth.uid() is not null`.

- [ ] **Step 1: Escrever o teste que falha**

Casos, cada um com `login_as`:
1. Intruso: `create_household('Casa do Intruso')` retorna um uuid; ele vira `owner`; `profiles.last_household_id` = esse id.
2. Lucas: `create_invite(a1)` duas vezes → só 1 convite com `revoked_at is null`; o token tem 43 caracteres.
3. Ana: `create_invite(a1)` → `throws_ok` (member não pode).
4. Intruso: `accept_invite(<token ativo>)` → vira member de a1; chamar de novo não dá erro e não duplica.
5. `accept_invite('nao-existe')` → `throws_ok(..., 'P0001', 'invite_invalid')`; token revogado → `invite_invalid`; token com `expires_at` no passado (ajuste como superusuário antes do `login_as`) → `invite_expired`.
6. Lucas (único owner, com Ana na casa): `leave_household(a1)` → `last_owner`.
7. Intruso sozinho na casa que criou: `leave_household(<id>)` → a casa deixa de existir.

- [ ] **Step 2: Rodar e ver falhar** — `npm run db:test` → FAIL

- [ ] **Step 3: Implementar `0003_household_rpcs.sql`**

- [ ] **Step 4: Rodar e ver passar** — `npm run db:reset && npm run db:test` → PASS

- [ ] **Step 5: Commit** — `feat(db): RPCs de casa e convite`

---

### Task 6: Regras de estoque e lista (trigger + finish_shopping + realtime)

**Files:**
- Create: `supabase/migrations/0004_inventory_rules.sql`
- Test: `supabase/tests/inventory_rules.test.sql`

**Interfaces:**
- Produces:
  - trigger `items_to_list_when_empty` (spec §5), com `added_by = coalesce(auth.uid(), new.updated_by)`
  - `finish_shopping(p_household_id uuid, p_entries jsonb) returns int` — invoker; `p_entries = [{"entry_id": uuid, "quantity": number}]`. Semântica na spec §5. Quantidade ≤ 0 → `entry_invalid`. A função começa travando as entradas (`select ... from shopping_list_entries where id = any(<ids>) and household_id = p_household_id for update`): uma segunda chamada simultânea espera, não encontra mais as linhas e recebe `entry_invalid`, sem somar em dobro
  - `alter publication supabase_realtime add table public.items, public.shopping_list_entries;`

- [ ] **Step 1: Escrever o teste que falha** (como Ana em a1)

1. `update items set quantity = 0 where name = 'Leite'` → existe 1 entrada com `item_id` do Leite e `quantity is null`. Repetir 2 → 0 → 2 → 0 não cria uma segunda entrada.
2. Marque a entrada do Leite e uma avulsa `'Fermento'` (`un`). Chame `finish_shopping(a1, '[{"entry_id":<leite>,"quantity":2},{"entry_id":<fermento>,"quantity":1}]')`:
   - retorna 2;
   - Leite = 2;
   - existe o item `Fermento` com quantidade 1;
   - as duas entradas foram apagadas.
3. Entrada avulsa `'leite'` (minúsculo) marcada com quantidade 1 → soma no item `Leite` existente (vira 3), sem criar item novo.
4. Chamar de novo com os mesmos `entry_id`s → `throws_ok(..., 'entry_invalid')` (cenário "dois celulares", Review Focus 3).
5. Entrada não marcada → `entry_invalid`, e nada muda (atomicidade: compare a quantidade do Leite antes e depois).
6. `quantity: 0` → `entry_invalid`.
7. Como Intruso: `finish_shopping(a1, ...)` com uma entrada válida da casa → `entry_invalid` (o RLS a esconde).

- [ ] **Step 2: Rodar e ver falhar** — `npm run db:test` → FAIL

- [ ] **Step 3: Implementar `0004_inventory_rules.sql`**

- [ ] **Step 4: Rodar e ver passar** — `npm run db:reset && npm run db:test && npm run db:types` → PASS

- [ ] **Step 5: Commit** — `feat(db): trigger de acabou, finish_shopping e publicação realtime`

---

### Task 7: Clientes Supabase e autenticação

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/page.tsx` (substitui o temporário), `features/shell/UserMenu.tsx` (só a ação Sair por enquanto), `lib/query/persist.ts` (somente `clearPersistedCache`)
- Test: `e2e/helpers/auth.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Produces:
  - `createServerSupabase(): Promise<SupabaseClient<Database>>` (server.ts, com os cookies de `next/headers`)
  - `getBrowserSupabase(): SupabaseClient<Database>` (singleton)
  - `updateSession(request: NextRequest): Promise<NextResponse>` (lib/supabase/proxy.ts), usado por `proxy.ts` na raiz. No Next 16 o arquivo de middleware se chama `proxy.ts` e exporta `proxy`; se a versão instalada ainda exigir `middleware.ts`, use esse nome. Matcher exclui `_next/static`, `_next/image`, `sw.js`, `manifest.webmanifest`, `cari/` e `offline`.
  - `requireUser(): Promise<User>` (server.ts): redireciona para `/login?next=<path>` se não houver sessão
  - `clearPersistedCache(): Promise<void>` (lib/query/persist.ts): apaga a chave do IndexedDB usada pelo persister (`cari-query-cache`)
  - `signOut()` no UserMenu: `queryClient.clear()` → `clearPersistedCache()` → `caches.delete('cari-lista')` (quando `'caches' in window`) → `supabase.auth.signOut({ scope: 'local' })` (não revoga as sessões nos outros aparelhos) → `router.replace('/login')`
  - Login: botões "Entrar com Google" (`signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/callback?next=...' } })`) e "Receber link por e-mail" (`signInWithOtp`, com `emailRedirectTo` para o callback). Após enviar: "Te mandei um link! Confere seu e-mail."
  - `/auth/callback`: `exchangeCodeForSession(code)` → redirect para `next` (validado como path relativo) ou `/`
  - `app/page.tsx`: lê `profiles.last_household_id`; se a pessoa é membro → `/[id]/lista`; se não, mas tem outra casa → a primeira; sem casa → `/bem-vindo`
  - `e2e/helpers/auth.ts`: `loginViaMagicLink(page: Page, email: string): Promise<void>`. Preenche o e-mail em `/login`, busca a última mensagem para aquele destinatário no Mailpit (`http://127.0.0.1:54324/api/v1/search?query=to:<email>` e `/api/v1/message/{ID}`), extrai o link e navega até ele.
  - `e2e/global-setup.ts`: faz `loginViaMagicLink` uma vez para cada usuário do seed e salva `e2e/.auth/<nome>.json` (`storageState`; adicione `e2e/.auth/` ao `.gitignore`).
  - `loginAs(page: Page, email: string): Promise<void>`: aplica os cookies do `storageState` salvo ao `page.context()` e navega até `/`. Para testes com dois usuários, use `browser.newContext({ storageState: 'e2e/.auth/<nome>.json' })`.
  - `e2e/helpers/db.ts`: `adminClient()` (supabase-js com a service role local, só nos testes) e `resetFixture()` (`rpc('reset_fixture')` exposto no schema `tests`, ou SQL direto via `psql` na porta 54322). **Todo arquivo `e2e/*.spec.ts` chama `resetFixture()` em `test.beforeEach`.** O `auth.spec.ts` é o único que usa `loginViaMagicLink` diretamente.

- [ ] **Step 1: Escrever os E2E que falham**

```ts
// e2e/auth.spec.ts
test('sem sessão vai para /login', async ({ page }) => {
  await page.goto('/'); await expect(page).toHaveURL(/\/login/)
})
test('login por magic link abre a lista da casa', async ({ page }) => {
  await loginAs(page, 'ana@cari.test')
  await expect(page).toHaveURL(/\/00000000-0000-0000-0000-0000000000a1\/lista/)
})
test('sair apaga o cache persistido', async ({ page }) => {
  await loginAs(page, 'ana@cari.test')
  await page.getByRole('button', { name: 'Menu da conta' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login/)
  const keys = await page.evaluate(() => new Promise<string[]>(r => {
    const req = indexedDB.open('keyval-store'); req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('keyval')) return r([])
      const g = db.transaction('keyval').objectStore('keyval').getAllKeys(); g.onsuccess = () => r(g.result as string[])
    }}))
  expect(keys).not.toContain('cari-query-cache')
  expect(await page.evaluate(() => caches.has('cari-lista'))).toBe(false)
})
test('sair não derruba a sessão em outro aparelho', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext()
  const pa = await a.newPage(), pb = await b.newPage()
  await loginViaMagicLink(pa, 'ana@cari.test'); await loginViaMagicLink(pb, 'ana@cari.test')
  await pa.getByRole('button', { name: 'Menu da conta' }).click()
  await pa.getByRole('menuitem', { name: 'Sair' }).click()
  await pb.reload(); await expect(pb).toHaveURL(/\/lista/)
})
```

Neste arquivo, use `loginViaMagicLink` no lugar de `loginAs`. Para a página `/[id]/lista` existir nesta tarefa, crie `app/(app)/[householdId]/lista/page.tsx` mínima (um `<h1>Lista</h1>`), com o UserMenu num header provisório; a Tarefa 8 substitui pelo AppShell.

- [ ] **Step 2: Rodar e ver falhar** — `npx playwright test e2e/auth.spec.ts` → FAIL

- [ ] **Step 3: Implementar** os arquivos das Interfaces.

- [ ] **Step 4: Rodar e ver passar** — `npm run db:reset && npx playwright test e2e/auth.spec.ts` → PASS

- [ ] **Step 5: Commit** — `feat: autenticação com magic link/Google e sessão via proxy`

---

### Task 8: Tema, Cari, AppShell, boas-vindas e guarda de membro

**Files:**
- Create: `app/globals.css` (tokens), `app/layout.tsx` (fontes e `<Toaster duration={6000} />`), `public/fonts/chillax/*.woff2`, `features/cari/messages.ts`, `features/cari/CariSays.tsx`, `features/cari/CariAvatar.tsx`, `features/shell/*`, `app/(app)/[householdId]/layout.tsx`, `app/(app)/[householdId]/receitas/page.tsx`, `app/bem-vindo/page.tsx`, `features/households/CreateHouseholdForm.tsx`, `features/households/actions.ts`, `features/households/queries.ts`
- Test: `features/cari/messages.test.ts`, `e2e/onboarding.spec.ts`, `e2e/isolation.spec.ts`

**Interfaces:**
- Consumes: `requireUser`, `createServerSupabase` (Tarefa 7); RPC `create_household`.
- Produces:
  - Tokens CSS de **toda** a tabela da spec §9 (`--primary`, `--on-primary`, `--primary-hover`, `--secondary`, `--surface`, `--surface-container-low`, `--surface-variant`, `--on-surface`, `--error`, `--on-error`), mapeados para as variáveis do shadcn (`--background` = surface, `--foreground` = on-surface, `--primary`, `--primary-foreground` = on-primary, `--muted` = surface-container-low, `--border` = surface-variant, `--destructive` = error). Escuro via `.dark` e `prefers-color-scheme`.
  - `ThemeToggle`: Sistema/Claro/Escuro, salvo em `localStorage['cari-theme']`, com script inline no `<head>` para evitar flash.
  - `features/cari/messages.ts`: `export const cari = { ... } as const` com estas strings exatas:
    - `welcome: 'Oi, eu sou a Cari! Vamos criar sua casa?'`
    - `emptyInventory: 'Sua despensa está vazia. Me conta o que tem aí?'`
    - `emptyList: 'Nada para comprar 🎉'`
    - `recipesSoon: 'Em breve vou sugerir receitas com o que você tem em casa.'`
    - `finished: (n: number) => n === 1 ? 'Prontinho! Guardei 1 item no estoque.' : \`Prontinho! Guardei ${n} itens no estoque.\``
    - `inviteExpired: 'Esse convite expirou. Pede um link novo pra quem te chamou?'`
    - `inviteInvalid: 'Não encontrei esse convite. Pede um link novo pra quem te chamou?'`
    - `offlineQueued: 'Sem sinal por aqui — guardo suas marcações e envio quando voltar.'`
    - `finishNeedsNetwork: 'Precisa de internet para guardar no estoque'`
    - `alreadyFinished: 'Alguém da casa já guardou essa compra.'`
    - `lastOwner: 'Antes de sair, passe a casa para outra pessoa (torne alguém dono).'`
    - `genericError: 'Algo deu errado. Tenta de novo?'`
    - `magicLinkSent: 'Te mandei um link! Confere seu e-mail.'`
    - `movedToList: (name: string) => \`${name} foi para a lista\``
    - `removed: 'Removido'`
    - `pendingSync: (n: number) => n === 1 ? '1 alteração aguardando sinal' : \`${n} alterações aguardando sinal\``
  - `CariSays({ message: string; action?: ReactNode })`: avatar + balão; `role="status"` quando usado como feedback.
  - `AppShell({ householdId, households, user, children })`: header com `HouseholdSwitcher` (troca → `update profiles set last_household_id` + `router.push('/[id]/lista')`) e `UserMenu` (botão com `aria-label="Menu da conta"`: Gerenciar casa, Tema, Sair); `BottomTabs` com links Estoque/Lista/Receitas (altura ≥ 48 px, `aria-current="page"` na ativa).
  - `[householdId]/layout.tsx`: `requireUser()`, busca a casa por id (RLS); se não encontrar → `redirect('/')`.
  - `/bem-vindo`: `CariSays(cari.welcome)` + `CreateHouseholdForm` (nome 1–60, validação zod) → server action `createHousehold(name: string): Promise<{ id: string }>` (em `features/households/actions.ts`, chama a RPC) → `redirect('/[id]/casa?novo=1')`, onde a Tarefa 13 mostra o convite. Até a Tarefa 13 existir, redirecione para `/[id]/lista`.
  - `features/households/queries.ts`: `useHouseholds(): Household[]` (key `['households']`) e `useMembers(householdId: string): { user_id: string; role: 'owner' | 'member'; display_name: string; avatar_url: string | null }[]` (key `['members', householdId]`, via `household_members` com join em `profiles`).
  - Receitas: `CariSays(cari.recipesSoon)`.
  - Chillax: baixe do Fontshare (`https://www.fontshare.com/fonts/chillax`) os pesos 400/500/600 em woff2 para `public/fonts/chillax/` e carregue com `next/font/local` como `--font-chillax`, aplicada a `body`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// features/cari/messages.test.ts
test('plural', () => {
  expect(cari.finished(1)).toBe('Prontinho! Guardei 1 item no estoque.')
  expect(cari.finished(12)).toBe('Prontinho! Guardei 12 itens no estoque.')
  expect(cari.pendingSync(3)).toBe('3 alterações aguardando sinal')
})
// e2e/onboarding.spec.ts
test('usuário sem casa cria a primeira', async ({ page }) => {
  await loginAs(page, 'novo@cari.test')
  await expect(page).toHaveURL(/\/bem-vindo/)
  await expect(page.getByText('Oi, eu sou a Cari! Vamos criar sua casa?')).toBeVisible()
  await page.getByLabel('Nome da casa').fill('Casa do Novo')
  await page.getByRole('button', { name: 'Criar casa' }).click()
  await expect(page.getByRole('button', { name: /Casa do Novo/ })).toBeVisible()
})
// e2e/isolation.spec.ts
test('não membro é redirecionado', async ({ page }) => {
  await loginAs(page, 'intruso@cari.test')
  await page.goto('/00000000-0000-0000-0000-0000000000a1/lista')
  await expect(page).not.toHaveURL(/0000000000a1/)
})
```


- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run features/cari && npx playwright test e2e/onboarding.spec.ts e2e/isolation.spec.ts` → FAIL

- [ ] **Step 3: Implementar** os arquivos das Interfaces.

- [ ] **Step 4: Decidir a fonte do corpo (spec §9)**

Rode `npm run dev`, abra `/[a1]/receitas` e a futura lista com viewport de celular (375 px) e itens do seed em 14–16 px. Se a Chillax 400/500 estiver legível (sem confusão entre `l`/`I`/`1` e boa leitura em 14 px), mantenha. Senão, adicione Inter via `next/font/google` como fonte de `body` e aplique Chillax só em `h1–h3`, botões e quantidades. Registre a decisão e o motivo numa linha na spec §13.

- [ ] **Step 5: Verificar contraste AA**

Para cada par usado (on-surface/surface, on-primary/primary, primary/surface, secondary/surface, on-error/error), nos dois temas, calcule a razão de contraste (script node com a fórmula WCAG de luminância relativa, salvo no scratchpad). Texto normal precisa de ≥ 4.5. Se algum par falhar, escureça ou clareie só aquele token e registre o novo valor na spec §9.

- [ ] **Step 6: Rodar e ver passar** — `npm run db:reset && npx vitest run && npx playwright test` → PASS

- [ ] **Step 7: Commit** — `feat: tema, Cari, AppShell e onboarding da primeira casa`

---

### Task 9: Infra de dados no cliente (QueryClient, persistência, realtime, erros)

**Files:**
- Create: `lib/query/client.ts`, `lib/query/persist.ts` (completa), `lib/query/Providers.tsx`, `lib/query/realtime.ts`, `lib/query/useHouseholdRealtime.ts`, `lib/errors.ts`
- Modify: `app/layout.tsx` (envolve com `Providers`), `app/(app)/[householdId]/layout.tsx` (monta `<RealtimeBridge householdId>`)
- Test: `lib/query/realtime.test.ts`, `lib/errors.test.ts`

**Interfaces:**
- Produces:
  - `makeQueryClient(): QueryClient`: `gcTime: 1000 * 60 * 60 * 24 * 7`, `staleTime: 30_000`, `retry` em mutações = 3
  - `persister` (`createAsyncStoragePersister` com `idb-keyval`, `key: 'cari-query-cache'`); `Providers` usa `PersistQueryClientProvider` com `buster: 'v1'`, `maxAge` igual ao `gcTime`, `dehydrateOptions.shouldDehydrateQuery` só para keys `items` e `list`, e `onSuccess: () => queryClient.resumePausedMutations()`
  - `type RealtimeEvent<T> = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Partial<T>; old: Partial<T> }`
  - `applyRealtimeEvent<T extends { id: string }>(rows: T[] | undefined, e: RealtimeEvent<T>): T[] | undefined`: INSERT insere se o id não existir (se existir, substitui); UPDATE substitui pelo id (insere se ausente); DELETE remove por `old.id` (ausente = no-op); `rows` undefined → retorna undefined
  - `useHouseholdRealtime(householdId: string): void`: canal `household:<id>` com `postgres_changes` em `items` → `['items', id]` e em `shopping_list_entries` → `['list', id]` (`filter: household_id=eq.<id>`); aplica `applyRealtimeEvent` via `setQueryData`; no status `SUBSCRIBED` após reconexão, invalida as duas keys
  - `type CariErrorKey = 'inviteInvalid' | 'inviteExpired' | 'lastOwner' | 'alreadyFinished' | 'duplicateItem' | 'genericError'`
  - `toCariError(err: unknown): CariErrorKey`: `message` contendo `invite_invalid` → inviteInvalid, `invite_expired` → inviteExpired, `last_owner` → lastOwner, `entry_invalid` → alreadyFinished, `code === '23505'` → duplicateItem, qualquer outro → genericError

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/query/realtime.test.ts
const a = { id: 'a', name: 'Leite' }, b = { id: 'b', name: 'Pão' }
test('insert', () => expect(applyRealtimeEvent([a], { eventType: 'INSERT', new: b, old: {} })).toEqual([a, b]))
test('insert idempotente', () => expect(applyRealtimeEvent([a], { eventType: 'INSERT', new: a, old: {} })).toEqual([a]))
test('update', () => expect(applyRealtimeEvent([a], { eventType: 'UPDATE', new: { id: 'a', name: 'Leite 2' }, old: {} })).toEqual([{ id: 'a', name: 'Leite 2' }]))
test('delete só com pk', () => expect(applyRealtimeEvent([a, b], { eventType: 'DELETE', new: {}, old: { id: 'a' } })).toEqual([b]))
test('delete de id desconhecido', () => expect(applyRealtimeEvent([a], { eventType: 'DELETE', new: {}, old: { id: 'zz' } })).toEqual([a]))
test('cache vazio', () => expect(applyRealtimeEvent(undefined, { eventType: 'INSERT', new: a, old: {} })).toBeUndefined())
// lib/errors.test.ts
test.each([
  [{ message: 'invite_expired' }, 'inviteExpired'], [{ message: 'entry_invalid' }, 'alreadyFinished'],
  [{ code: '23505', message: 'dup' }, 'duplicateItem'], [new Error('x'), 'genericError'],
])('%o → %s', (e, k) => expect(toCariError(e)).toBe(k))
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/` → FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run && npm run typecheck` → PASS

- [ ] **Step 5: Commit** — `feat: cache persistido, ponte realtime e mapeamento de erros`

---

### Task 10: Estoque

**Files:**
- Create: `features/inventory/{schema.ts,queries.ts,mutations.ts,InventoryScreen.tsx,InventoryRow.tsx,QuickAddSheet.tsx,EditItemSheet.tsx}`, `app/(app)/[householdId]/estoque/page.tsx`
- Test: `features/inventory/schema.test.ts`, `e2e/inventory.spec.ts`

**Interfaces:**
- Consumes: `lib/units`, `lib/categories`, `cari`, `toCariError`, `CariSays`, query keys.
- Produces:
  - `type Item = Database['public']['Tables']['items']['Row']`
  - `itemInputSchema` (zod): `name` com trim, 1–80; `quantity` string → `parseQuantity` não nulo; `unit ∈ UNITS`; `category ∈ CATEGORIES`
  - `useItems(householdId: string, initial?: Item[])`
  - Mutações (todas otimistas; em erro, reverte e mostra `toast.error(cari[toCariError(e)], { action: { label: 'Tentar de novo', onClick: retry } })`):
    - `useSetItemQuantity()`, variáveis `{ householdId, id, quantity }`: grava valor absoluto
    - `useMarkEmpty()`, variáveis `{ householdId, item }`: grava `quantity = 0`. Antes de gravar, consulta o banco (`select id from shopping_list_entries where item_id = $id`; o estoque é online-only) para saber se já existia entrada. **Não** use o cache `['list']`, que costuma estar vazio na tela de Estoque. Toast `cari.movedToList(item.name)` com Desfazer. O Desfazer restaura a quantidade anterior e, **só se não existia entrada antes**, apaga a entrada com aquele `item_id`
    - `useRemoveItem()`: delete; toast `cari.removed` com Desfazer, que reinsere a linha original (mesmo `id`)
    - `useUpsertItem()`, variáveis `{ householdId, name, quantity, unit, category, existingId? }`: com `existingId` soma a quantidade; sem ele, insert com `id = crypto.randomUUID()`. Em `duplicateItem`, o QuickAdd mostra "Já existe *Nome* — somar quantidade?" e, ao confirmar, refaz a operação com o `existingId` do item correspondente (busca por `normalize` local: `name.trim().toLowerCase()` sem acentos via `normalize('NFD')`)
  - `InventoryScreen`:
    - busca local por nome;
    - grupos na ordem de `CATEGORIES`, alfabético dentro de cada grupo;
    - item com quantidade 0 fica com `opacity-60`;
    - estado vazio `CariSays(cari.emptyInventory)` + botão "Adicionar item";
    - FAB "Adicionar item" (`aria-label`) abre o `QuickAddSheet`;
    - sem conexão (`useOnlineStatus` via `onlineManager`), botões −/+/menu desabilitados e aviso "Sem internet: o estoque volta quando o sinal voltar."
  - `InventoryRow`: botões `aria-label="Diminuir <nome>"` e `"Aumentar <nome>"` (≥ 44 px), quantidade com `formatQuantity`, menu `aria-label="Ações de <nome>"` com Editar, Acabou e Remover. O − que chega a 0 usa `useMarkEmpty`.
  - `QuickAddSheet`: campo "Nome do item" com autocompletar (`Command`) sobre os itens da casa. Escolher um existente mostra só o campo de quantidade. Nome novo mostra quantidade, unidade e categoria, pré-preenchidas com `localStorage['cari-last-unit']` e `['cari-last-category']` (padrão `un` / `outros`).
  - `EditItemSheet`: nome, quantidade, unidade e categoria.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// features/inventory/schema.test.ts
test('rejeita nome vazio/longo, aceita vírgula', () => {
  expect(itemInputSchema.safeParse({ name: '   ', quantity: '1', unit: 'un', category: 'outros' }).success).toBe(false)
  expect(itemInputSchema.safeParse({ name: 'a'.repeat(81), quantity: '1', unit: 'un', category: 'outros' }).success).toBe(false)
  expect(itemInputSchema.parse({ name: ' Arroz ', quantity: '1,5', unit: 'kg', category: 'mercearia' })).toMatchObject({ name: 'Arroz', quantity: 1.5 })
})
```

`e2e/inventory.spec.ts` (Ana, casa a1, após `db:reset`):
1. Adicionar "Café" 500 g → aparece em "Mercearia" (escolha a categoria no sheet).
2. Em "Leite" (2 L): clicar "Diminuir Leite" 4 vezes → o toast "Leite foi para a lista" aparece → abrir a aba Lista → "Leite" presente.
2b. (fixture resetada) Em "Leite": clicar "Diminuir Leite" 4 vezes → "Desfazer" → Leite volta a 0,5 L e não está na Lista.
2c. Em "Arroz" (0 kg, que já tem entrada na lista): "Aumentar Arroz" → "Ações de Arroz" → Acabou → Desfazer → a entrada "Arroz" **continua** na Lista (já existia antes).
3. Ações de "Café" → Remover → Desfazer → "Café" continua visível.
4. Adicionar "leite" (minúsculo, nome novo) → aparece "Já existe Leite — somar quantidade?" → confirmar → a quantidade do Leite aumenta.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run features/inventory && npx playwright test e2e/inventory.spec.ts` → FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar** — `npm run db:reset && npx vitest run && npx playwright test e2e/inventory.spec.ts` → PASS

- [ ] **Step 5: Commit** — `feat: tela de estoque com −/+, acabou e desfazer`

---

### Task 11: Lista de compras (tempo real, fila offline, finalizar compra)

**Files:**
- Create: `features/shopping/{queries.ts,mutations.ts,ShoppingScreen.tsx,ShoppingRow.tsx,FinishShoppingSheet.tsx}`, `features/shell/PendingSyncChip.tsx`, `app/(app)/[householdId]/lista/page.tsx` (substitui o mínimo da Tarefa 7)
- Modify: `lib/query/client.ts` (registra `setMutationDefaults` da lista), `features/shell/AppShell.tsx` (chip + badge na aba Lista com o número de entradas **não marcadas**)
- Test: `e2e/shopping.spec.ts`, `e2e/shopping-offline.spec.ts`

**Interfaces:**
- Consumes: Tarefas 2, 8, 9; `useItems` (Tarefa 10) para o autocompletar.
- Produces:
  - `type Entry = Database['public']['Tables']['shopping_list_entries']['Row']`
  - Mutações **offline-safe**, registradas com `queryClient.setMutationDefaults(key, { mutationFn, onMutate, onError, onSettled })` em `lib/query/client.ts`, para poderem ser retomadas após recarregar a página. Variáveis sempre incluem `householdId`:
    - `['list', 'upsert']` `{ householdId, entry: { id, name, unit, category, quantity, item_id } }` → `upsert` por `id` (id gerado no cliente)
    - `['list', 'setChecked']` `{ householdId, id, checked }` → `update set checked, checked_by = auth.uid()`
    - `['list', 'setQuantity']` `{ householdId, id, quantity }`
    - `['list', 'remove']` `{ householdId, id }` → delete; 0 linhas afetadas = sucesso
    - Hooks `useUpsertEntry`, `useSetChecked`, `useSetEntryQuantity` e `useRemoveEntry` usam essas keys (`useMutation({ mutationKey })`)
  - `useFinishShopping()` `{ householdId, entries: { entry_id: string; quantity: number }[] }` → `rpc('finish_shopping')`. Sucesso → toast `cari.finished(n)` e invalida `items` e `list`. Erro `alreadyFinished` → toast `cari.alreadyFinished` e invalida `list`
  - `PendingSyncChip`: `useMutationState({ filters: { status: 'pending' } })` filtrado por `mutationKey[0] === 'list'` e `isPaused`; mostra `cari.pendingSync(n)` quando n > 0; na primeira vez que fica offline com pendências, um toast `cari.offlineQueued`
  - `ShoppingScreen`:
    - seção "A comprar" agrupada por categoria e seção recolhível "No carrinho (n)";
    - a linha inteira é um botão com `aria-pressed={checked}` e `aria-label="<nome>"`; ao tocar chama `useSetChecked` + `navigator.vibrate?.(10)`;
    - avatar de `added_by` (iniciais do `display_name`, via `['members', householdId]`);
    - menu da linha `aria-label="Ações de <nome>"` com Editar quantidade e Remover (com Desfazer);
    - adição rápida reaproveita o autocompletar do estoque: item existente → entrada com `item_id`, ou destaque (scroll + anel) se já estiver na lista; nome novo → entrada avulsa;
    - estado vazio `CariSays(cari.emptyList)` + "Adicionar item";
    - botão fixo "Finalizar compra (n)", visível com n > 0 marcados; offline → `disabled` com o texto `cari.finishNeedsNetwork`.
  - `FinishShoppingSheet`: uma linha por entrada marcada, com o campo de quantidade preenchido por `defaultPurchaseQuantity(entry.quantity, entry.unit)` e aceitando vírgula. Botão "Guardar no estoque".

- [ ] **Step 1: Escrever os E2E que falham**

`e2e/shopping.spec.ts`:
1. **Tempo real com dois usuários:** `browser.newContext()` ×2, `loginAs` Ana e Lucas, ambos em `/a1/lista`. Ana toca numa entrada → em Lucas, `aria-pressed="true"` nessa entrada em até 5 s.
2. **Finalizar compra:** Ana marca 2 entradas (uma ligada, uma avulsa) → "Finalizar compra (2)" → ajusta a quantidade da primeira para `1,5` → "Guardar no estoque" → toast "Prontinho! Guardei 2 itens no estoque." → a lista não tem mais as duas → no Estoque, a ligada somou 1,5 e a avulsa virou item.
3. **Compra já finalizada em outro aparelho:** Ana e Lucas abrem o sheet com as mesmas entradas marcadas; Lucas confirma primeiro; Ana confirma → toast "Alguém da casa já guardou essa compra."

`e2e/shopping-offline.spec.ts` (Ana):
1. Com a página aberta: `context.setOffline(true)` → marcar "Arroz" e "Azeite" → o chip "2 alterações aguardando sinal" fica visível e "Finalizar compra" fica desabilitado → `setOffline(false)` → o chip some → confirme via `e2e/helpers/db.ts` (`supabase-js` com a service role local de `npx supabase status`, só nos testes) que as 2 entradas estão `checked = true` no banco. Crie aqui `e2e/helpers/db.ts` com `adminClient()` e `isEntryChecked(name: string): Promise<boolean>` (busca em `shopping_list_entries` da casa a1 por `name`).
2. Mutação persistida sobrevive a recarregar: `setOffline(true)` → marcar "Sorvete" → `page.reload()` **ainda offline** não é possível sem o service worker (coberto na Tarefa 12). Por isso, aqui: `setOffline(true)` → marcar "Sorvete" → `setOffline(false)` e `page.reload()` na mesma sequência, sem esperar → confirme no banco (`isEntryChecked('Sorvete')` via `expect.poll`) que a entrada ficou marcada. Isso prova que a mutação foi retomada a partir do IndexedDB.

- [ ] **Step 2: Rodar e ver falhar** — `npx playwright test e2e/shopping*.spec.ts` → FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar** — `npm run db:reset && npx playwright test e2e/shopping*.spec.ts` → PASS

- [ ] **Step 5: Commit** — `feat: lista de compras em tempo real com fila offline e finalizar compra`

---

### Task 12: PWA e abertura sem sinal

**Files:**
- Create: `app/sw.ts`, `app/manifest.ts`, `app/offline/page.tsx`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`
- Modify: `next.config.ts` (envolve com `withSerwist({ swSrc: 'app/sw.ts', swDest: 'public/sw.js', disable: process.env.NODE_ENV === 'development' })`), `package.json` (`"build": "next build --webpack"`, já que o `@serwist/next` depende do webpack; confira no README do Serwist 9 se já existe suporte a Turbopack e, se existir, mantenha o build padrão), `.gitignore` (`public/sw.js`, `public/swe-worker-*`)
- Test: `e2e/pwa.spec.ts`

**Interfaces:**
- Produces:
  - Manifest: `name: 'CARI'`, `short_name: 'CARI'`, `start_url: '/'`, `display: 'standalone'`, `theme_color: '#006B5C'`, `background_color: '#F8FAF7'`, `lang: 'pt-BR'`, ícones 192/512/maskable gerados a partir de `public/cari/cari.svg` sobre fundo `#DAE5E1` (use `npx sharp-cli` ou um script node com `sharp` no scratchpad; versione só os PNGs)
  - `app/sw.ts`: `defaultCache` do `@serwist/next/worker` + uma regra **antes** dele: `matcher: ({ request, url }) => (request.mode === 'navigate' || request.headers.get('RSC') === '1') && /^\/[^/]+\/lista\/?$/.test(url.pathname)`, `handler: new NetworkFirst({ cacheName: 'cari-lista', networkTimeoutSeconds: 3 })`; `fallbacks.entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }]`
  - `/offline`: `CariSays('Estou sem sinal e ainda não tenho essa tela guardada. Abre a Lista — ela funciona offline.')` + link para `/`
  - A Lista renderiza a partir do cache persistido. `lista/page.tsx` passa `initialData` do servidor quando houver; `ShoppingScreen` usa `useQuery` com o cache restaurado pelo `PersistQueryClientProvider`, sem depender da resposta do servidor para pintar

- [ ] **Step 1: Escrever o E2E que falha**

```ts
// e2e/pwa.spec.ts
test('manifest', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json()
  expect(m.theme_color).toBe('#006B5C'); expect(m.display).toBe('standalone')
})
test('abre a Lista sem sinal e marca item', async ({ page, context }) => {
  await loginAs(page, 'ana@cari.test')
  await page.goto('/00000000-0000-0000-0000-0000000000a1/lista')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // garante que a navegação passou pelo SW e foi para o cache
  await context.setOffline(true)
  await page.reload()
  const row = page.getByRole('button', { name: 'Arroz' }) // entrada ligada do seed (Tarefa 3)
  await expect(row).toBeVisible()
  await row.click()
  await context.setOffline(false)
  await expect.poll(() => isEntryChecked('Arroz')).toBe(true) // helper de e2e/helpers/db.ts
})
```

Reutilize `isEntryChecked` de `e2e/helpers/db.ts` (Tarefa 11).

- [ ] **Step 2: Rodar e ver falhar** — `npx playwright test e2e/pwa.spec.ts` → FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Provar que o teste offline detecta a falha**

Comente temporariamente a regra NetworkFirst da Lista em `app/sw.ts` → `npx playwright test e2e/pwa.spec.ts -g 'sem sinal'` → **precisa FALHAR** (página offline do navegador ou `/offline` no lugar da Lista). Se passar mesmo assim, o `setOffline` não está bloqueando as requisições do service worker: troque por `page.route('**/*', r => r.abort())` mais `context.setOffline(true)` e repita até falhar. Restaure a regra.

- [ ] **Step 5: Rodar e ver passar** — `npm run db:reset && npx playwright test` (suíte inteira) → PASS

- [ ] **Step 6: Commit** — `feat: PWA com Lista disponível offline`

---

### Task 13: Gerenciar casa e convites

**Files:**
- Create: `app/(app)/[householdId]/casa/page.tsx`, `features/households/{InvitePanel.tsx,MembersList.tsx,LeaveHouseholdButton.tsx}`, `app/convite/[token]/page.tsx`
- Modify: `features/households/actions.ts`, `app/bem-vindo` (redirect para `/[id]/casa?novo=1`, conforme a Tarefa 8)
- Test: `e2e/household.spec.ts`

**Interfaces:**
- Consumes: RPCs `create_invite`, `accept_invite`, `leave_household`; `toCariError`; `cari`.
- Produces:
  - Server actions em `features/households/actions.ts`: `renameHousehold(id: string, name: string)`, `createInvite(householdId: string): Promise<{ url: string; expiresAt: string }>` (url = `${origin}/convite/${token}`), `revokeInvite(householdId: string)` (`update household_invites set revoked_at = now() where household_id = $1 and revoked_at is null`), `setMemberRole(householdId, userId, role)`, `removeMember(householdId, userId)`, `leaveHousehold(householdId)`, `acceptInvite(token): Promise<{ householdId: string }>`. Erros conhecidos voltam como `{ error: CariErrorKey }`, e não como exceção.
  - `/casa`:
    - nome editável (só owner);
    - `MembersList` com papel e, para owner, menu `aria-label="Ações de <nome>"` com "Tornar dono" e "Remover";
    - `InvitePanel` (só owner) com "Gerar link de convite", "Compartilhar" (`navigator.share({ title: 'CARI', text: 'Entra na nossa casa no CARI!', url })`, com fallback para `clipboard.writeText` e o toast "Link copiado"), "Revogar" e o texto "Vale até dd/mm" (`toLocaleDateString('pt-BR')`);
    - com `?novo=1`, o painel já abre com um link gerado e a fala `CariSays('Casa criada! Manda esse link pra quem mora com você.')`;
    - `LeaveHouseholdButton` com a única confirmação do app: "Sair da casa *X*? Você vai precisar de um novo convite para voltar." Em `lastOwner`, mostra `cari.lastOwner`.
  - `/convite/[token]`: `requireUser()` (com `next` de volta para o convite) → mostra "Entrar na casa?" + botão "Entrar". `accept_invite` → `redirect('/[id]/lista')`. `inviteInvalid` / `inviteExpired` → `CariSays` com a mensagem correspondente.

- [ ] **Step 1: Escrever o E2E que falha**

`e2e/household.spec.ts`:
1. Lucas em `/a1/casa` → "Gerar link de convite" → lê a URL do link (input readonly com `aria-label="Link de convite"`).
2. Outro contexto: Convidado faz `loginAs` e vai até a URL → "Entrar" → URL `/a1/lista` e a casa "Casa Lucas & Ana" no seletor.
3. Lucas → "Revogar" → Convidado (em outra casa? não; use um link revogado sem ter entrado: gere novo link, revogue, e só então o Convidado abre) abre a URL → `cari.inviteInvalid` visível.
4. Ana (member) em `/a1/casa` → não vê "Gerar link de convite".
5. Lucas → "Sair da casa" → confirmar → `cari.lastOwner` visível.

- [ ] **Step 2: Rodar e ver falhar** — `npx playwright test e2e/household.spec.ts` → FAIL

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Rodar e ver passar** — `npm run db:reset && npx playwright test` → PASS

- [ ] **Step 5: Commit** — `feat: gerenciar casa, membros e convites`

---

### Task 14: CI/CD, keepalive e backup criptografado

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/migrate.yml`, `.github/workflows/keepalive.yml`, `.github/workflows/backup.yml`
- Modify: `README.md` (seção "Deploy" com os passos manuais)

**Interfaces:**
- `ci.yml` (em `pull_request` e `push` para `main`), job único em `ubuntu-latest`:
  1. `actions/checkout` + `actions/setup-node` (24, cache npm) + `npm ci`
  2. `npm run lint` + `npm run typecheck` + `npm test`
  3. `npx supabase start` + `npm run db:test`
  4. exporta `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` a partir de `npx supabase status -o env`
  5. `npx playwright install --with-deps chromium` + `npm run db:reset` + `npm run test:e2e`
  6. upload do `playwright-report` quando falhar
- `migrate.yml` (`push` em `main`, paths `supabase/migrations/**`, e `workflow_dispatch`): `npx supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}` + `npx supabase db push`, com `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` nos secrets.
- `keepalive.yml` (`schedule: '0 12 * * 1'` + `workflow_dispatch`): `curl -fsS "$SUPABASE_URL/rest/v1/households?select=id&limit=1" -H "apikey: $ANON_KEY"`. O RLS devolve `[]`, mas a consulta já conta como atividade.
- `backup.yml` (`schedule: '0 6 * * 0'` + `workflow_dispatch`): `npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f dump.sql` → instala o `age` (`sudo apt-get install -y age`) → `age -r "$BACKUP_AGE_PUBLIC_KEY" -o dump.sql.age dump.sql` → `rm dump.sql` → `actions/upload-artifact` só do `dump.sql.age`, `retention-days: 90`. Secrets: `SUPABASE_DB_URL` e `BACKUP_AGE_PUBLIC_KEY`. O passo de upload nunca deve referenciar `dump.sql`.
- README "Deploy": criar o projeto no Supabase Cloud; habilitar o Google OAuth (Client ID/Secret do Google Cloud; redirect `https://<ref>.supabase.co/auth/v1/callback`); definir o Site URL e o redirect `https://<domínio-vercel>/auth/callback`; importar o repositório na Vercel com as 2 envs públicas; cadastrar os secrets do GitHub listados acima; gerar o par `age-keygen` e guardar a chave privada fora do repositório; restaurar com `age -d -i chave.txt dump.sql.age | psql "$SUPABASE_DB_URL"`.

- [ ] **Step 1: Validar a sintaxe dos workflows**

Run: `npx --yes @action-validator/cli .github/workflows/*.yml` (ou `actionlint`, se disponível)
Expected: sem erros.

- [ ] **Step 2: Rodar localmente o equivalente ao CI**

Run: `npm run lint && npm run typecheck && npm test && npm run db:reset && npm run db:test && npm run test:e2e`
Expected: tudo PASS.

- [ ] **Step 3: Conferir que o backup nunca sobe sem criptografia**

Run: `grep -n "dump.sql" .github/workflows/backup.yml`
Expected: o caminho do `upload-artifact` é só `dump.sql.age`.

- [ ] **Step 4: Commit** — `ci: testes, migrations, keepalive e backup criptografado`

---

## Checklist final (após a Tarefa 14)

- [ ] Suíte completa verde localmente: `npm run lint && npm run typecheck && npm test && npm run db:reset && npm run db:test && npm run test:e2e`.
- [ ] Os 5 critérios de sucesso da spec §1 conferidos: (1) E2E de tempo real; (2) E2E offline + PWA; (3) "Acabou" em 2 toques (menu → Acabou) ou com −; (4) pgTAP de RLS + E2E de isolamento; (5) apenas free tiers no README "Deploy".
- [ ] Nada foi enviado ao remoto: push da branch `cari-v2` e da tag `tcc-2023` só com aprovação do usuário.
