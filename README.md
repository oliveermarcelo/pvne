# PVNE Cards

Marketplace de cards colecionáveis (Pokémon, One Piece, Disney Lorcana, Magic, Yu-Gi-Oh!, Marvel, DC, Futebol…) com **venda direta**, **negociação por propostas** e **leilões** com encerramento automático.

Todo pagamento passa pela PVNE (PIX intermediado): o comprador paga à plataforma, o vendedor envia após a confirmação e recebe o repasse (valor − comissão + frete) depois da entrega. Só vendedores aprovados (verificação com documento e selfie) podem anunciar.

**Stack:** Next.js 15 (App Router, TypeScript) · Prisma 7 + PostgreSQL 16 · Tailwind CSS · Zod · Docker Compose.

---

## Rodando localmente (Windows / PowerShell)

Pré-requisitos: Node 22+, Docker Desktop.

```powershell
# 1. Banco de dados
docker compose -f docker-compose.dev.yml up -d

# 2. Variáveis de ambiente
Copy-Item .env.example .env

# 3. Dependências (gera o Prisma Client)
npm install

# 4. Migrações + dados iniciais (com dados de demonstração)
npx prisma migrate deploy
npm run db:seed

# 5. Site (http://localhost:3000)
npm run dev

# 6. Em outro terminal: worker que encerra os leilões no horário
npm run worker
```

### Contas criadas pelo seed

| Perfil | Login | Senha |
|---|---|---|
| Administrador | `admin@pvnecards.com.br` | `Admin@12345` (defina `SEED_ADMIN_PASSWORD` antes do seed em produção) |
| Vendedores demo (aprovados) | `ana@demo.pvne`, `bruno@demo.pvne`, `carla@demo.pvne`, `diego@demo.pvne` | `Demo@12345` |
| Compradora demo (não vendedora) | `eva@demo.pvne` | `Demo@12345` |

Os dados de demonstração só são criados fora de produção (ou com `SEED_DEMO=1`) e apenas se o banco ainda não tiver cards.

## Produção (VPS com Docker)

```bash
cp .env.example .env         # ajuste APP_URL, CRON_SECRET, SMTP_*, SEED_ADMIN_* e POSTGRES_PASSWORD
docker compose up -d --build
```

Serviços:

| Serviço | Função |
|---|---|
| `db` | PostgreSQL 16 (volume `pgdata`) |
| `migrate` | roda `prisma migrate deploy` + seed básico e termina |
| `app` | Next.js na porta `APP_PORT` (padrão 3000) — coloque atrás do Nginx/Traefik com HTTPS |
| `worker` | a cada 15 s ativa leilões agendados, encerra os vencidos, envia avisos de “acabando” e entrega os push que ficaram na fila |

Imagens públicas ficam no volume `uploads`; documentos de verificação e comprovantes ficam em `storage/private` (volume `private`) e nunca são públicos. Configure a chave PIX da plataforma em **Admin → Configurações** antes de abrir as vendas. Deploy de atualização: `git pull && docker compose up -d --build`.

Alternativa ao worker: um cron externo pode chamar
`POST /api/cron/auctions` com `Authorization: Bearer <CRON_SECRET>`.

## App (PWA) — instalar no celular

O site é um app instalável (PWA): ícone na tela inicial, tela cheia, barra de abas embaixo,
tela de abertura, página "sem internet" e **notificações push** (lance coberto, proposta,
leilão vencido, pedido pago/enviado…), inclusive com o app fechado.

- **Requer HTTPS** em produção (em `localhost` funciona sem). Pelo IP da rede (`http://192.168…`) o
  celular **não** instala nem recebe push. Para testar no celular antes do deploy, abra um túnel HTTPS:
  `npx cloudflared tunnel --url http://localhost:3000` e acesse o endereço `https://…trycloudflare.com` que aparecer.
- **Android / computador (Chrome, Edge, Samsung):** aparece o convite "Instalar" no site, ou menu ⋮ → *Instalar app*.
- **iPhone (iOS 16.4+):** Safari → Compartilhar → *Adicionar à Tela de Início*. O push no iPhone só funciona
  com o app instalado. O app instalado tem login próprio (é preciso entrar de novo uma vez).
- Página com o passo a passo para os clientes: **/instalar**. O usuário ativa os avisos em **Minha conta → Notificações**.
- O push de cada aparelho fica preso à sessão: ao sair da conta ou trocar a senha, aquele aparelho para de receber.
- Ícones e telas de abertura são gerados a partir de `public/logo.svg`: `npm run pwa:assets` (rode de novo se trocar o logo).
- O service worker (`public/sw.js`) **nunca guarda páginas nem dados da conta** — só JS/CSS, ícones e fotos públicas.
  Ao mudar esse arquivo, aumente `VERSION` dentro dele.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | worker de leilões |
| `npm run db:migrate` | aplica migrações (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | cria nova migração a partir do `schema.prisma` (desenvolvimento) |
| `npm run db:seed` | categorias, páginas, configurações, admin (+ demo) |
| `npm run typecheck` | checagem de tipos |
| `npm run test:push` | teste da fila de notificações push (envio único, validação de endereço, criptografia) |
| `npm run pwa:assets` | gera ícones e telas de abertura do app a partir de `public/logo.svg` |
| `npm run test:bids` | teste de concorrência de lances/leilões/compra (use um banco de teste: cria dados `zz_test_*`) |

## Onde está cada coisa

```
prisma/
  schema.prisma                 modelo de dados
  migrations/                   SQL versionado (inclui triggers e índices parciais)
  seed.ts, seed-pages.ts        dados iniciais
scripts/
  worker.ts                     processo de leilões
  test-concurrent-bids.ts       teste de concorrência
  test-push.ts                  teste da fila de push
  generate-pwa-assets.mjs       ícones e telas de abertura do app
public/
  sw.js, offline.html, pwa/     service worker, página offline, ícones/splash do app
src/
  server/                       regras de negócio (nunca vão para o navegador)
    auth/                       sessão, senha, guards (requireUser / requireAdmin)
    modules/                    users, categories, albums, cards, listings, auctions,
                                negotiations, orders, notifications, favorites,
                                contacts, pages, admin
    tx.ts                       transações e locks de linha (SELECT … FOR UPDATE)
    validation.ts               helpers Zod (dinheiro, datas, uploads)
    storage.ts                  upload de imagens (disco local; trocável por S3)
    push.ts                     notificações push (VAPID, fila sem duplicar, limpeza)
    audit.ts, settings.ts, mail.ts, rate-limit.ts
  app/
    actions/                    Server Actions (camada fina: autentica → chama o módulo)
    (site)/                     páginas públicas, autenticação e área do usuário (/conta)
    admin/                      painel administrativo
    api/                        upload, estado do leilão (tempo real), cron, push
    manifest.ts                 manifesto do app (nome, ícones, atalhos)
  components/                   UI (pwa/: instalação, push, puxar-para-atualizar)
docs/ARQUITETURA.md             decisões de arquitetura e regras de negócio
```

## Atenção ao alterar o banco

Mudou o `schema.prisma`? Gere a migração **antes** do commit:

```powershell
npm run db:migrate:dev -- --name descricao_da_mudanca
```

A migração `20260930000100_integrity_rules` cria objetos que o Prisma não representa no schema (índices únicos parciais, CHECKs e triggers de imutabilidade). O Prisma não os considera divergência (`prisma migrate status` e `migrate diff` ficam limpos), mas mantenha essa migração sempre aplicada — ela é parte das regras de negócio.
