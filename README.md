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

## História

O CARI nasceu em 2023 como TCC da Etec Parque Belém, um CRUD em PHP para organizar os alimentos de casa e incentivar o consumo sustentável. O código original está preservado na tag [`tcc-2023`](https://github.com/lucvs07/CARI/tree/tcc-2023).

Integrantes do TCC:

- <a href="https://www.linkedin.com/in/lucasrgrecco/">Lucas Rodrigues Grecco</a>
- <a>Lucas Garcia</a>
- <a>Luiz Felipe</a>
- <a>Murilo Cardoso</a>
