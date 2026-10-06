import { db, type Tx } from "./db";
import { DomainError, NotFoundError } from "./errors";

/**
 * Ordem de bloqueio para evitar deadlocks (sempre nesta sequência):
 *   auctions → listings → negotiations → orders → cards
 */

type LockTable = "auctions" | "listings" | "negotiations" | "cards" | "orders" | "seller_applications";

/** SELECT ... FOR UPDATE: segura a linha até o fim da transação. */
export async function lockRow(tx: Tx, table: LockTable, id: string) {
  // Nome da tabela vem de um union fechado — não é entrada do usuário.
  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
  if (rows.length === 0) throw new NotFoundError();
}

const DB_MESSAGES: [RegExp, string][] = [
  [/listings_one_active_per_card/, "Este card já possui um anúncio ativo."],
  [/negotiations_one_open_per_buyer/, "Você já tem uma negociação aberta para este anúncio."],
  [/bids_auction_id_amount_cents_key|auction_id.*amount_cents/, "Outro lance com este valor acabou de ser registrado. Atualize e tente novamente."],
  [/orders_listing_id_key/, "Este anúncio já foi vendido."],
  [/seller_applications_one_pending_per_user/, "Você já tem um pedido de habilitação em análise."],
  [/vendedor não pode dar lance/, "O vendedor não pode dar lance no próprio leilão."],
  [/fora do período de lances/, "Este leilão não está aceitando lances no momento."],
  [/abaixo do lance inicial|abaixo do mínimo permitido/, "Lance abaixo do mínimo permitido. Atualize a página e tente novamente."],
  [/somente-inserção/, "Registros de histórico não podem ser alterados."],
];

/** Traduz erros do banco (constraints/triggers) em mensagens de negócio */
export function translateDbError(e: unknown): never {
  if (e instanceof DomainError) throw e;
  const err = e as { code?: string; message?: string; meta?: unknown; cause?: unknown };
  const haystack = [err?.message, JSON.stringify(err?.meta ?? ""), String((err?.cause as { message?: string })?.message ?? "")].join(" ");
  for (const [re, msg] of DB_MESSAGES) if (re.test(haystack)) throw new DomainError(msg, "DB_RULE");
  if (err?.code === "P2034" || /deadlock|could not serialize/i.test(haystack)) {
    throw new DomainError("Houve concorrência com outra operação. Tente novamente.", "CONFLICT");
  }
  throw e;
}

/** Transação interativa com tradução de erros e limites de tempo sensatos */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(fn, { maxWait: 10_000, timeout: 20_000 });
  } catch (e) {
    translateDbError(e);
  }
}
