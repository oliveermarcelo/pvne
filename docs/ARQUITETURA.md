# Arquitetura — PVNE Cards

## Visão geral

Aplicação full-stack única em Next.js (App Router). Páginas são Server Components que leem o banco diretamente pelos **módulos de domínio** (`src/server/modules`). Mutações passam por **Server Actions** (`src/app/actions`), que só autenticam, chamam o módulo e revalidam a página. Toda regra de negócio fica nos módulos — assim ela pode ser reaproveitada por uma API REST/mobile no futuro sem reescrita.

```
Navegador ──► Server Action / Route Handler ──► módulo de domínio ──► Prisma ──► PostgreSQL
                  (auth + revalidate)             (validação Zod,        (transação,
                                                   permissões, regras)    locks, triggers)
Worker (processo separado) ─────────────────────► auctions.processAuctions()
```

## Modelo de dados

| Tabela | Papel |
|---|---|
| `users` | contas; `role` USER/ADMIN; `status` ACTIVE/BLOCKED/DELETED |
| `sessions` | sessões (id = SHA-256 do token do cookie) |
| `password_reset_tokens` | recuperação de senha (hash do token, validade 1 h, uso único) |
| `categories` | administráveis; `parent_id` para subcategorias (1 nível) |
| `albums` | coleções do usuário (público/privado/arquivado) |
| `cards` + `card_images` | o item físico da coleção |
| `listings` | a **oferta** de um card: DIRECT_SALE, NEGOTIATION ou AUCTION |
| `auctions` | parâmetros e estado do leilão (1:1 com listing) |
| `bids` | lances — **somente inserção** |
| `negotiations` + `negotiation_messages` | negociação e sua linha do tempo — **somente inserção** |
| `orders` | toda venda fechada (compra direta, proposta aceita, leilão vencido) com pagamento intermediado, frete, comissão e repasse |
| `order_events` | linha do tempo + chat do pedido — **somente inserção** |
| `seller_applications` / `seller_profiles` | habilitação de vendedores (KYC) e dados de repasse (PIX) |
| `favorites`, `notifications`, `contact_messages` | engajamento e atendimento |
| `pages`, `settings` | conteúdo institucional e links (WhatsApp/Instagram) editáveis |
| `audit_logs` | ações importantes — **somente inserção** |

Valores monetários são inteiros em **centavos**. Datas em UTC, exibidas em America/Sao_Paulo.

### Por que separar card e anúncio

O card é o objeto da coleção; o anúncio é um evento comercial sobre ele. Isso permite histórico (um card pode ser anunciado, não vender, e ser leiloado depois), estatísticas de preço e, no futuro, anúncios com regras próprias (frete, comissão). **Regra no banco:** no máximo um anúncio `ACTIVE` por card (índice único parcial).

## Regras de integridade no banco (defesa em profundidade)

Criadas em `prisma/migrations/20260930000100_integrity_rules`:

- `listings_one_active_per_card` e `negotiations_one_open_per_buyer` (índices únicos parciais);
- `bids (auction_id, amount_cents)` único — dois lances iguais nunca coexistem;
- `orders (listing_id)` único — um anúncio nunca é vendido duas vezes;
- CHECKs de valores positivos, período do leilão válido, partes distintas;
- trigger `pvne_prevent_mutation` bloqueia UPDATE/DELETE em `bids`, `negotiation_messages` e `audit_logs`;
- trigger `pvne_validate_bid` revalida no INSERT: vendedor não dá lance, leilão dentro do período (relógio do banco) e valor ≥ mínimo.

## Concorrência

Todas as operações que disputam o mesmo recurso rodam em transação com `SELECT … FOR UPDATE` (`src/server/tx.ts`). **Ordem fixa de locks** para evitar deadlock: `auctions → listings → negotiations`.

**Lance (`placeBid`)**
1. bloqueia a linha do leilão;
2. relê o estado já bloqueado e valida: conta ativa, não é o vendedor, leilão começou e não terminou, não é o líder atual, valor ≥ lance atual + incremento (ou ≥ lance inicial);
3. insere o lance (trigger revalida) e atualiza lance atual, líder, contagem e o preço exibido do anúncio;
4. notifica vendedor e quem foi superado — na mesma transação.

Dois lances simultâneos são serializados: o segundo enxerga o primeiro e é rejeitado com o novo mínimo. O script `npm run test:bids` dispara 25 lances simultâneos de mesmo valor (1 aceito), uma rajada crescente, encerramento concorrente (1 pedido) e 10 compras simultâneas (1 venda).

**Anti-sniping** (opcional, admin → configurações): lance nos últimos N minutos prorroga o fim.

## Leilão: ciclo de vida

`SCHEDULED → ACTIVE → ENDED` (ou `CANCELLED`).

- O worker ativa agendados, encerra vencidos e envia “acabando” (uma vez, com reivindicação atômica).
- Se ninguém processou ainda, a própria página do leilão encerra ao ser aberta (idempotente).
- Ao encerrar: se há líder e a reserva foi atingida → `completeSale` cria o pedido, **transfere o card ao vencedor**, notifica vencedor, vendedor e demais participantes. Senão → anúncio `EXPIRED`, notifica vendedor (e o líder, se a reserva não foi atingida).
- Vendedor só cancela sem lances; com lances, só a administração (participantes notificados, lances preservados).

## Vendedores e pagamento intermediado

