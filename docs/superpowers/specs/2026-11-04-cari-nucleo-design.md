# CARI v2 — Núcleo (casas, estoque e lista de compras)

- **Data:** 2026-11-04
- **Status:** aguardando revisão
- **Subprojeto:** 1 de 4 (núcleo)

## 1. Contexto e objetivo

O CARI nasceu como TCC (Etec Parque Belém, 2023): um CRUD em PHP + MySQL para organizar os alimentos de casa, com lista de compras e receitas. O objetivo agora é transformá-lo num app **de uso real e diário** pelo Lucas, pela namorada e pela família.

O código atual não é aproveitável para isso: SQL injection em todas as queries, senhas em texto puro, autorização baseada em `id-user` enviado pelo cliente (qualquer usuário edita/apaga itens de outro), schema não versionado e UI desktop-first. A v2 é uma reescrita com stack moderna, mantendo a identidade (paleta, tipografia Chillax e a personagem Cari).

### O que o usuário disse
- Uso compartilhado por **casas**: cada casa tem estoque e lista próprios; uma pessoa pode participar de mais de uma casa.
- Prioridades da primeira versão utilizável: **lista de compras no mercado**, **saber o que tem em casa**, **receitas com o que tenho**.
- Integrações desejadas: **IA para receitas**, **leitura de NFC-e**, **bot WhatsApp/Telegram**.
- Hospedagem em **free tier gerenciado**.
- Stack: **Next.js + Supabase** na Vercel.
- Offline: **lista tolerante** a sinal ruim no mercado.
- Manter paleta, Chillax e a Cari como assistente.

### Critérios de sucesso do núcleo
1. Duas pessoas da mesma casa usam a lista no mercado ao mesmo tempo e veem as marcações uma da outra em até ~2 s.
2. Marcar itens funciona com sinal intermitente, sem perda de toques.
3. Registrar "acabou o leite" leva no máximo 2 toques a partir da aba Estoque.
4. Nenhum usuário consegue ler ou alterar dados de uma casa da qual não é membro (garantido por RLS e coberto por testes).
5. Custo de infraestrutura: R$ 0/mês.

## 2. Decomposição em subprojetos

| # | Subprojeto | Depende de | Status |
|---|---|---|---|
| 1 | **Núcleo**: contas, casas, convites, estoque, lista, PWA | — | esta spec |
| 2 | Receitas com IA (Cari sugere a partir do estoque; "adicionar faltantes à lista") | 1 | futuro |
| 3 | Importação de NFC-e (QR do cupom → entrada no estoque) | 1 | futuro |
| 4 | Bot WhatsApp/Telegram ("acabou o café", "o que tem pra jantar?") | 1 (e 2 para receitas) | futuro |

Cada subprojeto terá sua própria spec → plano → implementação. O núcleo põe as regras de negócio no banco (triggers e RPCs) para que os subprojetos 3 e 4 reutilizem o mesmo comportamento.

## 3. Fora do escopo do núcleo

Controle de validade, notificações push, histórico/estatísticas de consumo, múltiplas listas por casa, receitas (a aba existe só como placeholder), migração dos dados ou da tabela de receitas do TCC, leitura de código de barras e app nativo.

## 4. Stack

- **Next.js** (App Router) + **TypeScript** (strict).
- **Tailwind CSS** + **shadcn/ui** (componentes copiados para o repositório e tematizados com os tokens da seção 9).
- **Supabase**: Postgres, Auth (`@supabase/ssr`) e Realtime. Migrations e testes via Supabase CLI.
- **TanStack Query** para cache e mutações no cliente, persistido em IndexedDB.
- **Serwist** para o PWA (manifest, service worker, cache do shell).
- **Vercel** (hosting) + **Supabase Cloud** (plano gratuito).
- **Testes:** pgTAP (banco), Vitest (lógica pura), Playwright (E2E).

## 5. Modelo de dados

Todas as tabelas usam `id uuid primary key` (default `gen_random_uuid()`, mas o cliente pode enviar o próprio id), além de `created_at`/`updated_at timestamptz`.

### Tipos
- `unit` enum: `kg`, `g`, `L`, `ml`, `un`.
- `member_role` enum: `owner`, `member`.
- `category`: `text` com check constraint numa lista fixa: `hortifruti`, `carnes`, `laticinios`, `padaria`, `mercearia`, `bebidas`, `congelados`, `limpeza`, `higiene`, `outros` (default `outros`). O rótulo em português fica no front.

### Tabelas

