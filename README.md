# CARI v2

<!-- portfolio:pt -->
PWA para organizar estoque e lista de compras da casa, compartilhado em família. Evolução do TCC da Etec Parque Belém.
<!-- /portfolio:pt -->

O CARI v2 ajuda uma casa a controlar o que tem na despensa e o que precisa comprar, com a lista de compras compartilhada entre os membros da família. É um PWA (Next.js + Supabase) que funciona também sem conexão.

## Pré-requisitos

- Node 24
- Docker (para o Supabase local)

## Como rodar

```bash
npm i
npm run db:start        # sobe o Supabase local (a primeira vez baixa as imagens Docker)
cp .env.example .env.local   # preencha NEXT_PUBLIC_SUPABASE_ANON_KEY com a saída de `npx supabase status`
npm run dev
```

## Como testar

```bash
npm test          # testes unitários (Vitest)
npm run db:test   # testes do banco (pgTAP)
npm run test:e2e  # testes E2E (Playwright)
```

## Deploy

Tudo roda em free tiers: Supabase Cloud (banco, auth e realtime), Vercel (front) e GitHub Actions (CI, migrations, keepalive e backup). O repositório é público, então nenhum segredo vai para o código: tudo entra pelos secrets do GitHub ou pelas envs da Vercel.

1. **Supabase Cloud.** Crie o projeto em [supabase.com](https://supabase.com) e anote o `Project ref`, a senha do banco, a URL do projeto e a chave `anon`.
2. **Google OAuth.** No Google Cloud, crie um OAuth Client ID (aplicação web) e, em Authentication > Providers > Google do Supabase, cadastre o Client ID e o Client Secret. No Google Cloud, autorize o redirect `https://<ref>.supabase.co/auth/v1/callback`.
3. **URLs de redirecionamento.** Em Authentication > URL Configuration, defina o Site URL como `https://<domínio-vercel>` e adicione `https://<domínio-vercel>/auth/callback` aos Redirect URLs.
4. **Vercel.** Importe o repositório e cadastre só as 2 envs públicas: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A `service_role` nunca entra no front nem na Vercel.
5. **Secrets do GitHub** (Settings > Secrets and variables > Actions):

   | Secret | Usado por | O que é |
   | --- | --- | --- |
   | `SUPABASE_ACCESS_TOKEN` | migrations | token pessoal do Supabase (Account > Access Tokens) |
   | `SUPABASE_PROJECT_REF` | migrations | ref do projeto |
   | `SUPABASE_DB_PASSWORD` | migrations | senha do banco do projeto |
   | `SUPABASE_URL` | keepalive | URL do projeto (`https://<ref>.supabase.co`) |
   | `SUPABASE_ANON_KEY` | keepalive | chave `anon` (pública) |
   | `SUPABASE_DB_URL` | backup | string de conexão do Postgres (use a do pooler, Settings > Database) |
   | `BACKUP_AGE_PUBLIC_KEY` | backup | chave pública `age` (`age1...`) |

6. **Chave do backup.** Gere o par com `age-keygen -o chave.txt`. Guarde `chave.txt` (privada) fora do repositório, por exemplo em um gerenciador de senhas, e cadastre só a chave pública (linha `Public key: age1...`) em `BACKUP_AGE_PUBLIC_KEY`. Sem a chave privada o backup não pode ser restaurado.

### Workflows

- `ci.yml`: lint, tipos, testes unitários, pgTAP e E2E contra um Supabase local, em todo PR e push para `main`.
- `migrate.yml`: aplica `supabase/migrations/**` no projeto na nuvem a cada push para `main` que mude migrations (ou manualmente).
- `keepalive.yml`: uma consulta por semana à API para o projeto free não ser pausado por inatividade.
- `backup.yml`: todo domingo gera o dump dos dados (inclui `auth.users`), criptografa com `age` e envia só o `dump.sql.age` como artefato (90 dias). O dump em texto puro nunca é enviado nem impresso nos logs.

### Restaurar um backup

Baixe o artefato `backup-criptografado` da execução desejada e, em um banco com as migrations já aplicadas (`npx supabase db push`) e sem dados, rode:

```bash
age -d -i chave.txt dump.sql.age | psql "$SUPABASE_DB_URL"
```

O dump já traz `auth.users`, então perfis e membros não ficam órfãos. Restaure em um banco vazio: em um banco com dados, os `INSERT`s de linhas existentes falham por chave duplicada.

## História

O CARI nasceu em 2023 como TCC da Etec Parque Belém, um CRUD em PHP para organizar os alimentos de casa e incentivar o consumo sustentável. O código original está preservado na tag [`tcc-2023`](https://github.com/lucvs07/CARI/tree/tcc-2023).

Integrantes do TCC:

- <a href="https://www.linkedin.com/in/lucasrgrecco/">Lucas Rodrigues Grecco</a>
- <a>Lucas Garcia</a>
- <a>Luiz Felipe</a>
- <a>Murilo Cardoso</a>