- Qualquer usuário compra e dá lances. **Anunciar exige `users.seller_status = APPROVED`** (verificado em `createListing`).
- Habilitação: CPF/CNPJ (validado), endereço, chave PIX, documento frente/verso e selfie. Os arquivos vão para `storage/private` (fora de `/uploads`) e só são servidos por `/api/private/...` ao dono e a administradores.
- Fluxo do pedido (`src/server/modules/orders.ts`):
  `AWAITING_PAYMENT → PAYMENT_REVIEW → PAID → SHIPPED → DELIVERED → COMPLETED`, com `DISPUTED`/`CANCELLED`.
  1. Venda fechada cria o pedido (card reservado; o anúncio sai do ar). Prazo de pagamento configurável.
  2. Comprador informa endereço, paga via PIX (BR Code gerado em `src/lib/pix.ts` com valor e identificador `PVNE<código>`) e anexa o comprovante.
  3. Admin confere e confirma → vendedor vê o endereço e informa o rastreio.
  4. Comprador confirma o recebimento (ou o worker confirma após N dias) → **o card muda de dono** e o repasse fica pendente.
  5. Admin faz o PIX ao vendedor e registra o identificador → `COMPLETED`.
- Comissão em pontos-base: padrão em configurações, com override por categoria (`categories.commission_bps`). Congelada no pedido (`commission_bps`, `fee_cents`, `seller_net_cents` = item − comissão + frete).
- Contatos nunca são exibidos. `src/lib/contact-filter.ts` remove telefones, e-mails e links de WhatsApp/Telegram/Instagram de mensagens, descrições, observações e bio.
- Worker: cancela pedidos não pagos no prazo e confirma entregas automaticamente.
- Evolução natural: trocar a confirmação manual por webhook de gateway (Mercado Pago/Asaas/Pagar.me com split) mantendo os mesmos estados.

## Negociação

Turnos: quem **não** fez a última proposta pode aceitar, recusar ou contrapropor. Qualquer parte pode mandar mensagem ou desistir. Aceite → `completeSale` (mesma rotina do leilão), encerra as demais negociações abertas do anúncio e notifica todos. A administração pode registrar nota visível e encerrar.

## Segurança

- Senhas com bcrypt (12 rounds); login com resposta de tempo constante e rate limit por IP e por conta.
- Sessão em cookie `httpOnly`/`SameSite=Lax` (Secure em produção); apenas o hash do token é salvo.
- Troca/redefinição de senha encerra outras sessões; bloqueio de usuário derruba as sessões.
- `middleware.ts` barra `/conta` e `/admin` sem cookie; cada página/action revalida sessão e papel no servidor.
- Toda consulta de escrita filtra por dono (`ownerId`, `sellerId`, partes da negociação) — um usuário nunca altera dado de outro.
- Server Actions têm proteção de origem nativa do Next; o upload verifica `Origin`, tipo real do arquivo (magic bytes), tamanho e pasta.
- Conteúdo das páginas institucionais é Markdown sem HTML bruto.
- Cabeçalhos: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Exclusão de usuário = anonimização (preserva a integridade de lances e pedidos).

## App (PWA) e notificações push

- `app/manifest.ts` + `public/sw.js` + ícones/splash em `public/pwa/` tornam o site instalável (Android, iPhone, computador).
- **Cache seguro:** o service worker nunca guarda HTML nem `/api/*` (área logada, documentos privados, dados ao vivo).
  Só guarda `/_next/static/*` (nomes com hash), ícones e fotos públicas (`/uploads/*`, até 200). Sem internet → `offline.html`.
- **Push:** `notify()` grava o aviso na transação do evento e agenda `dispatchPendingPush()` para depois do commit.
  O despacho reserva os avisos com `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, então app e worker
  podem rodar juntos sem enviar em dobro; se a transação do evento falhar, o aviso não existe e nada é enviado.
- `push_subscriptions.session_id` com `ON DELETE CASCADE`: sair da conta/trocar a senha encerra o push daquele aparelho;
  ao entrar de novo, o app reassocia a inscrição existente. Inscrições 404/410 são apagadas; 15 falhas seguidas também.
- Endereços de push aceitos só dos serviços dos navegadores (FCM, Mozilla, Apple, Windows, Samsung) — evita SSRF.
- Chaves VAPID: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` no `.env`; sem elas, um par é gerado e guardado em
  `settings` (chave `_vapid_keys`, fora de `SETTING_DEFAULTS`, nunca exposta nas páginas).

## Preparado para o futuro

| Funcionalidade | Ponto de extensão |
|---|---|
| Gateway de pagamento | substituir `adminConfirmPayment` por webhook; `createOrderFromSale` é o único ponto onde a venda nasce |
| Carteira | nova tabela de lançamentos ligada a `orders` |
| Frete / rastreamento | estados SHIPPED/DELIVERED em `orders`; tabela `shipments` 1:N |
| Reputação / avaliações | tabela `reviews` ligada a `orders` (1 por parte) |
| Disputas / denúncias | `orders.status = DISPUTED`; tabelas `disputes` e `reports` |
| Chat | `negotiation_messages` já é uma linha do tempo; extrair para `conversations` |
| Autenticidade / graded | campos/tabela `card_gradings` (empresa, nota, certificado) ligada a `cards` |
| Subcategorias | `categories.parent_id` já existe |
| Notificações por e-mail/WhatsApp | `notifications.notify()` é o ponto único (push já implementado em `server/push.ts`) |
| Armazenamento S3/R2 | reimplementar `src/server/storage.ts` mantendo as URLs |
| Tempo real (SSE/WebSocket) | substituir o polling de `/api/auctions/[id]/state` |