**`profiles`**
- `id` (PK, FK → `auth.users.id`, on delete cascade), `display_name text not null`, `avatar_url text`, `last_household_id uuid null` (FK → `households`, on delete set null).
- Criada por trigger no `auth.users` após o signup, com `display_name` vindo dos metadados (nome do Google ou parte local do e-mail).

**`households`**
- `name text not null` (1–60 caracteres), `created_by uuid` (FK → `profiles`).

**`household_members`**
- PK composta (`household_id`, `user_id`), `role member_role not null default 'member'`, `joined_at`.

**`household_invites`**
- `household_id`, `token text unique not null` (32 bytes aleatórios em base64url), `created_by`, `expires_at` (criação + 7 dias), `revoked_at null`.
- Só existe **um link ativo por casa**: gerar um novo revoga o anterior. O link é multiuso até expirar ou ser revogado.

**`items`** (estoque)
- `household_id`, `name text not null` (1–80), `name_key text not null` (coluna gerada por `normalize_name(name)`: wrapper `IMMUTABLE` de `lower(unaccent(trim(name)))`, já que `unaccent` sozinho não é imutável e não pode ser usado em coluna gerada), `quantity numeric(10,3) not null default 0 check (quantity >= 0)`, `unit unit not null`, `category text not null default 'outros'`, `updated_by uuid`.
- `unique (household_id, name_key)`: impede duplicatas como "Leite"/"leite"/"LEITE".

**`shopping_list_entries`** (lista)
- `household_id`, `item_id uuid null` (FK → `items`, on delete set null), `name text not null`, `quantity numeric(10,3) null` (quantidade desejada, opcional), `unit unit not null`, `category text not null default 'outros'`, `checked boolean not null default false`, `checked_by uuid null`, `added_by uuid null` (nulo = criado pelo sistema).
- Índice único parcial `(item_id) where item_id is not null`: no máximo uma entrada por item do estoque.
- Entrada **avulsa** (`item_id` nulo) é algo que ainda não existe no estoque.

### Regras no banco

**RLS** ligada em todas as tabelas. Uma função `is_member(household_id) returns boolean` (`security definer`, `stable`) checa `household_members` para `auth.uid()`.
- `households`, `items`, `shopping_list_entries`: select/insert/update/delete só se `is_member(household_id)`.
- `household_members`: membros leem os membros da própria casa. Insert só via RPCs. Delete: o próprio usuário (sair) ou um owner da casa (remover). Update de `role`: só owner.
- `household_invites`: select/insert/update só para owners. A leitura por token acontece apenas dentro da RPC `accept_invite`.
- `profiles`: cada um edita o próprio. Membros de uma casa em comum leem `display_name`/`avatar_url` uns dos outros.

**Trigger `items_to_list_when_empty`** (after update em `items`): quando `old.quantity > 0` e `new.quantity = 0`, insere uma entrada na lista (`item_id`, nome, unidade e categoria do item, `quantity` nula, `added_by = coalesce(auth.uid(), new.updated_by)`) com `on conflict do nothing`.

**RPCs** (`security invoker`, exceto quando indicado; as `security definer` usam `set search_path = ''` e validam `auth.uid()` explicitamente):
- `create_household(p_name text) returns uuid` (`security definer`, porque o chamador ainda não é membro e `household_members` não tem policy de insert): cria a casa, adiciona o chamador como `owner`, atualiza `last_household_id`.
- `create_invite(p_household_id uuid) returns text`: exige owner, revoga o link ativo e cria um novo. Retorna o token.
- `accept_invite(p_token text) returns uuid` (`security definer`): valida que o token existe, não está revogado nem expirado. Insere o chamador como `member` (idempotente se já for membro) e atualiza `last_household_id`. Erros: `invite_invalid`, `invite_expired`.
- `finish_shopping(p_household_id uuid, p_entries jsonb) returns int`: `p_entries` é uma lista de `{entry_id, quantity}`, com `quantity > 0`. Tudo numa transação. Para cada entrada marcada:
  - com `item_id`: `items.quantity += quantity` (na unidade do item);
  - sem `item_id`: cria o item (ou soma, se já existir um com o mesmo `name_key`) com nome, unidade e categoria da entrada;
  - apaga a entrada.

  Entradas que não pertencem à casa ou não estão `checked` fazem a função abortar com `entry_invalid`. Retorna o número de entradas processadas (cada uma atualiza ou cria exatamente um item no estoque).
- `leave_household(p_household_id uuid)` (`security definer`, para poder apagar a casa quando o chamador é o último membro): o último owner não pode sair enquanto houver outros membros (`last_owner`). Se o chamador for o único membro, a casa é apagada em cascata.

**Seed** (`supabase/seed.sql`): 2 usuários de teste, 1 casa compartilhada entre eles, cerca de 15 itens de estoque e 5 entradas de lista, para desenvolvimento local e E2E.

## 6. Telas e fluxos

### Entrada
- **`/login`**: botões "Entrar com Google" e "Receber link por e-mail" (magic link). Não existe senha nem landing page.
- **Primeiro acesso sem casa** (`/bem-vindo`): a Cari se apresenta e pede só o nome da casa → `create_household` → mostra o link de convite com botão de compartilhar (Web Share API, com fallback para copiar).
- **`/convite/[token]`**: se não estiver logado, vai para o login e volta. Mostra "Entrar na casa *X*?" → `accept_invite` → abre a Lista. Token inválido ou expirado: mensagem da Cari com orientação para pedir um link novo.
- Após o login: abre a última casa usada (`last_household_id`). Sem casa → `/bem-vindo`.

### Shell
- **Topo:** seletor da casa ativa (troca e atualiza `last_household_id`) e avatar (menu: Gerenciar casa, Tema, Sair).
- **Rodapé:** abas **Estoque · Lista · Receitas**, com alvos de pelo menos 48 px. A aba Lista mostra a contagem de pendentes.
- Rotas: `/[householdId]/estoque`, `/[householdId]/lista`, `/[householdId]/receitas`, `/[householdId]/casa`.
- No desktop, o mesmo layout com largura máxima centralizada. Não há layout desktop dedicado.

### Estoque
- Busca no topo, que filtra a lista localmente.
- Itens agrupados por categoria, na ordem da lista de categorias, e em ordem alfabética dentro de cada grupo.
- Cada linha mostra nome, quantidade + unidade, botões **−** e **+** e um menu (Editar, Acabou, Remover).
- **Passo do −/+ por unidade:** `un` = 1, `kg`/`L` = 0,5, `g`/`ml` = 100. Valor mínimo 0.
- **−** até 0, ou a ação **Acabou**: define `quantity = 0` → o trigger põe o item na lista → aviso "*Leite foi para a lista* · Desfazer". O desfazer restaura a quantidade anterior e remove a entrada **somente se ela foi criada por essa ação**. Se o item já estava na lista antes, a entrada existente é mantida.
- **Remover:** apaga o item; aviso "Removido · Desfazer". O desfazer reinsere o item com o mesmo id e valores. Uma entrada da lista ligada a ele, que virou avulsa pelo `on delete set null`, continua avulsa (comportamento aceito).
- **Adição rápida** (botão "+" flutuante, que abre um painel inferior):
  - campo de nome com autocompletar dos itens da casa;
  - escolher um item existente soma a quantidade digitada;
  - nome novo pede quantidade, unidade e categoria. Unidade e categoria vêm pré-selecionadas com a última escolha feita no aparelho; não há inferência automática.
- **Editar:** painel com nome, quantidade, unidade e categoria.
- Item com quantidade 0 continua visível no estoque com estilo atenuado, para que dê para repor com +.
- Estado vazio: ilustração da Cari + "Sua despensa está vazia. Me conta o que tem aí?" + botão de adicionar.

### Lista
- Seção **A comprar** (agrupada por categoria) e seção **No carrinho** (marcados, recolhível).
- Cada linha mostra nome, quantidade desejada (se houver) e o avatar de quem adicionou.
- **Um toque** na linha marca ou desmarca (vibração curta via `navigator.vibrate`, quando disponível).
- Ações por item no menu: editar a quantidade desejada, remover (com Desfazer).
- Adição rápida igual à do Estoque. Escolher um item do estoque cria uma entrada ligada (`item_id`); se ele já estiver na lista, só destaca a entrada existente. Nome novo cria uma entrada avulsa.
- **Botão fixo "Finalizar compra (n)"**, visível quando há itens marcados. Abre um painel com cada item marcado e a quantidade comprada preenchida: a desejada ou, na falta dela, o passo da unidade (1 un, 0,5 kg/L, 100 g/ml). Tudo editável. Confirmar → `finish_shopping` → aviso da Cari: "Prontinho! Guardei *n* itens no estoque."
- Sem conexão, "Finalizar compra" fica desabilitado com o texto "Precisa de internet para guardar no estoque".
- Estado vazio: "Nada para comprar 🎉" + botão de adicionar.

### Receitas (placeholder)
- Estado vazio com a Cari: "Em breve vou sugerir receitas com o que você tem em casa."

### Gerenciar casa (`/[householdId]/casa`)
- Renomear (owner).
- Lista de membros com papéis. Owner pode promover a owner ou remover um membro.
- Link de convite: gerar/compartilhar, revogar (owner), com a validade visível.
- Sair da casa (com as regras de `leave_household`). Esta é a única ação com confirmação explícita, porque não é reversível pelo próprio usuário.

## 7. Princípios de interação

Saíram da auditoria do fluxo do TCC; servem de checklist de revisão.

1. **Postura transitória:** sessões de segundos, no celular, com uma mão. UI óbvia, opções mínimas, alvos ≥ 44–48 px.
2. **Desfazer em vez de confirmar** em toda ação reversível (remover, acabou, desmarcar).
3. **Atualização otimista:** a UI muda na hora; erro → reverte + aviso com "Tentar de novo".
4. **Sem modos invisíveis:** busca e filtros são visíveis e limpáveis (no TCC, a busca de receitas ficava presa na sessão).
5. **Prevenir erros** (Poka-Yoke): unidade sempre de uma lista fechada, quantidade com decimal, nomes deduplicados por `name_key`, autocompletar do catálogo.
6. **Lembrar o usuário:** última casa, última unidade/categoria escolhida no aparelho.
7. **Estados vazios que guiam**, sempre com uma ação.
8. **Feedback proporcional:** ações repetidas (−/+, marcar) têm feedback seco; a Cari fala só nos momentos de pico (boas-vindas, fim da compra, estados vazios, erros relevantes).
9. **Todo estado desenhado:** carregando (skeleton), vazio, erro, offline/sincronizando e sucesso, para cada tela.

## 8. Arquitetura técnica

### Estrutura do repositório
```
app/                     rotas (login, bem-vindo, convite/[token], [householdId]/(estoque|lista|receitas|casa))
features/
  households/            seletor, gerenciar casa, convites
  inventory/             estoque: componentes, hooks, queries, mutações
  shopping/              lista: componentes, hooks, queries, mutações, finalizar compra
  cari/                  ilustração, mensagens e componente de fala da Cari
lib/
  supabase/              clients (server, browser, middleware), tipos gerados
  query/                 QueryClient, persistência IndexedDB, defaults de mutação
  units.ts               passos por unidade e formatação de quantidade (pt-BR)
supabase/
  migrations/  seed.sql  tests/ (pgTAP)
e2e/                     Playwright
public/                  manifest, ícones, ilustrações da Cari
```

### Autenticação
- Supabase Auth com Google OAuth e magic link. O middleware do Next renova a sessão (`@supabase/ssr`).
- Rotas do app exigem sessão; rotas `[householdId]` checam se o usuário é membro no servidor e redirecionam se não for. O RLS é a garantia final.
- Limitação conhecida: o SMTP padrão do Supabase tem limite baixo de e-mails por hora. Para uma família isso basta; se não bastar, configurar um SMTP próprio (Resend, plano gratuito).

### Dados no cliente
- Os Server Components fazem a carga inicial (estoque, lista, membros) e a passam como `initialData` ao TanStack Query.
- **Realtime:** um canal por casa ativa, com `postgres_changes` em `items` e `shopping_list_entries` filtrado por `household_id=eq.<id>`. Cada evento aplica insert/update/delete direto no cache da query correspondente. Ao reconectar o canal, as duas queries são invalidadas e buscadas de novo.
- `items` e `shopping_list_entries` entram na publicação `supabase_realtime`. Eventos de DELETE não aceitam filtro e, com RLS, chegam só com a chave primária: o cliente remove do cache pelo `id`; um id que não está no cache é ignorado.
- Cada linha guarda `updated_by`/`added_by`/`checked_by`, e a UI mostra o avatar correspondente.

### Lista tolerante a falta de sinal
- O cache das queries de estoque e lista é persistido em IndexedDB (`persistQueryClient`). O app abre com os últimos dados mesmo sem rede.
- **Mutações da lista** (adicionar, marcar/desmarcar, editar quantidade, remover) são registradas com `setMutationDefaults` e ficam **pausadas** quando offline. Elas são persistidas e retomadas ao voltar a conexão, inclusive depois de recarregar o app.
- **Idempotência:**
  - entradas novas levam UUID gerado no cliente (reenviar = mesmo registro, via upsert);
  - marcar grava o valor final (`checked = true/false`) e editar grava a quantidade absoluta;
  - remover um registro já removido é tratado como sucesso.
- **Conflitos:** vale a última escrita.
- **Indicador:** chip discreto no topo, "*n* alterações aguardando sinal", que some ao sincronizar.
- **Estoque e Finalizar compra exigem conexão.** Sem rede, os controles do estoque ficam desabilitados com aviso; isso fica para uma evolução futura se fizer falta.

### PWA
- Manifest com nome "CARI", cor do tema `#006B5C` e ícones gerados a partir da ilustração da Cari.
- O Serwist faz precache do shell e dos assets estáticos.
- **Abrir o app sem sinal** (app fechado, sem rede) é o caso do mercado e precisa funcionar na aba Lista:
  - a tela da Lista é um Client Component que renderiza **só a partir do cache persistido** do TanStack Query. A carga do servidor é apenas um `initialData` opcional;
  - a navegação para `/[householdId]/lista` (HTML e requisições RSC) usa estratégia **NetworkFirst** no Serwist, com timeout de 3 s e fallback para a última resposta em cache;
  - a sessão do Supabase fica no cookie e no storage local; sem rede, o middleware não é alcançado e a página em cache abre normalmente. A sessão é renovada ao voltar a conexão.
- As demais abas, sem rede e sem cache, mostram a tela offline da Cari.

### Tratamento de erros
- Erros de RPC conhecidos (`invite_invalid`, `invite_expired`, `last_owner`, `entry_invalid`) são mapeados para mensagens em pt-BR na voz da Cari.
- Erros inesperados: aviso genérico com "Tentar de novo" e log no console (sem serviço de observabilidade no núcleo).
- Violação de unicidade de `name_key` ao criar um item: a UI oferece "Já existe *Leite* — somar quantidade?".

## 9. Identidade visual

### Paleta (herdada do TCC, base Material 3)

| Token | Claro | Escuro |
|---|---|---|
| `primary` | `#006B5C` | `#58DBC3` |
| `on-primary` | `#FFFFFF` | `#00382F` |
| `primary-hover` | `#147769` | `#51CEB8` |
| `secondary` | `#4A635D` | `#B1CCC4` |
| `surface` | `#F8FAF7` | `#101413` |
| `surface-container-low` | `#F2F4F2` | `#191C1B` |
| `surface-variant` | `#DAE5E1` | `#3F4946` |
| `on-surface` | `#191C1B` | `#C4C7C5` |
| `error` | `#BA1A1A` | `#FFB4AB` |
| `on-error` | `#FFFFFF` | `#690005` |

- Os tokens viram variáveis CSS mapeadas no tema do shadcn/ui.
- Tema: segue `prefers-color-scheme`, com opção manual (Sistema/Claro/Escuro) no menu do avatar, salva no aparelho.
- Todo par texto/fundo usado precisa passar no contraste **WCAG AA**. A verificação faz parte da implementação do tema.

### Tipografia
- **Chillax** (Fontshare, licença gratuita), hospedada no app via `next/font/local` nos pesos 400, 500 e 600. Sem CDN externa.
- Chillax em títulos, nome da casa, números de quantidade e botões.
- **Texto corrido e listas:** Chillax 400/500, **desde que** passe no teste de legibilidade no protótipo (nomes de itens em 14–16 px num celular real). Se não passar, o corpo usa **Inter** e a Chillax fica só para títulos e destaques. Essa decisão é tomada e registrada na primeira tarefa de UI do plano.
- Tamanhos em `rem`, respeitando o tamanho de fonte do sistema (substitui os botões A+/A− do TCC).

### A Cari
- **Asset:** a ilustração atual (`img/logo.svg`) vira avatar da Cari, ícone do app e ilustração dos estados vazios. Variações de expressão (feliz, pensando, vazio) são um asset a produzir depois; a pose atual atende a v1.
- **Componente `CariSays`:** avatar + balão de fala, usado em boas-vindas, estados vazios, sucesso de "Finalizar compra" e erros relevantes.

### Guia de voz e tom da Cari
Base também para o prompt da IA (subprojeto 2) e do bot (subprojeto 4).

- **Quem é:** a assistente da casa, prática e carinhosa, que conhece a despensa e ajuda sem atrapalhar.
- **Como fala:** primeira pessoa, português brasileiro informal, frases curtas, no máximo um emoji e só em momentos de celebração.
- **Quando fala:** boas-vindas, estados vazios, conclusão de tarefas importantes e erros que exigem ação. **Não** fala em ações repetitivas (−/+, marcar item).
- **Erros:** nunca culpa o usuário; diz o que houve e o que fazer.

| Situação | ✅ | ❌ |
|---|---|---|
| Fim da compra | "Prontinho! Guardei 12 itens no estoque." | "Operação concluída com sucesso." |
| Convite expirado | "Esse convite expirou. Pede um link novo pra quem te chamou?" | "Erro: token inválido." |
| Lista vazia | "Nada para comprar 🎉" | "Você não possui alimentos para comprar." |
| Sem rede | "Sem sinal por aqui — guardo suas marcações e envio quando voltar." | "Falha na conexão." |

### Acessibilidade
- WCAG 2.2 AA.
- Foco visível em todos os controles; ordem de foco lógica.
- Botões só com ícone têm `aria-label`.
- Avisos com Desfazer ficam acessíveis por teclado e leitor de tela (`role="status"`) e duram 6 s.
- `prefers-reduced-motion` desliga animações não essenciais.

## 10. Testes

- **pgTAP** (`supabase test db`):
  - RLS: um não membro não lê nem escreve em nenhuma tabela da casa; um membro comum não gerencia convites nem papéis;
  - trigger de "acabou" (cria a entrada e não duplica);
  - `finish_shopping` (soma, cria item avulso, soma em item com mesmo `name_key`, aborta com `entry_invalid`, atomicidade);
  - `create_household` por um usuário comum (cria a casa e o torna owner);
- `accept_invite` (válido, expirado, revogado, idempotente);
  - `leave_household` (`last_owner`, último membro apaga a casa);
  - unicidade de `name_key`.
- **Vitest:** `lib/units.ts` (passos, formatação pt-BR, quantidade padrão no Finalizar compra), mapeamento de erros e reducers que aplicam eventos realtime no cache.
- **Playwright** contra o Supabase local (`supabase start`), com sessões semeadas dos 2 usuários de teste:
  1. adicionar item ao estoque, usar −/+ e "Acabou" → item aparece na lista → Desfazer;
  2. dois contextos de navegador na mesma casa: A marca um item e B vê a marcação;
  3. offline com a página aberta (`context.setOffline(true)`): marcar 2 itens → voltar online → marcações persistidas no banco;
3b. abrir sem sinal: carregar a Lista → ficar offline → **recarregar a página** → a Lista aparece a partir do cache → marcar 1 item → voltar online → marcação persistida;
  4. finalizar compra → quantidades somadas no estoque e lista limpa;
  5. convite: owner gera o link, segundo usuário aceita e vê a casa;
  6. isolamento: usuário de fora da casa acessa `/[householdId]/lista` e é redirecionado.

## 11. CI/CD e operação

- **GitHub Actions** em PRs e em `main`: lint (ESLint), typecheck, Vitest, `supabase start` + `supabase test db` + Playwright.
- **Deploy:** integração Vercel ↔ GitHub (preview por PR, produção no merge para `main`). As migrations vão para produção num job de `main` com `supabase db push`; os segredos ficam nos secrets do GitHub.
- **Variáveis:** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel. Nenhuma `service_role` no front. O `.env.example` fica versionado.
- **Pausa do Supabase gratuito:** projetos sem acesso por 7 dias são pausados. Com uso diário isso não ocorre; como garantia, um workflow agendado semanal faz uma consulta leve ao banco.
- **Backup:** o plano gratuito não tem backup automático. Um workflow semanal roda `supabase db dump --data-only` e **criptografa o dump com `age`** antes de enviá-lo. A chave pública fica num secret do repositório; a privada fica só com o Lucas. O arquivo vai como artifact do GitHub Actions (retenção de 90 dias). Como o repositório `lucvs07/CARI` é **público**, qualquer pessoa pode baixar artifacts, e por isso o dump nunca é enviado sem criptografia.

## 12. Transição do código do TCC

1. Criar a tag `tcc-2023` apontando para o último commit atual de `main`.
2. Remover do `main` todo o código PHP/HTML/CSS/JS do TCC. A ilustração `logo.svg` vai para `public/cari/`; as demais imagens não são migradas.
3. Reescrever o README: o que é o CARI v2, como rodar localmente e uma seção "História" com o link para a tag `tcc-2023` e os integrantes originais.

## 13. Decisões em aberto (com critério definido)

- **Chillax no corpo de texto:** decidida no protótipo, pelo critério da seção 9.
- **Variações de ilustração da Cari:** fora do núcleo; usar a pose atual até existirem.
